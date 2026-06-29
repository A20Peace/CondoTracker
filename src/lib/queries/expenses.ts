import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Charge, Expense, MillesimiTable, Unit } from "@/types";

type Client = SupabaseClient<Database>;

export interface ChargeTotals {
  total: number; // expense amount
  collected: number; // confirmed paid
  declared: number; // declared, awaiting confirmation
  outstanding: number; // unpaid
  count: number;
  paidCount: number;
}

function totalsFor(
  amount: number,
  charges: { amount: number; status: string }[],
): ChargeTotals {
  let collected = 0;
  let declared = 0;
  let outstanding = 0;
  let paidCount = 0;
  for (const c of charges) {
    const a = Number(c.amount);
    if (c.status === "paid") {
      collected += a;
      paidCount += 1;
    } else if (c.status === "declared") {
      declared += a;
    } else {
      outstanding += a;
    }
  }
  return {
    total: amount,
    collected,
    declared,
    outstanding,
    count: charges.length,
    paidCount,
  };
}

export interface ExpenseListItem {
  expense: Expense;
  buildingName: string;
  totals: ChargeTotals;
}

/** All expenses across the admin's condomini, newest first, with quota totals. */
export async function getAdminExpenses(
  supabase: Client,
  userId: string,
  buildingId?: string,
): Promise<ExpenseListItem[]> {
  let buildingsQuery = supabase
    .from("buildings")
    .select("id, name")
    .eq("admin_id", userId);
  if (buildingId) buildingsQuery = buildingsQuery.eq("id", buildingId);
  const { data: buildings } = await buildingsQuery;
  if (!buildings?.length) return [];

  const nameById = new Map(buildings.map((b) => [b.id, b.name]));
  const ids = buildings.map((b) => b.id);

  const { data: expenses } = await supabase
    .from("expenses")
    .select("*")
    .in("building_id", ids)
    .order("created_at", { ascending: false });
  if (!expenses?.length) return [];

  const expenseIds = expenses.map((e) => e.id);
  const { data: charges } = await supabase
    .from("charges")
    .select("expense_id, amount, status")
    .in("expense_id", expenseIds);

  return expenses.map((e) => {
    const own = (charges ?? []).filter((c) => c.expense_id === e.id);
    return {
      expense: e as Expense,
      buildingName: nameById.get(e.building_id) ?? "—",
      totals: totalsFor(Number(e.amount), own),
    };
  });
}

export interface ExpenseChargeRow {
  charge: Charge;
  unit: Unit | null;
}

export interface ExpenseDetail {
  expense: Expense;
  building: { id: string; name: string; iban: string | null; bank_holder: string | null };
  table: MillesimiTable | null;
  charges: ExpenseChargeRow[];
  totals: ChargeTotals;
}

/** Full detail of one expense: header, building, table and per-unit quote. */
export async function getExpenseDetail(
  supabase: Client,
  expenseId: string,
): Promise<ExpenseDetail | null> {
  const { data: expense } = await supabase
    .from("expenses")
    .select("*")
    .eq("id", expenseId)
    .maybeSingle();
  if (!expense) return null;

  const [{ data: building }, { data: table }, { data: charges }] = await Promise.all([
    supabase
      .from("buildings")
      .select("id, name, iban, bank_holder")
      .eq("id", expense.building_id)
      .maybeSingle(),
    supabase
      .from("millesimi_tables")
      .select("*")
      .eq("id", expense.table_id)
      .maybeSingle(),
    supabase
      .from("charges")
      .select("*")
      .eq("expense_id", expenseId),
  ]);

  const unitIds = (charges ?? []).map((c) => c.unit_id);
  const { data: units } = unitIds.length
    ? await supabase.from("units").select("*").in("id", unitIds)
    : { data: [] as Unit[] };
  const unitById = new Map((units ?? []).map((u) => [u.id, u as Unit]));

  const rows: ExpenseChargeRow[] = (charges ?? [])
    .map((c) => ({ charge: c as Charge, unit: unitById.get(c.unit_id) ?? null }))
    .sort((a, b) => (a.unit?.label ?? "").localeCompare(b.unit?.label ?? ""));

  return {
    expense: expense as Expense,
    building: building ?? { id: expense.building_id, name: "—", iban: null, bank_holder: null },
    table: (table as MillesimiTable) ?? null,
    charges: rows,
    totals: totalsFor(Number(expense.amount), (charges ?? []) as Charge[]),
  };
}
