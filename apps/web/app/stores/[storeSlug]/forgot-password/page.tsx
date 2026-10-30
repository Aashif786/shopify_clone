"use client";

import React, { use, useState } from "react";
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
} from "@calcart/ui";
import { StorefrontShell } from "../../../../src/components/storefront/StorefrontShell";
import { apiClient, ApiClientError } from "../../../../src/lib/api-client";

interface PageProps {
  params: Promise<{ storeSlug: string }>;
}

export default function CustomerForgotPasswordPage({ params }: PageProps) {
  const { storeSlug } = use(params);

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
        `/api/v1/storefront/${storeSlug}/auth/forgot-password`,
        { email: email.trim() }
      );

      setResetSent(true);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setError(err.message || "Failed to process password recovery request.");
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <StorefrontShell storeName="Account Recovery" storeSlug={storeSlug}>
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
              <CardTitle>Reset your password</CardTitle>
              <CardDescription>
                Enter your account email address and we will send you password reset instructions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {resetSent ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                  <Alert variant="success" title="Recovery Email Sent">
                    If an account matches <strong>{email}</strong>, password reset instructions have been generated.
                  </Alert>


                  <a
                    href={`/stores/${storeSlug}/login`}
                    className="btn btn-outline"
                    style={{ textAlign: "center", textDecoration: "none" }}
                  >
                    Return to Sign In
                  </a>
                </div>
              ) : (
                <form onSubmit={handleSubmit} noValidate>
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                    {error && (
                      <Alert variant="danger" title="Error">
                        {error}
                      </Alert>
                    )}

                    <FormField label="Email Address" htmlFor="recovery-email" required>
                      <Input
                        id="recovery-email"
                        type="email"
                        name="email"
                        autoComplete="email"
                        placeholder="you@example.com"
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
