"use client";

import { useEffect, useState } from "react";
import { Copy, Check, RefreshCw, KeyRound, Loader2 } from "lucide-react";
import { regenerateInviteCode } from "@/app/_actions/buildings";

export function InviteCodeCard({
  buildingId,
  code: initialCode,
}: {
  buildingId: string;
  code: string;
}) {
  const [code, setCode] = useState(initialCode);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => setOrigin(window.location.origin), []);

  const joinLink = origin ? `${origin}/join?code=${code}` : "";

  async function copy(text: string, which: "code" | "link") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function regenerate() {
    if (
      !confirm(
        "Generare un nuovo codice invito? Il codice precedente smetterà di funzionare.",
      )
    )
      return;
    setBusy(true);
    const res = await regenerateInviteCode(buildingId);
    setBusy(false);
    if (res.ok && res.code) setCode(res.code);
    else if (!res.ok) alert(res.error);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
        <KeyRound size={18} className="text-brand-600 dark:text-brand-400" />
        <h3 className="text-base font-semibold">Codice invito</h3>
      </div>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Condividilo con i condòmini: lo useranno per registrarsi e associarsi alla
        propria unità (con la tua conferma).
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="rounded-lg bg-slate-100 px-4 py-2 font-mono text-xl font-bold tracking-widest text-slate-900 dark:bg-slate-800 dark:text-slate-100">
          {code}
        </span>
        <button
          type="button"
          onClick={() => copy(code, "code")}
          className="tap-target inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {copied === "code" ? <Check size={15} /> : <Copy size={15} />}
          {copied === "code" ? "Copiato" : "Copia codice"}
        </button>
        <button
          type="button"
          onClick={() => copy(joinLink, "link")}
          disabled={!joinLink}
          className="tap-target inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {copied === "link" ? <Check size={15} /> : <Copy size={15} />}
          {copied === "link" ? "Copiato" : "Copia link"}
        </button>
        <button
          type="button"
          onClick={regenerate}
          disabled={busy}
          className="tap-target inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          Rigenera
        </button>
      </div>
    </div>
  );
}
