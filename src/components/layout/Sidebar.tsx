"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Building2,
  Receipt,
  LayoutDashboard,
  Wallet,
  UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: typeof Home };

/** Builds the nav list from the user's roles (admin / resident). */
function navFor(admin: boolean, resident: boolean): NavItem[] {
  const items: NavItem[] = [{ href: "/home", label: "Home", icon: Home }];
  if (admin) {
    items.push(
      { href: "/buildings", label: "Condomini", icon: Building2 },
      { href: "/expenses", label: "Spese", icon: Receipt },
      { href: "/dashboard", label: "Riepilogo", icon: LayoutDashboard },
    );
  }
  if (resident) {
    items.push({ href: "/me", label: "Le mie quote", icon: Wallet });
  }
  items.push({ href: "/settings/profile", label: "Profilo", icon: UserCog });
  return items;
}

export function Sidebar({
  admin,
  resident,
}: {
  admin: boolean;
  resident: boolean;
}) {
  const pathname = usePathname();
  const nav = navFor(admin, resident);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 lg:flex lg:flex-col">
        <div className="flex h-16 items-center gap-2 border-b border-slate-200 dark:border-slate-800 px-6">
          <span className="text-2xl">🏢</span>
          <span className="text-lg font-bold tracking-tight dark:text-slate-100">
            Condo<span className="text-brand-600 dark:text-brand-400">Tracker</span>
          </span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map((item) => (
            <NavLink key={item.href} {...item} active={isActive(pathname, item.href)} />
          ))}
        </nav>
      </aside>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 lg:hidden">
        {nav.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "tap-target flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs",
                active ? "text-brand-600 dark:text-brand-400" : "text-slate-500 dark:text-slate-400",
              )}
            >
              <Icon size={20} aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: NavItem & { active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "tap-target flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
        active
          ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
          : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800",
      )}
    >
      <Icon size={18} aria-hidden />
      {label}
    </Link>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/home") return pathname === "/home";
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(href);
}
