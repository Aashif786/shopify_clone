import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@calcart/db";
import { serializeCustomerSessionCookie } from "@calcart/auth";
import { CustomerService } from "@calcart/customers";
import { createIsolatedDatabase } from "../helpers/postgres.js";

import { GET as getProfile } from "../../apps/web/app/api/v1/storefront/[storeSlug]/account/profile/route.js";
import { GET as getMe } from "../../apps/web/app/api/v1/storefront/[storeSlug]/auth/me/route.js";

declare global {
  var __calcart_web_db: unknown;
}

/**
 * Bug D: the checkout page requested the protected account/profile route for every
 * visitor, so every guest checkout logged a 401. The route is correct to refuse
 * unauthenticated callers; the guest-safe route is auth/me. These tests pin both
 * behaviours, plus session expiry, revocation and store isolation.
 */
describe("Storefront customer profile and session handling", { timeout: 60_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  let db: Database;
  const customerService = new CustomerService();

  beforeEach(async () => {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    db = isolated.database;
    global.__calcart_web_db = isolated.database;
  });

  afterEach(async () => {
    global.__calcart_web_db = undefined;
    if (close) {
      await close();
      close = undefined;
    }
  });

  async function createStore(slug: string) {
    const orgId = generateUuidV7();
    const storeId = generateUuidV7();
    await db.query(`INSERT INTO organizations (id, name, status) VALUES ($1, $2, 'ACTIVE')`, [
      orgId,
      `Org ${slug}`,
    ]);
    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, $3, $4, 'ACTIVE', 'USD', 'en-US', 'UTC')`,
      [storeId, orgId, `Store ${slug}`, slug],
    );
    return { storeId, slug };
  }

  async function createCustomerSession(
    storeId: string,
    slug: string,
    options: { expiresAt?: Date; revoked?: boolean } = {},
  ) {
    const userId = generateUuidV7();
    const sessionId = generateUuidV7();
    const email = `buyer-${userId.slice(-8)}@example.com`;
    await db.query(
      `INSERT INTO users (id, email, name, password_hash, status)
       VALUES ($1, $2, 'Casey Buyer', 'scrypt:hash', 'ACTIVE')`,
      [userId, email],
    );
    const expiresAt = options.expiresAt ?? new Date(Date.now() + 86_400_000);
    await db.query(
      `INSERT INTO sessions (id, user_id, expires_at, revoked_at) VALUES ($1, $2, $3, $4)`,
      [sessionId, userId, expiresAt, options.revoked ? new Date() : null],
    );
    await customerService.resolveStoreCustomerForUser(db, storeId, {
      userId,
      email,
      firstName: "Casey",
      lastName: "Buyer",
      emailVerified: true,
    });
    // Same cookie the real login route sets for the store.
    const cookie = serializeCustomerSessionCookie(sessionId, slug, { expires: expiresAt }).split(";")[0]!;
    return { cookie, email, userId };
  }

  const ctx = (slug: string) => ({ params: Promise.resolve({ storeSlug: slug }) });
  const profileUrl = (slug: string) => `https://app.test/api/v1/storefront/${slug}/account/profile`;
  const meUrl = (slug: string) => `https://app.test/api/v1/storefront/${slug}/auth/me`;
  const withCookie = (url: string, cookie?: string) =>
    new Request(url, { headers: cookie ? { cookie } : {} });

  it("returns the profile for a valid store-scoped customer session", async () => {
    const { storeId, slug } = await createStore("souled-store");
    const { cookie, email } = await createCustomerSession(storeId, slug);

    const res = await getProfile(withCookie(profileUrl(slug), cookie), ctx(slug));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { customer: { email: string; storeId: string } } };
    expect(body.data.customer.email).toBe(email);
    expect(body.data.customer.storeId).toBe(storeId);
  });

  it("answers 401 to a genuinely unauthenticated caller (the endpoint is not public)", async () => {
    const { slug } = await createStore("souled-store");
    const res = await getProfile(withCookie(profileUrl(slug)), ctx(slug));
    expect(res.status).toBe(401);
  });

  it("rejects an expired session", async () => {
    const { storeId, slug } = await createStore("souled-store");
    const { cookie } = await createCustomerSession(storeId, slug, {
      expiresAt: new Date(Date.now() - 60_000),
    });
    const res = await getProfile(withCookie(profileUrl(slug), cookie), ctx(slug));
    expect(res.status).toBe(401);
  });

  it("rejects a revoked session", async () => {
    const { storeId, slug } = await createStore("souled-store");
    const { cookie } = await createCustomerSession(storeId, slug, { revoked: true });
    const res = await getProfile(withCookie(profileUrl(slug), cookie), ctx(slug));
    expect(res.status).toBe(401);
  });

  it("does not accept one store's session cookie on another store", async () => {
    const a = await createStore("store-a");
    const b = await createStore("store-b");
    const { cookie } = await createCustomerSession(a.storeId, a.slug);

    const res = await getProfile(withCookie(profileUrl(b.slug), cookie), ctx(b.slug));
    expect(res.status).toBe(401);
  });

  it("does not expose a customer from another store even with the generic customer cookie", async () => {
    const a = await createStore("store-a");
    const b = await createStore("store-b");
    const { userId } = await createCustomerSession(a.storeId, a.slug);
    const sessionId = generateUuidV7();
    await db.query(`INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)`, [
      sessionId,
      userId,
      new Date(Date.now() + 86_400_000),
    ]);
    const generic = serializeCustomerSessionCookie(sessionId).split(";")[0]!;

    const res = await getProfile(withCookie(profileUrl(b.slug), generic), ctx(b.slug));
    // Authenticated as a user, but that user has no customer record in store B.
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain("buyer-");
  });

  it("auth/me (used by guest checkout) answers 200 with no customer for a guest, not 401", async () => {
    const { slug } = await createStore("souled-store");
    const res = await getMe(withCookie(meUrl(slug)), ctx(slug));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { customer: unknown; user: unknown } };
    expect(body.data.customer).toBeNull();
    expect(body.data.user).toBeNull();
  });

  it("auth/me returns the saved-address customer for a signed-in session", async () => {
    const { storeId, slug } = await createStore("souled-store");
    const { cookie, email } = await createCustomerSession(storeId, slug);
    const res = await getMe(withCookie(meUrl(slug), cookie), ctx(slug));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { customer: { email: string; addresses: unknown[] } } };
    expect(body.data.customer.email).toBe(email);
    expect(Array.isArray(body.data.customer.addresses)).toBe(true);
  });
});
