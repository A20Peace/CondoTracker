import { cn, getChargeDisplayStatus } from "@/lib/utils";
import type { ChargeStatus, ExpenseStatus } from "@/types";

const CHARGE_STYLES: Record<
  ReturnType<typeof getChargeDisplayStatus>,
  { label: string; cls: string }
> = {
  paid: {
    label: "Pagato",
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  },
  declared: {
    label: "In attesa di conferma",
    cls: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300",
  },
  overdue: {
    label: "Scaduta",
    cls: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  },
  due: {
    label: "In scadenza",
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  },
  upcoming: {
    label: "Da pagare",
    cls: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  },
};

export function ChargeStatusBadge({
  status,
  dueDate,
  className,
}: {
  status: ChargeStatus;
  dueDate: string;
  className?: string;
}) {
  const display = getChargeDisplayStatus(status, dueDate);
  const { label, cls } = CHARGE_STYLES[display];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        cls,
        className,
      )}
    >
      {label}
    </span>
  );
}

export function ExpenseStatusBadge({ status }: { status: ExpenseStatus }) {
  const confirmed = status === "confirmed";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        confirmed
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
          : "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
      )}
    >
      {confirmed ? "Confermata" : "Bozza"}
    </span>
  );
}
