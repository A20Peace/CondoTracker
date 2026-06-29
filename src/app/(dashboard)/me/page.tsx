import Link from "next/link";
import { Wallet, KeyRound, Clock, CheckCircle2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getUserRoles } from "@/lib/access";
import { getResidentCharges } from "@/lib/queries/resident";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ResidentChargeCard } from "@/components/resident/ResidentChargeCard";

export const dynamic = "force-dynamic";

export default async function MyChargesPage() {
  const { supabase, user } = await requireUser();
  const roles = await getUserRoles(supabase, user.id);

  if (!roles.isResident) {
    return (
      <div className="mx-auto max-w-md space-y-4 text-center">
        {roles.hasPending ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 dark:border-amber-900/50 dark:bg-amber-950/30">
            <Clock className="mx-auto text-amber-500" size={40} />
            <h2 className="mt-3 text-lg font-bold text-slate-900 dark:text-slate-100">
              Richiesta in attesa
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              La tua associazione è in attesa di conferma dall&apos;amministratore.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900">
            <KeyRound className="mx-auto text-slate-300 dark:text-slate-600" size={40} />
            <h2 className="mt-3 text-lg font-bold text-slate-900 dark:text-slate-100">
              Non sei ancora associato
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Inserisci il codice invito del tuo condominio per vedere le tue quote.
            </p>
            <Link
              href="/join"
              className="tap-target mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white hover:bg-brand-700"
            >
              <KeyRound size={18} /> Inserisci codice invito
            </Link>
          </div>
        )}
      </div>
    );
  }

  const { outstanding, paid, totalOutstanding } = await getResidentCharges(supabase);

  return (
    <div className="space-y-8">
      <div className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 p-5 text-white shadow-sm">
        <p className="inline-flex items-center gap-2 text-sm text-brand-100">
          <Wallet size={16} /> Totale da pagare
        </p>
        <p className="mt-1 text-3xl font-bold">{formatCurrency(totalOutstanding)}</p>
        <p className="mt-1 text-sm text-brand-100">
          {outstanding.length} quot{outstanding.length === 1 ? "a" : "e"} aperte
        </p>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Quote da pagare
        </h3>
        {outstanding.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
            <CheckCircle2 className="mx-auto text-emerald-400" size={36} />
            <p className="mt-2 font-medium text-slate-700 dark:text-slate-200">
              Sei in regola con i pagamenti 🎉
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {outstanding.map((r) => (
              <ResidentChargeCard
                key={r.charge.id}
                charge={{
                  id: r.charge.id,
                  status: r.charge.status,
                  amount: Number(r.charge.amount),
                  dueDate: r.dueDate,
                  buildingName: r.buildingName,
                  unitLabel: r.unitLabel,
                  expenseTitle: r.expenseTitle,
                  expenseId: r.expenseId,
                  iban: r.iban,
                  holder: r.holder,
                  hasDocument: r.hasDocument,
                }}
              />
            ))}
          </div>
        )}
      </section>

      {paid.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Storico pagamenti
          </h3>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {paid.map((r) => (
                <li key={r.charge.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                      {r.expenseTitle}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {r.buildingName} · {r.unitLabel}
                      {r.charge.paid_at && ` · pagata il ${formatDate(r.charge.paid_at)}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {formatCurrency(Number(r.charge.amount))}
                    </span>
                    <CheckCircle2 size={16} className="text-emerald-500" />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
