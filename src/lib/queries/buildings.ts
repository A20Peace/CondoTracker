import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type {
  Building,
  MillesimiTable,
  Resident,
  Unit,
  UnitShare,
} from "@/types";

type Client = SupabaseClient<Database>;

export interface BuildingSummary {
  building: Building;
  unitsCount: number;
  residentsCount: number;
  pendingCount: number;
}

/** All condomini administered by the user, with quick counts for the list. */
export async function getAdminBuildings(
  supabase: Client,
  userId: string,
): Promise<BuildingSummary[]> {
  const { data: buildings } = await supabase
    .from("buildings")
    .select("*")
    .eq("admin_id", userId)
    .order("created_at", { ascending: true });

  if (!buildings?.length) return [];

  const ids = buildings.map((b) => b.id);
  const { data: units } = await supabase
    .from("units")
    .select("id, building_id")
    .in("building_id", ids);

  const unitToBuilding = new Map<string, string>();
  (units ?? []).forEach((u) => unitToBuilding.set(u.id, u.building_id));

  const unitIds = (units ?? []).map((u) => u.id);
  const { data: residents } = unitIds.length
    ? await supabase
        .from("residents")
        .select("unit_id, status")
        .in("unit_id", unitIds)
    : { data: [] as { unit_id: string; status: string }[] };

  return buildings.map((building) => {
    const buildingUnits = (units ?? []).filter(
      (u) => u.building_id === building.id,
    );
    const buildingResidents = (residents ?? []).filter((r) =>
      buildingUnits.some((u) => u.id === r.unit_id),
    );
    return {
      building: building as Building,
      unitsCount: buildingUnits.length,
      residentsCount: buildingResidents.filter((r) => r.status === "active").length,
      pendingCount: buildingResidents.filter((r) => r.status === "pending").length,
    };
  });
}

export interface BuildingDetail {
  building: Building;
  tables: MillesimiTable[];
  units: Unit[];
  shares: UnitShare[];
  residents: Resident[];
}

/** Full detail for one condominio: tables, units, millesimi shares, residents. */
export async function getBuildingDetail(
  supabase: Client,
  buildingId: string,
): Promise<BuildingDetail | null> {
  const { data: building } = await supabase
    .from("buildings")
    .select("*")
    .eq("id", buildingId)
    .maybeSingle();
  if (!building) return null;

  const [{ data: tables }, { data: units }] = await Promise.all([
    supabase
      .from("millesimi_tables")
      .select("*")
      .eq("building_id", buildingId)
      .order("is_default", { ascending: false })
      .order("name", { ascending: true }),
    supabase
      .from("units")
      .select("*")
      .eq("building_id", buildingId)
      .order("label", { ascending: true }),
  ]);

  const tableIds = (tables ?? []).map((t) => t.id);
  const unitIds = (units ?? []).map((u) => u.id);

  const [sharesRes, residentsRes] = await Promise.all([
    tableIds.length
      ? supabase.from("unit_shares").select("*").in("table_id", tableIds)
      : Promise.resolve({ data: [] }),
    unitIds.length
      ? supabase
          .from("residents")
          .select("*")
          .in("unit_id", unitIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  return {
    building: building as Building,
    tables: (tables ?? []) as MillesimiTable[],
    units: (units ?? []) as Unit[],
    shares: (sharesRes.data ?? []) as UnitShare[],
    residents: (residentsRes.data ?? []) as Resident[],
  };
}

/** Millesimi total for a table; used by the "should sum to 1000" indicator. */
export function tableMillesimiTotal(
  shares: UnitShare[],
  tableId: string,
): number {
  return shares
    .filter((s) => s.table_id === tableId)
    .reduce((sum, s) => sum + Number(s.millesimi), 0);
}
