"use server";

import { z } from "zod";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getSignedUrl } from "@/lib/supabase/storage";

const idSchema = z.string().uuid();

/**
 * Returns a short-lived signed URL to an expense's document, but only to the
 * admin or an active resident of that condominio. Residents have no direct
 * storage access, so the URL is signed server-side after the access check.
 */
export async function getExpenseDocumentUrl(
  expenseId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!idSchema.safeParse(expenseId).success) {
    return { ok: false, error: "ID non valido" };
  }

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

  const { data: expense } = await admin
    .from("expenses")
    .select("document_url, building_id")
    .eq("id", expenseId)
    .maybeSingle();
  if (!expense?.document_url) return { ok: false, error: "Documento non disponibile" };

  // Authorize: admin of the building OR active resident of one of its units.
  const { data: building } = await admin
    .from("buildings")
    .select("admin_id")
    .eq("id", expense.building_id)
    .maybeSingle();
  let allowed = building?.admin_id === user.id;
  if (!allowed) {
    const { data: units } = await admin
      .from("units")
      .select("id")
      .eq("building_id", expense.building_id);
    const unitIds = (units ?? []).map((u) => u.id);
    if (unitIds.length) {
      const { count } = await admin
        .from("residents")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "active")
        .in("unit_id", unitIds);
      allowed = (count ?? 0) > 0;
    }
  }
  if (!allowed) return { ok: false, error: "Accesso non consentito" };

  const url = await getSignedUrl(admin, expense.document_url);
  if (!url) return { ok: false, error: "Documento non disponibile" };
  return { ok: true, url };
}
