/**
 * EPC QR code (a.k.a. "SEPA QR" / GiroCode) payload builder.
 *
 * Italian banking apps can scan this to pre-fill a SEPA Credit Transfer
 * (bonifico). Format per the EPC069-12 specification ("BCD" service tag).
 * CondoTracker only *generates* the code — it never moves money.
 *
 * The whole payload must stay within 331 bytes (UTF-8).
 */
import { normalizeIban } from "@/lib/utils";

/** Remove line breaks and collapse whitespace; trim to a max length. */
function clean(value: string, max: number): string {
  return value.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

/** Amount formatted as the EPC field requires, e.g. 12.5 → "EUR12.50". */
export function formatSepaAmount(amount: number): string {
  return `EUR${amount.toFixed(2)}`;
}

export interface EpcQrInput {
  /** Beneficiary IBAN (condominio account). */
  iban: string;
  /** Beneficiary name (intestatario del conto), max 70 chars. */
  name: string;
  /** Amount in EUR (0.01–999999999.99). */
  amount: number;
  /** Unstructured remittance / causale, max 140 chars. */
  remittance: string;
  /** Optional BIC; omittable with version 002. */
  bic?: string | null;
}

/**
 * Builds the EPC QR text payload. Returns null when the required fields are
 * missing or the amount is out of the SEPA range, so callers can hide the QR.
 */
export function buildEpcQrPayload(input: EpcQrInput): string | null {
  const iban = normalizeIban(input.iban ?? "");
  const name = clean(input.name ?? "", 70);
  if (!iban || !name) return null;
  if (!(input.amount > 0) || input.amount > 999999999.99) return null;

  const lines = [
    "BCD", // Service Tag
    "002", // Version (002 → BIC optional)
    "1", // Character set: 1 = UTF-8
    "SCT", // SEPA Credit Transfer
    clean(input.bic ?? "", 11), // BIC (optional)
    name, // Beneficiary name
    iban, // Beneficiary IBAN
    formatSepaAmount(input.amount), // Amount
    "", // Purpose (optional)
    "", // Structured remittance (optional)
    clean(input.remittance ?? "", 140), // Unstructured remittance (causale)
  ];

  // Trim trailing empty fields (the unstructured remittance is the last we use).
  return lines.join("\n");
}

/**
 * Standard causale for a condominio charge. Kept short so it survives the
 * 140-char SEPA limit even with long names.
 */
export function buildCausale(args: {
  buildingName: string;
  unitLabel: string;
  expenseTitle: string;
}): string {
  return clean(
    `Quota condominiale ${args.buildingName} - ${args.unitLabel} - ${args.expenseTitle}`,
    140,
  );
}
