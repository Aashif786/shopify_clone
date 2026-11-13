"use client";

import React, { useState } from "react";
import { CheckCircle2, Mail, Send, Loader2, AlertCircle } from "lucide-react";
import type { StorefrontLandingSectionProps } from "../types";

export interface NewsletterSectionConfig {
  heading?: string;
  description?: string;
  placeholder?: string;
  buttonText?: string;
  disclaimer?: string;
}

export function NewsletterSection({
  section,
  storeSlug,
  isPreview,
}: StorefrontLandingSectionProps) {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cfg = (section.config || {}) as NewsletterSectionConfig;
  const heading = cfg.heading || "Stay in the loop";
  const description =
    cfg.description ||
    "Be the first to hear about small-batch drops, private sales, and seasonal lookbooks.";
  const placeholder = cfg.placeholder || "Enter your email address...";
  const buttonText = cfg.buttonText || "Subscribe";
  const disclaimer = cfg.disclaimer || "No spam, unsubscribe anytime with one click.";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    if (isPreview) {
      setSuccessMessage("Newsletter preview: live subscriptions are stored on the published storefront.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/v1/storefront/${encodeURIComponent(storeSlug)}/newsletter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, source: "STOREFRONT_LANDING" }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message || "Failed to subscribe. Please try again.");
      }

      setSuccessMessage(json?.data?.message || "Thank you for subscribing to our newsletter!");
      setEmail("");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Subscription failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="storefront-newsletter max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="relative overflow-hidden rounded-none border border-[var(--landing-border)] bg-[var(--landing-surface)] p-8 sm:p-12 text-center space-y-6">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-[var(--landing-primary)]/15 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-3 relative z-10 max-w-xl mx-auto">
          <div className="inline-flex p-3 rounded-none bg-[var(--landing-primary)]/10 text-[var(--landing-primary)]">
            <Mail className="w-6 h-6" />
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[var(--landing-text)]">
            {heading}
          </h2>
          <p className="text-sm sm:text-base text-[var(--landing-muted)]">
            {description}
          </p>
        </div>

        {successMessage ? (
          <div className="p-6 rounded-none bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto animate-in fade-in zoom-in-95">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500" />
            <p className="text-sm font-semibold">{successMessage}</p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="flex flex-col sm:flex-row items-center gap-3 max-w-md mx-auto relative z-10"
            noValidate
          >
            <input
              type="email"
              required
              disabled={isSubmitting}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder={placeholder}
              aria-label="Email address"
              className="w-full px-4 py-3 rounded-none border border-[var(--landing-border)] bg-[var(--landing-background)] text-sm text-[var(--landing-text)] placeholder:text-[var(--landing-muted)] focus:outline-hidden focus:ring-2 focus:ring-[var(--landing-primary)] disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-6 py-3 rounded-none bg-[var(--landing-primary)] text-[var(--landing-button-text)] font-semibold text-sm hover:opacity-90 transition-all active:scale-95 shrink-0 disabled:opacity-50 inline-flex items-center justify-center gap-2 shadow-md cursor-pointer"
            >
              <span>{buttonText}</span>
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </form>
        )}

        {errorMessage && (
          <div className="p-3 px-4 rounded-none bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium max-w-md mx-auto flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {disclaimer && (
          <p className="text-xs text-[var(--landing-muted)] relative z-10">
            {disclaimer}
          </p>
        )}
      </div>
    </section>
  );
}
