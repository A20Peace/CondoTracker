import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import {
  NewExpenseWizard,
  type WizardBuilding,
} from "@/components/expenses/NewExpenseWizard";

export const dynamic = "force-dynamic";

export default async function NewExpensePage() {
  const { supabase, user } = await requireUser();

  const { data: buildings } = await supabase
    .from("buildings")
    .select("id, name")
    .eq("admin_id", user.id)
    .order("name", { ascending: true });

  const ids = (buildings ?? []).map((b) => b.id);
  const { data: tables } = ids.length
    ? await supabase
        .from("millesimi_tables")
        .select("id, building_id, name, is_default")
        .in("building_id", ids)
    : { data: [] };

  const wizardBuildings: WizardBuilding[] = (buildings ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    tables: (tables ?? [])
      .filter((t) => t.building_id === b.id)
      .map((t) => ({ id: t.id, name: t.name, is_default: t.is_default })),
  }));

  return (
    <div className="space-y-6">
      <Link
        href="/expenses"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <ArrowLeft size={16} /> Tutte le spese
      </Link>
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Nuova spesa</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Inserisci l&apos;importo, scegli la tabella millesimale e rivedi le quote
          prima di confermare.
        </p>
      </div>
      <NewExpenseWizard
        buildings={wizardBuildings}
        parsingEnabled={Boolean(process.env.ANTHROPIC_API_KEY)}
      />
    </div>
  );
}
