import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Password-recovery callback. Supabase redirects here from the reset email
 * with a `code` that we exchange for a short-lived recovery session, then send
 * the user straight to the change-password form.
 *
 * We use a DEDICATED path (instead of a `next` query on /auth/callback) so the
 * destination is encoded in the URL path itself: Supabase can strip or ignore
 * query parameters that aren't in the redirect allowlist, which previously
 * dropped the user on /home already signed in.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/reset-password`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent(
      "Link di reset non valido o scaduto. Richiedine uno nuovo.",
    )}`,
  );
}
