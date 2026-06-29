import { NextResponse, type NextRequest } from "next/server";
import { getApiUser } from "@/lib/auth";
import { parseDocument, isSupportedMediaType } from "@/lib/claude/parser";
import { uploadDocument, getSignedUrl } from "@/lib/supabase/storage";
import type { ApiError, ParseResponse } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * POST /api/expenses/parse
 * multipart/form-data { file } → uploads the document, extracts fields with
 * Claude, and returns them for user confirmation before saving the expense.
 */
export async function POST(request: NextRequest) {
  const { supabase, user } = await getApiUser();
  if (!user) {
    return NextResponse.json<ApiError>({ error: "Non autenticato" }, { status: 401 });
  }

  // Parsing requires an Anthropic key. Without it, the UI uses manual entry.
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json<ApiError>(
      {
        error: "Analisi automatica non disponibile. Inserisci i dati manualmente.",
        code: "parsing_disabled",
      },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json<ApiError>(
      { error: "Richiesta non valida (atteso multipart/form-data)" },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json<ApiError>({ error: "Nessun file ricevuto" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json<ApiError>(
      { error: "Il file supera la dimensione massima di 10MB" },
      { status: 413 },
    );
  }

  const mediaType = file.type;
  if (!isSupportedMediaType(mediaType)) {
    return NextResponse.json<ApiError>(
      { error: "Formato non supportato. Usa JPEG, PNG, WEBP o PDF." },
      { status: 415 },
    );
  }

  try {
    const bytes = await file.arrayBuffer();

    // 1) Persist the original document under the admin's folder.
    const path = await uploadDocument(supabase, user.id, { bytes, mediaType });

    // 2) Extract structured fields. (Document contents are never logged.)
    const base64 = Buffer.from(bytes).toString("base64");
    const parsed = await parseDocument({ base64, mediaType });

    // 3) Return a short-lived signed URL for the preview + the storage path.
    const signedUrl = await getSignedUrl(supabase, path);

    return NextResponse.json<ParseResponse>({
      parsed,
      documentUrl: signedUrl ?? "",
      documentPath: path,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore durante l'analisi";
    console.error("[expenses/parse] parsing failed:", message);
    return NextResponse.json<ApiError>(
      { error: "Impossibile analizzare il documento. Riprova o inserisci i dati manualmente." },
      { status: 502 },
    );
  }
}
