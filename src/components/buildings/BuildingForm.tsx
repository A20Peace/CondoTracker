"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

export interface BuildingFormValues {
  name: string;
  address: string;
  iban: string;
  bank_holder: string;
  notes: string;
}

const EMPTY: BuildingFormValues = {
  name: "",
  address: "",
  iban: "",
  bank_holder: "",
  notes: "",
};

const inputCls =
  "tap-target mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-900 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200";
const labelCls = "block text-sm font-medium text-slate-700 dark:text-slate-300";

export function BuildingForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<BuildingFormValues>;
  submitLabel: string;
  onSubmit: (values: BuildingFormValues) => Promise<{ ok: boolean; error?: string }>;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState<BuildingFormValues>({ ...EMPTY, ...initial });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof BuildingFormValues>(key: K, v: BuildingFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const res = await onSubmit(values);
    setSaving(false);
    if (!res.ok) setError(res.error ?? "Operazione non riuscita");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div>
        <label htmlFor="b-name" className={labelCls}>
          Nome del condominio
        </label>
        <input
          id="b-name"
          className={inputCls}
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Condominio Via Roma 12"
          required
          maxLength={120}
        />
      </div>

      <div>
        <label htmlFor="b-address" className={labelCls}>
          Indirizzo <span className="text-slate-400">(facoltativo)</span>
        </label>
        <input
          id="b-address"
          className={inputCls}
          value={values.address}
          onChange={(e) => set("address", e.target.value)}
          placeholder="Via Roma 12, 00100 Roma"
          maxLength={200}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="b-iban" className={labelCls}>
            IBAN del condominio
          </label>
          <input
            id="b-iban"
            className={inputCls}
            value={values.iban}
            onChange={(e) => set("iban", e.target.value)}
            placeholder="IT60X0542811101000000123456"
            maxLength={40}
            autoCapitalize="characters"
          />
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            Mostrato ai condòmini per il bonifico e il QR SEPA.
          </p>
        </div>
        <div>
          <label htmlFor="b-holder" className={labelCls}>
            Intestatario conto
          </label>
          <input
            id="b-holder"
            className={inputCls}
            value={values.bank_holder}
            onChange={(e) => set("bank_holder", e.target.value)}
            placeholder="Condominio Via Roma 12"
            maxLength={120}
          />
        </div>
      </div>

      <div>
        <label htmlFor="b-notes" className={labelCls}>
          Note <span className="text-slate-400">(facoltativo)</span>
        </label>
        <textarea
          id="b-notes"
          className={inputCls}
          rows={2}
          value={values.notes}
          onChange={(e) => set("notes", e.target.value)}
          maxLength={2000}
        />
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="tap-target inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {saving && <Loader2 size={16} className="animate-spin" />}
          {submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="tap-target rounded-lg px-4 py-2.5 font-medium text-slate-600 dark:text-slate-300 transition hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Annulla
          </button>
        )}
      </div>
    </form>
  );
}
