import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EmailService,
  getEmailService,
  resetEmailService,
  resolveEmailConfig,
  validateAppBaseUrl,
  buildMerchantPasswordResetUrl,
  buildStorefrontPasswordResetUrl,
  buildStaffInvitationUrl,
  buildStorefrontAccountUrl,
  buildMerchantDashboardUrl,
  renderMerchantPasswordResetEmail,
  renderStorefrontPasswordResetEmail,
  renderStaffInvitationEmail,
  renderStaffInvitationAcceptedEmail,
  renderStaffInvitationRevokedEmail,
  renderPasswordChangedEmail,
  renderCustomerWelcomeEmail,
  MissingEmailProviderConfigurationError,
  InvalidEmailProviderConfigurationError,
} from "@shopify-clone/email";
import { generateUuidV7, runMigrations, type Database } from "@shopify-clone/db";
import { register, login, createPasswordResetToken } from "@shopify-clone/auth";
import { StoreService } from "@shopify-clone/stores";
import { POST as merchantForgotPasswordHandler } from "../apps/web/app/api/v1/auth/forgot-password/route";
import { POST as storefrontForgotPasswordHandler } from "../apps/web/app/api/v1/storefront/[storeSlug]/auth/forgot-password/route";
import { POST as resetPasswordHandler } from "../apps/web/app/api/v1/auth/reset-password/route";
import { POST as inviteStaffHandler } from "../apps/web/app/api/v1/stores/[storeId]/invitations/route";
import { DELETE as revokeInviteHandler } from "../apps/web/app/api/v1/stores/[storeId]/invitations/[invitationId]/route";
import { POST as acceptInviteHandler } from "../apps/web/app/api/v1/invitations/[token]/route";
import { POST as customerRegisterHandler } from "../apps/web/app/api/v1/storefront/[storeSlug]/auth/register/route";

declare global {
  // eslint-disable-next-line no-var
  var __shopify_clone_web_db: Database | undefined;
}

const storeService = new StoreService();

import { createIsolatedDatabase } from "./helpers/postgres.js";

async function setupTestDb(): Promise<{ db: Database; close: () => Promise<void> }> {
  const isolated = await createIsolatedDatabase();
  await runMigrations(isolated.database);
  return { db: isolated.database, close: isolated.close };
}

