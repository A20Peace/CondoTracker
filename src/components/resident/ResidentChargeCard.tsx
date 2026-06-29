"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  Copy,
  Check,
  FileText,
  Clock,
  Loader2,
  QrCode,
  AlertTriangle,
} from "lucide-react";
import { SepaQR } from "./SepaQR";
import { ChargeStatusBadge } from "@/components/ui/badges";
import { residentDeclarePaid, residentUndeclare } from "@/app/_actions/payments";
import { getExpenseDocumentUrl } from "@/app/_actions/documents";
import { buildEpcQrPayload, buildCausale } from "@/lib/sepa";
import { formatCurrency, formatDate, formatIban, isValidIban } from "@/lib/utils";
import type { ChargeStatus } from "@/types";

export interface ResidentCharge {
  id: string;
  status: ChargeStatus;
  amount: number;
  dueDate: string;
  buildingName: string;
  unitLabel: string;
  expenseTitle: string;
  expenseId: string;
  iban: string | null;
  holder: string | null;
  hasDocument: boolean;
}

export function ResidentChargeCard({ charge }: { charge: ResidentCharge }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [docLoading, setDocLoading] = useState(false);

  const causale = buildCausale({
    buildingName: charge.buildingName,
    unitLabel: charge.unitLabel,
    expenseTitle: charge.expenseTitle,
  });
  const ibanOk = charge.iban ? isValidIban(charge.iban) : false;
  const payload = charge.iban
    ? buildEpcQrPayload({
        iban: charge.iban,
        name: charge.holder || charge.buildingName,
        amount: charge.amount,
        remittance: causale,
      })
    : null;

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function declare() {
    setBusy(true);
    const res = await residentDeclarePaid(charge.id);
    setBusy(false);
    if (!res.ok) alert(res.error);
    else router.refresh();
  }

  async function undo() {
    setBusy(true);
    const res = await residentUndeclare(charge.id);
    setBusy(false);
    if (!res.ok) alert(res.error);
    else router.refresh();
  }

  async function openDocument() {
    setDocLoading(true);
    const res = await getExpenseDocumentUrl(charge.expenseId);
    setDocLoading(false);
    if (res.ok) window.open(res.url, "_blank", "noopener");
    else alert(res.error);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
              {charge.expenseTitle}
            </p>
            <ChargeStatusBadge status={charge.status} dueDate={charge.dueDate} />
          </div>
          <p className="truncate text-sm text-slate-500 dark:text-slate-400">
            {charge.buildingName} · {charge.unitLabel} · scadenza {formatDate(charge.dueDate)}
          </p>
        </div>
        <p className="shrink-0 text-lg font-bold text-slate-900 dark:text-slate-100">
          {formatCurrency(charge.amount)}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
        {charge.status === "declared" ? (
          <>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
              <Clock size={15} /> In attesa di conferma dall&apos;amministratore
            </span>
            <button
              type="button"
              onClick={undo}
              disabled={busy}
              className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400"
            >
              Annulla
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="tap-target inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            <Banknote size={16} /> Paga con bonifico
          </button>
        )}
        {charge.hasDocument && (
          <button
            type="button"
            onClick={openDocument}
            disabled={docLoading}
            className="tap-target inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {docLoading ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
            Documento
          </button>
        )}
      </div>

      {open && charge.status !== "declared" && (
        <div className="border-t border-slate-100 p-4 dark:border-slate-800">
          {!charge.iban ? (
            <p className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              <AlertTriangle size={15} /> L&apos;IBAN del condominio non è ancora
              configurato. Contatta l&apos;amministratore.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Dati per il bonifico
                </p>
                <CopyRow
                  label="Intestatario"
                  value={charge.holder || charge.buildingName}
                  onCopy={() => copy(charge.holder || charge.buildingName, "holder")}
                  copied={copied === "holder"}
                />
                <CopyRow
                  label="IBAN"
                  value={formatIban(charge.iban)}
                  mono
                  onCopy={() => copy(charge.iban!.replace(/\s+/g, ""), "iban")}
                  copied={copied === "iban"}
                />
                <CopyRow
                  label="Importo"
                  value={formatCurrency(charge.amount)}
                  onCopy={() => copy(charge.amount.toFixed(2), "amount")}
                  copied={copied === "amount"}
                />
                <CopyRow
                  label="Causale"
                  value={causale}
                  onCopy={() => copy(causale, "causale")}
                  copied={copied === "causale"}
                />
                {!ibanOk && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Nota: l&apos;IBAN inserito potrebbe non essere valido. Verifica con
                    l&apos;amministratore.
                  </p>
                )}
              </div>

              <div className="flex flex-col items-center justify-start">
                {payload ? (
                  <>
                    <SepaQR payload={payload} />
                    <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                      <QrCode size={12} /> Inquadra con l&apos;app della tua banca
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-slate-400">QR non disponibile</p>
                )}
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
            <button
              type="button"
              onClick={declare}
              disabled={busy}
              className="tap-target inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              Ho effettuato il bonifico
            </button>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              L&apos;amministratore confermerà l&apos;incasso.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function CopyRow({
  label,
  value,
  mono,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  mono?: boolean;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
      <div className="min-w-0">
        <p className="text-xs text-slate-400 dark:text-slate-500">{label}</p>
        <p
          className={`truncate text-sm font-medium text-slate-800 dark:text-slate-200 ${
            mono ? "font-mono" : ""
          }`}
        >
          {value}
        </p>
      </div>
      <button
        type="button"
        onClick={onCopy}
        aria-label={`Copia ${label}`}
        className="shrink-0 rounded-md p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700"
      >
        {copied ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} />}
      </button>
    </div>
  );
}
