"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Phase = "verifying" | "ready" | "invalid";

/**
 * Password-recovery landing page. The Supabase reset email links here.
 *
 * The default (non-editable) reset template verifies the token on Supabase's
 * side and hands the session back in the URL — either as a `#access_token`
 * fragment (implicit flow) or a `?code=` query (PKCE). The fragment never
 * reaches the server, so recovery MUST be handled here, in the browser, where
 * the Supabase client can read the URL and establish the recovery session.
 * The new password is then saved with updateUser() using that session.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("verifying");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const supabaseRef = useRef(createClient());

  // Establish the recovery session from the URL (fragment or ?code=).
  useEffect(() => {
    const supabase = supabaseRef.current;
    let settled = false;
    const ready = () => {
      settled = true;
      setPhase("ready");
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // The recovery link fires PASSWORD_RECOVERY; any established session is
      // also enough to let the user set a new password.
      if (event === "PASSWORD_RECOVERY" || session) ready();
    });

    (async () => {
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) return ready();
      }
      // Implicit flow: the client auto-detects the fragment on load.
      const { data } = await supabase.auth.getSession();
      if (data.session) return ready();
      // Give onAuthStateChange a brief window before declaring the link invalid.
      setTimeout(() => {
        if (!settled) setPhase("invalid");
      }, 3000);
    })();

    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("La password deve avere almeno 8 caratteri.");
      return;
    }
    if (password !== confirm) {
      setError("Le password non coincidono.");
      return;
    }

    setSaving(true);
    const supabase = supabaseRef.current;
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (error) {
      console.error("[reset] updateUser", error);
      if (/session|not authenticated|auth session missing/i.test(error.message)) {
        setError(
          "Sessione di recupero scaduta. Richiedi un nuovo link dalla pagina di accesso.",
        );
      } else if (/weak|short|at least|characters/i.test(error.message)) {
        setError("La password non è abbastanza sicura: usa almeno 8 caratteri.");
      } else if (/same.*password|different from the old/i.test(error.message)) {
        setError("La nuova password deve essere diversa da quella attuale.");
      } else {
        setError("Impossibile aggiornare la password. Riprova.");
      }
      return;
    }

    // Password changed: sign the recovery session out so the user logs in
    // fresh with the new credentials.
    setDone(true);
    await supabase.auth.signOut();
    setTimeout(() => router.replace("/login?reset=1"), 1600);
  }

  if (phase === "verifying") {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <Loader2 className="animate-spin text-brand-600" size={28} />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Verifica del link in corso…
        </p>
      </div>
    );
  }

  if (phase === "invalid") {
    return (
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Link non valido
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Il link di reset è scaduto o è già stato usato. Richiedine uno nuovo.
        </p>
        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          <Link href="/forgot-password" className="font-semibold text-brand-600 hover:underline">
            Richiedi un nuovo link
          </Link>
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Password aggiornata
        </h1>
        <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          <Check size={16} /> Fatto! Ti stiamo riportando all&apos;accesso…
        </div>
      </div>
    );
  }

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

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <form onSubmit={submit} className="mt-6 space-y-4">
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
          {tooShort && <p className="mt-1 text-xs text-amber-600">Almeno 8 caratteri.</p>}
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
          {mismatch && <p className="mt-1 text-xs text-red-600">Le password non coincidono.</p>}
        </div>
        <button
          type="submit"
          disabled={saving || invalid}
          className="tap-target inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {saving && <Loader2 size={16} className="animate-spin" />}
          {saving ? "Salvataggio…" : "Imposta nuova password"}
        </button>
      </form>
    </div>
  );
}