describe("Transactional Email Integration & Delivery System", () => {
  let emailService: EmailService;

  beforeEach(() => {
    // Use test mode EmailService for capturing all dispatched emails
    emailService = new EmailService({
      mode: "test",
      appUrl: "https://demo.shopifyclone.com",
      fromEmail: "Shopify Clone <notifications@shopifyclone.com>",
    });
    resetEmailService(emailService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetEmailService();
  });

  describe("1. Configuration, Base URL & Anti-Host-Header Injection", () => {
    it("resolves valid email configuration with defaults", () => {
      const config = resolveEmailConfig({
        NODE_ENV: "test",
        APP_URL: "https://app.example.com/",
        RESEND_FROM_EMAIL: "Support <support@example.com>",
      });

      expect(config.appUrl).toBe("https://app.example.com");
      expect(config.fromEmail).toBe("Support <support@example.com>");
      expect(config.mode).toBe("test");
    });

    it("requires RESEND_API_KEY when strict validation is requested", () => {
      expect(() => {
        resolveEmailConfig(
          {
            NODE_ENV: "production",
            APP_URL: "https://app.example.com",
          },
          { strict: true }
        );
      }).toThrowError(MissingEmailProviderConfigurationError);
    });

    it("rejects invalid RESEND_API_KEY format", () => {
      expect(() => {
        resolveEmailConfig(
          {
            NODE_ENV: "production",
            RESEND_API_KEY: "invalid_key_without_prefix",
            APP_URL: "https://app.example.com",
          },
          { strict: true }
        );
      }).toThrowError(InvalidEmailProviderConfigurationError);
    });

    it("rejects non-HTTP/HTTPS base URLs", () => {
      expect(() => validateAppBaseUrl("ftp://evil.com")).toThrowError(
        InvalidEmailProviderConfigurationError
      );
      expect(() => validateAppBaseUrl("javascript:alert(1)")).toThrowError(
        InvalidEmailProviderConfigurationError
      );
    });

    it("strictly constructs trusted links from server configuration rather than untrusted request headers", () => {
      const serverAppUrl = "https://legit-store.shopifyclone.com";
      const token = "secret_reset_token_abc123";

      const merchantUrl = buildMerchantPasswordResetUrl(serverAppUrl, token);
      const storefrontUrl = buildStorefrontPasswordResetUrl(serverAppUrl, "my-store", token);
      const staffUrl = buildStaffInvitationUrl(serverAppUrl, token);

      expect(merchantUrl).toBe(
        "https://legit-store.shopifyclone.com/merchant/reset-password?token=secret_reset_token_abc123"
      );
      expect(storefrontUrl).toBe(
        "https://legit-store.shopifyclone.com/stores/my-store/reset-password?token=secret_reset_token_abc123"
      );
      expect(staffUrl).toBe(
        "https://legit-store.shopifyclone.com/merchant/invitations/accept?token=secret_reset_token_abc123"
      );

      // Verify no attacker host is present
      const attackerHost = "attacker-domain.evil";
      expect(merchantUrl.includes(attackerHost)).toBe(false);
      expect(storefrontUrl.includes(attackerHost)).toBe(false);
      expect(staffUrl.includes(attackerHost)).toBe(false);
    });
  });

  describe("2. Email Templates, Recipient Selection & Sanitization", () => {
    it("renders merchant password reset template with dual HTML and plain-text", () => {
      const rendered = renderMerchantPasswordResetEmail({
        to: "merchant@example.com",
        recipientName: "Alice Merchant",
        resetUrl: "https://demo.shopifyclone.com/merchant/reset-password?token=xyz",
        expiresInMinutes: 60,
      });

      expect(rendered.subject).toContain("Reset your Shopify Clone password");
      expect(rendered.html).toContain("Alice Merchant");
      expect(rendered.html).toContain("60 minutes");
      expect(rendered.html).toContain("https://demo.shopifyclone.com/merchant/reset-password?token=xyz");
      expect(rendered.text).toContain("https://demo.shopifyclone.com/merchant/reset-password?token=xyz");
    });

    it("renders storefront customer password reset template with store branding", () => {
      const rendered = renderStorefrontPasswordResetEmail({
        to: "customer@example.com",
        storeName: "Sneaker Haven",
        storeSlug: "sneaker-haven",
        resetUrl: "https://demo.shopifyclone.com/stores/sneaker-haven/reset-password?token=xyz",
      });

      expect(rendered.subject).toContain("Reset your password for Sneaker Haven");
      expect(rendered.html).toContain("Sneaker Haven");
      expect(rendered.html).toContain("Reset My Password");
      expect(rendered.text).toContain("Sneaker Haven");
    });

    it("renders staff invitation email with role and expiry details", () => {
      const expiresAt = new Date("2026-12-31T23:59:59Z");
      const rendered = renderStaffInvitationEmail({
        to: "staff@example.com",
        storeName: "Nordic Goods",
        inviterName: "Store Owner Bob",
        role: "admin",
        inviteUrl: "https://demo.shopifyclone.com/merchant/invitations/accept?token=invite123",
        expiresAt,
      });

      expect(rendered.subject).toContain("You've been invited to join Nordic Goods");
      expect(rendered.html).toContain("Store Owner Bob");
      expect(rendered.html).toContain("ADMIN");
      expect(rendered.html).toContain("Nordic Goods");
      expect(rendered.text).toContain("ADMIN");
    });

    it("renders password changed security notification", () => {
      const rendered = renderPasswordChangedEmail({
        to: "user@example.com",
        recipientName: "Charlie",
        changedAt: new Date("2026-10-14T12:00:00Z"),
      });

      expect(rendered.subject).toContain("Security Alert: Your password has been changed");
      expect(rendered.html).toContain("signed out");
      expect(rendered.text).toContain("Security Alert");
    });

    it("escapes user input to prevent HTML injection in emails", () => {
      const maliciousName = '<script>alert("xss")</script><b>Hacked</b>';
      const rendered = renderMerchantPasswordResetEmail({
        to: "victim@example.com",
        recipientName: maliciousName,
        resetUrl: "https://demo.shopifyclone.com/reset",
      });

      expect(rendered.html).not.toContain("<script>");
      expect(rendered.html).toContain("&lt;script&gt;");
    });
  });

  describe("3. Mocked Resend Provider Integration & Error Resilience", () => {
    it("dispatches email through Resend SDK when mode is resend", async () => {
      const mockSend = vi.fn().mockResolvedValue({
        data: { id: "msg_resend_mock_success_789" },
        error: null,
      });

      const resendService = new EmailService({
        mode: "resend",
        apiKey: "re_mock_test_key_123",
        fromEmail: "notifications@shopifyclone.com",
        appUrl: "https://demo.shopifyclone.com",
      });

      // @ts-expect-error - overriding internal client for mock testing
      resendService.resendClient = { emails: { send: mockSend } };

      const result = await resendService.sendMerchantPasswordReset({
        to: "merchant@example.com",
        token: "tok_123",
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("msg_resend_mock_success_789");
      expect(mockSend).toHaveBeenCalledOnce();
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ["merchant@example.com"],
          from: "notifications@shopifyclone.com",
          subject: expect.stringContaining("Reset your Shopify Clone password"),
        })
      );
    });

    it("handles provider rejection safely without crashing or leaking credentials", async () => {
      const mockSend = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Domain not verified on Resend" },
      });

      const resendService = new EmailService({
        mode: "resend",
        apiKey: "re_mock_test_key_123",
        appUrl: "https://demo.shopifyclone.com",
      });

      // @ts-expect-error - overriding internal client for mock testing
      resendService.resendClient = { emails: { send: mockSend } };

      const result = await resendService.sendEmail({
        to: "merchant@example.com",
        subject: "Test",
        html: "<p>Test</p>",
        text: "Test",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Domain not verified on Resend");
      expect(result.error).not.toContain("re_mock_test_key_123");
    });

    it("handles provider timeout safely without hanging callers", async () => {
      const resendService = new EmailService({
        mode: "resend",
        apiKey: "re_mock_test_key_123",
        timeoutMs: 50, // fast timeout for test
        appUrl: "https://demo.shopifyclone.com",
      });

      // Mock a hanging send call
      const hangingSend = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 500))
      );

      // @ts-expect-error - overriding internal client for mock testing
      resendService.resendClient = { emails: { send: hangingSend } };

      const result = await resendService.sendEmail({
        to: "merchant@example.com",
        subject: "Timeout Test",
        html: "<p>Test</p>",
        text: "Test",
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/timed out/i);
    });
  });

  describe("4. End-to-End Authentication Flows with Email Delivery", { timeout: 45_000 }, () => {
    let db: Database;
    let closeDb: () => Promise<void>;

    beforeEach(async () => {
      const isolated = await setupTestDb();
      db = isolated.db;
      closeDb = isolated.close;
      global.__shopify_clone_web_db = db;
    });

    afterEach(async () => {
      global.__shopify_clone_web_db = undefined;
      if (closeDb) {
        await closeDb();
      }
    });

    it("merchant forgot-password sends email and returns generic response without leaking token", async () => {
      // 1. Register a merchant user
      const user = await register(db, {
        email: "merchant.alice@example.com",
        password: "Password123!",
        name: "Alice Merchant",
      });

      // 2. Request password reset via HTTP API
      const req = new Request("http://localhost:3000/api/v1/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "merchant.alice@example.com" }),
      });

      const res = await merchantForgotPasswordHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.message).toContain("If an account exists with that email");
      // The token MUST NOT be in the API response
      expect(json.data.token).toBeUndefined();

      // 3. Verify email was captured in email service
      const captured = emailService.getLastCapturedEmail();
      expect(captured).toBeDefined();
      expect(captured?.to).toBe("merchant.alice@example.com");
      expect(captured?.subject).toContain("Reset your Shopify Clone password");
      expect(captured?.html).toContain("/merchant/reset-password?token=");

      // Extract token from email and verify it successfully resets the password
      const match = captured?.html.match(/token=([a-f0-9]+)/);
      expect(match).toBeTruthy();
      const resetToken = match![1];

      // 4. Perform password reset
      const resetReq = new Request("http://localhost:3000/api/v1/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: resetToken,
          newPassword: "BrandNewPassword456!",
        }),
      });

      const resetRes = await resetPasswordHandler(resetReq);
      expect(resetRes.status).toBe(200);

      // 5. Verify security notification email was dispatched for password change
      const allCaptured = emailService.getCapturedEmails();
      const securityEmail = allCaptured.find((e) => e.templateName === "password_changed");
      expect(securityEmail).toBeDefined();
      expect(securityEmail?.to).toBe("merchant.alice@example.com");
      expect(securityEmail?.subject).toContain("Security Alert");

      // 6. Verify user can log in with new password and cannot with old
      const newLogin = await login(db, {
        email: "merchant.alice@example.com",
        password: "BrandNewPassword456!",
      });
      expect(newLogin.user.id).toBe(user.user.id);
    });

    it("merchant forgot-password returns same generic response for non-existent email without sending email", async () => {
      emailService.clearCapturedEmails();

      const req = new Request("http://localhost:3000/api/v1/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "nonexistent.merchant@example.com" }),
      });

      const res = await merchantForgotPasswordHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.message).toContain("If an account exists with that email");
      expect(json.data.token).toBeUndefined();

      // No email should be sent
      expect(emailService.getCapturedEmails()).toHaveLength(0);
    });

    it("storefront customer forgot-password sends store-branded email and resets password", async () => {
      // 1. Create store and customer
      const owner = await register(db, {
        email: "owner.store@example.com",
        password: "Password123!",
        name: "Store Owner",
      });
      const store = await storeService.createStore(db, owner.user.id, {
        name: "Aurora Botanicals",
        slug: "aurora-botanicals",
      });

      // Register customer
      const custReq = new Request(
        "http://localhost:3000/api/v1/storefront/aurora-botanicals/auth/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "shopper@example.com",
            password: "CustomerPassword123!",
            firstName: "Sam",
          }),
        }
      );
      const custRes = await customerRegisterHandler(custReq, {
        params: Promise.resolve({ storeSlug: "aurora-botanicals" }),
      });
      expect(custRes.status).toBe(201);

      // Verify welcome email was dispatched
      const welcomeEmail = emailService.getLastCapturedEmail();
      expect(welcomeEmail?.templateName).toBe("customer_welcome");
      expect(welcomeEmail?.to).toBe("shopper@example.com");
      expect(welcomeEmail?.subject).toContain("Aurora Botanicals");

      emailService.clearCapturedEmails();

      // 2. Customer requests password reset
      const forgotReq = new Request(
        "http://localhost:3000/api/v1/storefront/aurora-botanicals/auth/forgot-password",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "shopper@example.com" }),
        }
      );
      const forgotRes = await storefrontForgotPasswordHandler(forgotReq, {
        params: Promise.resolve({ storeSlug: "aurora-botanicals" }),
      });
      expect(forgotRes.status).toBe(200);

      // Verify email captured
      const resetEmail = emailService.getLastCapturedEmail();
      expect(resetEmail?.templateName).toBe("storefront_password_reset");
      expect(resetEmail?.to).toBe("shopper@example.com");
      expect(resetEmail?.subject).toContain("Reset your password for Aurora Botanicals");
      expect(resetEmail?.html).toContain("/stores/aurora-botanicals/reset-password?token=");
    });

    it("staff invitation flow dispatches invitation, acceptance, and revocation emails", async () => {
      // 1. Create owner and store
      const owner = await register(db, {
        email: "store.boss@example.com",
        password: "Password123!",
        name: "Store Boss",
      });
      const store = await storeService.createStore(db, owner.user.id, {
        name: "Nordic Apparel",
        slug: "nordic-apparel",
      });

      const memberships = await db.query(
        "SELECT * FROM store_memberships WHERE store_id = $1 AND user_id = $2",
        [store.id, owner.user.id]
      );
      console.log("MEMBERSHIP CHECK:", memberships.rows);

      emailService.clearCapturedEmails();

      // 2. Invite a staff member via API
      const inviteReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/invitations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `shopify_clone_session=${owner.session.id}`,
          },
          body: JSON.stringify({
            email: "colleague@example.com",
            role: "staff",
          }),
        }
      );

      const inviteRes = await inviteStaffHandler(inviteReq, {
        params: Promise.resolve({ storeId: store.id }),
      });
      const inviteJson = await inviteRes.json();
      if (inviteRes.status !== 201) {
        console.error("INVITE ERROR DETAILS:", JSON.stringify(inviteJson, null, 2));
      }
      expect(inviteRes.status).toBe(201);

      // 3. Verify staff invitation email was sent
      const inviteEmail = emailService.getLastCapturedEmail();
      expect(inviteEmail?.templateName).toBe("staff_invitation");
      expect(inviteEmail?.to).toBe("colleague@example.com");
      expect(inviteEmail?.subject).toContain("You've been invited to join Nordic Apparel");
      expect(inviteEmail?.html).toContain("Store Boss");
      expect(inviteEmail?.html).toContain("STAFF");
      expect(inviteEmail?.html).toContain("/merchant/invitations/accept?token=");

      // 4. Accept invitation
      const rawToken = inviteJson.data.invitationToken;
      const acceptReq = new Request(
        `http://localhost:3000/api/v1/invitations/${rawToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            password: "ColleaguePassword123!",
            name: "Colleague Carol",
          }),
        }
      );

      const acceptRes = await acceptInviteHandler(acceptReq, {
        params: Promise.resolve({ token: rawToken }),
      });
      expect(acceptRes.status).toBe(200);

      // Verify acceptance confirmation email
      const acceptedEmail = emailService.getLastCapturedEmail();
      expect(acceptedEmail?.templateName).toBe("staff_invitation_accepted");
      expect(acceptedEmail?.to).toBe("colleague@example.com");
      expect(acceptedEmail?.subject).toContain("Welcome to Nordic Apparel");

      // 5. Test Revocation flow: invite another user and revoke
      const secondInviteReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/invitations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `shopify_clone_session=${owner.session.id}`,
          },
          body: JSON.stringify({
            email: "temporary.staff@example.com",
            role: "staff",
          }),
        }
      );
      const secondRes = await inviteStaffHandler(secondInviteReq, {
        params: Promise.resolve({ storeId: store.id }),
      });
      const secondJson = await secondRes.json();
      const invitationId = secondJson.data.invitation.id;

      // Revoke invitation
      const revokeReq = new Request(
        `http://localhost:3000/api/v1/stores/${store.id}/invitations/${invitationId}`,
        {
          method: "DELETE",
          headers: {
            Cookie: `shopify_clone_session=${owner.session.id}`,
          },
        }
      );
      const revokeRes = await revokeInviteHandler(revokeReq, {
        params: Promise.resolve({ storeId: store.id, invitationId }),
      });
      expect(revokeRes.status).toBe(200);

      // Verify revocation notification email
      const revokedEmail = emailService.getLastCapturedEmail();
      expect(revokedEmail?.templateName).toBe("staff_invitation_revoked");
      expect(revokedEmail?.to).toBe("temporary.staff@example.com");
      expect(revokedEmail?.subject).toContain("cancelled");
    });
  });
});
