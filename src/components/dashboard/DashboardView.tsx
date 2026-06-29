"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, RotateCcw, Loader2, Filter } from "lucide-react";
import { adminConfirmCharge, adminRevertCharge } from "@/app/_actions/payments";
import { ChargeStatusBadge } from "@/components/ui/badges";
import { cn, formatCurrency } from "@/lib/utils";
import type { DashboardData } from "@/lib/queries/dashboard";
import type { ChargeStatus } from "@/types";

const selectCls =
  "tap-target rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200";

type StatusFilter = "" | ChargeStatus;

export function DashboardView({ data }: { data: DashboardData }) {
  const router = useRouter();
  const [buildingId, setBuildingId] = useState("");
  const [expenseId, setExpenseId] = useState("");
  const [status, setStatus] = useState<StatusFilter>("");
  const [busy, setBusy] = useState<string | null>(null);

  const expenseOptions = useMemo(
    () => data.expenses.filter((e) => !buildingId || e.buildingId === buildingId),
    [data.expenses, buildingId],
  );

  const rows = useMemo(
    () =>
      data.rows.filter(
        (r) =>
          (!buildingId || r.buildingId === buildingId) &&
          (!expenseId || r.expenseId === expenseId) &&
          (!status || r.status === status),
      ),
    [data.rows, buildingId, expenseId, status],
  );

  const stats = useMemo(() => {
    let total = 0;
    let collected = 0;
    let declared = 0;
    let outstanding = 0;
    for (const r of rows) {
      total += r.amount;
      if (r.status === "paid") collected += r.amount;
      else if (r.status === "declared") declared += r.amount;
      else outstanding += r.amount;
    }
    return { total, collected, declared, outstanding };
  }, [rows]);

  async function run(key: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(key);
    const res = await fn();
    setBusy(null);
    if (!res.ok) alert(res.error);
    else router.refresh();
  }

  if (data.buildings.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
        Crea un condominio e registra una spesa per vedere il riepilogo dei pagamenti.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm text-slate-400">
          <Filter size={15} /> Filtra
        </span>
        <select
          className={selectCls}
          value={buildingId}
          onChange={(e) => {
            setBuildingId(e.target.value);
            setExpenseId("");
          }}
        >
          <option value="">Tutti i condomini</option>
          {data.buildings.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select className={selectCls} value={expenseId} onChange={(e) => setExpenseId(e.target.value)}>
          <option value="">Tutte le spese</option>
          {expenseOptions.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </select>
        <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
          <option value="">Tutti gli stati</option>
          <option value="unpaid">Da pagare</option>
          <option value="declared">In attesa di conferma</option>
          <option value="paid">Pagato</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Totale spese" value={formatCurrency(stats.total)} />
        <Stat label="Incassato" value={formatCurrency(stats.collected)} accent="emerald" />
        <Stat label="In attesa" value={formatCurrency(stats.declared)} accent="indigo" />
        <Stat label="Da incassare" value={formatCurrency(stats.outstanding)} accent="amber" />
      </div>

      {/* Charges table */}
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          Nessuna quota corrisponde ai filtri selezionati.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800">
                <th className="px-4 py-2.5 font-medium">Condominio</th>
                <th className="px-4 py-2.5 font-medium">Unità</th>
                <th className="px-4 py-2.5 font-medium">Spesa</th>
                <th className="px-4 py-2.5 text-right font-medium">Quota</th>
                <th className="px-4 py-2.5 text-center font-medium">Stato</th>
                <th className="px-4 py-2.5 text-right font-medium">Incasso</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.chargeId} className="border-b border-slate-100 last:border-0 dark:border-slate-800/60">
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{r.buildingName}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200">{r.unitLabel}</td>
                  <td className="px-4 py-2.5">
                    <Link href={`/expenses/${r.expenseId}`} className="text-brand-600 hover:underline dark:text-brand-400">
                      {r.expenseTitle}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-700 dark:text-slate-200">
                    {formatCurrency(r.amount)}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <ChargeStatusBadge status={r.status} dueDate={r.dueDate} />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {r.status === "paid" ? (
                      <button
                        type="button"
                        onClick={() => run(r.chargeId, () => adminRevertCharge(r.chargeId))}
                        disabled={busy === r.chargeId}
                        className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        {busy === r.chargeId ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                        Annulla
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => run(r.chargeId, () => adminConfirmCharge(r.chargeId))}
                        disabled={busy === r.chargeId}
                        className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {busy === r.chargeId ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                        Conferma
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "emerald" | "amber" | "indigo";
}) {
  const cls =
    accent === "emerald"
      ? "text-emerald-600 dark:text-emerald-400"
      : accent === "amber"
        ? "text-amber-600 dark:text-amber-400"
        : accent === "indigo"
          ? "text-indigo-600 dark:text-indigo-400"
          : "text-slate-900 dark:text-slate-100";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={cn("text-xl font-bold", cls)}>{value}</p>
    </div>
  );
}
