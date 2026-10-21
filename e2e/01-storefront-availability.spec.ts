import { test, expect } from "@playwright/test";
import {
  uniqueEmail,
  uniqueSlug,
  registerMerchant,
  completeMerchantOnboarding,
  getTestDb,
  closeTestDb,
} from "./helpers/test-utils.js";

test.describe("Storefront Availability & Regression Suite", () => {
  test.afterAll(async () => {
    await closeTestDb();
  });

  test("loads ACTIVE storefront for 'souled-store' and displays its catalog products", async ({
    page,
  }) => {
    // Navigate directly to the souled-store storefront products page
    await page.goto("/stores/souled-store/products");
    await page.waitForLoadState("domcontentloaded");

    // Must not show "Store Unavailable"
    await expect(page.locator("text=Store Unavailable")).not.toBeVisible();

    // Verify store branding
    await expect(page.locator(".storefront-brand-name").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".storefront-brand-name").first()).toHaveText("Souled Store", { timeout: 20_000 });

    // Verify products belonging to souled-store are displayed
    await expect(page.locator("text=luffy tshirt").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("text=zoro tshirt").first()).toBeVisible({ timeout: 10_000 });
  });

  test("loads ACTIVE storefront for 'artisan-store' with ceramic products", async ({
    page,
  }) => {
    await page.goto("/stores/artisan-store/products");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator("text=Store Unavailable")).not.toBeVisible();
    await expect(page.locator(".storefront-brand-name").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".storefront-brand-name").first()).toHaveText("Demo Artisan Store");
    await expect(page.locator("text=Ceramic Artisan Mug").first()).toBeVisible({ timeout: 10_000 });
  });

  test("displays 'Store Unavailable' for a nonexistent store slug", async ({
    page,
  }) => {
    const nonexistentSlug = `nonexistent-store-${Date.now()}`;
    await page.goto(`/stores/${nonexistentSlug}/products`);
    await page.waitForLoadState("domcontentloaded");

    // The user-facing error must be shown cleanly
    await expect(page.locator("text=Store Unavailable")).toBeVisible({ timeout: 10_000 });
    await expect(
      page.locator(`text=The storefront for “${nonexistentSlug}” could not be found`),
    ).toBeVisible();
    await expect(page.locator('a:has-text("Return Home")')).toBeVisible();
  });

  test("displays 'Store Unavailable' for a DRAFT store", async ({ page }) => {
    const db = getTestDb();
    const draftSlug = uniqueSlug("draft-e2e-store");

    // Query an existing organization to attach our test store to
    const orgRes = await db.query<{ id: string }>(
      "SELECT id FROM organizations ORDER BY created_at ASC LIMIT 1",
    );
    const orgId = orgRes.rows[0]?.id;
    expect(orgId).toBeDefined();

    // Insert a store explicitly in DRAFT status
    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES (gen_random_uuid(), $1, 'Draft Test Store', $2, 'DRAFT', 'USD', 'en-US', 'UTC')`,
      [orgId, draftSlug],
    );

    try {
      await page.goto(`/stores/${draftSlug}/products`);
      await page.waitForLoadState("domcontentloaded");

      // Draft stores must be hidden from customer access
      await expect(page.locator("text=Store Unavailable")).toBeVisible({ timeout: 10_000 });
      await expect(
        page.locator(`text=The storefront for “${draftSlug}” could not be found or is currently not active`),
      ).toBeVisible();
    } finally {
      // Clean up test store
      await db.query("DELETE FROM stores WHERE slug = $1", [draftSlug]);
    }
  });

  test("newly onboarded merchant store is created as ACTIVE and immediately accessible on storefront", async ({
    page,
  }) => {
    const email = uniqueEmail("active_onboard");
    const storeSlug = uniqueSlug("live-store");
    const storeName = "Live Onboard Store";

    await registerMerchant(page, {
      name: "Live Merchant",
      email,
    });

    await completeMerchantOnboarding(page, {
      orgName: "Live Merchant Org",
      storeName,
      slug: storeSlug,
    });

    // Verify DB reflects ACTIVE status
    const db = getTestDb();
    const storeRes = await db.query<{ status: string; slug: string }>(
      "SELECT status, slug FROM stores WHERE slug = $1",
      [storeSlug],
    );
    expect(storeRes.rows.length).toBe(1);
    expect(storeRes.rows[0]?.status).toBe("ACTIVE");

    // Verify customer storefront is immediately live
    await page.goto(`/stores/${storeSlug}/products`);
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator("text=Store Unavailable")).not.toBeVisible();
    await expect(page.locator(".storefront-brand-name").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".storefront-brand-name").first()).toHaveText(storeName);
  });

  test("merchant creating a DRAFT store accurately shows draft status in UI and does not claim store is active", async ({
    page,
  }) => {
    const email = uniqueEmail("draft_creator");
    const initialSlug = uniqueSlug("initial");
    const secondSlug = uniqueSlug("custom-draft");

    // 1. Onboard merchant
    await registerMerchant(page, {
      name: "Draft Creator Merchant",
      email,
    });

    await completeMerchantOnboarding(page, {
      orgName: "Creator Org",
      storeName: "Initial Live Store",
      slug: initialSlug,
    });

    // 2. Navigate to store creation page
    await page.goto("/merchant/stores/new");
    await page.waitForLoadState("domcontentloaded");

    // 3. Fill in store details
    await page.fill('input[name="name"]', "My Exclusive Draft Store");
    const slugInput = page.locator('input[name="slug"]');
    await slugInput.fill("");
    await slugInput.fill(secondSlug);

    // 4. Select DRAFT status
    await page.selectOption('select[name="status"]', "DRAFT");

    // 5. Submit creation form
    await page.click('button[type="submit"]');

    // 6. Verify creation success screen
    await expect(
      page.locator("text=Store Created (Draft)"),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.locator("text=Store Activated"),
    ).not.toBeVisible();
    await expect(page.locator("text=Status: DRAFT")).toBeVisible();

    // 7. Verify the generated customer storefront route matches the exact slug
    await expect(
      page.locator(`code:has-text("/stores/${secondSlug}/products")`),
    ).toBeVisible();

    // 8. Go back to merchant console and check store switcher reflects draft status
    await page.click('a:has-text("Go to Dashboard")');
    await page.waitForLoadState("domcontentloaded");

    // The newly created store is selected, and its Draft badge is rendered
    await expect(page.locator('span:has-text("Draft")').first()).toBeVisible({ timeout: 10_000 });
  });
});
