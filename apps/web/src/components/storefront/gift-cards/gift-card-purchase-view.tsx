"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Gift,
  Mail,
  User,
  Sparkles,
  ShieldCheck,
  Zap,
  CheckCircle2,
  ArrowRight,
  ShoppingBag,
  CreditCard,
} from "lucide-react";
import { Button, Input, FormField, Card } from "@calcart/ui";
import { useCart } from "../../../context/cart-context";
import { ApiClientError, apiClient } from "../../../lib/api-client";
import { formatStorePrice } from "../products/product-card";
import { GiftCardRedeemView } from "./gift-card-redeem-view";

export interface GiftCardDenomination {
  variantId: string | null;
  title: string;
  amount: number;
  sku: string;
}

export interface GiftCardPurchaseViewProps {
  storeSlug: string;
  storeName: string;
  currency: string;
  denominations: GiftCardDenomination[];
  initialTab?: "buy" | "redeem";
}

export function GiftCardPurchaseView({
  storeSlug,
  storeName,
  currency,
  denominations,
  initialTab = "buy",
}: GiftCardPurchaseViewProps) {
  const router = useRouter();
  const { cart, refreshCart } = useCart();

  const [activeTab, setActiveTab] = useState<"buy" | "redeem">(initialTab);

  const [selectedAmount, setSelectedAmount] = useState<number>(
    denominations[0]?.amount ?? 100000,
  );
  const [customAmountStr, setCustomAmountStr] = useState<string>("");
  const [isCustom, setIsCustom] = useState<boolean>(false);

  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [message, setMessage] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Sync tab with ?tab= query parameter on client mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("tab") === "redeem") {
        setActiveTab("redeem");
      }
    }
  }, []);

  const handleTabChange = (tab: "buy" | "redeem") => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (tab === "redeem") {
        url.searchParams.set("tab", "redeem");
      } else {
        url.searchParams.delete("tab");
      }
      window.history.replaceState({}, "", url.toString());
    }
  };

  const effectiveAmount = isCustom
    ? Math.round(Number(customAmountStr) * 100) || 0
    : selectedAmount;

  const handleSelectPredefined = (amt: number) => {
    setIsCustom(false);
    setSelectedAmount(amt);
    setCustomAmountStr("");
    setError(null);
  };

  const handleCustomChange = (val: string) => {
    setIsCustom(true);
    setCustomAmountStr(val);
    setError(null);
  };

  const handleAddToCart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    if (effectiveAmount < 100) {
      setError(`Minimum gift card amount is ${formatStorePrice(100, currency)}`);
      return;
    }

    if (recipientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.trim())) {
      setError("Please enter a valid recipient email address.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await apiClient.post(`/api/v1/storefront/${encodeURIComponent(storeSlug)}/gift-cards`, {
        amount: effectiveAmount,
        recipientEmail: recipientEmail.trim() || null,
        recipientName: recipientName.trim() || null,
        message: message.trim() || null,
        cartId: cart?.id,
      });

      await refreshCart();
      setSuccess(true);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setError(err.message || "Failed to add gift card to cart");
      } else {
        setError("An error occurred while adding the gift card. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="at-container pb-24 pt-10 sm:pt-16 space-y-10" data-testid="gift-cards-hub">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-4">
        <div className="at-eyebrow inline-flex items-center gap-2 text-muted-foreground">
          <Gift size={13} aria-hidden="true" />
          <span>OFFICIAL GIFT CARD PORTAL</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground">
          {storeName} Gift Cards
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
          {activeTab === "buy"
            ? "The perfect gift for any occasion. Delivered straight to your recipient's inbox with a personalized note, redeemable on any item in our store."
            : "Check your live balance or claim your gift card code into your customer account store credit."}
        </p>

        {/* Tab Switcher */}
        <div className="pt-2 flex justify-center">
          <div
            className="inline-flex rounded-none border border-[color:var(--at-hairline)] bg-muted/40 p-1 gap-1"
            role="tablist"
            data-testid="gift-card-tabs"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "buy"}
              onClick={() => handleTabChange("buy")}
              className={`px-5 py-2 text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === "buy"
                  ? "bg-background text-foreground shadow-sm border border-[color:var(--at-hairline)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid="tab-buy-gift-card"
            >
              <Gift className="w-3.5 h-3.5" />
              <span>Buy Gift Card</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "redeem"}
              onClick={() => handleTabChange("redeem")}
              className={`px-5 py-2 text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === "redeem"
                  ? "bg-background text-foreground shadow-sm border border-[color:var(--at-hairline)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid="tab-redeem-gift-card"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Redeem &amp; Check Balance</span>
            </button>
          </div>
        </div>
      </div>

      {/* Render Active View */}
      {activeTab === "redeem" ? (
        <GiftCardRedeemView
          storeSlug={storeSlug}
          storeName={storeName}
          currency={currency}
          onSwitchToBuy={() => handleTabChange("buy")}
        />
      ) : (
        <div className="space-y-8">
          {/* Quick switcher link on buy tab */}
          <div className="flex justify-center -mt-4">
            <button
              type="button"
              onClick={() => handleTabChange("redeem")}
              className="text-xs text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              data-testid="switch-to-redeem-link"
            >
              <span>Already received a gift card?</span>
              <span className="font-semibold text-primary underline underline-offset-2">
                Check balance or redeem here &rarr;
              </span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            {/* Left 5 Cols: Visual Voucher Card Preview */}
            <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
              <div className="relative overflow-hidden rounded-none p-8 sm:p-10 bg-gradient-to-br from-zinc-900 via-neutral-900 to-black text-white border border-white/10 aspect-[1.586/1] flex flex-col justify-between group">
                {/* Ambient Sheen */}
                <div className="absolute -right-20 -top-20 w-64 h-64 bg-primary/20 rounded-full blur-3xl pointer-events-none group-hover:bg-primary/30 transition-all duration-700" />
                <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

                {/* Card Header */}
                <div className="relative z-10 flex items-start justify-between">
                  <div>
                    <span className="text-[11px] tracking-widest uppercase text-white/60 font-semibold">
                      E-GIFT VOUCHER
                    </span>
                    <h3 className="text-xl font-bold tracking-tight text-white mt-0.5">
                      {storeName}
                    </h3>
                  </div>
                  <div className="w-10 h-10 rounded-none bg-white/10 border border-white/20 flex items-center justify-center text-primary">
                    <Gift className="w-5 h-5 text-amber-300" />
                  </div>
                </div>

                {/* Balance Ticker */}
                <div className="relative z-10 my-auto py-4">
                  <span className="text-xs uppercase tracking-wider text-white/50 block">
                    STORE CREDIT VALUE
                  </span>
                  <div className="text-4xl sm:text-5xl font-black tracking-tight text-white flex items-baseline gap-1 mt-1">
                    <span>{formatStorePrice(effectiveAmount, currency)}</span>
                  </div>
                  {recipientName && (
                    <p className="text-xs text-white/80 mt-2 font-medium">
                      For: <span className="text-white font-semibold">{recipientName}</span>
                    </p>
                  )}
                </div>

                {/* Card Footer */}
                <div className="relative z-10 pt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-white/60">
                  <span>NO EXPIRY &bull; STACKABLE</span>
                  <span>CAL CART SECURE</span>
                </div>
              </div>

              {/* Perks list */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3.5 rounded-none border border-[color:var(--at-hairline)] bg-transparent flex items-start gap-2.5">
                  <Zap className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <strong className="text-foreground block font-semibold">Instant Send</strong>
                    <span className="text-muted-foreground text-[11px]">Emailed right away after purchase</span>
                  </div>
                </div>
                <div className="p-3.5 rounded-none border border-[color:var(--at-hairline)] bg-transparent flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <strong className="text-foreground block font-semibold">Never Expires</strong>
                    <span className="text-muted-foreground text-[11px]">Use anytime, multiple checkouts</span>
                  </div>
                </div>
                <div className="p-3.5 rounded-none border border-[color:var(--at-hairline)] bg-transparent flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <strong className="text-foreground block font-semibold">100% Flexible</strong>
                    <span className="text-muted-foreground text-[11px]">Redeem on any store product</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right 7 Cols: Configuration & Purchase Form */}
            <div className="lg:col-span-7">
              <Card className="rounded-none border border-[color:var(--at-hairline)] bg-transparent p-6 sm:p-8 space-y-6">
                {success ? (
                  <div className="py-8 text-center space-y-5" data-testid="gift-card-success-panel">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 mx-auto flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-bold tracking-tight text-foreground">
                        Gift Card Added to Cart!
                      </h3>
                      <p className="text-sm text-muted-foreground max-w-md mx-auto">
                        A {formatStorePrice(effectiveAmount, currency)} digital gift card has been
                        added to your cart. Proceed to checkout to finalize your purchase.
                      </p>
                    </div>
                    <div className="pt-2 flex flex-col sm:flex-row justify-center gap-3">
                      <Button
                        variant="primary"
                        onClick={() => router.push(`/stores/${encodeURIComponent(storeSlug)}/checkout`)}
                        className="gap-2"
                      >
                        <span>Proceed to Checkout</span>
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSuccess(false);
                          setRecipientEmail("");
                          setRecipientName("");
                          setMessage("");
                        }}
                      >
                        Buy Another Card
                      </Button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleAddToCart} className="space-y-6">
                    {/* 1. Denomination Selection */}
                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-foreground block">
                        1. Select Value
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        {denominations.map((denom) => {
                          const isSelected = !isCustom && selectedAmount === denom.amount;
                          return (
                            <button
                              key={denom.sku}
                              type="button"
                              onClick={() => handleSelectPredefined(denom.amount)}
                              className={`py-3 px-4 rounded-none border text-sm font-bold transition-all text-center ${
                                isSelected
                                  ? "border-primary bg-primary text-primary-foreground scale-[1.02]"
                                  : "border-[color:var(--at-hairline)] bg-muted/30 text-foreground hover:bg-muted/70 hover:border-border"
                              }`}
                              data-testid={`denomination-${denom.amount}`}
                            >
                              {formatStorePrice(denom.amount, currency)}
                            </button>
                          );
                        })}
                      </div>

                      {/* Custom Amount option */}
                      <div className="pt-1">
                        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                          Or specify custom amount ({currency}):
                        </label>
                        <div className="relative">
                          <Input
                            type="number"
                            min="1"
                            step="any"
                            placeholder="e.g. 1500"
                            value={customAmountStr}
                            onChange={(e) => handleCustomChange(e.target.value)}
                            className="pl-8 text-sm"
                            data-testid="gift-card-custom-amount-input"
                          />
                          <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-bold">
                            {currency}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 2. Recipient Personalization */}
                    <div className="space-y-4 pt-4 border-t border-[color:var(--at-hairline)]">
                      <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-foreground">
                          2. Recipient Details (Optional)
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          If left blank, the gift card code will be sent to your billing email at checkout.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField label="Recipient Name" htmlFor="recipient-name">
                          <div className="relative">
                            <Input
                              id="recipient-name"
                              type="text"
                              placeholder="e.g. Alex Johnson"
                              value={recipientName}
                              onChange={(e) => setRecipientName(e.target.value)}
                              className="pl-9"
                              data-testid="gift-card-recipient-name-input"
                            />
                            <User className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                          </div>
                        </FormField>

                        <FormField label="Recipient Email" htmlFor="recipient-email">
                          <div className="relative">
                            <Input
                              id="recipient-email"
                              type="email"
                              placeholder="alex@example.com"
                              value={recipientEmail}
                              onChange={(e) => setRecipientEmail(e.target.value)}
                              className="pl-9"
                              data-testid="gift-card-recipient-email-input"
                            />
                            <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                          </div>
                        </FormField>
                      </div>

                      <FormField label="Personal Message" htmlFor="gift-card-message">
                        <div className="relative">
                          <textarea
                            id="gift-card-message"
                            rows={3}
                            maxLength={500}
                            placeholder="Add a personalized note..."
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className="w-full rounded-none border border-input bg-transparent px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            data-testid="gift-card-message-input"
                          />
                        </div>
                      </FormField>
                    </div>

                    {error && (
                      <div className="p-3.5 rounded-none bg-destructive/10 border border-destructive/20 text-xs text-destructive font-medium">
                        {error}
                      </div>
                    )}

                    {/* Submit Action */}
                    <div className="pt-2">
                      <Button
                        type="submit"
                        variant="primary"
                        disabled={isLoading || effectiveAmount <= 0}
                        className="w-full py-3 h-12 rounded-none text-sm font-bold gap-2 cursor-pointer"
                        data-testid="buy-gift-card-button"
                      >
                        <ShoppingBag className="w-4 h-4" />
                        <span>
                          {isLoading
                            ? "Adding to Cart..."
                            : `Add to Cart \u2022 ${formatStorePrice(effectiveAmount, currency)}`}
                        </span>
                      </Button>
                    </div>
                  </form>
                )}
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
