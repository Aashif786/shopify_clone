import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type {
  CustomerAddressDTO,
  CustomerDTO,
  CustomerWithAddressesDTO,
} from "@shopify-clone/customers";
import {
  calculateCustomerMetrics,
  formatCustomerDate,
  formatCustomerName,
  getCustomerStatusBadgeConfig,
  validateCustomerAddressFormData,
  validateCustomerFormData,
  type CustomerAddressFormData,
  type CustomerFilterState,
  type CustomerFormData,
} from "../../apps/web/src/lib/merchant-customer-helpers";
import { CustomerStatusBadge } from "../../apps/web/src/components/merchant/customers/customer-status-badge";
import { CustomerListTable } from "../../apps/web/src/components/merchant/customers/customer-list-table";
import { CustomerCreateDialog } from "../../apps/web/src/components/merchant/customers/customer-create-dialog";
import { CustomerStatusDialog } from "../../apps/web/src/components/merchant/customers/customer-status-dialog";
import { CustomerProfileForm } from "../../apps/web/src/components/merchant/customers/customer-profile-form";
import { CustomerAddressDialog } from "../../apps/web/src/components/merchant/customers/customer-address-dialog";
import { CustomerDetailsView } from "../../apps/web/src/components/merchant/customers/customer-details-view";
import { ApiClient, ApiClientError } from "../../apps/web/src/lib/api-client";

const mockAddress1: CustomerAddressDTO = {
  id: "addr_1",
  storeId: "store_xyz",
  customerId: "cust_1",
  firstName: "Jane",
  lastName: "Doe",
  company: "Acme Corp",
  addressLine1: "100 Pine Street",
  addressLine2: "Suite 300",
  city: "San Francisco",
  state: "CA",
  postalCode: "94111",
  country: "US",
  phone: "+1 555-0100",
  label: "Office",
  isDefault: true,
  createdAt: "2026-10-01T10:00:00Z",
  updatedAt: "2026-10-01T10:00:00Z",
};

const mockCustomer1: CustomerDTO = {
  id: "cust_1",
  storeId: "store_xyz",
  userId: null,
  email: "jane.doe@example.com",
  firstName: "Jane",
  lastName: "Doe",
  phone: "+1 555-0100",
  status: "ACTIVE",
  createdAt: "2026-10-01T10:00:00Z",
  updatedAt: "2026-10-01T10:00:00Z",
};

const mockCustomer2: CustomerDTO = {
  id: "cust_2",
  storeId: "store_xyz",
  userId: null,
  email: "disabled.user@example.com",
  firstName: null,
  lastName: null,
  phone: null,
  status: "DISABLED",
  createdAt: "2026-10-05T12:00:00Z",
  updatedAt: "2026-10-06T15:00:00Z",
};

const mockCustomerWithAddresses: CustomerWithAddressesDTO = {
  ...mockCustomer1,
  addresses: [mockAddress1],
  defaultAddress: mockAddress1,
};

