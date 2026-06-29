import { Resend } from "resend";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { createAdminClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate, formatIban } from "@/lib/utils";
import { buildCausale } from "@/lib/sepa";

/** Days BEFORE the due date on which a (once-only) reminder is sent. */
const PRE_DUE_DAYS = [14, 7, 3, 2, 1, 0] as const;

type Admin = ReturnType<typeof createAdminClient>;

interface Recipient {
  email: string;
  name: string | null;
}

/** Everything an email needs about one unit's quota. */
interface ChargeContext {
  chargeId: string;
  amount: number;
  dueDate: string;
  buildingName: string;
  unitLabel: string;
  expenseTitle: string;
  iban: string | null;
  holder: string | null;
  recipients: Recipient[];
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

function fromAddress(): string {
  return process.env.RESEND_FROM ?? "CondoTracker <onboarding@resend.dev>";
}

// ─── Email templates ─────────────────────────────────────────────────────────

function emailShell(title: string, bodyHtml: string): string {
  return `<!doctype html><html lang="it"><body style="margin:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)">
        <tr><td style="padding:20px 24px;background:#1b5df5;color:#fff;font-size:18px;font-weight:700">🏢 CondoTracker</td></tr>
        <tr><td style="padding:24px">
          <h1 style="margin:0 0 12px;font-size:18px">${title}</h1>
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:16px 24px;background:#f8fafc;color:#94a3b8;font-size:12px;line-height:1.6">
          Ricevi questa email perché sei un condòmino registrato.
          <a href="${appUrl()}/settings/profile" style="color:#64748b">Gestisci le notifiche</a>.
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

function row(label: string, value: string): string {
  return `<tr><td style="padding:4px 0;color:#64748b;font-size:14px">${label}</td><td style="padding:4px 0;text-align:right;font-weight:600;font-size:14px">${value}</td></tr>`;
}

function chargeDetailsHtml(ctx: ChargeContext): string {
  const bonifico = ctx.iban
    ? `<div style="margin:12px 0;padding:12px 14px;background:#f8fafc;border-radius:10px">
        <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#334155">Dati per il bonifico</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${ctx.holder ? row("Intestatario", ctx.holder) : ""}
          ${row("IBAN", formatIban(ctx.iban))}
          ${row("Importo", formatCurrency(ctx.amount))}
          ${row("Causale", buildCausale({ buildingName: ctx.buildingName, unitLabel: ctx.unitLabel, expenseTitle: ctx.expenseTitle }))}
        </table>
      </div>`
    : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 4px">
      ${row("Condominio", ctx.buildingName)}
      ${row("Unità", ctx.unitLabel)}
      ${row("Spesa", ctx.expenseTitle)}
      ${row("La tua quota", formatCurrency(ctx.amount))}
      ${row("Scadenza", formatDate(ctx.dueDate))}
    </table>
    ${bonifico}`;
}

function ctaButton(): string {
  return `<a href="${appUrl()}/me" style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;font-size:15px">Vedi e paga</a>`;
}

async function send(to: string, subject: string, html: string): Promise<boolean> {
  const resend = getResend();
  if (!resend) {
    console.warn("[resend] RESEND_API_KEY mancante: email non inviata");
    return false;
  }
  const { error } = await resend.emails.send({ from: fromAddress(), to, subject, html });
  if (error) {
    console.error("[resend] invio non riuscito:", error.message);
    return false;
  }
  return true;
}

// ─── Data assembly ───────────────────────────────────────────────────────────

/**
 * Builds a ChargeContext for each charge id, resolving building, unit and the
 * active residents (recipients) — honoring each linked profile's email_reminders.
 */
async function buildContexts(
  admin: Admin,
  charges: { id: string; unit_id: string; amount: number; expense_id: string }[],
): Promise<ChargeContext[]> {
  if (charges.length === 0) return [];

  const expenseIds = [...new Set(charges.map((c) => c.expense_id))];
  const { data: expenses } = await admin
    .from("expenses")
    .select("id, title, due_date, building_id")
    .in("id", expenseIds);
  const expenseById = new Map((expenses ?? []).map((e) => [e.id, e]));

  const buildingIds = [...new Set((expenses ?? []).map((e) => e.building_id))];
  const { data: buildings } = buildingIds.length
    ? await admin.from("buildings").select("id, name, iban, bank_holder").in("id", buildingIds)
    : { data: [] };
  const buildingById = new Map((buildings ?? []).map((b) => [b.id, b]));

  const unitIds = [...new Set(charges.map((c) => c.unit_id))];
  const { data: units } = await admin.from("units").select("id, label").in("id", unitIds);
  const unitById = new Map((units ?? []).map((u) => [u.id, u]));

  const { data: residents } = await admin
    .from("residents")
    .select("unit_id, name, email, user_id, status")
    .in("unit_id", unitIds)
    .eq("status", "active");

  // Respect each linked profile's email_reminders preference.
  const userIds = [...new Set((residents ?? []).map((r) => r.user_id).filter(Boolean))] as string[];
  const { data: profiles } = userIds.length
    ? await admin.from("profiles").select("id, email_reminders").in("id", userIds)
    : { data: [] };
  const remindersOff = new Set(
    (profiles ?? []).filter((p) => p.email_reminders === false).map((p) => p.id),
  );

  const residentsByUnit = new Map<string, Recipient[]>();
  for (const r of residents ?? []) {
    if (r.user_id && remindersOff.has(r.user_id)) continue;
    if (!r.email || r.email === "n/d") continue;
    const list = residentsByUnit.get(r.unit_id) ?? [];
    list.push({ email: r.email, name: r.name });
    residentsByUnit.set(r.unit_id, list);
  }

  const contexts: ChargeContext[] = [];
  for (const c of charges) {
    const expense = expenseById.get(c.expense_id);
    if (!expense) continue;
    const building = buildingById.get(expense.building_id);
    contexts.push({
      chargeId: c.id,
      amount: Number(c.amount),
      dueDate: expense.due_date,
      buildingName: building?.name ?? "Condominio",
      unitLabel: unitById.get(c.unit_id)?.label ?? "Unità",
      expenseTitle: expense.title,
      iban: building?.iban ?? null,
      holder: building?.bank_holder ?? null,
      recipients: residentsByUnit.get(c.unit_id) ?? [],
    });
  }
  return contexts;
}

// ─── New-expense notification ────────────────────────────────────────────────

/**
 * Notifies every involved resident when an expense is confirmed. Fire-and-forget:
 * callers ignore failures so confirmation is never blocked.
 */
export async function notifyExpenseConfirmed(expenseId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: charges } = await admin
    .from("charges")
    .select("id, unit_id, amount, expense_id")
    .eq("expense_id", expenseId);
  if (!charges?.length) return;

