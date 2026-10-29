"use client";

import React, { useState } from "react";
import { CheckCircle2, Mail, Send } from "lucide-react";
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
}: StorefrontLandingSectionProps) {
  const [email, setEmail] = useState("");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const cfg = (section.config || {}) as NewsletterSectionConfig;
  const heading = cfg.heading || "Stay in the loop";
  const description =
    cfg.description ||
    "Be the first to hear about small-batch drops, private sales, and seasonal lookbooks.";
  const placeholder = cfg.placeholder || "Enter your email address...";
  const buttonText = cfg.buttonText || "Subscribe";
  const disclaimer = cfg.disclaimer || "No spam, unsubscribe anytime with one click.";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) return;

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setIsSubscribed(true);
    }, 600);
  };

  return (
    <section className="storefront-newsletter max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <div className="relative overflow-hidden rounded-3xl border border-[var(--landing-border)] bg-[var(--landing-surface)] p-8 sm:p-12 text-center space-y-6 shadow-xl">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-[var(--landing-primary)]/15 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-3 relative z-10 max-w-xl mx-auto">
          <div className="inline-flex p-3 rounded-2xl bg-[var(--landing-primary)]/10 text-[var(--landing-primary)]">
            <Mail className="w-6 h-6" />
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[var(--landing-text)]">
            {heading}
          </h2>
          <p className="text-sm sm:text-base text-[var(--landing-muted)]">
            {description}
          </p>
        </div>

        {isSubscribed ? (
          <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center gap-2 max-w-md mx-auto animate-in fade-in zoom-in-95">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <p className="text-sm font-semibold">
              You're on the list! Check your inbox shortly for a welcome gift.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="flex flex-col sm:flex-row items-center gap-3 max-w-md mx-auto relative z-10"
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={placeholder}
              className="w-full px-4 py-3 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-background)] text-sm text-[var(--landing-text)] placeholder:text-[var(--landing-muted)] focus:outline-hidden focus:ring-2 focus:ring-[var(--landing-primary)]"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[var(--landing-primary)] text-[var(--landing-button-text)] font-semibold text-sm hover:opacity-90 transition-all active:scale-95 shrink-0 disabled:opacity-50 inline-flex items-center justify-center gap-2 shadow-md cursor-pointer"
            >
              <span>{isLoading ? "Joining..." : buttonText}</span>
              <Send className="w-4 h-4" />
            </button>
          </form>
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
