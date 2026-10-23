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
import { ShoppingBag, ArrowRight } from "lucide-react";

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
      const done: CheckoutStep[] = [];
      if (res.checkout.email) {
        done.push("information");
      }
      if (res.checkout.shippingAddress) {
        done.push("shipping");
      }
      if (res.checkout.shippingAddress && res.checkout.email) {
        done.push("delivery");
      }
      setCompletedSteps(done);

      if (!res.checkout.email) {
        setCurrentStep("information");
      } else if (!res.checkout.shippingAddress) {
        setCurrentStep("shipping");
      } else {
        setCurrentStep("payment");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to initialize checkout session";
      setError(msg);
    } finally {
      setIsInitializing(false);
    }
  }, [cart, checkout, storeSlug]);

  useEffect(() => {
    initializeCheckout();
  }, [initializeCheckout]);

  // 2. Step 1: Submit Customer Email
  const handleEmailSubmit = async (email: string) => {
    if (!checkout) return;
    setIsSaving(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      const token = guestToken || checkout.guestToken;
      if (token) {
        headers["x-guest-token"] = token;
      }

      const res = await apiClient.patch<{ checkout: StorefrontCheckoutDTO }>(
        `/api/v1/storefront/${encodeURIComponent(storeSlug)}/checkout/${encodeURIComponent(checkout.id)}`,
        { email },
        { headers },
      );

      setCheckout(res.checkout);
      setCompletedSteps((prev) => Array.from(new Set([...prev, "information"])));
      setCurrentStep("shipping");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save customer information";
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // 3. Step 2: Submit Shipping Address
  const handleAddressSubmit = async (shippingAddress: CheckoutAddressDTO) => {
    if (!checkout) return;
    setIsSaving(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      const token = guestToken || checkout.guestToken;
      if (token) {
        headers["x-guest-token"] = token;
      }

      const res = await apiClient.patch<{ checkout: StorefrontCheckoutDTO }>(
        `/api/v1/storefront/${encodeURIComponent(storeSlug)}/checkout/${encodeURIComponent(checkout.id)}`,
        { shippingAddress },
        { headers },
      );

      setCheckout(res.checkout);
      setCompletedSteps((prev) => Array.from(new Set([...prev, "information", "shipping"])));
      setCurrentStep("delivery");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save shipping address";
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // 4. Step 3: Confirm Delivery Method
  const handleDeliverySubmit = async () => {
    setCompletedSteps((prev) => Array.from(new Set([...prev, "information", "shipping", "delivery"])));
    setCurrentStep("payment");
  };

  // 5. Step 4: Payment Verified Callback
  const handlePaymentVerified = async (orderId: string) => {
    // Clear the cart on successful verified purchase
    await clearCart();
    if (typeof window !== "undefined") {
      localStorage.removeItem(`sc_${storeSlug}_guest_token`);
    }
    const tokenQuery = guestToken ? `?guestToken=${encodeURIComponent(guestToken)}` : "";
    router.push(`/stores/${encodeURIComponent(storeSlug)}/orders/${encodeURIComponent(orderId)}/confirmation${tokenQuery}`);
  };

  // 6. Discount application on checkout
  const handleApplyDiscount = async (code: string) => {
    if (!checkout || isDiscountLoading) return;
    setIsDiscountLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      const token = guestToken || checkout.guestToken;
      if (token) {
        headers["x-guest-token"] = token;
      }

      const res = await apiClient.post<{
        checkout: StorefrontCheckoutDTO;
        discount?: AppliedDiscountDTO;
      }>(
        `/api/v1/storefront/${encodeURIComponent(storeSlug)}/checkout/${encodeURIComponent(checkout.id)}/discount`,
        { code },
        { headers },
      );

      setCheckout(res.checkout);
      if (res.discount) {
        setCheckoutDiscount(res.discount);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to apply discount code";
      setError(msg);
    } finally {
      setIsDiscountLoading(false);
    }
  };

  // 7. Discount removal on checkout
  const handleRemoveDiscount = async () => {
    if (!checkout || isDiscountLoading) return;
    setIsDiscountLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      const token = guestToken || checkout.guestToken;
      if (token) {
        headers["x-guest-token"] = token;
      }

      const res = await apiClient.delete<{ checkout: StorefrontCheckoutDTO }>(
        `/api/v1/storefront/${encodeURIComponent(storeSlug)}/checkout/${encodeURIComponent(checkout.id)}/discount`,
        { headers },
      );

      setCheckout(res.checkout);
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
      <div className="storefront-checkout-container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8" data-testid="checkout-page-container">
        {/* Loading State */}
        {(isCartLoading || isInitializing) && (
          <div className="storefront-grid-state text-center py-24 space-y-3" data-testid="checkout-loading">
            <div className="p-4 rounded-2xl bg-card border border-border/60 shadow-sm inline-block">
              <Spinner size="lg" className="spinner spinner-lg text-primary" />
            </div>
            <p className="text-muted-foreground text-sm font-medium animate-pulse">
              Preparing your secure checkout...
            </p>
          </div>
        )}

        {/* Empty Cart State */}
        {!isCartLoading && !isInitializing && (!cart || cart.items.length === 0) && (
          <div className="storefront-cart-empty-state card max-w-md mx-auto py-16 px-6 text-center rounded-3xl border border-dashed border-border/80 bg-card/60 shadow-sm space-y-5" data-testid="checkout-empty-cart">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-muted/60 flex items-center justify-center text-muted-foreground checkout-glyph" aria-hidden="true">
              <ShoppingBag size={28} className="opacity-60" />
            </div>
            <div className="space-y-1">
              <h2 className="font-extrabold text-xl tracking-tight text-foreground">
                Your cart is empty
              </h2>
              <p className="text-muted-foreground text-xs leading-relaxed max-w-xs mx-auto">
                You must have at least one product in your cart before proceeding to checkout.
              </p>
            </div>
            <div className="pt-2">
              <a href={catalogHref} className="btn btn-primary btn-md rounded-2xl px-6 py-2.5 text-xs font-semibold inline-flex items-center gap-1.5 shadow-md">
                <span>Browse Products</span>
                <ArrowRight size={14} />
              </a>
            </div>
          </div>
        )}

        {/* Active Checkout Layout */}
        {!isCartLoading && !isInitializing && checkout && checkout.items.length > 0 && (
          <div
            className="storefront-checkout-layout grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start"
          >
            {/* Left Column: Progress & Active Step Form (7 cols on lg) */}
            <div className="checkout-main-column lg:col-span-7 space-y-6">
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
              <div className="checkout-step-panel">
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

            {/* Right Column: Order Summary (5 cols on lg, sticky) */}
            <div className="checkout-summary-column lg:col-span-5 lg:sticky lg:top-28">
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
