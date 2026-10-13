"use client";

import React from "react";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@shopify-clone/ui";
import { MerchantShell } from "../../../src/components/merchant/MerchantShell";
import { useAuth } from "../../../src/context/auth-context";
import { useStore } from "../../../src/context/store-context";

export default function MerchantTeamPage() {
  const { user, logout } = useAuth();
  const { activeStore, stores, selectStore } = useStore();

  return (
    <MerchantShell
      activePath="/merchant/team"
      currentStore={activeStore}
      stores={stores}
      onSelectStore={selectStore}
      userName={user?.name || "Merchant"}
      userEmail={user?.email}
      onLogout={logout}
      title="Team & Permissions"
      subtitle="Role-based access control, store staff permissions, and tenant isolation"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <Card>
          <CardHeader>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--space-2)" }}>
              <div>
                <CardTitle>Team Members & Staff Access</CardTitle>
                <p style={{ margin: "4px 0 0", color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
                  Manage access control and staff roles for <strong>{activeStore?.name ?? "this store"}</strong>.
                </p>
              </div>
              <div style={{ display: "flex", gap: "var(--space-2)" }}>
                <Badge variant="info" size="sm">
                  Role-Based Access Control
                </Badge>
                <Badge variant="neutral" size="sm">
                  Staff UI: Milestone B
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "var(--space-4)",
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid var(--color-border)",
                  backgroundColor: "var(--color-surface)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "50%",
                      backgroundColor: "var(--color-primary-subtle)",
                      color: "var(--color-primary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: "var(--font-size-sm)",
                      border: "1px solid var(--color-primary-border)",
                    }}
                  >
                    {(user?.name ? user.name.charAt(0) : "U").toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--color-text-primary)", fontSize: "var(--font-size-md)" }}>{user?.name || "Demo User"}</div>
                    <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
                      {user?.email || "demo@example.com"}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <Badge variant="success" size="sm">
                    {activeStore?.role ? activeStore.role.toUpperCase() : "OWNER"}
                  </Badge>
                  <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>Current Session</span>
                </div>
              </div>
            </div>

            {/* Role Hierarchy Reference */}
            <div style={{ marginTop: "var(--space-6)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-3)" }}>
              <div style={{ padding: "var(--space-3)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", backgroundColor: "var(--color-bg)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "4px" }}>
                  <Badge variant="success" size="sm">OWNER</Badge>
                </div>
                <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-secondary)" }}>
                  Full store authority, lifecycle deletion, and member administration.
                </div>
              </div>

              <div style={{ padding: "var(--space-3)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", backgroundColor: "var(--color-bg)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "4px" }}>
                  <Badge variant="info" size="sm">ADMIN</Badge>
                </div>
                <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-secondary)" }}>
                  Manage products, discounts, orders, inventory, and staff invitations.
                </div>
              </div>

              <div style={{ padding: "var(--space-3)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", backgroundColor: "var(--color-bg)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "4px" }}>
                  <Badge variant="neutral" size="sm">STAFF</Badge>
                </div>
                <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-secondary)" }}>
                  View products and orders; restricted from destructive administrative mutations.
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: "var(--space-6)",
                padding: "var(--space-4)",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--color-bg)",
                border: "1px solid var(--color-border)",
                fontSize: "var(--font-size-sm)",
                color: "var(--color-text-secondary)",
              }}
            >
              <strong style={{ color: "var(--color-text-primary)" }}>Tenant Isolation Guarantee:</strong> Staff members are strictly scoped
              to this specific store instance in PostgreSQL. Cross-tenant access is prevented at the database and middleware boundaries.
              Full invitation forms and role-switching controls will be active in Milestone B using existing <code>/api/v1/stores/[storeId]/members</code> endpoints.
            </div>
          </CardContent>
        </Card>
      </div>
    </MerchantShell>
  );
}
