import { describe, expect, it } from "vitest";
import {
  assertCheckoutEditable,
  assertValidCheckoutTransition,
  Checkout,
  CheckoutAddress,
  CheckoutAlreadyCompletedError,
  CheckoutDomainError,
  CheckoutExpiredError,
  CheckoutItem,
  CheckoutItemNotFoundError,
  CheckoutNotEditableError,
  DuplicateCheckoutItemError,
  InvalidCheckoutAddressError,
  InvalidCheckoutItemError,
  InvalidCheckoutPriceError,
  InvalidCheckoutStateTransitionError,
  InvalidCheckoutStatusError,
  InvalidCurrencyError,
  InvalidQuantityError,
  isCheckoutEditable,
  isTerminalCheckoutStatus,
  isValidCheckoutStatus,
  isValidCheckoutTransition,
  VALID_CHECKOUT_STATUSES,
  VALID_CHECKOUT_TRANSITIONS,
  validateCheckoutAddress,
  validateCheckoutCurrency,
  validateCheckoutQuantity,
  validateMonetaryAmount,
} from "@shopify-clone/checkout";

describe("Checkout Domain Model & Invariants", () => {
  const storeId = "018f4a12-0000-7000-8000-000000000001";
  const cartId = "018f4a12-0000-7000-8000-000000000002";
  const variantId1 = "018f4a12-0000-7000-8000-000000000010";
  const variantId2 = "018f4a12-0000-7000-8000-000000000020";

  describe("Checkout Lifecycle & State Transitions", () => {
    it("recognizes all valid checkout statuses", () => {
      expect(VALID_CHECKOUT_STATUSES).toEqual([
        "OPEN",
        "PAYMENT_PENDING",
        "COMPLETED",
        "CANCELLED",
        "EXPIRED",
        "FAILED",
      ]);
      expect(isValidCheckoutStatus("OPEN")).toBe(true);
      expect(isValidCheckoutStatus("PAYMENT_PENDING")).toBe(true);
      expect(isValidCheckoutStatus("COMPLETED")).toBe(true);
      expect(isValidCheckoutStatus("CANCELLED")).toBe(true);
      expect(isValidCheckoutStatus("EXPIRED")).toBe(true);
      expect(isValidCheckoutStatus("FAILED")).toBe(true);
      expect(isValidCheckoutStatus("UNKNOWN")).toBe(false);
      expect(isValidCheckoutStatus(null)).toBe(false);
      expect(isValidCheckoutStatus(undefined)).toBe(false);
    });

    it("permits legal transitions from OPEN", () => {
      expect(VALID_CHECKOUT_TRANSITIONS.OPEN).toContain("PAYMENT_PENDING");
      expect(VALID_CHECKOUT_TRANSITIONS.OPEN).toContain("CANCELLED");
      expect(VALID_CHECKOUT_TRANSITIONS.OPEN).toContain("EXPIRED");
      expect(VALID_CHECKOUT_TRANSITIONS.OPEN).toContain("FAILED");

      expect(isValidCheckoutTransition("OPEN", "PAYMENT_PENDING")).toBe(true);
      expect(isValidCheckoutTransition("OPEN", "CANCELLED")).toBe(true);
      expect(isValidCheckoutTransition("OPEN", "EXPIRED")).toBe(true);
      expect(isValidCheckoutTransition("OPEN", "FAILED")).toBe(true);
      expect(isValidCheckoutTransition("OPEN", "OPEN")).toBe(true);

      expect(() => assertValidCheckoutTransition("OPEN", "PAYMENT_PENDING")).not.toThrow();
      expect(() => assertValidCheckoutTransition("OPEN", "CANCELLED")).not.toThrow();
      expect(() => assertValidCheckoutTransition("OPEN", "EXPIRED")).not.toThrow();
      expect(() => assertValidCheckoutTransition("OPEN", "FAILED")).not.toThrow();
    });

    it("permits legal transitions from PAYMENT_PENDING including failure retry to OPEN", () => {
      expect(isValidCheckoutTransition("PAYMENT_PENDING", "COMPLETED")).toBe(true);
      expect(isValidCheckoutTransition("PAYMENT_PENDING", "OPEN")).toBe(true);
      expect(isValidCheckoutTransition("PAYMENT_PENDING", "FAILED")).toBe(true);
      expect(isValidCheckoutTransition("PAYMENT_PENDING", "CANCELLED")).toBe(true);
      expect(isValidCheckoutTransition("PAYMENT_PENDING", "EXPIRED")).toBe(true);
      expect(isValidCheckoutTransition("PAYMENT_PENDING", "PAYMENT_PENDING")).toBe(true);

      expect(() => assertValidCheckoutTransition("PAYMENT_PENDING", "COMPLETED")).not.toThrow();
      expect(() => assertValidCheckoutTransition("PAYMENT_PENDING", "OPEN")).not.toThrow();
    });

    it("rejects transitions away from terminal states", () => {
      const terminalStates = ["COMPLETED", "CANCELLED", "EXPIRED", "FAILED"] as const;

      for (const terminal of terminalStates) {
        expect(isTerminalCheckoutStatus(terminal)).toBe(true);
        expect(isValidCheckoutTransition(terminal, "OPEN")).toBe(false);
        expect(isValidCheckoutTransition(terminal, "PAYMENT_PENDING")).toBe(false);

        expect(() => assertValidCheckoutTransition(terminal, "OPEN")).toThrow(
          InvalidCheckoutStateTransitionError,
        );
      }
    });

    it("determines checkout editability strictly for OPEN state", () => {
      expect(isCheckoutEditable("OPEN")).toBe(true);
      expect(isCheckoutEditable("PAYMENT_PENDING")).toBe(false);
      expect(isCheckoutEditable("COMPLETED")).toBe(false);
      expect(isCheckoutEditable("CANCELLED")).toBe(false);
      expect(isCheckoutEditable("EXPIRED")).toBe(false);
      expect(isCheckoutEditable("FAILED")).toBe(false);

      expect(() => assertCheckoutEditable("OPEN")).not.toThrow();
      expect(() => assertCheckoutEditable("COMPLETED")).toThrow(CheckoutAlreadyCompletedError);
      expect(() => assertCheckoutEditable("EXPIRED")).toThrow(CheckoutExpiredError);
      expect(() => assertCheckoutEditable("CANCELLED")).toThrow(CheckoutNotEditableError);
      expect(() => assertCheckoutEditable("PAYMENT_PENDING")).toThrow(CheckoutNotEditableError);
      expect(() => assertCheckoutEditable("FAILED")).toThrow(CheckoutNotEditableError);
    });
  });

  describe("Checkout Creation & Validation", () => {
    it("creates an empty checkout with valid default values", () => {
      const checkout = Checkout.create({
        storeId,
        cartId,
      });

      expect(checkout.id).toBeDefined();
      expect(checkout.storeId).toBe(storeId);
      expect(checkout.cartId).toBe(cartId);
      expect(checkout.status).toBe("OPEN");
      expect(checkout.currency).toBe("USD");
      expect(checkout.subtotal).toBe(0);
      expect(checkout.discountTotal).toBe(0);
      expect(checkout.taxTotal).toBe(0);
      expect(checkout.shippingTotal).toBe(0);
      expect(checkout.total).toBe(0);
      expect(checkout.paymentStatus).toBe("PENDING");
      expect(checkout.customerId).toBeNull();
      expect(checkout.email).toBeNull();
      expect(checkout.shippingAddress).toBeNull();
      expect(checkout.billingAddress).toBeNull();
      expect(checkout.expiresAt).toBeNull();
      expect(checkout.items).toHaveLength(0);
      expect(checkout.isEditable()).toBe(true);
      expect(checkout.isTerminal()).toBe(false);
      expect(checkout.isCompleted()).toBe(false);
    });

    it("rejects creation with missing storeId or cartId", () => {
      expect(() => Checkout.create({ storeId: "", cartId })).toThrow(/storeId is required/);
      expect(() => Checkout.create({ storeId, cartId: "" })).toThrow(/cartId is required/);
    });

    it("normalizes and validates currency codes", () => {
      expect(validateCheckoutCurrency("USD")).toBe("USD");
      expect(validateCheckoutCurrency("EUR")).toBe("EUR");
      expect(validateCheckoutCurrency("GBP")).toBe("GBP");
      expect(validateCheckoutCurrency("INR")).toBe("INR");

      expect(() => validateCheckoutCurrency("usd")).toThrow(InvalidCurrencyError);
      expect(() => validateCheckoutCurrency("US")).toThrow(InvalidCurrencyError);
      expect(() => validateCheckoutCurrency("USDD")).toThrow(InvalidCurrencyError);
      expect(() => validateCheckoutCurrency(123)).toThrow(InvalidCurrencyError);
      expect(() => validateCheckoutCurrency(null)).toThrow(InvalidCurrencyError);
    });

    it("validates monetary amounts as exact non-negative integers in minor units", () => {
      expect(validateMonetaryAmount(0)).toBe(0);
      expect(validateMonetaryAmount(1250)).toBe(1250);
      expect(validateMonetaryAmount(999999)).toBe(999999);

      expect(() => validateMonetaryAmount(-1)).toThrow(InvalidCheckoutPriceError);
      expect(() => validateMonetaryAmount(10.5)).toThrow(InvalidCheckoutPriceError);
      expect(() => validateMonetaryAmount(NaN)).toThrow(InvalidCheckoutPriceError);
      expect(() => validateMonetaryAmount("1000")).toThrow(InvalidCheckoutPriceError);
    });

    it("validates item quantities as positive integers up to default maximum", () => {
      expect(validateCheckoutQuantity(1)).toBe(1);
      expect(validateCheckoutQuantity(10)).toBe(10);
      expect(validateCheckoutQuantity(999)).toBe(999);

      expect(() => validateCheckoutQuantity(0)).toThrow(InvalidQuantityError);
      expect(() => validateCheckoutQuantity(-5)).toThrow(InvalidQuantityError);
      expect(() => validateCheckoutQuantity(1.5)).toThrow(InvalidQuantityError);
      expect(() => validateCheckoutQuantity(1000)).toThrow(InvalidQuantityError);
      expect(() => validateCheckoutQuantity("1")).toThrow(InvalidQuantityError);
    });
  });

  describe("Checkout Item Management & Snapshots", () => {
    it("adds items with immutable snapshot information and calculates line totals", () => {
      const checkout = Checkout.create({ storeId, cartId });

      const item = checkout.addItem({
        variantId: variantId1,
        productNameSnapshot: "Minimalist T-Shirt",
        variantNameSnapshot: "Black / L",
        skuSnapshot: "TSHIRT-BLK-L",
        unitPrice: 2500,
        quantity: 2,
      });

      expect(item.id).toBeDefined();
      expect(item.checkoutId).toBe(checkout.id);
      expect(item.storeId).toBe(storeId);
      expect(item.variantId).toBe(variantId1);
      expect(item.productNameSnapshot).toBe("Minimalist T-Shirt");
      expect(item.variantNameSnapshot).toBe("Black / L");
      expect(item.skuSnapshot).toBe("TSHIRT-BLK-L");
      expect(item.unitPrice).toBe(2500);
      expect(item.quantity).toBe(2);
      expect(item.lineTotal).toBe(5000);

      expect(checkout.items).toHaveLength(1);
      expect(checkout.itemCount).toBe(2);
      expect(checkout.uniqueItemCount).toBe(1);
      expect(checkout.subtotal).toBe(5000);
      expect(checkout.total).toBe(5000);
    });

    it("rejects duplicate variant addition to the same checkout", () => {
      const checkout = Checkout.create({ storeId, cartId });

      checkout.addItem({
        variantId: variantId1,
        productNameSnapshot: "Minimalist T-Shirt",
        variantNameSnapshot: "Black / L",
        unitPrice: 2500,
        quantity: 1,
      });

      expect(() =>
        checkout.addItem({
          variantId: variantId1,
          productNameSnapshot: "Minimalist T-Shirt",
          variantNameSnapshot: "Black / L",
          unitPrice: 2500,
          quantity: 2,
        }),
      ).toThrow(DuplicateCheckoutItemError);
    });

    it("updates item quantity and recalculates line total and checkout subtotal", () => {
      const checkout = Checkout.create({ storeId, cartId });

      checkout.addItem({
        variantId: variantId1,
        productNameSnapshot: "Minimalist T-Shirt",
        variantNameSnapshot: "Black / L",
        unitPrice: 2500,
        quantity: 2,
      });

      const updated = checkout.updateItemQuantity(variantId1, 5);
      expect(updated.quantity).toBe(5);
      expect(updated.lineTotal).toBe(12500);
      expect(checkout.subtotal).toBe(12500);
      expect(checkout.total).toBe(12500);
      expect(checkout.itemCount).toBe(5);
    });

    it("throws CheckoutItemNotFoundError when updating non-existent variant", () => {
      const checkout = Checkout.create({ storeId, cartId });
      expect(() => checkout.updateItemQuantity("unknown-variant", 2)).toThrow(
        CheckoutItemNotFoundError,
      );
    });

    it("removes an item and recalculates totals", () => {
      const checkout = Checkout.create({ storeId, cartId });

      checkout.addItem({
        variantId: variantId1,
        productNameSnapshot: "T-Shirt",
        variantNameSnapshot: "Black",
        unitPrice: 2000,
        quantity: 1,
      });
      checkout.addItem({
        variantId: variantId2,
        productNameSnapshot: "Hoodie",
        variantNameSnapshot: "Gray",
        unitPrice: 5000,
        quantity: 2,
      });

      expect(checkout.uniqueItemCount).toBe(2);
      expect(checkout.subtotal).toBe(12000);

      checkout.removeItem(variantId1);
      expect(checkout.uniqueItemCount).toBe(1);
      expect(checkout.subtotal).toBe(10000);
      expect(checkout.hasVariant(variantId1)).toBe(false);
      expect(checkout.hasVariant(variantId2)).toBe(true);
    });

    it("clears all items and resets subtotal and total", () => {
      const checkout = Checkout.create({ storeId, cartId });

      checkout.addItem({
        variantId: variantId1,
        productNameSnapshot: "T-Shirt",
        variantNameSnapshot: "Black",
        unitPrice: 2000,
        quantity: 1,
      });

      checkout.clearItems();
      expect(checkout.items).toHaveLength(0);
      expect(checkout.subtotal).toBe(0);
      expect(checkout.total).toBe(0);
    });

    it("preserves snapshot integrity: snapshots are unaffected by outside mutation", () => {
      const checkout = Checkout.create({ storeId, cartId });

      const item = checkout.addItem({
        variantId: variantId1,
        productNameSnapshot: "Original Title",
        variantNameSnapshot: "Original Variant",
        skuSnapshot: "ORIG-SKU",
        unitPrice: 3000,
        quantity: 1,
      });

      // Export snapshot
      const snapshot = item.toData();
      expect(snapshot.productNameSnapshot).toBe("Original Title");
      expect(snapshot.variantNameSnapshot).toBe("Original Variant");
      expect(snapshot.skuSnapshot).toBe("ORIG-SKU");
      expect(snapshot.unitPrice).toBe(3000);

      // Snapshot fields are read-only properties on CheckoutItem
      expect(item.productNameSnapshot).toBe("Original Title");
      expect(item.variantNameSnapshot).toBe("Original Variant");
      expect(item.unitPrice).toBe(3000);
    });
  });

  describe("Totals Calculation & Financial Invariants", () => {
    it("accurately computes subtotal, discounts, tax, shipping, and grand total", () => {
      const checkout = Checkout.create({ storeId, cartId });

      checkout.addItem({
        variantId: variantId1,
        productNameSnapshot: "Item 1",
        variantNameSnapshot: "V1",
        unitPrice: 10000, // 100.00
        quantity: 2,      // 200.00
      });

      checkout.addItem({
        variantId: variantId2,
        productNameSnapshot: "Item 2",
        variantNameSnapshot: "V2",
        unitPrice: 5000, // 50.00
        quantity: 1,     // 50.00
      });

      expect(checkout.subtotal).toBe(25000); // 250.00

      checkout.setDiscountTotal(3000); // 30.00 discount
      expect(checkout.discountTotal).toBe(3000);
      expect(checkout.total).toBe(22000);

      checkout.setTaxTotal(2200); // 22.00 tax
      expect(checkout.taxTotal).toBe(2200);
      expect(checkout.total).toBe(24200);

      checkout.setShippingTotal(1500); // 15.00 shipping
      expect(checkout.shippingTotal).toBe(1500);
      expect(checkout.total).toBe(25700);
    });

    it("floors grand total at zero if discounts exceed charges", () => {
      const checkout = Checkout.create({ storeId, cartId });

      checkout.addItem({
        variantId: variantId1,
        productNameSnapshot: "Item 1",
        variantNameSnapshot: "V1",
        unitPrice: 1000,
        quantity: 1,
      });

      checkout.setDiscountTotal(5000); // discount greater than subtotal
      expect(checkout.total).toBe(0);
    });

    it("allows manual setTotals with non-negative validation", () => {
      const checkout = Checkout.create({ storeId, cartId });

      checkout.setTotals(1000, 200, 100, 50, 950);
      expect(checkout.subtotal).toBe(1000);
      expect(checkout.discountTotal).toBe(200);
      expect(checkout.taxTotal).toBe(100);
      expect(checkout.shippingTotal).toBe(50);
      expect(checkout.total).toBe(950);

      expect(() => checkout.setTotals(-1, 0, 0, 0, 0)).toThrow(InvalidCheckoutPriceError);
      expect(() => checkout.setTotals(100, -1, 0, 0, 100)).toThrow(InvalidCheckoutPriceError);
    });
  });

  describe("Address & Customer Handling", () => {
    it("validates and sets shipping and billing addresses", () => {
      const checkout = Checkout.create({ storeId, cartId });

      const address: CheckoutAddress = {
        addressLine1: "123 Main St",
        addressLine2: "Apt 4B",
        city: "New York",
        state: "NY",
        postalCode: "10001",
        country: "US",
        firstName: "Jane",
        lastName: "Doe",
        phone: "+1234567890",
      };

      checkout.setShippingAddress(address);
      checkout.setBillingAddress(address);

      expect(checkout.shippingAddress).toEqual(address);
      expect(checkout.billingAddress).toEqual(address);
    });

    it("rejects invalid addresses with missing required fields", () => {
      expect(() =>
        validateCheckoutAddress({
          addressLine1: "",
          city: "New York",
          postalCode: "10001",
          country: "US",
        }),
      ).toThrow(InvalidCheckoutAddressError);

      expect(() =>
        validateCheckoutAddress({
          addressLine1: "123 Main St",
          city: "",
          postalCode: "10001",
          country: "US",
        }),
      ).toThrow(InvalidCheckoutAddressError);

      expect(() =>
        validateCheckoutAddress({
          addressLine1: "123 Main St",
          city: "New York",
          postalCode: "",
          country: "US",
        }),
      ).toThrow(InvalidCheckoutAddressError);

      expect(() =>
        validateCheckoutAddress({
          addressLine1: "123 Main St",
          city: "New York",
          postalCode: "10001",
          country: "",
        }),
      ).toThrow(InvalidCheckoutAddressError);

      expect(() => validateCheckoutAddress(null)).toThrow(InvalidCheckoutAddressError);
      expect(() => validateCheckoutAddress("string")).toThrow(InvalidCheckoutAddressError);
    });

    it("normalizes email to lowercase", () => {
      const checkout = Checkout.create({ storeId, cartId });
      checkout.setEmail(" Customer@Example.COM ");
      expect(checkout.email).toBe("customer@example.com");
    });
  });

  describe("Terminal State Protection & Immutability", () => {
    it("rejects modifying items once checkout is COMPLETED", () => {
      const checkout = Checkout.create({ storeId, cartId });
      checkout.addItem({
        variantId: variantId1,
        productNameSnapshot: "Item",
        variantNameSnapshot: "V",
        unitPrice: 1000,
        quantity: 1,
      });

      checkout.beginPayment();
      checkout.markCompleted();
      expect(checkout.status).toBe("COMPLETED");
      expect(checkout.isCompleted()).toBe(true);

      expect(() =>
        checkout.addItem({
          variantId: variantId2,
          productNameSnapshot: "Item 2",
          variantNameSnapshot: "V2",
          unitPrice: 2000,
          quantity: 1,
        }),
      ).toThrow(CheckoutAlreadyCompletedError);

      expect(() => checkout.updateItemQuantity(variantId1, 3)).toThrow(
        CheckoutAlreadyCompletedError,
      );
      expect(() => checkout.removeItem(variantId1)).toThrow(CheckoutAlreadyCompletedError);
      expect(() => checkout.clearItems()).toThrow(CheckoutAlreadyCompletedError);
      expect(() => checkout.setDiscountTotal(100)).toThrow(CheckoutAlreadyCompletedError);
      expect(() => checkout.setEmail("new@test.com")).toThrow(CheckoutAlreadyCompletedError);
    });

    it("rejects modifying items once checkout is EXPIRED", () => {
      const checkout = Checkout.create({ storeId, cartId });
      checkout.markExpired();
      expect(checkout.status).toBe("EXPIRED");

      expect(() =>
        checkout.addItem({
          variantId: variantId1,
          productNameSnapshot: "Item",
          variantNameSnapshot: "V",
          unitPrice: 1000,
          quantity: 1,
        }),
      ).toThrow(CheckoutExpiredError);
    });

    it("rejects modifying items once checkout is CANCELLED or FAILED", () => {
      const checkoutCancelled = Checkout.create({ storeId, cartId });
      checkoutCancelled.markCancelled();
      expect(() =>
        checkoutCancelled.addItem({
          variantId: variantId1,
          productNameSnapshot: "Item",
          variantNameSnapshot: "V",
          unitPrice: 1000,
          quantity: 1,
        }),
      ).toThrow(CheckoutNotEditableError);

      const checkoutFailed = Checkout.create({ storeId, cartId });
      checkoutFailed.markFailed();
      expect(() =>
        checkoutFailed.addItem({
          variantId: variantId1,
          productNameSnapshot: "Item",
          variantNameSnapshot: "V",
          unitPrice: 1000,
          quantity: 1,
        }),
      ).toThrow(CheckoutNotEditableError);
    });

    it("rejects transitions away from COMPLETED", () => {
      const checkout = Checkout.create({ storeId, cartId });
      checkout.beginPayment();
      checkout.markCompleted();

      expect(() => checkout.transitionTo("OPEN")).toThrow(InvalidCheckoutStateTransitionError);
      expect(() => checkout.transitionTo("PAYMENT_PENDING")).toThrow(
        InvalidCheckoutStateTransitionError,
      );
      expect(() => checkout.transitionTo("CANCELLED")).toThrow(InvalidCheckoutStateTransitionError);
    });
  });

  describe("Reconstitution", () => {
    it("correctly reconstitutes a checkout aggregate from persisted state", () => {
      const now = new Date();
      const expires = new Date(Date.now() + 3600_000);

      const item = new CheckoutItem({
        id: "item-1",
        checkoutId: "checkout-1",
        storeId,
        variantId: variantId1,
        productNameSnapshot: "P1",
        variantNameSnapshot: "V1",
        skuSnapshot: "SKU1",
        unitPrice: 2000,
        quantity: 2,
        createdAt: now,
        updatedAt: now,
      });

      const reconstituted = Checkout.reconstitute({
        id: "checkout-1",
        storeId,
        cartId,
        customerId: "cust-1",
        email: "user@test.com",
        status: "PAYMENT_PENDING",
        currency: "USD",
        subtotal: 4000,
        discountTotal: 500,
        taxTotal: 300,
        shippingTotal: 200,
        total: 4000,
        shippingAddress: null,
        billingAddress: null,
        paymentStatus: "PENDING",
        expiresAt: expires,
        createdAt: now,
        updatedAt: now,
        items: [item],
      });

      expect(reconstituted.id).toBe("checkout-1");
      expect(reconstituted.status).toBe("PAYMENT_PENDING");
      expect(reconstituted.subtotal).toBe(4000);
      expect(reconstituted.total).toBe(4000);
      expect(reconstituted.items).toHaveLength(1);
      expect(reconstituted.items[0]?.variantId).toBe(variantId1);
    });
  });

  describe("Domain Error Classes", () => {
    it("ensures domain errors inherit from CheckoutDomainError with appropriate status codes", () => {
      const error = new InvalidCheckoutStatusError("Status is invalid");
      expect(error).toBeInstanceOf(CheckoutDomainError);
      expect(error.code).toBe("INVALID_CHECKOUT_STATUS");
      expect(error.status).toBe(400);

      const notFound = new CheckoutItemNotFoundError();
      expect(notFound).toBeInstanceOf(CheckoutDomainError);
      expect(notFound.code).toBe("CHECKOUT_ITEM_NOT_FOUND");
      expect(notFound.status).toBe(404);

      const invalidItem = new InvalidCheckoutItemError();
      expect(invalidItem).toBeInstanceOf(CheckoutDomainError);
      expect(invalidItem.code).toBe("INVALID_CHECKOUT_ITEM");
      expect(invalidItem.status).toBe(400);
    });
  });

  describe("Adversarial Review Remediations (Task 4)", () => {
    it("throws InvalidCheckoutItemError when required snapshot fields are missing", () => {
      expect(
        () =>
          new CheckoutItem({
            checkoutId: "",
            storeId,
            variantId: variantId1,
            productNameSnapshot: "Product",
            variantNameSnapshot: "Variant",
            unitPrice: 1000,
            quantity: 1,
          }),
      ).toThrow(InvalidCheckoutItemError);

      expect(
        () =>
          new CheckoutItem({
            checkoutId: "chk-1",
            storeId: "",
            variantId: variantId1,
            productNameSnapshot: "Product",
            variantNameSnapshot: "Variant",
            unitPrice: 1000,
            quantity: 1,
          }),
      ).toThrow(InvalidCheckoutItemError);

      expect(
        () =>
          new CheckoutItem({
            checkoutId: "chk-1",
            storeId,
            variantId: "",
            productNameSnapshot: "Product",
            variantNameSnapshot: "Variant",
            unitPrice: 1000,
            quantity: 1,
          }),
      ).toThrow(InvalidCheckoutItemError);

      expect(
        () =>
          new CheckoutItem({
            checkoutId: "chk-1",
            storeId,
            variantId: variantId1,
            productNameSnapshot: "   ",
            variantNameSnapshot: "Variant",
            unitPrice: 1000,
            quantity: 1,
          }),
      ).toThrow(InvalidCheckoutItemError);
    });

    it("rejects non-safe integer or excessively large monetary amounts", () => {
      expect(() => validateMonetaryAmount(Number.MAX_SAFE_INTEGER + 100)).toThrow(
        InvalidCheckoutPriceError,
      );
      expect(() => validateMonetaryAmount(2_000_000_000_000)).toThrow(
        InvalidCheckoutPriceError,
      );
    });

    it("blocks modifications on past-due checkouts even before background worker runs", () => {
      const checkout = Checkout.create({
        storeId,
        cartId,
      });
      const past = new Date(Date.now() - 60_000);
      checkout.setExpiresAt(past);

      expect(checkout.isExpired()).toBe(true);
      expect(() =>
        checkout.addItem({
          variantId: variantId1,
          productNameSnapshot: "Product",
          variantNameSnapshot: "Variant",
          unitPrice: 1000,
          quantity: 1,
        }),
      ).toThrow(CheckoutExpiredError);

      expect(() => checkout.setDiscountTotal(100)).toThrow(CheckoutExpiredError);
      expect(() => checkout.setCustomer("cust-1")).toThrow(CheckoutExpiredError);
      expect(() => checkout.setEmail("test@test.com")).toThrow(CheckoutExpiredError);
    });

    it("blocks beginPayment and markCompleted on expired checkouts", () => {
      const checkout = Checkout.create({
        storeId,
        cartId,
      });
      const past = new Date(Date.now() - 60_000);
      checkout.setExpiresAt(past);

      expect(() => checkout.beginPayment()).toThrow(CheckoutExpiredError);
      expect(() => checkout.markCompleted()).toThrow(CheckoutExpiredError);
    });

    it("enforces arithmetic consistency between components and grand total in setTotals", () => {
      const checkout = Checkout.create({ storeId, cartId });
      // Inconsistent total (expected 1000 - 100 + 50 + 200 = 1150, but supplied 9999)
      expect(() => checkout.setTotals(1000, 100, 50, 200, 9999)).toThrow(
        InvalidCheckoutPriceError,
      );
      // Consistent total works
      expect(() => checkout.setTotals(1000, 100, 50, 200, 1150)).not.toThrow();
      expect(checkout.total).toBe(1150);
    });

    it("rejects subtotal that does not match sum of items in setTotals", () => {
      const checkout = Checkout.create({ storeId, cartId });
      checkout.addItem({
        variantId: variantId1,
        productNameSnapshot: "Product 1",
        variantNameSnapshot: "Variant 1",
        unitPrice: 2000,
        quantity: 2, // lineTotal: 4000
      });

      // Subtotal mismatch (supplied 5000 instead of 4000)
      expect(() => checkout.setTotals(5000, 0, 0, 0, 5000)).toThrow(
        InvalidCheckoutPriceError,
      );
      // Matching subtotal works
      expect(() => checkout.setTotals(4000, 0, 0, 0, 4000)).not.toThrow();
    });
  });
});

