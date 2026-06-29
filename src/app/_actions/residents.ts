"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

const idSchema = z.string().uuid();

async function currentUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

// ─── Admin: manage residents of a unit ───────────────────────────────────────

const residentSchema = z.object({
  unit_id: idSchema,
  name: z.string().trim().min(1, "Inserisci il nome").max(120),
  email: z.string().trim().email("Email non valida").max(160),
  phone: z.string().trim().max(40).optional().nullable(),
});

export type ResidentInput = z.input<typeof residentSchema>;

/**
 * Admin adds a condòmino manually (name + email). If a registered user already
 * exists with that email, links it so they immediately see their quote.
 */
export async function addResident(input: ResidentInput): Promise<ActionResult> {
  const parsed = residentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" };
  }

  const supabase = createClient();
  const email = parsed.data.email.toLowerCase();

  // Best-effort: link to an existing account with the same email.
  let userId: string | null = null;
  try {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    userId = profile?.id ?? null;
  } catch {
    // service-role not configured → just create the contact without linking
  }

  const { error } = await supabase.from("residents").insert({
    unit_id: parsed.data.unit_id,
    name: parsed.data.name,
    email,
    phone: parsed.data.phone ?? null,
    user_id: userId,
    status: "active",
  });
  if (error) return { ok: false, error: error.message };

  await revalidateUnit(supabase, parsed.data.unit_id);
  return { ok: true };
}

const residentUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().max(40).optional().nullable(),
});

export async function updateResident(
  residentId: string,
  input: z.input<typeof residentUpdateSchema>,
): Promise<ActionResult> {
  const id = idSchema.safeParse(residentId);
  if (!id.success) return { ok: false, error: "ID non valido" };
  const parsed = residentUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" };
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("residents")
    .update({
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      phone: parsed.data.phone ?? null,
    })
    .eq("id", id.data)
    .select("unit_id")
    .single();
  if (error) return { ok: false, error: error.message };
  if (data) await revalidateUnit(supabase, data.unit_id);
  return { ok: true };
}

/** Admin confirms a self-registered (pending) condòmino. */
export async function confirmResident(residentId: string): Promise<ActionResult> {
  const id = idSchema.safeParse(residentId);
  if (!id.success) return { ok: false, error: "ID non valido" };

  const supabase = createClient();
  const { data, error } = await supabase
    .from("residents")
    .update({ status: "active" })
    .eq("id", id.data)
    .select("unit_id")
    .single();
  if (error) return { ok: false, error: error.message };
  if (data) await revalidateUnit(supabase, data.unit_id);
  revalidatePath("/home");
  return { ok: true };
}

/** Admin removes a condòmino (or rejects a pending request). */
export async function removeResident(residentId: string): Promise<ActionResult> {
  const id = idSchema.safeParse(residentId);
  if (!id.success) return { ok: false, error: "ID non valido" };

  const supabase = createClient();
  const { data: resident } = await supabase
    .from("residents")
    .select("unit_id")
    .eq("id", id.data)
    .maybeSingle();
  const { error } = await supabase.from("residents").delete().eq("id", id.data);
  if (error) return { ok: false, error: error.message };
  if (resident) await revalidateUnit(supabase, resident.unit_id);
  return { ok: true };
}

async function revalidateUnit(
  supabase: ReturnType<typeof createClient>,
  unitId: string,
): Promise<void> {
  // Revalidate the parent building's page (look up building_id).
  const { data } = await supabase
    .from("units")
    .select("building_id")
    .eq("id", unitId)
    .maybeSingle();
  if (data) revalidatePath(`/buildings/${data.building_id}`);
}

// ─── Resident self-registration via invite code ──────────────────────────────

export interface BuildingLookup {
  ok: true;
  building: { id: string; name: string };
  units: { id: string; label: string; floor: string | null }[];
}

/**
 * Resolves a condominio (and its units) from an invite code, so a condòmino can
 * pick their unit. Uses the service-role client because the user is not yet a
 * member. The code is the shared secret; the admin still confirms the link.
 */
export async function findBuildingByCode(
  code: string,
): Promise<BuildingLookup | { ok: false; error: string }> {
  const normalized = normalizeCode(code);
  if (!/^[A-Z0-9]{4,16}$/.test(normalized)) {
    return { ok: false, error: "Codice non valido" };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: "Configurazione server mancante" };
  }

  const { data: building } = await admin
    .from("buildings")
    .select("id, name")
    .eq("invite_code", normalized)
    .maybeSingle();
  if (!building) {
    return { ok: false, error: "Nessun condominio trovato con questo codice" };
  }

  const { data: units } = await admin
    .from("units")
    .select("id, label, floor")
    .eq("building_id", building.id)
    .order("label", { ascending: true });

  return {
    ok: true,
    building: { id: building.id, name: building.name },
    units: units ?? [],
  };
}

/**
 * Associates the current user to a unit via an invite code. Creates a `pending`
 * resident (awaiting admin confirmation), or links an existing admin-added
 * contact with the same email (already approved → `active`).
 */
export async function joinByInviteCode(
  code: string,
  unitId: string,
): Promise<{ ok: true; status: "pending" | "active" } | { ok: false; error: string }> {
  const normalized = normalizeCode(code);
  const unit = idSchema.safeParse(unitId);
  if (!unit.success) return { ok: false, error: "Unità non valida" };

  const user = await currentUser();
  if (!user) return { ok: false, error: "Sessione non valida" };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: "Configurazione server mancante" };
  }

  // Verify the code matches the unit's building.
  const { data: unitRow } = await admin
    .from("units")
    .select("id, building_id")
    .eq("id", unit.data)
    .maybeSingle();
  if (!unitRow) {
    return { ok: false, error: "Codice o unità non corrispondenti" };
  }
  const { data: buildingRow } = await admin
    .from("buildings")
    .select("invite_code")
    .eq("id", unitRow.building_id)
    .maybeSingle();
  if (!buildingRow || buildingRow.invite_code !== normalized) {
    return { ok: false, error: "Codice o unità non corrispondenti" };
  }

  const email = (user.email ?? "").toLowerCase();

  // Already associated to this unit?
  const { data: mine } = await admin
    .from("residents")
    .select("id, status")
    .eq("unit_id", unit.data)
    .eq("user_id", user.id)
    .maybeSingle();
  if (mine) {
    return { ok: true, status: mine.status as "pending" | "active" };
  }

  // An admin-added contact with my email for this unit → link & activate.
  if (email) {
    const { data: contact } = await admin
      .from("residents")
      .select("id")
      .eq("unit_id", unit.data)
      .is("user_id", null)
      .ilike("email", email)
      .maybeSingle();
    if (contact) {
      const { error } = await admin
        .from("residents")
        .update({ user_id: user.id, status: "active" })
        .eq("id", contact.id);
      if (error) return { ok: false, error: error.message };
      revalidatePath("/me");
      revalidatePath(`/buildings/${unitRow.building_id}`);
      return { ok: true, status: "active" };
    }
  }

  // Otherwise create a pending request for admin confirmation.
  const { error } = await admin.from("residents").insert({
    unit_id: unit.data,
    name: (user.user_metadata?.display_name as string) || email || "Condòmino",
    email: email || "n/d",
    user_id: user.id,
    status: "pending",
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/me");
  revalidatePath(`/buildings/${unitRow.building_id}`);
  return { ok: true, status: "pending" };
}
