"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { updatePassword, type AuthState } from "../actions";

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="tap-target w-full rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? "Salvataggio…" : "Imposta nuova password"}
    </button>
  );
}

export default function ResetPasswordPage() {
  const [state, formAction] = useFormState<AuthState, FormData>(
    updatePassword,
    null,
  );
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirm.length > 0 && password !== confirm;
  const invalid = password.length < 8 || password !== confirm;

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
        Nuova password
      </h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Scegli una nuova password per il tuo account.
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
          <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Nuova password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="tap-target mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          />
          {tooShort && (
            <p className="mt-1 text-xs text-amber-600">Almeno 8 caratteri.</p>
          )}
        </div>
        <div>
          <label htmlFor="confirm" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Conferma password
          </label>
          <input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="tap-target mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          />
          {mismatch && (
            <p className="mt-1 text-xs text-red-600">Le password non coincidono.</p>
          )}
        </div>
        <SubmitButton disabled={invalid} />
      </form>

      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        <Link href="/login" className="font-semibold text-brand-600 hover:underline">
          Torna all&apos;accesso
        </Link>
      </p>
    </div>
  );
}
