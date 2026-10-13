"use client";

import React, { useState } from "react";
import {
  Alert,
  Badge,
  Button,
  ConfirmationDialog,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@shopify-clone/ui";
import { ApiClientError, apiClient } from "../../../lib/api-client";
import {
  canDemoteOrRemoveMember,
  canUserManageMembers,
  countActiveOwners,
  STORE_ROLES_INFO,
  type StoreMemberItem,
} from "../../../lib/merchant-store-helpers";

export interface MembersTableProps {
  storeId: string;
  members: StoreMemberItem[];
  currentUserRole?: "owner" | "admin" | "staff";
  currentUserId?: string;
  onMemberUpdated: (updated: StoreMemberItem) => void;
  onMemberRemoved: (removedId: string) => void;
}

export function MembersTable({
  storeId,
  members,
  currentUserRole = "owner",
  currentUserId,
  onMemberUpdated,
  onMemberRemoved,
}: MembersTableProps) {
  const [memberToRemove, setMemberToRemove] = useState<StoreMemberItem | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const activeOwnersCount = countActiveOwners(members);
  const canManage = canUserManageMembers(currentUserRole);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <Badge variant="success" size="sm">Active</Badge>;
      case "INVITED":
        return <Badge variant="info" size="sm">Invited</Badge>;
      case "SUSPENDED":
        return <Badge variant="warning" size="sm">Suspended</Badge>;
      case "REMOVED":
        return <Badge variant="danger" size="sm">Removed</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{status}</Badge>;
    }
  };

  const getRoleBadge = (role: string) => {
    const info = STORE_ROLES_INFO.find((r) => r.value === role);
    return (
      <Badge variant={info?.badgeVariant || "neutral"} size="sm">
        {info?.label.toUpperCase() || role.toUpperCase()}
      </Badge>
    );
  };

  const handleRoleChange = async (member: StoreMemberItem, newRole: "owner" | "admin" | "staff") => {
    if (member.role === newRole) return;

    setActionError(null);
    setActionSuccess(null);

    // Client-side guard for last active owner protection
    if (member.role === "owner" && newRole !== "owner") {
      const check = canDemoteOrRemoveMember(currentUserRole, member, activeOwnersCount, "demote");
      if (!check.allowed) {
        setActionError(check.reason || "Cannot demote the last remaining active owner");
        return;
      }
    }

    setUpdatingMemberId(member.id);
    try {
      const updated = await apiClient.patch<StoreMemberItem>(
        `/api/v1/stores/${storeId}/members/${member.id}`,
        { role: newRole },
      );

      setActionSuccess(`Role for user '${member.userId}' changed to ${newRole}.`);
      onMemberUpdated(updated);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setActionError(err.message || "Failed to update member role.");
      } else {
        setActionError(
          err instanceof Error ? err.message : "An unexpected error occurred while updating role.",
        );
      }
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const handleConfirmRemove = async () => {
    if (!memberToRemove || isRemoving) return;

    setActionError(null);
    setActionSuccess(null);
    setIsRemoving(true);

    try {
      await apiClient.delete(`/api/v1/stores/${storeId}/members/${memberToRemove.id}`);
      setActionSuccess(`Member '${memberToRemove.userId}' has been removed from this store.`);
      const removedId = memberToRemove.id;
      setMemberToRemove(null);
      onMemberRemoved(removedId);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setActionError(err.message || "Failed to remove member.");
      } else {
        setActionError(
          err instanceof Error ? err.message : "An unexpected error occurred while removing member.",
        );
      }
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        {actionSuccess && (
          <Alert variant="success" title="Success">
            {actionSuccess}
          </Alert>
        )}

        {actionError && (
          <Alert variant="danger" title="Operation Failed">
            {actionError}
          </Alert>
        )}

        <Table fullWidth>
          <TableHeader>
            <TableRow>
              <TableHead>User / Member ID</TableHead>
              <TableHead>Assigned Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Member Since</TableHead>
              {canManage && <TableHead align="right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => {
              const isCurrentUser = Boolean(currentUserId && member.userId === currentUserId);
              const removeCheck = canDemoteOrRemoveMember(
                currentUserRole,
                member,
                activeOwnersCount,
                "remove",
              );
              const isUpdatingThis = updatingMemberId === member.id;

              return (
                <TableRow key={member.id}>
                  {/* User Identifier */}
                  <TableCell>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                      <div
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "50%",
                          backgroundColor: "var(--color-bg)",
                          border: "1px solid var(--color-border)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "var(--font-size-xs)",
                          fontWeight: 600,
                        }}
                      >
                        {member.userId.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "var(--font-size-xs)",
                            fontWeight: 600,
                            color: "var(--color-text-primary)",
                          }}
                        >
                          {member.userId}
                        </div>
                        {isCurrentUser && (
                          <div style={{ fontSize: "11px", color: "var(--color-primary)", fontWeight: 500 }}>
                            (You / Current Session)
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  {/* Role Selector or Badge */}
                  <TableCell>
                    {canManage && member.status === "ACTIVE" ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                        <Select
                          value={member.role}
                          onChange={(e) =>
                            handleRoleChange(member, e.target.value as "owner" | "admin" | "staff")
                          }
                          disabled={
                            isUpdatingThis ||
                            (member.role === "owner" && currentUserRole !== "owner")
                          }
                          style={{ minWidth: "110px", padding: "4px 8px", fontSize: "var(--font-size-xs)" }}
                          aria-label={`Change role for user ${member.userId}`}
                        >
                          <option value="owner">Owner</option>
                          <option value="admin">Admin</option>
                          <option value="staff">Staff</option>
                        </Select>
                        {isUpdatingThis && (
                          <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
                            Saving...
                          </span>
                        )}
                      </div>
                    ) : (
                      getRoleBadge(member.role)
                    )}
                  </TableCell>

                  {/* Membership Status */}
                  <TableCell>{getStatusBadge(member.status)}</TableCell>

                  {/* Date Joined */}
                  <TableCell>
                    <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
                      {new Date(member.createdAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </TableCell>

                  {/* Action Buttons */}
                  {canManage && (
                    <TableCell align="right">
                      {member.status !== "REMOVED" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!removeCheck.allowed || isRemoving}
                          title={removeCheck.reason}
                          onClick={() => setMemberToRemove(member)}
                          style={{
                            color: removeCheck.allowed
                              ? "var(--color-danger, #dc2626)"
                              : "var(--color-text-muted)",
                          }}
                        >
                          Remove
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Confirmation Dialog for Removal */}
      {memberToRemove && (
        <ConfirmationDialog
          isOpen={Boolean(memberToRemove)}
          onClose={() => {
            if (!isRemoving) setMemberToRemove(null);
          }}
          onConfirm={handleConfirmRemove}
          title="Remove Store Team Member"
          description={`Are you sure you want to remove user '${memberToRemove.userId}' from this store? They will immediately lose access to merchant administration.`}
          confirmLabel="Remove Member"
          cancelLabel="Cancel"
          isDestructive={true}
          isLoading={isRemoving}
        />
      )}
    </>
  );
}
