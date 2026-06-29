"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  Table2,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import {
  createUnit,
  updateUnit,
  deleteUnit,
  setUnitShare,
  createMillesimiTable,
  deleteMillesimiTable,
} from "@/app/_actions/buildings";
import { cn, formatMillesimi } from "@/lib/utils";
import type { MillesimiTable, Unit, UnitShare } from "@/types";

const inputCls =
  "w-full rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-900 px-2.5 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200";

function parseNum(v: string): number {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function UnitsManager({
  buildingId,
  tables,
  units,
  shares,
}: {
  buildingId: string;
  tables: MillesimiTable[];
  units: Unit[];
  shares: UnitShare[];
}) {
  const router = useRouter();
  const defaultTable = tables.find((t) => t.is_default) ?? tables[0];
  const [tableId, setTableId] = useState<string>(defaultTable?.id ?? "");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Base millesimi value from the server for (tableId, unitId).
  const baseValue = useMemo(() => {
    const map = new Map<string, number>();
    shares.forEach((s) => map.set(`${s.table_id}:${s.unit_id}`, Number(s.millesimi)));
    return map;
  }, [shares]);

  const displayValue = (unitId: string): string => {
    const key = `${tableId}:${unitId}`;
    if (key in edits) return edits[key]!;
    const base = baseValue.get(key);
    return base === undefined || base === 0 ? "" : String(base);
  };

  const total = units.reduce((sum, u) => sum + parseNum(displayValue(u.id)), 0);
  const tableOk = Math.abs(total - 1000) < 0.001;

  async function saveShare(unitId: string) {
    const key = `${tableId}:${unitId}`;
    if (!(key in edits)) return;
    const value = parseNum(edits[key]!);
    setSavingKey(key);
    await setUnitShare({ table_id: tableId, unit_id: unitId, millesimi: value }, buildingId);
    setSavingKey(null);
  }

  async function addTable() {
    const name = prompt("Nome della nuova tabella millesimale (es. Scale, Riscaldamento)");
    if (!name?.trim()) return;
    const res = await createMillesimiTable(buildingId, name.trim());
    if (!res.ok) alert(res.error);
    else router.refresh();
  }

  async function removeTable(t: MillesimiTable) {
    if (!confirm(`Eliminare la tabella "${t.name}"?`)) return;
    const res = await deleteMillesimiTable(t.id, buildingId);
    if (!res.ok) alert(res.error);
    else {
      if (tableId === t.id && defaultTable) setTableId(defaultTable.id);
      router.refresh();
    }
  }

  return (
    <section className="space-y-4">
      <div className="relative flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Unità e millesimi
        </h3>
        <AddUnit buildingId={buildingId} onDone={() => router.refresh()} />
      </div>

      {/* Millesimi table selector */}
      <div className="flex flex-wrap items-center gap-2">
        <Table2 size={16} className="text-slate-400" />
        {tables.map((t) => (
          <span key={t.id} className="inline-flex items-center">
            <button
              type="button"
              onClick={() => setTableId(t.id)}
              className={cn(
                "rounded-l-lg border px-3 py-1.5 text-sm font-medium transition",
                t.id === tableId
                  ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                  : "border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800",
                t.is_default && "rounded-r-lg",
              )}
            >
              {t.name}
              {t.is_default && (
                <span className="ml-1 text-xs text-slate-400">(default)</span>
              )}
            </button>
            {!t.is_default && (
              <button
                type="button"
                onClick={() => removeTable(t)}
                aria-label={`Elimina tabella ${t.name}`}
                className={cn(
                  "rounded-r-lg border border-l-0 px-2 py-1.5 transition",
                  t.id === tableId
                    ? "border-brand-500 text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/30"
                    : "border-slate-300 text-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800",
                )}
              >
                <X size={14} />
              </button>
            )}
          </span>
        ))}
        <button
          type="button"
          onClick={addTable}
          className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <Plus size={14} /> Tabella
        </button>
      </div>

      {/* Units table */}
      {units.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          Nessuna unità. Aggiungi la prima unità del condominio.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800">
                <th className="px-4 py-2.5 font-medium">Unità</th>
                <th className="px-4 py-2.5 text-right font-medium">Millesimi</th>
                <th className="px-4 py-2.5 text-right font-medium">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {units.map((u) => (
                <UnitRow
                  key={u.id}
                  unit={u}
                  value={displayValue(u.id)}
                  saving={savingKey === `${tableId}:${u.id}`}
                  onChange={(v) =>
                    setEdits((prev) => ({ ...prev, [`${tableId}:${u.id}`]: v }))
                  }
                  onCommit={() => saveShare(u.id)}
                  onSaved={() => router.refresh()}
                />
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 dark:border-slate-800">
                <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-slate-200">
                  Totale
                </td>
                <td
                  className={cn(
                    "px-4 py-2.5 text-right font-bold",
                    tableOk
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-600 dark:text-amber-400",
                  )}
                >
                  {formatMillesimi(total)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {units.length > 0 && !tableOk && (
        <p className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
          <AlertTriangle size={15} />
          Il totale dei millesimi è {formatMillesimi(total)} invece di 1000. Puoi
          comunque procedere (alcuni condomini usano tabelle diverse per spese diverse).
        </p>
      )}
    </section>
  );
}

function UnitRow({
  unit,
  value,
  saving,
  onChange,
  onCommit,
  onSaved,
}: {
  unit: Unit;
  value: string;
  saving: boolean;
  onChange: (v: string) => void;
  onCommit: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(unit.label);
  const [floor, setFloor] = useState(unit.floor ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const res = await updateUnit(unit.id, { label, floor: floor || null, description: unit.description });
    setBusy(false);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    setEditing(false);
    onSaved();
  }

  async function remove() {
    if (!confirm(`Eliminare l'unità "${unit.label}"?`)) return;
    setBusy(true);
    const res = await deleteUnit(unit.id);
    setBusy(false);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    onSaved();
  }

  return (
    <tr className="border-b border-slate-100 last:border-0 dark:border-slate-800/60">
      <td className="px-4 py-2">
        {editing ? (
          <div className="flex flex-col gap-1.5 sm:flex-row">
            <input
              className={inputCls}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Interno 3"
            />
            <input
              className={cn(inputCls, "sm:w-28")}
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
              placeholder="Piano"
            />
          </div>
        ) : (
          <div>
            <span className="font-medium text-slate-800 dark:text-slate-200">
              {unit.label}
            </span>
            {unit.floor && (
              <span className="ml-2 text-xs text-slate-400">· {unit.floor}</span>
            )}
          </div>
        )}
      </td>
      <td className="px-4 py-2 text-right">
        <div className="flex items-center justify-end gap-1.5">
          {saving && <Loader2 size={13} className="animate-spin text-slate-400" />}
          <input
            inputMode="decimal"
            className={cn(inputCls, "w-24 text-right")}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onCommit}
            placeholder="0"
          />
        </div>
      </td>
      <td className="px-4 py-2 text-right">
        {editing ? (
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={save}
              disabled={busy}
              aria-label="Salva"
              className="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setLabel(unit.label);
                setFloor(unit.floor ?? "");
              }}
              aria-label="Annulla"
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label="Modifica unità"
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
            >
              <Pencil size={15} />
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              aria-label="Elimina unità"
              className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
            >
              <Trash2 size={15} />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

function AddUnit({
  buildingId,
  onDone,
}: {
  buildingId: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [floor, setFloor] = useState("");
  const [millesimi, setMillesimi] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await createUnit({
      building_id: buildingId,
      label,
      floor: floor || null,
      millesimi: millesimi || null,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setLabel("");
    setFloor("");
    setMillesimi("");
    setOpen(false);
    onDone();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tap-target inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
      >
        <Plus size={16} /> Aggiungi unità
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="absolute right-0 z-10 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-900"
    >
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <input
        className={cn(inputCls, "mb-2")}
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Nome unità (es. Interno 3)"
        required
        autoFocus
      />
      <div className="mb-2 flex gap-2">
        <input
          className={inputCls}
          value={floor}
          onChange={(e) => setFloor(e.target.value)}
          placeholder="Piano"
        />
        <input
          className={inputCls}
          inputMode="decimal"
          value={millesimi}
          onChange={(e) => setMillesimi(e.target.value)}
          placeholder="Millesimi"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {busy && <Loader2 size={14} className="animate-spin" />}
          Aggiungi
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          Annulla
        </button>
      </div>
    </form>
  );
}
