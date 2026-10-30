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
} from "@calcart/ui";
import { StorefrontShell } from "../../../../src/components/storefront/StorefrontShell";
import { apiClient, ApiClientError } from "../../../../src/lib/api-client";

interface PageProps {
  params: Promise<{ storeSlug: string }>;
}

function getSafeRedirectUrl(url: string | null | undefined, fallback: string): string {
  if (!url) return fallback;
  if (url.startsWith("/") && !url.startsWith("//") && !url.startsWith("/\\")) {
    return url;
  }
  return fallback;
}

function CustomerLoginForm({ storeSlug }: { storeSlug: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultAccountUrl = `/stores/${storeSlug}/account`;
  const redirectUrl = getSafeRedirectUrl(searchParams?.get("redirect"), defaultAccountUrl);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password || isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    try {
      await apiClient.post(`/api/v1/storefront/${encodeURIComponent(storeSlug)}/auth/login`, {
        email: email.trim(),
        password,
      });

      router.push(redirectUrl);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setError(err.message || "Invalid email or password.");
      } else {
        setError("Failed to sign in. Please verify your credentials.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <StorefrontShell storeName="Storefront Customer Sign In" storeSlug={storeSlug}>
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
              <CardTitle>Sign in to your customer account</CardTitle>
              <CardDescription>
                Track your orders, view receipts, and manage saved delivery addresses.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} noValidate>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                  {error && (
                    <Alert variant="danger" title="Sign In Error">
                      {error}
                    </Alert>
                  )}

                  <FormField label="Email Address" htmlFor="customer-email" required>
                    <Input
                      id="customer-email"
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

                  <FormField
                    label="Password"
                    htmlFor="customer-password"
                    required
                  >
                    <Input
                      id="customer-password"
                      type="password"
                      name="password"
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isSubmitting}
                      required
                    />
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "var(--space-1)" }}>
                      <a
                        href={`/stores/${storeSlug}/forgot-password`}
                        style={{
                          fontSize: "var(--font-size-xs)",
                          color: "var(--color-primary)",
                          textDecoration: "none",
                        }}
                      >
                        Forgot password?
                      </a>
                    </div>
                  </FormField>

                  <Button
                    type="submit"
                    variant="primary"
                    loading={isSubmitting}
                    disabled={isSubmitting || !email.trim() || !password}
                    style={{ width: "100%", marginTop: "var(--space-2)" }}
                  >
                    Sign In
                  </Button>
                </div>
              </form>
            </CardContent>
            <CardFooter
              style={{
                borderTop: "1px solid var(--color-border)",
                justifyContent: "center",
                padding: "var(--space-4)",
              }}
            >
              <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)" }}>
                Don&apos;t have an account?{" "}
                <a
                  href={`/stores/${storeSlug}/register`}
                  style={{
                    color: "var(--color-primary)",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  Create one
                </a>
              </span>
            </CardFooter>
          </Card>
        </div>
      </div>
    </StorefrontShell>
  );
}

export default function CustomerLoginPage({ params }: PageProps) {
  const { storeSlug } = use(params);

  return (
    <Suspense
      fallback={
        <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-16) 0" }}>
          <Spinner size="lg" label="Loading..." />
        </div>
      }
    >
      <CustomerLoginForm storeSlug={storeSlug} />
    </Suspense>
  );
}
