import { randomBytes } from "node:crypto";

const UUID_V7_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

let lastTimestampMs = -1;
let lastSequence = 0;

function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

function formatUuid(bytes: Uint8Array): string {
  const hex = toHex(bytes);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Generates an application-side RFC 9562 UUIDv7.
 * IDs are created before INSERT and stored as PostgreSQL native UUID values.
 */
export function generateUuidV7(nowMs: number = Date.now()): string {
  let timestampMs = nowMs;
  if (timestampMs < 0) {
    throw new Error("UUIDv7 timestamp must be non-negative");
  }

  if (timestampMs === lastTimestampMs) {
    lastSequence += 1;
    if (lastSequence > 0x0fff) {
      timestampMs += 1;
      lastTimestampMs = timestampMs;
      lastSequence = 0;
    }
  } else {
    lastTimestampMs = timestampMs;
    lastSequence = 0;
  }

  const bytes = randomBytes(16);
  const timestamp = BigInt(timestampMs);

  bytes[0] = Number((timestamp >> 40n) & 0xffn);
  bytes[1] = Number((timestamp >> 32n) & 0xffn);
  bytes[2] = Number((timestamp >> 24n) & 0xffn);
  bytes[3] = Number((timestamp >> 16n) & 0xffn);
  bytes[4] = Number((timestamp >> 8n) & 0xffn);
  bytes[5] = Number(timestamp & 0xffn);

  const randA = lastSequence;
  bytes[6] = 0x70 | ((randA >> 8) & 0x0f);
  bytes[7] = randA & 0xff;

  const variantByte = bytes[8];
  if (variantByte === undefined) {
    throw new Error("UUIDv7 entropy is incomplete");
  }
  bytes[8] = (variantByte & 0x3f) | 0x80;

  return formatUuid(bytes);
}

export function isUuidV7(value: string): boolean {
  return UUID_V7_REGEX.test(value);
}

export function uuidV7Version(value: string): number {
  if (!UUID_V7_REGEX.test(value)) {
    throw new Error("Value is not a UUIDv7");
  }
  return 7;
}

export function uuidV7Variant(value: string): "rfc4122" {
  if (!UUID_V7_REGEX.test(value)) {
    throw new Error("Value is not a UUIDv7");
  }
  return "rfc4122";
}
