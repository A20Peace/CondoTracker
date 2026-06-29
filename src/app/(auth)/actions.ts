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

function appUrl(): string {
  // Prefer the configured public URL; fall back to the request origin.
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const h = headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
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

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
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

  const supabase = createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data,
    options: { emailRedirectTo: `${appUrl()}/auth/callback` },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
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

  const supabase = createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${appUrl()}/auth/callback`,
    },
  });
  if (error) {
    return { error: error.message };
  }

  // If email confirmation is disabled the user is already signed in.
  revalidatePath("/", "layout");
  redirect("/home");
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
