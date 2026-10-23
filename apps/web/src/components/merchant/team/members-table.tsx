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
      <div className="space-y-4">
        {actionSuccess && (
          <Alert variant="success" title="Success" onDismiss={() => setActionSuccess(null)}>
            {actionSuccess}
          </Alert>
        )}

        {actionError && (
          <Alert variant="danger" title="Operation Failed" onDismiss={() => setActionError(null)}>
            {actionError}
          </Alert>
        )}

        <div className="rounded-lg border border-border bg-card overflow-x-auto">
          <Table fullWidth>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-border bg-muted/30">
                <TableHead className="font-semibold text-xs text-muted-foreground py-3 px-4">User / Member ID</TableHead>
                <TableHead className="font-semibold text-xs text-muted-foreground py-3 px-4">Assigned Role</TableHead>
                <TableHead className="font-semibold text-xs text-muted-foreground py-3 px-4">Status</TableHead>
                <TableHead className="font-semibold text-xs text-muted-foreground py-3 px-4">Member Since</TableHead>
                {canManage && <TableHead align="right" className="font-semibold text-xs text-muted-foreground py-3 px-4">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border">
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
                  <TableRow key={member.id} className="hover:bg-muted/40 transition-colors">
                    {/* User Identifier */}
                    <TableCell className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-muted border border-border/60 flex items-center justify-center text-xs font-bold text-foreground">
                          {member.userId.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-mono text-xs font-semibold text-foreground">
                            {member.userId}
                          </div>
                          {isCurrentUser && (
                            <div className="text-[11px] text-primary font-medium">
                              (You / Current Session)
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Role Selector or Badge */}
                    <TableCell className="py-3 px-4">
                      {canManage && member.status === "ACTIVE" ? (
                        <div className="flex items-center gap-2">
                          <Select
                            value={member.role}
                            onChange={(e) =>
                              handleRoleChange(member, e.target.value as "owner" | "admin" | "staff")
                            }
                            disabled={
                              isUpdatingThis ||
                              (member.role === "owner" && currentUserRole !== "owner")
                            }
                            className="h-8 text-xs min-w-[110px]"
                            aria-label={`Change role for user ${member.userId}`}
                          >
                            <option value="owner">Owner</option>
                            <option value="admin">Admin</option>
                            <option value="staff">Staff</option>
                          </Select>
                          {isUpdatingThis && (
                            <span className="text-[11px] text-muted-foreground">
                              Saving...
                            </span>
                          )}
                        </div>
                      ) : (
                        getRoleBadge(member.role)
                      )}
                    </TableCell>

                    {/* Membership Status */}
                    <TableCell className="py-3 px-4">{getStatusBadge(member.status)}</TableCell>

                    {/* Date Joined */}
                    <TableCell className="py-3 px-4">
                      <span className="text-xs text-muted-foreground">
                        {new Date(member.createdAt).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </TableCell>

                    {/* Action Buttons */}
                    {canManage && (
                      <TableCell align="right" className="py-3 px-4">
                        {member.status !== "REMOVED" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={!removeCheck.allowed || isRemoving}
                            title={removeCheck.reason}
                            onClick={() => setMemberToRemove(member)}
                            className="h-8 px-2.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 disabled:opacity-40"
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
