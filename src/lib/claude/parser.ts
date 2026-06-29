import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { ParsedDocument } from "@/types";

/** Media types we forward to Claude for extraction. */
export const SUPPORTED_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;
export type SupportedMediaType = (typeof SUPPORTED_MEDIA_TYPES)[number];

export function isSupportedMediaType(t: string): t is SupportedMediaType {
  return (SUPPORTED_MEDIA_TYPES as readonly string[]).includes(t);
}

const MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `Sei un assistente che estrae dati strutturati da documenti giustificativi di spese condominiali italiane (fatture, bollette, ricevute, preventivi di fornitori).
Analizza il documento e restituisci SOLO un oggetto JSON valido con questi campi:
{
  "title": "descrizione breve della spesa (es. 'Manutenzione ascensore - giugno 2025')",
  "amount": 1234.56,
  "due_date": "YYYY-MM-DD",
  "issuer": "nome del fornitore/azienda che emette il documento",
  "confidence": 0.95
}
"amount" è l'importo TOTALE del documento (IVA inclusa). Se un campo non è rilevabile, usa null. Non aggiungere testo fuori dal JSON.`;

/** Coerce "1.234,56" / "1234.56" / number → a JS number, or null. */
function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  // Italian formatting: dots = thousands, comma = decimals.
  const cleaned = value
    .replace(/[€\s]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

const responseSchema = z.object({
  title: z.string().trim().min(1).nullable().catch(null),
  amount: z.unknown().transform(toNumber).catch(null),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .catch(null),
  issuer: z.string().trim().min(1).nullable().catch(null),
  confidence: z.number().min(0).max(1).nullable().catch(null),
});

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY non configurata");
  return new Anthropic({ apiKey });
}

/** Pull the first balanced JSON object out of the model's text output. */
function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("Risposta del modello priva di JSON");
  }
  return JSON.parse(text.slice(start, end + 1));
}

/**
 * Sends a document (image or PDF, base64) to Claude and returns the extracted,
 * validated fields. Never logs the document contents.
 */
export async function parseDocument(args: {
  base64: string;
  mediaType: SupportedMediaType;
}): Promise<ParsedDocument> {
  const { base64, mediaType } = args;

  const documentBlock =
    mediaType === "application/pdf"
      ? ({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: base64 },
        } as const)
      : ({
          type: "image",
          source: { type: "base64", media_type: mediaType, data: base64 },
        } as const);

  const message = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          documentBlock,
          {
            type: "text",
            text: "Estrai i dati della spesa da questo documento e restituisci solo il JSON.",
          },
        ],
      },
    ],
  });

  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  const json = extractJson(text);
  const parsed = responseSchema.parse(json);

  return {
    title: parsed.title,
    amount: parsed.amount,
    due_date: parsed.due_date,
    issuer: parsed.issuer,
    confidence: parsed.confidence,
  };
}
