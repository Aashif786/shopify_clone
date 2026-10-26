"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Alert,
  Button,
  FormField,
  Input,
} from "@shopify-clone/ui";
import { ArrowLeft, KeyRound, CheckCircle2 } from "lucide-react";
import { apiClient, ApiClientError } from "../../../src/lib/api-client";
import { ThemeModeToggle } from "../../../src/components/theme-mode-toggle";

export default function MerchantForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    try {
      await apiClient.post<{ message: string }>(
        "/api/v1/auth/forgot-password",
        { email: email.trim() }
      );

      setResetSent(true);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setError(err.message || "Failed to process password reset request.");
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background">
      {/* Left brand panel */}
      <div className="hidden md:flex md:w-[45%] flex-col justify-between bg-[var(--color-bg-surface)] border-r border-border/60 p-10 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
          aria-hidden="true"
        />

        <div className="relative z-10">
          <Link
            href="/merchant"
            className="inline-flex items-center gap-2.5 mb-12"
          >
            <span className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-xs font-black shadow-sm">
              CC
            </span>
            <span className="text-sm font-bold text-foreground tracking-tight">Cal Cart</span>
          </Link>

          <h2 className="text-2xl font-bold tracking-tight text-foreground mb-3 leading-snug">
            Secure Account<br />Recovery.
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
            We prioritize the security of your store data. Your recovery request generates a time-limited, encrypted reset token.
          </p>
        </div>

        <p className="relative z-10 text-[11px] text-muted-foreground/60">
          Cal Cart Merchant Console &mdash; Multi-tenant commerce platform
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 relative">
        <div className="absolute top-4 right-4">
          <ThemeModeToggle />
        </div>

        <div className="w-full max-w-[420px]">
          {/* Mobile brand mark */}
          <div className="flex items-center gap-2 mb-8 md:hidden">
            <span className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-xs font-black shadow-sm">
              CC
            </span>
            <span className="text-sm font-bold text-foreground tracking-tight">Cal Cart</span>
          </div>

          <div className="mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
              <KeyRound size={20} />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground mb-1">
              Reset your password
            </h1>
            <p className="text-xs text-muted-foreground">
              Enter your merchant email to receive password reset instructions.
            </p>
          </div>

          {resetSent ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                    Instructions Dispatched
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    If an account exists with <strong>{email}</strong>, a password reset token has been issued. Check your email inbox.
                  </p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Did not receive an email? Check your spam folder or ensure the email matches your merchant registration.
              </p>

              <div className="pt-2">
                <Link
                  href="/merchant/login"
                  className="inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:underline"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Return to Sign In
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {error && (
                <Alert variant="danger" title="Error">
                  {error}
                </Alert>
              )}

              <FormField label="Email Address" htmlFor="reset-email" required>
                <Input
                  id="reset-email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="name@business.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  autoFocus
                  required
                  className="h-9 text-sm"
                />
              </FormField>

              <Button
                type="submit"
                variant="primary"
                loading={isSubmitting}
                disabled={isSubmitting || !email.trim()}
                className="w-full h-9 text-xs font-medium"
              >
                Send Reset Instructions
              </Button>

              <div className="flex justify-center pt-2">
                <Link
                  href="/merchant/login"
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
