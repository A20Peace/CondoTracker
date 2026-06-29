import { requireUser } from "@/lib/auth";
import { ProfileForm } from "@/components/settings/ProfileForm";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const { user, profile } = await requireUser();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Profilo</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Gestisci i tuoi dati e le notifiche email.
        </p>
      </div>
      <ProfileForm
        email={profile?.email ?? user.email ?? null}
        displayName={profile?.display_name ?? null}
        reminderEmail={profile?.reminder_email ?? null}
        emailReminders={profile?.email_reminders ?? true}
      />
    </div>
  );
}
