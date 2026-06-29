import Link from "next/link";
import { Building2, Users, Home as HomeIcon, Clock, ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getAdminBuildings } from "@/lib/queries/buildings";
import { NewBuildingPanel } from "@/components/buildings/NewBuildingPanel";

export const dynamic = "force-dynamic";

export default async function BuildingsPage() {
  const { supabase, user } = await requireUser();
  const buildings = await getAdminBuildings(supabase, user.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            I tuoi condomini
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Crea e gestisci condomini, unità e condòmini.
          </p>
        </div>
        <NewBuildingPanel />
      </div>

      {buildings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
          <Building2 className="mx-auto text-slate-300 dark:text-slate-600" size={40} />
          <p className="mt-3 font-medium text-slate-700 dark:text-slate-200">
            Nessun condominio
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Crea il tuo primo condominio per iniziare.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {buildings.map(({ building, unitsCount, residentsCount, pendingCount }) => (
            <li key={building.id}>
              <Link
                href={`/buildings/${building.id}`}
                className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-300 dark:border-slate-800 dark:bg-slate-900"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300">
                  <Building2 size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
                    {building.name}
                  </p>
                  {building.address && (
                    <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                      {building.address}
                    </p>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <HomeIcon size={13} /> {unitsCount} unità
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users size={13} /> {residentsCount} condòmini
                    </span>
                    {pendingCount > 0 && (
                      <span className="inline-flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
                        <Clock size={13} /> {pendingCount} in attesa
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="text-slate-300 dark:text-slate-600" size={20} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
