"use client";

import React, { useState } from "react";
import type { StorefrontCheckoutDTO } from "../../../lib/storefront-checkout-helpers";
import { formatStorePrice } from "../products/product-card";
import { apiClient } from "../../../lib/api-client";
import { Alert, Spinner } from "@shopify-clone/ui";

export interface PaymentSectionProps {
  checkout: StorefrontCheckoutDTO;
  storeSlug: string;
  storeName: string;
  onPaymentVerified: (orderId: string, orderNumber: string) => void;
  onBack: () => void;
}

interface InitPaymentResponse {
  payment: { id: string; amount: number; currency: string; status: string };
  attempt: { id: string; status: string };
  razorpayOrder: {
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
  storeSlug,
  storeName,
  onPaymentVerified,
  onBack,
}: PaymentSectionProps) {
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const customerName = checkout.shippingAddress
    ? `${checkout.shippingAddress.firstName || ""} ${checkout.shippingAddress.lastName || ""}`.trim()
    : "";

  const handlePay = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setError(null);
    setStatusMessage("Initializing secure payment session...");

    try {
      // 1. Initialize payment session on server
      const initRes = await apiClient.post<InitPaymentResponse>(
        `/api/v1/storefront/${encodeURIComponent(storeSlug)}/checkout/${encodeURIComponent(checkout.id)}/payment`,
        {},
      );

      const { razorpayOrder } = initRes;

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
              setError("Payment was cancelled or closed before completion. You can try again.");
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
    setStatusMessage("Verifying payment signature with authoritative server...");
    try {
      const verifyRes = await apiClient.post<VerifyPaymentResponse>(
        `/api/v1/storefront/${encodeURIComponent(storeSlug)}/checkout/${encodeURIComponent(checkout.id)}/payment/verify`,
        payload,
      );

      if (verifyRes.verified && verifyRes.order) {
        setStatusMessage("Payment confirmed! Redirecting to confirmation...");
        onPaymentVerified(verifyRes.order.id, verifyRes.order.orderNumber);
      } else if (verifyRes.paymentStatus === "REQUIRES_RECONCILIATION" || verifyRes.paymentStatus === "PENDING") {
        setIsProcessing(false);
        setStatusMessage(null);
        setError(
          "Payment received by gateway but undergoing background reconciliation. Your order will be confirmed once verification completes.",
        );
      } else {
        setIsProcessing(false);
        setStatusMessage(null);
        setError("Payment authorization failed or was declined by the bank.");
      }
    } catch (err: unknown) {
      setIsProcessing(false);
      setStatusMessage(null);
      const msg = err instanceof Error ? err.message : "Payment verification failed";
      setError(msg);
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
