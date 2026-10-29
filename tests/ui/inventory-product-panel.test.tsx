import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  groupInventoryByProduct,
  type InventoryVariantItem,
} from "@/lib/merchant-inventory-helpers";
import { ProductInventoryPanel } from "@/components/merchant/inventory/product-inventory-panel";
import { InventoryTable } from "@/components/merchant/inventory/inventory-table";

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children, open }: { children: React.ReactNode; open?: boolean }) =>
    open ? <div data-slot="sheet">{children}</div> : null,
  SheetContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-slot="sheet-content" className={className}>
      {children}
    </div>
  ),
  SheetHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-slot="sheet-header" className={className}>
      {children}
    </div>
  ),
  SheetTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 data-slot="sheet-title" className={className}>
      {children}
    </h2>
  ),
  SheetDescription: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <p data-slot="sheet-description" className={className}>
      {children}
    </p>
  ),
}));

const mockMultiVariantProduct: InventoryVariantItem[] = [
  {
    variantId: "v_1",
    productId: "prod_jacket",
    productTitle: "All-Weather Technical Parka",
    productSlug: "technical-parka",
    variantTitle: "Black / Small",
    sku: "AWP-BLK-S",
    price: 18900,
    currency: "USD",
    availableQuantity: 12,
    reservedQuantity: 2,
    totalQuantity: 14,
    isInitialized: true,
    inventoryItemId: "inv_1",
  },
  {
    variantId: "v_2",
    productId: "prod_jacket",
    productTitle: "All-Weather Technical Parka",
    productSlug: "technical-parka",
    variantTitle: "Black / Medium",
    sku: "AWP-BLK-M",
    price: 18900,
    currency: "USD",
    availableQuantity: 4, // low stock
    reservedQuantity: 1,
    totalQuantity: 5,
    isInitialized: true,
    inventoryItemId: "inv_2",
  },
  {
    variantId: "v_3",
    productId: "prod_jacket",
    productTitle: "All-Weather Technical Parka",
    productSlug: "technical-parka",
    variantTitle: "Olive / Large",
    sku: "AWP-OLV-L",
    price: 18900,
    currency: "USD",
    availableQuantity: 0, // out of stock
    reservedQuantity: 0,
    totalQuantity: 0,
    isInitialized: true,
    inventoryItemId: "inv_3",
  },
];

const mockSingleVariantProduct: InventoryVariantItem[] = [
  {
    variantId: "v_4",
    productId: "prod_cap",
    productTitle: "Merino Wool Beanie",
    productSlug: "wool-beanie",
    variantTitle: "Charcoal / One Size",
    sku: "MWB-CHC-OS",
    price: 3200,
    currency: "USD",
    availableQuantity: 35,
    reservedQuantity: 0,
    totalQuantity: 35,
    isInitialized: true,
    inventoryItemId: "inv_4",
  },
];

describe("Product Inventory Grouping Logic", () => {
  it("correctly groups items by product with total available and reserved", () => {
    const allItems = [...mockMultiVariantProduct, ...mockSingleVariantProduct];
    const groups = groupInventoryByProduct(allItems);

    expect(groups).toHaveLength(2);

    const parka = groups.find((g) => g.productId === "prod_jacket");
    expect(parka).toBeDefined();
    expect(parka?.totalVariants).toBe(3);
    expect(parka?.totalAvailable).toBe(16); // 12 + 4 + 0
    expect(parka?.totalReserved).toBe(3); // 2 + 1 + 0
    expect(parka?.totalQuantity).toBe(19); // 14 + 5 + 0
    expect(parka?.lowStockCount).toBe(1);
    expect(parka?.outOfStockCount).toBe(1);
    expect(parka?.status).toBe("low_stock");
    expect(parka?.skuSummary).toBe("AWP-BLK-S (+2 more)");

    const beanie = groups.find((g) => g.productId === "prod_cap");
    expect(beanie).toBeDefined();
    expect(beanie?.totalVariants).toBe(1);
    expect(beanie?.totalAvailable).toBe(35);
    expect(beanie?.totalReserved).toBe(0);
    expect(beanie?.status).toBe("in_stock");
    expect(beanie?.skuSummary).toBe("MWB-CHC-OS");
  });

  it("marks product as out_of_stock when total available is zero", () => {
    const outOfStockItems: InventoryVariantItem[] = [
      {
        ...mockMultiVariantProduct[2],
        variantId: "v_oos_1",
      },
    ];
    const groups = groupInventoryByProduct(outOfStockItems);
    expect(groups[0]?.status).toBe("out_of_stock");
  });
});

