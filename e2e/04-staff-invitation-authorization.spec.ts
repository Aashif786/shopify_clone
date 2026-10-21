import { test, expect } from "@playwright/test";
import {
  registerMerchant,
  completeMerchantOnboarding,
  uniqueEmail,
  uniqueSlug,
  closeTestDb,
} from "./helpers/test-utils.js";

test.describe("Staff Invitation and Authorization Lifecycle", () => {
  test.afterAll(async () => {
    await closeTestDb();
  });

  test("merchant owner invites staff member, staff accepts invitation, and role-based restrictions are strictly enforced", async ({
    page,
    browser,
  }) => {
    const ownerEmail = uniqueEmail("summit_owner");
    const storeName = "Summit Apparel";
    const storeSlug = uniqueSlug("summit");

    // 1. Register a new merchant owner and onboard store
    await registerMerchant(page, {
      name: "Summit Owner",
      email: ownerEmail,
      password: "OwnerPassword123!",
    });

    await completeMerchantOnboarding(page, {
      orgName: "Summit Holdings",
      storeName,
      slug: storeSlug,
    });

    // 2. Navigate to Team & Access Control
    await page.goto("/merchant/team");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator("text=Team & Access Control").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("text=Store Team Members").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("button:has-text('+ Add Team Member')")).toBeVisible({
      timeout: 15_000,
    });

    // 3. Open Add Member Dialog and switch to Invite by Email
    await page.click("button:has-text('+ Add Team Member')");
    await expect(page.locator("text=Add Store Team Member")).toBeVisible();

    await page.click("button:has-text('Invite by Email')");

    const staffEmail = uniqueEmail("staff");
    await page.fill("#invite-email", staffEmail);
    await page.selectOption("#invite-role", "staff");

    // Click Create Invitation Link
    await page.click("button:has-text('Create Invitation Link')");

    // Verify invitation is generated with success alert
    await expect(page.locator("text=Invitation Dispatched")).toBeVisible({ timeout: 15_000 });

    // Extract the generated invitation link from readonly input
    const linkInput = page.locator('input[readonly][value*="/merchant/invitations/accept?token="]');
    await expect(linkInput).toBeVisible();
    const invitationUrl = await linkInput.inputValue();
    expect(invitationUrl).toContain("/merchant/invitations/accept?token=");

    // Close the dialog
    await page.click("button:has-text('Done')");

    // 4. Verify invitation appears in Store Invitations table with PENDING status
    await expect(page.locator("text=Store Invitations")).toBeVisible();
    await expect(page.locator(`td:has-text('${staffEmail}')`)).toBeVisible({ timeout: 10_000 });
    const pendingRow = page.locator("tr", { hasText: staffEmail });
    await expect(pendingRow.locator(".badge", { hasText: "STAFF" })).toBeVisible();
    await expect(pendingRow.locator(".badge", { hasText: "PENDING" })).toBeVisible();

    // 5. Staff member accepts invitation in a clean browser context (no session bleed)
    const staffContext = await browser.newContext();
    const staffPage = await staffContext.newPage();

    try {
      await staffPage.goto(invitationUrl);
      await staffPage.waitForLoadState("domcontentloaded");

      // Verify invitation verification view
      await expect(staffPage.locator("h1:has-text('Store Team Invitation')")).toBeVisible({
        timeout: 20_000,
      });
      await expect(staffPage.locator(`text=${storeName}`)).toBeVisible();
      await expect(staffPage.locator(".badge", { hasText: "STAFF" })).toBeVisible();
      await expect(staffPage.locator(`text=${staffEmail}`)).toBeVisible();

      // Complete staff account registration form
      await staffPage.fill("#staff-name", "Alex Staff");
      await staffPage.fill("#staff-password", "StaffSecurePassword123!");
      await staffPage.fill("#staff-confirm-password", "StaffSecurePassword123!");

      await staffPage.click('button:has-text("Create Account & Join Store")');

      // Verify redirection to Merchant Dashboard
      await expect(staffPage).toHaveURL(/\/merchant/, { timeout: 30_000 });
      await expect(staffPage.locator("text=Welcome back, Alex Staff")).toBeVisible({ timeout: 20_000 });
      await expect(staffPage.locator("text=Role: STAFF").first()).toBeVisible({ timeout: 15_000 });

      // 6. Verify role-based restrictions in sidebar navigation
      // Staff cannot see Stores, Team and Members, or Settings navigation items
      const sidebar = staffPage.locator('aside[aria-label="Merchant Navigation"]');
      await expect(sidebar.locator('a:has-text("Team and Members")')).not.toBeVisible();
      await expect(sidebar.locator('a:has-text("Stores")')).not.toBeVisible();
      await expect(sidebar.locator('a:has-text("Settings")')).not.toBeVisible();

      // 7. Verify role-based restriction when staff navigates directly to /merchant/team
      await staffPage.goto("/merchant/team");
      await staffPage.waitForLoadState("domcontentloaded");

      // Verify Access restricted notice is displayed for staff
      await expect(
        staffPage.locator("text=Viewing and managing team members requires Admin or Owner permissions.")
      ).toBeVisible({ timeout: 15_000 });

      // Verify "+ Add Team Member" button is absent for staff
      await expect(staffPage.locator("button:has-text('+ Add Team Member')")).not.toBeVisible();

      // 8. Verify server-side authorization: Staff attempting to POST /api/v1/stores/{storeId}/invitations returns 403 Forbidden
      const storesRes = await staffPage.request.get("/api/v1/stores");
      const storesData = await storesRes.json();
      const storeId = storesData.data?.items?.[0]?.id || storesData.items?.[0]?.id;
      expect(storeId).toBeDefined();

      const forbiddenInviteRes = await staffPage.request.post(
        `/api/v1/stores/${storeId}/invitations`,
        {
          data: {
            email: uniqueEmail("unauthorized_staff"),
            role: "staff",
          },
        }
      );
      expect([403, 404]).toContain(forbiddenInviteRes.status());
    } finally {
      await staffContext.close();
    }
  });

  test("merchant owner revokes pending invitation, and revoked token is rejected upon access", async ({
    page,
    browser,
  }) => {
    const ownerEmail = uniqueEmail("vanguard_owner");
    const storeName = "Vanguard Retail";
    const storeSlug = uniqueSlug("vanguard");

    // 1. Register a merchant owner and onboard store
    await registerMerchant(page, {
      name: "Vanguard Owner",
      email: ownerEmail,
      password: "OwnerPassword123!",
    });

    await completeMerchantOnboarding(page, {
      orgName: "Vanguard Group",
      storeName,
      slug: storeSlug,
    });

    // 2. Navigate to Team page
    await page.goto("/merchant/team");
    await page.waitForLoadState("domcontentloaded");

    // 3. Issue an invitation
    await page.click("button:has-text('+ Add Team Member')");
    await page.click("button:has-text('Invite by Email')");

    const revokeStaffEmail = uniqueEmail("staff_to_revoke");
    await page.fill("#invite-email", revokeStaffEmail);
    await page.click("button:has-text('Create Invitation Link')");

    await expect(page.locator("text=Invitation Dispatched")).toBeVisible({ timeout: 15_000 });

    const linkInput = page.locator('input[readonly][value*="/merchant/invitations/accept?token="]');
    const invitationUrl = await linkInput.inputValue();

    await page.click("button:has-text('Done')");

    // 4. Verify invitation is pending in table
    const targetRow = page.locator("tr", { hasText: revokeStaffEmail });
    await expect(targetRow).toBeVisible({ timeout: 10_000 });
    await expect(targetRow.locator("text=PENDING")).toBeVisible();

    // 5. Owner clicks Revoke
    const revokeBtn = targetRow.locator('button:has-text("Revoke")');
    await expect(revokeBtn).toBeVisible();
    await revokeBtn.click();

    // 6. Verify invitation is removed from pending or status changes
    await expect(targetRow.locator('button:has-text("Revoke")')).not.toBeVisible({ timeout: 10_000 });

    // 7. In separate context, attempt to visit revoked invitation link
    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();

    try {
      await guestPage.goto(invitationUrl);
      await guestPage.waitForLoadState("domcontentloaded");

      // Verify rejection error banner is displayed
      await expect(guestPage.locator("text=Invalid Invitation")).toBeVisible({ timeout: 15_000 });
      await expect(guestPage.locator("#staff-password")).not.toBeVisible();
    } finally {
      await guestContext.close();
    }
  });

  test("tampered or invalid invitation token is gracefully rejected", async ({ page }) => {
    await page.goto("/merchant/invitations/accept?token=tampered_invalid_token_99999999");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator("text=Invalid Invitation")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("#staff-password")).not.toBeVisible();
  });
});
