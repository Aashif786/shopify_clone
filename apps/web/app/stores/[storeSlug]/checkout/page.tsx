"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import React, { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { useCart } from "../../../../src/context/cart-context";
import { StorefrontShell } from "../../../../src/components/storefront/StorefrontShell";
import { CheckoutSteps, type CheckoutStep } from "../../../../src/components/storefront/checkout/checkout-steps";
import { CustomerInformationForm } from "../../../../src/components/storefront/checkout/customer-information-form";
import {
  ShippingAddressForm,
  type SavedCheckoutAddress,
} from "../../../../src/components/storefront/checkout/shipping-address-form";
import { DeliveryMethodSelector } from "../../../../src/components/storefront/checkout/delivery-method-selector";
import { PaymentSection } from "../../../../src/components/storefront/checkout/payment-section";
import { CheckoutSummary } from "../../../../src/components/storefront/checkout/checkout-summary";
import type {
  StorefrontCheckoutDTO,
  StorefrontCheckoutEnrichedDTO,
} from "../../../../src/lib/storefront-checkout-helpers";

/**
 * The checkout as the API returns it. The tax and shipping fields are optional
 * because a store that uses neither engine does not send a breakdown.
 */
type PageCheckout = StorefrontCheckoutDTO &
  Partial<Pick<StorefrontCheckoutEnrichedDTO, "taxEnabled" | "tax" | "shippingEnabled" | "shipping">>;
import type { AppliedDiscountDTO } from "../../../../src/lib/storefront-discount-helpers";
import type { CheckoutAddressDTO } from "@calcart/checkout";
import { apiClient } from "../../../../src/lib/api-client";
import { Alert, Button } from "@calcart/ui";
import { ArrowRight } from "lucide-react";

interface CheckoutPageProps {
  params: Promise<{ storeSlug: string }>;
}

interface InitCheckoutApiResponse {
  checkout: PageCheckout;
  store: { id: string; name: string; slug: string; currency: string };
}

