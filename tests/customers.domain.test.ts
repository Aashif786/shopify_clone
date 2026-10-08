import { describe, expect, it } from "vitest";
import {
  AddressAccessDeniedError,
  AddressNotFoundError,
  CrossStoreAddressAccessError,
  CrossStoreCustomerAccessError,
  CustomerAccessDeniedError,
  CustomerAlreadyExistsError,
  CustomerDomainError,
  CustomerNotFoundError,
  DefaultAddressConflictError,
  DuplicateCustomerError,
  InvalidAddressError,
  InvalidCustomerEmailError,
  InvalidCustomerStateTransitionError,
  InvalidCustomerStatusError,
  VALID_CUSTOMER_STATUSES,
  VALID_CUSTOMER_TRANSITIONS,
  assertValidCustomerTransition,
  isValidCustomerStatus,
  isValidCustomerTransition,
  isValidEmailFormat,
  normalizeEmail,
  validateAddressLine,
  validateCity,
  validateCountryCode,
  validateCustomerEmail,
  validateCustomerName,
  validateCustomerPhone,
  validateCustomerStatus,
  validatePostalCode,
  validateState,
  type Customer,
  type CustomerAddress,
} from "@shopify-clone/customers";

describe("Customers Domain Model & Invariants", () => {
  describe("Email Normalization & Validation", () => {
    it("normalizes email by trimming whitespace and converting to lowercase", () => {
      expect(normalizeEmail("  John.Doe@Example.COM  ")).toBe("john.doe@example.com");
      expect(normalizeEmail("USER@DOMAIN.ORG")).toBe("user@domain.org");
    });

    it("validates valid customer emails correctly", () => {
      expect(validateCustomerEmail("shopper@test.com")).toBe("shopper@test.com");
      expect(validateCustomerEmail("  Customer.One@Store.co.uk  ")).toBe(
        "customer.one@store.co.uk",
      );
    });

    it("rejects invalid or empty customer email with InvalidCustomerEmailError", () => {
      expect(() => validateCustomerEmail("")).toThrow(InvalidCustomerEmailError);
      expect(() => validateCustomerEmail("   ")).toThrow(InvalidCustomerEmailError);
      expect(() => validateCustomerEmail("not-an-email")).toThrow(
        InvalidCustomerEmailError,
      );
      expect(() => validateCustomerEmail("missing-domain@")).toThrow(
        InvalidCustomerEmailError,
      );
      expect(() => validateCustomerEmail("@missing-user.com")).toThrow(
        InvalidCustomerEmailError,
      );
      expect(() => validateCustomerEmail(null as unknown as string)).toThrow(
        InvalidCustomerEmailError,
      );
      expect(() => validateCustomerEmail(undefined as unknown as string)).toThrow(
        InvalidCustomerEmailError,
      );
    });

    it("rejects emails exceeding 255 characters", () => {
      const longEmail = `${"a".repeat(250)}@test.com`;
      expect(() => validateCustomerEmail(longEmail)).toThrow(
        InvalidCustomerEmailError,
      );
    });

    it("isValidEmailFormat returns boolean correctly", () => {
      expect(isValidEmailFormat("valid@example.com")).toBe(true);
      expect(isValidEmailFormat("  valid@example.com  ")).toBe(true);
      expect(isValidEmailFormat("invalid")).toBe(false);
      expect(isValidEmailFormat(null as unknown as string)).toBe(false);
    });
  });

  describe("Customer Lifecycle & Status Validation", () => {
    it("recognizes valid customer statuses", () => {
      expect(VALID_CUSTOMER_STATUSES).toEqual(["ACTIVE", "DISABLED"]);
      expect(isValidCustomerStatus("ACTIVE")).toBe(true);
      expect(isValidCustomerStatus("DISABLED")).toBe(true);
      expect(isValidCustomerStatus("PENDING")).toBe(false);
      expect(isValidCustomerStatus("ARCHIVED")).toBe(false);
      expect(isValidCustomerStatus(null)).toBe(false);
      expect(isValidCustomerStatus(123)).toBe(false);
    });

    it("validates customer status string or throws InvalidCustomerStatusError", () => {
      expect(validateCustomerStatus("ACTIVE")).toBe("ACTIVE");
      expect(validateCustomerStatus("DISABLED")).toBe("DISABLED");
      expect(() => validateCustomerStatus("UNKNOWN")).toThrow(
        InvalidCustomerStatusError,
      );
    });

    it("permits valid transitions between ACTIVE and DISABLED", () => {
      expect(VALID_CUSTOMER_TRANSITIONS.ACTIVE).toContain("DISABLED");
      expect(isValidCustomerTransition("ACTIVE", "DISABLED")).toBe(true);
      expect(isValidCustomerTransition("DISABLED", "ACTIVE")).toBe(true);
      expect(isValidCustomerTransition("ACTIVE", "ACTIVE")).toBe(true);
      expect(isValidCustomerTransition("DISABLED", "DISABLED")).toBe(true);

      expect(() => assertValidCustomerTransition("ACTIVE", "DISABLED")).not.toThrow();
      expect(() => assertValidCustomerTransition("DISABLED", "ACTIVE")).not.toThrow();
    });

    it("assertValidCustomerTransition throws InvalidCustomerStateTransitionError on invalid transition", () => {
      // @ts-expect-error Testing invalid transition with arbitrary string
      expect(() => assertValidCustomerTransition("ACTIVE", "ARCHIVED")).toThrow(
        InvalidCustomerStateTransitionError,
      );
    });
  });

  describe("Customer Profile Fields Validation", () => {
    it("validates first and last names within length bounds", () => {
      expect(validateCustomerName("John", "First name")).toBe("John");
      expect(validateCustomerName("  Jane  ", "First name")).toBe("Jane");
      expect(validateCustomerName("", "First name")).toBeNull();
      expect(validateCustomerName("   ", "First name")).toBeNull();
      expect(validateCustomerName(null, "First name")).toBeNull();
      expect(validateCustomerName(undefined, "First name")).toBeNull();

      expect(() => validateCustomerName("x".repeat(101), "First name")).toThrow(
        InvalidAddressError,
      );
    });

    it("validates customer phone numbers", () => {
      expect(validateCustomerPhone("+1 555-123-4567")).toBe("+1 555-123-4567");
      expect(validateCustomerPhone("")).toBeNull();
      expect(validateCustomerPhone(null)).toBeNull();
      expect(validateCustomerPhone(undefined)).toBeNull();

      expect(() => validateCustomerPhone("1".repeat(51))).toThrow(
        InvalidAddressError,
      );
    });
  });

  describe("Address Fields Validation", () => {
    it("validates address lines correctly", () => {
      expect(validateAddressLine("123 Main St", "Address line 1")).toBe(
        "123 Main St",
      );
      expect(validateAddressLine("  Suite 400  ", "Address line 2")).toBe(
        "Suite 400",
      );

      expect(() => validateAddressLine("", "Address line 1")).toThrow(
        InvalidAddressError,
      );
      expect(() => validateAddressLine("   ", "Address line 1")).toThrow(
        InvalidAddressError,
      );
      expect(() => validateAddressLine("a".repeat(256), "Address line 1")).toThrow(
        InvalidAddressError,
      );
    });

    it("validates city and state", () => {
      expect(validateCity("New York")).toBe("New York");
      expect(() => validateCity("")).toThrow(InvalidAddressError);
      expect(() => validateCity("c".repeat(101))).toThrow(InvalidAddressError);

      expect(validateState("NY")).toBe("NY");
      expect(validateState(null)).toBeNull();
      expect(validateState("")).toBeNull();
      expect(() => validateState("s".repeat(101))).toThrow(InvalidAddressError);
    });

    it("validates postal code and country", () => {
      expect(validatePostalCode("10001")).toBe("10001");
      expect(() => validatePostalCode("")).toThrow(InvalidAddressError);
      expect(() => validatePostalCode("p".repeat(33))).toThrow(InvalidAddressError);

      expect(validateCountryCode("us")).toBe("US");
      expect(validateCountryCode("CA")).toBe("CA");
      expect(() => validateCountryCode("")).toThrow(InvalidAddressError);
      expect(() => validateCountryCode("c".repeat(65))).toThrow(InvalidAddressError);
    });
  });

  describe("Domain Entities Typing", () => {
    it("instantiates Customer interface adhering to domain invariants", () => {
      const now = new Date();
      const customer: Customer = {
        id: "018f3a20-0000-7000-8000-000000000001",
        storeId: "018f3a20-0000-7000-8000-000000000002",
        userId: null,
        email: "shopper@store.test",
        firstName: "Alice",
        lastName: "Smith",
        phone: "+1234567890",
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
      };

      expect(customer.id).toBe("018f3a20-0000-7000-8000-000000000001");
      expect(customer.email).toBe("shopper@store.test");
      expect(customer.status).toBe("ACTIVE");
    });

    it("instantiates CustomerAddress interface adhering to domain invariants", () => {
      const now = new Date();
      const address: CustomerAddress = {
        id: "018f3a20-0000-7000-8000-000000000010",
        storeId: "018f3a20-0000-7000-8000-000000000002",
        customerId: "018f3a20-0000-7000-8000-000000000001",
        firstName: "Alice",
        lastName: "Smith",
        company: "ACME Corp",
        addressLine1: "123 Market St",
        addressLine2: "Apt 4B",
        city: "San Francisco",
        state: "CA",
        postalCode: "94105",
        country: "US",
        phone: "+1234567890",
        label: "Home",
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      };

      expect(address.customerId).toBe("018f3a20-0000-7000-8000-000000000001");
      expect(address.isDefault).toBe(true);
      expect(address.country).toBe("US");
    });
  });

  describe("Domain Errors Hierarchy & Status Codes", () => {
    it("provides stable error codes and appropriate HTTP status mappings", () => {
      const notFound = new CustomerNotFoundError("Customer not found", { id: "c1" });
      expect(notFound).toBeInstanceOf(CustomerDomainError);
      expect(notFound.code).toBe("CUSTOMER_NOT_FOUND");
      expect(notFound.status).toBe(404);
      expect(notFound.details).toEqual({ id: "c1" });

      const duplicate = new DuplicateCustomerError("Customer already exists");
      expect(duplicate.code).toBe("CUSTOMER_ALREADY_EXISTS");
      expect(duplicate.status).toBe(409);

      const exists = new CustomerAlreadyExistsError("Duplicate email");
      expect(exists.code).toBe("CUSTOMER_ALREADY_EXISTS");
      expect(exists.status).toBe(409);

      const accessDenied = new CustomerAccessDeniedError("Denied");
      expect(accessDenied.code).toBe("CUSTOMER_ACCESS_DENIED");
      expect(accessDenied.status).toBe(403);

      const crossStore = new CrossStoreCustomerAccessError("Cross store");
      expect(crossStore.code).toBe("CUSTOMER_ACCESS_DENIED");
      expect(crossStore.status).toBe(403);

      const addrNotFound = new AddressNotFoundError("Address not found");
      expect(addrNotFound.code).toBe("ADDRESS_NOT_FOUND");
      expect(addrNotFound.status).toBe(404);

      const addrDenied = new AddressAccessDeniedError("Denied");
      expect(addrDenied.code).toBe("ADDRESS_ACCESS_DENIED");
      expect(addrDenied.status).toBe(403);

      const crossAddr = new CrossStoreAddressAccessError("Cross address");
      expect(crossAddr.code).toBe("ADDRESS_ACCESS_DENIED");
      expect(crossAddr.status).toBe(403);

      const invalidAddr = new InvalidAddressError("Invalid");
      expect(invalidAddr.code).toBe("INVALID_ADDRESS");
      expect(invalidAddr.status).toBe(400);

      const defaultConflict = new DefaultAddressConflictError("Conflict");
      expect(defaultConflict.code).toBe("DEFAULT_ADDRESS_CONFLICT");
      expect(defaultConflict.status).toBe(409);
    });
  });
});
