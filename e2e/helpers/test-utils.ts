import crypto from "node:crypto";
import { type Page, expect } from "@playwright/test";
import { createDatabase, type Database } from "../../packages/db/src/index.js";

let cachedDb: Database | null = null;

export function getTestDb(): Database {
  if (!cachedDb) {
    const url =
      process.env.DATABASE_URL?.trim() ||
      "postgresql://postgres:postgres@localhost:5433/shopify_clone_dev";
    cachedDb = createDatabase({ url });
  }
  return cachedDb;
}

export async function closeTestDb(): Promise<void> {
  if (cachedDb) {
    await cachedDb.close();
    cachedDb = null;
  }
}

/**
 * Generate unique email for deterministic test isolation.
 */
export function uniqueEmail(prefix = "user"): string {
  const nonce = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  return `${prefix}_${nonce}@example.com`;
}

/**
 * Generate unique slug for deterministic test isolation.
 */
export function uniqueSlug(prefix = "store"): string {
  const nonce = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  return `${prefix}-${nonce}`;
}

/**
 * Computes a valid HMAC-SHA256 Razorpay signature.
 */
export function computeRazorpaySignature(
  orderId: string,
  paymentId: string,
  secret?: string,
): string {
  const resolvedSecret = secret || process.env.RAZORPAY_KEY_SECRET?.trim() || "test_secret_for_playwright_e2e";
  return crypto
    .createHmac("sha256", resolvedSecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
}

/**
 * Mocks the client-side Razorpay SDK on the page so that checkout can proceed
 * without relying on Razorpay's live external CDN or test servers.
 */
export async function setupRazorpayMock(
  page: Page,
  options?: { shouldFail?: boolean },
): Promise<void> {
  // Expose cryptographic signature calculation function to the browser
  await page.exposeFunction("__computeRazorpaySignature", (orderId: string, paymentId: string) => {
    return computeRazorpaySignature(orderId, paymentId);
  });

  // 1. Intercept external Razorpay script requests
  await page.route("https://checkout.razorpay.com/v1/checkout.js", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "window.__razorpayScriptLoaded = true;",
    });
  });

  // 2. Inject Razorpay mock constructor before any scripts run
  await page.addInitScript((opts) => {
    interface MockOptions {
      order_id?: string;
      amount?: number;
      currency?: string;
      handler?: (response: {
        razorpay_payment_id: string;
        razorpay_order_id: string;
        razorpay_signature: string;
      }) => void;
      [key: string]: unknown;
    }

    type EventCallback = (data?: unknown) => void;

    class MockRazorpay {
      private options: MockOptions;
      private listeners: Record<string, EventCallback[]> = {};

      constructor(options: MockOptions) {
        this.options = options;
      }

      on(event: string, handler: EventCallback) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(handler);
      }

      open() {
        if (opts.shouldFail) {
          setTimeout(() => {
            if (this.listeners["payment.failed"]) {
              for (const fn of this.listeners["payment.failed"]) {
                fn({ error: { description: "Simulated test payment card decline" } });
              }
            }
          }, 100);
          return;
        }

        const orderId = this.options.order_id || "order_mock";
        const amount = this.options.amount || 0;
        const currency = this.options.currency || "INR";
        const paymentId = `pay_mock_${Date.now()}_${amount}_${currency}_${orderId}`;

        // Dispatch success callback with real HMAC signature
        setTimeout(async () => {
          if (typeof this.options.handler === "function") {
            let signature = "mock_valid_sig";
            const win = window as unknown as {
              __computeRazorpaySignature?: (o: string, p: string) => Promise<string>;
              Razorpay?: unknown;
            };
            if (typeof win.__computeRazorpaySignature === "function") {
              try {
                signature = await win.__computeRazorpaySignature(orderId, paymentId);
              } catch (e) {
                console.error("Failed to compute signature:", e);
              }
            }

            this.options.handler({
              razorpay_payment_id: paymentId,
              razorpay_order_id: orderId,
              razorpay_signature: signature,
            });
          }
        }, 150);
      }
    }

    (window as unknown as { Razorpay?: unknown }).Razorpay = MockRazorpay;
  }, { shouldFail: Boolean(options?.shouldFail) });
}

/**
 * Registers a new merchant through /merchant/register and asserts redirection to onboarding.
 */
export async function registerMerchant(
  page: Page,
  user: { name: string; email: string; password?: string },
): Promise<void> {
  const password = user.password || "SecureTestPassword123!";
  await page.goto("/merchant/register");
  await page.waitForLoadState("domcontentloaded");

  await page.fill('input[name="name"]', user.name);
  await page.fill('input[name="email"]', user.email);
  await page.fill('input[name="password"]', password);
  await page.fill('input[name="confirmPassword"]', password);

  await page.click('button[type="submit"]');

  // Verify redirected to onboarding
  await expect(page).toHaveURL(/\/merchant\/onboarding/, { timeout: 35_000 });
}

/**
 * Completes the 3-step onboarding flow for a merchant.
 */
export async function completeMerchantOnboarding(
  page: Page,
  data: {
    orgName: string;
    storeName: string;
    slug: string;
    currency?: string;
  },
): Promise<void> {
  // Step 1: Organization
  await expect(page.locator("text=1. Create Your Business Organization")).toBeVisible({ timeout: 10_000 });
  await page.fill("#onboarding-org-name", data.orgName);
  await page.click('button:has-text("Continue to Store Setup")');

  // Step 2: Store
  await expect(page.locator("text=2. Set Up Your First Store")).toBeVisible({ timeout: 10_000 });
  await page.fill("#onboarding-store-name", data.storeName);
  const slugInput = page.locator("#onboarding-store-slug");
  await slugInput.fill("");
  await slugInput.fill(data.slug);

  if (data.currency) {
    await page.selectOption("#onboarding-currency", data.currency);
  }
  await page.click('button:has-text("Next: Contact & Info")');

  // Step 3: Contact Details
  await expect(page.locator("text=3. Configure Store Information")).toBeVisible({ timeout: 10_000 });
  await page.click('button:has-text("Complete & Enter Dashboard")');

  // Lands on merchant console
  await expect(page).toHaveURL(/\/merchant$/, { timeout: 15_000 });
  await expect(page.locator(".merchant-banner, h2:has-text('Welcome back')").first()).toBeVisible({ timeout: 15_000 });
}

/**
 * Logs in a merchant user through /merchant/login.
 */
export async function loginMerchant(
  page: Page,
  credentials: { email: string; password?: string },
): Promise<void> {
  const password = credentials.password || "SecureTestPassword123!";
  await page.goto("/merchant/login");
  await page.waitForLoadState("domcontentloaded");

  await page.fill('input[name="email"]', credentials.email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL(/\/merchant/, { timeout: 15_000 });
}

/**
 * Logs out the merchant from the UI.
 */
export async function logoutMerchant(page: Page): Promise<void> {
  const signOutBtn = page.locator('button:has-text("Sign out")');
  if (await signOutBtn.isVisible()) {
    await signOutBtn.click();
    await expect(page).toHaveURL(/\/merchant\/login/, { timeout: 10_000 });
  } else {
    await page.goto("/merchant/login");
  }
}
