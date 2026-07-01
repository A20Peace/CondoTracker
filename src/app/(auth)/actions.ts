"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const credentialsSchema = z.object({
  email: z.string().email("Inserisci un'email valida"),
  password: z.string().min(8, "La password deve avere almeno 8 caratteri"),
});

const registerSchema = credentialsSchema.extend({
  displayName: z.string().trim().min(1, "Inserisci un nome").max(80),
});

export type AuthState =
  | { error: string; unverified?: boolean; email?: string }
  | null;

/** State for the "forgot password" request form (no redirect on success). */
export type ResetRequestState = { error?: string; sent?: boolean } | null;

// ─── Messaggi utente (sempre in italiano, mai l'errore tecnico grezzo) ─────────
const GENERIC_ERROR =
  "Si è verificato un errore imprevisto, riprova tra qualche istante";
const NETWORK_ERROR =
  "Impossibile contattare il server, controlla la tua connessione e riprova";
const CONFIG_ERROR =
  "Configurazione di Supabase mancante: completa il file .env.local con URL e chiavi del progetto, poi riavvia il server.";
const ALREADY_REGISTERED = "Questa email è già registrata. Prova ad accedere.";

function appUrl(): string {
  // Prefer the configured public URL; fall back to the request origin.
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const h = headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

/**
 * True only when the Supabase env vars are present AND not the scaffold
 * placeholders. A missing/placeholder URL is the most common cause of
 * "fetch failed": the app tries to reach `https://REPLACE_ME.supabase.co`.
 */
function supabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return false;
  if (url.includes("REPLACE_ME") || key.includes("REPLACE_ME")) return false;
  return true;
}

/** Low-level connection failures: offline, DNS, bad URL, refused. */
function isNetworkError(err: unknown): boolean {
  const e = err as { name?: string; message?: string; cause?: { message?: string } };
  const name = e?.name ?? "";
  const haystack = `${e?.message ?? ""} ${e?.cause?.message ?? ""}`.toLowerCase();
  return (
    name === "AuthRetryableFetchError" ||
    name === "TypeError" ||
    /fetch failed|failed to fetch|network|enotfound|econnrefused|getaddrinfo|und_err/.test(
      haystack,
    )
  );
}

/**
 * Translates any Supabase/auth error into a clear Italian message.
 * The original error is ALWAYS logged for debugging; the user only ever
 * sees a friendly, readable string.
 */
function mapAuthError(err: unknown): string {
  console.error("[auth]", err);

  if (isNetworkError(err)) return NETWORK_ERROR;

  const e = err as { code?: string; status?: number; message?: string };
  const code = e?.code ?? "";
  const status = e?.status;
  const message = (e?.message ?? "").toLowerCase();

  if (
    code === "user_already_exists" ||
    code === "email_exists" ||
    /already registered|already been registered|user already exists/.test(message)
  ) {
    return ALREADY_REGISTERED;
  }
  if (
    code === "weak_password" ||
    (/password/.test(message) && /weak|short|at least|characters/.test(message))
  ) {
    return "La password non è abbastanza sicura: usa almeno 8 caratteri.";
  }
  if (code === "email_address_invalid" || /invalid email|email.*invalid/.test(message)) {
    return "Inserisci un'email valida.";
  }
  if (
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit" ||
    status === 429
  ) {
    return "Troppi tentativi, riprova tra qualche minuto.";
  }
  return GENERIC_ERROR;
}

export async function login(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dati non validi" };
  }

  if (!supabaseConfigured()) {
    console.error("[auth] Supabase env vars missing or still placeholders");
    return { error: CONFIG_ERROR };
  }

  let result;
  try {
    const supabase = createClient();
    result = await supabase.auth.signInWithPassword(parsed.data);
  } catch (err) {
    // A thrown error here is almost always a connection failure.
    return { error: mapAuthError(err) };
  }

  const { error } = result;
  if (error) {
    // Distinguish "email not yet verified" from genuinely wrong credentials.
    if (
      error.code === "email_not_confirmed" ||
      /email not confirmed|not confirmed/i.test(error.message)
    ) {
      return {
        error: "Email in corso di verifica",
        unverified: true,
        email: parsed.data.email,
      };
    }
    // A connection failure must not be reported as "wrong credentials".
    if (isNetworkError(error)) {
      console.error("[auth]", error);
      return { error: NETWORK_ERROR };
    }
    return { error: "Email o password non corretti" };
  }

  revalidatePath("/", "layout");
  redirect("/home");
}

/** Resends the sign-up confirmation email. Rate-limited client-side (60s). */
export async function resendConfirmation(
  email: string,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = z.string().email().safeParse(email);
  if (!parsed.success) return { ok: false, error: "Email non valida" };

  if (!supabaseConfigured()) {
    console.error("[auth] Supabase env vars missing or still placeholders");
    return { ok: false, error: CONFIG_ERROR };
  }

  try {
    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: parsed.data,
      options: { emailRedirectTo: `${appUrl()}/auth/callback` },
    });
    if (error) return { ok: false, error: mapAuthError(error) };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapAuthError(err) };
  }
}

export async function register(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    displayName: formData.get("displayName"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dati non validi" };
  }

  if (!supabaseConfigured()) {
    console.error("[auth] Supabase env vars missing or still placeholders");
    return { error: CONFIG_ERROR };
  }

  let result;
  try {
    const supabase = createClient();
    result = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { display_name: parsed.data.displayName },
        emailRedirectTo: `${appUrl()}/auth/callback`,
      },
    });
  } catch (err) {
    // Connection failure (e.g. unreachable Supabase URL) throws here.
    return { error: mapAuthError(err) };
  }

  if (result.error) {
    return { error: mapAuthError(result.error) };
  }

  // Email-enumeration protection: signing up with an already-registered email
  // returns a user with an empty `identities` array and no error. Surface a
  // clear message instead of silently pretending it worked.
  if (result.data.user && result.data.user.identities?.length === 0) {
    return { error: ALREADY_REGISTERED };
  }

  // If email confirmation is disabled the user is already signed in.
  revalidatePath("/", "layout");
  redirect("/home");
}

/**
 * Sends a password-reset email. The link lands on /auth/callback which
 * exchanges the code for a short-lived recovery session and redirects to
 * /reset-password. For privacy we never reveal whether the email exists.
 */
export async function requestPasswordReset(
  _prev: ResetRequestState,
  formData: FormData,
): Promise<ResetRequestState> {
  const parsed = z
    .string()
    .email("Inserisci un'email valida")
    .safeParse(formData.get("email"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Email non valida" };
  }

  if (!supabaseConfigured()) {
    console.error("[auth] Supabase env vars missing or still placeholders");
    return { error: CONFIG_ERROR };
  }

  try {
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${appUrl()}/reset-password`,
    });
    // Rate-limit errors are worth surfacing; everything else is swallowed so
    // we don't leak whether the address is registered.
    if (
      error &&
      (error.code === "over_email_send_rate_limit" || error.status === 429)
    ) {
      return {
        error:
          "Limite di invio email raggiunto. Riprova più tardi (il limite si azzera dopo circa un'ora).",
      };
    }
    if (error) console.error("[auth] resetPasswordForEmail", error);
  } catch (err) {
    return { error: mapAuthError(err) };
  }

  return { sent: true };
}

export async function signInWithGoogle(): Promise<void> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${appUrl()}/auth/callback?next=/home`,
      scopes: "email profile",
    },
  });
  if (error || !data.url) {
    redirect(`/login?error=${encodeURIComponent("Login Google non riuscito")}`);
  }
  redirect(data.url);
}

export async function signOut(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
