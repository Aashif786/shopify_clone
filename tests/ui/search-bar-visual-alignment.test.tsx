import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";

describe("Search Bar Visual Alignment & CSS Specificity Protection", () => {
  it("protects pl-* and pr-* utilities in packages/ui/src/styles/components.css from being clobbered by .input", () => {
    const cssPath = path.resolve(process.cwd(), "packages/ui/src/styles/components.css");
    const content = fs.readFileSync(cssPath, "utf-8");
    expect(content).toContain('.input[class*="pl-"], input[class*="pl-"]');
    expect(content).toContain("padding-left: revert-layer;");
    expect(content).toContain("padding-block:");
    expect(content).toContain("padding-inline:");
  });

  it("protects pl-* and pr-* utilities in apps/web/app/merchant/merchant-theme.css", () => {
    const cssPath = path.resolve(process.cwd(), "apps/web/app/merchant/merchant-theme.css");
    const content = fs.readFileSync(cssPath, "utf-8");
    expect(content).toContain(".merchant-theme :is(.input, input)[class*=\"pl-\"]");
    expect(content).toContain("padding-left: revert-layer;");
    expect(content).toContain("padding-block:");
    expect(content).toContain("padding-inline:");
  });

  it("protects input padding utilities in apps/web/app/globals.css", () => {
    const cssPath = path.resolve(process.cwd(), "apps/web/app/globals.css");
    const content = fs.readFileSync(cssPath, "utf-8");
    expect(content).toContain(':is(input, .input)[class*="pl-10"] { padding-left: 2.5rem !important; }');
    expect(content).toContain(':is(input, .input)[class*="pl-9"] { padding-left: 2.25rem !important; }');
    expect(content).toContain(".storefront-layout .storefront-search-input");
    expect(content).toContain("padding-left: 2.5rem !important;");
  });

  it("protects input padding utilities in apps/platform-admin/app/globals.css", () => {
    const cssPath = path.resolve(process.cwd(), "apps/platform-admin/app/globals.css");
    const content = fs.readFileSync(cssPath, "utf-8");
    expect(content).toContain(':is(input, .input)[class*="pl-10"] { padding-left: 2.5rem !important; }');
  });

  it("verifies storefront CatalogFilterBar search bar has centered icon with pointer-events-none and ample left padding", () => {
    const filePath = path.resolve(process.cwd(), "apps/web/src/components/storefront/products/catalog-filter-bar.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("storefront-search-icon absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none");
    expect(content).toContain("!pl-10 !pr-9");
  });

  it("verifies merchant products search bar has centered icon with pointer-events-none and ample padding", () => {
    const filePath = path.resolve(process.cwd(), "apps/web/app/merchant/products/page.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("Search size={14} className=\"absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none\"");
    expect(content).toContain("!pl-10 !pr-8");
  });

  it("verifies collection list table search bar has centered icon with pointer-events-none and ample padding", () => {
    const filePath = path.resolve(process.cwd(), "apps/web/src/components/merchant/collections/collection-list-table.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("Search className=\"absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none\"");
    expect(content).toContain("!pl-10 !pr-8");
  });

  it("verifies newsletter subscribers search bar has centered icon with pointer-events-none and ample padding", () => {
    const filePath = path.resolve(process.cwd(), "apps/web/src/components/merchant/customers/newsletter-subscribers-view.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("Search className=\"w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none\"");
    expect(content).toContain("!pl-10 !pr-8");
  });

  it("verifies product inventory panel variant search bar has centered icon with pointer-events-none and ample padding", () => {
    const filePath = path.resolve(process.cwd(), "apps/web/src/components/merchant/inventory/product-inventory-panel.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("Search className=\"w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none\"");
    expect(content).toContain("!pl-10 !pr-8");
  });

  it("verifies platform admin search bars have centered icons with pointer-events-none and ample padding", () => {
    const files = [
      "apps/platform-admin/app/audit-logs/page.tsx",
      "apps/platform-admin/app/merchants/page.tsx",
      "apps/platform-admin/app/payments/page.tsx",
      "apps/platform-admin/app/stores/page.tsx",
      "apps/platform-admin/app/tenants/page.tsx",
    ];

    for (const f of files) {
      const content = fs.readFileSync(path.resolve(process.cwd(), f), "utf-8");
      expect(content).toContain("Search className=\"absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none\"");
      expect(content).toContain("!pl-10 pr-4");
    }
  });
});
