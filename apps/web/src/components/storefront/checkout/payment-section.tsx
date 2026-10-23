"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { StorefrontCheckoutDTO } from "../../../lib/storefront-checkout-helpers";
import { formatStorePrice } from "../products/product-card";
import { apiClient } from "../../../lib/api-client";
import { Alert, Spinner } from "@shopify-clone/ui";

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
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isPollingRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);

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
          setIsProcessing(false);
          setStatusMessage("Payment confirmed! Redirecting to confirmation...");
          isPollingRef.current = false;
          onPaymentVerified(statusRes.order.id, statusRes.order.orderNumber);
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
          setStatusMessage("Payment confirmed! Redirecting to confirmation...");
          onPaymentVerified(statusRes.order.id, statusRes.order.orderNumber);
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
    setStatusMessage("Initializing secure payment session...");

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

      // 1. Initialize payment session on server
      const initRes = await apiClient.post<InitPaymentResponse>(
        `/api/v1/storefront/${encodeURIComponent(storeSlug)}/checkout/${encodeURIComponent(checkout.id)}/payment`,
        {},
        { headers: payHeaders, timeoutMs: 20000 },
      );

      // If already captured or completed on server, recover immediately
      if (initRes.alreadyCompleted && initRes.order) {
        setStatusMessage("Payment confirmed! Redirecting to confirmation...");
        onPaymentVerified(initRes.order.id, initRes.order.orderNumber);
        return;
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
        setStatusMessage("Payment confirmed! Redirecting to confirmation...");
        onPaymentVerified(verifyRes.order.id, verifyRes.order.orderNumber);
      } else if (verifyRes.paymentStatus === "REQUIRES_RECONCILIATION" || verifyRes.paymentStatus === "PENDING") {
        setStatusMessage("Payment received by gateway, verifying with your bank...");
        pollReconciliation();
      } else {
        setIsProcessing(false);
        setStatusMessage(null);
        setError("Payment authorization failed or was declined by the bank.");
      }
    } catch {
      // Do NOT fail the payment on verification timeout!
      // The payment might be captured at the gateway; start server reconciliation polling
      setStatusMessage("Verification timed out. Reconciling payment outcome with gateway...");
      pollReconciliation();
    }
  };

  return (
    <div className="checkout-form payment-section" data-testid="payment-section">
      <div className="checkout-form-header">
        <h2 className="checkout-form-title">Payment</h2>
        <p className="checkout-form-subtitle text-muted text-sm">
          All transactions are encrypted and secured via Razorpay.
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
          className="alert alert--info"
          role="status"
          aria-live="polite"
          style={{ marginBottom: "var(--space-4)" }}
          data-testid="payment-status-message"
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <Spinner size="sm" />
            <span>{statusMessage}</span>
          </div>
        </div>
      )}

      {/* Gateway Card */}
      <div className="payment-gateway-card card" style={{ padding: "var(--space-4)", marginBottom: "var(--space-5)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <span className="checkout-glyph" aria-hidden="true">PAY</span>
            <span className="font-semibold">Razorpay Secure Checkout</span>
          </div>
          <span className="badge badge--success badge--sm">SSL Encrypted</span>
        </div>
        <p className="text-muted text-xs" style={{ margin: 0 }}>
          Supports Cards, UPI, NetBanking, and authorized wallets. You will be redirected to the secure gateway dialog.
        </p>
      </div>

      {/* Amount Due Review */}
      <div
        className="payment-amount-review"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          padding: "var(--space-3) 0",
          borderTop: "1px solid var(--color-border)",
          borderBottom: "1px solid var(--color-border)",
          marginBottom: "var(--space-5)",
        }}
      >
        <span className="font-medium">Total Amount Due</span>
        <span className="font-bold text-lg" data-testid="payment-total-amount">
          {formatStorePrice(checkout.total, checkout.currency)}
        </span>
      </div>

      <div className="checkout-actions-row">
        <button
          type="button"
          className="btn btn-outline btn-sm checkout-back-btn"
          onClick={onBack}
          disabled={isProcessing}
          data-testid="back-to-delivery-btn"
        >
          ← Return to Delivery
        </button>
        <button
          type="button"
          className="btn btn-primary btn-lg checkout-submit-btn"
          onClick={handlePay}
          disabled={isProcessing}
          data-testid="pay-now-button"
        >
          {isProcessing ? (
            <>
              <Spinner size="sm" />
              <span style={{ marginLeft: "var(--space-2)" }}>Processing...</span>
            </>
          ) : (
            `Pay ${formatStorePrice(checkout.total, checkout.currency)}`
          )}
        </button>
      </div>
    </div>
  );
}