describe("Compact InventoryTable Layout & Interactions", () => {
  const dummyFn = vi.fn();

  it("renders exactly 1 row per product instead of 1 row per variant", () => {
    const allItems = [...mockMultiVariantProduct, ...mockSingleVariantProduct];
    const html = renderToStaticMarkup(
      <InventoryTable
        items={allItems}
        storeId="store_test_1"
        onAdjustStock={dummyFn}
        onViewHistory={dummyFn}
        canManage={true}
      />,
    );

    // Should display 2 products
    expect(html).toContain("Tracked Products");
    expect(html).toContain("4 Tracked Variants");
    expect(html).toContain("All-Weather Technical Parka");
    expect(html).toContain("Merino Wool Beanie");

    // Table rows should contain "Manage inventory" button with aria-label
    expect(html).toContain('aria-label="Manage inventory for All-Weather Technical Parka"');
    expect(html).toContain('aria-label="Manage inventory for Merino Wool Beanie"');

    // Row has keyboard attributes
    expect(html).toContain('role="button"');
    expect(html).toContain('tabindex="0"');
  });

  it("renders status badges and aggregated stock accurately on product rows", () => {
    const html = renderToStaticMarkup(
      <InventoryTable
        items={mockMultiVariantProduct}
        storeId="store_test_1"
        onAdjustStock={dummyFn}
        onViewHistory={dummyFn}
        canManage={true}
      />,
    );

    // Parka has 1 low stock and 1 out of stock variant => Low Stock (2)
    expect(html).toContain("Low Stock (2)");
    // Total available: 16
    expect(html).toContain(">16<");
    // Reserved: 3
    expect(html).toContain(">3<");
    // Total on-hand: 19
    expect(html).toContain(">19<");
  });
});

