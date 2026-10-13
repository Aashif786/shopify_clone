import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  canDemoteOrRemoveMember,
  canUserManageMembers,
  countActiveOwners,
  validateAddMemberFormData,
  type AddMemberFormData,
  type StoreMemberItem,
} from "@/lib/merchant-store-helpers";
import { MembersTable } from "@/components/merchant/team/members-table";
import { AddMemberDialog } from "@/components/merchant/team/add-member-dialog";
import { ApiClient, ApiClientError } from "@/lib/api-client";

const mockOwnerMember: StoreMemberItem = {
  id: "mem_owner_1",
  storeId: "store_alpha",
  userId: "user_owner_001",
  role: "owner",
  status: "ACTIVE",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const mockAdminMember: StoreMemberItem = {
  id: "mem_admin_1",
  storeId: "store_alpha",
  userId: "user_admin_002",
  role: "admin",
  status: "ACTIVE",
  createdAt: "2026-01-02T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

const mockStaffMember: StoreMemberItem = {
  id: "mem_staff_1",
  storeId: "store_alpha",
  userId: "user_staff_003",
  role: "staff",
  status: "ACTIVE",
  createdAt: "2026-01-03T00:00:00.000Z",
  updatedAt: "2026-01-03T00:00:00.000Z",
};

const mockSecondOwner: StoreMemberItem = {
  id: "mem_owner_2",
  storeId: "store_alpha",
  userId: "user_owner_004",
  role: "owner",
  status: "ACTIVE",
  createdAt: "2026-01-04T00:00:00.000Z",
  updatedAt: "2026-01-04T00:00:00.000Z",
};

describe("Merchant Store Team: Domain & Validation Helpers", () => {
  describe("validateAddMemberFormData", () => {
    it("accepts valid member data", () => {
      const valid: AddMemberFormData = {
        userId: "user_12345",
        role: "admin",
      };
      const errors = validateAddMemberFormData(valid);
      expect(Object.keys(errors)).toHaveLength(0);
    });

    it("rejects empty user ID", () => {
      const invalid: AddMemberFormData = {
        userId: "   ",
        role: "staff",
      };
      const errors = validateAddMemberFormData(invalid);
      expect(errors.userId).toBe("User ID is required");
    });

    it("rejects user ID exceeding 100 characters", () => {
      const invalid: AddMemberFormData = {
        userId: "u".repeat(101),
        role: "staff",
      };
      const errors = validateAddMemberFormData(invalid);
      expect(errors.userId).toBe("User ID must not exceed 100 characters");
    });

    it("rejects invalid role string", () => {
      const invalid = {
        userId: "user_valid",
        role: "superadmin" as unknown as "owner" | "admin" | "staff",
      };
      const errors = validateAddMemberFormData(invalid);
      expect(errors.role).toContain("Role must be one of: owner, admin, staff");
    });
  });

  describe("canUserManageMembers", () => {
    it("grants management permission to owner and admin", () => {
      expect(canUserManageMembers("owner")).toBe(true);
      expect(canUserManageMembers("OWNER")).toBe(true);
      expect(canUserManageMembers("admin")).toBe(true);
      expect(canUserManageMembers("ADMIN")).toBe(true);
    });

    it("denies management permission to staff and unknown roles", () => {
      expect(canUserManageMembers("staff")).toBe(false);
      expect(canUserManageMembers("viewer")).toBe(false);
      expect(canUserManageMembers(undefined)).toBe(false);
    });
  });

  describe("countActiveOwners", () => {
    it("counts only active members with owner role", () => {
      const list: StoreMemberItem[] = [
        mockOwnerMember,
        mockAdminMember,
        mockStaffMember,
        { ...mockSecondOwner, status: "SUSPENDED" }, // suspended owner does not count
      ];
      expect(countActiveOwners(list)).toBe(1);

      const listWithTwo = [...list, mockSecondOwner];
      expect(countActiveOwners(listWithTwo)).toBe(2);
    });
  });

  describe("canDemoteOrRemoveMember: Last-Owner & Role Boundary Protections", () => {
    it("denies staff from demoting or removing any member", () => {
      const res = canDemoteOrRemoveMember("staff", mockStaffMember, 1, "remove");
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe("Requires Admin or Owner permissions");
    });

    it("denies admin from demoting or removing an owner", () => {
      const res = canDemoteOrRemoveMember("admin", mockOwnerMember, 2, "remove");
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain("Only store owners can modify or remove another owner");
    });

    it("denies owner from removing the last active owner", () => {
      const res = canDemoteOrRemoveMember("owner", mockOwnerMember, 1, "remove");
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe("Cannot remove the last remaining active owner of the store");
    });

    it("denies owner from demoting the last active owner", () => {
      const res = canDemoteOrRemoveMember("owner", mockOwnerMember, 1, "demote");
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe("Cannot demote the last remaining active owner of the store");
    });

    it("allows owner to remove another owner when multiple active owners exist", () => {
      const res = canDemoteOrRemoveMember("owner", mockSecondOwner, 2, "remove");
      expect(res.allowed).toBe(true);
    });

    it("allows admin to remove a staff member", () => {
      const res = canDemoteOrRemoveMember("admin", mockStaffMember, 1, "remove");
      expect(res.allowed).toBe(true);
    });

    it("allows admin to remove another admin", () => {
      const res = canDemoteOrRemoveMember("admin", mockAdminMember, 1, "remove");
      expect(res.allowed).toBe(true);
    });
  });
});

describe("Merchant Store Team UI Component Rendering", () => {
  const dummyFn = vi.fn();

  it("renders MembersTable with user IDs, roles, status badges, and join dates", () => {
    const html = renderToStaticMarkup(
      <MembersTable
        storeId="store_alpha"
        members={[mockOwnerMember, mockAdminMember, mockStaffMember]}
        currentUserRole="owner"
        currentUserId="user_owner_001"
        onMemberUpdated={dummyFn}
        onMemberRemoved={dummyFn}
      />,
    );

    expect(html).toContain("user_owner_001");
    expect(html).toContain("(You / Current Session)");
    expect(html).toContain("user_admin_002");
    expect(html).toContain("user_staff_003");
    expect(html).toContain("Active");
  });

  it("disables remove button for last active owner", () => {
    const html = renderToStaticMarkup(
      <MembersTable
        storeId="store_alpha"
        members={[mockOwnerMember, mockStaffMember]}
        currentUserRole="owner"
        currentUserId="user_owner_001"
        onMemberUpdated={dummyFn}
        onMemberRemoved={dummyFn}
      />,
    );

    // Should contain disabled button with title explaining last owner protection
    expect(html).toContain("Cannot remove the last remaining active owner of the store");
    expect(html).toContain("disabled");
  });

  it("renders AddMemberDialog with user ID input, role selector, and clarity note", () => {
    const html = renderToStaticMarkup(
      <AddMemberDialog
        storeId="store_alpha"
        isOpen={true}
        onClose={dummyFn}
        onSuccess={dummyFn}
      />,
    );

    expect(html).toContain("Add Store Team Member");
    expect(html).toContain("User Identifier (User ID)");
    expect(html).toContain("Store Role");
    expect(html).toContain("Direct assignment: The specified user will immediately receive access");
    expect(html).toContain("No invitation email workflow is required");
  });
});

describe("API Client & Store Team End-to-End Integration", () => {
  const mockApiClient = new ApiClient("http://localhost:3000");

  it("successfully calls GET /api/v1/stores/[storeId]/members", async () => {
    const membersList = [mockOwnerMember, mockAdminMember];
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: true,
        data: { items: membersList },
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const result = await mockApiClient.get<{ items: StoreMemberItem[] }>(
      "/api/v1/stores/store_alpha/members",
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [callUrl, callInit] = fetchSpy.mock.calls[0];
    expect(callUrl).toBe("http://localhost:3000/api/v1/stores/store_alpha/members");
    expect(callInit.method).toBe("GET");
    expect(result.items).toHaveLength(2);
    expect(result.items[0]?.userId).toBe("user_owner_001");

    vi.unstubAllGlobals();
  });

  it("successfully calls POST /api/v1/stores/[storeId]/members with userId and role", async () => {
    const newMember: StoreMemberItem = {
      id: "mem_new_99",
      storeId: "store_alpha",
      userId: "user_new_99",
      role: "staff",
      status: "ACTIVE",
      createdAt: "2026-01-05T00:00:00.000Z",
      updatedAt: "2026-01-05T00:00:00.000Z",
    };

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: true,
        data: newMember,
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const result = await mockApiClient.post<StoreMemberItem>(
      "/api/v1/stores/store_alpha/members",
      {
        userId: "user_new_99",
        role: "staff",
      },
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [callUrl, callInit] = fetchSpy.mock.calls[0];
    expect(callUrl).toBe("http://localhost:3000/api/v1/stores/store_alpha/members");
    expect(callInit.method).toBe("POST");
    expect(JSON.parse(callInit.body as string)).toEqual({
      userId: "user_new_99",
      role: "staff",
    });
    expect(result.id).toBe("mem_new_99");

    vi.unstubAllGlobals();
  });

  it("handles 409 conflict when user already has membership", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: false,
        data: null,
        error: {
          code: "MEMBERSHIP_ALREADY_EXISTS",
          message: "User 'user_owner_001' already has an active or pending membership in this store",
        },
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    try {
      await mockApiClient.post("/api/v1/stores/store_alpha/members", {
        userId: "user_owner_001",
        role: "staff",
      });
      expect.unreachable("Should have thrown ApiClientError");
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ApiClientError);
      const apiErr = err as ApiClientError;
      expect(apiErr.status).toBe(409);
      expect(apiErr.isConflict).toBe(true);
      expect(apiErr.code).toBe("MEMBERSHIP_ALREADY_EXISTS");
      expect(apiErr.message).toContain("already has an active or pending membership");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("successfully calls PATCH /api/v1/stores/[storeId]/members/[memberId] to change role", async () => {
    const updatedMember: StoreMemberItem = {
      ...mockStaffMember,
      role: "admin",
    };

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: true,
        data: updatedMember,
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const result = await mockApiClient.patch<StoreMemberItem>(
      `/api/v1/stores/store_alpha/members/${mockStaffMember.id}`,
      { role: "admin" },
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [callUrl, callInit] = fetchSpy.mock.calls[0];
    expect(callUrl).toBe(`http://localhost:3000/api/v1/stores/store_alpha/members/${mockStaffMember.id}`);
    expect(callInit.method).toBe("PATCH");
    expect(JSON.parse(callInit.body as string)).toEqual({ role: "admin" });
    expect(result.role).toBe("admin");

    vi.unstubAllGlobals();
  });

  it("handles 400 error when attempting to demote last active owner", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: false,
        data: null,
        error: {
          code: "CANNOT_REMOVE_LAST_OWNER",
          message: "Cannot demote or deactivate the last remaining active owner of the store",
        },
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    try {
      await mockApiClient.patch(`/api/v1/stores/store_alpha/members/${mockOwnerMember.id}`, {
        role: "admin",
      });
      expect.unreachable("Should have thrown ApiClientError");
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ApiClientError);
      const apiErr = err as ApiClientError;
      expect(apiErr.status).toBe(400);
      expect(apiErr.code).toBe("CANNOT_REMOVE_LAST_OWNER");
      expect(apiErr.message).toContain("last remaining active owner");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("successfully calls DELETE /api/v1/stores/[storeId]/members/[memberId]", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: true,
        data: { removed: true },
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const result = await mockApiClient.delete<{ removed: boolean }>(
      `/api/v1/stores/store_alpha/members/${mockStaffMember.id}`,
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [callUrl, callInit] = fetchSpy.mock.calls[0];
    expect(callUrl).toBe(`http://localhost:3000/api/v1/stores/store_alpha/members/${mockStaffMember.id}`);
    expect(callInit.method).toBe("DELETE");
    expect(result.removed).toBe(true);

    vi.unstubAllGlobals();
  });

  it("duplicate submission guard prevents redundant add member requests", async () => {
    let callCount = 0;
    const fetchSpy = vi.fn().mockImplementation(async () => {
      callCount++;
      await new Promise((r) => setTimeout(r, 40));
      return {
        ok: true,
        status: 201,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          success: true,
          data: { ...mockStaffMember, id: "mem_dedup" },
        }),
      };
    });
    vi.stubGlobal("fetch", fetchSpy);

    const p1 = mockApiClient.request("/api/v1/stores/store_alpha/members", {
      method: "POST",
      deduplicateKey: "add-member-dedup",
    });
    const p2 = mockApiClient.request("/api/v1/stores/store_alpha/members", {
      method: "POST",
      deduplicateKey: "add-member-dedup",
    });

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(callCount).toBe(1);
    expect(r1).toEqual(r2);

    vi.unstubAllGlobals();
  });
});
