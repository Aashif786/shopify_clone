"use client";

import React, { useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FormField,
  Input,
} from "@shopify-clone/ui";
import { MerchantShell } from "../../../src/components/merchant/MerchantShell";
import { useAuth } from "../../../src/context/auth-context";
import { useStore } from "../../../src/context/store-context";
import { apiClient, ApiClientError } from "../../../src/lib/api-client";

export default function MerchantAccountPage() {
  const { user, refreshUser, logout } = useAuth();
  const { activeStore, stores, selectStore } = useStore();

  // Profile Form state
  const [name, setName] = useState(user?.name || "");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Password Form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isUpdatingProfile) return;

    setProfileError(null);
    setProfileSuccess(false);
    setIsUpdatingProfile(true);

    try {
      await apiClient.patch("/api/v1/auth/me", { name: name.trim() });
      await refreshUser();
      setProfileSuccess(true);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setProfileError(err.message || "Failed to update profile name.");
      } else {
        setProfileError("An unexpected error occurred.");
      }
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || isChangingPassword) return;

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    setPasswordError(null);
    setPasswordSuccess(false);
    setIsChangingPassword(true);

    try {
      await apiClient.post("/api/v1/auth/change-password", {
        currentPassword,
        newPassword,
      });

      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setPasswordError(err.message || "Failed to change password. Please verify current password.");
      } else {
        setPasswordError("An unexpected error occurred while updating password.");
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <MerchantShell
      activePath="/merchant/account"
      currentStore={activeStore}
      stores={stores}
      onSelectStore={selectStore}
      userName={user?.name || "Merchant"}
      userEmail={user?.email}
      onLogout={logout}
      title="Account & Security Settings"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", maxWidth: "800px" }}>
        {/* User Identity Overview */}
        <Card>
          <CardHeader>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <CardTitle>Merchant Identity</CardTitle>
                <CardDescription>
                  Your authenticated platform credentials and tenant membership scope
                </CardDescription>
              </div>
              <Badge variant="success">{user?.status || "ACTIVE"}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "var(--space-4)",
                padding: "var(--space-4)",
                backgroundColor: "var(--color-bg)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border)",
              }}
            >
              <div>
                <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-secondary)" }}>
                  Email Address
                </div>
                <div style={{ fontWeight: 600, color: "var(--color-text-primary)", marginTop: "var(--space-1)" }}>
                  {user?.email || "—"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-secondary)" }}>
                  Display Name
                </div>
                <div style={{ fontWeight: 600, color: "var(--color-text-primary)", marginTop: "var(--space-1)" }}>
                  {user?.name || "—"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-secondary)" }}>
                  Authorized Stores
                </div>
                <div style={{ fontWeight: 600, color: "var(--color-text-primary)", marginTop: "var(--space-1)" }}>
                  {stores.length} {stores.length === 1 ? "Store" : "Stores"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile Details Form */}
        <Card>
          <CardHeader>
            <CardTitle>Profile Details</CardTitle>
            <CardDescription>
              Update your primary display name shown across all store consoles
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateProfile} noValidate>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                {profileSuccess && (
                  <Alert variant="success" title="Profile Saved">
                    Your display name has been updated successfully.
                  </Alert>
                )}
                {profileError && (
                  <Alert variant="danger" title="Error">
                    {profileError}
                  </Alert>
                )}

                <FormField label="Full Name" htmlFor="profile-name" required>
                  <Input
                    id="profile-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isUpdatingProfile}
                    required
                  />
                </FormField>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <Button
                    type="submit"
                    variant="primary"
                    loading={isUpdatingProfile}
                    disabled={isUpdatingProfile || !name.trim()}
                  >
                    Save Changes
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Change Password Form */}
        <Card>
          <CardHeader>
            <CardTitle>Security & Password</CardTitle>
            <CardDescription>
              Change your password. Upon completion, active sessions on all other devices will be revoked.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} noValidate>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                {passwordSuccess && (
                  <Alert variant="success" title="Password Updated">
                    Your password has been changed. Other device sessions were automatically terminated.
                  </Alert>
                )}
                {passwordError && (
                  <Alert variant="danger" title="Security Error">
                    {passwordError}
                  </Alert>
                )}

                <FormField label="Current Password" htmlFor="current-password" required>
                  <Input
                    id="current-password"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    disabled={isChangingPassword}
                    required
                  />
                </FormField>

                <FormField
                  label="New Password"
                  htmlFor="new-password"
                  required
                  helperText="Must be at least 8 characters long."
                >
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={isChangingPassword}
                    required
                  />
                </FormField>

                <FormField label="Confirm New Password" htmlFor="confirm-new-password" required>
                  <Input
                    id="confirm-new-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isChangingPassword}
                    required
                  />
                </FormField>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <Button
                    type="submit"
                    variant="primary"
                    loading={isChangingPassword}
                    disabled={
                      isChangingPassword ||
                      !currentPassword ||
                      !newPassword ||
                      newPassword !== confirmPassword
                    }
                  >
                    Update Password
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </MerchantShell>
  );
}
