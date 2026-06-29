import { requireUser } from "@/lib/auth";
import { getAdminDashboard } from "@/lib/queries/dashboard";
import { DashboardView } from "@/components/dashboard/DashboardView";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { supabase, user } = await requireUser();
  const data = await getAdminDashboard(supabase, user.id);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Riepilogo pagamenti
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Chi ha pagato, chi è in attesa di conferma e quanto manca all&apos;incasso.
        </p>
      </div>
      <DashboardView data={data} />
    </div>
  );
}