  const contexts = await buildContexts(admin, charges);
  for (const ctx of contexts) {
    if (ctx.recipients.length === 0) continue;
    const subject = `🏢 Nuova quota condominiale: ${ctx.expenseTitle} — ${formatCurrency(ctx.amount)}`;
    const intro = `È stata registrata una nuova spesa per <strong>${ctx.buildingName}</strong>. Di seguito la quota di competenza della tua unità.`;
    const html = emailShell(
      "Nuova quota da pagare",
      `<p style="margin:0 0 8px;font-size:15px;line-height:1.6">${intro}</p>
       ${chargeDetailsHtml(ctx)}
       <div style="margin-top:12px">${ctaButton()}</div>`,
    );
    await Promise.all(ctx.recipients.map((r) => send(r.email, subject, html)));
  }
}

// ─── Scalar reminders (daily cron) ───────────────────────────────────────────

export interface ReminderRunResult {
  candidates: number;
  due: number;
  alreadySent: number;
  emailsSent: number;
  emailsFailed: number;
}

async function alreadySent(admin: Admin, chargeId: string, kind: string): Promise<boolean> {
  const { data } = await admin
    .from("sent_reminders")
    .select("id")
    .eq("charge_id", chargeId)
    .eq("kind", kind)
    .maybeSingle();
  return Boolean(data);
}

async function recordSent(admin: Admin, chargeId: string, kind: string): Promise<void> {
  await admin.from("sent_reminders").insert({ charge_id: chargeId, kind });
}

/** "Today" as a calendar date in Europe/Rome, regardless of server timezone. */
function romeToday(): { date: Date; iso: string } {
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
  return { date: parseISO(iso), iso };
}

