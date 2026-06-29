import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { SupportedMediaType } from "@/lib/claude/parser";

export const DOCUMENTS_BUCKET = "documents";

const EXT: Record<SupportedMediaType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

type Client = SupabaseClient<Database>;

/**
 * Uploads an expense document to `documents/{adminId}/{uuid}.{ext}`.
 * Files are scoped to the admin's folder (RLS allows only the owner to write).
 */
export async function uploadDocument(
  supabase: Client,
  adminId: string,
  file: { bytes: ArrayBuffer; mediaType: SupportedMediaType },
): Promise<string> {
  const path = `${adminId}/${crypto.randomUUID()}.${EXT[file.mediaType]}`;
  const { error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, file.bytes, { contentType: file.mediaType, upsert: false });
  if (error) throw new Error(`Upload non riuscito: ${error.message}`);
  return path;
}

/** Short-lived signed URL for a private document (bucket is not public). */
export async function getSignedUrl(
  supabase: Client,
  path: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const { data } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  return data?.signedUrl ?? null;
}

/** Removes every document stored under an admin's folder (GDPR deletion). */
export async function deleteAllUserDocuments(
  supabase: Client,
  adminId: string,
): Promise<void> {
  const { data: list } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .list(adminId, { limit: 1000 });
  if (!list?.length) return;
  const paths = list.map((f) => `${adminId}/${f.name}`);
  await supabase.storage.from(DOCUMENTS_BUCKET).remove(paths);
}
