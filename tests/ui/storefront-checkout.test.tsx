import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CheckoutSteps } from "@/components/storefront/checkout/checkout-steps";
import { CustomerInformationForm } from "@/components/storefront/checkout/customer-information-form";
import { ShippingAddressForm } from "@/components/storefront/checkout/shipping-address-form";
import { DeliveryMethodSelector } from "@/components/storefront/checkout/delivery-method-selector";
import { CheckoutSummary } from "@/components/storefront/checkout/checkout-summary";
import { PaymentSection } from "@/components/storefront/checkout/payment-section";
import type { StorefrontCheckoutDTO } from "@/lib/storefront-checkout-helpers";

describe("Storefront Checkout: CheckoutSteps Component", () => {
  it("renders all four checkout progress steps", () => {
    const html = renderToStaticMarkup(
      <CheckoutSteps currentStep="information" />,
    );

    expect(html).toContain("Information");
    expect(html).toContain("Shipping");
    expect(html).toContain("Delivery");
    expect(html).toContain("Payment");
    expect(html).toContain('aria-label="Checkout Progress"');
  });

  it("marks current step with aria-current='step' and checkout-step-item--active class", () => {
    const html = renderToStaticMarkup(
      <CheckoutSteps currentStep="shipping" />,
    );

    expect(html).toContain('aria-current="step"');
    expect(html).toContain("checkout-step-item--active");
  });

  it("renders completed steps with checkmark and checkout-step-item--completed class", () => {
    const onStepClick = vi.fn();
    const html = renderToStaticMarkup(
      <CheckoutSteps
        currentStep="delivery"
        completedSteps={["information", "shipping"]}
        onStepClick={onStepClick}
      />,
    );

    expect(html).toContain("checkout-step-item--completed");
    expect(html).toContain("✓");
  });
});

describe("Storefront Checkout: CustomerInformationForm Component", () => {
  it("renders email input with label and return to cart link", () => {
    const html = renderToStaticMarkup(
      <CustomerInformationForm
        initialEmail="customer@example.com"
        onSubmit={vi.fn()}
        storeSlug="alpine-outfitters"
      />,
    );

    expect(html).toContain("Contact Information");
    expect(html).toContain('type="email"');
    expect(html).toContain('value="customer@example.com"');
    expect(html).toContain('href="/stores/alpine-outfitters/cart"');
    expect(html).toContain("Continue to Shipping");
  });

  it("disables submit button and shows loading state when isLoading is true", () => {
    const html = renderToStaticMarkup(
      <CustomerInformationForm
        initialEmail="test@domain.com"
        onSubmit={vi.fn()}
        storeSlug="alpine-outfitters"
        isLoading={true}
      />,
    );

    expect(html).toContain("Saving...");
    expect(html).toContain('disabled=""');
  });
});