describe("Merchant Customers Management (Milestone C3)", () => {
  describe("merchant-customer-helpers", () => {
    it("formats customer names cleanly with fallbacks", () => {
      expect(formatCustomerName(mockCustomer1)).toBe("Jane Doe");
      expect(formatCustomerName(mockCustomer2)).toBe("disabled.user@example.com");
      expect(formatCustomerName({ email: "" })).toBe("Unnamed Customer");
    });

    it("formats dates safely", () => {
      expect(formatCustomerDate("2026-10-01T10:00:00Z")).toContain("2026");
      expect(formatCustomerDate(null)).toBe("—");
      expect(formatCustomerDate("not-a-date")).toBe("—");
    });

    it("validates customer profile inputs", () => {
      const valid: CustomerFormData = {
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
        phone: "+1 555-0199",
      };
      expect(Object.keys(validateCustomerFormData(valid))).toHaveLength(0);

      const invalidEmail: CustomerFormData = {
        email: "not-an-email",
        firstName: "",
        lastName: "",
        phone: "",
      };
      const errors = validateCustomerFormData(invalidEmail);
      expect(errors.email).toContain("valid email");

      const emptyEmail: CustomerFormData = {
        email: "",
        firstName: "",
        lastName: "",
        phone: "",
      };
      expect(validateCustomerFormData(emptyEmail).email).toContain("required");
    });

    it("validates address inputs according to domain rules", () => {
      const validAddress: CustomerAddressFormData = {
        firstName: "Jane",
        lastName: "Doe",
        company: "",
        addressLine1: "123 Main St",
        addressLine2: "",
        city: "Seattle",
        state: "WA",
        postalCode: "98101",
        country: "US",
        phone: "",
        label: "Home",
        isDefault: false,
      };
      expect(Object.keys(validateCustomerAddressFormData(validAddress))).toHaveLength(0);

      const invalidAddress: CustomerAddressFormData = {
        ...validAddress,
        addressLine1: "",
        city: "",
        postalCode: "",
        country: "",
      };
      const errors = validateCustomerAddressFormData(invalidAddress);
      expect(errors.addressLine1).toContain("required");
      expect(errors.city).toContain("required");
      expect(errors.postalCode).toContain("required");
      expect(errors.country).toContain("required");
    });

    it("calculates accurate customer metrics", () => {
      const metrics = calculateCustomerMetrics([mockCustomer1, mockCustomer2]);
      expect(metrics.totalCustomers).toBe(2);
      expect(metrics.activeCustomers).toBe(1);
      expect(metrics.disabledCustomers).toBe(1);
    });

    it("provides badge configs for customer statuses", () => {
      expect(getCustomerStatusBadgeConfig("ACTIVE").variant).toBe("success");
      expect(getCustomerStatusBadgeConfig("ACTIVE").label).toBe("Active");
      expect(getCustomerStatusBadgeConfig("DISABLED").variant).toBe("neutral");
      expect(getCustomerStatusBadgeConfig("DISABLED").label).toBe("Disabled");
    });
  });

  describe("CustomerStatusBadge Component", () => {
    it("renders Active badge with success styling", () => {
      const html = renderToStaticMarkup(<CustomerStatusBadge status="ACTIVE" />);
      expect(html).toContain("Active");
      expect(html).toContain("badge--success");
    });

    it("renders Disabled badge with neutral styling", () => {
      const html = renderToStaticMarkup(<CustomerStatusBadge status="DISABLED" />);
      expect(html).toContain("Disabled");
      expect(html).toContain("badge--neutral");
    });
  });

  describe("CustomerListTable Component", () => {
    const defaultFilters: CustomerFilterState = {
      search: "",
      status: "ALL",
    };

    it("renders table with columns, customer names, emails, and KPIs", () => {
      const html = renderToStaticMarkup(
        <CustomerListTable
          customers={[mockCustomer1, mockCustomer2]}
          hasMore={false}
          filters={defaultFilters}
          isLoading={false}
          canManage={true}
          userRole="owner"
          onFilterChange={vi.fn()}
          onResetFilters={vi.fn()}
          onOpenCreate={vi.fn()}
          onToggleStatus={vi.fn()}
        />,
      );

      // KPI cards
      expect(html).toContain("Total Customers");
      expect(html).toContain("Active Accounts");
      expect(html).toContain("Disabled Accounts");
      // Customer rows
      expect(html).toContain("Jane Doe");
      expect(html).toContain("jane.doe@example.com");
      expect(html).toContain("disabled.user@example.com");
      expect(html).toContain("+1 555-0100");
      // Links
      expect(html).toContain("/merchant/customers/cust_1");
      expect(html).toContain("/merchant/customers/cust_2");
    });

    it("renders empty state when customer directory is empty", () => {
      const html = renderToStaticMarkup(
        <CustomerListTable
          customers={[]}
          hasMore={false}
          filters={defaultFilters}
          isLoading={false}
          canManage={true}
          userRole="owner"
          onFilterChange={vi.fn()}
          onResetFilters={vi.fn()}
          onOpenCreate={vi.fn()}
          onToggleStatus={vi.fn()}
        />,
      );

      expect(html).toContain("No Customers Found");
    });

    it("renders pagination controls when hasMore is true", () => {
      const html = renderToStaticMarkup(
        <CustomerListTable
          customers={[mockCustomer1]}
          hasMore={true}
          filters={defaultFilters}
          isLoading={false}
          canManage={true}
          userRole="owner"
          onFilterChange={vi.fn()}
          onNextPage={vi.fn()}
          onResetFilters={vi.fn()}
          onOpenCreate={vi.fn()}
          onToggleStatus={vi.fn()}
        />,
      );

      expect(html).toContain("Load More Customers");
    });

    it("disables mutation actions for staff role users", () => {
      const html = renderToStaticMarkup(
        <CustomerListTable
          customers={[mockCustomer1]}
          hasMore={false}
          filters={defaultFilters}
          isLoading={false}
          canManage={true}
          userRole="staff"
          onFilterChange={vi.fn()}
          onResetFilters={vi.fn()}
          onOpenCreate={vi.fn()}
          onToggleStatus={vi.fn()}
        />,
      );

      expect(html).toContain("Requires Admin or Owner role");
      expect(html).toContain("disabled");
    });
  });

  describe("CustomerCreateDialog Component", () => {
    it("renders dialog when open with form inputs", () => {
      const html = renderToStaticMarkup(
        <CustomerCreateDialog
          storeId="store_xyz"
          isOpen={true}
          userRole="owner"
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />,
      );

      expect(html).toContain("Add New Customer");
      expect(html).toContain("Email Address");
      expect(html).toContain("First Name");
      expect(html).toContain("Last Name");
      expect(html).toContain("Phone Number");
    });

    it("shows permission alert when user is staff", () => {
      const html = renderToStaticMarkup(
        <CustomerCreateDialog
          storeId="store_xyz"
          isOpen={true}
          userRole="staff"
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />,
      );

      expect(html).toContain("Permission Required");
      expect(html).toContain("Staff role");
    });

    it("returns null when dialog is closed", () => {
      const html = renderToStaticMarkup(
        <CustomerCreateDialog
          storeId="store_xyz"
          isOpen={false}
          userRole="owner"
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />,
      );

      expect(html).toBe("");
    });
  });

  describe("CustomerStatusDialog Component", () => {
    it("renders enable confirmation dialog", () => {
      const html = renderToStaticMarkup(
        <CustomerStatusDialog
          storeId="store_xyz"
          customer={mockCustomer2}
          isOpen={true}
          action="enable"
          userRole="owner"
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />,
      );

      expect(html).toContain("Enable Customer Account");
      expect(html).toContain("Reactivate Customer Account");
      expect(html).toContain("ACTIVE");
    });

    it("renders disable confirmation dialog", () => {
      const html = renderToStaticMarkup(
        <CustomerStatusDialog
          storeId="store_xyz"
          customer={mockCustomer1}
          isOpen={true}
          action="disable"
          userRole="owner"
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />,
      );

      expect(html).toContain("Disable Customer Account");
      expect(html).toContain("Deactivate Customer Account");
      expect(html).toContain("DISABLED");
    });
  });

  describe("CustomerProfileForm Component", () => {
    it("renders profile fields pre-populated with customer data", () => {
      const html = renderToStaticMarkup(
        <CustomerProfileForm
          storeId="store_xyz"
          customer={mockCustomer1}
          userRole="owner"
          onSuccess={vi.fn()}
        />,
      );

      expect(html).toContain("Customer Profile");
      expect(html).toContain("jane.doe@example.com");
      expect(html).toContain("Jane");
      expect(html).toContain("Doe");
      expect(html).toContain("Save Profile Changes");
    });

    it("displays read-only notice for staff users", () => {
      const html = renderToStaticMarkup(
        <CustomerProfileForm
          storeId="store_xyz"
          customer={mockCustomer1}
          userRole="staff"
          onSuccess={vi.fn()}
        />,
      );

      expect(html).toContain("Read Only Access");
      expect(html).toContain("Staff permissions");
      expect(html).not.toContain("Save Profile Changes");
    });
  });

  describe("CustomerAddressDialog Component", () => {
    it("renders address dialog for adding new address", () => {
      const html = renderToStaticMarkup(
        <CustomerAddressDialog
          storeId="store_xyz"
          customerId="cust_1"
          addressToEdit={null}
          isOpen={true}
          userRole="owner"
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />,
      );

      expect(html).toContain("Add Customer Address");
      expect(html).toContain("Address Line 1");
      expect(html).toContain("City");
      expect(html).toContain("Postal Code");
    });

    it("renders address dialog populated for editing", () => {
      const html = renderToStaticMarkup(
        <CustomerAddressDialog
          storeId="store_xyz"
          customerId="cust_1"
          addressToEdit={mockAddress1}
          isOpen={true}
          userRole="owner"
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />,
      );

      expect(html).toContain("Edit Customer Address");
      expect(html).toContain("100 Pine Street");
      expect(html).toContain("San Francisco");
      expect(html).toContain("94111");
    });
  });

  describe("CustomerDetailsView Component", () => {
    it("renders customer details, addresses, and account notice", () => {
      const html = renderToStaticMarkup(
        <CustomerDetailsView
          storeId="store_xyz"
          customer={mockCustomerWithAddresses}
          userRole="owner"
          onRefreshCustomer={vi.fn()}
        />,
      );

      expect(html).toContain("Jane Doe");
      expect(html).toContain("jane.doe@example.com");
      expect(html).toContain("Address Book (1)");
      expect(html).toContain("100 Pine Street");
      expect(html).toContain("Default");
      expect(html).toContain("Order History");
      expect(html).toContain("Storefront Customer Authentication");
    });
  });

  describe("API Client & Customer Workflows", () => {
    it("creates a customer successfully via API client", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          success: true,
          data: mockCustomer1,
        }),
      });
      vi.stubGlobal("fetch", mockFetch);

      try {
        const client = new ApiClient("http://localhost:3000");
        const created = await client.post<CustomerDTO>(
          "/api/v1/stores/store_xyz/customers",
          {
            email: "jane.doe@example.com",
            firstName: "Jane",
            lastName: "Doe",
          },
        );

        expect(created.email).toBe("jane.doe@example.com");
        expect(mockFetch).toHaveBeenCalledWith(
          "http://localhost:3000/api/v1/stores/store_xyz/customers",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({
              email: "jane.doe@example.com",
              firstName: "Jane",
              lastName: "Doe",
            }),
          }),
        );
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it("propagates 409 Conflict when creating duplicate customer", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          success: false,
          error: {
            code: "CUSTOMER_ALREADY_EXISTS",
            message: "A customer with this email already exists in this store",
          },
        }),
      });
      vi.stubGlobal("fetch", mockFetch);

      try {
        const client = new ApiClient("http://localhost:3000");
        await client.post("/api/v1/stores/store_xyz/customers", {
          email: "duplicate@example.com",
        });
        expect.unreachable("Should have thrown ApiClientError");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiClientError);
        expect((err as ApiClientError).status).toBe(409);
        expect((err as ApiClientError).code).toBe("CUSTOMER_ALREADY_EXISTS");
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it("propagates 403 Forbidden when staff attempts customer creation", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Operation requires at least admin role in this store",
          },
        }),
      });
      vi.stubGlobal("fetch", mockFetch);

      try {
        const client = new ApiClient("http://localhost:3000");
        await expect(
          client.post("/api/v1/stores/store_xyz/customers", {
            email: "staff.attempt@example.com",
          }),
        ).rejects.toThrow(ApiClientError);
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it("queries customer list with search and status filters", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          success: true,
          data: {
            items: [mockCustomer1],
            hasMore: false,
          },
        }),
      });
      vi.stubGlobal("fetch", mockFetch);

      try {
        const client = new ApiClient("http://localhost:3000");
        const queryParams = new URLSearchParams({
          search: "jane",
          status: "ACTIVE",
          limit: "50",
        });

        const res = await client.get<{ items: CustomerDTO[]; hasMore: boolean }>(
          `/api/v1/stores/store_xyz/customers?${queryParams.toString()}`,
        );

        expect(res.items).toHaveLength(1);
        expect(mockFetch).toHaveBeenCalledWith(
          "http://localhost:3000/api/v1/stores/store_xyz/customers?search=jane&status=ACTIVE&limit=50",
          expect.objectContaining({ method: "GET" }),
        );
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it("updates customer status via enable and disable endpoints", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          success: true,
          data: { ...mockCustomer1, status: "DISABLED" },
        }),
      });
      vi.stubGlobal("fetch", mockFetch);

      try {
        const client = new ApiClient("http://localhost:3000");
        const disabled = await client.post<CustomerDTO>(
          `/api/v1/stores/store_xyz/customers/${mockCustomer1.id}/disable`,
          {},
        );

        expect(disabled.status).toBe("DISABLED");
        expect(mockFetch).toHaveBeenCalledWith(
          "http://localhost:3000/api/v1/stores/store_xyz/customers/cust_1/disable",
          expect.objectContaining({ method: "POST" }),
        );
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });
});
