"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  FormField,
  Input,
  Spinner,
} from "@shopify-clone/ui";
import { ArrowLeft } from "lucide-react";
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-8 relative">
      <div className="absolute top-4 right-4">
        <ThemeModeToggle />
      </div>

      <div className="w-full max-w-[420px] space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-primary-foreground font-bold text-xl shadow-md shadow-primary/20">
            C
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Create New Password
          </h1>
          <p className="text-xs text-muted-foreground">
            Enter your reset token and new secure password
          </p>
        </div>

        <Card className="border-border/70 bg-card shadow-sm">
          <CardHeader className="border-b border-border/50 pb-5">
            <CardTitle className="text-lg font-semibold tracking-tight text-foreground">
              Set New Password
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-1">
              Your new password must be at least 8 characters long.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {success ? (
              <div className="space-y-4">
                <Alert variant="success" title="Password Reset Complete">
                  Your password has been successfully updated. All previous sessions have been securely terminated.
                </Alert>
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
                    autoFocus
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
                  Update Password
                </Button>
              </form>
            )}
          </CardContent>
          <CardFooter className="border-t border-border/50 bg-muted/20 py-4 px-6 justify-center">
            <Link
              href="/merchant/login"
              className="inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:underline"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to Sign In
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

export default function MerchantResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center min-h-screen">
          <Spinner size="lg" label="Loading..." />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
