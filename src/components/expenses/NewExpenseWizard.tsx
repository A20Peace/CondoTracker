"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  UploadCloud,
  Loader2,
  FileText,
  Calculator,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { getDistributionBasis, createExpense, type DistributionUnit } from "@/app/_actions/expenses";
import { distribute } from "@/lib/millesimi";
import { cn, formatCurrency, formatMillesimi } from "@/lib/utils";
import type { ApiError, ParseResponse } from "@/types";

export interface WizardBuilding {
  id: string;
  name: string;
  tables: { id: string; name: string; is_default: boolean }[];
}

const inputCls =
  "tap-target mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-900 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200";
const labelCls = "block text-sm font-medium text-slate-700 dark:text-slate-300";
const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

function parseNum(v: string): number {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function NewExpenseWizard({
  buildings,
  parsingEnabled,
}: {
  buildings: WizardBuilding[];
  parsingEnabled: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [buildingId, setBuildingId] = useState(buildings[0]?.id ?? "");
  const building = buildings.find((b) => b.id === buildingId);
  const defaultTable = building?.tables.find((t) => t.is_default) ?? building?.tables[0];
  const [tableId, setTableId] = useState(defaultTable?.id ?? "");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState("");
  const [dueDate, setDueDate] = useState("");

  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [docPath, setDocPath] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<unknown>(null);

  const [parsing, setParsing] = useState(false);
  const [basis, setBasis] = useState<DistributionUnit[]>([]);
  const [basisLoading, setBasisLoading] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // When the building changes, reset its default table.
  useEffect(() => {
    const dt = building?.tables.find((t) => t.is_default) ?? building?.tables[0];
    setTableId(dt?.id ?? "");
  }, [buildingId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load the distribution basis (units + millesimi) for the chosen table.
  useEffect(() => {
    if (!buildingId || !tableId) {
      setBasis([]);
      return;
    }
    let cancelled = false;
    setBasisLoading(true);
    getDistributionBasis(buildingId, tableId).then((res) => {
      if (cancelled) return;
      setBasis(res.ok ? res.units : []);
      setOverrides({});
      setBasisLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [buildingId, tableId]);

  const amountNum = parseNum(amount);
  const totalMillesimi = basis.reduce((s, u) => s + u.millesimi, 0);

  // Computed quote (recomputed whenever amount/basis change), unless overridden.
  const computed = useMemo(() => distribute(amountNum, basis), [amountNum, basis]);

  const quotaFor = (unitId: string): number =>
    unitId in overrides ? parseNum(overrides[unitId]!) : (computed.get(unitId) ?? 0);

  const quotaTotal = basis.reduce((s, u) => s + quotaFor(u.id), 0);
  const sumMatches = Math.abs(quotaTotal - amountNum) < 0.005;

  async function handleFile(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      setError("Il file supera i 10MB.");
      return;
    }
    setError(null);
    setParsing(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/expenses/parse", { method: "POST", body });
      const json = (await res.json()) as ParseResponse | ApiError;
      if (!res.ok || "error" in json) {
        setError("error" in json ? json.error : "Analisi non riuscita.");
        return;
      }
      const p = json.parsed;
      if (p.title) setTitle(p.title);
      if (p.amount != null) setAmount(String(p.amount));
      if (p.due_date) setDueDate(p.due_date);
      setDocUrl(json.documentUrl || null);
      setDocPath(json.documentPath || null);
      setExtracted(p);
    } catch {
      setError("Errore di rete durante l'analisi.");
    } finally {
      setParsing(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return setError("Inserisci una descrizione della spesa.");
    if (!(amountNum > 0)) return setError("Inserisci un importo valido.");
    if (!dueDate) return setError("Inserisci la scadenza.");
    if (basis.length === 0) return setError("Il condominio non ha unità configurate.");

    setSaving(true);
    const res = await createExpense({
      building_id: buildingId,
      table_id: tableId,
      title: title.trim(),
      description: description || null,
      amount: amountNum,
      expense_date: expenseDate || null,
      due_date: dueDate,
      // Persist the storage path (signed URLs expire); signed on demand at view.
      document_url: docPath,
      extracted_raw: extracted ?? undefined,
      charges: basis.map((u) => ({ unit_id: u.id, amount: quotaFor(u.id) })),
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (res.id) router.push(`/expenses/${res.id}`);
  }

  if (buildings.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
        Crea prima un condominio con almeno un&apos;unità per registrare una spesa.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Building + document */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {buildings.length > 1 && (
          <div className="mb-4">
            <label htmlFor="building" className={labelCls}>
              Condominio
            </label>
            <select
              id="building"
              className={inputCls}
              value={buildingId}
              onChange={(e) => setBuildingId(e.target.value)}
            >
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {parsingEnabled && (
          <div>
            <p className={labelCls}>Documento giustificativo (facoltativo)</p>
            {parsing ? (
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-3 text-sm text-brand-700 dark:border-slate-700">
                <Loader2 size={16} className="animate-spin" /> Analisi del documento in corso…
              </div>
            ) : docPath ? (
              <div className="mt-2 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm dark:border-emerald-900/50 dark:bg-emerald-950/30">
                <span className="inline-flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                  <FileText size={16} /> Documento allegato
                </span>
                {docUrl && (
                  <a href={docUrl} target="_blank" rel="noreferrer" className="font-medium text-brand-600 hover:underline">
                    Apri
                  </a>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-4 py-4 text-sm font-medium text-slate-600 transition hover:border-brand-400 hover:bg-brand-50/40 dark:border-slate-700 dark:text-slate-300"
              >
                <UploadCloud size={18} className="text-brand-500" />
                Carica fattura/ricevuta (PDF o foto) e compila in automatico
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void handleFile(f);
              }}
            />
          </div>
        )}
      </div>

      {/* Expense fields */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="space-y-4">
          <div>
            <label htmlFor="title" className={labelCls}>
              Descrizione spesa
            </label>
            <input
              id="title"
              className={inputCls}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Manutenzione ascensore - giugno 2025"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="amount" className={labelCls}>
                Importo totale (€)
              </label>
              <input
                id="amount"
                className={inputCls}
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1200,00"
                required
              />
            </div>
            <div>
              <label htmlFor="due" className={labelCls}>
                Scadenza
              </label>
              <input
                id="due"
                type="date"
                className={inputCls}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="edate" className={labelCls}>
                Data spesa <span className="text-slate-400">(facolt.)</span>
              </label>
              <input
                id="edate"
                type="date"
                className={inputCls}
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label htmlFor="desc" className={labelCls}>
              Note <span className="text-slate-400">(facoltativo)</span>
            </label>
            <textarea
              id="desc"
              className={inputCls}
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {building && building.tables.length > 1 && (
            <div>
              <label className={labelCls}>Tabella millesimale</label>
              <div className="mt-1 flex flex-wrap gap-2">
                {building.tables.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTableId(t.id)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-sm font-medium transition",
                      t.id === tableId
                        ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                        : "border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800",
                    )}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quote distribution */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="inline-flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">
            <Calculator size={18} className="text-brand-600 dark:text-brand-400" /> Quote per unità
          </h3>
          {Object.keys(overrides).length > 0 && (
            <button
              type="button"
              onClick={() => setOverrides({})}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400"
            >
              <RotateCcw size={14} /> Ricalcola dai millesimi
            </button>
          )}
        </div>

        {basisLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
            <Loader2 size={16} className="animate-spin" /> Caricamento unità…
          </div>
        ) : basis.length === 0 ? (
          <p className="py-4 text-sm text-slate-500 dark:text-slate-400">
            Questo condominio non ha unità configurate.
          </p>
        ) : (
          <>
            <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800">
                    <th className="px-4 py-2.5 font-medium">Unità</th>
                    <th className="px-4 py-2.5 text-right font-medium">Millesimi</th>
                    <th className="px-4 py-2.5 text-right font-medium">Quota (€)</th>
                  </tr>
                </thead>
                <tbody>
                  {basis.map((u) => (
                    <tr key={u.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800/60">
                      <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-200">
                        {u.label}
                        {u.floor && <span className="ml-2 text-xs text-slate-400">· {u.floor}</span>}
                      </td>
                      <td className="px-4 py-2 text-right text-slate-500 dark:text-slate-400">
                        {formatMillesimi(u.millesimi)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input
                          inputMode="decimal"
                          className="w-28 rounded-lg border border-slate-300 px-2.5 py-1.5 text-right text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-900"
                          value={
                            u.id in overrides
                              ? overrides[u.id]!
                              : (computed.get(u.id) ?? 0).toFixed(2)
                          }
                          onChange={(e) =>
                            setOverrides((p) => ({ ...p, [u.id]: e.target.value }))
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 dark:border-slate-800">
                    <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-slate-200">Totale</td>
                    <td className="px-4 py-2.5 text-right text-slate-500 dark:text-slate-400">
                      {formatMillesimi(totalMillesimi)}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-2.5 text-right font-bold",
                        sumMatches ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400",
                      )}
                    >
                      {formatCurrency(quotaTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {!sumMatches && amountNum > 0 && (
              <p className="mt-2 flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                <AlertTriangle size={15} />
                La somma delle quote ({formatCurrency(quotaTotal)}) non coincide con
                l&apos;importo totale ({formatCurrency(amountNum)}).
              </p>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="tap-target inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {saving && <Loader2 size={16} className="animate-spin" />}
          Crea bozza e rivedi
        </button>
        <button
          type="button"
          onClick={() => router.push("/expenses")}
          className="tap-target rounded-lg px-4 py-2.5 font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Annulla
        </button>
      </div>
    </form>
  );
}
