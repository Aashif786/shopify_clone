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
import { ShoppingBag, Package, BarChart3, Users } from "lucide-react";
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

const FEATURE_BULLETS = [
  { icon: ShoppingBag, label: "Manage orders and fulfillments" },
  { icon: Package, label: "Track inventory across stores" },
  { icon: BarChart3, label: "Real-time analytics and insights" },
  { icon: Users, label: "Multi-tenant team management" },
];

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
      let storesRes: { items?: Array<{ id: string }> } = { items: [{ id: "fallback" }] };
      try {
        storesRes = await apiClient.get<{ items: Array<{ id: string }> }>("/api/v1/stores");
      } catch {
        // Fallback to allowing navigation to destination
      }
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
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background">
      {/* Left brand panel */}
      <div className="hidden md:flex md:w-[45%] flex-col justify-between bg-[var(--color-bg-surface)] border-r border-border/60 p-10 relative overflow-hidden">
        {/* Subtle grid pattern overlay */}
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
            Your merchant<br />command center.
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
            One platform to run your storefront, manage your team, and grow your commerce operations.
          </p>

          <ul className="mt-8 space-y-3">
            {FEATURE_BULLETS.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Icon size={14} aria-hidden="true" />
                </span>
                {label}
              </li>
            ))}
          </ul>
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
            <h1 className="text-xl font-bold tracking-tight text-foreground mb-1">
              Sign in to your account
            </h1>
            <p className="text-xs text-muted-foreground">
              Enter your credentials to access the merchant console.
            </p>
          </div>

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

            <FormField label="Password" htmlFor="merchant-password" required>
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

          <p className="text-xs text-muted-foreground text-center mt-6">
            Don&apos;t have a merchant account?{" "}
            <Link href="/merchant/register" className="text-primary font-medium hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function MerchantLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center min-h-[100dvh]">
          <Spinner size="lg" label="Loading..." />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
