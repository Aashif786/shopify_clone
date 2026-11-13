/**
 * Trusted remote image origins for the storefront.
 *
 * Merchant uploads are served first-party (`/api/v1/stores/<id>/uploads/...`) and are
 * covered by `'self'`. Images that are *linked* from elsewhere (a CDN, an object store,
 * an imported catalogue) are only allowed when their origin is on this list; otherwise
 * the browser's Content Security Policy blocks them and only the alt text shows.
 *
 * Deployments add their image CDN/object-store origins through the
 * `STOREFRONT_IMAGE_ORIGINS` environment variable (comma separated), for example
 * `https://cdn.shopify.com,https://*.s3.ap-south-1.amazonaws.com`.
 *
 * Only `https:` origins with a concrete host (optionally one leading `*.` label) are
 * accepted. Bare wildcards, `http:`, paths and `data:`/`blob:` are rejected, so this
 * cannot be used to widen `img-src` to `*`.
 */

/** Built-in origins the platform already trusted before this setting existed. */
export const DEFAULT_IMAGE_ORIGINS: readonly string[] = [
  "https://images.unsplash.com",
  "https://images.pexels.com",
  "https://cdn.example.com",
];

const HOST_LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

/** Normalises one entry to `https://host` / `https://*.host`, or returns null if unsafe. */
export function normalizeImageOrigin(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  let wildcard = false;
  let candidate = value;
  if (/^https:\/\/\*\./i.test(candidate)) {
    wildcard = true;
    candidate = candidate.replace(/^https:\/\/\*\./i, "https://");
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }

  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (url.pathname !== "/" || url.search || url.hash) return null;

  const host = url.hostname.toLowerCase();
  const labels = host.split(".");
  // A real registrable name: at least two labels, every label well formed.
  if (labels.length < 2 || !labels.every((label) => HOST_LABEL.test(label))) return null;

  const port = url.port ? `:${url.port}` : "";
  return `https://${wildcard ? "*." : ""}${host}${port}`;
}

/** Parses a comma separated list, dropping (and reporting) anything unsafe. */
export function parseImageOrigins(
  value: string | undefined,
  onRejected?: (entry: string) => void,
): string[] {
  if (!value) return [];
  const accepted: string[] = [];
  for (const entry of value.split(",")) {
    if (!entry.trim()) continue;
    const normalized = normalizeImageOrigin(entry);
    if (normalized) {
      accepted.push(normalized);
    } else {
      onRejected?.(entry.trim());
    }
  }
  return accepted;
}

/** Defaults plus configured origins, de-duplicated, in a stable order. */
export function getImageOrigins(
  env: Record<string, string | undefined> = process.env,
): string[] {
  const configured = parseImageOrigins(env.STOREFRONT_IMAGE_ORIGINS, (entry) => {
    console.warn(
      `[image-origins] Ignoring invalid STOREFRONT_IMAGE_ORIGINS entry "${entry}" (must be an https origin, optionally with a leading *. label).`,
    );
  });
  return Array.from(new Set([...DEFAULT_IMAGE_ORIGINS, ...configured]));
}

/** Converts origins to next/image `remotePatterns` entries. */
export function toRemotePatterns(
  origins: readonly string[],
): Array<{ protocol: "https"; hostname: string; port?: string }> {
  return origins.map((origin) => {
    const url = new URL(origin.replace("https://*.", "https://wildcard."));
    const wildcard = origin.startsWith("https://*.");
    return {
      protocol: "https" as const,
      hostname: wildcard ? `*.${url.hostname.replace(/^wildcard\./, "")}` : url.hostname,
      ...(url.port ? { port: url.port } : {}),
    };
  });
}
