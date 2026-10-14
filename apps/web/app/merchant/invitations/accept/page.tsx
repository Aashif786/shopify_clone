"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Alert,
  Badge,
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
import { useAuth } from "../../../../src/context/auth-context";
import { useStore } from "../../../../src/context/store-context";
import { apiClient, ApiClientError } from "../../../../src/lib/api-client";
import { ThemeModeToggle } from "../../../../src/components/theme-mode-toggle";

interface InvitationData {
  id: string;
  storeId: string;
  storeName: string;
  storeSlug: string;
  email: string;
  role: "owner" | "admin" | "staff";
  status: string;
  expiresAt: string;
  isExpired: boolean;
}

function InvitationAcceptForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get("token") || "";

  const { user, refreshUser } = useAuth();
  const { refreshStores } = useStore();

  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Form fields for new account creation
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setFetchError("No invitation token was provided in the URL.");
      setIsLoading(false);
      return;
    }

    async function loadInvitation() {
      try {
        const res = await apiClient.get<{ invitation: InvitationData }>(
          `/api/v1/invitations/${encodeURIComponent(token)}`
        );
        setInvitation(res.invitation);
      } catch (err: unknown) {
        if (err instanceof ApiClientError) {
          setFetchError(err.message || "Invalid or expired invitation.");
        } else {
          setFetchError("Unable to verify invitation. Please contact your store administrator.");
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadInvitation();
  }, [token]);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || isSubmitting) return;

    if (!user) {
      if (!name.trim()) {
        setActionError("Please enter your name.");
        return;
      }
      if (!password || password.length < 8) {
        setActionError("Password must be at least 8 characters long.");
        return;
      }
      if (password !== confirmPassword) {
        setActionError("Passwords do not match.");
        return;
      }
    }

    setActionError(null);
    setIsSubmitting(true);

    try {
      const payload = user ? {} : { name: name.trim(), password };
      const res = await apiClient.post<{ storeId: string }>(
        `/api/v1/invitations/${encodeURIComponent(token)}`,
        payload
      );

      await refreshUser();
      await refreshStores(res.storeId);
      router.push("/merchant");
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setActionError(err.message || "Failed to accept store invitation.");
      } else {
        setActionError("An unexpected error occurred while processing invitation.");
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

      <div style={{ width: "100%", maxWidth: "480px" }}>
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
            Store Team Invitation
          </h1>
          <p
            style={{
              color: "var(--color-text-secondary)",
              fontSize: "var(--font-size-sm)",
              marginTop: "var(--space-1)",
            }}
          >
            Join your store team and start managing operations
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Team Membership Invitation</CardTitle>
            <CardDescription>
              You have been invited to collaborate on a merchant store.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-8) 0" }}>
                <Spinner size="md" label="Verifying invitation details..." />
              </div>
            ) : fetchError ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                <Alert variant="danger" title="Invalid Invitation">
                  {fetchError}
                </Alert>
                <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-secondary)", margin: 0 }}>
                  This invitation may have expired, been revoked, or already accepted. Contact the store owner to request a new invitation.
                </p>
              </div>
            ) : invitation ? (
              <form onSubmit={handleAccept} noValidate>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                  {actionError && (
                    <Alert variant="danger" title="Error">
                      {actionError}
                    </Alert>
                  )}

                  {/* Store & Role Summary Box */}
                  <div
                    style={{
                      padding: "var(--space-4)",
                      backgroundColor: "var(--color-bg)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--color-border)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "var(--space-2)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-secondary)" }}>
                        Invited Store:
                      </span>
                      <strong style={{ color: "var(--color-text-primary)" }}>
                        {invitation.storeName}
                      </strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-secondary)" }}>
                        Assigned Role:
                      </span>
                      <Badge variant="info">
                        {invitation.role.toUpperCase()}
                      </Badge>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-secondary)" }}>
                        Recipient Email:
                      </span>
                      <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-primary)" }}>
                        {invitation.email}
                      </span>
                    </div>
                  </div>

                  {/* Authenticated user mode */}
                  {user ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                      <Alert variant="info" title="Logged In">
                        You are currently signed in as <strong>{user.name}</strong> ({user.email}). Accepting will link this store to your existing account.
                      </Alert>

                      <Button
                        type="submit"
                        variant="primary"
                        loading={isSubmitting}
                        disabled={isSubmitting}
                        style={{ width: "100%", marginTop: "var(--space-2)" }}
                      >
                        Accept Invitation & Enter Store →
                      </Button>
                    </div>
                  ) : (
                    /* New user registration mode */
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                      <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-secondary)" }}>
                        Create a password to set up your staff account:
                      </div>

                      <FormField label="Full Name" htmlFor="staff-name" required>
                        <Input
                          id="staff-name"
                          placeholder="Your full name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          disabled={isSubmitting}
                          autoFocus
                          required
                        />
                      </FormField>

                      <FormField
                        label="Password"
                        htmlFor="staff-password"
                        required
                        helperText="Minimum 8 characters."
                      >
                        <Input
                          id="staff-password"
                          type="password"
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          disabled={isSubmitting}
                          required
                        />
                      </FormField>

                      <FormField label="Confirm Password" htmlFor="staff-confirm-password" required>
                        <Input
                          id="staff-confirm-password"
                          type="password"
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
                        disabled={isSubmitting || !name.trim() || !password || password !== confirmPassword}
                        style={{ width: "100%", marginTop: "var(--space-2)" }}
                      >
                        Create Account & Join Store
                      </Button>
                    </div>
                  )}
                </div>
              </form>
            ) : null}
          </CardContent>
          <CardFooter
            style={{
              borderTop: "1px solid var(--color-border)",
              justifyContent: "center",
              padding: "var(--space-4)",
            }}
          >
            <a
              href={
                token
                  ? `/merchant/login?redirect=${encodeURIComponent(`/merchant/invitations/accept?token=${token}`)}`
                  : "/merchant/login"
              }
              style={{
                fontSize: "var(--font-size-sm)",
                color: "var(--color-text-secondary)",
                textDecoration: "none",
              }}
            >
              Sign in with an existing account →
            </a>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

export default function InvitationAcceptPage() {
  return (
    <Suspense
      fallback={
        <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-16) 0" }}>
          <Spinner size="lg" label="Loading invitation..." />
        </div>
      }
    >
      <InvitationAcceptForm />
    </Suspense>
  );
}
