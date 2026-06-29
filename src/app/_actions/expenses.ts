"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { distribute } from "@/lib/millesimi";

export type ActionResult = { ok: true } | { ok: false; error: string };

const idSchema = z.string().uuid();
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida");
const amountSchema = z
  .union([z.number(), z.string()])
  .transform((v) => {
    const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
  })
  .refine((n) => Number.isFinite(n) && n >= 0, "Importo non valido");

async function currentUserId(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// ─── Distribution basis (units + millesimi for a table) ──────────────────────

export interface DistributionUnit {
  id: string;
  label: string;
  floor: string | null;
  millesimi: number;
}

/**
 * Units of a building with their millesimi in the given table — the basis for
 * computing each unit's quota. Read with the admin's RLS client.
 */
export async function getDistributionBasis(
  buildingId: string,
  tableId: string,
): Promise<
  | { ok: true; units: DistributionUnit[]; total: number }
  | { ok: false; error: string }
> {
  if (!idSchema.safeParse(buildingId).success || !idSchema.safeParse(tableId).success) {
    return { ok: false, error: "Parametri non validi" };
  }

  const supabase = createClient();
  const { data: units } = await supabase
    .from("units")
    .select("id, label, floor")
    .eq("building_id", buildingId)
    .order("label", { ascending: true });

  const { data: shares } = await supabase
    .from("unit_shares")
    .select("unit_id, millesimi")
    .eq("table_id", tableId);

  const shareMap = new Map<string, number>();
  (shares ?? []).forEach((s) => shareMap.set(s.unit_id, Number(s.millesimi)));

  const result: DistributionUnit[] = (units ?? []).map((u) => ({
    id: u.id,
    label: u.label,
    floor: u.floor,
    millesimi: shareMap.get(u.id) ?? 0,
  }));
  const total = result.reduce((s, u) => s + u.millesimi, 0);
  return { ok: true, units: result, total };
}

// ─── Create / update / confirm / delete expense ──────────────────────────────

const createSchema = z.object({
  building_id: idSchema,
  table_id: idSchema,
  title: z.string().trim().min(1, "Inserisci una descrizione").max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  amount: amountSchema,
  expense_date: dateSchema.optional().nullable(),
  due_date: dateSchema,
  document_url: z.string().optional().nullable(),
  extracted_raw: z.any().optional(),
  charges: z
    .array(
      z.object({
        unit_id: idSchema,
        amount: amountSchema,
      }),
    )
    .min(1, "Nessuna quota da registrare"),
});

export type CreateExpenseInput = z.input<typeof createSchema>;

export async function createExpense(
  input: CreateExpenseInput,
): Promise<ActionResult & { id?: string }> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" };
  }

  const uid = await currentUserId();
  if (!uid) return { ok: false, error: "Sessione non valida" };

  const supabase = createClient();

  // Only keep charges for units that actually belong to this building.
  const { data: buildingUnits } = await supabase
    .from("units")
    .select("id")
    .eq("building_id", parsed.data.building_id);
  const validUnits = new Set((buildingUnits ?? []).map((u) => u.id));
  const charges = parsed.data.charges.filter((c) => validUnits.has(c.unit_id));
  if (charges.length === 0) {
    return { ok: false, error: "Nessuna quota valida per questo condominio" };
  }

  const { data: expense, error } = await supabase
    .from("expenses")
    .insert({
      building_id: parsed.data.building_id,
      table_id: parsed.data.table_id,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      amount: parsed.data.amount,
      expense_date: parsed.data.expense_date ?? null,
      due_date: parsed.data.due_date,
      document_url: parsed.data.document_url ?? null,
      extracted_raw: parsed.data.extracted_raw ?? null,
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !expense) {
    return { ok: false, error: error?.message ?? "Creazione non riuscita" };
  }

  const { error: chargeErr } = await supabase.from("charges").insert(
    charges.map((c) => ({
      expense_id: expense.id,
      unit_id: c.unit_id,
      amount: c.amount,
      status: "unpaid" as const,
    })),
  );
  if (chargeErr) {
    // Roll back the orphan expense so the admin can retry cleanly.
    await supabase.from("expenses").delete().eq("id", expense.id);
    return { ok: false, error: chargeErr.message };
  }

  revalidatePath("/expenses");
  return { ok: true, id: expense.id };
}

const draftUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  amount: amountSchema,
  expense_date: dateSchema.optional().nullable(),
  due_date: dateSchema,
});

/** Edit a draft expense's header fields (does not touch quote amounts). */
export async function updateExpense(
  expenseId: string,
  input: z.input<typeof draftUpdateSchema>,
): Promise<ActionResult> {
  const id = idSchema.safeParse(expenseId);
  if (!id.success) return { ok: false, error: "ID non valido" };
  const parsed = draftUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" };
  }

  const supabase = createClient();
  const { data: expense } = await supabase
    .from("expenses")
    .select("status")
    .eq("id", id.data)
    .maybeSingle();
  if (expense?.status !== "draft") {
    return { ok: false, error: "Solo le spese in bozza possono essere modificate" };
  }

  const { error } = await supabase
    .from("expenses")
    .update({
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      amount: parsed.data.amount,
      expense_date: parsed.data.expense_date ?? null,
      due_date: parsed.data.due_date,
    })
    .eq("id", id.data);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/expenses/${id.data}`);
  return { ok: true };
}

/** Adjust a single unit's quota on a draft expense. */
export async function setChargeAmount(
  chargeId: string,
  amount: number | string,
  expenseId: string,
): Promise<ActionResult> {
  const id = idSchema.safeParse(chargeId);
  if (!id.success) return { ok: false, error: "ID non valido" };
  const amt = amountSchema.safeParse(amount);
  if (!amt.success) return { ok: false, error: "Importo non valido" };

  const supabase = createClient();
  const { error } = await supabase
    .from("charges")
    .update({ amount: amt.data })
    .eq("id", id.data);
  if (error) return { ok: false, error: error.message };
  if (idSchema.safeParse(expenseId).success) revalidatePath(`/expenses/${expenseId}`);
  return { ok: true };
}

/** Recompute all quote of a draft expense from its table and total amount. */
export async function recalcCharges(expenseId: string): Promise<ActionResult> {
  const id = idSchema.safeParse(expenseId);
  if (!id.success) return { ok: false, error: "ID non valido" };

  const supabase = createClient();
  const { data: expense } = await supabase
    .from("expenses")
    .select("id, building_id, table_id, amount, status")
    .eq("id", id.data)
    .maybeSingle();
  if (!expense) return { ok: false, error: "Spesa non trovata" };
  if (expense.status !== "draft") {
    return { ok: false, error: "Solo le bozze possono essere ricalcolate" };
  }

  const basis = await getDistributionBasis(expense.building_id, expense.table_id);
  if (!basis.ok) return basis;

  const shares = distribute(Number(expense.amount), basis.units);
  // Upsert each unit's recomputed quota.
  for (const unit of basis.units) {
    const amount = shares.get(unit.id) ?? 0;
    const { data: existing } = await supabase
      .from("charges")
      .select("id")
      .eq("expense_id", id.data)
      .eq("unit_id", unit.id)
      .maybeSingle();
    if (existing) {
      await supabase.from("charges").update({ amount }).eq("id", existing.id);
    } else {
      await supabase
        .from("charges")
        .insert({ expense_id: id.data, unit_id: unit.id, amount, status: "unpaid" });
    }
  }

  revalidatePath(`/expenses/${id.data}`);
  return { ok: true };
}

/** Confirm a draft expense → notifies all involved residents (best-effort). */
export async function confirmExpense(expenseId: string): Promise<ActionResult> {
  const id = idSchema.safeParse(expenseId);
  if (!id.success) return { ok: false, error: "ID non valido" };

  const supabase = createClient();
  const { data: expense, error } = await supabase
    .from("expenses")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", id.data)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!expense) {
    return { ok: false, error: "La spesa è già stata confermata o non esiste" };
  }

  // Fire-and-forget notifications: must never block the confirmation.
  try {
    const { notifyExpenseConfirmed } = await import("@/lib/resend/notifications");
    await notifyExpenseConfirmed(expense.id);
  } catch {
    // ignore — expense is confirmed regardless
  }

  revalidatePath("/expenses");
  revalidatePath(`/expenses/${id.data}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteExpense(expenseId: string): Promise<ActionResult> {
  const id = idSchema.safeParse(expenseId);
  if (!id.success) return { ok: false, error: "ID non valido" };

  const supabase = createClient();
  const { error } = await supabase.from("expenses").delete().eq("id", id.data);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  return { ok: true };
}
