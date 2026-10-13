"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Spinner,
} from "@shopify-clone/ui";
import { MerchantShell } from "../../../src/components/merchant/MerchantShell";
import { AddMemberDialog } from "../../../src/components/merchant/team/add-member-dialog";
import { MembersTable } from "../../../src/components/merchant/team/members-table";
import { useAuth } from "../../../src/context/auth-context";
import { useStore } from "../../../src/context/store-context";
import { ApiClientError, apiClient } from "../../../src/lib/api-client";
import {
  canUserManageMembers,
  STORE_ROLES_INFO,
  type StoreMemberItem,
} from "../../../src/lib/merchant-store-helpers";

export default function MerchantTeamPage() {
  const { user, logout } = useAuth();
  const {
    activeStore,
    stores,
    selectStore,
    isLoading: isStoreLoading,
  } = useStore();

  const [members, setMembers] = useState<StoreMemberItem[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const userRole = activeStore?.role || "owner";
  const canManage = canUserManageMembers(userRole);

  const loadMembers = useCallback(async (storeId: string) => {
    setIsLoadingMembers(true);
    setFetchError(null);
    try {
      const response = await apiClient.get<{ items: StoreMemberItem[] }>(
        `/api/v1/stores/${storeId}/members`,
      );
      setMembers(response.items || []);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.isForbidden || err.isNotFound) {
          setFetchError(
            "Access restricted: Viewing and managing team members requires Admin or Owner permissions.",
          );
        } else {
          setFetchError(err.message || "Failed to load store team members.");
        }
      } else {
        setFetchError(
          err instanceof Error
            ? err.message
            : "An unexpected error occurred while loading team members.",
        );
      }
      setMembers([]);
    } finally {
      setIsLoadingMembers(false);
    }
  }, []);

  useEffect(() => {
    if (activeStore?.id) {
      loadMembers(activeStore.id);
    } else {
      setMembers([]);
      setFetchError(null);
    }
  }, [activeStore?.id, loadMembers]);

  const handleMemberAdded = (newMember: StoreMemberItem) => {
    setMembers((prev) => {
      const existingIndex = prev.findIndex((m) => m.id === newMember.id);
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = newMember;
        return next;
      }
      return [...prev, newMember];
    });
    setIsAddDialogOpen(false);
  };

  const handleMemberUpdated = (updated: StoreMemberItem) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === updated.id ? updated : m)),
    );
  };

  const handleMemberRemoved = (removedId: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== removedId));
  };

  return (
    <MerchantShell
      activePath="/merchant/team"
      currentStore={activeStore}
      stores={stores}
      onSelectStore={selectStore}
      userName={user?.name || "Merchant"}
      userEmail={user?.email}
      userRole={userRole}
      onLogout={logout}
      title="Team & Access Control"
      subtitle="Role-based membership management, staff authorization, and tenant isolation"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        {/* Loading store or members state */}
        {(isStoreLoading || (activeStore && isLoadingMembers && members.length === 0)) && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              minHeight: "240px",
              flexDirection: "column",
              gap: "var(--space-3)",
            }}
          >
            <Spinner size="lg" label="Loading store members..." />
            <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>
              Loading team memberships...
            </span>
          </div>
        )}

        {/* Empty state: No active store */}
        {!isStoreLoading && !activeStore && (
          <EmptyState
            title="No Store Selected"
            description="Please select an active store or create a new store to manage team memberships."
            action={
              <a href="/merchant/stores/new" className="btn btn-primary">
                Create New Store
              </a>
            }
          />
        )}

        {/* Authorization or Fetch Error */}
        {!isLoadingMembers && fetchError && activeStore && (
          <Alert
            variant="warning"
            title="Membership Access Notice"
            action={
              canManage ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadMembers(activeStore.id)}
                >
                  Retry
                </Button>
              ) : undefined
            }
          >
            {fetchError}
          </Alert>
        )}

        {/* Main Team Management Content */}
        {activeStore && !fetchError && (
          <Card>
            <CardHeader>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "var(--space-3)",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                    <CardTitle>Store Team Members</CardTitle>
                    <Badge variant="neutral" size="sm">
                      {members.length} {members.length === 1 ? "Member" : "Members"}
                    </Badge>
                  </div>
                  <CardDescription>
                    Manage staff access, role assignments, and member permissions for{" "}
                    <strong>{activeStore.name}</strong>.
                  </CardDescription>
                </div>

                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadMembers(activeStore.id)}
                    disabled={isLoadingMembers}
                  >
                    Refresh
                  </Button>
                  {canManage && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setIsAddDialogOpen(true)}
                    >
                      + Add Team Member
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
                {/* Staff Notice if user is staff */}
                {!canManage && (
                  <Alert variant="info" title="Read-Only Team View">
                    You have Staff access. Adding members, changing roles, and removing team
                    members require Admin or Owner permissions.
                  </Alert>
                )}

                {/* Members list table or empty state */}
                {members.length === 0 && !isLoadingMembers ? (
                  <EmptyState
                    title="No Team Members Found"
                    description="No additional members are currently assigned to this store."
                    action={
                      canManage ? (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => setIsAddDialogOpen(true)}
                        >
                          Add First Member
                        </Button>
                      ) : undefined
                    }
                  />
                ) : (
                  <MembersTable
                    storeId={activeStore.id}
                    members={members}
                    currentUserRole={userRole}
                    currentUserId={user?.id}
                    onMemberUpdated={handleMemberUpdated}
                    onMemberRemoved={handleMemberRemoved}
                  />
                )}

                {/* Role Hierarchy Reference */}
                <div style={{ marginTop: "var(--space-4)" }}>
                  <h4
                    style={{
                      fontSize: "var(--font-size-sm)",
                      fontWeight: 600,
                      color: "var(--color-text-secondary)",
                      margin: "0 0 var(--space-3) 0",
                    }}
                  >
                    Store Role Reference & Permissions
                  </h4>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: "var(--space-3)",
                    }}
                  >
                    {STORE_ROLES_INFO.map((r) => (
                      <div
                        key={r.value}
                        style={{
                          padding: "var(--space-3)",
                          borderRadius: "var(--radius-md)",
                          border: "1px solid var(--color-border)",
                          backgroundColor: "var(--color-bg)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "var(--space-2)",
                            marginBottom: "4px",
                          }}
                        >
                          <Badge variant={r.badgeVariant} size="sm">
                            {r.label.toUpperCase()}
                          </Badge>
                        </div>
                        <div
                          style={{
                            fontSize: "var(--font-size-xs)",
                            color: "var(--color-text-secondary)",
                            lineHeight: 1.4,
                          }}
                        >
                          {r.description}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tenant Isolation Guarantee */}
                <div
                  style={{
                    padding: "var(--space-3) var(--space-4)",
                    borderRadius: "var(--radius-md)",
                    backgroundColor: "var(--color-bg)",
                    border: "1px solid var(--color-border)",
                    fontSize: "var(--font-size-xs)",
                    color: "var(--color-text-muted)",
                    lineHeight: 1.5,
                  }}
                >
                  <strong style={{ color: "var(--color-text-primary)" }}>
                    Tenant Isolation &amp; Safety:
                  </strong>{" "}
                  All memberships are strictly scoped to store ID{" "}
                  <code style={{ fontSize: "inherit" }}>{activeStore.id}</code>.
                  Protected by PostgreSQL foreign keys and backend role enforcement.
                  Last active owner removal is strictly blocked.
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Member Dialog */}
      {activeStore && (
        <AddMemberDialog
          storeId={activeStore.id}
          isOpen={isAddDialogOpen}
          onClose={() => setIsAddDialogOpen(false)}
          onSuccess={handleMemberAdded}
        />
      )}
    </MerchantShell>
  );
}
