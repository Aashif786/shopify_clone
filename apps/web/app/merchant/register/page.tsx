"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  FormField,
  Input,
} from "@shopify-clone/ui";
import { ShieldCheck, Zap, Layers, Sparkles } from "lucide-react";
import { useAuth } from "../../../src/context/auth-context";
import { apiClient, ApiClientError } from "../../../src/lib/api-client";
import { ThemeModeToggle } from "../../../src/components/theme-mode-toggle";

const BENEFITS = [
  { icon: Zap, label: "Instant store provisioning" },
  { icon: ShieldCheck, label: "Multi-tenant role-based security" },
  { icon: Layers, label: "Full catalog & inventory management" },
  { icon: Sparkles, label: "Seamless Razorpay checkout integration" },
];

export default function MerchantRegisterPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password || isSubmitting) return;

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await apiClient.post("/api/v1/auth/register", {
        name: name.trim(),
        email: email.trim(),
        password,
      });

      await refreshUser();
      router.push("/merchant/onboarding");
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setError(err.message || "Failed to create account.");
      } else {
        setError(err instanceof Error ? err.message : "Failed to register. Please try again.");
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
            Scale your commerce<br />from day one.
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
            Join modern merchants building high-conversion storefronts with complete operational control.
          </p>

          <ul className="mt-8 space-y-3">
            {BENEFITS.map(({ icon: Icon, label }) => (
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

        <div className="w-full max-w-[440px]">
          {/* Mobile brand mark */}
          <div className="flex items-center gap-2 mb-8 md:hidden">
            <span className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-xs font-black shadow-sm">
              CC
            </span>
            <span className="text-sm font-bold text-foreground tracking-tight">Cal Cart</span>
          </div>

          <div className="mb-8">
            <h1 className="text-xl font-bold tracking-tight text-foreground mb-1">
              Create your merchant account
            </h1>
            <p className="text-xs text-muted-foreground">
              Set up your credentials to configure and manage your store.
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {error && (
              <Alert variant="danger" title="Registration Error">
                {error}
              </Alert>
            )}

            <FormField label="Full Name" htmlFor="merchant-name" required>
              <Input
                id="merchant-name"
                type="text"
                name="name"
                autoComplete="name"
                placeholder="Jane Merchant"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
                autoFocus
                required
                className="h-9 text-sm"
              />
            </FormField>

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
                required
                className="h-9 text-sm"
              />
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Password"
                htmlFor="merchant-password"
                required
                helperText="At least 8 characters"
              >
                <Input
                  id="merchant-password"
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                  required
                  className="h-9 text-sm font-mono"
                />
              </FormField>

              <FormField
                label="Confirm Password"
                htmlFor="merchant-confirm-password"
                required
              >
                <Input
                  id="merchant-confirm-password"
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
            </div>

            <Button
              type="submit"
              variant="primary"
              loading={isSubmitting}
              disabled={
                isSubmitting ||
                !name.trim() ||
                !email.trim() ||
                !password ||
                password !== confirmPassword
              }
              className="w-full h-9 text-xs font-medium mt-2"
            >
              Create Account
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-6">
            Already have an account?{" "}
            <Link
              href="/merchant/login"
              className="text-primary font-medium hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
