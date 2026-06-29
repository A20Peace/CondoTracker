import { NextResponse, type NextRequest } from "next/server";
import { processDailyReminders } from "@/lib/resend/notifications";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/reminders
 * Triggered daily by Vercel Cron (see vercel.json). Protected by CRON_SECRET:
 * Vercel sends it as `Authorization: Bearer <CRON_SECRET>`.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET non configurato" }, { status: 500 });
  }

  const auth = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-cron-secret");
  const authorized = auth === `Bearer ${secret}` || headerSecret === secret;
  if (!authorized) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const startedAt = Date.now();
  console.log("[cron/reminders] avvio", new Date().toISOString());
  if (!process.env.RESEND_API_KEY) {
    console.warn(
      "[cron/reminders] RESEND_API_KEY mancante in questo ambiente: nessuna email verrà inviata",
    );
  }

  try {
    const result = await processDailyReminders();
    const payload = { ok: true, ...result };
    console.log(
      `[cron/reminders] completato in ${Date.now() - startedAt}ms:`,
      JSON.stringify(payload),
    );
    return NextResponse.json(payload);
  } catch (err) {
    console.error("[cron/reminders] esecuzione non riuscita:", err);
    return NextResponse.json({ error: "Esecuzione cron non riuscita" }, { status: 500 });
  }
}
