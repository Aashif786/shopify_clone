"use client";

import React, { Suspense, useState } from "react";
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
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--color-bg)",
        padding: "var(--space-4)",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "var(--space-4)",
          right: "var(--space-4)",
        }}
      >
        <ThemeModeToggle />
      </div>

      <div style={{ width: "100%", maxWidth: "420px" }}>
        <div style={{ textAlign: "center", marginBottom: "var(--space-6)" }}>
          <h1
            style={{
              fontSize: "var(--font-size-2xl)",
              fontWeight: 700,
              color: "var(--color-text-primary)",
              letterSpacing: "-0.02em",
              margin: 0,
            }}
          >
            Create New Password
          </h1>
          <p
            style={{
              color: "var(--color-text-secondary)",
              fontSize: "var(--font-size-sm)",
              marginTop: "var(--space-1)",
            }}
          >
            Enter your reset token and new secure password
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Set New Password</CardTitle>
            <CardDescription>
              Your new password must be at least 8 characters long.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {success ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                <Alert variant="success" title="Password Reset Complete">
                  Your password has been successfully updated. All previous sessions have been securely terminated.
                </Alert>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => router.push("/merchant/login")}
                  style={{ width: "100%" }}
                >
                  Sign In With New Password
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
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
              href="/merchant/login"
              style={{
                fontSize: "var(--font-size-sm)",
                color: "var(--color-text-secondary)",
                textDecoration: "none",
              }}
            >
              ← Back to Sign In
            </a>
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
        <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-16) 0" }}>
          <Spinner size="lg" label="Loading..." />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
