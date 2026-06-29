"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { BuildingForm, type BuildingFormValues } from "./BuildingForm";
import { createBuilding } from "@/app/_actions/buildings";

export function NewBuildingPanel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleCreate(values: BuildingFormValues) {
    const res = await createBuilding({
      name: values.name,
      address: values.address || null,
      iban: values.iban || null,
      bank_holder: values.bank_holder || null,
      notes: values.notes || null,
    });
    if (!res.ok) return { ok: false, error: res.error };
    setOpen(false);
    if (res.id) router.push(`/buildings/${res.id}`);
    router.refresh();
    return { ok: true };
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tap-target inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white transition hover:bg-brand-700"
      >
        <Plus size={18} /> Nuovo condominio
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Nuovo condominio
        </h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Chiudi"
          className="tap-target rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X size={18} />
        </button>
      </div>
      <BuildingForm
        submitLabel="Crea condominio"
        onSubmit={handleCreate}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}
