import { test, expect } from "@playwright/test";
import { getTestDb, closeTestDb } from "./helpers/test-utils.js";
import { hashPassword } from "../packages/auth/src/index.js";

test.describe("Product Reviews Complete Flow & Regression Suite", () => {
  const storeSlug = "souled-store";
  const productSlug = "iron-man-glow-tshirt";
  const eligibleEmail = "eligible_reviewer@test.com";
  const ineligibleEmail = "ineligible_shopper@test.com";
  const defaultPassword = "Password123!";

  let storeId: string;
  let productId: string;
  let variantId: string;
  let eligibleUserId: string;
  let eligibleCustomerId: string;
  let ineligibleUserId: string;
  let ineligibleCustomerId: string;

  test.beforeAll(async () => {
    const db = getTestDb();
    const hash = await hashPassword(defaultPassword);

    // 1. Resolve Store
    const storeRes = await db.query("SELECT id FROM stores WHERE slug = $1", [storeSlug]);
    storeId = storeRes.rows[0].id;

    // 2. Resolve Product & Variant
    const prodRes = await db.query(
      "SELECT id FROM products WHERE store_id = $1 AND slug = $2",
      [storeId, productSlug],
    );
    productId = prodRes.rows[0].id;

    const varRes = await db.query(
      "SELECT id FROM product_variants WHERE product_id = $1 LIMIT 1",
      [productId],
    );
    variantId = varRes.rows[0].id;

    // 3. Setup Eligible Customer (User + Customer record + Paid Order)
    const userRes = await db.query("SELECT id FROM users WHERE email = $1", [eligibleEmail]);
    if (userRes.rows[0]) {
      eligibleUserId = userRes.rows[0].id;
      await db.query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, eligibleUserId]);
    } else {
      const res = await db.query(
        "INSERT INTO users (id, email, name, password_hash, status) VALUES (gen_random_uuid(), $1, 'Eligible Reviewer', $2, 'ACTIVE') RETURNING id",
        [eligibleEmail, hash],
      );
      eligibleUserId = res.rows[0].id;
    }

    const custRes = await db.query(
      "SELECT id FROM customers WHERE store_id = $1 AND email = $2",
      [storeId, eligibleEmail],
    );
    if (custRes.rows[0]) {
      eligibleCustomerId = custRes.rows[0].id;
      await db.query("UPDATE customers SET user_id = $1 WHERE id = $2", [eligibleUserId, eligibleCustomerId]);
    } else {
      const res = await db.query(
        "INSERT INTO customers (id, store_id, email, first_name, last_name, user_id) VALUES (gen_random_uuid(), $1, $2, 'Eligible', 'Reviewer', $3) RETURNING id",
        [storeId, eligibleEmail, eligibleUserId],
      );
      eligibleCustomerId = res.rows[0].id;
    }

    // Ensure customer has a paid order containing this product
    const orderRes = await db.query(
      `SELECT o.id FROM orders o
       JOIN order_items oi ON o.id = oi.order_id
       WHERE o.store_id = $1 AND o.customer_id = $2 AND (oi.product_id = $3 OR oi.variant_id = $4) AND o.payment_status = 'PAID'
       LIMIT 1`,
      [storeId, eligibleCustomerId, productId, variantId],
    );
    if (!orderRes.rows[0]) {
      const oRes = await db.query(
        "INSERT INTO orders (id, store_id, customer_id, order_number, status, payment_status, currency, total, grand_total) VALUES (gen_random_uuid(), $1, $2, 'ORD-REV-ELIG-1', 'CONFIRMED', 'PAID', 'INR', 99900, 99900) RETURNING id",
        [storeId, eligibleCustomerId],
      );
      const newOrderId = oRes.rows[0].id;
      await db.query(
        "INSERT INTO order_items (id, order_id, store_id, product_id, variant_id, product_name_snapshot, variant_name_snapshot, quantity, unit_price, line_total) VALUES (gen_random_uuid(), $1, $2, $3, $4, 'Iron Man Glow Tee', 'Default', 1, 99900, 99900)",
        [newOrderId, storeId, productId, variantId],
      );
    }

    // 4. Setup Ineligible Customer (User + Customer record, NO orders)
    const ineligUserRes = await db.query("SELECT id FROM users WHERE email = $1", [ineligibleEmail]);
    if (ineligUserRes.rows[0]) {
      ineligibleUserId = ineligUserRes.rows[0].id;
      await db.query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, ineligibleUserId]);
    } else {
      const res = await db.query(
        "INSERT INTO users (id, email, name, password_hash, status) VALUES (gen_random_uuid(), $1, 'Ineligible Customer', $2, 'ACTIVE') RETURNING id",
        [ineligibleEmail, hash],
      );
      ineligibleUserId = res.rows[0].id;
    }

    const ineligCustRes = await db.query(
      "SELECT id FROM customers WHERE store_id = $1 AND email = $2",
      [storeId, ineligibleEmail],
    );
    if (ineligCustRes.rows[0]) {
      ineligibleCustomerId = ineligCustRes.rows[0].id;
      await db.query("UPDATE customers SET user_id = $1 WHERE id = $2", [ineligibleUserId, ineligibleCustomerId]);
    } else {
      const res = await db.query(
        "INSERT INTO customers (id, store_id, email, first_name, last_name, user_id) VALUES (gen_random_uuid(), $1, $2, 'Ineligible', 'Shopper', $3) RETURNING id",
        [storeId, ineligibleEmail, ineligibleUserId],
      );
      ineligibleCustomerId = res.rows[0].id;
    }

    // Clean up any reviews from previous runs for deterministic testing
    await db.query(
      "DELETE FROM product_reviews WHERE store_id = $1 AND product_id = $2 AND customer_id IN ($3, $4)",
      [storeId, productId, eligibleCustomerId, ineligibleCustomerId],
    );
  });

  test.afterAll(async () => {
    await closeTestDb();
  });

  test("Scenario 6: Unauthenticated customer sees sign-in prompt and cannot access write review form", async ({
    page,
  }) => {
    await page.goto(`/stores/${storeSlug}/products/${productSlug}`);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("h1.storefront-product-title")).toBeVisible({ timeout: 30_000 });

    // "Sign in to Review" should be visible and link to storefront login
    const signInLink = page.locator('[data-testid="sign-in-to-review-link"]');
    await expect(signInLink).toBeVisible({ timeout: 15_000 });
    const href = await signInLink.getAttribute("href");
    expect(href).toContain(`/stores/${storeSlug}/login`);

    // "Write a Review" button must NOT be present
    await expect(page.locator('[data-testid="write-review-btn"]')).not.toBeVisible();
  });

  test("Scenario 7: Authenticated customer without verified purchase sees clear eligibility explanation", async ({
    page,
  }) => {
    // 1. Log in as ineligible customer
    await page.goto(`/stores/${storeSlug}/login`);
    await page.fill('input[name="email"]', ineligibleEmail);
    await page.fill('input[name="password"]', defaultPassword);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(new RegExp(`/stores/${storeSlug}/account`), { timeout: 20_000 });

    // 2. Go to product page
    await page.goto(`/stores/${storeSlug}/products/${productSlug}`);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("h1.storefront-product-title")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("h1.storefront-product-title")).toBeVisible({ timeout: 30_000 });

    // 3. Verify verified-buyer explanation badge is shown
    const badge = page.locator('[data-testid="verified-buyer-only-badge"]');
    await expect(badge).toBeVisible({ timeout: 15_000 });
    await expect(badge).toContainText("Only verified buyers who completed a purchase of this product can submit a review.");

    // "Write a Review" button must NOT be present
    await expect(page.locator('[data-testid="write-review-btn"]')).not.toBeVisible();
  });

  test("Scenarios 1-4: Star selection (mouse, keyboard, change rating, submit without rating)", async ({
    page,
  }) => {
    // 1. Log in as eligible customer
    await page.goto(`/stores/${storeSlug}/login`);
    await page.fill('input[name="email"]', eligibleEmail);
    await page.fill('input[name="password"]', defaultPassword);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(new RegExp(`/stores/${storeSlug}/account`), { timeout: 20_000 });

    // 2. Navigate to product page
    await page.goto(`/stores/${storeSlug}/products/${productSlug}`);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("h1.storefront-product-title")).toBeVisible({ timeout: 30_000 });

    // 3. Click "Write a Review"
    const writeBtn = page.locator('[data-testid="write-review-btn"]');
    await expect(writeBtn).toBeVisible({ timeout: 15_000 });
    await writeBtn.click();

    // 4. Modal is visible with radiogroup
    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();
    const radiogroup = page.locator('[data-testid="star-rating-radiogroup"]');
    await expect(radiogroup).toBeVisible();
    const ratingLabel = page.locator('[data-testid="selected-rating-label"]');

    // Initially unselected
    await expect(ratingLabel).toHaveText("Select a rating (1 to 5 stars)");

    // SCENARIO 4: Submitting without rating fails validation
    await page.fill('[data-testid="review-title-input"]', "Premature submission");
    await page.fill('[data-testid="review-content-input"]', "I have not clicked any star yet.");
    await page.click('[data-testid="submit-review-btn"]');

    const formError = page.locator('[data-testid="review-form-error"]');
    await expect(formError).toBeVisible();
    await expect(formError).toContainText("Please select a rating between 1 and 5 stars");

    // SCENARIO 1: Selecting each rating 1 to 5 with mouse
    const star1 = page.locator('[data-testid="star-rating-1"]');
    const star2 = page.locator('[data-testid="star-rating-2"]');
    const star3 = page.locator('[data-testid="star-rating-3"]');
    const star4 = page.locator('[data-testid="star-rating-4"]');
    const star5 = page.locator('[data-testid="star-rating-5"]');

    await star1.click();
    await expect(ratingLabel).toHaveText("1 Star - Terrible");
    expect(await star1.getAttribute("aria-checked")).toBe("true");

    await star2.click();
    await expect(ratingLabel).toHaveText("2 Stars - Poor");
    expect(await star2.getAttribute("aria-checked")).toBe("true");

    await star3.click();
    await expect(ratingLabel).toHaveText("3 Stars - Average");
    expect(await star3.getAttribute("aria-checked")).toBe("true");

    await star4.click();
    await expect(ratingLabel).toHaveText("4 Stars - Very Good");
    expect(await star4.getAttribute("aria-checked")).toBe("true");

    await star5.click();
    await expect(ratingLabel).toHaveText("5 Stars - Exceptional");
    expect(await star5.getAttribute("aria-checked")).toBe("true");

    // SCENARIO 2: Keyboard navigation
    await page.mouse.move(0, 0);
    await star5.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(ratingLabel).toHaveText("4 Stars - Very Good");
    expect(await star4.getAttribute("aria-checked")).toBe("true");

    await page.keyboard.press("Home");
    await expect(ratingLabel).toHaveText("1 Star - Terrible");
    expect(await star1.getAttribute("aria-checked")).toBe("true");

    await page.keyboard.press("End");
    await expect(ratingLabel).toHaveText("5 Stars - Exceptional");
    expect(await star5.getAttribute("aria-checked")).toBe("true");

    await page.keyboard.press("ArrowDown");
    await expect(ratingLabel).toHaveText("4 Stars - Very Good");
    expect(await star4.getAttribute("aria-checked")).toBe("true");

    // SCENARIO 3: Changing a rating before submitting
    await star2.click();
    await expect(ratingLabel).toHaveText("2 Stars - Poor");
    await star5.click();
    await expect(ratingLabel).toHaveText("5 Stars - Exceptional");

    // Close modal via Escape
    await page.keyboard.press("Escape");
    await expect(modal).not.toBeVisible();
  });

  test("Scenarios 5, 8, 9, 10, 11: Submit review, DB verification, pending moderation, duplicate protection", async ({
    page,
  }) => {
    const db = getTestDb();

    // Ensure no existing reviews for this customer
    await db.query(
      "DELETE FROM product_reviews WHERE store_id = $1 AND product_id = $2 AND customer_id = $3",
      [storeId, productId, eligibleCustomerId],
    );

    // 1. Log in as eligible customer
    await page.goto(`/stores/${storeSlug}/login`);
    await page.fill('input[name="email"]', eligibleEmail);
    await page.fill('input[name="password"]', defaultPassword);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(new RegExp(`/stores/${storeSlug}/account`), { timeout: 20_000 });

    // 2. Go to product page
    await page.goto(`/stores/${storeSlug}/products/${productSlug}`);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("h1.storefront-product-title")).toBeVisible({ timeout: 30_000 });

    // 3. Open Write Modal
    await page.click('[data-testid="write-review-btn"]');

    // SCENARIO 1 & 5: Select 5 stars, fill form, submit review
    await page.click('[data-testid="star-rating-5"]');
    await expect(page.locator('[data-testid="selected-rating-label"]')).toHaveText("5 Stars - Exceptional");

    const reviewTitle = "Sensational glow in the dark quality";
    const reviewContent = "Loved the comfort, fabric breathability, and the print glow effect is stunning!";

    await page.fill('[data-testid="review-title-input"]', reviewTitle);
    await page.fill('[data-testid="review-content-input"]', reviewContent);

    // Submit review and await 201 Created API response
    const [response] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes(`/products/${productSlug}/reviews`) &&
          res.request().method() === "POST",
      ),
      page.click('[data-testid="submit-review-btn"]'),
    ]);

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.rating).toBe(5);
    expect(body.data.title).toBe(reviewTitle);
    expect(body.data.status).toBe("PENDING");
    const submittedReviewId = body.data.id;

    // SCENARIO 10: Confirming submitted rating, customer, and product in the database
    const dbReview = await db.query(
      "SELECT id, rating, customer_id, product_id, is_verified_purchase, status FROM product_reviews WHERE id = $1",
      [submittedReviewId],
    );
    expect(dbReview.rows.length).toBe(1);
    expect(dbReview.rows[0].rating).toBe(5);
    expect(dbReview.rows[0].customer_id).toBe(eligibleCustomerId);
    expect(dbReview.rows[0].product_id).toBe(productId);
    expect(dbReview.rows[0].is_verified_purchase).toBe(true);
    expect(dbReview.rows[0].status).toBe("PENDING");

    // SCENARIO 11: Author sees pending review in banner immediately
    const pendingBanner = page.locator('[data-testid="pending-review-banner"]');
    await expect(pendingBanner).toBeVisible({ timeout: 10_000 });
    await expect(pendingBanner.locator('[data-testid="pending-moderation-badge"]')).toBeVisible();
    await expect(pendingBanner).toContainText(reviewTitle);
    await expect(pendingBanner).toContainText(reviewContent);

    // SCENARIO 9: Duplicate review prevention
    // Header action now shows "Edit Your Review" instead of "Write a Review"
    const editBtn = page.locator('[data-testid="edit-review-btn"]');
    await expect(editBtn).toBeVisible();
    await expect(page.locator('[data-testid="write-review-btn"]')).not.toBeVisible();

    // Verify merchant approval publishes review to the public list
    await db.query("UPDATE product_reviews SET status = 'PUBLISHED' WHERE id = $1", [submittedReviewId]);
    await page.reload();
    await page.waitForLoadState("domcontentloaded");

    // Now the review card appears in the published list with "Your Review" badge
    const publishedCard = page.locator(`[data-testid="review-card-${submittedReviewId}"]`);
    await expect(publishedCard).toBeVisible({ timeout: 10_000 });
    await expect(publishedCard).toContainText(reviewTitle);
    await expect(publishedCard).toContainText("Your Review");
    await expect(publishedCard).toContainText("Verified Purchase");

    // SCENARIO 8: API error handling when editing
    await publishedCard.locator('[data-testid="edit-own-review-btn"]').click();
    const editModal = page.locator('div[role="dialog"]');
    await expect(editModal).toBeVisible();

    // Clear content to trigger client validation
    await page.fill('[data-testid="review-title-input"]', "   ");
    await page.click('[data-testid="submit-review-btn"]');
    await expect(page.locator('[data-testid="review-form-error"]')).toContainText("Please enter a review headline");
  });
});
