import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Spinner, Alert } from "@calcart/ui";
import { StorefrontShell } from "../../apps/web/src/components/storefront/StorefrontShell";
import { ProductGrid } from "../../apps/web/src/components/storefront/products/product-grid";
import { ProductDetailView } from "../../apps/web/src/components/storefront/products/product-detail-view";
import { CartDrawer } from "../../apps/web/src/components/storefront/cart/cart-drawer";
import { CheckoutSteps } from "../../apps/web/src/components/storefront/checkout/checkout-steps";
import { CustomerInformationForm } from "../../apps/web/src/components/storefront/checkout/customer-information-form";
import { ShippingAddressForm } from "../../apps/web/src/components/storefront/checkout/shipping-address-form";
import { DeliveryMethodSelector } from "../../apps/web/src/components/storefront/checkout/delivery-method-selector";
import { CheckoutSummary } from "../../apps/web/src/components/storefront/checkout/checkout-summary";
import { PaymentSection } from "../../apps/web/src/components/storefront/checkout/payment-section";
import { OrderConfirmation } from "@/components/storefront/orders/order-confirmation";
import { MerchantShell } from "../../apps/web/src/components/merchant/MerchantShell";
import { StoreForm } from "../../apps/web/src/components/merchant/stores/store-form";
import { StoreSettingsForm } from "../../apps/web/src/components/merchant/settings/store-settings-form";
import { AuthProvider } from "../../apps/web/src/context/auth-context";
import { StoreProvider } from "../../apps/web/src/context/store-context";
import { InventoryTable } from "@/components/merchant/inventory/inventory-table";
import { StockAdjustmentDialog } from "@/components/merchant/inventory/stock-adjustment-dialog";
import { OrderListTable } from "@/components/merchant/orders/order-list-table";
import { OrderDetailsView } from "@/components/merchant/orders/order-details-view";
import { OrderCancelDialog } from "@/components/merchant/orders/order-cancel-dialog";
import { CustomerListTable } from "@/components/merchant/customers/customer-list-table";
import { CustomerDetailsView } from "@/components/merchant/customers/customer-details-view";
import { MembersTable } from "@/components/merchant/team/members-table";
import { AddMemberDialog } from "@/components/merchant/team/add-member-dialog";
import type { ProductSummaryDTO, ProductDetailDTO } from "@calcart/products";
import type { CartDTO } from "@calcart/carts";
import type { StorefrontCheckoutDTO } from "../../apps/web/src/lib/storefront-checkout-helpers";
import type { OrderDTO } from "@calcart/orders";
import type { CustomerSummaryDTO, CustomerDetailDTO } from "@calcart/customers";
import type { StoreMemberDTO, StoreDTO } from "@calcart/stores";
import type { InventoryItemDTO } from "@calcart/inventory";

