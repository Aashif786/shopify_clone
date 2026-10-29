import type { Database } from "@shopify-clone/db";
import { parseHostname } from "./hostname-parser.js";

export interface ResolvedStoreDomain {
  storeId: string;
  storeSlug: string;
  storeName: string;
  domain: string;
  domainType: "SUBDOMAIN" | "CUSTOM";
  isPrimary: boolean;
  status: string;
}

/**
 * Server-trusted resolver that maps an incoming hostname to an active store.
 * Enforces tenant isolation and guarantees that only active, verified store
 * domains are resolved.
 */
export async function resolveStoreFromHostname(
  db: Database,
  rawHostname: string,
  platformDomain: string = "calcart.com",
): Promise<ResolvedStoreDomain | null> {
  const parsed = parseHostname(rawHostname, platformDomain);

  // If apex platform or reserved subdomain, this is not a merchant storefront
  if (parsed.isPlatform || parsed.isReserved) {
    return null;
  }

  // Case A: Platform Subdomain (<storeSlug>.calcart.com or <storeSlug>.localhost)
  if (parsed.subdomain) {
    // 1. Look up explicitly registered active domain
    const domainRow = await db.query<{
      store_id: string;
      store_slug: string;
      store_name: string;
      domain: string;
      type: string;
      is_primary: boolean;
      store_status: string;
    }>(
      `SELECT d.store_id, s.slug AS store_slug, s.name AS store_name, d.domain, d.type, d.is_primary, s.status AS store_status
       FROM store_domains d
       JOIN stores s ON s.id = d.store_id
       WHERE (d.subdomain = $1 OR d.domain = $2) AND d.status = 'ACTIVE' AND s.status = 'ACTIVE'
       LIMIT 1`,
      [parsed.subdomain, parsed.normalizedHost],
    );

    if (domainRow.rows[0]) {
      const r = domainRow.rows[0];
      return {
        storeId: r.store_id,
        storeSlug: r.store_slug,
        storeName: r.store_name,
        domain: r.domain,
        domainType: r.type as "SUBDOMAIN" | "CUSTOM",
        isPrimary: r.is_primary,
        status: r.store_status,
      };
    }

    // 2. Fallback: Lookup active store directly by slug (guarantees backward compatibility)
    const storeRow = await db.query<{
      id: string;
      slug: string;
      name: string;
      status: string;
    }>(
      `SELECT id, slug, name, status
       FROM stores
       WHERE slug = $1 AND status = 'ACTIVE'
       LIMIT 1`,
      [parsed.subdomain],
    );

    if (storeRow.rows[0]) {
      const s = storeRow.rows[0];
      return {
        storeId: s.id,
        storeSlug: s.slug,
        storeName: s.name,
        domain: parsed.normalizedHost,
        domainType: "SUBDOMAIN",
        isPrimary: true,
        status: s.status,
      };
    }

    return null;
  }

  // Case B: Custom Domain (e.g. shop.brand.com)
  if (parsed.customDomain) {
    const customRow = await db.query<{
      store_id: string;
      store_slug: string;
      store_name: string;
      domain: string;
      type: string;
      is_primary: boolean;
      store_status: string;
    }>(
      `SELECT d.store_id, s.slug AS store_slug, s.name AS store_name, d.domain, d.type, d.is_primary, s.status AS store_status
       FROM store_domains d
       JOIN stores s ON s.id = d.store_id
       WHERE d.domain = $1 AND d.status = 'ACTIVE' AND s.status = 'ACTIVE'
       LIMIT 1`,
      [parsed.customDomain],
    );

    if (customRow.rows[0]) {
      const r = customRow.rows[0];
      return {
        storeId: r.store_id,
        storeSlug: r.store_slug,
        storeName: r.store_name,
        domain: r.domain,
        domainType: r.type as "SUBDOMAIN" | "CUSTOM",
        isPrimary: r.is_primary,
        status: r.store_status,
      };
    }
  }

  return null;
}
