import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export interface UserRoles {
  /** Administers at least one condominio. */
  isAdmin: boolean;
  /** Is an active resident in at least one unit. */
  isResident: boolean;
  /** Has a resident association still awaiting admin confirmation. */
  hasPending: boolean;
}

/**
 * Determines a user's roles so the UI can show the right navigation and home
 * sections. A user can be both an administrator and a resident.
 */
export async function getUserRoles(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<UserRoles> {
  const [admin, active, pending] = await Promise.all([
    supabase
      .from("buildings")
      .select("id", { count: "exact", head: true })
      .eq("admin_id", userId),
    supabase
      .from("residents")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "active"),
    supabase
      .from("residents")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "pending"),
  ]);

  return {
    isAdmin: (admin.count ?? 0) > 0,
    isResident: (active.count ?? 0) > 0,
    hasPending: (pending.count ?? 0) > 0,
  };
}