describe("ProductInventoryPanel Side Drawer Component", () => {
  const dummyFn = vi.fn();

  it("renders panel header with product title, slug, thumbnail, and KPI bar", () => {
    const groups = groupInventoryByProduct(mockMultiVariantProduct);
    const parkaGroup = groups[0]!;

    const html = renderToStaticMarkup(
      <ProductInventoryPanel
        isOpen={true}
        onClose={dummyFn}
        storeId="store_test_1"
        productGroup={parkaGroup}
        onAdjustSuccess={dummyFn}
        onOpenAdvancedAdjust={dummyFn}
        onOpenHistory={dummyFn}
        canManage={true}
      />,
    );

    expect(html).toContain("All-Weather Technical Parka");
    expect(html).toContain("/technical-parka");
    expect(html).toContain("3 variants");
    expect(html).toContain("Available");
    expect(html).toContain("Reserved");
    expect(html).toContain("On-Hand");
    expect(html).toContain("aria-label=\"Close inventory panel\"");
  });

  it("renders compact collapsed variant rows for fast scanning", () => {
    const groups = groupInventoryByProduct(mockMultiVariantProduct);
    const parkaGroup = groups[0]!;

    const html = renderToStaticMarkup(
      <ProductInventoryPanel
        isOpen={true}
        onClose={dummyFn}
        storeId="store_test_1"
        productGroup={parkaGroup}
        onAdjustSuccess={dummyFn}
        onOpenAdvancedAdjust={dummyFn}
        onOpenHistory={dummyFn}
        canManage={true}
      />,
    );

    // Collapsed rows display variant titles, SKUs, and quick Adjust triggers
    expect(html).toContain("Black / Small");
    expect(html).toContain("AWP-BLK-S");
    expect(html).toContain("Copy SKU AWP-BLK-S");
    expect(html).toContain("Adjust...");
    expect(html).toContain("Black / Medium");
    expect(html).toContain("AWP-BLK-M");
    expect(html).toContain("Olive / Large");
    expect(html).toContain("AWP-OLV-L");

    // SKU text must not be rendered as visible text anywhere in the variant row
    expect(html).not.toContain(">AWP-BLK-S<");
    expect(html).not.toContain(">AWP-BLK-M<");
    expect(html).not.toContain(">AWP-OLV-L<");
  });

  it("renders variant list with option titles, SKUs, and stock steppers when expanded", () => {
    const groups = groupInventoryByProduct(mockMultiVariantProduct);
    const parkaGroup = groups[0]!;

    const html = renderToStaticMarkup(
      <ProductInventoryPanel
        isOpen={true}
        onClose={dummyFn}
        storeId="store_test_1"
        productGroup={parkaGroup}
        onAdjustSuccess={dummyFn}
        onOpenAdvancedAdjust={dummyFn}
        onOpenHistory={dummyFn}
        canManage={true}
        initialEditingVariantId="v_1"
      />,
    );

    // Variant 1
    expect(html).toContain("Black / Small");
    expect(html).toContain("AWP-BLK-S");
    expect(html).toContain("aria-label=\"Available quantity for Black / Small\"");
    expect(html).toContain("aria-label=\"Increase available stock for Black / Small\"");
    expect(html).toContain("aria-label=\"Decrease available stock for Black / Small\"");

    // Variant 2
    expect(html).toContain("Black / Medium");
    expect(html).toContain("AWP-BLK-M");
    expect(html).toContain("Low Stock (4)");

    // Variant 3
    expect(html).toContain("Olive / Large");
    expect(html).toContain("AWP-OLV-L");
    expect(html).toContain("Out of Stock");

    // Secondary action buttons
    expect(html).toContain("aria-label=\"Detailed adjustment for Black / Small\"");
    expect(html).toContain("aria-label=\"Audit history for Black / Small\"");
  });

  it("renders search input when product has multiple variants", () => {
    const groups = groupInventoryByProduct(mockMultiVariantProduct);
    const parkaGroup = groups[0]!;

    const html = renderToStaticMarkup(
      <ProductInventoryPanel
        isOpen={true}
        onClose={dummyFn}
        storeId="store_test_1"
        productGroup={parkaGroup}
        onAdjustSuccess={dummyFn}
        onOpenAdvancedAdjust={dummyFn}
        onOpenHistory={dummyFn}
        canManage={true}
      />,
    );

    expect(html).toContain("Filter variants by name or SKU...");
    expect(html).toContain("aria-label=\"Filter variants in product\"");
  });

  it("does not show variant search when product has only 1 variant", () => {
    const groups = groupInventoryByProduct(mockSingleVariantProduct);
    const beanieGroup = groups[0]!;

    const html = renderToStaticMarkup(
      <ProductInventoryPanel
        isOpen={true}
        onClose={dummyFn}
        storeId="store_test_1"
        productGroup={beanieGroup}
        onAdjustSuccess={dummyFn}
        onOpenAdvancedAdjust={dummyFn}
        onOpenHistory={dummyFn}
        canManage={true}
      />,
    );

    expect(html).not.toContain("Filter variants by name or SKU...");
  });

  it("renders footer with Done button when no changes are dirty", () => {
    const groups = groupInventoryByProduct(mockMultiVariantProduct);
    const parkaGroup = groups[0]!;

    const html = renderToStaticMarkup(
      <ProductInventoryPanel
        isOpen={true}
        onClose={dummyFn}
        storeId="store_test_1"
        productGroup={parkaGroup}
        onAdjustSuccess={dummyFn}
        onOpenAdvancedAdjust={dummyFn}
        onOpenHistory={dummyFn}
        canManage={true}
      />,
    );

    expect(html).toContain("All changes saved. Press");
    expect(html).toContain("Esc");
    expect(html).toContain("Done");
  });

  it("maintains clean three-part layout structure with long variant names, large numbers, and no visible SKU", () => {
    const customGroup: ProductInventoryGroup = {
      productId: "prod_custom",
      productTitle: "Heavyweight Artisan Wool Overshirt",
      productSlug: "heavyweight-artisan-wool-overshirt",
      totalVariants: 1,
      totalAvailable: 1250,
      totalReserved: 45,
      totalQuantity: 1295,
      status: "in_stock",
      skuSummary: "ART-OVR-XXXL",
      variants: [
        {
          variantId: "v_custom_long",
          productId: "prod_custom",
          variantTitle: "XXXL / Midnight Heather Navy / Extra Heavyweight Organic Egyptian Cotton",
          sku: "ART-OVR-XXXL",
          price: 18500,
          currency: "USD",
          availableQuantity: 1250,
          reservedQuantity: 45,
          totalQuantity: 1295,
          isInitialized: true,
        },
      ],
    };

    const html = renderToStaticMarkup(
      <ProductInventoryPanel
        isOpen={true}
        onClose={dummyFn}
        storeId="store_test_1"
        productGroup={customGroup}
        onAdjustSuccess={dummyFn}
        onOpenAdvancedAdjust={dummyFn}
        onOpenHistory={dummyFn}
        canManage={true}
      />,
    );

    // Left section: Title with title tooltip attribute, status badge, price, copy SKU
    expect(html).toContain("title=\"XXXL / Midnight Heather Navy / Extra Heavyweight Organic Egyptian Cotton\"");
    expect(html).toContain("In Stock");
    expect(html).toContain("$185.00 USD");
    expect(html).toContain("aria-label=\"Copy SKU ART-OVR-XXXL\"");

    // Middle section: Large 4-digit available quantity & consistent uppercase Available label
    expect(html).toContain(">1250<");
    expect(html).toContain("Available");

    // Right section: Fixed-width Adjust button and History icon
    expect(html).toContain("Adjust...");
    expect(html).toContain("aria-label=\"Adjust stock for XXXL / Midnight Heather Navy / Extra Heavyweight Organic Egyptian Cotton\"");
    expect(html).toContain("aria-label=\"Audit history for XXXL / Midnight Heather Navy / Extra Heavyweight Organic Egyptian Cotton\"");

    // Strict requirement: SKU is never rendered as visible text
    expect(html).not.toContain(">ART-OVR-XXXL<");
  });
});
