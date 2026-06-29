import { differenceInCalendarDays, parseISO } from "date-fns";
import type { ChargeStatus, ExpenseStatus, ResidentStatus } from "@/types";

/** Tiny classnames helper (no clsx dependency needed). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Format a number as EUR. Returns "—" for null/undefined. */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

/** Format an ISO date (YYYY-MM-DD) as e.g. "23 giu 2026". */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = iso.length === 10 ? parseISO(iso) : new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function daysUntil(dueDate: string, now: Date = new Date()): number {
  return differenceInCalendarDays(parseISO(dueDate), now);
}

/** Format millesimi: up to 3 decimals, Italian separators (es. "120,5"). */
export function formatMillesimi(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(value);
}

/** Normalize an IBAN: strip spaces, uppercase. */
export function normalizeIban(iban: string): string {
  return iban.replace(/\s+/g, "").toUpperCase();
}

/** Pretty IBAN grouped in blocks of 4: "IT60 X054 2811 1010 0000 0123 456". */
export function formatIban(iban: string | null | undefined): string {
  if (!iban) return "—";
  return normalizeIban(iban).replace(/(.{4})/g, "$1 ").trim();
}

/**
 * Light IBAN validation: country+check digits, length per country (a subset),
 * and the ISO 7064 mod-97 checksum. Good enough to catch typos at input time.
 */
export function isValidIban(input: string): boolean {
  const iban = normalizeIban(input);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban)) return false;
  if (iban.length < 15 || iban.length > 34) return false;
  // Move the first 4 chars to the end, then convert letters to numbers.
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  // mod-97 over a long numeric string, chunked to avoid overflow.
  let remainder = 0;
  for (let i = 0; i < numeric.length; i += 7) {
    remainder = Number(String(remainder) + numeric.slice(i, i + 7)) % 97;
  }
  return remainder === 1;
}

// ─── Status display helpers ───────────────────────────────────────────────────

export const CHARGE_STATUS_LABELS: Record<ChargeStatus, string> = {
  unpaid: "Da pagare",
  declared: "In attesa di conferma",
  paid: "Pagato",
};

export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  draft: "Bozza",
  confirmed: "Confermata",
};

export const RESIDENT_STATUS_LABELS: Record<ResidentStatus, string> = {
  pending: "In attesa di conferma",
  active: "Attivo",
};

/**
 * Visual status of a charge for badges, combining its payment state and the
 * expense due date:
 *  - paid     → admin confirmed
 *  - declared → resident declared, awaiting admin confirmation
 *  - overdue  → unpaid and past due
 *  - due      → unpaid and due within 7 days
 *  - upcoming → unpaid and due further out
 */
export type ChargeDisplayStatus =
  | "paid"
  | "declared"
  | "overdue"
  | "due"
  | "upcoming";

export function getChargeDisplayStatus(
  status: ChargeStatus,
  dueDate: string,
  now: Date = new Date(),
): ChargeDisplayStatus {
  if (status === "paid") return "paid";
  if (status === "declared") return "declared";
  const days = differenceInCalendarDays(parseISO(dueDate), now);
  if (days < 0) return "overdue";
  if (days <= 7) return "due";
  return "upcoming";
}
