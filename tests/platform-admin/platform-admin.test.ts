import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations, type Database } from "@calcart/db";
import { register } from "@calcart/auth";
import {
  PLATFORM_ROLES,
  hasPlatformPermission,
  PlatformAuditService,
  PlatformAuthService,
  PlatformTenantService,
  PlatformPaymentsFinancialService,
  PlatformGovernanceService,
  PlatformGlobalSearchService,
  InvalidCredentialsError,
  AccountLockedError,
} from "@calcart/platform-admin";
import { createIsolatedDatabase } from "../helpers/postgres.js";

describe("Cal Cart Control Center: Platform Administration & Governance", { timeout: 60_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  let db: Database;

  beforeEach(async () => {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    db = isolated.database;
  });

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
  });

  describe("1. Platform RBAC & Fine-Grained Permissions", () => {
    it("defines all 6 supported platform administration roles", () => {
      expect(PLATFORM_ROLES).toEqual([
        "super_admin",
        "platform_admin",
        "finance_admin",
        "support_admin",
        "security_admin",
        "analyst",
      ]);
    });

    it("verifies super_admin possesses full governance permissions", () => {
      expect(hasPlatformPermission("super_admin", "dashboard:read")).toBe(true);
      expect(hasPlatformPermission("super_admin", "tenants:write")).toBe(true);
      expect(hasPlatformPermission("super_admin", "stores:write")).toBe(true);
      expect(hasPlatformPermission("super_admin", "payments:reconcile")).toBe(true);
      expect(hasPlatformPermission("super_admin", "flags:write")).toBe(true);
      expect(hasPlatformPermission("super_admin", "settings:write")).toBe(true);
    });

    it("restricts finance_admin to financial, subscription, and analytical domains", () => {
      expect(hasPlatformPermission("finance_admin", "payments:read")).toBe(true);
      expect(hasPlatformPermission("finance_admin", "payments:reconcile")).toBe(true);
      expect(hasPlatformPermission("finance_admin", "subscriptions:write")).toBe(true);
      expect(hasPlatformPermission("finance_admin", "analytics:read")).toBe(true);
      // Denied system governance, tenant mutations, and feature flags
      expect(hasPlatformPermission("finance_admin", "flags:write")).toBe(false);
      expect(hasPlatformPermission("finance_admin", "tenants:write")).toBe(false);
      expect(hasPlatformPermission("finance_admin", "settings:write")).toBe(false);
    });

    it("restricts support_admin to merchant investigation without financial overrides or feature flags", () => {
      expect(hasPlatformPermission("support_admin", "tenants:read")).toBe(true);
      expect(hasPlatformPermission("support_admin", "merchants:read")).toBe(true);
      expect(hasPlatformPermission("support_admin", "payments:read")).toBe(true);
      // Denied destructive or privileged overrides
      expect(hasPlatformPermission("support_admin", "payments:reconcile")).toBe(false);
      expect(hasPlatformPermission("support_admin", "subscriptions:write")).toBe(false);
      expect(hasPlatformPermission("support_admin", "flags:write")).toBe(false);
    });

    it("restricts analyst to read-only reporting without modification privileges", () => {
      expect(hasPlatformPermission("analyst", "dashboard:read")).toBe(true);
      expect(hasPlatformPermission("analyst", "analytics:read")).toBe(true);
      expect(hasPlatformPermission("analyst", "analytics:export")).toBe(true);
      // Denied all writes
      expect(hasPlatformPermission("analyst", "tenants:write")).toBe(false);
      expect(hasPlatformPermission("analyst", "stores:write")).toBe(false);
      expect(hasPlatformPermission("analyst", "flags:write")).toBe(false);
    });

    it("denies access when role is invalid, undefined, or empty", () => {
      expect(hasPlatformPermission(null, "dashboard:read")).toBe(false);
      expect(hasPlatformPermission(undefined, "dashboard:read")).toBe(false);
      expect(hasPlatformPermission("merchant_owner", "dashboard:read")).toBe(false);
      expect(hasPlatformPermission("customer", "dashboard:read")).toBe(false);
    });
  });

  describe("2. Cryptographic Append-Only Audit Trail & Immutability", () => {
    it("enforces mandatory justification reason on audit log writes", async () => {
      const auditService = new PlatformAuditService(db);
      const user = await register(db, {
        email: "superadmin@calcart.com",
        password: "AdminPassword123!",
        name: "Super Admin",
      });

      await expect(
        auditService.record({
          actorId: user.user.id,
          actorRole: "super_admin",
          action: "tenant.suspend",
          resourceType: "organization",
          reason: "   ", // Too short / empty
        })
      ).rejects.toThrow(/Audit log reason is mandatory/);
    });

    it("records audit logs and enforces PostgreSQL trigger preventing UPDATE", async () => {
      const auditService = new PlatformAuditService(db);
      const user = await register(db, {
        email: "superadmin@calcart.com",
        password: "AdminPassword123!",
        name: "Super Admin",
      });

      const log = await auditService.record({
        actorId: user.user.id,
        actorRole: "super_admin",
        action: "tenant.suspend",
        resourceType: "organization",
        resourceId: "test-org-123",
        reason: "Compromised tenant credentials detected during incident response",
        details: { note: "Automated mitigation" },
      });

      expect(log.id).toBeDefined();
      expect(log.action).toBe("tenant.suspend");

      // Verify DB trigger strictly blocks UPDATE
      await expect(
        db.query("UPDATE platform_audit_logs SET reason = 'Tampered reason' WHERE id = $1", [log.id])
      ).rejects.toThrow(/strictly append-only/);
    });

    it("enforces PostgreSQL trigger preventing DELETE on audit logs", async () => {
      const auditService = new PlatformAuditService(db);
      const user = await register(db, {
        email: "auditor@calcart.com",
        password: "AdminPassword123!",
        name: "Auditor",
      });

      const log = await auditService.record({
        actorId: user.user.id,
        actorRole: "security_admin",
        action: "security.alert",
        resourceType: "system",
        reason: "Validating database immutability protection",
      });

      // Verify DB trigger strictly blocks DELETE
      await expect(
        db.query("DELETE FROM platform_audit_logs WHERE id = $1", [log.id])
      ).rejects.toThrow(/strictly append-only/);
    });
  });

  describe("3. Dedicated Platform Admin Authentication & Brute-Force Lockout", () => {
    it("denies platform login to standard merchant accounts and prevents account enumeration", async () => {
      const authService = new PlatformAuthService(db);
      await register(db, {
        email: "merchant@shop.com",
        password: "MerchantPassword123!",
        name: "Standard Merchant",
      });

      // Merchant account denied with generic 401 credentials error
      try {
        await authService.login({
          email: "merchant@shop.com",
          password: "MerchantPassword123!",
        });
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(InvalidCredentialsError);
        const authErr = err as InvalidCredentialsError;
        expect(authErr.code).toBe("INVALID_CREDENTIALS");
        expect(authErr.statusCode).toBe(401);
        expect(authErr.message).toBe("Invalid platform administrator credentials.");
      }

      // Non-existent account returns identical 401 error (no email enumeration)
      try {
        await authService.login({
          email: "nonexistent@company.com",
          password: "AnyPassword123!",
        });
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(InvalidCredentialsError);
        const authErr = err as InvalidCredentialsError;
        expect(authErr.code).toBe("INVALID_CREDENTIALS");
        expect(authErr.statusCode).toBe(401);
        expect(authErr.message).toBe("Invalid platform administrator credentials.");
      }
    });

    it("authenticates provisioned platform admin and returns isolated session", async () => {
      const authService = new PlatformAuthService(db);
      const user = await register(db, {
        email: "admin@calcart.com",
        password: "SecureAdminPassword123!",
        name: "Lead Admin",
      });

      // Provision in platform_admin_users
      await db.query(
        "INSERT INTO platform_admin_users (id, role, created_at, updated_at) VALUES ($1, 'platform_admin', NOW(), NOW())",
        [user.user.id]
      );

      const loginResult = await authService.login({
        email: "admin@calcart.com",
        password: "SecureAdminPassword123!",
        ipAddress: "127.0.0.1",
        userAgent: "CalCart-ControlCenter/1.0",
      });

      expect(loginResult.sessionToken).toBeDefined();
      expect(loginResult.sessionToken.length).toBeGreaterThanOrEqual(64);
      expect(loginResult.admin.role).toBe("platform_admin");
      expect(loginResult.admin.permissions).toContain("tenants:write");

      // Verify session validation
      const validated = await authService.validateSessionToken(loginResult.sessionToken);
      expect(validated).not.toBeNull();
      expect(validated?.userId).toBe(user.user.id);
      expect(validated?.role).toBe("platform_admin");
    });

    it("locks platform admin account after 5 consecutive failed login attempts", async () => {
      const authService = new PlatformAuthService(db);
      const user = await register(db, {
        email: "target@calcart.com",
        password: "CorrectPassword123!",
        name: "Lockout Target",
      });

      await db.query(
        "INSERT INTO platform_admin_users (id, role, created_at, updated_at) VALUES ($1, 'security_admin', NOW(), NOW())",
        [user.user.id]
      );

      // 5 consecutive wrong password attempts
      for (let i = 0; i < 5; i++) {
        try {
          await authService.login({
            email: "target@calcart.com",
            password: "WrongPassword999!",
          });
          expect.unreachable("Should have thrown");
        } catch (err) {
          expect(err).toBeInstanceOf(InvalidCredentialsError);
          const credErr = err as InvalidCredentialsError;
          expect(credErr.code).toBe("INVALID_CREDENTIALS");
          expect(credErr.statusCode).toBe(401);
        }
      }

      // 6th attempt should fail with AccountLockedError (HTTP 423)
      try {
        await authService.login({
          email: "target@calcart.com",
          password: "CorrectPassword123!", // Even with correct password!
        });
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(AccountLockedError);
        const lockErr = err as AccountLockedError;
        expect(lockErr.code).toBe("ACCOUNT_LOCKED");
        expect(lockErr.statusCode).toBe(423);
        expect(lockErr.remainingMinutes).toBeGreaterThan(0);
        expect(lockErr.message).toMatch(/Account is temporarily locked/);
      }
    });

    it("allows terminating active sessions and invalidates subsequent token validation", async () => {
      const authService = new PlatformAuthService(db);
      const user = await register(db, {
        email: "operator@calcart.com",
        password: "OperatorPassword123!",
        name: "Operator",
      });

      await db.query(
        "INSERT INTO platform_admin_users (id, role, created_at, updated_at) VALUES ($1, 'super_admin', NOW(), NOW())",
        [user.user.id]
      );

      const session = await authService.login({
        email: "operator@calcart.com",
        password: "OperatorPassword123!",
      });

      const validatedBefore = await authService.validateSessionToken(session.sessionToken);
      expect(validatedBefore).not.toBeNull();

      // Revoke session
      await authService.revokeSession(
        session.admin.sessionId,
        user.user.id,
        "super_admin",
        "Administrative session termination verification"
      );

      // Now token validation must fail
      const validatedAfter = await authService.validateSessionToken(session.sessionToken);
      expect(validatedAfter).toBeNull();
    });
  });

  describe("4. Tenant Lifecycle Management & Store Cascading", () => {
    it("suspends tenant organization and cascades suspension to stores with audit record", async () => {
      const tenantService = new PlatformTenantService(db);
      const auditService = new PlatformAuditService(db);

      const adminUser = await register(db, {
        email: "gov@calcart.com",
        password: "GovPassword123!",
        name: "Governance Admin",
      });

      // Create organization and store
      const orgId = "c0000000-0000-4000-8000-000000000001";
      await db.query(
        "INSERT INTO organizations (id, name, status, created_at, updated_at) VALUES ($1, 'Acme Retail', 'ACTIVE', NOW(), NOW())",
        [orgId]
      );

      const storeId = "d0000000-0000-4000-8000-000000000001";
      await db.query(
        "INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone, created_at, updated_at) VALUES ($1, $2, 'Acme Apparel', 'acme-apparel', 'ACTIVE', 'INR', 'en-IN', 'Asia/Kolkata', NOW(), NOW())",
        [storeId, orgId]
      );

      // Suspend tenant
      await tenantService.updateTenantStatus({
        tenantId: orgId,
        newStatus: "SUSPENDED",
        reason: "Payment dispute violation pending merchant verification",
        actorId: adminUser.user.id,
        actorRole: "platform_admin",
      });

      // Verify org is suspended
      const orgCheck = await db.query<{ status: string }>("SELECT status FROM organizations WHERE id = $1", [orgId]);
      expect(orgCheck.rows[0]?.status).toBe("SUSPENDED");

      // Verify store cascaded to SUSPENDED
      const storeCheck = await db.query<{ status: string }>("SELECT status FROM stores WHERE id = $1", [storeId]);
      expect(storeCheck.rows[0]?.status).toBe("SUSPENDED");

      // Verify audit log recorded
      const auditRes = await auditService.list({ tenantId: orgId });
      expect(auditRes.items.length).toBeGreaterThanOrEqual(1);
      expect(auditRes.items[0]?.action).toBe("tenant.status_change");
      expect(auditRes.items[0]?.reason).toContain("Payment dispute violation");
    });
  });

  describe("5. Payment Operations & Financial Reconciliation", () => {
    it("records reconciliation note on payment and logs immutable audit trail", async () => {
      const paymentService = new PlatformPaymentsFinancialService(db);
      const adminUser = await register(db, {
        email: "finance@calcart.com",
        password: "FinancePassword123!",
        name: "Finance Controller",
      });

      const orgId = "c0000000-0000-4000-8000-000000000002";
      await db.query(
        "INSERT INTO organizations (id, name, status, created_at, updated_at) VALUES ($1, 'Globex Corp', 'ACTIVE', NOW(), NOW())",
        [orgId]
      );

      const storeId = "d0000000-0000-4000-8000-000000000002";
      await db.query(
        "INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone, created_at, updated_at) VALUES ($1, $2, 'Globex Store', 'globex-store', 'ACTIVE', 'INR', 'en-IN', 'Asia/Kolkata', NOW(), NOW())",
        [storeId, orgId]
      );

      const cartId = "a0000000-0000-4000-8000-000000000099";
      const checkoutId = "f0000000-0000-4000-8000-000000000001";
      const paymentId = "e0000000-0000-4000-8000-000000000001";
      const attemptId = "b0000000-0000-4000-8000-000000000099";

      await db.query(
        "INSERT INTO carts (id, store_id, status, currency) VALUES ($1, $2, 'ACTIVE', 'INR')",
        [cartId, storeId]
      );

      await db.query(
        `INSERT INTO checkouts (
          id, store_id, cart_id, total, subtotal, discount_total, tax_total, shipping_total,
          status, payment_status, currency
        ) VALUES ($1, $2, $3, 499900, 499900, 0, 0, 0, 'PAYMENT_PENDING', 'PENDING', 'INR')`,
        [checkoutId, storeId, cartId]
      );

      await db.query(
        `INSERT INTO payments (
          id, store_id, checkout_id, order_id, amount, currency, status, provider, captured_amount, refunded_amount, created_at, updated_at
        ) VALUES ($1, $2, $3, NULL, 499900, 'INR', 'CAPTURED', 'razorpay', 499900, 0, NOW(), NOW())`,
        [paymentId, storeId, checkoutId]
      );

      await db.query(
        `INSERT INTO payment_attempts (
          id, payment_id, store_id, attempt_number, provider, provider_payment_id, amount, currency, status, created_at, updated_at
        ) VALUES ($1, $2, $3, 1, 'razorpay', 'pay_test_orphan_123', 499900, 'INR', 'CAPTURED', NOW(), NOW())`,
        [attemptId, paymentId, storeId]
      );

      // Verify it appears in orphaned captures
      const listRes = await paymentService.listPayments({ isOrphaned: true });
      expect(listRes.items.some((p) => p.id === paymentId)).toBe(true);

      // Mark reconciliation note
      await paymentService.markReconciliationNote({
        paymentId,
        reason: "Customer order confirmed manually after webhook gateway delivery retry",
        actorId: adminUser.user.id,
        actorRole: "finance_admin",
      });

      const detail = await paymentService.getPaymentDetail(paymentId);
      expect(detail?.reconciliationReason).toContain("Customer order confirmed manually");
    });
  });

  describe("6. Platform Governance & Feature Flags", () => {
    it("updates feature flags with rollout percentage and writes audit trail", async () => {
      const governanceService = new PlatformGovernanceService(db);
      const auditService = new PlatformAuditService(db);

      const adminUser = await register(db, {
        email: "govlead@calcart.com",
        password: "GovLeadPassword123!",
        name: "Governance Lead",
      });

      const flagsBefore = await governanceService.listFeatureFlags();
      const targetFlag = flagsBefore.find((f) => f.key === "advanced_fraud_detection");
      expect(targetFlag).toBeDefined();

      await governanceService.updateFeatureFlag({
        key: "advanced_fraud_detection",
        enabled: true,
        rolloutPercentage: 50,
        reason: "Staged 50% rollout of heuristic fraud checks across checkout",
        actorId: adminUser.user.id,
        actorRole: "super_admin",
      });

      const flagsAfter = await governanceService.listFeatureFlags();
      const updated = flagsAfter.find((f) => f.key === "advanced_fraud_detection");
      expect(updated?.enabled).toBe(true);
      expect(updated?.rolloutPercentage).toBe(50);

      // Verify audit log
      const auditRes = await auditService.list({ action: "feature_flag.update" });
      expect(auditRes.items.length).toBeGreaterThanOrEqual(1);
      expect(auditRes.items[0]?.reason).toContain("Staged 50% rollout");
    });
  });

  describe("7. Global Multi-Entity Search", () => {
    it("searches across organizations, stores, and payments quickly", async () => {
      const searchService = new PlatformGlobalSearchService(db);

      const orgId = "c0000000-0000-4000-8000-000000000003";
      await db.query(
        "INSERT INTO organizations (id, name, status, created_at, updated_at) VALUES ($1, 'Stark Industries', 'ACTIVE', NOW(), NOW())",
        [orgId]
      );

      const storeId = "d0000000-0000-4000-8000-000000000003";
      await db.query(
        "INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone, created_at, updated_at) VALUES ($1, $2, 'Stark Tech Shop', 'stark-tech', 'ACTIVE', 'INR', 'en-IN', 'Asia/Kolkata', NOW(), NOW())",
        [storeId, orgId]
      );

      const results = await searchService.search("Stark");
      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results.some((r) => r.type === "organization" && r.title === "Stark Industries")).toBe(true);
      expect(results.some((r) => r.type === "store" && r.title === "Stark Tech Shop")).toBe(true);
    });
  });
});
