"use client";

import React, { Suspense, use, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Spinner,
} from "@calcart/ui";
import { StorefrontShell } from "../../../../src/components/storefront/StorefrontShell";
import { apiClient, ApiClientError } from "../../../../src/lib/api-client";

interface PageProps {
  params: Promise<{ storeSlug: string }>;
}

function VerifyEmailForm({ storeSlug }: { storeSlug: string }) {
  const searchParams = useSearchParams();
  const token = searchParams?.get("token")?.trim() ?? "";
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || isSubmitting) {
      setError("This verification link is missing a token.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await apiClient.post(
        `/api/v1/storefront/${encodeURIComponent(storeSlug)}/auth/verify-email`,
        { token },
      );
      setVerified(true);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setError(err.message || "This verification link is invalid or has expired.");
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <StorefrontShell storeName="Verify email" storeSlug={storeSlug}>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          padding: "var(--space-12) var(--space-4)",
        }}
      >
        <Card style={{ width: "100%", maxWidth: "460px" }}>
          <CardHeader>
            <CardTitle>Verify your email</CardTitle>
            <CardDescription>
              Confirm this address before previous orders can be connected to your account.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent>
              {verified && (
                <Alert variant="success" title="Email verified">
                  You can now sign in. Orders placed with this address are available from your account.
                </Alert>
              )}
              {error && (
                <Alert variant="danger" title="Verification failed">
                  {error}
                </Alert>
              )}
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isSubmitting || verified || !token}>
                {isSubmitting ? "Verifying..." : "Verify email"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </StorefrontShell>
  );
}

export default function VerifyEmailPage({ params }: PageProps) {
  const { storeSlug } = use(params);
  return (
    <Suspense fallback={<Spinner />}>
      <VerifyEmailForm storeSlug={storeSlug} />
    </Suspense>
  );
}