function CheckoutView({ storeSlug, storeName }: { storeSlug: string; storeName: string }) {
  const router = useRouter();
  const { cart, isLoading: isCartLoading, clearCart, appliedDiscount: cartAppliedDiscount } = useCart();

  const [checkout, setCheckout] = useState<PageCheckout | null>(null);
  const [currentStep, setCurrentStep] = useState<CheckoutStep>("information");
  const [completedSteps, setCompletedSteps] = useState<CheckoutStep[]>([]);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutDiscount, setCheckoutDiscount] = useState<AppliedDiscountDTO | null>(null);
  const [isDiscountLoading, setIsDiscountLoading] = useState<boolean>(false);
  const [isGiftCardLoading, setIsGiftCardLoading] = useState<boolean>(false);
  const [isStoreCreditLoading, setIsStoreCreditLoading] = useState<boolean>(false);
  const [savedAddresses, setSavedAddresses] = useState<SavedCheckoutAddress[]>([]);
  const [guestToken, setGuestToken] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(`sc_${storeSlug}_guest_token`);
    }
    return null;
  });
  const guestTokenRef = React.useRef(guestToken);
  guestTokenRef.current = guestToken;
  const initializedCartIdRef = React.useRef<string | null>(null);
  const isPaymentVerifiedRef = React.useRef<boolean>(false);

  // 1. Initialize checkout from active cart
  const initializeCheckout = useCallback(async () => {
    if (!cart?.id || cart.items.length === 0) {
      setCheckout(null);
      initializedCartIdRef.current = null;
      setIsInitializing(false);
      return;
    }

    // Check if current checkout already matches cart ID, status, and line items
    const isCheckoutValidForCart =
      initializedCartIdRef.current === cart.id &&
      checkout &&
      checkout.status !== "COMPLETED" &&
      checkout.status !== "CANCELLED" &&
      checkout.status !== "EXPIRED" &&
      checkout.items.length === cart.items.length &&
      cart.items.every((ci) => {
        const found = checkout.items.find((item) => item.variantId === ci.variantId);
        return found && found.quantity === ci.quantity;
      });

    if (isCheckoutValidForCart) {
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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        // auth/me answers 200 with customer: null for guests, so a guest checkout does not
        // produce a (correct but noisy) 401 the way the protected account/profile route does.
        const res = await apiClient.get<{ customer: { addresses?: SavedCheckoutAddress[] } | null }>(
          `/api/v1/storefront/${encodeURIComponent(storeSlug)}/auth/me`,
        );
        if (!cancelled) {
          setSavedAddresses(res.customer?.addresses ?? []);
        }
      } catch {
        if (!cancelled) {
          setSavedAddresses([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storeSlug]);

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

      const res = await apiClient.patch<{ checkout: PageCheckout }>(
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

      const res = await apiClient.patch<{ checkout: PageCheckout }>(
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

  // 3b. Choose one of the delivery options the server offered for this address.
  // Only the option's id is sent; the price always comes from the stored rate.
  const handleSelectRate = async (rateId: string) => {
    if (!checkout) return;
    setIsSaving(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      const token = guestToken || checkout.guestToken;
      if (token) {
        headers["x-guest-token"] = token;
      }

      const res = await apiClient.put<{ checkout: PageCheckout }>(
        `/api/v1/storefront/${encodeURIComponent(storeSlug)}/checkout/${encodeURIComponent(checkout.id)}/shipping`,
        { rateId },
        { headers },
      );
      setCheckout(res.checkout);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not select that delivery option");
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
    if (isPaymentVerifiedRef.current) return;
    isPaymentVerifiedRef.current = true;

    // Clear the cart on successful verified purchase with error resilience
    try {
      await clearCart();
    } catch (err) {
      console.warn("Non-fatal clearCart error after payment verified:", err);
    }

    if (typeof window !== "undefined") {
      localStorage.removeItem(`sc_${storeSlug}_guest_token`);
      localStorage.removeItem(`sc_${storeSlug}_cart_id`);
    }

    // Reset checkout session state so subsequent visits start fresh
    setCheckout(null);
    initializedCartIdRef.current = null;
    isPaymentVerifiedRef.current = false;
    setCurrentStep("information");
    setCompletedSteps([]);

    const tokenQuery = guestToken ? `?guestToken=${encodeURIComponent(guestToken)}` : "";
    router.push(`/stores/${encodeURIComponent(storeSlug)}/orders/${encodeURIComponent(orderId)}/confirmation${tokenQuery}`);
  };

  // 6. Discount application on checkout
  const handleApplyDiscount = async (code: string) => {
    if (!checkout || isDiscountLoading) return;
    setIsDiscountLoading(true);
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

      const res = await apiClient.delete<{ checkout: PageCheckout }>(
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

  // 8. Gift Card application on checkout
  const handleApplyGiftCard = async (code: string) => {
    if (!checkout || isGiftCardLoading) return;
    setIsGiftCardLoading(true);
    try {
      const headers: Record<string, string> = {};
      const token = guestToken || checkout.guestToken;
      if (token) {
        headers["x-guest-token"] = token;
      }

      const res = await apiClient.post<{ checkout: PageCheckout }>(
        `/api/v1/storefront/${encodeURIComponent(storeSlug)}/checkout/${encodeURIComponent(checkout.id)}/giftcard`,
        { code },
        { headers },
      );

      setCheckout(res.checkout);
    } finally {
      setIsGiftCardLoading(false);
    }
  };

  // 9. Gift Card removal on checkout
  const handleRemoveGiftCard = async (giftCardId: string) => {
    if (!checkout || isGiftCardLoading) return;
    setIsGiftCardLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      const token = guestToken || checkout.guestToken;
      if (token) {
        headers["x-guest-token"] = token;
      }

      const res = await apiClient.delete<{ checkout: PageCheckout }>(
        `/api/v1/storefront/${encodeURIComponent(storeSlug)}/checkout/${encodeURIComponent(checkout.id)}/giftcard?giftCardId=${encodeURIComponent(giftCardId)}`,
        { headers },
      );

      setCheckout(res.checkout);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to remove gift card";
      setError(msg);
    } finally {
      setIsGiftCardLoading(false);
    }
  };

  // 10. Store Credit application on checkout
  const handleApplyStoreCredit = async (amount?: number) => {
    if (!checkout || isStoreCreditLoading) return;
    setIsStoreCreditLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      const token = guestToken || checkout.guestToken;
      if (token) {
        headers["x-guest-token"] = token;
      }

      const res = await apiClient.post<{ checkout: PageCheckout }>(
        `/api/v1/storefront/${encodeURIComponent(storeSlug)}/checkout/${encodeURIComponent(checkout.id)}/store-credit`,
        { amount },
        { headers },
      );

      setCheckout(res.checkout);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to apply store credit";
      setError(msg);
    } finally {
      setIsStoreCreditLoading(false);
    }
  };

  // 11. Store Credit removal on checkout
  const handleRemoveStoreCredit = async () => {
    if (!checkout || isStoreCreditLoading) return;
    setIsStoreCreditLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      const token = guestToken || checkout.guestToken;
      if (token) {
        headers["x-guest-token"] = token;
      }

      const res = await apiClient.delete<{ checkout: PageCheckout }>(
        `/api/v1/storefront/${encodeURIComponent(storeSlug)}/checkout/${encodeURIComponent(checkout.id)}/store-credit`,
        { headers },
      );

      setCheckout(res.checkout);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to remove store credit";
      setError(msg);
    } finally {
      setIsStoreCreditLoading(false);
    }
  };

  const catalogHref = `/stores/${encodeURIComponent(storeSlug)}/products`;

  return (
    <StorefrontShell storeName={storeName} storeSlug={storeSlug} fullBleed>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <div className="storefront-checkout-container at-container pb-24 pt-8 sm:pt-12" data-testid="checkout-page-container">
        <h1 className="at-display-lg pb-8 text-foreground sm:pb-12">Checkout</h1>

        {/* Loading State */}
        {(isCartLoading || isInitializing) && (
          <div className="storefront-grid-state min-h-[50vh]" data-testid="checkout-loading" role="status" aria-busy="true">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-12" aria-hidden="true">
              <div className="space-y-4 lg:col-span-7">
                <div className="at-skeleton h-4 w-1/3" />
                <div className="at-skeleton h-12 w-full" />
                <div className="at-skeleton h-12 w-full" />
              </div>
              <div className="at-skeleton h-64 lg:col-span-5" />
            </div>
            <p className="sr-only">Preparing your secure checkout...</p>
          </div>
        )}

        {/* Empty Cart State */}
        {!isCartLoading && !isInitializing && (!cart || cart.items.length === 0) && (
          <div className="storefront-cart-empty-state border-y border-[color:var(--at-hairline)] py-20 text-center" data-testid="checkout-empty-cart">
            <h2 className="at-display-md text-foreground">Your cart is empty</h2>
            <p className="at-lede mx-auto mt-4 max-w-sm text-muted-foreground">
              You must have at least one product in your cart before proceeding to checkout.
            </p>
            <Link
              href={catalogHref}
              className="mt-8 ds-btn ds-btn-primary"
            >
              <span>Browse Products</span>
              <ArrowRight size={15} strokeWidth={1.5} aria-hidden="true" />
            </Link>
          </div>
        )}

        {/* Active Checkout Layout */}
        {!isCartLoading && !isInitializing && checkout && checkout.items.length > 0 && (
          <div
            className="storefront-checkout-layout grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start"
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
              <motion.div
                key={currentStep}
                className="checkout-step-panel"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
              >
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
                    savedAddresses={savedAddresses}
                    onSubmit={handleAddressSubmit}
                    onBack={() => setCurrentStep("information")}
                    isLoading={isSaving}
                  />
                )}

                {currentStep === "delivery" && (
                  <DeliveryMethodSelector
                    shippingTotal={checkout.shippingTotal}
                    currency={checkout.currency}
                    shippingEnabled={checkout.shippingEnabled ?? false}
                    shipping={checkout.shipping ?? null}
                    onSelectRate={handleSelectRate}
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
              </motion.div>
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
                onApplyGiftCard={handleApplyGiftCard}
                onRemoveGiftCard={handleRemoveGiftCard}
                isGiftCardLoading={isGiftCardLoading}
                onApplyStoreCredit={handleApplyStoreCredit}
                onRemoveStoreCredit={handleRemoveStoreCredit}
                isStoreCreditLoading={isStoreCreditLoading}
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
      <CheckoutView storeSlug={storeSlug} storeName={storeName} />
  );
}
