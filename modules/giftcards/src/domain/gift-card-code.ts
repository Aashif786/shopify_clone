import { createHash, randomBytes } from "node:crypto";

/**
 * 32-character alphabet omitting visually ambiguous characters:
 * Omits: 0 (zero), O (oh), 1 (one), I (eye), L (el)
 */
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/**
 * Normalizes an entered gift card code by removing hyphens, whitespace,
 * and converting to uppercase.
 */
export function normalizeGiftCardCode(code: string): string {
  if (!code || typeof code !== "string") return "";
  return code.replace(/[\s\-_]/g, "").toUpperCase();
}

/**
 * Generates a SHA-256 hash of the normalized code for indexed constant-time lookup.
 */
export function hashGiftCardCode(code: string): string {
  const normalized = normalizeGiftCardCode(code);
  return createHash("sha256").update(normalized).digest("hex");
}

/**
 * Generates a secure, 16-character alphanumeric gift card code.
 * Example: "GC-A7K2-9MNP-4R8X"
 */
export function generateGiftCardCode(): string {
  const bytes = randomBytes(12);
  let raw = "";
  for (let i = 0; i < 12; i++) {
    const byte = bytes[i] ?? 0;
    raw += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  }
  // Format as GC-XXXX-XXXX-XXXX
  return `GC-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

/**
 * Extracts the last 4 characters of a gift card code for safe display.
 */
export function extractCodeLast4(code: string): string {
  const normalized = normalizeGiftCardCode(code);
  return normalized.length >= 4 ? normalized.slice(-4) : normalized;
}

/**
 * Masks a gift card code, exposing only the last 4 characters.
 * Example: "••••-••••-••••-9P8X"
 */
export function maskGiftCardCode(code: string): string {
  const last4 = extractCodeLast4(code);
  return `••••-••••-••••-${last4}`;
}
