"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
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
} from "@calcart/ui";
import { MerchantShell } from "../../../src/components/merchant/MerchantShell";
import { AddMemberDialog } from "../../../src/components/merchant/team/add-member-dialog";
import { MembersTable } from "../../../src/components/merchant/team/members-table";
import { useAuth } from "../../../src/context/auth-context";
import { useStore } from "../../../src/context/store-context";
import { ApiClientError, apiClient } from "../../../src/lib/api-client";
import {
  canUserManageMembers,
  type StoreMemberItem,
} from "../../../src/lib/merchant-store-helpers";
import { Plus, RefreshCw } from "lucide-react";

export default function MerchantTeamPage() {
  const { user, logout } = useAuth();
  const {
    activeStore,
    stores,
    selectStore,
    isLoading: isStoreLoading,
  } = useStore();

  const [members, setMembers] = useState<StoreMemberItem[]>([]);
  const [invitations, setInvitations] = useState<Array<{
    id: string;
    email: string;
    role: "owner" | "admin" | "staff";
    status: string;
    expiresAt: string;
    createdAt: string;
  }>>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const userRole = activeStore?.role || "owner";
  const canManage = canUserManageMembers(userRole);

  const loadInvitations = useCallback(async (storeId: string) => {
    try {
      const response = await apiClient.get<{
        items: Array<{
          id: string;
          email: string;
          role: "owner" | "admin" | "staff";
          status: string;
          expiresAt: string;
          createdAt: string;
        }>;
      }>(`/api/v1/stores/${storeId}/invitations`);
      setInvitations(response.items || []);
    } catch {
      // Gracefully ignore invitation listing failure for non-admins
      setInvitations([]);
    }
  }, []);

  const loadMembers = useCallback(async (storeId: string) => {
    setIsLoadingMembers(true);
    setFetchError(null);
    try {
      const response = await apiClient.get<{ items: StoreMemberItem[] }>(
        `/api/v1/stores/${storeId}/members`,
      );
      setMembers(response.items || []);
      await loadInvitations(storeId);
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
  }, [loadInvitations]);

  useEffect(() => {
    if (activeStore?.id) {
      loadMembers(activeStore.id);
    } else {
      setMembers([]);
      setInvitations([]);
      setFetchError(null);
    }
  }, [activeStore?.id, loadMembers]);

  const handleRevokeInvitation = async (invitationId: string) => {
    if (!activeStore) return;
    try {
      await apiClient.delete(`/api/v1/stores/${activeStore.id}/invitations/${invitationId}`);
      await loadInvitations(activeStore.id);
    } catch {
      // Ignore
    }
  };

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
      <div className="space-y-6">
        {/* Loading store or members state */}
        {(isStoreLoading || (activeStore && isLoadingMembers && members.length === 0)) && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Spinner size="lg" label="Loading store members..." />
            <span className="text-xs text-muted-foreground font-medium">
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
              <Link href="/merchant/stores/new" className="btn btn-primary">
                Create New Store
              </Link>
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
                  className="gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry</span>
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
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-semibold">Store Team Members</CardTitle>
                    <Badge variant="neutral" size="sm">
                      {members.length} {members.length === 1 ? "Member" : "Members"}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs mt-0.5">
                    Manage staff access, role assignments, and member permissions for{" "}
                    <strong className="text-foreground">{activeStore.name}</strong>.
                  </CardDescription>
                </div>

                <div className="flex gap-2 items-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadMembers(activeStore.id)}
                    disabled={isLoadingMembers}
                    className="h-8 gap-1.5 text-xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Refresh</span>
                  </Button>
                  {canManage && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setIsAddDialogOpen(true)}
                      className="h-8 gap-1.5 text-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add Team Member</span>
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-4 space-y-6">
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

              {/* Pending Invitations Section */}
              {invitations.length > 0 && (
                <div className="pt-4 border-t border-border/50">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Store Invitations ({invitations.filter((i) => i.status === "PENDING").length} Pending)
                  </h4>
                  <div className="rounded-lg border border-border bg-card overflow-x-auto">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="bg-muted/30 border-b border-border">
                          <th className="py-2.5 px-4 font-semibold text-xs text-muted-foreground">Invited Email</th>
                          <th className="py-2.5 px-4 font-semibold text-xs text-muted-foreground">Role</th>
                          <th className="py-2.5 px-4 font-semibold text-xs text-muted-foreground">Status</th>
                          <th className="py-2.5 px-4 font-semibold text-xs text-muted-foreground">Expires</th>
                          {canManage && <th className="py-2.5 px-4 font-semibold text-xs text-muted-foreground text-right">Actions</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {invitations.map((inv) => (
                          <tr key={inv.id} className="hover:bg-muted/40 transition-colors">
                            <td className="py-2.5 px-4 text-xs font-medium text-foreground">{inv.email}</td>
                            <td className="py-2.5 px-4">
                              <Badge variant="neutral" size="sm">{inv.role.toUpperCase()}</Badge>
                            </td>
                            <td className="py-2.5 px-4">
                              <Badge variant={inv.status === "PENDING" ? "info" : "neutral"} size="sm">
                                {inv.status}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-4 text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(inv.expiresAt).toLocaleDateString()}
                            </td>
                            {canManage && (
                              <td className="py-2.5 px-4 text-right">
                                {inv.status === "PENDING" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleRevokeInvitation(inv.id)}
                                    className="h-7 text-xs text-destructive hover:bg-destructive/10"
                                  >
                                    Revoke
                                  </Button>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
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
          onInvitationSent={() => loadInvitations(activeStore.id)}
        />
      )}
    </MerchantShell>
  );
}
