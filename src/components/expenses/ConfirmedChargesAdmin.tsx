"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, RotateCcw, Trash2, Loader2 } from "lucide-react";
import { adminConfirmCharge, adminRevertCharge } from "@/app/_actions/payments";
import { deleteExpense } from "@/app/_actions/expenses";
import { ChargeStatusBadge } from "@/components/ui/badges";
import { formatCurrency } from "@/lib/utils";
import type { ChargeStatus } from "@/types";

export interface AdminChargeRow {
  id: string;
  label: string;
  floor: string | null;
  amount: number;
  status: ChargeStatus;
}

export function ConfirmedChargesAdmin({
  expenseId,
  dueDate,
  charges,
}: {
  expenseId: string;
  dueDate: string;
  charges: AdminChargeRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(key);
    const res = await fn();
    setBusy(null);
    if (!res.ok) alert(res.error);
    else router.refresh();
  }

  async function remove() {
    if (
      !window.confirm(
        "Eliminare questa spesa? Verranno rimosse tutte le quote, anche quelle pagate.",
      )
    )
      return;
    setBusy("delete");
    const res = await deleteExpense(expenseId);
    if (!res.ok) {
      setBusy(null);
      alert(res.error);
      return;
    }
    router.push("/expenses");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800">
              <th className="px-4 py-2.5 font-medium">Unità</th>
              <th className="px-4 py-2.5 text-right font-medium">Quota</th>
              <th className="px-4 py-2.5 text-center font-medium">Stato</th>
              <th className="px-4 py-2.5 text-right font-medium">Incasso</th>
            </tr>
          </thead>
          <tbody>
            {charges.map((c) => (
              <tr key={c.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800/60">
                <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200">
                  {c.label}
                  {c.floor && <span className="ml-2 text-xs text-slate-400">· {c.floor}</span>}
                </td>
                <td className="px-4 py-2.5 text-right text-slate-700 dark:text-slate-200">
                  {formatCurrency(c.amount)}
                </td>
                <td className="px-4 py-2.5 text-center">
                  <ChargeStatusBadge status={c.status} dueDate={dueDate} />
                </td>
                <td className="px-4 py-2.5 text-right">
                  {c.status === "paid" ? (
                    <button
                      type="button"
                      onClick={() => run(c.id, () => adminRevertCharge(c.id))}
                      disabled={busy === c.id}
                      className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      {busy === c.id ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                      Annulla
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => run(c.id, () => adminConfirmCharge(c.id))}
                      disabled={busy === c.id}
                      className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {busy === c.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                      Conferma incasso
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={remove}
        disabled={busy === "delete"}
        className="tap-target inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40"
      >
        <Trash2 size={15} /> Elimina spesa
      </button>
    </div>
  );
}
