import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-brand-50 to-slate-50 px-4 py-10">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <span className="text-3xl">🏢</span>
        <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Condo<span className="text-brand-600">Tracker</span>
        </span>
      </Link>
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-xl ring-1 ring-slate-200 dark:ring-slate-800 sm:p-8">
        {children}
      </div>
      <p className="mt-6 max-w-md text-center text-xs text-slate-400 dark:text-slate-500">
        Gestione spese condominiali: registra le spese, distribuiscile per
        millesimi e fai pagare i condòmini con bonifico e QR code SEPA.
      </p>
    </div>
  );
}
