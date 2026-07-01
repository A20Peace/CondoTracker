"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { requestPasswordReset, type ResetRequestState } from "../actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="tap-target w-full rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? "Invio in corso…" : "Invia il link di recupero"}
    </button>
  );
}

export default function ForgotPasswordPage() {
  const [state, formAction] = useFormState<ResetRequestState, FormData>(
    requestPasswordReset,
    null,
  );

  if (state?.sent) {
    return (
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Controlla la tua email
        </h1>
        <div className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900">
          <p className="flex items-center gap-2 font-semibold">
            <MailCheck size={16} /> Link inviato
          </p>
          <p className="mt-1">
            Se esiste un account con questo indirizzo, ti abbiamo inviato un
            link per reimpostare la password. Controlla anche la cartella spam.
          </p>
        </div>
        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          <Link href="/login" className="font-semibold text-brand-600 hover:underline">
            Torna all&apos;accesso
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
        Password dimenticata?
      </h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Inserisci la tua email: ti invieremo un link per crearne una nuova.
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
        <SubmitButton />
      </form>

      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Ti sei ricordato la password?{" "}
        <Link href="/login" className="font-semibold text-brand-600 hover:underline">
          Accedi
        </Link>
      </p>
    </div>
  );
}
