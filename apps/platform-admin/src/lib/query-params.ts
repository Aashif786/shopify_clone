/**
 * Safely parses integer query parameters, handling undefined, null, non-numeric strings,
 * and clamping the result within [min, max] boundaries.
 */
export function parseIntParam(
  raw: string | null | undefined,
  fallback: number,
  min?: number,
  max?: number,
): number {
  if (raw === null || raw === undefined || raw.trim() === "") {
    return fallback;
  }
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  let clamped = parsed;
  if (min !== undefined && clamped < min) {
    clamped = min;
  }
  if (max !== undefined && clamped > max) {
    clamped = max;
  }
  return clamped;
}

/**
 * Extracts client IP and user-agent from standard HTTP headers.
 */
export function extractClientMetadata(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  const ipAddress =
    (forwarded ? forwarded.split(",")[0]?.trim() : null) ||
    req.headers.get("x-real-ip") ||
    null;
  const userAgent = req.headers.get("user-agent") || null;
  return { ipAddress, userAgent };
}
