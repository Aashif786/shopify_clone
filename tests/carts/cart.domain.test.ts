import { describe, expect, it } from "vitest";
import {
  assertValidCartTransition,
  calculateLineSubtotal,
  Cart,
  CartAccessDeniedError,
  CartAlreadyConvertedError,
  CartCheckoutInvalidError,
  CartDomainError,
  CartExpiredError,
  CartItemNotFoundError,
  CartNotActiveError,
  CartNotEditableError,
  CartNotFoundError,
  createCartItem,
  CrossStoreCartAccessError,
  CrossStoreCustomerError,
  CrossStoreVariantError,
  DEFAULT_MAX_CART_ITEM_QUANTITY,
  DuplicateCartItemError,
  InvalidCartPriceError,
  InvalidCartStateTransitionError,
  InvalidCartStatusError,
  InvalidCurrencyError,
  InvalidQuantityError,
  isCartEditable,
  isValidCartStatus,
  isValidCartTransition,
  ProductVariantNotFoundError,
  ProductVariantUnavailableError,
  VALID_CART_STATUSES,
  VALID_CART_TRANSITIONS,
  validateCartCurrency,
  validateCartQuantity,
  validateCartUnitPrice,
  validateMonetaryAmount,
} from "@shopify-clone/carts";

describe("Carts Domain Model & Invariants", () => {
  const storeId = "018f4a12-0000-7000-8000-000000000001";
  const variantId1 = "018f4a12-0000-7000-8000-000000000010";
  const variantId2 = "018f4a12-0000-7000-8000-000000000020";

  describe("Cart Lifecycle & State Transitions", () => {
    it("recognizes all valid cart statuses", () => {
      expect(VALID_CART_STATUSES).toEqual([
        "ACTIVE",
        "CONVERTED",
        "ABANDONED",
        "EXPIRED",
      ]);
      expect(isValidCartStatus("ACTIVE")).toBe(true);
      expect(isValidCartStatus("CONVERTED")).toBe(true);
      expect(isValidCartStatus("ABANDONED")).toBe(true);
      expect(isValidCartStatus("EXPIRED")).toBe(true);
      expect(isValidCartStatus("DRAFT")).toBe(false);
      expect(isValidCartStatus("PENDING")).toBe(false);
      expect(isValidCartStatus(null)).toBe(false);
    });

    it("permits legal transitions from ACTIVE", () => {
      expect(VALID_CART_TRANSITIONS.ACTIVE).toContain("CONVERTED");
      expect(VALID_CART_TRANSITIONS.ACTIVE).toContain("ABANDONED");
      expect(VALID_CART_TRANSITIONS.ACTIVE).toContain("EXPIRED");
      expect(isValidCartTransition("ACTIVE", "CONVERTED")).toBe(true);
      expect(isValidCartTransition("ACTIVE", "ABANDONED")).toBe(true);
      expect(isValidCartTransition("ACTIVE", "EXPIRED")).toBe(true);
      expect(isValidCartTransition("ACTIVE", "ACTIVE")).toBe(true);

      expect(() => assertValidCartTransition("ACTIVE", "CONVERTED")).not.toThrow();
      expect(() => assertValidCartTransition("ACTIVE", "ABANDONED")).not.toThrow();
      expect(() => assertValidCartTransition("ACTIVE", "EXPIRED")).not.toThrow();
    });


    it("rejects transitions away from terminal states", () => {
      expect(isValidCartTransition("CONVERTED", "ACTIVE")).toBe(false);
      expect(isValidCartTransition("ABANDONED", "ACTIVE")).toBe(false);
      expect(isValidCartTransition("EXPIRED", "ACTIVE")).toBe(false);
      expect(isValidCartTransition("CONVERTED", "EXPIRED")).toBe(false);

      expect(() => assertValidCartTransition("CONVERTED", "ACTIVE")).toThrow(
        InvalidCartStateTransitionError,
      );
      expect(() => assertValidCartTransition("ABANDONED", "ACTIVE")).toThrow(
        InvalidCartStateTransitionError,
      );
      expect(() => assertValidCartTransition("EXPIRED", "ACTIVE")).toThrow(
        InvalidCartStateTransitionError,
      );
    });

    it("determines cart editability strictly for ACTIVE state", () => {
      expect(isCartEditable("ACTIVE")).toBe(true);
      expect(isCartEditable("CONVERTED")).toBe(false);
      expect(isCartEditable("ABANDONED")).toBe(false);
      expect(isCartEditable("EXPIRED")).toBe(false);
    });
  });

  describe("Quantity & Pricing Validation", () => {
    it("validates valid positive integer quantities", () => {
      expect(validateCartQuantity(1)).toBe(1);
      expect(validateCartQuantity(5)).toBe(5);
      expect(validateCartQuantity(DEFAULT_MAX_CART_ITEM_QUANTITY)).toBe(
        DEFAULT_MAX_CART_ITEM_QUANTITY,
      );
    });

    it("rejects non-positive, floating-point, NaN, and negative quantities", () => {
      expect(() => validateCartQuantity(0)).toThrow(InvalidQuantityError);
      expect(() => validateCartQuantity(-1)).toThrow(InvalidQuantityError);
      expect(() => validateCartQuantity(1.5)).toThrow(InvalidQuantityError);
      expect(() => validateCartQuantity(NaN)).toThrow(InvalidQuantityError);
      expect(() => validateCartQuantity("2")).toThrow(InvalidQuantityError);
      expect(() => validateCartQuantity(null)).toThrow(InvalidQuantityError);
    });

    it("rejects quantities exceeding maximum allowed threshold", () => {
      expect(() => validateCartQuantity(1000)).toThrow(InvalidQuantityError);
      expect(() => validateCartQuantity(10, 5)).toThrow(InvalidQuantityError);
    });

    it("validates valid integer minor-unit prices", () => {
      expect(validateCartUnitPrice(0)).toBe(0);
      expect(validateCartUnitPrice(1999)).toBe(1999);
      expect(validateCartUnitPrice(100000)).toBe(100000);
    });

    it("rejects floating-point, negative, and non-integer prices", () => {
      expect(() => validateCartUnitPrice(19.99)).toThrow(InvalidCartPriceError);
      expect(() => validateCartUnitPrice(-100)).toThrow(InvalidCartPriceError);
      expect(() => validateCartUnitPrice(NaN)).toThrow(InvalidCartPriceError);
      expect(() => validateCartUnitPrice("500")).toThrow(InvalidCartPriceError);
    });

    it("calculates line subtotal correctly as quantity * unitPrice", () => {
      expect(calculateLineSubtotal(3, 1500)).toBe(4500);
      expect(calculateLineSubtotal(1, 0)).toBe(0);
    });

    it("validates monetary amounts accurately", () => {
      expect(validateMonetaryAmount(0)).toBe(0);
      expect(validateMonetaryAmount(500)).toBe(500);
      expect(() => validateMonetaryAmount(-10)).toThrow(InvalidCartPriceError);
      expect(() => validateMonetaryAmount(10.5)).toThrow(InvalidCartPriceError);
    });

    it("creates standalone CartItem via createCartItem factory", () => {
      const item = createCartItem({
        cartId: "018f4a12-0000-7000-8000-000000000099",
        storeId,
        variantId: variantId1,
        quantity: 3,
        unitPrice: 1200,
      });

      expect(item.id).toBeDefined();
      expect(item.quantity).toBe(3);
      expect(item.unitPrice).toBe(1200);
      expect(item.lineSubtotal).toBe(3600);
    });
  });


  describe("Currency Validation", () => {
    it("validates 3-character uppercase ISO currency codes", () => {
      expect(validateCartCurrency("USD")).toBe("USD");
      expect(validateCartCurrency("EUR")).toBe("EUR");
      expect(validateCartCurrency("INR")).toBe("INR");
    });

    it("rejects lowercase, untrimmed, or non-3-char currency codes", () => {
      expect(() => validateCartCurrency("usd")).toThrow(InvalidCurrencyError);
      expect(() => validateCartCurrency(" USD ")).toThrow(InvalidCurrencyError);
      expect(() => validateCartCurrency("US")).toThrow(InvalidCurrencyError);
      expect(() => validateCartCurrency("USDT")).toThrow(InvalidCurrencyError);
      expect(() => validateCartCurrency(123)).toThrow(InvalidCurrencyError);
    });
  });

  describe("Cart Creation & Basic Properties", () => {
    it("creates active cart with zero totals and specified store ownership", () => {
      const cart = Cart.create({ storeId });

      expect(cart.id).toBeDefined();
      expect(cart.storeId).toBe(storeId);
      expect(cart.customerId).toBeNull();
      expect(cart.guestIdentifier).toBeNull();
      expect(cart.status).toBe("ACTIVE");
      expect(cart.currency).toBe("USD");
      expect(cart.subtotal).toBe(0);
      expect(cart.discountTotal).toBe(0);
      expect(cart.taxTotal).toBe(0);
      expect(cart.shippingTotal).toBe(0);
      expect(cart.grandTotal).toBe(0);
      expect(cart.items).toHaveLength(0);
    });

    it("creates guest cart with guest identifier", () => {
      const cart = Cart.create({
        storeId,
        guestIdentifier: "guest-session-123",
      });

      expect(cart.guestIdentifier).toBe("guest-session-123");
      expect(cart.customerId).toBeNull();
    });

    it("creates customer cart with customer association", () => {
      const customerId = "018f4a12-0000-7000-8000-000000000005";
      const cart = Cart.create({ storeId, customerId });

      expect(cart.customerId).toBe(customerId);
    });
  });

  describe("Cart Item Operations", () => {
    it("adds item and recalculates subtotal and grandTotal", () => {
      const cart = Cart.create({ storeId });

      const item = cart.addItem({
        variantId: variantId1,
        quantity: 2,
        unitPrice: 1500,
      });

      expect(item.variantId).toBe(variantId1);
      expect(item.quantity).toBe(2);
      expect(item.unitPrice).toBe(1500);
      expect(item.lineSubtotal).toBe(3000);

      expect(cart.items).toHaveLength(1);
      expect(cart.subtotal).toBe(3000);
      expect(cart.grandTotal).toBe(3000);
    });

    it("increments quantity when duplicate variant is added (does not create second line item)", () => {
      const cart = Cart.create({ storeId });

      cart.addItem({ variantId: variantId1, quantity: 2, unitPrice: 1500 });
      const updated = cart.addItem({ variantId: variantId1, quantity: 3, unitPrice: 1500 });

      expect(cart.items).toHaveLength(1);
      expect(updated.quantity).toBe(5);
      expect(updated.lineSubtotal).toBe(7500);
      expect(cart.subtotal).toBe(7500);
      expect(cart.grandTotal).toBe(7500);
    });

    it("updates item quantity and recalculates totals", () => {
      const cart = Cart.create({ storeId });
      cart.addItem({ variantId: variantId1, quantity: 2, unitPrice: 2000 });

      const updated = cart.updateItemQuantity(variantId1, 4);

      expect(updated?.quantity).toBe(4);
      expect(updated?.lineSubtotal).toBe(8000);
      expect(cart.subtotal).toBe(8000);
      expect(cart.grandTotal).toBe(8000);
    });

    it("removes item when quantity is updated to 0", () => {
      const cart = Cart.create({ storeId });
      cart.addItem({ variantId: variantId1, quantity: 2, unitPrice: 2000 });

      const result = cart.updateItemQuantity(variantId1, 0);

      expect(result).toBeNull();
      expect(cart.items).toHaveLength(0);
      expect(cart.subtotal).toBe(0);
      expect(cart.grandTotal).toBe(0);
    });

    it("throws InvalidQuantityError when updating quantity to negative number", () => {
      const cart = Cart.create({ storeId });
      cart.addItem({ variantId: variantId1, quantity: 2, unitPrice: 2000 });

      expect(() => cart.updateItemQuantity(variantId1, -1)).toThrow(
        InvalidQuantityError,
      );
    });

    it("throws CartItemNotFoundError when updating non-existent variant", () => {
      const cart = Cart.create({ storeId });
      expect(() => cart.updateItemQuantity("non-existent-var", 3)).toThrow(
        CartItemNotFoundError,
      );
    });

    it("removes item by variantId and recalculates totals", () => {
      const cart = Cart.create({ storeId });
      cart.addItem({ variantId: variantId1, quantity: 1, unitPrice: 1000 });
      cart.addItem({ variantId: variantId2, quantity: 2, unitPrice: 2000 });

      expect(cart.subtotal).toBe(5000);

      cart.removeItem(variantId1);

      expect(cart.items).toHaveLength(1);
      expect(cart.getItem(variantId1)).toBeUndefined();
      expect(cart.getItem(variantId2)).toBeDefined();
      expect(cart.subtotal).toBe(4000);
    });

    it("removes item by itemId and recalculates totals", () => {
      const cart = Cart.create({ storeId });
      const item1 = cart.addItem({ variantId: variantId1, quantity: 1, unitPrice: 1000 });
      cart.addItem({ variantId: variantId2, quantity: 2, unitPrice: 2000 });

      cart.removeItemById(item1.id);

      expect(cart.items).toHaveLength(1);
      expect(cart.getItemById(item1.id)).toBeUndefined();
      expect(cart.subtotal).toBe(4000);
    });

    it("throws CartItemNotFoundError when removing non-existent item", () => {
      const cart = Cart.create({ storeId });
      expect(() => cart.removeItem("missing-variant")).toThrow(CartItemNotFoundError);
      expect(() => cart.removeItemById("missing-id")).toThrow(CartItemNotFoundError);
    });

    it("clears all items and resets totals to zero", () => {
      const cart = Cart.create({ storeId });
      cart.addItem({ variantId: variantId1, quantity: 1, unitPrice: 1000 });
      cart.addItem({ variantId: variantId2, quantity: 2, unitPrice: 2000 });

      cart.clear();

      expect(cart.items).toHaveLength(0);
      expect(cart.subtotal).toBe(0);
      expect(cart.grandTotal).toBe(0);
    });
  });

  describe("Customer & Guest Association", () => {
    it("assigns and removes customer association", () => {
      const cart = Cart.create({ storeId });
      const customerId = "018f4a12-0000-7000-8000-000000000099";

      cart.assignCustomer(customerId);
      expect(cart.customerId).toBe(customerId);

      cart.removeCustomer();
      expect(cart.customerId).toBeNull();
    });

    it("assigns guest session identifier", () => {
      const cart = Cart.create({ storeId });
      cart.assignGuest("session_abc123");
      expect(cart.guestIdentifier).toBe("session_abc123");
    });
  });

  describe("Total Calculations with Discounts, Tax, and Shipping", () => {
    it("calculates grandTotal including discount, tax, and shipping", () => {
      const cart = Cart.create({ storeId });
      cart.addItem({ variantId: variantId1, quantity: 2, unitPrice: 5000 }); // subtotal = 10000

      cart.setTotals({
        discountTotal: 1500,
        taxTotal: 800,
        shippingTotal: 500,
      });

      // grandTotal = 10000 - 1500 + 800 + 500 = 9800
      expect(cart.subtotal).toBe(10000);
      expect(cart.discountTotal).toBe(1500);
      expect(cart.taxTotal).toBe(800);
      expect(cart.shippingTotal).toBe(500);
      expect(cart.grandTotal).toBe(9800);
    });

    it("ensures grandTotal is never negative even if discount exceeds subtotal", () => {
      const cart = Cart.create({ storeId });
      cart.addItem({ variantId: variantId1, quantity: 1, unitPrice: 1000 });

      cart.setTotals({ discountTotal: 5000 });

      expect(cart.subtotal).toBe(1000);
      expect(cart.grandTotal).toBe(0);
    });
  });

  describe("Terminal State Enforcement & Immutability", () => {
    it("prevents mutating CONVERTED cart", () => {
      const cart = Cart.create({ storeId });
      cart.addItem({ variantId: variantId1, quantity: 1, unitPrice: 1000 });
      cart.markConverted();

      expect(cart.status).toBe("CONVERTED");

      expect(() => cart.addItem({ variantId: variantId2, quantity: 1, unitPrice: 500 })).toThrow(
        CartAlreadyConvertedError,
      );
      expect(() => cart.updateItemQuantity(variantId1, 3)).toThrow(
        CartAlreadyConvertedError,
      );
      expect(() => cart.removeItem(variantId1)).toThrow(CartAlreadyConvertedError);
      expect(() => cart.clear()).toThrow(CartAlreadyConvertedError);
      expect(() => cart.assignCustomer("c1")).toThrow(CartAlreadyConvertedError);
    });

    it("prevents mutating EXPIRED cart", () => {
      const cart = Cart.create({ storeId });
      cart.addItem({ variantId: variantId1, quantity: 1, unitPrice: 1000 });
      cart.markExpired();

      expect(cart.status).toBe("EXPIRED");

      expect(() => cart.addItem({ variantId: variantId2, quantity: 1, unitPrice: 500 })).toThrow(
        CartExpiredError,
      );
      expect(() => cart.updateItemQuantity(variantId1, 2)).toThrow(CartExpiredError);
      expect(() => cart.removeItem(variantId1)).toThrow(CartExpiredError);
      expect(() => cart.clear()).toThrow(CartExpiredError);
    });

    it("prevents mutating ABANDONED cart", () => {
      const cart = Cart.create({ storeId });
      cart.markAbandoned();

      expect(cart.status).toBe("ABANDONED");

      expect(() => cart.addItem({ variantId: variantId1, quantity: 1, unitPrice: 500 })).toThrow(
        CartNotEditableError,
      );
    });
  });

  describe("Domain Errors Hierarchy & Codes", () => {
    it("provides stable error codes and HTTP status mappings", () => {
      const notFound = new CartNotFoundError("Cart not found", { id: "c1" });
      expect(notFound).toBeInstanceOf(CartDomainError);
      expect(notFound.code).toBe("CART_NOT_FOUND");
      expect(notFound.status).toBe(404);

      const accessDenied = new CartAccessDeniedError();
      expect(accessDenied.code).toBe("CART_ACCESS_DENIED");
      expect(accessDenied.status).toBe(403);

      const crossStore = new CrossStoreCartAccessError();
      expect(crossStore.code).toBe("CART_ACCESS_DENIED");
      expect(crossStore.status).toBe(403);

      const notActive = new CartNotActiveError();
      expect(notActive.code).toBe("CART_NOT_ACTIVE");
      expect(notActive.status).toBe(400);

      const converted = new CartAlreadyConvertedError();
      expect(converted.code).toBe("CART_ALREADY_CONVERTED");
      expect(converted.status).toBe(400);

      const expired = new CartExpiredError();
      expect(expired.code).toBe("CART_EXPIRED");
      expect(expired.status).toBe(400);

      const invalidStatus = new InvalidCartStatusError();
      expect(invalidStatus.code).toBe("INVALID_CART_STATUS");
      expect(invalidStatus.status).toBe(400);

      const itemNotFound = new CartItemNotFoundError();
      expect(itemNotFound.code).toBe("CART_ITEM_NOT_FOUND");
      expect(itemNotFound.status).toBe(404);

      const invalidQty = new InvalidQuantityError();
      expect(invalidQty.code).toBe("INVALID_QUANTITY");
      expect(invalidQty.status).toBe(400);

      const invalidCurrency = new InvalidCurrencyError();
      expect(invalidCurrency.code).toBe("INVALID_CURRENCY");
      expect(invalidCurrency.status).toBe(400);

      const duplicateItem = new DuplicateCartItemError();
      expect(duplicateItem.code).toBe("DUPLICATE_CART_ITEM");
      expect(duplicateItem.status).toBe(409);

      const variantNotFound = new ProductVariantNotFoundError();
      expect(variantNotFound.code).toBe("PRODUCT_VARIANT_NOT_FOUND");
      expect(variantNotFound.status).toBe(404);

      const variantUnavailable = new ProductVariantUnavailableError();
      expect(variantUnavailable.code).toBe("PRODUCT_VARIANT_UNAVAILABLE");
      expect(variantUnavailable.status).toBe(400);

      const crossVariant = new CrossStoreVariantError();
      expect(crossVariant.code).toBe("CROSS_STORE_VARIANT");
      expect(crossVariant.status).toBe(400);

      const crossCustomer = new CrossStoreCustomerError();
      expect(crossCustomer.code).toBe("CROSS_STORE_CUSTOMER");
      expect(crossCustomer.status).toBe(400);

      const checkoutInvalid = new CartCheckoutInvalidError();
      expect(checkoutInvalid.code).toBe("CART_CHECKOUT_INVALID");
      expect(checkoutInvalid.status).toBe(400);

      const invalidPrice = new InvalidCartPriceError();
      expect(invalidPrice.code).toBe("INVALID_PRICE");
      expect(invalidPrice.status).toBe(400);
    });
  });
});
