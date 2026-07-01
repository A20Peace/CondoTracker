"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, useTransition } from "react";
import { MailCheck, Loader2 } from "lucide-react";
import {
  login,
  resendConfirmation,
  signInWithGoogle,
  type AuthState,
} from "../actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="tap-target w-full rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? "Accesso in corso…" : "Accedi"}
    </button>
  );
}

function LoginForm() {
  const [state, formAction] = useFormState<AuthState, FormData>(login, null);
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Bentornato</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Accedi per gestire condomini, spese e quote.
      </p>

      {state?.unverified ? (
        <UnverifiedNotice email={state.email ?? ""} />
      ) : (
        (state?.error || urlError) && (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {state?.error ?? urlError}
          </p>
        )
      )}

      <form action={formAction} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="tap-target mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-brand-600 hover:underline"
            >
              Password dimenticata?
            </Link>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="tap-target mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          />
        </div>
        <SubmitButton />
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
        <span className="h-px flex-1 bg-slate-200" />
        oppure
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <form action={signInWithGoogle}>
        <button
          type="submit"
          className="tap-target flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 font-medium text-slate-700 dark:text-slate-300 transition hover:bg-slate-50"
        >
          <GoogleIcon />
          Continua con Google
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Non hai un account?{" "}
        <Link href="/register" className="font-semibold text-brand-600 hover:underline">
          Registrati
        </Link>
      </p>
    </div>
  );
}

function UnverifiedNotice({ email }: { email: string }) {
  const [cooldown, setCooldown] = useState(0);
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function resend() {
    if (cooldown > 0 || pending || !email) return;
    setError(null);
    setSent(false);
    startTransition(async () => {
      const res = await resendConfirmation(email);
      if (res.ok) {
        setSent(true);
        setCooldown(60);
      } else {
        setError(res.error ?? "Invio non riuscito");
      }
    });
  }

  return (
    <div className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
      <p className="flex items-center gap-2 font-semibold">
        <MailCheck size={16} /> Email in corso di verifica
      </p>
      <p className="mt-1 text-amber-800/90">
        Controlla la tua casella di posta e clicca sul link che ti abbiamo inviato.
        Controlla anche la cartella spam.
      </p>

      {sent && (
        <p className="mt-2 text-emerald-700">Email di conferma reinviata ✓</p>
      )}
      {error && <p className="mt-2 text-red-700">{error}</p>}

      <button
        type="button"
        onClick={resend}
        disabled={pending || cooldown > 0}
        className="tap-target mt-2 inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm font-medium text-amber-800 transition hover:bg-amber-50 disabled:opacity-60"
      >
        {pending && <Loader2 size={14} className="animate-spin" />}
        {cooldown > 0 ? `Reinvia tra ${cooldown}s` : "Reinvia email di conferma"}
      </button>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35 24 35c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 5.1 29.5 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.6 20-21 0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 7.1 29.5 5 24 5 16.3 5 9.7 9.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 45c5.2 0 9.9-2 13.5-5.2l-6.2-5.3C29.2 36.1 26.7 37 24 37c-5.3 0-9.7-2.6-11.3-6.9l-6.5 5C9.6 40.6 16.2 45 24 45z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.2 5.3C41.4 35.5 44 30.3 44 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}
