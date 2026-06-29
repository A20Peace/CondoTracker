import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Next.js patches the global `fetch` to cache GET responses by default. Supabase
 * queries run over `fetch`, so without this they can return STALE data inside
 * route handlers (e.g. the cron job re-reading an old snapshot). Forcing
 * `no-store` makes every DB read hit the database.
 */
const noStoreFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, cache: "no-store" });

/**
 * Server-side Supabase client bound to the request cookies.
 * Use in Server Components, Server Actions and Route Handlers.
 *
 * It honors Row Level Security via the user's session.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: noStoreFetch },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // `set` throws when called from a Server Component; the session is
            // then refreshed by the middleware instead. Safe to ignore.
          }
        },
      },
    },
  );
}

/**
 * Privileged client using the service-role key. Bypasses RLS.
 *
 * ONLY use in trusted server contexts (cron jobs, account deletion,
 * cross-user notifications, invite-code lookups). Never expose to the browser.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: noStoreFetch },
    },
  );
}
