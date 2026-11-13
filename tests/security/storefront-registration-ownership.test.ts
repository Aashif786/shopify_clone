import { afterEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@calcart/db";
import { hashToken, login, register } from "@calcart/auth";
import { EmailService, resetEmailService } from "@calcart/email";
import { createIsolatedDatabase } from "../helpers/postgres.js";
import { globalRateLimiter } from "../../apps/web/src/lib/rate-limiter.js";
import { POST as registerRoute } from "../../apps/web/app/api/v1/storefront/[storeSlug]/auth/register/route.js";
import { POST as loginRoute } from "../../apps/web/app/api/v1/storefront/[storeSlug]/auth/login/route.js";
import { POST as verifyRoute } from "../../apps/web/app/api/v1/storefront/[storeSlug]/auth/verify-email/route.js";
import { GET as getCheckoutRoute } from "../../apps/web/app/api/v1/storefront/[storeSlug]/checkout/[checkoutId]/route.js";

declare global {
  var __calcart_web_db: Database | undefined;
}

const PASSWORD = "CustomerPassword123!";

describe("Storefront registration and customer ownership", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  let db: Database;
  const storeSlug = "register-ownership";
  let storeId: string;

  afterEach(async () => {
    globalRateLimiter.reset();
    resetEmailService();
    globalThis.__calcart_web_db = undefined;
    if (close) {
      await close();
      close = undefined;
    }
  });

  async function setup(): Promise<void> {
    globalRateLimiter.reset();
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    db = isolated.database;
    globalThis.__calcart_web_db = db;
    resetEmailService(
      new EmailService({
        mode: "test",
        appUrl: "https://demo.calcart.com",
        fromEmail: "Cal Cart <notifications@calcart.com>",
      }),
    );

    const orgId = generateUuidV7();
    storeId = generateUuidV7();
    await db.query(
      `INSERT INTO organizations (id, name, status) VALUES ($1, 'Register Org', 'ACTIVE')`,
      [orgId],
    );
    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, 'Register Store', $3, 'ACTIVE', 'USD', 'en-US', 'UTC')`,
      [storeId, orgId, storeSlug],
    );
  }

  function postRegister(email: string, headers: Record<string, string> = {}) {
    return registerRoute(
      new Request(`http://localhost/api/v1/storefront/${storeSlug}/auth/register`, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify({
          email,
          password: PASSWORD,
          firstName: "Sam",
          lastName: "Shopper",
        }),
      }),
      { params: Promise.resolve({ storeSlug }) },
    );
  }

  async function acceptedBody(response: Response) {
    const json = (await response.json()) as {
      success?: boolean;
      data?: { status?: string; user?: unknown; customer?: unknown };
    };
    return {
      status: response.status,
      cookie: response.headers.get("set-cookie"),
      success: json.success,
      registrationStatus: json.data?.status,
      user: json.data?.user,
      customer: json.data?.customer,
    };
  }

  async function seedGuestCustomer(email: string): Promise<{ customerId: string; token: string; checkoutId: string }> {
    const customerId = generateUuidV7();
    const cartId = generateUuidV7();
    const checkoutId = generateUuidV7();
    const token = `guest-${customerId}`;
    await db.query(
      `INSERT INTO customers (id, store_id, email, first_name, last_name)
       VALUES ($1, $2, $3, 'Guest', 'Shopper')`,
      [customerId, storeId, email],
    );
    await db.query(
      `INSERT INTO carts (id, store_id, customer_id, status, currency) VALUES ($1, $2, $3, 'ACTIVE', 'USD')`,
      [cartId, storeId, customerId],
    );
    await db.query(
      `INSERT INTO checkouts (
         id, store_id, cart_id, customer_id, email, status, currency,
         subtotal, total, guest_token_hash
       ) VALUES ($1, $2, $3, $4, $5, 'OPEN', 'USD', 1000, 1000, $6)`,
      [checkoutId, storeId, cartId, customerId, email, hashToken(token)],
    );
    await db.query(
      `INSERT INTO orders (
         id, store_id, customer_id, checkout_id, order_number, status, payment_status,
         fulfillment_status, currency, subtotal, discount_total, shipping_total,
         tax_total, grand_total
       ) VALUES ($1, $2, $3, $4, $5, 'CONFIRMED', 'PAID', 'UNFULFILLED', 'USD', 1000, 0, 0, 0, 1000)`,
      [generateUuidV7(), storeId, customerId, checkoutId, `ORD-${checkoutId.slice(0, 8)}`],
    );
    return { customerId, token, checkoutId };
  }

  it("registers a new shopper without a session and leaves the email unverified", async () => {
    await setup();
    const response = await postRegister("new-shopper@example.com");
    const body = await acceptedBody(response);

    expect(body.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.registrationStatus).toBe("accepted");
    expect(body.cookie).toBeNull();
    expect(body.user).toBeUndefined();
    expect(body.customer).toBeUndefined();

    const user = await db.query<{ email_verified_at: Date | null }>(
      `SELECT email_verified_at FROM users WHERE email = $1`,
      ["new-shopper@example.com"],
    );
    expect(user.rows).toHaveLength(1);
    expect(user.rows[0]?.email_verified_at).toBeNull();

    const customer = await db.query<{ user_id: string | null }>(
      `SELECT user_id FROM customers WHERE store_id = $1 AND email = $2`,
      [storeId, "new-shopper@example.com"],
    );
    expect(customer.rows[0]?.user_id).not.toBeNull();
  });

  it("does not authenticate an existing account when the same email registers again", async () => {
    await setup();
    const first = await acceptedBody(await postRegister("existing-shopper@example.com"));
    const second = await acceptedBody(await postRegister("existing-shopper@example.com", {
      "x-forwarded-for": "203.0.113.10",
    }));

    expect(second).toEqual(first);
    const users = await db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM users WHERE email = $1`,
      ["existing-shopper@example.com"],
    );
    expect(Number(users.rows[0]?.count)).toBe(1);

    const sprayed = await loginRoute(
      new Request(`http://localhost/api/v1/storefront/${storeSlug}/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "existing-shopper@example.com", password: "WrongPassword123!" }),
      }),
      { params: Promise.resolve({ storeSlug }) },
    );
    expect(sprayed.status).toBe(401);

    const real = await loginRoute(
      new Request(`http://localhost/api/v1/storefront/${storeSlug}/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "existing-shopper@example.com", password: PASSWORD }),
      }),
      { params: Promise.resolve({ storeSlug }) },
    );
    expect(real.status).toBe(200);
    expect(real.headers.get("set-cookie")).toContain(`sc_${storeSlug}_session=`);
  });

  it("does not link a guest customer until the email verification token is used once", async () => {
    await setup();
    const guest = await seedGuestCustomer("guest-shopper@example.com");
    const response = await postRegister("guest-shopper@example.com");
    expect(response.status).toBe(201);

    const before = await db.query<{ user_id: string | null }>(
      `SELECT user_id FROM customers WHERE id = $1`,
      [guest.customerId],
    );
    expect(before.rows[0]?.user_id).toBeNull();

    const guestCheckout = await getCheckoutRoute(
      new Request(`http://localhost/api/v1/storefront/${storeSlug}/checkout/${guest.checkoutId}`, {
        headers: { "x-guest-token": guest.token },
      }),
      { params: Promise.resolve({ storeSlug, checkoutId: guest.checkoutId }) },
    );
    expect(guestCheckout.status).toBe(200);

    const emailService = (await import("@calcart/email")).getEmailService();
    const verification = emailService
      .getCapturedEmails()
      .find((message) => message.templateName === "customer_email_verification");
    const tokenMatch = verification?.html.match(/token=([^"&]+)/);
    expect(tokenMatch?.[1]).toBeTruthy();
    const token = decodeURIComponent(tokenMatch?.[1] ?? "");

    const verified = await verifyRoute(
      new Request(`http://localhost/api/v1/storefront/${storeSlug}/auth/verify-email`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      }),
      { params: Promise.resolve({ storeSlug }) },
    );
    expect(verified.status).toBe(200);

    const after = await db.query<{ user_id: string | null }>(
      `SELECT user_id FROM customers WHERE id = $1`,
      [guest.customerId],
    );
    expect(after.rows[0]?.user_id).not.toBeNull();

    const replay = await verifyRoute(
      new Request(`http://localhost/api/v1/storefront/${storeSlug}/auth/verify-email`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      }),
      { params: Promise.resolve({ storeSlug }) },
    );
    expect(replay.status).toBe(401);
  });

  it("does not overwrite a customer already linked to another user", async () => {
    await setup();
    const owner = await register(db, {
      email: "linked-owner@example.com",
      password: PASSWORD,
      name: "Linked Owner",
    });
    const customerId = generateUuidV7();
    const cartId = generateUuidV7();
    const checkoutId = generateUuidV7();
    await db.query(
      `INSERT INTO customers (id, store_id, user_id, email, first_name)
       VALUES ($1, $2, $3, 'claimant@example.com', 'Owner')`,
      [customerId, storeId, owner.user.id],
    );
    await db.query(
      `INSERT INTO carts (id, store_id, status, currency) VALUES ($1, $2, 'ACTIVE', 'USD')`,
      [cartId, storeId],
    );
    await db.query(
      `INSERT INTO checkouts (
         id, store_id, cart_id, customer_id, email, status, currency, subtotal, total
       ) VALUES ($1, $2, $3, $4, 'claimant@example.com', 'OPEN', 'USD', 2500, 2500)`,
      [checkoutId, storeId, cartId, customerId],
    );
    await db.query(
      `INSERT INTO orders (
         id, store_id, customer_id, checkout_id, order_number, status, payment_status,
         fulfillment_status, currency, subtotal, discount_total, shipping_total,
         tax_total, grand_total
       ) VALUES ($1, $2, $3, $4, $5, 'CONFIRMED', 'PAID', 'UNFULFILLED', 'USD', 2500, 0, 0, 0, 2500)`,
      [generateUuidV7(), storeId, customerId, checkoutId, `ORD-${customerId.slice(0, 8)}`],
    );

    expect((await postRegister("claimant@example.com")).status).toBe(201);
    const verification = (await import("@calcart/email"))
      .getEmailService()
      .getCapturedEmails()
      .find((message) => message.templateName === "customer_email_verification");
    const token = decodeURIComponent(verification?.html.match(/token=([^"&]+)/)?.[1] ?? "");
    expect((await verifyRoute(
      new Request(`http://localhost/api/v1/storefront/${storeSlug}/auth/verify-email`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      }),
      { params: Promise.resolve({ storeSlug }) },
    )).status).toBe(200);

    const stillLinked = await db.query<{ user_id: string }>(
      `SELECT user_id FROM customers WHERE id = $1`,
      [customerId],
    );
    expect(stillLinked.rows[0]?.user_id).toBe(owner.user.id);

    const claimantLogin = await login(db, {
      email: "claimant@example.com",
      password: PASSWORD,
    });
    const checkoutResponse = await getCheckoutRoute(
      new Request(`http://localhost/api/v1/storefront/${storeSlug}/checkout/${checkoutId}`, {
        headers: { cookie: `sc_${storeSlug}_session=${claimantLogin.session.id}` },
      }),
      { params: Promise.resolve({ storeSlug, checkoutId }) },
    );
    expect(checkoutResponse.status).toBe(404);
    const body = await checkoutResponse.json();
    expect(JSON.stringify(body)).not.toContain("claimant@example.com");

    const orders = await db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM orders WHERE customer_id = $1 AND store_id = $2`,
      [customerId, storeId],
    );
    expect(Number(orders.rows[0]?.count)).toBe(1);
  });

  it("rate limits registration for an email even when the forwarded IP header changes", async () => {
    await setup();
    const email = "limited-shopper@example.com";

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await postRegister(email, { "x-forwarded-for": "198.51.100.10" });
      expect(response.status).toBe(201);
    }

    const blocked = await postRegister(email, { "x-forwarded-for": "198.51.100.10" });
    expect(blocked.status).toBe(429);

    const rotated = await postRegister(email, {
      "x-forwarded-for": "198.51.100.99",
      "x-real-ip": "203.0.113.50",
    });
    expect(rotated.status).toBe(429);
    const rotatedBody = await rotated.json();
    expect(rotatedBody.error.code).toBe("RATE_LIMIT_EXCEEDED");
  });
});