function reminderContent(
  ctx: ChargeContext,
  daysUntil: number,
): { subject: string; html: string } {
  const amount = formatCurrency(ctx.amount);
  let heading: string;
  let subject: string;
  let intro: string;

  if (daysUntil > 1) {
    heading = `Scadenza tra ${daysUntil} giorni`;
    subject = `⏰ Quota ${ctx.buildingName}: scadenza tra ${daysUntil} giorni — ${amount}`;
    intro = `Mancano ${daysUntil} giorni alla scadenza della tua quota per <strong>${ctx.expenseTitle}</strong>.`;
  } else if (daysUntil === 1) {
    heading = "Scadenza domani";
    subject = `⏰ Quota ${ctx.buildingName}: scade domani — ${amount}`;
    intro = `Domani scade la tua quota per <strong>${ctx.expenseTitle}</strong>.`;
  } else if (daysUntil === 0) {
    heading = "Scade oggi";
    subject = `⏰ Quota ${ctx.buildingName}: scade oggi — ${amount}`;
    intro = `Oggi è l'ultimo giorno per pagare la tua quota per <strong>${ctx.expenseTitle}</strong>.`;
  } else {
    const late = -daysUntil;
    heading = `Scaduta da ${late} ${late === 1 ? "giorno" : "giorni"}`;
    subject = `⚠️ Quota ${ctx.buildingName} scaduta da ${late} ${late === 1 ? "giorno" : "giorni"} — ${amount}`;
    intro = `La tua quota per <strong>${ctx.expenseTitle}</strong> è scaduta da ${late} ${
      late === 1 ? "giorno" : "giorni"
    }. Provvedi al pagamento o segnala come pagata.`;
  }

  const html = emailShell(
    heading,
    `<p style="margin:0 0 8px;font-size:15px;line-height:1.6">${intro}</p>
     ${chargeDetailsHtml(ctx)}
     <div style="margin-top:12px">${ctaButton()}</div>`,
  );
  return { subject, html };
}

/**
 * Daily job: sends scalar reminders for unpaid quote of confirmed expenses:
 *  - once at 14, 7, 3, 2, 1 and 0 days before the due date;
 *  - then every day after the due date until paid or declared.
 * Deduplicated via sent_reminders (charge_id, kind). Records dedup only AFTER a
 * successful send, so a failed send retries next run instead of skipping forever.
 */
export async function processDailyReminders(): Promise<ReminderRunResult> {
  const admin = createAdminClient();
  const { date: today, iso: todayStr } = romeToday();
  const result: ReminderRunResult = {
    candidates: 0,
    due: 0,
    alreadySent: 0,
    emailsSent: 0,
    emailsFailed: 0,
  };

  // Only unpaid quote of CONFIRMED expenses are eligible.
  const { data: confirmed } = await admin
    .from("expenses")
    .select("id")
    .eq("status", "confirmed");
  const confirmedIds = (confirmed ?? []).map((e) => e.id);
  if (confirmedIds.length === 0) return result;

  const { data: charges } = await admin
    .from("charges")
    .select("id, unit_id, amount, expense_id")
    .eq("status", "unpaid")
    .in("expense_id", confirmedIds);
  if (!charges?.length) return result;

  const contexts = await buildContexts(admin, charges);

  for (const ctx of contexts) {
    result.candidates += 1;
    const days = differenceInCalendarDays(parseISO(ctx.dueDate), today);

    let kind: string | null = null;
    if (days >= 0 && (PRE_DUE_DAYS as readonly number[]).includes(days)) {
      kind = `d${days}`;
    } else if (days < 0) {
      kind = `overdue:${todayStr}`;
    }
    if (!kind) continue;
    result.due += 1;

    if (await alreadySent(admin, ctx.chargeId, kind)) {
      result.alreadySent += 1;
      continue;
    }
    if (ctx.recipients.length === 0) continue;

    const { subject, html } = reminderContent(ctx, days);
    let delivered = false;
    for (const r of ctx.recipients) {
      if (await send(r.email, subject, html)) {
        result.emailsSent += 1;
        delivered = true;
      } else {
        result.emailsFailed += 1;
      }
    }
    if (delivered) await recordSent(admin, ctx.chargeId, kind);
  }

  console.log(`[cron] reminders ${todayStr} (Europe/Rome): ${JSON.stringify(result)}`);
  return result;
}
