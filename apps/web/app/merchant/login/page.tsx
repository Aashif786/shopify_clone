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
import { useAuth } from "../../../src/context/auth-context";
import { apiClient, ApiClientError } from "../../../src/lib/api-client";
import { ThemeModeToggle } from "../../../src/components/theme-mode-toggle";

function getSafeRedirectUrl(url: string | null | undefined, fallback = "/merchant"): string {
  if (!url) return fallback;
  if (url.startsWith("/") && !url.startsWith("//") && !url.startsWith("/\\")) {
    return url;
  }
  return fallback;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = getSafeRedirectUrl(searchParams?.get("redirect"), "/merchant");

  const { refreshUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    try {
      await apiClient.post("/api/v1/auth/login", {
        email: email.trim(),
        password,
      });

      await refreshUser();

      // Check if user has stores or needs onboarding
      const storesRes = await apiClient.get<{ items: Array<{ id: string }> }>("/api/v1/stores");
      if (!storesRes.items || storesRes.items.length === 0) {
        router.push("/merchant/onboarding");
      } else {
        router.push(redirectUrl);
      }
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setError(err.message || "Invalid email or password.");
      } else {
        setError(err instanceof Error ? err.message : "Failed to sign in. Please try again.");
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
        {/* Brand header */}
        <div style={{ textAlign: "center", marginBottom: "var(--space-6)" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "48px",
              height: "48px",
              borderRadius: "var(--radius-lg)",
              background: "linear-gradient(135deg, var(--color-primary), #6366f1)",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: "22px",
              marginBottom: "var(--space-3)",
              boxShadow: "0 4px 12px rgba(99, 102, 241, 0.25)",
            }}
          >
            S
          </div>
          <h1
            style={{
              fontSize: "var(--font-size-2xl)",
              fontWeight: 700,
              color: "var(--color-text-primary)",
              letterSpacing: "-0.02em",
              margin: 0,
            }}
          >
            Shopify Clone
          </h1>
          <p
            style={{
              color: "var(--color-text-secondary)",
              fontSize: "var(--font-size-sm)",
              marginTop: "var(--space-1)",
            }}
          >
            Merchant & Administration Portal
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign in to your merchant account</CardTitle>
            <CardDescription>
              Enter your verified email and password to manage your stores.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} noValidate>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                {error && (
                  <Alert variant="danger" title="Authentication Error">
                    {error}
                  </Alert>
                )}

                <FormField label="Email Address" htmlFor="merchant-email" required>
                  <Input
                    id="merchant-email"
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

                <FormField
                  label="Password"
                  htmlFor="merchant-password"
                  required
                >
                  <Input
                    id="merchant-password"
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
                      href="/merchant/forgot-password"
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
              Don&apos;t have a merchant account?{" "}
              <a
                href="/merchant/register"
                style={{
                  color: "var(--color-primary)",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Sign up
              </a>
            </span>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

export default function MerchantLoginPage() {
  return (
    <Suspense
      fallback={
        <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-16) 0" }}>
          <Spinner size="lg" label="Loading..." />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
