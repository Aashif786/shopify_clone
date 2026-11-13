"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { StorefrontCheckoutDTO } from "../../../lib/storefront-checkout-helpers";
import { formatStorePrice } from "../products/product-card";
import { apiClient } from "../../../lib/api-client";
import { Alert, Spinner } from "@calcart/ui";
import { Lock, ShieldCheck, CreditCard, Banknote, CheckCircle2, Truck } from "lucide-react";

export interface PaymentSectionProps {
  checkout: StorefrontCheckoutDTO;
  guestToken?: string | null;
  storeSlug: string;
  storeName: string;
  onPaymentVerified: (orderId: string, orderNumber: string) => void;
  onBack: () => void;
}

interface InitPaymentResponse {
  alreadyCompleted?: boolean;
  order?: {
    id: string;
    orderNumber: string;
    status: string;
    paymentStatus: string;
  } | null;
  payment?: { id: string; amount: number; currency: string; status: string };
  attempt?: { id: string; status: string };
  razorpayOrder?: {
    providerOrderId: string;
    amount: number;
    currency: string;
    razorpayKeyId: string;
    paymentId: string;
    attemptId: string;
  };
  checkout: StorefrontCheckoutDTO;
}

interface VerifyPaymentResponse {
  verified: boolean;
  paymentStatus: string;
  order: {
    id: string;
    orderNumber: string;
    status: string;
    paymentStatus: string;
  } | null;
}

interface PaymentStatusResponse {
  status: string;
  canRetry: boolean;
  order: {
    id: string;
    orderNumber: string;
    status: string;
    paymentStatus: string;
  } | null;
}

function loadRazorpayCheckoutScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }
    const win = window as unknown as { Razorpay?: unknown };
    if (typeof win.Razorpay === "function") {
      resolve(true);
      return;
    }

    const scriptSrc = "https://checkout.razorpay.com/v1/checkout.js";
    const existing = document.querySelector(`script[src="${scriptSrc}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }

    const script = document.createElement("script");
    script.src = scriptSrc;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function PaymentSection({
  checkout,
  guestToken,
  storeSlug,
  storeName,
  onPaymentVerified,
  onBack,
}: PaymentSectionProps) {
  const [selectedMethod, setSelectedMethod] = useState<"RAZORPAY" | "COD">("RAZORPAY");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isPollingRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  const isVerifiedHandledRef = useRef<boolean>(false);

  const notifyPaymentVerified = useCallback(
    (orderId: string, orderNumber: string) => {
      if (isVerifiedHandledRef.current) return;
      isVerifiedHandledRef.current = true;
      isPollingRef.current = false;
      setIsProcessing(false);
      setStatusMessage("Payment confirmed! Redirecting to confirmation...");
      onPaymentVerified(orderId, orderNumber);
    },
    [onPaymentVerified],
  );

  const customerName = checkout.shippingAddress
    ? `${checkout.shippingAddress.firstName || ""} ${checkout.shippingAddress.lastName || ""}`.trim()
    : "";

  const pollReconciliation = useCallback(async () => {
    if (isPollingRef.current) return;
    isPollingRef.current = true;

    let attempts = 0;
    const maxAttempts = 6;
    const pollInterval = 3000;

    const poll = async () => {
      if (!isMountedRef.current) {
        isPollingRef.current = false;
        return;
      }

      attempts++;
      try {
        const headers: Record<string, string> = {};
        const token =
          guestToken ||
          (checkout as unknown as { guestToken?: string }).guestToken ||
          (typeof window !== "undefined"
            ? localStorage.getItem(`sc_${storeSlug}_guest_token`)
            : null);
        if (token) {
          headers["x-guest-token"] = token;
        }

        const statusRes = await apiClient.get<PaymentStatusResponse>(
          `/api/v1/storefront/${encodeURIComponent(storeSlug)}/checkout/${encodeURIComponent(checkout.id)}/payment`,
          { headers, timeoutMs: 10000 },
        );

        if (!isMountedRef.current) return;

        if (statusRes.status === "CAPTURED" && statusRes.order) {
          notifyPaymentVerified(statusRes.order.id, statusRes.order.orderNumber);
          return;
        }

        if (statusRes.status === "FAILED") {
          setIsProcessing(false);
          setStatusMessage(null);
          isPollingRef.current = false;
          setError("Payment was declined or failed. You can safely try again.");
          return;
        }
      } catch {
        // Transient network error during polling; continue until maxAttempts
      }

      if (attempts >= maxAttempts) {
        isPollingRef.current = false;
        if (isMountedRef.current) {
          setIsProcessing(false);
          setStatusMessage(null);
          setError(
            "Payment verification is taking longer than expected. If your account was charged, your order will be confirmed shortly. You can refresh this page to check the status.",
          );
        }
        return;
      }

      setTimeout(poll, pollInterval);
    };

    setTimeout(poll, pollInterval);
  }, [checkout.id, guestToken, onPaymentVerified, storeSlug]);

  // Initial check on mount: recover existing payment state if page was refreshed
  useEffect(() => {
    isMountedRef.current = true;
    const checkExistingPayment = async () => {
      if (checkout.status === "COMPLETED" || checkout.status === "CANCELLED" || checkout.status === "EXPIRED") {
        return;
      }
      try {
        const headers: Record<string, string> = {};
        const token =
          guestToken ||
          (checkout as unknown as { guestToken?: string }).guestToken ||
          (typeof window !== "undefined"
            ? localStorage.getItem(`sc_${storeSlug}_guest_token`)
            : null);
        if (token) {
          headers["x-guest-token"] = token;
        }

        const statusRes = await apiClient.get<PaymentStatusResponse>(
          `/api/v1/storefront/${encodeURIComponent(storeSlug)}/checkout/${encodeURIComponent(checkout.id)}/payment`,
          { headers, timeoutMs: 10000 },
        );

        if (!isMountedRef.current) return;

        if (statusRes.status === "CAPTURED" && statusRes.order) {
          notifyPaymentVerified(statusRes.order.id, statusRes.order.orderNumber);
        } else if (statusRes.status === "REQUIRES_RECONCILIATION" || statusRes.status === "PENDING") {
          setIsProcessing(true);
          setStatusMessage("Verifying previous payment with gateway...");
          pollReconciliation();
        }
      } catch {
        // Safe to ignore mount check failure
      }
    };

    checkExistingPayment();
    return () => {
      isMountedRef.current = false;
    };
  }, [checkout.id, guestToken, onPaymentVerified, pollReconciliation, storeSlug]);

  const handlePay = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setError(null);

    const isCod = checkout.total > 0 && selectedMethod === "COD";
    setStatusMessage(
      isCod
        ? "Placing your Cash on Delivery order..."
        : checkout.total === 0
        ? "Confirming order..."
        : "Initializing secure payment session..."
    );

    try {
      const payHeaders: Record<string, string> = {};
      const token =
        guestToken ||
        (checkout as unknown as { guestToken?: string }).guestToken ||
        (typeof window !== "undefined"
          ? localStorage.getItem(`sc_${storeSlug}_guest_token`)
          : null);
      if (token) {
        payHeaders["x-guest-token"] = token;
      }

      // 1. Initialize payment session or complete COD on server
      const initRes = await apiClient.post<InitPaymentResponse>(
        `/api/v1/storefront/${encodeURIComponent(storeSlug)}/checkout/${encodeURIComponent(checkout.id)}/payment`,
        { method: isCod ? "COD" : "RAZORPAY" },
        { headers: payHeaders, timeoutMs: 20000 },
      );

      // If already captured or completed on server (including COD and zero-total orders), recover immediately
      if (initRes.alreadyCompleted && initRes.order) {
        setStatusMessage(
          isCod
            ? "Order placed successfully! Redirecting to confirmation..."
            : "Payment confirmed! Redirecting to confirmation..."
        );
        notifyPaymentVerified(initRes.order.id, initRes.order.orderNumber);
        return;
      }

      if (isCod) {
        throw new Error("Unable to place Cash on Delivery order. Please try again.");
      }

      const { razorpayOrder } = initRes;
      if (!razorpayOrder) {
        throw new Error("Unable to initialize gateway order. Please try again.");
      }

      // 2. Ensure Razorpay checkout script is present in browser
      setStatusMessage("Loading payment gateway...");
      await loadRazorpayCheckoutScript();

      const windowWithRzp =
        typeof window !== "undefined"
          ? (window as unknown as {
              Razorpay?: new (options: Record<string, unknown>) => {
                open: () => void;
                on?: (
                  event: string,
                  handler: (response: { error?: { description?: string } }) => void,
                ) => void;
              };
            })
          : {};

      if (typeof windowWithRzp.Razorpay === "function") {
        setStatusMessage("Opening Razorpay payment gateway...");

        const rzp = new windowWithRzp.Razorpay({
          key: razorpayOrder.razorpayKeyId,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
          name: storeName,
          description: `Checkout ${checkout.id.slice(0, 8)}`,
          order_id: razorpayOrder.providerOrderId,
          prefill: {
            email: checkout.email || "",
            name: customerName,
            contact: checkout.shippingAddress?.phone || "",
          },
          handler: async (response: {
            razorpay_payment_id: string;
            razorpay_order_id?: string;
            razorpay_signature: string;
          }) => {
            const confirmedOrderId = response.razorpay_order_id || razorpayOrder.providerOrderId;
            await handleVerification({
              paymentId: razorpayOrder.paymentId,
              attemptId: razorpayOrder.attemptId,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpayOrderId: confirmedOrderId,
              razorpaySignature: response.razorpay_signature,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: confirmedOrderId,
              razorpay_signature: response.razorpay_signature,
            });
          },
          modal: {
            ondismiss: () => {
              setIsProcessing(false);
              setStatusMessage(null);
              setError("Payment dialog was closed. You can try again when ready.");
            },
          },
        });

        if (typeof rzp.on === "function") {
          rzp.on("payment.failed", (resp) => {
            setIsProcessing(false);
            setStatusMessage(null);
            setError(resp.error?.description || "Payment failed or was declined by the gateway.");
          });
        }

        rzp.open();
      } else {
        throw new Error(
          "Unable to load Razorpay payment gateway script. Please verify your connection and try again.",
        );
      }
    } catch (err: unknown) {
      setIsProcessing(false);
      setStatusMessage(null);
      const msg = err instanceof Error ? err.message : "Failed to initiate payment";
      setError(msg);
    }
  };

  const handleVerification = async (payload: {
    paymentId: string;
    attemptId: string;
    razorpayPaymentId: string;
    razorpayOrderId: string;
    razorpaySignature: string;
    razorpay_payment_id?: string;
    razorpay_order_id?: string;
    razorpay_signature?: string;
  }) => {
    setStatusMessage("Verifying payment with payment provider...");
    try {
      const verifyHeaders: Record<string, string> = {};
      const token =
        guestToken ||
        (checkout as unknown as { guestToken?: string }).guestToken ||
        (typeof window !== "undefined"
          ? localStorage.getItem(`sc_${storeSlug}_guest_token`)
          : null);
      if (token) {
        verifyHeaders["x-guest-token"] = token;
      }

      const verifyRes = await apiClient.post<VerifyPaymentResponse>(
        `/api/v1/storefront/${encodeURIComponent(storeSlug)}/checkout/${encodeURIComponent(checkout.id)}/payment/verify`,
        payload,
        { headers: verifyHeaders, timeoutMs: 15000 },
      );

      if (verifyRes.verified && verifyRes.order) {
        notifyPaymentVerified(verifyRes.order.id, verifyRes.order.orderNumber);
      } else if (verifyRes.paymentStatus === "REQUIRES_RECONCILIATION" || verifyRes.paymentStatus === "PENDING") {
        setStatusMessage("Payment received by gateway, verifying with your bank...");
        pollReconciliation();
      } else {
        setIsProcessing(false);
        setStatusMessage(null);
        setError("Payment authorization failed or was declined by the bank.");
      }
    } catch {
      setStatusMessage("Verification timed out. Reconciling payment outcome with gateway...");
      pollReconciliation();
    }
  };

  return (
    <div className="checkout-form payment-section rounded-none border border-[color:var(--at-hairline)] bg-transparent p-6 sm:p-8 space-y-6" data-testid="payment-section">
      <div className="checkout-form-header space-y-1">
        <h2 className="checkout-form-title text-xl font-extrabold tracking-tight text-foreground">
          Payment
        </h2>
        <p className="checkout-form-subtitle text-muted text-sm text-muted-foreground">
          {checkout.total === 0
            ? "Your order is completely covered by store credit or gift cards."
            : "Select your preferred payment method to complete your purchase."}
        </p>
      </div>

      {error && (
        <div style={{ marginBottom: "var(--space-4)" }}>
          <Alert variant="danger" title="Payment Error" data-testid="payment-error-alert">
            {error}
          </Alert>
        </div>
      )}

      {statusMessage && (
        <div
          className="alert alert--info p-4 rounded-none bg-primary/10 border border-primary/20 text-xs font-medium text-foreground flex items-center gap-3"
          role="status"
          aria-live="polite"
          data-testid="payment-status-message"
        >
          <Spinner size="sm" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Payment Options */}
      {checkout.total === 0 ? (
        <div className="p-5 rounded-none border border-emerald-500/30 bg-emerald-500/5 space-y-2">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <span className="font-bold text-sm text-foreground">Fully Covered by Gift Card / Store Credit</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Your applied balance covers the entire order amount. No payment is required.
          </p>
        </div>
      ) : (
        <div className="space-y-3" role="radiogroup" aria-label="Select Payment Method">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
            Select Payment Method
          </span>

          {/* Option 1: Razorpay */}
          <div
            role="radio"
            aria-checked={selectedMethod === "RAZORPAY"}
            tabIndex={0}
            onClick={() => !isProcessing && setSelectedMethod("RAZORPAY")}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && !isProcessing) {
                e.preventDefault();
                setSelectedMethod("RAZORPAY");
              }
            }}
            className={`group relative p-4 rounded-none border transition-all cursor-pointer select-none ${
              selectedMethod === "RAZORPAY"
                ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                : "border-[color:var(--at-hairline)] bg-background/40 hover:border-border hover:bg-background/80"
            }`}
            data-testid="payment-method-razorpay"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="pt-0.5">
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                      selectedMethod === "RAZORPAY"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/40 bg-background"
                    }`}
                  >
                    {selectedMethod === "RAZORPAY" && (
                      <div className="w-2 h-2 rounded-full bg-white dark:bg-black" />
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-primary" />
                    <span className="font-bold text-sm text-foreground">Razorpay Secure Checkout</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Cards, UPI (Google Pay, PhonePe, Paytm), NetBanking, and Wallets.
                  </p>
                </div>
              </div>
              <span className="shrink-0 badge badge--success badge--sm inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <ShieldCheck size={12} /> SSL Encrypted
              </span>
            </div>
          </div>

          {/* Option 2: Cash on Delivery (COD) */}
          <div
            role="radio"
            aria-checked={selectedMethod === "COD"}
            tabIndex={0}
            onClick={() => !isProcessing && setSelectedMethod("COD")}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && !isProcessing) {
                e.preventDefault();
                setSelectedMethod("COD");
              }
            }}
            className={`group relative p-4 rounded-none border transition-all cursor-pointer select-none ${
              selectedMethod === "COD"
                ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                : "border-[color:var(--at-hairline)] bg-background/40 hover:border-border hover:bg-background/80"
            }`}
            data-testid="payment-method-cod"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="pt-0.5">
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                      selectedMethod === "COD"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/40 bg-background"
                    }`}
                  >
                    {selectedMethod === "COD" && (
                      <div className="w-2 h-2 rounded-full bg-white dark:bg-black" />
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Banknote className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-bold text-sm text-foreground">Cash on Delivery (COD)</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Pay with cash or UPI QR upon delivery at your doorstep. No advance payment required.
                  </p>
                </div>
              </div>
              <span className="shrink-0 badge badge--neutral badge--sm inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground border border-[color:var(--at-hairline)]">
                <Truck size={12} /> Pay at Doorstep
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Amount Due Review */}
      <div className="payment-amount-review flex items-baseline justify-between py-4 border-y border-[color:var(--at-hairline)]">
        <div>
          <span className="font-semibold text-sm text-foreground block">Total Amount Due</span>
          {checkout.total > 0 && selectedMethod === "COD" && (
            <span className="text-[11px] text-muted-foreground">Payable upon delivery at doorstep</span>
          )}
        </div>
        <span className="font-extrabold text-2xl tracking-tight text-foreground" data-testid="payment-total-amount">
          {formatStorePrice(checkout.total, checkout.currency)}
        </span>
      </div>

      <div className="checkout-actions-row flex items-center justify-between pt-4 border-t border-[color:var(--at-hairline)]">
        <button
          type="button"
          className="btn btn-outline btn-sm checkout-back-btn rounded-none px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
          onClick={onBack}
          disabled={isProcessing}
          data-testid="back-to-delivery-btn"
        >
          <span>← Return to Delivery</span>
        </button>
        <button
          type="button"
          className="checkout-submit-btn at-press inline-flex h-12 items-center justify-center gap-2 bg-primary px-8 text-xs font-medium uppercase tracking-[0.14em] text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
          onClick={handlePay}
          disabled={isProcessing}
          data-testid="pay-now-button"
        >
          {isProcessing ? (
            <>
              <Spinner size="sm" />
              <span>Processing...</span>
            </>
          ) : checkout.total === 0 ? (
            <>
              <CheckCircle2 size={16} />
              <span>Complete Order</span>
            </>
          ) : selectedMethod === "COD" ? (
            <>
              <Truck size={16} />
              <span>Place Cash on Delivery Order</span>
            </>
          ) : (
            <>
              <Lock size={15} />
              <span>Pay {formatStorePrice(checkout.total, checkout.currency)}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
