"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Loader2 } from "lucide-react";
import { BuildingForm, type BuildingFormValues } from "./BuildingForm";
import { updateBuilding, deleteBuilding } from "@/app/_actions/buildings";
import type { Building } from "@/types";

export function BuildingSettings({ building }: { building: Building }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleUpdate(values: BuildingFormValues) {
    const res = await updateBuilding(building.id, {
      name: values.name,
      address: values.address || null,
      iban: values.iban || null,
      bank_holder: values.bank_holder || null,
      notes: values.notes || null,
    });
    if (!res.ok) return { ok: false, error: res.error };
    setEditing(false);
    router.refresh();
    return { ok: true };
  }

  async function handleDelete() {
    if (
      !confirm(
        `Eliminare definitivamente "${building.name}"? Verranno rimosse unità, condòmini, spese e quote collegate.`,
      )
    )
      return;
    setDeleting(true);
    const res = await deleteBuilding(building.id);
    if (!res.ok) {
      setDeleting(false);
      alert(res.error);
      return;
    }
    router.push("/buildings");
    router.refresh();
  }

  if (editing) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-slate-100">
          Modifica condominio
        </h3>
        <BuildingForm
          submitLabel="Salva modifiche"
          initial={{
            name: building.name,
            address: building.address ?? "",
            iban: building.iban ?? "",
            bank_holder: building.bank_holder ?? "",
            notes: building.notes ?? "",
          }}
          onSubmit={handleUpdate}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="tap-target inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <Pencil size={15} /> Modifica dati
      </button>
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="tap-target inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40"
      >
        {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
        Elimina
      </button>
    </div>
  );
}
