"use client";

import React, { Suspense, use, useState } from "react";
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
import { StorefrontShell } from "../../../../src/components/storefront/StorefrontShell";
import { apiClient, ApiClientError } from "../../../../src/lib/api-client";

interface PageProps {
  params: Promise<{ storeSlug: string }>;
}

function CustomerResetPasswordForm({ storeSlug }: { storeSlug: string }) {
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
    <StorefrontShell storeName="Reset Password" storeSlug={storeSlug}>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "var(--space-12) var(--space-4)",
        }}
      >
        <div style={{ width: "100%", maxWidth: "420px" }}>
          <Card>
            <CardHeader>
              <CardTitle>Create New Password</CardTitle>
              <CardDescription>
                Choose a strong new password for your customer account.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {success ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                  <Alert variant="success" title="Password Reset Complete">
                    Your password has been successfully updated. All other active sessions have been invalidated for security.
                  </Alert>
                  <Button
                    variant="primary"
                    onClick={() => router.push(`/stores/${storeSlug}/login`)}
                    style={{ width: "100%" }}
                  >
                    Sign In with New Password
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} noValidate>
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                    {error && (
                      <Alert variant="danger" title="Error">
                        {error}
                      </Alert>
                    )}

                    <FormField
                      label="Reset Token"
                      htmlFor="customer-reset-token"
                      required
                      helperText="Pasted automatically from your reset link"
                    >
                      <Input
                        id="customer-reset-token"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="Paste reset token"
                        disabled={isSubmitting}
                        required
                      />
                    </FormField>

                    <FormField
                      label="New Password"
                      htmlFor="customer-new-password"
                      required
                      helperText="Must be at least 8 characters"
                    >
                      <Input
                        id="customer-new-password"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        disabled={isSubmitting}
                        autoFocus
                        required
                      />
                    </FormField>

                    <FormField label="Confirm New Password" htmlFor="customer-confirm-password" required>
                      <Input
                        id="customer-confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        disabled={isSubmitting}
                        required
                      />
                    </FormField>

                    <Button
                      type="submit"
                      variant="primary"
                      loading={isSubmitting}
                      disabled={isSubmitting || !token.trim() || !newPassword || newPassword !== confirmPassword}
                      style={{ width: "100%", marginTop: "var(--space-2)" }}
                    >
                      Update Password
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
            <CardFooter
              style={{
                borderTop: "1px solid var(--color-border)",
                justifyContent: "center",
                padding: "var(--space-4)",
              }}
            >
              <a
                href={`/stores/${storeSlug}/login`}
                style={{
                  fontSize: "var(--font-size-sm)",
                  color: "var(--color-text-secondary)",
                  textDecoration: "none",
                }}
              >
                ← Back to sign in
              </a>
            </CardFooter>
          </Card>
        </div>
      </div>
    </StorefrontShell>
  );
}

export default function CustomerResetPasswordPage({ params }: PageProps) {
  const { storeSlug } = use(params);

  return (
    <Suspense
      fallback={
        <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-16) 0" }}>
          <Spinner size="lg" label="Loading..." />
        </div>
      }
    >
      <CustomerResetPasswordForm storeSlug={storeSlug} />
    </Suspense>
  );
}
