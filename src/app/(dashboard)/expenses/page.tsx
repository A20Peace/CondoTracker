import Link from "next/link";
import { Plus, Receipt } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getAdminExpenses } from "@/lib/queries/expenses";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ExpenseStatusBadge } from "@/components/ui/badges";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const { supabase, user } = await requireUser();
  const items = await getAdminExpenses(supabase, user.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Spese</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Registra una spesa e distribuiscila automaticamente per millesimi.
          </p>
        </div>
        <Link
          href="/expenses/new"
          className="tap-target inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white transition hover:bg-brand-700"
        >
          <Plus size={18} /> Nuova spesa
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
          <Receipt className="mx-auto text-slate-300 dark:text-slate-600" size={40} />
          <p className="mt-3 font-medium text-slate-700 dark:text-slate-200">Nessuna spesa</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Registra la prima spesa di un condominio.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map(({ expense, buildingName, totals }) => {
            const pct = totals.total > 0 ? Math.round((totals.collected / totals.total) * 100) : 0;
            return (
              <li key={expense.id}>
                <Link
                  href={`/expenses/${expense.id}`}
                  className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-300 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
                          {expense.title}
                        </p>
                        <ExpenseStatusBadge status={expense.status} />
                      </div>
                      <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                        {buildingName} · scadenza {formatDate(expense.due_date)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-bold text-slate-900 dark:text-slate-100">
                        {formatCurrency(totals.total)}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {totals.paidCount}/{totals.count} pagate
                      </p>
                    </div>
                  </div>
                  {expense.status === "confirmed" && (
                    <div className="mt-3">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Incassato {formatCurrency(totals.collected)} di {formatCurrency(totals.total)}
                      </p>
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
