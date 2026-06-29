"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";
import { updateProfile } from "@/app/_actions/profile";

const inputCls =
  "tap-target mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-900 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200";
const labelCls = "block text-sm font-medium text-slate-700 dark:text-slate-300";

export function ProfileForm({
  email,
  displayName,
  reminderEmail,
  emailReminders,
}: {
  email: string | null;
  displayName: string | null;
  reminderEmail: string | null;
  emailReminders: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(displayName ?? "");
  const [reminder, setReminder] = useState(reminderEmail ?? "");
  const [reminders, setReminders] = useState(emailReminders);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    const res = await updateProfile({
      display_name: name,
      reminder_email: reminder || null,
      email_reminders: reminders,
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {saved && (
        <p className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          <Check size={15} /> Profilo aggiornato
        </p>
      )}

      <div>
        <label className={labelCls}>Email di accesso</label>
        <input className={`${inputCls} opacity-60`} value={email ?? ""} disabled />
      </div>

      <div>
        <label htmlFor="name" className={labelCls}>
          Nome
        </label>
        <input id="name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
      </div>

      <div>
        <label htmlFor="reminder" className={labelCls}>
          Email per i promemoria <span className="text-slate-400">(facoltativo)</span>
        </label>
        <input
          id="reminder"
          type="email"
          className={inputCls}
          value={reminder}
          onChange={(e) => setReminder(e.target.value)}
          placeholder={email ?? "indirizzo@esempio.it"}
        />
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          Se vuoto, useremo la tua email di accesso.
        </p>
      </div>

      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={reminders}
          onChange={(e) => setReminders(e.target.checked)}
          className="h-4 w-4 accent-brand-600"
        />
        <span className="text-sm text-slate-700 dark:text-slate-300">
          Ricevi promemoria email per le quote in scadenza
        </span>
      </label>

      <button
        type="submit"
        disabled={saving}
        className="tap-target inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {saving && <Loader2 size={16} className="animate-spin" />}
        Salva
      </button>
    </form>
  );
}
