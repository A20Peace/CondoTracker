import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Charge } from "@/types";

type Client = SupabaseClient<Database>;

export interface ResidentChargeRow {
  charge: Charge;
  expenseTitle: string;
  expenseId: string;
  hasDocument: boolean;
  dueDate: string;
  buildingName: string;
  iban: string | null;
  holder: string | null;
  unitLabel: string;
}

export interface ResidentCharges {
  outstanding: ResidentChargeRow[]; // unpaid + declared
  paid: ResidentChargeRow[];
  totalOutstanding: number;
}

/**
 * The current resident's quote across all their units. Only quote of CONFIRMED
 * expenses are returned (RLS hides draft expenses), sorted by due date.
 */
export async function getResidentCharges(supabase: Client): Promise<ResidentCharges> {
  const empty: ResidentCharges = { outstanding: [], paid: [], totalOutstanding: 0 };

  const { data: charges } = await supabase
    .from("charges")
    .select("*");
  if (!charges?.length) return empty;

  const expenseIds = [...new Set(charges.map((c) => c.expense_id))];
  // RLS returns only confirmed expenses of the resident's buildings.
  const { data: expenses } = await supabase
    .from("expenses")
    .select("id, title, due_date, building_id, document_url")
    .in("id", expenseIds);
  const expenseById = new Map((expenses ?? []).map((e) => [e.id, e]));

  const buildingIds = [...new Set((expenses ?? []).map((e) => e.building_id))];
  const { data: buildings } = buildingIds.length
    ? await supabase.from("buildings").select("id, name, iban, bank_holder").in("id", buildingIds)
    : { data: [] };
  const buildingById = new Map((buildings ?? []).map((b) => [b.id, b]));

  const unitIds = [...new Set(charges.map((c) => c.unit_id))];
  const { data: units } = await supabase.from("units").select("id, label").in("id", unitIds);
  const unitById = new Map((units ?? []).map((u) => [u.id, u]));

  const rows: ResidentChargeRow[] = [];
  for (const c of charges) {
    const expense = expenseById.get(c.expense_id);
    if (!expense) continue; // draft / not visible
    const building = buildingById.get(expense.building_id);
    rows.push({
      charge: c as Charge,
      expenseTitle: expense.title,
      expenseId: expense.id,
      hasDocument: Boolean(expense.document_url),
      dueDate: expense.due_date,
      buildingName: building?.name ?? "Condominio",
      iban: building?.iban ?? null,
      holder: building?.bank_holder ?? null,
      unitLabel: unitById.get(c.unit_id)?.label ?? "Unità",
    });
  }

  rows.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const outstanding = rows.filter((r) => r.charge.status !== "paid");
  const paid = rows
    .filter((r) => r.charge.status === "paid")
    .sort((a, b) => (b.charge.paid_at ?? "").localeCompare(a.charge.paid_at ?? ""));

  return {
    outstanding,
    paid,
    totalOutstanding: outstanding.reduce((s, r) => s + Number(r.charge.amount), 0),
  };
}
