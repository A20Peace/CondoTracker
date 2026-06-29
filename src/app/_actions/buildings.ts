"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isValidIban, normalizeIban } from "@/lib/utils";

export type ActionResult = { ok: true } | { ok: false; error: string };

const idSchema = z.string().uuid();

async function currentUserId(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** Invite code charset: no ambiguous chars (0/O, 1/I). */
const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function genInviteCode(len = 8): string {
  let s = "";
  for (let i = 0; i < len; i++) {
    s += INVITE_ALPHABET[Math.floor(Math.random() * INVITE_ALPHABET.length)];
  }
  return s;
}

const ibanField = z
  .string()
  .trim()
  .max(40)
  .optional()
  .nullable()
  .transform((v) => (v ? normalizeIban(v) : null));

const buildingSchema = z.object({
  name: z.string().trim().min(1, "Inserisci il nome del condominio").max(120),
  address: z.string().trim().max(200).optional().nullable(),
  iban: ibanField,
  bank_holder: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export type BuildingInput = z.input<typeof buildingSchema>;

function checkIban(iban: string | null): string | null {
  if (iban && !isValidIban(iban)) return "IBAN non valido";
  return null;
}

export async function createBuilding(
  input: BuildingInput,
): Promise<ActionResult & { id?: string }> {
  const parsed = buildingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" };
  }
  const ibanErr = checkIban(parsed.data.iban);
  if (ibanErr) return { ok: false, error: ibanErr };

  const uid = await currentUserId();
  if (!uid) return { ok: false, error: "Sessione non valida" };

  const supabase = createClient();
  const { data, error } = await supabase
    .from("buildings")
    .insert({
      admin_id: uid,
      name: parsed.data.name,
      address: parsed.data.address ?? null,
      iban: parsed.data.iban,
      bank_holder: parsed.data.bank_holder ?? null,
      notes: parsed.data.notes ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Creazione non riuscita" };
  }

  revalidatePath("/buildings");
  revalidatePath("/home");
  return { ok: true, id: data.id };
}

export async function updateBuilding(
  buildingId: string,
  input: BuildingInput,
): Promise<ActionResult> {
  const id = idSchema.safeParse(buildingId);
  if (!id.success) return { ok: false, error: "ID non valido" };
  const parsed = buildingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" };
  }
  const ibanErr = checkIban(parsed.data.iban);
  if (ibanErr) return { ok: false, error: ibanErr };

  const supabase = createClient();
  const { error } = await supabase
    .from("buildings")
    .update({
      name: parsed.data.name,
      address: parsed.data.address ?? null,
      iban: parsed.data.iban,
      bank_holder: parsed.data.bank_holder ?? null,
      notes: parsed.data.notes ?? null,
    })
    .eq("id", id.data);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/buildings/${id.data}`);
  revalidatePath("/buildings");
  return { ok: true };
}

export async function deleteBuilding(buildingId: string): Promise<ActionResult> {
  const id = idSchema.safeParse(buildingId);
  if (!id.success) return { ok: false, error: "ID non valido" };

  const supabase = createClient();
  const { error } = await supabase.from("buildings").delete().eq("id", id.data);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/buildings");
  revalidatePath("/home");
  return { ok: true };
}

export async function regenerateInviteCode(
  buildingId: string,
): Promise<ActionResult & { code?: string }> {
  const id = idSchema.safeParse(buildingId);
  if (!id.success) return { ok: false, error: "ID non valido" };

  const supabase = createClient();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = genInviteCode();
    const { error } = await supabase
      .from("buildings")
      .update({ invite_code: code })
      .eq("id", id.data);
    if (!error) {
      revalidatePath(`/buildings/${id.data}`);
      return { ok: true, code };
    }
    if (!/duplicate|unique/i.test(error.message)) {
      return { ok: false, error: error.message };
    }
  }
  return { ok: false, error: "Impossibile generare un nuovo codice, riprova" };
}

// ─── Units ─────────────────────────────────────────────────────────────────

const unitSchema = z.object({
  building_id: idSchema,
  label: z.string().trim().min(1, "Inserisci un nome per l'unità").max(80),
  floor: z.string().trim().max(40).optional().nullable(),
  description: z.string().trim().max(200).optional().nullable(),
  /** Millesimi in the building's default table (optional shortcut). */
  millesimi: z
    .union([z.number(), z.string()])
    .optional()
    .nullable()
    .transform((v) => {
      if (v === null || v === undefined || v === "") return null;
      const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
      return Number.isFinite(n) ? n : null;
    }),
});

export type UnitInput = z.input<typeof unitSchema>;

async function defaultTableId(
  supabase: ReturnType<typeof createClient>,
  buildingId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("millesimi_tables")
    .select("id")
    .eq("building_id", buildingId)
    .eq("is_default", true)
    .maybeSingle();
  return data?.id ?? null;
}

export async function createUnit(input: UnitInput): Promise<ActionResult> {
  const parsed = unitSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" };
  }

  const supabase = createClient();
  const { data: unit, error } = await supabase
    .from("units")
    .insert({
      building_id: parsed.data.building_id,
      label: parsed.data.label,
      floor: parsed.data.floor ?? null,
      description: parsed.data.description ?? null,
    })
    .select("id")
    .single();
  if (error || !unit) {
    return { ok: false, error: error?.message ?? "Creazione non riuscita" };
  }

  // Optionally set the default-table millesimi in one go.
  if (parsed.data.millesimi !== null && parsed.data.millesimi !== undefined) {
    const tableId = await defaultTableId(supabase, parsed.data.building_id);
    if (tableId) {
      await supabase.from("unit_shares").upsert(
        { table_id: tableId, unit_id: unit.id, millesimi: parsed.data.millesimi },
        { onConflict: "table_id,unit_id" },
      );
    }
  }

  revalidatePath(`/buildings/${parsed.data.building_id}`);
  return { ok: true };
}

const unitUpdateSchema = z.object({
  label: z.string().trim().min(1).max(80),
  floor: z.string().trim().max(40).optional().nullable(),
  description: z.string().trim().max(200).optional().nullable(),
});

export async function updateUnit(
  unitId: string,
  input: z.input<typeof unitUpdateSchema>,
): Promise<ActionResult> {
  const id = idSchema.safeParse(unitId);
  if (!id.success) return { ok: false, error: "ID non valido" };
  const parsed = unitUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" };
  }

  const supabase = createClient();
  const { data: unit, error } = await supabase
    .from("units")
    .update({
      label: parsed.data.label,
      floor: parsed.data.floor ?? null,
      description: parsed.data.description ?? null,
    })
    .eq("id", id.data)
    .select("building_id")
    .single();
  if (error) return { ok: false, error: error.message };
  if (unit) revalidatePath(`/buildings/${unit.building_id}`);
  return { ok: true };
}

export async function deleteUnit(unitId: string): Promise<ActionResult> {
  const id = idSchema.safeParse(unitId);
  if (!id.success) return { ok: false, error: "ID non valido" };

  const supabase = createClient();
  // Refuse to delete a unit that already has quote (would lose payment history).
  const { count } = await supabase
    .from("charges")
    .select("id", { count: "exact", head: true })
    .eq("unit_id", id.data);
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: "L'unità ha delle quote registrate e non può essere eliminata.",
    };
  }

  const { data: unit } = await supabase
    .from("units")
    .select("building_id")
    .eq("id", id.data)
    .maybeSingle();
  const { error } = await supabase.from("units").delete().eq("id", id.data);
  if (error) return { ok: false, error: error.message };
  if (unit) revalidatePath(`/buildings/${unit.building_id}`);
  return { ok: true };
}

// ─── Millesimi shares & tables ───────────────────────────────────────────────

const shareSchema = z.object({
  table_id: idSchema,
  unit_id: idSchema,
  millesimi: z
    .union([z.number(), z.string()])
    .transform((v) => {
      const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
      return Number.isFinite(n) && n >= 0 ? n : 0;
    }),
});

export async function setUnitShare(
  input: z.input<typeof shareSchema>,
  buildingId: string,
): Promise<ActionResult> {
  const parsed = shareSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Valore millesimi non valido" };

  const supabase = createClient();
  const { error } = await supabase.from("unit_shares").upsert(
    {
      table_id: parsed.data.table_id,
      unit_id: parsed.data.unit_id,
      millesimi: parsed.data.millesimi,
    },
    { onConflict: "table_id,unit_id" },
  );
  if (error) return { ok: false, error: error.message };
  if (idSchema.safeParse(buildingId).success) {
    revalidatePath(`/buildings/${buildingId}`);
  }
  return { ok: true };
}

export async function createMillesimiTable(
  buildingId: string,
  name: string,
): Promise<ActionResult> {
  const parsed = z
    .object({ buildingId: idSchema, name: z.string().trim().min(1).max(60) })
    .safeParse({ buildingId, name });
  if (!parsed.success) return { ok: false, error: "Nome tabella non valido" };

  const supabase = createClient();
  const { error } = await supabase
    .from("millesimi_tables")
    .insert({ building_id: parsed.data.buildingId, name: parsed.data.name });
  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      return { ok: false, error: "Esiste già una tabella con questo nome" };
    }
    return { ok: false, error: error.message };
  }
  revalidatePath(`/buildings/${parsed.data.buildingId}`);
  return { ok: true };
}

export async function deleteMillesimiTable(
  tableId: string,
  buildingId: string,
): Promise<ActionResult> {
  const id = idSchema.safeParse(tableId);
  if (!id.success) return { ok: false, error: "ID non valido" };

  const supabase = createClient();
  const { data: table } = await supabase
    .from("millesimi_tables")
    .select("is_default")
    .eq("id", id.data)
    .maybeSingle();
  if (table?.is_default) {
    return { ok: false, error: "La tabella predefinita non può essere eliminata." };
  }

  const { count } = await supabase
    .from("expenses")
    .select("id", { count: "exact", head: true })
    .eq("table_id", id.data);
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: "La tabella è usata da una o più spese e non può essere eliminata.",
    };
  }

  const { error } = await supabase.from("millesimi_tables").delete().eq("id", id.data);
  if (error) return { ok: false, error: error.message };
  if (idSchema.safeParse(buildingId).success) {
    revalidatePath(`/buildings/${buildingId}`);
  }
  return { ok: true };
}
