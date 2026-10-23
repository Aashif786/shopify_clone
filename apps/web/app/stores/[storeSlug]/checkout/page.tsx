"use client";

import React, { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { CartProvider, useCart } from "../../../../src/context/cart-context";
import { StorefrontShell } from "../../../../src/components/storefront/StorefrontShell";
import { CheckoutSteps, type CheckoutStep } from "../../../../src/components/storefront/checkout/checkout-steps";
import { CustomerInformationForm } from "../../../../src/components/storefront/checkout/customer-information-form";
import { ShippingAddressForm } from "../../../../src/components/storefront/checkout/shipping-address-form";
import { DeliveryMethodSelector } from "../../../../src/components/storefront/checkout/delivery-method-selector";
import { PaymentSection } from "../../../../src/components/storefront/checkout/payment-section";
import { CheckoutSummary } from "../../../../src/components/storefront/checkout/checkout-summary";
import type { StorefrontCheckoutDTO } from "../../../../src/lib/storefront-checkout-helpers";
import type { AppliedDiscountDTO } from "../../../../src/lib/storefront-discount-helpers";
import type { CheckoutAddressDTO } from "@shopify-clone/checkout";
import { apiClient } from "../../../../src/lib/api-client";
import { Alert, Button, Spinner } from "@shopify-clone/ui";

interface CheckoutPageProps {
  params: Promise<{ storeSlug: string }>;
}

interface InitCheckoutApiResponse {
  checkout: StorefrontCheckoutDTO;
  store: { id: string; name: string; slug: string; currency: string };
}

function CheckoutView({ storeSlug, storeName }: { storeSlug: string; storeName: string }) {
  const router = useRouter();
  const { cart, isLoading: isCartLoading, clearCart, appliedDiscount: cartAppliedDiscount } = useCart();

  const [checkout, setCheckout] = useState<StorefrontCheckoutDTO | null>(null);
  const [currentStep, setCurrentStep] = useState<CheckoutStep>("information");
  const [completedSteps, setCompletedSteps] = useState<CheckoutStep[]>([]);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutDiscount, setCheckoutDiscount] = useState<AppliedDiscountDTO | null>(null);
  const [isDiscountLoading, setIsDiscountLoading] = useState<boolean>(false);
  const [guestToken, setGuestToken] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(`sc_${storeSlug}_guest_token`);
    }
    return null;
  });
  const guestTokenRef = React.useRef(guestToken);
  guestTokenRef.current = guestToken;
  const initializedCartIdRef = React.useRef<string | null>(null);

  // 1. Initialize checkout from active cart
  const initializeCheckout = useCallback(async () => {
    if (!cart?.id || cart.items.length === 0) {
      setIsInitializing(false);
      return;
    }

    if (initializedCartIdRef.current === cart.id && checkout) {
      setIsInitializing(false);
      return;
    }

    setIsInitializing(true);
    setError(null);
    try {
      const guestId =
        typeof window !== "undefined"
          ? localStorage.getItem(`sc_${storeSlug}_guest_id`)
          : null;
      const storedGuestToken =
        guestTokenRef.current ||
        (typeof window !== "undefined"
          ? localStorage.getItem(`sc_${storeSlug}_guest_token`)
          : null);
      const headers: Record<string, string> = {};
      if (guestId) {
        headers["x-guest-identifier"] = guestId;
      }
      if (storedGuestToken) {
        headers["x-guest-token"] = storedGuestToken;
      }

      const res = await apiClient.post<InitCheckoutApiResponse>(
        `/api/v1/storefront/${encodeURIComponent(storeSlug)}/checkout`,
        { cartId: cart.id, guestIdentifier: guestId || undefined },
        { headers },
      );

      initializedCartIdRef.current = cart.id;
      const activeToken = res.checkout.guestToken || storedGuestToken;
      setCheckout({ ...res.checkout, guestToken: activeToken });
      if (activeToken) {
        setGuestToken(activeToken);
        guestTokenRef.current = activeToken;
        if (typeof window !== "undefined") {
          localStorage.setItem(`sc_${storeSlug}_guest_token`, activeToken);
        }
      }

      // Determine initial step based on saved state
      const completed: CheckoutStep[] = [];
      if (res.checkout.email) {
        completed.push("information");
      }
      if (res.checkout.shippingAddress) {
        completed.push("shipping");
      }
      setCompletedSteps(completed);

      if (res.checkout.shippingAddress) {
        setCurrentStep("delivery");
      } else if (res.checkout.email) {
        setCurrentStep("shipping");
      } else {
        setCurrentStep("information");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to initialize checkout session";
      setError(msg);
    } finally {
      setIsInitializing(false);
    }
  }, [cart?.id, cart?.items?.length, checkout, storeSlug]);

  useEffect(() => {
    if (!isCartLoading) {
      initializeCheckout();
    }
  }, [isCartLoading, initializeCheckout]);

  // Handle Step 1: Customer Info
  const handleEmailSubmit = async (email: string) => {
    if (!checkout) return;
    setIsSaving(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      const token =
        guestToken ||
        checkout.guestToken ||
        (typeof window !== "undefined"
          ? localStorage.getItem(`sc_${storeSlug}_guest_token`)
          : null);
      if (token) {
        headers["x-guest-token"] = token;
      }

      const res = await apiClient.patch<InitCheckoutApiResponse>(
        `/api/v1/storefront/${encodeURIComponent(storeSlug)}/checkout/${encodeURIComponent(checkout.id)}`,
        { email },
        { headers },
      );
      const activeToken = token || res.checkout.guestToken;
      setCheckout({ ...res.checkout, guestToken: activeToken });
      if (activeToken) {
        setGuestToken(activeToken);
        if (typeof window !== "undefined") {
          localStorage.setItem(`sc_${storeSlug}_guest_token`, activeToken);
        }
      }
      setCompletedSteps((prev) => Array.from(new Set([...prev, "information"])));
      setCurrentStep("shipping");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save contact information");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Step 2: Shipping Address
  const handleAddressSubmit = async (shippingAddress: CheckoutAddressDTO) => {
    if (!checkout) return;
    setIsSaving(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      const token =
        guestToken ||
        checkout.guestToken ||
        (typeof window !== "undefined"
          ? localStorage.getItem(`sc_${storeSlug}_guest_token`)
          : null);
      if (token) {
        headers["x-guest-token"] = token;
      }

      const res = await apiClient.patch<InitCheckoutApiResponse>(
        `/api/v1/storefront/${encodeURIComponent(storeSlug)}/checkout/${encodeURIComponent(checkout.id)}`,
        { shippingAddress },
        { headers },
      );
      const activeToken = token || res.checkout.guestToken;
      setCheckout({ ...res.checkout, guestToken: activeToken });
      if (activeToken) {
        setGuestToken(activeToken);
        if (typeof window !== "undefined") {
          localStorage.setItem(`sc_${storeSlug}_guest_token`, activeToken);
        }
      }
      setCompletedSteps((prev) => Array.from(new Set([...prev, "information", "shipping"])));
      setCurrentStep("delivery");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save shipping address");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Step 3: Delivery Method
  const handleDeliverySubmit = () => {
    setCompletedSteps((prev) => Array.from(new Set([...prev, "information", "shipping", "delivery"])));
    setCurrentStep("payment");
  };

  // Handle Step 4: Payment Verified -> Order Created
  const handlePaymentVerified = async (orderId: string) => {
    // Clear local cart now that order is confirmed
    await clearCart().catch(() => {});
    const token =
      guestToken ||
      checkout?.guestToken ||
      (typeof window !== "undefined"
        ? localStorage.getItem(`sc_${storeSlug}_guest_token`)
        : null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(`sc_${storeSlug}_guest_token`);
    }
    const query = token ? `?guestToken=${encodeURIComponent(token)}` : "";
    // Redirect to order confirmation
    router.push(`/stores/${encodeURIComponent(storeSlug)}/orders/${encodeURIComponent(orderId)}/confirmation${query}`);
  };

  // Handle Checkout Discount Application
  const handleApplyDiscount = async (code: string) => {
    if (!checkout) return;
    setIsDiscountLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      const token =
        guestToken ||
        checkout.guestToken ||
        (typeof window !== "undefined"
          ? localStorage.getItem(`sc_${storeSlug}_guest_token`)
          : null);
      if (token) {
        headers["x-guest-token"] = token;
      }

      const res = await apiClient.post<{
        checkout: StorefrontCheckoutDTO;
        discount: AppliedDiscountDTO;
      }>(
        `/api/v1/storefront/${encodeURIComponent(storeSlug)}/checkout/${encodeURIComponent(checkout.id)}/discount`,
        { code },
        { headers },
      );
      const activeToken = token || res.checkout.guestToken;
      setCheckout({ ...res.checkout, guestToken: activeToken });
      setCheckoutDiscount(res.discount);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to apply discount code";
      setError(msg);
      throw err;
    } finally {
      setIsDiscountLoading(false);
    }
  };

  // Handle Checkout Discount Removal
  const handleRemoveDiscount = async () => {
    if (!checkout) return;
    setIsDiscountLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      const token =
        guestToken ||
        checkout.guestToken ||
        (typeof window !== "undefined"
          ? localStorage.getItem(`sc_${storeSlug}_guest_token`)
          : null);
      if (token) {
        headers["x-guest-token"] = token;
      }

      const res = await apiClient.delete<{
        checkout: StorefrontCheckoutDTO;
      }>(
        `/api/v1/storefront/${encodeURIComponent(storeSlug)}/checkout/${encodeURIComponent(checkout.id)}/discount`,
        { headers },
      );
      const activeToken = token || res.checkout.guestToken;
      setCheckout({ ...res.checkout, guestToken: activeToken });
      setCheckoutDiscount(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to remove discount";
      setError(msg);
    } finally {
      setIsDiscountLoading(false);
    }
  };

  const catalogHref = `/stores/${encodeURIComponent(storeSlug)}/products`;

  return (
    <StorefrontShell storeName={storeName} storeSlug={storeSlug}>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <div className="storefront-checkout-container" data-testid="checkout-page-container" style={{ maxWidth: "1100px", margin: "0 auto", padding: "var(--space-6) var(--space-4)" }}>
        {/* Loading State */}
        {(isCartLoading || isInitializing) && (
          <div className="storefront-grid-state text-center" style={{ padding: "var(--space-12) 0" }} data-testid="checkout-loading">
            <Spinner size="lg" />
            <p className="text-muted" style={{ marginTop: "var(--space-3)" }}>
              Preparing your secure checkout...
            </p>
          </div>
        )}

        {/* Empty Cart State */}
        {!isCartLoading && !isInitializing && (!cart || cart.items.length === 0) && (
          <div className="storefront-cart-empty-state card text-center" style={{ padding: "var(--space-12) var(--space-4)" }} data-testid="checkout-empty-cart">
            <div style={{ fontSize: "3rem", marginBottom: "var(--space-3)" }} aria-hidden="true">
              CART
            </div>
            <h2 className="font-bold text-xl" style={{ margin: "0 0 var(--space-2) 0" }}>
              Your cart is empty
            </h2>
            <p className="text-muted text-sm" style={{ marginBottom: "var(--space-6)" }}>
              You must have at least one product in your cart before proceeding to checkout.
            </p>
            <a href={catalogHref} className="btn btn-primary btn-md">
              Browse Products
            </a>
          </div>
        )}

        {/* Active Checkout Layout */}
        {!isCartLoading && !isInitializing && checkout && checkout.items.length > 0 && (
          <div
            className="storefront-checkout-layout"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 400px",
              gap: "var(--space-8)",
              alignItems: "flex-start",
            }}
          >
            {/* Left Column: Progress & Forms */}
            <div className="checkout-main-column" style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
              {/* Stepper */}
              <CheckoutSteps
                currentStep={currentStep}
                completedSteps={completedSteps}
                onStepClick={(step) => setCurrentStep(step)}
              />

              {/* Error banner */}
              {error && (
                <Alert
                  variant="danger"
                  title="Checkout Notice"
                  action={
                    <Button variant="outline" size="sm" onClick={() => setError(null)}>
                      Dismiss
                    </Button>
                  }
                >
                  {error}
                </Alert>
              )}

              {/* Active Step Panel */}
              <div className="checkout-step-panel card" style={{ padding: "var(--space-6)" }}>
                {currentStep === "information" && (
                  <CustomerInformationForm
                    initialEmail={checkout.email}
                    onSubmit={handleEmailSubmit}
                    isLoading={isSaving}
                    storeSlug={storeSlug}
                  />
                )}

                {currentStep === "shipping" && (
                  <ShippingAddressForm
                    initialAddress={checkout.shippingAddress}
                    onSubmit={handleAddressSubmit}
                    onBack={() => setCurrentStep("information")}
                    isLoading={isSaving}
                  />
                )}

                {currentStep === "delivery" && (
                  <DeliveryMethodSelector
                    shippingTotal={checkout.shippingTotal}
                    currency={checkout.currency}
                    onSubmit={handleDeliverySubmit}
                    onBack={() => setCurrentStep("shipping")}
                    isLoading={isSaving}
                  />
                )}

                {currentStep === "payment" && (
                  <PaymentSection
                    checkout={checkout}
                    guestToken={
                      guestToken ||
                      checkout.guestToken ||
                      (typeof window !== "undefined"
                        ? localStorage.getItem(`sc_${storeSlug}_guest_token`)
                        : null)
                    }
                    storeSlug={storeSlug}
                    storeName={storeName}
                    onPaymentVerified={handlePaymentVerified}
                    onBack={() => setCurrentStep("delivery")}
                  />
                )}
              </div>
            </div>

            {/* Right Column: Order Summary */}
            <div className="checkout-summary-column">
              <CheckoutSummary
                checkout={checkout}
                storeSlug={storeSlug}
                appliedDiscount={checkoutDiscount ?? cartAppliedDiscount}
                onApplyDiscount={handleApplyDiscount}
                onRemoveDiscount={handleRemoveDiscount}
                isDiscountLoading={isDiscountLoading}
              />
            </div>
          </div>
        )}
      </div>
    </StorefrontShell>
  );
}

export default function StorefrontCheckoutPage({ params }: CheckoutPageProps) {
  const { storeSlug } = use(params);
  const [storeName, setStoreName] = useState<string>("Online Store");

  useEffect(() => {
    let active = true;
    apiClient
      .get<{ store: { name: string } }>(
        `/api/v1/storefront/${encodeURIComponent(storeSlug)}/cart`,
      )
      .then((data) => {
        if (active && data?.store?.name) {
          setStoreName(data.store.name);
        }
      })
      .catch(() => {
        if (active) {
          setStoreName(storeSlug.charAt(0).toUpperCase() + storeSlug.slice(1));
        }
      });

    return () => {
      active = false;
    };
  }, [storeSlug]);

  return (
    <CartProvider storeSlug={storeSlug}>
      <CheckoutView storeSlug={storeSlug} storeName={storeName} />
    </CartProvider>
  );
}
