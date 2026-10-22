import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MerchantShell, type StoreOption } from "@/components/merchant/MerchantShell";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/merchant",
}));

describe("Merchant Store Switcher UI Component", () => {
  const storeA: StoreOption = {
    id: "store_1",
    name: "Artisan Crafts",
    slug: "artisan-crafts",
    role: "owner",
    status: "ACTIVE",
  };

  const storeB: StoreOption = {
    id: "store_2",
    name: "Souled Apparel",
    slug: "souled-apparel",
    role: "staff",
    status: "ACTIVE",
  };

  const draftStore: StoreOption = {
    id: "store_3",
    name: "Draft Botanicals",
    slug: "draft-botanicals",
    role: "admin",
    status: "DRAFT",
  };

  it("renders multiple stores with a store selection dropdown and role indicators", () => {
    const html = renderToStaticMarkup(
      <MerchantShell
        currentStore={storeA}
        stores={[storeA, storeB, draftStore]}
        userRole="owner"
        userName="Alice Owner"
      >
        <div>Dashboard Content</div>
      </MerchantShell>
    );

    // Verify select element and options exist
    expect(html).toContain('id="merchant-store-select"');
    expect(html).toContain("Artisan Crafts (OWNER)");
    expect(html).toContain("Souled Apparel (STAFF)");
    expect(html).toContain("Draft Botanicals (ADMIN)");

    // Verify active store role badge
    expect(html).toContain("OWNER");
    // Verify user name
    expect(html).toContain("Alice Owner");
    // Verify content rendered
    expect(html).toContain("Dashboard Content");
  });

  it("renders single-store state cleanly with store name and role badge", () => {
    const html = renderToStaticMarkup(
      <MerchantShell
        currentStore={storeA}
        stores={[storeA]}
        userRole="owner"
        userName="Solo Owner"
      >
        <div>Single Store Content</div>
      </MerchantShell>
    );

    // Should not render select dropdown for single store
    expect(html).not.toContain('id="merchant-store-select"');
    // Shows store name and role
    expect(html).toContain("Artisan Crafts");
    expect(html).toContain("OWNER");
    // Shows "+ New Store" link for owners
    expect(html).toContain("+ New Store");
    expect(html).toContain("/merchant/stores/new");
  });

  it("renders draft status badge when current store is in DRAFT status", () => {
    const html = renderToStaticMarkup(
      <MerchantShell
        currentStore={draftStore}
        stores={[storeA, draftStore]}
        userRole="admin"
        userName="Bob Admin"
      >
        <div>Draft Store Content</div>
      </MerchantShell>
    );

    expect(html).toContain("Draft");
    expect(html).toContain("ADMIN");
  });

  it("renders empty state gracefully when user has no authorized stores", () => {
    const html = renderToStaticMarkup(
      <MerchantShell
        currentStore={null}
        stores={[]}
        userRole="staff"
        userName="New Merchant"
      >
        <div>No Stores Welcome View</div>
      </MerchantShell>
    );

    // Shows no store selected badge and create store CTA
    expect(html).toContain("No Store Selected");
    expect(html).toContain("+ Create Store");
    expect(html).toContain("/merchant/stores/new");
  });

  it("filters navigation items based on the active store role", () => {
    // When role is staff, Settings and Stores should be hidden
    const staffHtml = renderToStaticMarkup(
      <MerchantShell
        currentStore={storeB}
        stores={[storeA, storeB]}
        userRole="staff"
      >
        <div>Staff View</div>
      </MerchantShell>
    );

    // Overview, Products, Inventory, Orders should be visible
    expect(staffHtml).toContain("Overview");
    expect(staffHtml).toContain("Products");
    expect(staffHtml).toContain("Inventory");
    expect(staffHtml).toContain("Orders");

    // Admin/owner-only nav items should be hidden for staff
    expect(staffHtml).not.toContain('href="/merchant/settings"');
    expect(staffHtml).not.toContain('href="/merchant/stores"');
    expect(staffHtml).not.toContain('href="/merchant/team"');

    // When role is owner, all nav items are visible
    const ownerHtml = renderToStaticMarkup(
      <MerchantShell
        currentStore={storeA}
        stores={[storeA, storeB]}
        userRole="owner"
      >
        <div>Owner View</div>
      </MerchantShell>
    );

    expect(ownerHtml).toContain('href="/merchant/settings"');
    expect(ownerHtml).toContain('href="/merchant/team"');
    expect(ownerHtml).toContain('href="/merchant/stores"');
  });
});
