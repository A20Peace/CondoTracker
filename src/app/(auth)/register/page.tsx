"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { register, signInWithGoogle, type AuthState } from "../actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="tap-target w-full rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? "Creazione account…" : "Crea account"}
    </button>
  );
}

export default function RegisterPage() {
  const [state, formAction] = useFormState<AuthState, FormData>(register, null);

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Crea il tuo account</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Sei un amministratore o un condòmino? Registrati con email e password.
      </p>

      {state?.error && (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {state.error}
        </p>
      )}

      <form action={formAction} className="mt-6 space-y-4">
        <div>
          <label htmlFor="displayName" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Nome
          </label>
          <input
            id="displayName"
            name="displayName"
            type="text"
            autoComplete="name"
            required
            className="tap-target mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          />
        </div>
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
          <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="tap-target mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          />
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Almeno 8 caratteri.</p>
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
          Continua con Google
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Hai già un account?{" "}
        <Link href="/login" className="font-semibold text-brand-600 hover:underline">
          Accedi
        </Link>
      </p>
    </div>
  );
}
