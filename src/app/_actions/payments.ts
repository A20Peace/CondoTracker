"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

const idSchema = z.string().uuid();

// ─── Admin: confirm / revert a payment ───────────────────────────────────────

/** Admin confirms the bank transfer arrived → quota becomes definitively paid. */
export async function adminConfirmCharge(chargeId: string): Promise<ActionResult> {
  const id = idSchema.safeParse(chargeId);
  if (!id.success) return { ok: false, error: "ID non valido" };

  const supabase = createClient();
  const { data, error } = await supabase
    .from("charges")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", id.data)
    .select("expense_id")
    .single();
  if (error) return { ok: false, error: error.message };
  if (data) revalidatePath(`/expenses/${data.expense_id}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Admin reverts a quota back to unpaid (e.g. confirmed by mistake). */
export async function adminRevertCharge(chargeId: string): Promise<ActionResult> {
  const id = idSchema.safeParse(chargeId);
  if (!id.success) return { ok: false, error: "ID non valido" };

  const supabase = createClient();
  const { data, error } = await supabase
    .from("charges")
    .update({ status: "unpaid", paid_at: null, declared_at: null })
    .eq("id", id.data)
    .select("expense_id")
    .single();
  if (error) return { ok: false, error: error.message };
  if (data) revalidatePath(`/expenses/${data.expense_id}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

// ─── Resident: declare / undo a payment ──────────────────────────────────────

/** Verifies the current user is an active resident of the charge's unit. */
async function assertOwnCharge(
  chargeId: string,
): Promise<{ ok: true; admin: ReturnType<typeof createAdminClient>; status: string } | { ok: false; error: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessione non valida" };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: "Configurazione server mancante" };
  }

  const { data: charge } = await admin
    .from("charges")
    .select("id, unit_id, status")
    .eq("id", chargeId)
    .maybeSingle();
  if (!charge) return { ok: false, error: "Quota non trovata" };

  const { data: resident } = await admin
    .from("residents")
    .select("id")
    .eq("unit_id", charge.unit_id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!resident) return { ok: false, error: "Non sei associato a questa unità" };

  return { ok: true, admin, status: charge.status };
}

/** Resident marks a quota as paid (awaiting admin confirmation). */
export async function residentDeclarePaid(chargeId: string): Promise<ActionResult> {
  const id = idSchema.safeParse(chargeId);
  if (!id.success) return { ok: false, error: "ID non valido" };

  const check = await assertOwnCharge(id.data);
  if (!check.ok) return check;
  if (check.status === "paid") {
    return { ok: false, error: "La quota è già stata confermata come pagata." };
  }

  const { error } = await check.admin
    .from("charges")
    .update({ status: "declared", declared_at: new Date().toISOString() })
    .eq("id", id.data);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/me");
  return { ok: true };
}

/** Resident undoes a "paid" declaration (only while still awaiting confirmation). */
export async function residentUndeclare(chargeId: string): Promise<ActionResult> {
  const id = idSchema.safeParse(chargeId);
  if (!id.success) return { ok: false, error: "ID non valido" };

  const check = await assertOwnCharge(id.data);
  if (!check.ok) return check;
  if (check.status !== "declared") {
    return { ok: false, error: "Operazione non disponibile per questa quota." };
  }

  const { error } = await check.admin
    .from("charges")
    .update({ status: "unpaid", declared_at: null })
    .eq("id", id.data);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/me");
  return { ok: true };
}
