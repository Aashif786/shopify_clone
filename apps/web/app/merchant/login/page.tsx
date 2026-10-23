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
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-8 relative">
      <div className="absolute top-4 right-4">
        <ThemeModeToggle />
      </div>

      <div className="w-full max-w-[420px] space-y-6">
        {/* Brand header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-primary-foreground font-bold text-xl shadow-md shadow-primary/20">
            C
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Cal Cart
          </h1>
          <p className="text-xs text-muted-foreground">
            Merchant &amp; Administration Portal
          </p>
        </div>

        <Card className="border-border/70 bg-card shadow-sm">
          <CardHeader className="border-b border-border/50 pb-5">
            <CardTitle className="text-lg font-semibold tracking-tight text-foreground">
              Sign in to your merchant account
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-1">
              Enter your verified email and password to manage your stores.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
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
                  className="h-9 text-sm"
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
                  className="h-9 text-sm font-mono"
                />
                <div className="flex justify-end mt-1.5">
                  <Link
                    href="/merchant/forgot-password"
                    className="text-xs text-primary hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
              </FormField>

              <Button
                type="submit"
                variant="primary"
                loading={isSubmitting}
                disabled={isSubmitting || !email.trim() || !password}
                className="w-full h-9 text-xs font-medium"
              >
                Sign In
              </Button>
            </form>
          </CardContent>
          <CardFooter className="border-t border-border/50 bg-muted/20 py-4 px-6 justify-center">
            <span className="text-xs text-muted-foreground">
              Don&apos;t have a merchant account?{" "}
              <Link
                href="/merchant/register"
                className="text-primary font-medium hover:underline"
              >
                Sign up
              </Link>
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
        <div className="flex justify-center items-center min-h-screen">
          <Spinner size="lg" label="Loading..." />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
