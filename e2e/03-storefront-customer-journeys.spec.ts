import { test, expect } from "@playwright/test";
import {
  uniqueEmail,
  setupRazorpayMock,
  closeTestDb,
} from "./helpers/test-utils.js";

test.describe("Storefront Customer Journeys", () => {
  test.afterAll(async () => {
    await closeTestDb();
  });

  test("guest customer browses product, adjusts quantity, adds to cart, and completes checkout via Razorpay", async ({
    page,
  }) => {
    // 1. Setup mock Razorpay gateway in browser page
    await setupRazorpayMock(page, { shouldSucceed: true });

    // 2. Navigate to active storefront catalog
    await page.goto("/stores/souled-store/products");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator("h1:has-text('All Products')")).toBeVisible();
    await expect(page.locator("text=luffy tshirt").first()).toBeVisible({ timeout: 15_000 });

    // 3. Open product detail
    await page.click("text=luffy tshirt");
    await expect(page.locator("h1.storefront-product-title")).toHaveText("luffy tshirt", { timeout: 15_000 });
    await expect(page.locator('[data-testid="product-price"]')).toBeVisible();

    // 4. Update quantity to 2
    const increaseBtn = page.locator('[data-testid="increase-quantity-btn"]');
    await increaseBtn.click();
    await expect(page.locator('[data-testid="quantity-input"]')).toHaveValue("2");

    // 5. Add to cart
    const addToCartBtn = page.locator('[data-testid="add-to-cart-button"]');
    await addToCartBtn.click();

    // Verify addition feedback
    await expect(page.locator('[data-testid="add-to-cart-success"]')).toBeVisible({
      timeout: 10_000,
    });

    // 6. Navigate to cart page
    await page.goto("/stores/souled-store/cart");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator('[data-testid="cart-summary"]')).toBeVisible();
    await expect(page.locator('[data-testid="cart-subtotal"]')).toBeVisible();

    // 7. Proceed to checkout
    const checkoutBtn = page.locator('[data-testid="checkout-btn"]');
    await expect(checkoutBtn).toBeEnabled();
    await checkoutBtn.click();

    await expect(page).toHaveURL(/\/stores\/souled-store\/checkout/, { timeout: 20_000 });

    // 8. Step 1: Customer Information
    const guestEmail = uniqueEmail("shopper");
    await page.fill('[data-testid="customer-email-input"]', guestEmail);
    await page.click('[data-testid="continue-to-shipping-btn"]');

    // 9. Step 2: Shipping Address
    await expect(page.locator('[data-testid="shipping-address-form"]')).toBeVisible({
      timeout: 10_000,
    });
    await page.fill('[data-testid="first-name-input"]', "John");
    await page.fill('[data-testid="last-name-input"]', "Shopper");
    await page.fill('[data-testid="address-line1-input"]', "123 Market Street");
    await page.fill('[data-testid="city-input"]', "Mumbai");
    await page.fill('[data-testid="postal-code-input"]', "400001");
    await page.fill('[data-testid="phone-input"]', "9876543210");
    await page.click('[data-testid="continue-to-delivery-btn"]');

    // 10. Step 3: Delivery Method
    await expect(page.locator('[data-testid="delivery-method-section"]')).toBeVisible({
      timeout: 10_000,
    });
    await page.click('[data-testid="continue-to-payment-btn"]');

    // 11. Step 4: Payment
    await expect(page.locator('[data-testid="payment-section"]')).toBeVisible({
      timeout: 10_000,
    });
    const payBtn = page.locator('[data-testid="pay-now-button"]');
    await expect(payBtn).toBeVisible();

    // Trigger payment
    await payBtn.click();

    // 12. Verify redirect to Order Confirmation page
    await expect(page).toHaveURL(/\/orders\/[a-zA-Z0-9-]+\/confirmation/, { timeout: 40_000 });
    await expect(page.locator('[data-testid="order-confirmation-view"]')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('[data-testid="payment-status-badge"]')).toHaveText(/PAID|AUTHORIZED|CAPTURED/i);
    await expect(page.locator('[data-testid="order-number"]')).toBeVisible();
  });

  test("customer registration, profile management, and tenant isolation between stores", async ({
    page,
  }) => {
    const customerEmail = uniqueEmail("registered_cust");
    const password = "CustomerPassword123!";

    // 1. Register as customer on souled-store
    await page.goto("/stores/souled-store/register");
    await page.waitForLoadState("domcontentloaded");

    await page.fill('input[name="firstName"]', "Diana");
    await page.fill('input[name="lastName"]', "Prince");
    await page.fill('input[name="email"]', customerEmail);
    await page.fill('input[name="password"]', password);
    await page.fill('input[name="confirmPassword"]', password);
    await page.click('button[type="submit"]');

    // Verify reaches customer account page
    await expect(page).toHaveURL(/\/stores\/souled-store\/account/, { timeout: 30_000 });
    await expect(page.locator("h1:has-text('My Account')")).toBeVisible();
    await expect(page.locator("text=Welcome back, Diana!").first()).toBeVisible();

    // 2. Customer updates profile
    const phoneInput = page.locator("#profile-phone");
    await phoneInput.fill("+1 (555) 000-1122");
    await page.click('button:has-text("Save Details")');

    await expect(page.locator("text=Profile Saved")).toBeVisible({ timeout: 10_000 });

    // 3. Customer tenant isolation: Customer session in souled-store should NOT access artisan-store account without logging in there
    await page.goto("/stores/artisan-store/account");
    await page.waitForLoadState("domcontentloaded");

    // The customer is either redirected to artisan-store login or presented with login/unauthorized
    await expect(page).toHaveURL(/\/stores\/artisan-store\/login/, { timeout: 10_000 });
  });
});
