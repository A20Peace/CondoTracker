"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Check,
  X,
  Trash2,
  Pencil,
  Mail,
  Phone,
  Clock,
  UserPlus,
  Loader2,
} from "lucide-react";
import {
  addResident,
  confirmResident,
  removeResident,
  updateResident,
} from "@/app/_actions/residents";
import { cn } from "@/lib/utils";
import type { Resident, Unit } from "@/types";

const inputCls =
  "w-full rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-900 px-2.5 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200";

export function ResidentsManager({
  units,
  residents,
}: {
  buildingId: string;
  units: Unit[];
  residents: Resident[];
}) {
  const pendingCount = residents.filter((r) => r.status === "pending").length;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Condòmini
        </h3>
        {pendingCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
            <Clock size={13} /> {pendingCount} richiest{pendingCount === 1 ? "a" : "e"} in attesa
          </span>
        )}
      </div>

      {units.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          Aggiungi prima le unità, poi potrai associare i condòmini.
        </p>
      ) : (
        <div className="space-y-3">
          {units.map((unit) => (
            <UnitResidents
              key={unit.id}
              unit={unit}
              residents={residents.filter((r) => r.unit_id === unit.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function UnitResidents({
  unit,
  residents,
}: {
  unit: Unit;
  residents: Resident[];
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-medium text-slate-800 dark:text-slate-200">{unit.label}</span>
          {unit.floor && <span className="ml-2 text-xs text-slate-400">· {unit.floor}</span>}
        </div>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Plus size={15} /> Condòmino
        </button>
      </div>

      {adding && <AddResidentForm unitId={unit.id} onDone={() => setAdding(false)} />}

      {residents.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400 dark:text-slate-500">
          Nessun condòmino associato.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {residents.map((r) => (
            <ResidentRow key={r.id} resident={r} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ResidentRow({ resident }: { resident: Resident }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(resident.name);
  const [email, setEmail] = useState(resident.email);
  const [phone, setPhone] = useState(resident.phone ?? "");

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok) alert(res.error);
    else router.refresh();
  }

  async function save() {
    setBusy(true);
    const res = await updateResident(resident.id, { name, email, phone: phone || null });
    setBusy(false);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (editing) {
    return (
      <li className="flex flex-col gap-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" />
        <div className="flex gap-2">
          <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
          <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefono" />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {busy && <Loader2 size={14} className="animate-spin" />} Salva
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            Annulla
          </button>
        </div>
      </li>
    );
  }

  const pending = resident.status === "pending";

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-800">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-slate-800 dark:text-slate-200">
            {resident.name}
          </span>
          {pending ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
              <Clock size={11} /> In attesa
            </span>
          ) : (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
              Attivo
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1">
            <Mail size={12} /> {resident.email}
          </span>
          {resident.phone && (
            <span className="inline-flex items-center gap-1">
              <Phone size={12} /> {resident.phone}
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {pending && (
          <button
            type="button"
            onClick={() => run(() => confirmResident(resident.id))}
            disabled={busy}
            title="Conferma associazione"
            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            <Check size={14} /> Conferma
          </button>
        )}
        {!pending && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            title="Modifica"
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
          >
            <Pencil size={15} />
          </button>
        )}
        <button
          type="button"
          onClick={() =>
            confirm(
              pending
                ? "Rifiutare questa richiesta?"
                : `Rimuovere ${resident.name} da questa unità?`,
            ) && run(() => removeResident(resident.id))
          }
          disabled={busy}
          title={pending ? "Rifiuta" : "Rimuovi"}
          className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
        >
          {pending ? <X size={15} /> : <Trash2 size={15} />}
        </button>
      </div>
    </li>
  );
}

function AddResidentForm({
  unitId,
  onDone,
}: {
  unitId: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await addResident({ unit_id: unitId, name, email, phone: phone || null });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onDone();
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mt-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome e cognome" required autoFocus />
        <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
        <input className={cn(inputCls, "sm:w-40")} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefono" />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
          Aggiungi
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          Annulla
        </button>
      </div>
    </form>
  );
}
