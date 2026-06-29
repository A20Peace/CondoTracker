import { JoinFlow } from "@/components/join/JoinFlow";

export const dynamic = "force-dynamic";

export default function JoinPage({
  searchParams,
}: {
  searchParams: { code?: string };
}) {
  const initialCode = (searchParams.code ?? "").toUpperCase();

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Unisciti a un condominio
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Associati alla tua unità con il codice invito ricevuto
          dall&apos;amministratore.
        </p>
      </div>
      <JoinFlow initialCode={initialCode} />
    </div>
  );
}
