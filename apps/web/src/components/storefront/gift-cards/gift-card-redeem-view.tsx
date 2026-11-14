"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CreditCard,
  Gift,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Wallet,
  ArrowRight,
  LogIn,
  ShoppingBag,
} from "lucide-react";
import { Button, Input, Card, Badge, Spinner } from "@calcart/ui";
import { apiClient, ApiClientError } from "../../../lib/api-client";
import { formatStorePrice } from "../products/product-card";

export interface GiftCardRedeemViewProps {
  storeSlug: string;
  storeName: string;
  currency: string;
  onSwitchToBuy?: () => void;
}

interface GiftCardDetails {
  id: string;
  maskedCode: string;
  currentBalance: number;
  currency: string;
  status: "ACTIVE" | "DEPLETED" | "EXPIRED" | "DISABLED" | string;
  isUsable: boolean;
  expiresAt: string | null;
}

interface CustomerProfile {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
}

export function GiftCardRedeemView({
  storeSlug,
  storeName,
  currency,
  onSwitchToBuy,
}: GiftCardRedeemViewProps) {
  const router = useRouter();

  const [code, setCode] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardDetails, setCardDetails] = useState<GiftCardDetails | null>(null);
  const [searchedCode, setSearchedCode] = useState<string>("");

  // Customer session info
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [storeCreditBalance, setStoreCreditBalance] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  // Redemption result
  const [redeemSuccess, setRedeemSuccess] = useState<{
    redeemedAmount: number;
    newBalance: number;
  } | null>(null);

  // Check customer session on mount
  useEffect(() => {
    let isMounted = true;
    apiClient
      .get<{
        customer: CustomerProfile;
        storeCredit?: { balance: number; currency: string } | null;
      }>(`/api/v1/storefront/${encodeURIComponent(storeSlug)}/account/profile`)
      .then((res) => {
        if (isMounted) {
          setCustomer(res.customer);
          if (res.storeCredit) {
            setStoreCreditBalance(res.storeCredit.balance);
          }
        }
      })
      .catch(() => {
        // Guest user, not authenticated
      });
    return () => {
      isMounted = false;
    };
  }, [storeSlug]);

  const handleCheckBalance = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError("Please enter a gift card code.");
      return;
    }

    setIsChecking(true);
    setError(null);
    setRedeemSuccess(null);

    try {
      const res = await apiClient.post<{ giftCard: GiftCardDetails }>(
        `/api/v1/storefront/${encodeURIComponent(storeSlug)}/gift-cards/balance`,
        { code: trimmed },
      );
      setCardDetails(res.giftCard);
      setSearchedCode(trimmed);
    } catch (err: unknown) {
      setCardDetails(null);
      if (err instanceof ApiClientError) {
        if (err.status === 404 || err.code === "GIFT_CARD_NOT_FOUND") {
          setError("Gift card not found. Please verify the code and try again.");
        } else {
          setError(err.message || "Failed to look up gift card.");
        }
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsChecking(false);
    }
  };

  const handleRedeemToStoreCredit = async () => {
    if (!searchedCode || isRedeeming) return;

    setIsRedeeming(true);
    setError(null);

    try {
      const res = await apiClient.post<{
        success: boolean;
        redeemedAmount: number;
        currency: string;
        maskedCode: string;
        newStoreCreditBalance: number;
        giftCard: GiftCardDetails;
      }>(`/api/v1/storefront/${encodeURIComponent(storeSlug)}/gift-cards/redeem`, {
        code: searchedCode,
      });

      setRedeemSuccess({
        redeemedAmount: res.redeemedAmount,
        newBalance: res.newStoreCreditBalance,
      });
      setStoreCreditBalance(res.newStoreCreditBalance);
      // Update card details to reflect depleted state
      setCardDetails((prev) =>
        prev
          ? {
              ...prev,
              currentBalance: 0,
              status: "DEPLETED",
              isUsable: false,
            }
          : null,
      );
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.status === 401 || err.code === "AUTHENTICATION_REQUIRED") {
          router.push(
            `/stores/${encodeURIComponent(storeSlug)}/login?redirect=${encodeURIComponent(
              `/stores/${storeSlug}/gift-cards?tab=redeem`,
            )}`,
          );
          return;
        }
        setError(err.message || "Failed to redeem gift card.");
      } else {
        setError("An unexpected error occurred while redeeming. Please try again.");
      }
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleCopyCode = async () => {
    if (!searchedCode) return;
    try {
      await navigator.clipboard.writeText(searchedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start" data-testid="gift-card-redeem-section">
      {/* Left 5 Cols: Visual Voucher or Instructions */}
      <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
        {cardDetails ? (
          <div
            className="relative overflow-hidden rounded-none p-8 sm:p-10 bg-gradient-to-br from-zinc-900 via-neutral-900 to-black text-white border border-white/10 aspect-[1.586/1] flex flex-col justify-between group shadow-xl"
            data-testid="gift-card-balance-card"
          >
            {/* Ambient Sheen */}
            <div
              className={`absolute -right-20 -top-20 w-64 h-64 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
                cardDetails.isUsable
                  ? "bg-emerald-500/20 group-hover:bg-emerald-500/30"
                  : "bg-zinc-600/20"
              }`}
            />
            <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="relative z-10 flex items-start justify-between">
              <div>
                <span className="text-[11px] tracking-widest uppercase text-white/60 font-semibold">
                  E-GIFT VOUCHER
                </span>
                <h3 className="text-xl font-bold tracking-tight text-white mt-0.5">
                  {storeName}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    cardDetails.status === "ACTIVE"
                      ? "success"
                      : cardDetails.status === "DEPLETED"
                      ? "neutral"
                      : "danger"
                  }
                  size="sm"
                  data-testid="gift-card-status-badge"
                >
                  {cardDetails.status}
                </Badge>
              </div>
            </div>

            {/* Balance Ticker */}
            <div className="relative z-10 my-auto py-3">
              <span className="text-xs uppercase tracking-wider text-white/50 block">
                CURRENT BALANCE
              </span>
              <div
                className="text-4xl sm:text-5xl font-black tracking-tight text-white flex items-baseline gap-1 mt-1"
                data-testid="gift-card-balance-amount"
              >
                <span>{formatStorePrice(cardDetails.currentBalance, cardDetails.currency)}</span>
              </div>
              <p className="text-xs text-white/70 font-mono tracking-widest mt-2" data-testid="gift-card-masked-code">
                {cardDetails.maskedCode}
              </p>
            </div>

            {/* Footer */}
            <div className="relative z-10 pt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-white/60">
              <span>
                {cardDetails.expiresAt
                  ? `Expires: ${new Date(cardDetails.expiresAt).toLocaleDateString()}`
                  : "NO EXPIRY • STACKABLE"}
              </span>
              <span>CAL CART SECURE</span>
            </div>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-none p-8 sm:p-10 bg-gradient-to-br from-zinc-900 via-neutral-900 to-black text-white border border-white/10 aspect-[1.586/1] flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] tracking-widest uppercase text-white/60 font-semibold">
                  GIFT VOUCHER PORTAL
                </span>
                <h3 className="text-xl font-bold tracking-tight text-white mt-0.5">
                  {storeName}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-none bg-white/10 border border-white/20 flex items-center justify-center text-amber-300">
                <CreditCard className="w-5 h-5" />
              </div>
            </div>

            <div className="my-auto py-4">
              <p className="text-sm text-white/70 leading-relaxed">
                Enter your 16-character digital gift card code on the right to check your live balance or claim it into your account store credit.
              </p>
            </div>

            <div className="pt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-white/60">
              <span>INSTANT LOOKUP</span>
              <span>VERIFIED BALANCE</span>
            </div>
          </div>
        )}

        {/* How to use info */}
        <div className="space-y-3 text-xs">
          <div className="p-4 rounded-none border border-[color:var(--at-hairline)] bg-muted/20 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <Wallet className="w-4 h-4 text-primary" />
              <span>Two Ways to Redeem</span>
            </div>
            <ul className="space-y-1.5 text-muted-foreground list-disc list-inside">
              <li>
                <strong className="text-foreground">Deposit to Store Credit:</strong> Save it into your customer account to spend across orders automatically.
              </li>
              <li>
                <strong className="text-foreground">Apply at Checkout:</strong> Enter your code under Order Summary when checking out.
              </li>
            </ul>
          </div>

          {onSwitchToBuy && (
            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={onSwitchToBuy}
                className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Need to buy a gift card instead?</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right 7 Cols: Check & Redeem Forms */}
      <div className="lg:col-span-7">
        <Card className="rounded-none border border-[color:var(--at-hairline)] bg-transparent p-6 sm:p-8 space-y-6">
          {/* Card Title & Description */}
          <div className="space-y-1 border-b border-[color:var(--at-hairline)] pb-4">
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Gift className="w-5 h-5 text-primary" />
              <span>Redeem &amp; Check Balance</span>
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Check the remaining balance on any {storeName} gift card or deposit it directly into your customer store credit.
            </p>
          </div>

          {/* Search/Lookup Form */}
          <form onSubmit={handleCheckBalance} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="gift-card-code-input" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                Gift Card Code
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="gift-card-code-input"
                    type="text"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    placeholder="e.g. GC-A7K2-9MNP-4R8X"
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value);
                      setError(null);
                    }}
                    disabled={isChecking || isRedeeming}
                    className="font-mono uppercase text-sm tracking-wider"
                    data-testid="redeem-code-input"
                  />
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isChecking || isRedeeming || !code.trim()}
                  className="rounded-none px-5 text-xs font-bold gap-2 shrink-0 cursor-pointer"
                  data-testid="check-balance-button"
                >
                  {isChecking ? (
                    <>
                      <Spinner size="sm" aria-label="Checking" />
                      <span>Checking...</span>
                    </>
                  ) : (
                    <span>Check Balance</span>
                  )}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Hyphens and spaces are optional. Codes are case-insensitive.
              </p>
            </div>
          </form>

          {/* Error Banner */}
          {error && (
            <div
              className="p-3.5 rounded-none bg-destructive/10 border border-destructive/20 text-xs text-destructive font-medium flex items-start gap-2 animate-in fade-in"
              role="alert"
              data-testid="redeem-error-message"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          {/* Success Banner */}
          {redeemSuccess && (
            <div
              className="p-5 rounded-none bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 space-y-3 animate-in fade-in"
              data-testid="redeem-success-panel"
            >
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-foreground">
                    Gift Card Successfully Redeemed!
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <strong className="text-foreground">
                      {formatStorePrice(redeemSuccess.redeemedAmount, cardDetails?.currency || currency)}
                    </strong>{" "}
                    has been credited to your customer account store credit. Your new balance is{" "}
                    <strong className="text-foreground">
                      {formatStorePrice(redeemSuccess.newBalance, cardDetails?.currency || currency)}
                    </strong>
                    .
                  </p>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap gap-2.5">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => router.push(`/stores/${encodeURIComponent(storeSlug)}/account`)}
                  className="gap-1.5 text-xs font-semibold"
                  data-testid="view-account-credit-button"
                >
                  <Wallet className="w-3.5 h-3.5" />
                  <span>View Account Balance</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/stores/${encodeURIComponent(storeSlug)}/products`)}
                  className="gap-1.5 text-xs font-semibold"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Start Shopping</span>
                </Button>
              </div>
            </div>
          )}

          {/* Card Result & Redemption Actions */}
          {cardDetails && !redeemSuccess && (
            <div className="space-y-6 pt-2 animate-in fade-in slide-in-from-top-2" data-testid="gift-card-actions-section">
              {cardDetails.isUsable ? (
                <div className="space-y-4">
                  {/* Action 1: Deposit to Store Credit */}
                  <div className="p-4 sm:p-5 rounded-none border border-[color:var(--at-hairline)] bg-muted/20 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                          <Wallet className="w-4 h-4 text-primary" />
                          <span>Redeem to Store Credit</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Deposit the full {formatStorePrice(cardDetails.currentBalance, cardDetails.currency)} directly into your account wallet. It will be available automatically on your next checkout.
                        </p>
                      </div>
                    </div>

                    {customer ? (
                      <div className="pt-1 space-y-2">
                        <div className="text-[11px] text-muted-foreground">
                          Signed in as: <strong className="text-foreground">{customer.email}</strong>
                          {storeCreditBalance !== null && (
                            <span> &bull; Current Store Credit: {formatStorePrice(storeCreditBalance, currency)}</span>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="primary"
                          disabled={isRedeeming}
                          onClick={handleRedeemToStoreCredit}
                          className="w-full sm:w-auto text-xs font-bold gap-2 cursor-pointer"
                          data-testid="redeem-to-account-button"
                        >
                          {isRedeeming ? (
                            <>
                              <Spinner size="sm" aria-label="Redeeming" />
                              <span>Depositing to Account...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Redeem {formatStorePrice(cardDetails.currentBalance, cardDetails.currency)} to Account</span>
                            </>
                          )}
                        </Button>
                      </div>
                    ) : (
                      <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <Link
                          href={`/stores/${encodeURIComponent(storeSlug)}/login?redirect=${encodeURIComponent(
                            `/stores/${storeSlug}/gift-cards?tab=redeem`,
                          )}`}
                          className="btn btn-outline text-xs font-bold gap-2 inline-flex items-center py-2 px-4 rounded-none"
                          data-testid="sign-in-to-redeem-button"
                        >
                          <LogIn className="w-4 h-4" />
                          <span>Sign In to Redeem to Account</span>
                        </Link>
                        <span className="text-[11px] text-muted-foreground">
                          Don&apos;t have an account? Create one in seconds.
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Action 2: Use Directly at Checkout */}
                  <div className="p-4 sm:p-5 rounded-none border border-[color:var(--at-hairline)] bg-muted/10 space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                        <ShoppingBag className="w-4 h-4 text-primary" />
                        <span>Use at Checkout</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Prefer to keep the code? You can paste it directly under the Order Summary at checkout.
                      </p>
                    </div>

                    <div className="pt-1 flex flex-wrap items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleCopyCode}
                        className="gap-1.5 text-xs font-semibold cursor-pointer"
                        data-testid="copy-code-button"
                      >
                        {copied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Copied to Clipboard!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Code ({searchedCode})</span>
                          </>
                        )}
                      </Button>

                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => router.push(`/stores/${encodeURIComponent(storeSlug)}/checkout`)}
                        className="gap-1.5 text-xs font-semibold cursor-pointer"
                        data-testid="go-to-checkout-button"
                      >
                        <span>Go to Checkout</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-none bg-muted/30 border border-[color:var(--at-hairline)] space-y-2">
                  <h4 className="text-sm font-semibold text-foreground">
                    This gift card cannot be redeemed
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {cardDetails.status === "DEPLETED"
                      ? "This gift card has already been fully redeemed and has a zero balance remaining."
                      : cardDetails.status === "EXPIRED"
                      ? "This gift card has expired and can no longer be used."
                      : "This gift card is currently inactive or disabled. Please contact store support for assistance."}
                  </p>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
