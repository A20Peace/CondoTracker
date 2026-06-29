import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getBuildingDetail } from "@/lib/queries/buildings";
import { BuildingSettings } from "@/components/buildings/BuildingSettings";
import { InviteCodeCard } from "@/components/buildings/InviteCodeCard";
import { UnitsManager } from "@/components/buildings/UnitsManager";
import { ResidentsManager } from "@/components/buildings/ResidentsManager";
import { formatIban } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function BuildingDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { supabase } = await requireUser();
  const detail = await getBuildingDetail(supabase, params.id);
  if (!detail) notFound();

  const { building, tables, units, shares, residents } = detail;

  return (
    <div className="space-y-6">
      <Link
        href="/buildings"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <ArrowLeft size={16} /> Tutti i condomini
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {building.name}
          </h2>
          {building.address && (
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
              <MapPin size={14} /> {building.address}
            </p>
          )}
          {building.iban && (
            <p className="mt-1 font-mono text-sm text-slate-500 dark:text-slate-400">
              {formatIban(building.iban)}
            </p>
          )}
        </div>
        <BuildingSettings building={building} />
      </div>

      <InviteCodeCard buildingId={building.id} code={building.invite_code} />

      <UnitsManager
        buildingId={building.id}
        tables={tables}
        units={units}
        shares={shares}
      />

      <ResidentsManager
        buildingId={building.id}
        units={units}
        residents={residents}
      />
    </div>
  );
}
