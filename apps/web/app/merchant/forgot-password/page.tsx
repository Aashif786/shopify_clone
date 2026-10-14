"use client";

import React, { useState } from "react";
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
} from "@shopify-clone/ui";
import { apiClient, ApiClientError } from "../../../src/lib/api-client";
import { ThemeModeToggle } from "../../../src/components/theme-mode-toggle";

export default function MerchantForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);

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
            Reset Your Password
          </h1>
          <p
            style={{
              color: "var(--color-text-secondary)",
              fontSize: "var(--font-size-sm)",
              marginTop: "var(--space-1)",
            }}
          >
            Enter your merchant email to receive password reset instructions
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Merchant Password Recovery</CardTitle>
            <CardDescription>
              We will send a secure token to reset your password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {resetSent ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                <Alert variant="success" title="Instructions Dispatched">
                  If an account exists with <strong>{email}</strong>, a password reset token has been issued.
                </Alert>

                {devToken && (
                  <div
                    style={{
                      padding: "var(--space-3)",
                      backgroundColor: "var(--color-bg)",
                      borderRadius: "var(--radius-md)",
                      border: "1px dashed var(--color-primary)",
                    }}
                  >
                    <p style={{ fontSize: "var(--font-size-xs)", margin: "0 0 var(--space-2) 0", color: "var(--color-text-secondary)" }}>
                      <strong>Demo Environment Token:</strong>
                    </p>
                    <a
                      href={`/merchant/reset-password?token=${encodeURIComponent(devToken)}`}
                      className="btn btn-primary btn-sm"
                      style={{ display: "inline-block", textAlign: "center", width: "100%" }}
                    >
                      Click here to reset password now →
                    </a>
                  </div>
                )}

                <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", margin: 0 }}>
                  Did not receive an email? Check your spam folder or ensure the email matches your merchant registration.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
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
                    />
                  </FormField>

                  <Button
                    type="submit"
                    variant="primary"
                    loading={isSubmitting}
                    disabled={isSubmitting || !email.trim()}
                    style={{ width: "100%", marginTop: "var(--space-2)" }}
                  >
                    Send Reset Instructions
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
