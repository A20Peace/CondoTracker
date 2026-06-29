import Link from "next/link";
import {
  Building2,
  Receipt,
  LayoutDashboard,
  Wallet,
  Plus,
  KeyRound,
  Clock,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getUserRoles } from "@/lib/access";
import { formatCurrency } from "@/lib/utils";
import type { ChargeStatus } from "@/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { supabase, user, profile } = await requireUser();
  const roles = await getUserRoles(supabase, user.id);
  const showAdmin = roles.isAdmin || !roles.isResident;
  const greeting = profile?.display_name?.split(" ")[0] ?? "Benvenuto";

  // Admin: how many condomini do I manage?
  const { count: buildingsCount } = await supabase
    .from("buildings")
    .select("id", { count: "exact", head: true })
    .eq("admin_id", user.id);

  // Resident: my outstanding quote (unpaid or declared).
  const { data: myCharges } = roles.isResident
    ? await supabase.from("charges").select("amount, status")
    : { data: null };
  const outstanding = (myCharges ?? []).filter(
    (c) => (c.status as ChargeStatus) !== "paid",
  );
  const outstandingTotal = outstanding.reduce((s, c) => s + Number(c.amount), 0);

  const isOnboarding = !roles.isAdmin && !roles.isResident;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Ciao {greeting} 👋
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {showAdmin
            ? "Gestisci i tuoi condomini, registra le spese e tieni sotto controllo i pagamenti."
            : "Qui trovi le tue quote condominiali e i dati per pagarle."}
        </p>
      </div>

      {roles.hasPending && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
          <Clock size={18} className="mt-0.5 shrink-0" />
          <p>
            La tua richiesta di associazione a un&apos;unità è{" "}
            <strong>in attesa di conferma</strong> dall&apos;amministratore.
            Riceverai accesso alle tue quote appena verrà approvata.
          </p>
        </div>
      )}

      {isOnboarding && <Onboarding />}

      {showAdmin && !isOnboarding && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Amministrazione
          </h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard
              href="/buildings"
              icon={<Building2 size={20} />}
              label="Condomini gestiti"
              value={String(buildingsCount ?? 0)}
            />
            <ActionCard
              href="/expenses"
              icon={<Receipt size={20} />}
              title="Registra una spesa"
              subtitle="Carica il documento e distribuisci per millesimi"
            />
            <ActionCard
              href="/dashboard"
              icon={<LayoutDashboard size={20} />}
              title="Riepilogo pagamenti"
              subtitle="Chi ha pagato, chi no, quanto manca"
            />
          </div>
        </section>
      )}

      {roles.isResident && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Le mie quote
          </h3>
          <Link
            href="/me"
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-300 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300">
                <Wallet size={20} />
              </span>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Da pagare ({outstanding.length})
                </p>
                <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  {formatCurrency(outstandingTotal)}
                </p>
              </div>
            </div>
            <span className="text-sm font-medium text-brand-600 dark:text-brand-400">
              Vedi e paga →
            </span>
          </Link>
        </section>
      )}
    </div>
  );
}

function Onboarding() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Link
        href="/buildings"
        className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-brand-300 dark:border-slate-800 dark:bg-slate-900"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-600 text-white">
          <Plus size={20} />
        </span>
        <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-slate-100">
          Sono un amministratore
        </h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Crea il tuo primo condominio, aggiungi le unità con i millesimi e inizia
          a registrare le spese.
        </p>
        <span className="mt-3 inline-block text-sm font-medium text-brand-600 group-hover:underline dark:text-brand-400">
          Crea un condominio →
        </span>
      </Link>

      <Link
        href="/join"
        className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-brand-300 dark:border-slate-800 dark:bg-slate-900"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-800 text-white dark:bg-slate-700">
          <KeyRound size={20} />
        </span>
        <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-slate-100">
          Sono un condòmino
        </h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Hai ricevuto un codice invito dal tuo amministratore? Inseriscilo per
          associarti alla tua unità.
        </p>
        <span className="mt-3 inline-block text-sm font-medium text-brand-600 group-hover:underline dark:text-brand-400">
          Inserisci il codice invito →
        </span>
      </Link>
    </div>
  );
}

function StatCard({
  href,
  icon,
  label,
  value,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-300 dark:border-slate-800 dark:bg-slate-900"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300">
        {icon}
      </span>
      <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
    </Link>
  );
}

function ActionCard({
  href,
  icon,
  title,
  subtitle,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-300 dark:border-slate-800 dark:bg-slate-900"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300">
        {icon}
      </span>
      <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</p>
      <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
    </Link>
  );
}
