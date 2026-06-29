"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Pencil,
  Trash2,
  Send,
  RotateCcw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import {
  updateExpense,
  setChargeAmount,
  recalcCharges,
  confirmExpense,
  deleteExpense,
} from "@/app/_actions/expenses";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

export interface DraftChargeRow {
  id: string;
  label: string;
  floor: string | null;
  amount: number;
}

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200";

function parseNum(v: string): number {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function ExpenseDraftEditor({
  expense,
  charges,
}: {
  expense: {
    id: string;
    title: string;
    description: string | null;
    amount: number;
    expense_date: string | null;
    due_date: string;
  };
  charges: DraftChargeRow[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  // header edit fields
  const [title, setTitle] = useState(expense.title);
  const [description, setDescription] = useState(expense.description ?? "");
  const [amount, setAmount] = useState(String(expense.amount));
  const [dueDate, setDueDate] = useState(expense.due_date);
  const [expenseDate, setExpenseDate] = useState(expense.expense_date ?? "");

  // editable quote
  const [edits, setEdits] = useState<Record<string, string>>({});
  const quotaValue = (c: DraftChargeRow) => (c.id in edits ? edits[c.id]! : c.amount.toFixed(2));
  const quotaTotal = charges.reduce((s, c) => s + parseNum(quotaValue(c)), 0);
  const sumMatches = Math.abs(quotaTotal - expense.amount) < 0.005;

  async function saveHeader() {
    setBusy("header");
    const res = await updateExpense(expense.id, {
      title,
      description: description || null,
      amount,
      due_date: dueDate,
      expense_date: expenseDate || null,
    });
    setBusy(null);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  async function saveQuota(c: DraftChargeRow) {
    if (!(c.id in edits)) return;
    setBusy(c.id);
    await setChargeAmount(c.id, parseNum(edits[c.id]!), expense.id);
    setBusy(null);
  }

  async function recalc() {
    setBusy("recalc");
    const res = await recalcCharges(expense.id);
    setBusy(null);
    if (!res.ok) alert(res.error);
    else {
      setEdits({});
      router.refresh();
    }
  }

  async function confirm() {
    if (!confirm0()) return;
    setBusy("confirm");
    const res = await confirmExpense(expense.id);
    setBusy(null);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    router.refresh();
  }
  function confirm0() {
    return window.confirm(
      "Confermare la spesa e inviare le notifiche ai condòmini? Dopo la conferma le quote non saranno più modificabili da qui.",
    );
  }

  async function remove() {
    if (!window.confirm("Eliminare questa bozza di spesa?")) return;
    setBusy("delete");
    const res = await deleteExpense(expense.id);
    if (!res.ok) {
      setBusy(null);
      alert(res.error);
      return;
    }
    router.push("/expenses");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {/* Header card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {editing ? (
          <div className="space-y-3">
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Descrizione" />
            <div className="grid gap-3 sm:grid-cols-3">
              <input className={inputCls} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Importo" />
              <input className={inputCls} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              <input className={inputCls} type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
            </div>
            <textarea className={inputCls} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Note" />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={saveHeader}
                disabled={busy === "header"}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {busy === "header" && <Loader2 size={14} className="animate-spin" />} Salva
              </button>
              <button type="button" onClick={() => setEditing(false)} className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                Annulla
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Importo totale</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {formatCurrency(expense.amount)}
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Scadenza {formatDate(expense.due_date)}
              </p>
              {expense.description && (
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{expense.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Pencil size={15} /> Modifica
            </button>
          </div>
        )}
      </div>

      {/* Quote editor */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Quote per unità
          </h3>
          <button
            type="button"
            onClick={recalc}
            disabled={busy === "recalc"}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400"
          >
            {busy === "recalc" ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
            Ricalcola dai millesimi
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <tbody>
              {charges.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800/60">
                  <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-200">
                    {c.label}
                    {c.floor && <span className="ml-2 text-xs text-slate-400">· {c.floor}</span>}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {busy === c.id && <Loader2 size={13} className="animate-spin text-slate-400" />}
                      <input
                        inputMode="decimal"
                        className="w-28 rounded-lg border border-slate-300 px-2.5 py-1.5 text-right text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-900"
                        value={quotaValue(c)}
                        onChange={(e) => setEdits((p) => ({ ...p, [c.id]: e.target.value }))}
                        onBlur={() => saveQuota(c)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 dark:border-slate-800">
                <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-slate-200">Totale quote</td>
                <td className={cn("px-4 py-2.5 text-right font-bold", sumMatches ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
                  {formatCurrency(quotaTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        {!sumMatches && (
          <p className="mt-2 flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
            <AlertTriangle size={15} /> Le quote ({formatCurrency(quotaTotal)}) non
            coincidono con l&apos;importo totale ({formatCurrency(expense.amount)}).
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={confirm}
          disabled={busy === "confirm"}
          className="tap-target inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          {busy === "confirm" ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          Conferma e invia notifiche
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={busy === "delete"}
          className="tap-target inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2.5 font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40"
        >
          <Trash2 size={16} /> Elimina bozza
        </button>
        <span className="inline-flex items-center gap-1.5 text-sm text-slate-400 dark:text-slate-500">
          <CheckCircle2 size={14} /> Le notifiche partono solo alla conferma
        </span>
      </div>
    </div>
  );
}