describe("Milestone C5 Browser-Level Smoke Tests: Storefront User Experience", () => {
  const sampleProduct: ProductSummaryDTO = {
    id: "prod_ceramic_teapot",
    storeId: "store_artisan",
    title: "Handcrafted Ceramic Teapot",
    slug: "ceramic-teapot",
    status: "ACTIVE",
    price: 10000,
    currency: "USD",
    variantsCount: 1,
    mediaCount: 1,
    primaryMediaUrl: "/images/teapot.jpg",
    primaryMediaAlt: "Handmade ceramic teapot",
    createdAt: "2026-10-10T00:00:00Z",
    updatedAt: "2026-10-10T00:00:00Z",
  };

  const sampleProductDetail: ProductDetailDTO = {
    ...sampleProduct,
    description: "Artisanal stoneware teapot with heat-resistant bamboo handle.",
    variants: [
      {
        id: "var_blue_1",
        productId: "prod_ceramic_teapot",
        title: "Cobalt Blue",
        sku: "TP-BLU-01",
        price: 10000,
        currency: "USD",
        status: "ACTIVE",
        options: {},
        inventoryQuantity: 25,
        isInStock: true,
        createdAt: "2026-10-10T00:00:00Z",
        updatedAt: "2026-10-10T00:00:00Z",
      },
      {
        id: "var_red_2",
        productId: "prod_ceramic_teapot",
        title: "Terracotta Red",
        sku: "TP-RED-02",
        price: 10500,
        currency: "USD",
        status: "ACTIVE",
        options: {},
        inventoryQuantity: 15,
        isInStock: true,
        createdAt: "2026-10-10T00:00:00Z",
        updatedAt: "2026-10-10T00:00:00Z",
      },
    ],
    media: [
      {
        id: "med_1",
        productId: "prod_ceramic_teapot",
        url: "/images/teapot.jpg",
        altText: "Handmade ceramic teapot",
        position: 0,
      },
    ],
  };

  it("1.1 Storefront Homepage and Catalog: renders branding, navigation, products, and prices", () => {
    const html = renderToStaticMarkup(
      <StorefrontShell
        storeName="Demo Artisan Store"
        storeSlug="artisan-store"
        cartItemCount={1}
        announcement="Free shipping on orders over $50 with code WELCOME20"
      >
        <ProductGrid
          products={[sampleProduct]}
          storeSlug="artisan-store"
          storeCurrency="USD"
          isLoading={false}
          error={null}
        />
      </StorefrontShell>,
    );

    expect(html).toContain("Demo Artisan Store");
    expect(html).toContain("Free shipping on orders over $50 with code WELCOME20");
    expect(html).toContain("Handcrafted Ceramic Teapot");
    expect(html).toContain("$100.00");
    expect(html).toContain("/stores/artisan-store/products/ceramic-teapot");
    expect(html).toContain("Cart");
    expect(html).toContain("1"); // cart count badge
  });

  it("1.2 Storefront Product Details: renders variants, inventory status, description, and action button", () => {
    const html = renderToStaticMarkup(
      <ProductDetailView
        product={sampleProductDetail}
        storeSlug="artisan-store"
        storeName="Demo Artisan Store"
        storeCurrency="USD"
      />,
    );

    expect(html).toContain("Handcrafted Ceramic Teapot");
    expect(html).toContain("TP-BLU-01");
    expect(html).toContain("Cobalt Blue");
    expect(html).toContain("$100.00");
    expect(html).toContain("In Stock");
    expect(html).toContain("Add to Cart");
  });

  it("1.3 Storefront Cart Drawer: renders cart items, quantity, subtotal, and checkout link", () => {
    const cart: CartDTO = {
      id: "cart_demo_1",
      storeId: "store_artisan",
      currency: "USD",
      status: "ACTIVE",
      subtotal: 10000,
      discountTotal: 2000,
      total: 8000,
      itemCount: 1,
      createdAt: "2026-10-10T00:00:00Z",
      updatedAt: "2026-10-10T00:00:00Z",
      items: [
        {
          id: "item_1",
          cartId: "cart_demo_1",
          storeId: "store_artisan",
          variantId: "var_blue_1",
          quantity: 1,
          unitPrice: 10000,
          totalPrice: 10000,
          productTitle: "Handcrafted Ceramic Teapot",
          variantTitle: "Cobalt Blue",
          sku: "TP-BLU-01",
          imageUrl: "/images/teapot.jpg",
          createdAt: "2026-10-10T00:00:00Z",
          updatedAt: "2026-10-10T00:00:00Z",
        },
      ],
    };

    const html = renderToStaticMarkup(
      <CartDrawer
        isOpen={true}
        onClose={vi.fn()}
        cart={cart}
        storeSlug="artisan-store"
        onUpdateQuantity={vi.fn()}
        onRemoveItem={vi.fn()}
        isUpdating={false}
      />,
    );

    expect(html).toContain("Handcrafted Ceramic Teapot");
    expect(html).toContain("Cobalt Blue");
    expect(html).toContain("$100.00");
    expect(html).toContain("Subtotal");
    expect(html).toContain("/stores/artisan-store/checkout");
  });

  it("1.4 Storefront Checkout Flow: renders 4-step stepper, forms, summary, and payment section", () => {
    const checkout: StorefrontCheckoutDTO = {
      id: "chk_demo_123",
      storeId: "store_artisan",
      cartId: "cart_demo_1",
      currency: "USD",
      status: "OPEN",
      paymentStatus: "PENDING",
      email: "buyer@example.com",
      shippingAddress: {
        firstName: "Jane",
        lastName: "Doe",
        addressLine1: "123 Artisan Way",
        city: "Seattle",
        state: "WA",
        postalCode: "98101",
        country: "US",
        phone: "+12065550199",
      },
      items: [
        {
          id: "item_1",
          checkoutId: "chk_demo_123",
          variantId: "var_blue_1",
          productNameSnapshot: "Handcrafted Ceramic Teapot",
          variantNameSnapshot: "Cobalt Blue",
          skuSnapshot: "TP-BLU-01",
          unitPrice: 10000,
          quantity: 1,
          lineTotal: 10000,
        },
      ],
      subtotal: 10000,
      discountTotal: 2000,
      shippingTotal: 0,
      taxTotal: 0,
      total: 8000,
      createdAt: "2026-10-10T00:00:00Z",
      updatedAt: "2026-10-10T00:00:00Z",
    };

    // Test Stepper
    const stepperHtml = renderToStaticMarkup(
      <CheckoutSteps
        currentStep="payment"
        completedSteps={["information", "shipping", "delivery"]}
      />,
    );
    expect(stepperHtml).toContain("Information");
    expect(stepperHtml).toContain("Shipping");
    expect(stepperHtml).toContain("Delivery");
    expect(stepperHtml).toContain("Payment");

    // Test Customer Info Form
    const infoHtml = renderToStaticMarkup(
      <CustomerInformationForm
        initialEmail="buyer@example.com"
        onSubmit={vi.fn()}
        isSubmitting={false}
      />,
    );
    expect(infoHtml).toContain("buyer@example.com");

    // Test Shipping Address Form
    const addressHtml = renderToStaticMarkup(
      <ShippingAddressForm
        initialAddress={checkout.shippingAddress}
        onSubmit={vi.fn()}
        isSubmitting={false}
      />,
    );
    expect(addressHtml).toContain("123 Artisan Way");
    expect(addressHtml).toContain("Seattle");
    expect(addressHtml).toContain("98101");

    // Test Delivery Method Selector
    const deliveryHtml = renderToStaticMarkup(
      <DeliveryMethodSelector
        shippingTotal={0}
        onSubmit={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(deliveryHtml).toContain("Standard Store Delivery");

    // Test Checkout Summary
    const summaryHtml = renderToStaticMarkup(
      <CheckoutSummary
        checkout={checkout}
        storeSlug="artisan-store"
      />,
    );
    expect(summaryHtml).toContain("Handcrafted Ceramic Teapot");
    expect(summaryHtml).toContain("$100.00");
    expect(summaryHtml).toContain("-$20.00"); // discount reflection
    expect(summaryHtml).toContain("$80.00"); // final total

    // Test Payment Section
    const paymentHtml = renderToStaticMarkup(
      <PaymentSection
        checkout={checkout}
        storeSlug="artisan-store"
        storeName="Demo Artisan Store"
        onPaymentVerified={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(paymentHtml).toContain("Razorpay Secure Checkout");
    expect(paymentHtml).toContain("Pay $80.00");
  });

  it("1.5 Storefront Order Confirmation: renders confirmed order number, items, and success state", () => {
    const confirmedOrder: OrderDTO = {
      id: "ord_demo_999",
      storeId: "store_artisan",
      orderNumber: "1001",
      customerId: "cust_demo_1",
      checkoutId: "chk_demo_123",
      paymentId: "pay_rzp_demo",
      status: "CONFIRMED",
      paymentStatus: "PAID",
      fulfillmentStatus: "UNFULFILLED",
      currency: "USD",
      subtotal: 10000,
      discountTotal: 2000,
      shippingTotal: 0,
      taxTotal: 0,
      total: 8000,
      grandTotal: 8000,
      cancelledAt: null,
      cancelReason: null,
      completedAt: null,
      createdAt: "2026-10-10T12:00:00Z",
      updatedAt: "2026-10-10T12:05:00Z",
      items: [
        {
          id: "item_1",
          orderId: "ord_demo_999",
          storeId: "store_artisan",
          productId: "prod_ceramic_teapot",
          variantId: "var_blue_1",
          productNameSnapshot: "Handcrafted Ceramic Teapot",
          variantNameSnapshot: "Cobalt Blue",
          skuSnapshot: "TP-BLU-01",
          quantity: 1,
          unitPrice: 10000,
          lineTotal: 10000,
          currency: "USD",
          createdAt: "2026-10-10T12:00:00Z",
          updatedAt: "2026-10-10T12:00:00Z",
        },
      ],
    };

    const html = renderToStaticMarkup(
      <OrderConfirmation
        order={confirmedOrder}
        storeSlug="artisan-store"
        storeName="Demo Artisan Store"
      />,
    );

    expect(html).toContain("Thank You for Your Order!");
    expect(html).toContain("1001");
    expect(html).toContain("Handcrafted Ceramic Teapot");
    expect(html).toContain("$80.00");
    expect(html).toContain("Paid");
  });
});

describe("Milestone C5 Browser-Level Smoke Tests: Merchant Administration & Multi-Tenancy", () => {
  const currentStore: StoreDTO = {
    id: "01a12fda-c38b-7000-ac2e-0225e15ad563",
    organizationId: "org_demo_1",
    name: "Demo Artisan Store",
    slug: "artisan-store",
    status: "ACTIVE",
    currency: "USD",
    locale: "en-US",
    timezone: "America/New_York",
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
  };

  const secondaryStore: StoreDTO = {
    id: "01a12fda-c38b-7000-ac2e-0225e15ad564",
    organizationId: "org_demo_1",
    name: "Alpine Outfitters",
    slug: "alpine-outfitters",
    status: "ACTIVE",
    currency: "USD",
    locale: "en-US",
    timezone: "America/Denver",
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
  };

  it("2.1 Merchant Shell Navigation: renders authorized links and hides restricted routes for staff role", () => {
    // Owner view: see all navigation items
    const ownerHtml = renderToStaticMarkup(
      <MerchantShell
        activePath="/merchant"
        currentStore={currentStore}
        stores={[currentStore, secondaryStore]}
        onSelectStore={vi.fn()}
        userRole="owner"
        userName="Demo Merchant"
        userEmail="merchant@example.com"
        title="Merchant Dashboard"
      >
        <div>Dashboard Content</div>
      </MerchantShell>,
    );

    expect(ownerHtml).toContain("Overview");
    expect(ownerHtml).toContain("Products");
    expect(ownerHtml).toContain("Inventory");
    expect(ownerHtml).toContain("Discounts");
    expect(ownerHtml).toContain("Orders");
    expect(ownerHtml).toContain("Customers");
    expect(ownerHtml).toContain("Stores");
    expect(ownerHtml).toContain("Team");
    expect(ownerHtml).toContain("Settings");
    expect(ownerHtml).toContain("Demo Merchant");

    // Staff view: Stores, Team, and Settings should be hidden by minRole restriction
    const staffHtml = renderToStaticMarkup(
      <MerchantShell
        activePath="/merchant"
        currentStore={currentStore}
        stores={[currentStore]}
        onSelectStore={vi.fn()}
        userRole="staff"
        userName="Staff Member"
        userEmail="staff@example.com"
        title="Merchant Dashboard"
      >
        <div>Dashboard Content</div>
      </MerchantShell>,
    );

    expect(staffHtml).toContain("Products");
    expect(staffHtml).toContain("Orders");
    expect(staffHtml).not.toContain('href="/merchant/stores"');
    expect(staffHtml).not.toContain('href="/merchant/team"');
    expect(staffHtml).not.toContain('href="/merchant/settings"');
  });

  it("2.2 Store Selector & Store Creation: renders multi-store list and creation form with validation", () => {
    // Store Selector in Merchant Shell
    const shellHtml = renderToStaticMarkup(
      <MerchantShell
        activePath="/merchant"
        currentStore={currentStore}
        stores={[currentStore, secondaryStore]}
        onSelectStore={vi.fn()}
      >
        <div>Content</div>
      </MerchantShell>,
    );
    expect(shellHtml).toContain("merchant-store-select");
    expect(shellHtml).toContain("Demo Artisan Store");
    expect(shellHtml).toContain("Alpine Outfitters");

    // Store Creation Form with Auth & Store Context
    const formHtml = renderToStaticMarkup(
      <AuthProvider initialUser={{ id: "user_owner_1", email: "merchant@example.com", name: "Demo Merchant", status: "ACTIVE" }}>
        <StoreProvider initialStores={[currentStore]}>
          <StoreForm />
        </StoreProvider>
      </AuthProvider>,
    );
    expect(formHtml).toContain("Store Name");
    expect(formHtml).toContain("Storefront Slug");
    expect(formHtml).toContain("Currency");
    expect(formHtml).toContain("Create Store");
  });

  it("2.3 Store Settings Management: renders lifecycle state controls and currency configurations", () => {
    const settingsHtml = renderToStaticMarkup(
      <StoreSettingsForm
        store={currentStore}
      />,
    );

    expect(settingsHtml).toContain("Demo Artisan Store");
    expect(settingsHtml).toContain("artisan-store");
    expect(settingsHtml).toContain("America/New_York");
    expect(settingsHtml).toContain("Save Settings");
  });

  it("2.4 Merchant Inventory Management: renders stock quantities, variant SKUs, and adjustment modal", () => {
    const inventoryItems: InventoryItemDTO[] = [
      {
        id: "inv_1",
        storeId: currentStore.id,
        variantId: "var_blue_1",
        variantTitle: "Cobalt Blue",
        productTitle: "Handcrafted Ceramic Teapot",
        sku: "TP-BLU-01",
        availableQuantity: 25,
        reservedQuantity: 0,
        totalQuantity: 25,
        status: "IN_STOCK",
        createdAt: "2026-10-10T00:00:00Z",
        updatedAt: "2026-10-10T00:00:00Z",
      },
    ];

    const tableHtml = renderToStaticMarkup(
      <InventoryTable
        items={inventoryItems}
        onAdjustStock={vi.fn()}
        onViewHistory={vi.fn()}
      />,
    );
    expect(tableHtml).toContain("Handcrafted Ceramic Teapot");
    expect(tableHtml).toContain("TP-BLU-01");
    expect(tableHtml).toContain("25");
    expect(tableHtml).toContain("In Stock");

    // Stock Adjustment Dialog
    const dialogHtml = renderToStaticMarkup(
      <StockAdjustmentDialog
        isOpen={true}
        storeId={currentStore.id}
        variantItem={inventoryItems[0]!}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );
    expect(dialogHtml).toContain("Adjust Inventory Stock");
    expect(dialogHtml).toContain("MANUAL_CORRECTION");
    expect(dialogHtml).toContain("RESTOCK");
    expect(dialogHtml).toContain("Confirm Adjustment");
  });

  it("2.5 Merchant Orders Workflow: renders order list, order details drawer, and cancellation dialog", () => {
    const orders: OrderDTO[] = [
      {
        id: "ord_1001",
        storeId: currentStore.id,
        orderNumber: "1001",
        customerId: "cust_1",
        checkoutId: "chk_1",
        paymentId: "pay_1",
        status: "PENDING",
        paymentStatus: "PAID",
        fulfillmentStatus: "UNFULFILLED",
        currency: "USD",
        subtotal: 10000,
        discountTotal: 0,
        shippingTotal: 0,
        taxTotal: 0,
        total: 10000,
        grandTotal: 10000,
        cancelledAt: null,
        cancelReason: null,
        completedAt: null,
        createdAt: "2026-10-10T12:00:00Z",
        updatedAt: "2026-10-10T12:05:00Z",
        items: [],
      },
    ];

    const tableHtml = renderToStaticMarkup(
      <OrderListTable
        orders={orders}
        hasMore={false}
        filters={{ orderNumber: "", status: "ALL", paymentStatus: "ALL", fulfillmentStatus: "ALL" }}
        isLoading={false}
        canManage={true}
        userRole="owner"
        onFilterChange={vi.fn()}
        onResetFilters={vi.fn()}
        onCancelOrder={vi.fn()}
      />,
    );
    expect(tableHtml).toContain("#1001");
    expect(tableHtml).toContain("$100.00");
    expect(tableHtml).toContain("Paid");

    // Order Details View
    const detailsHtml = renderToStaticMarkup(
      <OrderDetailsView
        order={orders[0]!}
        onOpenCancel={vi.fn()}
      />,
    );
    expect(detailsHtml).toContain("Order #1001");
    expect(detailsHtml).toContain("Payment Status");
    expect(detailsHtml).toContain("Cancel Order");

    // Order Cancellation Dialog
    const cancelHtml = renderToStaticMarkup(
      <OrderCancelDialog
        isOpen={true}
        order={orders[0]!}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        isCancelling={false}
      />,
    );
    expect(cancelHtml).toContain("Cancel Order #1001");
    expect(cancelHtml).toContain("Cancellation Reason");
    expect(cancelHtml).toContain("Confirm Cancellation");
  });

  it("2.6 Merchant Customer Management: renders customer directory and details drawer", () => {
    const customers: CustomerSummaryDTO[] = [
      {
        id: "cust_101",
        storeId: currentStore.id,
        email: "jane.artisan@example.com",
        firstName: "Jane",
        lastName: "Artisan",
        phone: "+12065550199",
        status: "ACTIVE",
        ordersCount: 3,
        totalSpent: 25000,
        createdAt: "2026-10-01T00:00:00Z",
        updatedAt: "2026-10-10T00:00:00Z",
      },
    ];

    const tableHtml = renderToStaticMarkup(
      <CustomerListTable
        customers={customers}
        hasMore={false}
        filters={{ search: "", status: "ALL" }}
        isLoading={false}
        canManage={true}
        userRole="owner"
        onFilterChange={vi.fn()}
        onResetFilters={vi.fn()}
        onOpenCreate={vi.fn()}
        onToggleStatus={vi.fn()}
      />,
    );
    expect(tableHtml).toContain("Jane Artisan");
    expect(tableHtml).toContain("jane.artisan@example.com");
    expect(tableHtml).toContain("+12065550199");
    expect(tableHtml).toContain("Active");
    expect(tableHtml).toContain("Oct 1, 2026");

    const customerDetail: CustomerDetailDTO = {
      ...customers[0]!,
      addresses: [
        {
          id: "addr_1",
          customerId: "cust_101",
          storeId: currentStore.id,
          type: "SHIPPING",
          isDefault: true,
          firstName: "Jane",
          lastName: "Artisan",
          addressLine1: "123 Ceramic Road",
          city: "Seattle",
          state: "WA",
          postalCode: "98101",
          country: "US",
          phone: "+12065550199",
          createdAt: "2026-10-01T00:00:00Z",
          updatedAt: "2026-10-01T00:00:00Z",
        },
      ],
    };

    const detailsHtml = renderToStaticMarkup(
      <CustomerDetailsView
        storeId={currentStore.id}
        customer={customerDetail}
        onRefreshCustomer={vi.fn()}
      />,
    );
    expect(detailsHtml).toContain("Jane Artisan");
    expect(detailsHtml).toContain("123 Ceramic Road");
    expect(detailsHtml).toContain("Seattle, WA 98101");
  });

  it("2.7 Merchant Team Management: renders member directory and role protection indicators", () => {
    const members: StoreMemberDTO[] = [
      {
        id: "mem_1",
        storeId: currentStore.id,
        userId: "user_owner_1",
        email: "merchant@example.com",
        name: "Demo Merchant",
        role: "owner",
        status: "ACTIVE",
        createdAt: "2026-10-01T00:00:00Z",
        updatedAt: "2026-10-01T00:00:00Z",
      },
      {
        id: "mem_2",
        storeId: currentStore.id,
        userId: "user_staff_2",
        email: "staff@example.com",
        name: "Staff Member",
        role: "staff",
        status: "ACTIVE",
        createdAt: "2026-10-05T00:00:00Z",
        updatedAt: "2026-10-05T00:00:00Z",
      },
    ];

    const tableHtml = renderToStaticMarkup(
      <MembersTable
        storeId={currentStore.id}
        members={members}
        currentUserId="user_owner_1"
        currentUserRole="owner"
        onMemberUpdated={vi.fn()}
        onMemberRemoved={vi.fn()}
      />,
    );
    expect(tableHtml).toContain("user_owner_1");
    expect(tableHtml).toContain("(You / Current Session)");
    expect(tableHtml).toContain("user_staff_2");
    expect(tableHtml).toContain("Owner");
    expect(tableHtml).toContain("Staff");

    // Add Member Dialog
    const dialogHtml = renderToStaticMarkup(
      <AddMemberDialog
        storeId={currentStore.id}
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );
    expect(dialogHtml).toContain("Add Store Team Member");
    expect(dialogHtml).toContain("User Identifier (User ID)");
    expect(dialogHtml).toContain("Add Member");
  });
});

describe("Milestone C5 Browser-Level Smoke Tests: UI State Resiliency (Loading, Empty, Validation, Errors)", () => {
  it("3.1 Loading States: renders loading spinners across components", () => {
    const spinnerHtml = renderToStaticMarkup(
      <Spinner size="lg" label="Loading store data..." />,
    );
    expect(spinnerHtml).toContain("Loading store data...");

    const productLoadingHtml = renderToStaticMarkup(
      <ProductGrid
        products={[]}
        storeSlug="artisan-store"
        isLoading={true}
        error={null}
      />,
    );
    expect(productLoadingHtml).toContain("Loading catalog...");
  });

  it("3.2 Empty States: renders informative empty representations across views", () => {
    // Empty Catalog
    const emptyCatalogHtml = renderToStaticMarkup(
      <ProductGrid
        products={[]}
        storeSlug="artisan-store"
        isLoading={false}
        error={null}
      />,
    );
    expect(emptyCatalogHtml).toContain("No products available");

    // Empty Orders
    const emptyOrdersHtml = renderToStaticMarkup(
      <OrderListTable
        orders={[]}
        hasMore={false}
        filters={{ orderNumber: "", status: "ALL", paymentStatus: "ALL", fulfillmentStatus: "ALL" }}
        isLoading={false}
        canManage={true}
        userRole="owner"
        onFilterChange={vi.fn()}
        onResetFilters={vi.fn()}
        onCancelOrder={vi.fn()}
      />,
    );
    expect(emptyOrdersHtml).toContain("No Orders Found");

    // Empty Customers
    const emptyCustomersHtml = renderToStaticMarkup(
      <CustomerListTable
        customers={[]}
        hasMore={false}
        filters={{ search: "", status: "ALL" }}
        isLoading={false}
        canManage={true}
        userRole="owner"
        onFilterChange={vi.fn()}
        onResetFilters={vi.fn()}
        onOpenCreate={vi.fn()}
        onToggleStatus={vi.fn()}
      />,
    );
    expect(emptyCustomersHtml).toContain("No Customers Found");
  });

  it("3.3 Error and Alert States: renders accessible error boundaries with retry mechanisms", () => {
    const alertHtml = renderToStaticMarkup(
      <Alert variant="danger" title="Connection Error">
        Failed to communicate with payment server. Please try again.
      </Alert>,
    );
    expect(alertHtml).toContain('role="alert"');
    expect(alertHtml).toContain("Connection Error");
    expect(alertHtml).toContain("Failed to communicate with payment server");

    // Product Grid API error state
    const gridErrorHtml = renderToStaticMarkup(
      <ProductGrid
        products={[]}
        storeSlug="artisan-store"
        isLoading={false}
        error={new Error("API service temporarily unavailable")}
        onRetry={vi.fn()}
      />,
    );
    expect(gridErrorHtml).toContain("API service temporarily unavailable");
    expect(gridErrorHtml).toContain("Try Again");
  });
});
