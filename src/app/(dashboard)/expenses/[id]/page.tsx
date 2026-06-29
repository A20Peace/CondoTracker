import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Building2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getExpenseDetail } from "@/lib/queries/expenses";
import { getSignedUrl } from "@/lib/supabase/storage";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ExpenseStatusBadge } from "@/components/ui/badges";
import { ExpenseDraftEditor } from "@/components/expenses/ExpenseDraftEditor";
import { ConfirmedChargesAdmin } from "@/components/expenses/ConfirmedChargesAdmin";

export const dynamic = "force-dynamic";

export default async function ExpenseDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { supabase } = await requireUser();
  const detail = await getExpenseDetail(supabase, params.id);
  if (!detail) notFound();

  const { expense, building, table, charges, totals } = detail;
  const docUrl = expense.document_url
    ? await getSignedUrl(supabase, expense.document_url)
    : null;

  return (
    <div className="space-y-6">
      <Link
        href="/expenses"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <ArrowLeft size={16} /> Tutte le spese
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {expense.title}
            </h2>
            <ExpenseStatusBadge status={expense.status} />
          </div>
          <p className="mt-1 inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <Building2 size={14} /> {building.name}
            </span>
            <span>Tabella: {table?.name ?? "—"}</span>
            {docUrl && (
              <a
                href={docUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                <FileText size={14} /> Documento
              </a>
            )}
          </p>
        </div>
      </div>

      {expense.status === "draft" ? (
        <ExpenseDraftEditor
          expense={{
            id: expense.id,
            title: expense.title,
            description: expense.description,
            amount: Number(expense.amount),
            expense_date: expense.expense_date,
            due_date: expense.due_date,
          }}
          charges={charges.map((c) => ({
            id: c.charge.id,
            label: c.unit?.label ?? "—",
            floor: c.unit?.floor ?? null,
            amount: Number(c.charge.amount),
          }))}
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryStat label="Importo totale" value={formatCurrency(totals.total)} />
            <SummaryStat
              label="Incassato"
              value={formatCurrency(totals.collected)}
              accent="emerald"
            />
            <SummaryStat
              label="Da incassare"
              value={formatCurrency(totals.outstanding + totals.declared)}
              accent="amber"
            />
          </div>
          <ConfirmedChargesAdmin
            expenseId={expense.id}
            dueDate={expense.due_date}
            charges={charges.map((c) => ({
              id: c.charge.id,
              label: c.unit?.label ?? "—",
              floor: c.unit?.floor ?? null,
              amount: Number(c.charge.amount),
              status: c.charge.status,
            }))}
          />
        </>
      )}
    </div>
  );
}

function SummaryStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "emerald" | "amber";
}) {
  const valueCls =
    accent === "emerald"
      ? "text-emerald-600 dark:text-emerald-400"
      : accent === "amber"
        ? "text-amber-600 dark:text-amber-400"
        : "text-slate-900 dark:text-slate-100";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`text-xl font-bold ${valueCls}`}>{value}</p>
    </div>
  );
}
