"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Alert,
  Button,
  FormField,
  Input,
  Spinner,
} from "@shopify-clone/ui";
import { ArrowLeft, Lock, CheckCircle2 } from "lucide-react";
import { apiClient, ApiClientError } from "../../../src/lib/api-client";
import { ThemeModeToggle } from "../../../src/components/theme-mode-toggle";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams?.get("token") || "";

  const [token, setToken] = useState(tokenFromUrl);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim() || !newPassword || isSubmitting) return;

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await apiClient.post("/api/v1/auth/reset-password", {
        token: token.trim(),
        newPassword,
      });

      setSuccess(true);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setError(err.message || "Failed to reset password. The token may be invalid or expired.");
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
            Choose a new<br />secure password.
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
            After updating your password, all previous merchant active sessions will be cleanly invalidated for security.
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
              <Lock size={20} />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground mb-1">
              Set new password
            </h1>
            <p className="text-xs text-muted-foreground">
              Enter your reset token and new secure password.
            </p>
          </div>

          {success ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                    Password Reset Complete
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    Your password has been successfully updated. All previous sessions have been securely terminated.
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="primary"
                onClick={() => router.push("/merchant/login")}
                className="w-full h-9 text-xs font-medium"
              >
                Sign In With New Password
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {error && (
                <Alert variant="danger" title="Reset Error">
                  {error}
                </Alert>
              )}

              {!tokenFromUrl && (
                <FormField label="Reset Token" htmlFor="reset-token" required>
                  <Input
                    id="reset-token"
                    name="token"
                    placeholder="Paste reset token here"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    disabled={isSubmitting}
                    required
                    className="h-9 text-sm font-mono"
                  />
                </FormField>
              )}

              <FormField
                label="New Password"
                htmlFor="reset-new-password"
                required
                helperText="Minimum 8 characters."
              >
                <Input
                  id="reset-new-password"
                  type="password"
                  name="newPassword"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isSubmitting}
                  required
                  className="h-9 text-sm font-mono"
                />
              </FormField>

              <FormField
                label="Confirm New Password"
                htmlFor="reset-confirm-password"
                required
              >
                <Input
                  id="reset-confirm-password"
                  type="password"
                  name="confirmPassword"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isSubmitting}
                  required
                  className="h-9 text-sm font-mono"
                />
              </FormField>

              <Button
                type="submit"
                variant="primary"
                loading={isSubmitting}
                disabled={
                  isSubmitting ||
                  !token.trim() ||
                  !newPassword ||
                  newPassword !== confirmPassword
                }
                className="w-full h-9 text-xs font-medium mt-2"
              >
                Save New Password
              </Button>

              <div className="flex justify-center pt-2">
                <Link
                  href="/merchant/login"
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Return to Sign In
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MerchantResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center min-h-[100dvh]">
          <Spinner size="lg" label="Loading..." />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
