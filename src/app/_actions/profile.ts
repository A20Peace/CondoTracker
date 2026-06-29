"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

const profileSchema = z.object({
  display_name: z.string().trim().min(1, "Inserisci un nome").max(80),
  reminder_email: z
    .string()
    .trim()
    .max(160)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || z.string().email().safeParse(v).success, {
      message: "Email promemoria non valida",
    }),
  email_reminders: z.boolean(),
});

export type ProfileInput = z.input<typeof profileSchema>;

/** Updates the current user's profile (name, reminder email, reminders toggle). */
export async function updateProfile(input: ProfileInput): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessione non valida" };

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.display_name,
      reminder_email: parsed.data.reminder_email,
      email_reminders: parsed.data.email_reminders,
    })
    .eq("id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/profile");
  revalidatePath("/", "layout");
  return { ok: true };
}
