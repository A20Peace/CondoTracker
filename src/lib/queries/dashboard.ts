import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ChargeStatus } from "@/types";

type Client = SupabaseClient<Database>;

export interface DashboardChargeRow {
  chargeId: string;
  status: ChargeStatus;
  amount: number;
  dueDate: string;
  buildingId: string;
  buildingName: string;
  unitLabel: string;
  expenseId: string;
  expenseTitle: string;
}

export interface DashboardData {
  rows: DashboardChargeRow[];
  buildings: { id: string; name: string }[];
  expenses: { id: string; title: string; buildingId: string }[];
}

/**
 * All quote (charges) of CONFIRMED expenses across the admin's condomini, with
 * the building/unit/expense context. Filtering and totals are done client-side.
 */
export async function getAdminDashboard(
  supabase: Client,
  userId: string,
): Promise<DashboardData> {
  const empty: DashboardData = { rows: [], buildings: [], expenses: [] };

  const { data: buildings } = await supabase
    .from("buildings")
    .select("id, name")
    .eq("admin_id", userId)
    .order("name", { ascending: true });
  if (!buildings?.length) return empty;

  const buildingName = new Map(buildings.map((b) => [b.id, b.name]));
  const ids = buildings.map((b) => b.id);

  const { data: expenses } = await supabase
    .from("expenses")
    .select("id, title, building_id, due_date")
    .in("building_id", ids)
    .eq("status", "confirmed")
    .order("created_at", { ascending: false });
  if (!expenses?.length) {
    return { rows: [], buildings, expenses: [] };
  }

  const expenseById = new Map(expenses.map((e) => [e.id, e]));
  const expenseIds = expenses.map((e) => e.id);

  const { data: charges } = await supabase
    .from("charges")
    .select("id, expense_id, unit_id, amount, status")
    .in("expense_id", expenseIds);

  const unitIds = [...new Set((charges ?? []).map((c) => c.unit_id))];
  const { data: units } = unitIds.length
    ? await supabase.from("units").select("id, label").in("id", unitIds)
    : { data: [] };
  const unitLabel = new Map((units ?? []).map((u) => [u.id, u.label]));

  const rows: DashboardChargeRow[] = (charges ?? [])
    .map((c) => {
      const expense = expenseById.get(c.expense_id);
      if (!expense) return null;
      return {
        chargeId: c.id,
        status: c.status as ChargeStatus,
        amount: Number(c.amount),
        dueDate: expense.due_date,
        buildingId: expense.building_id,
        buildingName: buildingName.get(expense.building_id) ?? "—",
        unitLabel: unitLabel.get(c.unit_id) ?? "—",
        expenseId: expense.id,
        expenseTitle: expense.title,
      };
    })
    .filter((r): r is DashboardChargeRow => r !== null);

  return {
    rows,
    buildings,
    expenses: expenses.map((e) => ({
      id: e.id,
      title: e.title,
      buildingId: e.building_id,
    })),
  };
}
