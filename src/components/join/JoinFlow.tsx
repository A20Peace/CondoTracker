"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, Building2, Home, CheckCircle2, Clock, Loader2 } from "lucide-react";
import {
  findBuildingByCode,
  joinByInviteCode,
  type BuildingLookup,
} from "@/app/_actions/residents";

type Step =
  | { kind: "code" }
  | { kind: "unit"; data: BuildingLookup }
  | { kind: "done"; status: "pending" | "active"; buildingName: string };

const inputCls =
  "tap-target w-full rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-900 px-3 py-2.5 text-center font-mono text-lg uppercase tracking-widest outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200";

export function JoinFlow({ initialCode }: { initialCode: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [step, setStep] = useState<Step>({ kind: "code" });
  const [unitId, setUnitId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await findBuildingByCode(code);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setStep({ kind: "unit", data: res });
    setUnitId(res.units[0]?.id ?? "");
  }

  async function join() {
    if (step.kind !== "unit" || !unitId) return;
    setError(null);
    setBusy(true);
    const res = await joinByInviteCode(code, unitId);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setStep({ kind: "done", status: res.status, buildingName: step.data.building.name });
    router.refresh();
  }

  if (step.kind === "done") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {step.status === "active" ? (
          <>
            <CheckCircle2 className="mx-auto text-emerald-500" size={44} />
            <h3 className="mt-3 text-lg font-bold text-slate-900 dark:text-slate-100">
              Associazione completata
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Sei stato associato a <strong>{step.buildingName}</strong>. Ora puoi
              vedere le tue quote.
            </p>
            <Link
              href="/me"
              className="tap-target mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white hover:bg-brand-700"
            >
              <Home size={18} /> Vai alle mie quote
            </Link>
          </>
        ) : (
          <>
            <Clock className="mx-auto text-amber-500" size={44} />
            <h3 className="mt-3 text-lg font-bold text-slate-900 dark:text-slate-100">
              Richiesta inviata
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              La tua richiesta di associazione a <strong>{step.buildingName}</strong> è
              in attesa di conferma dall&apos;amministratore. Riceverai accesso alle
              tue quote appena verrà approvata.
            </p>
            <Link
              href="/home"
              className="tap-target mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white hover:bg-brand-700"
            >
              <Home size={18} /> Torna alla home
            </Link>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {step.kind === "code" ? (
        <form onSubmit={lookup} className="space-y-4">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
            <KeyRound size={20} className="text-brand-600 dark:text-brand-400" />
            <h3 className="text-base font-semibold">Inserisci il codice invito</h3>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            È il codice che ti ha fornito l&apos;amministratore del tuo condominio.
          </p>
          <input
            className={inputCls}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="ABCD2345"
            maxLength={16}
            autoFocus
            required
          />
          <button
            type="submit"
            disabled={busy || !code.trim()}
            className="tap-target inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            Cerca condominio
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
            <Building2 size={20} className="text-brand-600 dark:text-brand-400" />
            <h3 className="text-base font-semibold">{step.data.building.name}</h3>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Seleziona la tua unità abitativa.
          </p>

          {step.data.units.length === 0 ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Questo condominio non ha ancora unità configurate. Contatta
              l&apos;amministratore.
            </p>
          ) : (
            <div className="space-y-2">
              {step.data.units.map((u) => (
                <label
                  key={u.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition ${
                    unitId === u.id
                      ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20"
                      : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  }`}
                >
                  <input
                    type="radio"
                    name="unit"
                    value={u.id}
                    checked={unitId === u.id}
                    onChange={() => setUnitId(u.id)}
                    className="accent-brand-600"
                  />
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {u.label}
                  </span>
                  {u.floor && <span className="text-xs text-slate-400">· {u.floor}</span>}
                </label>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={join}
              disabled={busy || !unitId}
              className="tap-target inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {busy && <Loader2 size={16} className="animate-spin" />}
              Conferma associazione
            </button>
            <button
              type="button"
              onClick={() => setStep({ kind: "code" })}
              className="tap-target rounded-lg px-4 py-2.5 font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Indietro
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