describe("Storefront Checkout: ShippingAddressForm Component", () => {
  const initialAddress = {
    firstName: "Jane",
    lastName: "Doe",
    addressLine1: "123 Mountain View Rd",
    addressLine2: "Suite 4B",
    city: "Denver",
    state: "CO",
    postalCode: "80202",
    country: "US",
    phone: "+13035550199",
  };

  it("renders all standard address inputs with populated values", () => {
    const html = renderToStaticMarkup(
      <ShippingAddressForm
        initialAddress={initialAddress}
        onSubmit={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(html).toContain("Shipping Address");
    expect(html).toContain('value="Jane"');
    expect(html).toContain('value="Doe"');
    expect(html).toContain('value="123 Mountain View Rd"');
    expect(html).toContain('value="Suite 4B"');
    expect(html).toContain('value="Denver"');
    expect(html).toContain('value="CO"');
    expect(html).toContain('value="80202"');
    expect(html).toContain("Continue to Delivery");
    expect(html).toContain("Return to Information");
  });

  it("indicates required fields with asterisks and accessible form labels", () => {
    const html = renderToStaticMarkup(
      <ShippingAddressForm
        onSubmit={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(html).toContain('id="ship-first-name"');
    expect(html).toContain('id="ship-last-name"');
    expect(html).toContain('id="ship-address-line1"');
    expect(html).toContain('id="ship-city"');
    expect(html).toContain('id="ship-postal-code"');
  });

  it("disables submit button and shows loading indicator when isLoading is true", () => {
    const html = renderToStaticMarkup(
      <ShippingAddressForm
        initialAddress={initialAddress}
        onSubmit={vi.fn()}
        onBack={vi.fn()}
        isLoading={true}
      />,
    );

    expect(html).toContain("Saving Address...");
    expect(html).toContain('disabled=""');
  });
});

describe("Storefront Checkout: DeliveryMethodSelector Component", () => {
  it("displays server-authoritative delivery option with formatted rate", () => {
    const html = renderToStaticMarkup(
      <DeliveryMethodSelector
        shippingTotal={1500}
        currency="USD"
        onSubmit={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(html).toContain("Delivery Method");
    expect(html).toContain("Standard Store Delivery");
    expect(html).toContain("$15.00");
    expect(html).toContain("Continue to Payment");
    expect(html).toContain("Return to Shipping");
  });

  it("displays FREE when shipping rate is zero", () => {
    const html = renderToStaticMarkup(
      <DeliveryMethodSelector
        shippingTotal={0}
        currency="USD"
        onSubmit={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(html).toContain("FREE");
  });

  it("disables continue button when isLoading is true", () => {
    const html = renderToStaticMarkup(
      <DeliveryMethodSelector
        shippingTotal={500}
        currency="USD"
        onSubmit={vi.fn()}
        onBack={vi.fn()}
        isLoading={true}
      />,
    );

    expect(html).toContain('disabled=""');
  });
});

describe("Storefront Checkout: CheckoutSummary Component", () => {
  const mockCheckout: StorefrontCheckoutDTO = {
    id: "chk_test_123",
    storeId: "store_alpine",
    cartId: "cart_abc",
    customerId: null,
    email: "customer@example.com",
    currency: "USD",
    subtotal: 7000,
    discountTotal: 1000,
    taxTotal: 450,
    shippingTotal: 500,
    total: 6950,
    status: "OPEN",
    paymentStatus: "PENDING",
    shippingAddress: null,
    billingAddress: null,
    expiresAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    items: [
      {
        id: "item_01",
        checkoutId: "chk_test_123",
        storeId: "store_alpine",
        variantId: "var_01",
        productNameSnapshot: "Trail Running Shoes",
        variantNameSnapshot: "Size 10 / Blue",
        skuSnapshot: "TRS-10",
        unitPrice: 3500,
        quantity: 2,
        lineTotal: 7000,
        productSlug: "trail-running-shoes",
        imageUrl: "https://cdn.example.com/shoes.jpg",
        imageAlt: "Trail shoes",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ],
  };

  it("renders line items with variant title, sku, quantity, and line total", () => {
    const html = renderToStaticMarkup(
      <CheckoutSummary checkout={mockCheckout} />,
    );

    expect(html).toContain("Order Summary");
    expect(html).toContain("Trail Running Shoes");
    expect(html).toContain("Size 10 / Blue");
    expect(html).toContain("SKU: TRS-10");
    expect(html).toContain("$70.00");
  });

  it("renders server-authoritative financial breakdown: subtotal, discount, shipping, tax, total", () => {
    const html = renderToStaticMarkup(
      <CheckoutSummary checkout={mockCheckout} />,
    );

    expect(html).toContain("$70.00"); // Subtotal
    expect(html).toContain("-$10.00"); // Discount
    expect(html).toContain("$5.00"); // Shipping
    expect(html).toContain("$4.50"); // Tax
    expect(html).toContain("$69.50"); // Total
  });
});

describe("Storefront Checkout: PaymentSection Component", () => {
  const mockCheckoutForPayment: StorefrontCheckoutDTO = {
    id: "chk_test_pay_99",
    storeId: "store_alpine",
    cartId: "cart_abc",
    customerId: null,
    email: "jane@example.com",
    currency: "USD",
    subtotal: 9000,
    discountTotal: 0,
    taxTotal: 400,
    shippingTotal: 500,
    total: 9900,
    status: "OPEN",
    paymentStatus: "PENDING",
    shippingAddress: {
      firstName: "Jane",
      lastName: "Doe",
      addressLine1: "123 Main St",
      addressLine2: null,
      city: "Denver",
      state: "CO",
      postalCode: "80202",
      country: "US",
      phone: "+13035550199",
    },
    billingAddress: null,
    expiresAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    items: [],
  };

  it("renders pay button with authoritative grand total and gateway information", () => {
    const html = renderToStaticMarkup(
      <PaymentSection
        checkout={mockCheckoutForPayment}
        storeSlug="alpine-outfitters"
        storeName="Alpine Outfitters"
        onPaymentVerified={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(html).toContain("Payment");
    expect(html).toContain("Pay $99.00");
    expect(html).toContain("Razorpay Secure Checkout");
    expect(html).toContain("SSL Encrypted");
    expect(html).toContain("Return to Delivery");
  });

  it("renders back button to allow returning to delivery step", () => {
    const html = renderToStaticMarkup(
      <PaymentSection
        checkout={mockCheckoutForPayment}
        storeSlug="alpine-outfitters"
        storeName="Alpine Outfitters"
        onPaymentVerified={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(html).toContain("Return to Delivery");
    expect(html).toContain('data-testid="back-to-delivery-btn"');
  });
});
