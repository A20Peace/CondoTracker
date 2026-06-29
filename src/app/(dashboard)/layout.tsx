import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { requireUser } from "@/lib/auth";
import { getUserRoles } from "@/lib/access";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase, user, profile } = await requireUser();
  const roles = await getUserRoles(supabase, user.id);

  // Brand-new users (no role yet) get the admin nav so they can create their
  // first condominio; the home page also offers the "join with code" path.
  const showAdmin = roles.isAdmin || !roles.isResident;

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar admin={showAdmin} resident={roles.isResident} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          displayName={profile?.display_name}
          email={profile?.email ?? user.email}
        />
        {/* pb-24 leaves room for the mobile bottom tab bar */}
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-6 sm:px-6 lg:pb-10">
          {children}
        </main>
      </div>
      <InstallPrompt />
    </div>
  );
}
