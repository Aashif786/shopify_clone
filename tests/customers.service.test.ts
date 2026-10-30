import { afterEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database, OrderRepository } from "@calcart/db";
import { OrderService } from "@calcart/orders";
import {
  AddressNotFoundError,
  CrossStoreAddressAccessError,
  CustomerAlreadyExistsError,
  CustomerNotFoundError,
  CustomerService,
  DefaultAddressConflictError,
  DuplicateCustomerError,
  InvalidAddressError,
  InvalidCustomerEmailError,
  InvalidCustomerStatusError,
  InvalidCustomerUserError,
  type CustomerStatus,
} from "@calcart/customers";
import { createIsolatedDatabase } from "./helpers/postgres.js";

describe("Customers Application Service Integration", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  const customerService = new CustomerService();

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
  });

  async function setupDb(): Promise<Database> {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    return isolated.database;
  }

  async function seedTestStore(
    db: Database,
    slug = "cust-store-1",
  ): Promise<{ orgId: string; storeId: string }> {
    const orgId = generateUuidV7();
    const storeId = generateUuidV7();
    await db.query(
      `INSERT INTO organizations (id, name, status) VALUES ($1, $2, 'ACTIVE')`,
      [orgId, `Org for ${slug}`],
    );
    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, $3, $4, 'ACTIVE', 'USD', 'en-US', 'America/New_York')`,
      [storeId, orgId, `Store ${slug}`, slug],
    );
    return { orgId, storeId };
  }

  async function seedTestUser(
    db: Database,
    email = "user@platform.test",
  ): Promise<string> {
    const userId = generateUuidV7();
    await db.query(
      `INSERT INTO users (id, email, name, password_hash, status)
       VALUES ($1, $2, 'Platform User', 'scrypt:hash', 'ACTIVE')`,
      [userId, email],
    );
    return userId;
  }

  describe("Customer Creation (createCustomer)", () => {
    it("creates a customer with valid data and default ACTIVE status", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "cust-create-1");

      const customer = await customerService.createCustomer(db, storeId, {
        email: "alice@example.com",
        firstName: "Alice",
        lastName: "Smith",
        phone: "+1-555-0100",
      });

      expect(customer.id).toBeDefined();
      expect(customer.storeId).toBe(storeId);
      expect(customer.email).toBe("alice@example.com");
      expect(customer.firstName).toBe("Alice");
      expect(customer.lastName).toBe("Smith");
      expect(customer.phone).toBe("+1-555-0100");
      expect(customer.status).toBe("ACTIVE");
      expect(customer.userId).toBeNull();
      expect(customer.createdAt).toBeDefined();
      expect(customer.updatedAt).toBeDefined();
    });

    it("normalizes customer email upon creation", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "cust-norm-1");

      const customer = await customerService.createCustomer(db, storeId, {
        email: "  ALICE.Doe@Example.COM  ",
      });

      expect(customer.email).toBe("alice.doe@example.com");

      // Verify DB row contains normalized email
      const res = await db.query<{ email: string }>(
        `SELECT email FROM customers WHERE id = $1`,
        [customer.id],
      );
      expect(res.rows[0]!.email).toBe("alice.doe@example.com");
    });

    it("rejects invalid email formats", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "cust-err-email");

      await expect(
        customerService.createCustomer(db, storeId, {
          email: "invalid-email-address",
        }),
      ).rejects.toThrow(InvalidCustomerEmailError);
    });

    it("rejects duplicate email within the same store", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "cust-dup-1");

      await customerService.createCustomer(db, storeId, {
        email: "bob@example.com",
      });

      await expect(
        customerService.createCustomer(db, storeId, {
          email: "bob@example.com",
        }),
      ).rejects.toThrow(CustomerAlreadyExistsError);

      // Also rejects case variations
      await expect(
        customerService.createCustomer(db, storeId, {
          email: "BOB@EXAMPLE.COM",
        }),
      ).rejects.toThrow(CustomerAlreadyExistsError);
    });

    it("allows the same email in different stores (tenant isolation)", async () => {
      const db = await setupDb();
      const { storeId: storeA } = await seedTestStore(db, "store-a");
      const { storeId: storeB } = await seedTestStore(db, "store-b");

      const custA = await customerService.createCustomer(db, storeA, {
        email: "shared@example.com",
      });
      const custB = await customerService.createCustomer(db, storeB, {
        email: "shared@example.com",
      });

      expect(custA.id).not.toBe(custB.id);
      expect(custA.storeId).toBe(storeA);
      expect(custB.storeId).toBe(storeB);
    });

    it("links a platform user when valid userId is provided", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "cust-user-1");
      const userId = await seedTestUser(db, "registered@platform.test");

      const customer = await customerService.createCustomer(db, storeId, {
        email: "registered@platform.test",
        userId,
      });

      expect(customer.userId).toBe(userId);
    });

    it("rejects associating a non-existent platform user", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "cust-user-missing");
      const nonExistentUserId = generateUuidV7();

      await expect(
        customerService.createCustomer(db, storeId, {
          email: "ghost@example.com",
          userId: nonExistentUserId,
        }),
      ).rejects.toThrow(InvalidCustomerUserError);
    });

    it("rejects associating the same platform user multiple times in the same store", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "cust-user-dup");
      const userId = await seedTestUser(db, "single@platform.test");

      await customerService.createCustomer(db, storeId, {
        email: "first@example.com",
        userId,
      });

      await expect(
        customerService.createCustomer(db, storeId, {
          email: "second@example.com",
          userId,
        }),
      ).rejects.toThrow(DuplicateCustomerError);
    });
  });

  describe("Customer Retrieval", () => {
    it("retrieves a customer by ID within store", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "cust-get-id");

      const created = await customerService.createCustomer(db, storeId, {
        email: "get@example.com",
        firstName: "Charlie",
      });

      const found = await customerService.getCustomerById(db, storeId, created.id);
      expect(found.id).toBe(created.id);
      expect(found.firstName).toBe("Charlie");
    });

    it("retrieves a customer by email (case-insensitive)", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "cust-get-email");

      await customerService.createCustomer(db, storeId, {
        email: "diana@example.com",
      });

      const found = await customerService.getCustomerByEmail(
        db,
        storeId,
        "DIANA@EXAMPLE.COM",
      );
      expect(found).not.toBeNull();
      expect(found!.email).toBe("diana@example.com");

      const missing = await customerService.getCustomerByEmail(
        db,
        storeId,
        "unknown@example.com",
      );
      expect(missing).toBeNull();
    });

    it("retrieves a customer by userId", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "cust-get-user");
      const userId = await seedTestUser(db, "lookup@platform.test");

      const created = await customerService.createCustomer(db, storeId, {
        email: "lookup@platform.test",
        userId,
      });

      const found = await customerService.getCustomerByUserId(db, storeId, userId);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    it("retrieves customer with addresses and default address indicator", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "cust-with-addrs");

      const customer = await customerService.createCustomer(db, storeId, {
        email: "multilocation@example.com",
      });

      const addr1 = await customerService.createAddress(db, storeId, customer.id, {
        addressLine1: "123 Main St",
        city: "Austin",
        postalCode: "78701",
        country: "US",
        isDefault: true,
      });

      const addr2 = await customerService.createAddress(db, storeId, customer.id, {
        addressLine1: "456 Office Blvd",
        city: "Austin",
        postalCode: "78702",
        country: "US",
        isDefault: false,
      });

      const details = await customerService.getCustomerWithAddresses(
        db,
        storeId,
        customer.id,
      );

      expect(details.id).toBe(customer.id);
      expect(details.addresses).toHaveLength(2);
      expect(details.addresses.map((a) => a.id)).toContain(addr2.id);
      expect(details.defaultAddress?.id).toBe(addr1.id);
    });

    it("throws CustomerNotFoundError for non-existent customer", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "cust-notfound");
      const nonExistentId = generateUuidV7();

      await expect(
        customerService.getCustomerById(db, storeId, nonExistentId),
      ).rejects.toThrow(CustomerNotFoundError);
    });

    it("strictly isolates cross-store retrieval (Store A cannot access Store B customer)", async () => {
      const db = await setupDb();
      const { storeId: storeA } = await seedTestStore(db, "iso-store-a");
      const { storeId: storeB } = await seedTestStore(db, "iso-store-b");

      const custB = await customerService.createCustomer(db, storeB, {
        email: "secret@store-b.com",
      });

      // Attempting to query Customer B via Store A must throw CustomerNotFoundError
      await expect(
        customerService.getCustomerById(db, storeA, custB.id),
      ).rejects.toThrow(CustomerNotFoundError);

      // Email lookup via Store A returns null
      const byEmail = await customerService.getCustomerByEmail(
        db,
        storeA,
        "secret@store-b.com",
      );
      expect(byEmail).toBeNull();
    });
  });

  describe("Customer Update (updateCustomer)", () => {
    it("updates profile fields partially without overwriting untouched fields", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "cust-update-part");

      const customer = await customerService.createCustomer(db, storeId, {
        email: "edward@example.com",
        firstName: "Edward",
        lastName: "Norton",
        phone: "555-1234",
      });

      const updated = await customerService.updateCustomer(db, storeId, customer.id, {
        firstName: "Eddie",
      });

      expect(updated.firstName).toBe("Eddie");
      expect(updated.lastName).toBe("Norton");
      expect(updated.phone).toBe("555-1234");
      expect(updated.email).toBe("edward@example.com");
    });

    it("updates email to new unique normalized email", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "cust-update-email");

      const customer = await customerService.createCustomer(db, storeId, {
        email: "old.email@example.com",
      });

      const updated = await customerService.updateCustomer(db, storeId, customer.id, {
        email: "  NEW.Email@Example.COM  ",
      });

      expect(updated.email).toBe("new.email@example.com");
    });

    it("rejects updating email if already taken by another customer in the store", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "cust-update-dup");

      await customerService.createCustomer(db, storeId, {
        email: "existing@example.com",
      });
      const customer2 = await customerService.createCustomer(db, storeId, {
        email: "candidate@example.com",
      });

      await expect(
        customerService.updateCustomer(db, storeId, customer2.id, {
          email: "existing@example.com",
        }),
      ).rejects.toThrow(CustomerAlreadyExistsError);
    });

    it("allows updating without changing email even if duplicate check runs", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "cust-update-same-email");

      const customer = await customerService.createCustomer(db, storeId, {
        email: "same@example.com",
        firstName: "Before",
      });

      const updated = await customerService.updateCustomer(db, storeId, customer.id, {
        email: "same@example.com",
        firstName: "After",
      });

      expect(updated.firstName).toBe("After");
      expect(updated.email).toBe("same@example.com");
    });

    it("links and unlinks platform user id", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "cust-update-user");
      const userId = await seedTestUser(db, "link@platform.test");

      const customer = await customerService.createCustomer(db, storeId, {
        email: "guest@example.com",
      });
      expect(customer.userId).toBeNull();

      // Link
      const linked = await customerService.updateCustomer(db, storeId, customer.id, {
        userId,
      });
      expect(linked.userId).toBe(userId);

      // Unlink
      const unlinked = await customerService.updateCustomer(db, storeId, customer.id, {
        userId: null,
      });
      expect(unlinked.userId).toBeNull();
    });

    it("prevents updating a customer belonging to another store", async () => {
      const db = await setupDb();
      const { storeId: storeA } = await seedTestStore(db, "iso-upd-a");
      const { storeId: storeB } = await seedTestStore(db, "iso-upd-b");

      const customerB = await customerService.createCustomer(db, storeB, {
        email: "b@example.com",
      });

      await expect(
        customerService.updateCustomer(db, storeA, customerB.id, {
          firstName: "Hacked",
        }),
      ).rejects.toThrow(CustomerNotFoundError);
    });
  });

  describe("Customer Lifecycle (ACTIVE <-> DISABLED)", () => {
    it("transitions customer from ACTIVE to DISABLED and back to ACTIVE", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "cust-lifecycle");

      const customer = await customerService.createCustomer(db, storeId, {
        email: "active@example.com",
      });
      expect(customer.status).toBe("ACTIVE");

      const disabled = await customerService.disableCustomer(db, storeId, customer.id);
      expect(disabled.status).toBe("DISABLED");

      const enabled = await customerService.enableCustomer(db, storeId, customer.id);
      expect(enabled.status).toBe("ACTIVE");
    });

    it("rejects invalid status values", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "cust-status-invalid");

      const customer = await customerService.createCustomer(db, storeId, {
        email: "valid@example.com",
      });

      await expect(
        customerService.changeCustomerStatus(
          db,
          storeId,
          customer.id,
          "UNKNOWN" as unknown as CustomerStatus,
        ),
      ).rejects.toThrow(InvalidCustomerStatusError);
    });
  });

  describe("Customer Listing (listCustomers)", () => {
    it("lists customers scoped strictly to the requested store", async () => {
      const db = await setupDb();
      const { storeId: storeA } = await seedTestStore(db, "list-store-a");
      const { storeId: storeB } = await seedTestStore(db, "list-store-b");

      await customerService.createCustomer(db, storeA, { email: "a1@example.com" });
      await customerService.createCustomer(db, storeA, { email: "a2@example.com" });
      await customerService.createCustomer(db, storeB, { email: "b1@example.com" });

      const listA = await customerService.listCustomers(db, storeA);
      expect(listA.items).toHaveLength(2);
      expect(listA.items.map((c) => c.email).sort()).toEqual([
        "a1@example.com",
        "a2@example.com",
      ]);

      const listB = await customerService.listCustomers(db, storeB);
      expect(listB.items).toHaveLength(1);
      expect(listB.items[0]!.email).toBe("b1@example.com");
    });

    it("filters customer listing by status", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "list-filter-status");

      const c1 = await customerService.createCustomer(db, storeId, { email: "c1@test.com" });
      const c2 = await customerService.createCustomer(db, storeId, { email: "c2@test.com" });
      await customerService.disableCustomer(db, storeId, c2.id);

      const activeOnly = await customerService.listCustomers(db, storeId, {
        status: "ACTIVE",
      });
      expect(activeOnly.items).toHaveLength(1);
      expect(activeOnly.items[0]!.id).toBe(c1.id);

      const disabledOnly = await customerService.listCustomers(db, storeId, {
        status: "DISABLED",
      });
      expect(disabledOnly.items).toHaveLength(1);
      expect(disabledOnly.items[0]!.id).toBe(c2.id);
    });

    it("filters customer listing by search term", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "list-filter-search");

      await customerService.createCustomer(db, storeId, {
        email: "alice@company.com",
        firstName: "Alice",
        lastName: "Smith",
      });
      await customerService.createCustomer(db, storeId, {
        email: "bob@other.com",
        firstName: "Bob",
        lastName: "Jones",
      });

      const searchEmail = await customerService.listCustomers(db, storeId, {
        search: "alice",
      });
      expect(searchEmail.items).toHaveLength(1);
      expect(searchEmail.items[0]!.email).toBe("alice@company.com");

      const searchName = await customerService.listCustomers(db, storeId, {
        search: "Jones",
      });
      expect(searchName.items).toHaveLength(1);
      expect(searchName.items[0]!.lastName).toBe("Jones");
    });

    it("paginates customer listing with deterministic ordering and nextCursor", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "list-paginate");

      for (let i = 1; i <= 5; i++) {
        await customerService.createCustomer(db, storeId, {
          email: `p${i}@example.com`,
        });
      }

      // Page 1: limit 2
      const page1 = await customerService.listCustomers(db, storeId, { limit: 2 });
      expect(page1.items).toHaveLength(2);
      expect(page1.hasMore).toBe(true);
      expect(page1.nextCursor).toBeDefined();

      // Page 2: limit 2 with cursor
      const page2 = await customerService.listCustomers(db, storeId, {
        limit: 2,
        cursor: page1.nextCursor,
      });
      expect(page2.items).toHaveLength(2);
      expect(page2.hasMore).toBe(true);
      expect(page2.nextCursor).toBeDefined();

      // Ensure distinct items
      const idsPage1 = page1.items.map((c) => c.id);
      const idsPage2 = page2.items.map((c) => c.id);
      for (const id of idsPage2) {
        expect(idsPage1).not.toContain(id);
      }

      // Page 3: remaining 1
      const page3 = await customerService.listCustomers(db, storeId, {
        limit: 2,
        cursor: page2.nextCursor,
      });
      expect(page3.items).toHaveLength(1);
      expect(page3.hasMore).toBe(false);
      expect(page3.nextCursor).toBeUndefined();
    });
  });

  describe("Customer Addresses", () => {
    it("creates, retrieves, and lists customer addresses", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "addr-crud-1");

      const customer = await customerService.createCustomer(db, storeId, {
        email: "addr@example.com",
      });

      const addr = await customerService.createAddress(db, storeId, customer.id, {
        firstName: "John",
        lastName: "Doe",
        company: "Acme Corp",
        addressLine1: "100 Pine St",
        addressLine2: "Suite 400",
        city: "Seattle",
        state: "WA",
        postalCode: "98101",
        country: "US",
        phone: "555-0199",
        label: "Headquarters",
        isDefault: false,
      });

      expect(addr.id).toBeDefined();
      expect(addr.storeId).toBe(storeId);
      expect(addr.customerId).toBe(customer.id);
      expect(addr.addressLine1).toBe("100 Pine St");
      expect(addr.addressLine2).toBe("Suite 400");
      expect(addr.city).toBe("Seattle");
      expect(addr.state).toBe("WA");
      expect(addr.postalCode).toBe("98101");
      expect(addr.country).toBe("US");
      expect(addr.isDefault).toBe(false);

      const fetched = await customerService.getAddressById(
        db,
        storeId,
        customer.id,
        addr.id,
      );
      expect(fetched.id).toBe(addr.id);

      const list = await customerService.listAddresses(db, storeId, customer.id);
      expect(list).toHaveLength(1);
      expect(list[0]!.id).toBe(addr.id);
    });

    it("rejects address creation when required fields are missing or empty", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "addr-valid-err");

      const customer = await customerService.createCustomer(db, storeId, {
        email: "badaddr@example.com",
      });

      // Missing line 1
      await expect(
        customerService.createAddress(db, storeId, customer.id, {
          addressLine1: "   ",
          city: "Denver",
          postalCode: "80202",
          country: "US",
        }),
      ).rejects.toThrow(InvalidAddressError);

      // Missing city
      await expect(
        customerService.createAddress(db, storeId, customer.id, {
          addressLine1: "123 Aspen Way",
          city: "",
          postalCode: "80202",
          country: "US",
        }),
      ).rejects.toThrow(InvalidAddressError);
    });

    it("updates address partially and preserves invariants", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "addr-upd-1");

      const customer = await customerService.createCustomer(db, storeId, {
        email: "updaddr@example.com",
      });

      const addr = await customerService.createAddress(db, storeId, customer.id, {
        addressLine1: "100 Old Rd",
        city: "Boston",
        postalCode: "02108",
        country: "US",
      });

      const updated = await customerService.updateAddress(
        db,
        storeId,
        customer.id,
        addr.id,
        {
          addressLine1: "200 New Blvd",
          city: "Cambridge",
        },
      );

      expect(updated.addressLine1).toBe("200 New Blvd");
      expect(updated.city).toBe("Cambridge");
      expect(updated.postalCode).toBe("02108"); // Untouched
    });

    it("deletes address and confirms deletion", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "addr-del-1");

      const customer = await customerService.createCustomer(db, storeId, {
        email: "deladdr@example.com",
      });

      const addr = await customerService.createAddress(db, storeId, customer.id, {
        addressLine1: "300 Delete Way",
        city: "Miami",
        postalCode: "33101",
        country: "US",
      });

      await customerService.deleteAddress(db, storeId, customer.id, addr.id);

      // Subsequent get must throw AddressNotFoundError
      await expect(
        customerService.getAddressById(db, storeId, customer.id, addr.id),
      ).rejects.toThrow(AddressNotFoundError);

      const list = await customerService.listAddresses(db, storeId, customer.id);
      expect(list).toHaveLength(0);
    });

    it("strictly isolates cross-store address access", async () => {
      const db = await setupDb();
      const { storeId: storeA } = await seedTestStore(db, "iso-addr-a");
      const { storeId: storeB } = await seedTestStore(db, "iso-addr-b");

      const custA = await customerService.createCustomer(db, storeA, {
        email: "a@test.com",
      });
      const custB = await customerService.createCustomer(db, storeB, {
        email: "b@test.com",
      });

      const addrB = await customerService.createAddress(db, storeB, custB.id, {
        addressLine1: "Secret B Road",
        city: "Secret City",
        postalCode: "00000",
        country: "US",
      });

      // Store A cannot get Address B
      await expect(
        customerService.getAddressById(db, storeA, custA.id, addrB.id),
      ).rejects.toThrow(CrossStoreAddressAccessError);

      // Store A cannot update Address B
      await expect(
        customerService.updateAddress(db, storeA, custA.id, addrB.id, {
          city: "Hacked City",
        }),
      ).rejects.toThrow(CrossStoreAddressAccessError);

      // Store A cannot delete Address B
      await expect(
        customerService.deleteAddress(db, storeA, custA.id, addrB.id),
      ).rejects.toThrow(CrossStoreAddressAccessError);
    });

    it("strictly prevents accessing an address belonging to another customer within same store", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "iso-same-store-diff-cust");

      const custA = await customerService.createCustomer(db, storeId, {
        email: "cust.a@test.com",
      });
      const custB = await customerService.createCustomer(db, storeId, {
        email: "cust.b@test.com",
      });

      const addrB = await customerService.createAddress(db, storeId, custB.id, {
        addressLine1: "Customer B Home",
        city: "Chicago",
        postalCode: "60601",
        country: "US",
      });

      // Customer A cannot get Customer B's address
      await expect(
        customerService.getAddressById(db, storeId, custA.id, addrB.id),
      ).rejects.toThrow(CrossStoreAddressAccessError);

      // Customer A cannot update Customer B's address
      await expect(
        customerService.updateAddress(db, storeId, custA.id, addrB.id, {
          city: "Attempted Update",
        }),
      ).rejects.toThrow(CrossStoreAddressAccessError);

      // Customer A cannot delete Customer B's address
      await expect(
        customerService.deleteAddress(db, storeId, custA.id, addrB.id),
      ).rejects.toThrow(CrossStoreAddressAccessError);
    });
  });

  describe("Default Address Handling", () => {
    it("atomically switches default address from Address A to Address B", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "def-addr-switch");

      const customer = await customerService.createCustomer(db, storeId, {
        email: "defaultswitch@example.com",
      });

      const addrA = await customerService.createAddress(db, storeId, customer.id, {
        addressLine1: "111 First Ave",
        city: "Portland",
        postalCode: "97201",
        country: "US",
        isDefault: true,
      });

      const addrB = await customerService.createAddress(db, storeId, customer.id, {
        addressLine1: "222 Second Ave",
        city: "Portland",
        postalCode: "97202",
        country: "US",
        isDefault: false,
      });

      expect(addrA.isDefault).toBe(true);
      expect(addrB.isDefault).toBe(false);

      // Switch default to B
      const newDefault = await customerService.setDefaultAddress(
        db,
        storeId,
        customer.id,
        addrB.id,
      );
      expect(newDefault.id).toBe(addrB.id);
      expect(newDefault.isDefault).toBe(true);

      // Verify in DB that addrA is no longer default and addrB is default
      const refreshedA = await customerService.getAddressById(
        db,
        storeId,
        customer.id,
        addrA.id,
      );
      const refreshedB = await customerService.getAddressById(
        db,
        storeId,
        customer.id,
        addrB.id,
      );

      expect(refreshedA.isDefault).toBe(false);
      expect(refreshedB.isDefault).toBe(true);

      // Verify at most 1 default address exists in DB
      const res = await db.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM customer_addresses
         WHERE customer_id = $1 AND is_default = TRUE`,
        [customer.id],
      );
      expect(Number(res.rows[0]!.count)).toBe(1);
    });

    it("calling setDefaultAddress on already default address is a safe no-op", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "def-addr-noop");

      const customer = await customerService.createCustomer(db, storeId, {
        email: "noop@example.com",
      });

      const addr = await customerService.createAddress(db, storeId, customer.id, {
        addressLine1: "555 Same St",
        city: "Dallas",
        postalCode: "75201",
        country: "US",
        isDefault: true,
      });

      const result = await customerService.setDefaultAddress(
        db,
        storeId,
        customer.id,
        addr.id,
      );
      expect(result.id).toBe(addr.id);
      expect(result.isDefault).toBe(true);
    });

    it("updating an address to isDefault: true clears existing default", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "def-addr-upd");

      const customer = await customerService.createCustomer(db, storeId, {
        email: "upddef@example.com",
      });

      const addrA = await customerService.createAddress(db, storeId, customer.id, {
        addressLine1: "Addr A",
        city: "Houston",
        postalCode: "77001",
        country: "US",
        isDefault: true,
      });

      const addrB = await customerService.createAddress(db, storeId, customer.id, {
        addressLine1: "Addr B",
        city: "Houston",
        postalCode: "77002",
        country: "US",
        isDefault: false,
      });

      await customerService.updateAddress(db, storeId, customer.id, addrB.id, {
        isDefault: true,
      });

      const refreshedA = await customerService.getAddressById(
        db,
        storeId,
        customer.id,
        addrA.id,
      );
      const refreshedB = await customerService.getAddressById(
        db,
        storeId,
        customer.id,
        addrB.id,
      );

      expect(refreshedA.isDefault).toBe(false);
      expect(refreshedB.isDefault).toBe(true);
    });
  });

  describe("Concurrency & Race Conditions", () => {
    it("safely handles concurrent duplicate customer creation without unhandled DB error", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "concurrent-cust");

      const targetEmail = "race@example.com";

      // Fire 2 simultaneous customer creation requests with same email
      const results = await Promise.allSettled([
        customerService.createCustomer(db, storeId, { email: targetEmail, firstName: "Req 1" }),
        customerService.createCustomer(db, storeId, { email: targetEmail, firstName: "Req 2" }),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      // Exactly 1 must succeed and 1 must fail with CustomerAlreadyExistsError or DuplicateCustomerError
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      const rejectionReason = (rejected[0] as PromiseRejectedResult).reason;
      expect(
        rejectionReason instanceof CustomerAlreadyExistsError ||
          rejectionReason instanceof DuplicateCustomerError,
      ).toBe(true);

      // Verify only 1 customer exists in DB
      const res = await db.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM customers WHERE store_id = $1 AND email = $2`,
        [storeId, targetEmail],
      );
      expect(Number(res.rows[0]!.count)).toBe(1);
    });

    it("safely handles concurrent default address changes preserving at most 1 default invariant", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "concurrent-default");

      const customer = await customerService.createCustomer(db, storeId, {
        email: "concurrent-default@example.com",
      });

      const addr1 = await customerService.createAddress(db, storeId, customer.id, {
        addressLine1: "Addr 1",
        city: "Atlanta",
        postalCode: "30301",
        country: "US",
        isDefault: false,
      });

      const addr2 = await customerService.createAddress(db, storeId, customer.id, {
        addressLine1: "Addr 2",
        city: "Atlanta",
        postalCode: "30302",
        country: "US",
        isDefault: false,
      });

      // Fire simultaneous requests to set different addresses as default
      const results = await Promise.allSettled([
        customerService.setDefaultAddress(db, storeId, customer.id, addr1.id),
        customerService.setDefaultAddress(db, storeId, customer.id, addr2.id),
      ]);

      // At least 1 must succeed; if one hits a concurrency conflict it must be DefaultAddressConflictError
      for (const r of results) {
        if (r.status === "rejected") {
          expect(r.reason instanceof DefaultAddressConflictError).toBe(true);
        }
      }

      // Crucial database invariant check:
      // PostgreSQL partial unique index ensures COUNT(WHERE is_default = TRUE) <= 1
      const countRes = await db.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM customer_addresses
         WHERE customer_id = $1 AND is_default = TRUE`,
        [customer.id],
      );
      expect(Number(countRes.rows[0]!.count)).toBeLessThanOrEqual(1);
    });
  });

  describe("Transaction Integrity & Rollback", () => {
    it("rolls back all changes when an error occurs in a multi-step transaction", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "tx-rollback");

      await expect(
        db.withTransaction(async (tx) => {
          // 1. Create a customer inside transaction
          const customer = await customerService.createCustomer(tx, storeId, {
            email: "rollback@example.com",
            firstName: "Doomed",
          });

          // 2. Create an address for that customer
          await customerService.createAddress(tx, storeId, customer.id, {
            addressLine1: "Temporary St",
            city: "Ghost Town",
            postalCode: "00000",
            country: "US",
          });

          // 3. Force an unexpected failure
          throw new Error("Simulated downstream system crash");
        }),
      ).rejects.toThrow("Simulated downstream system crash");

      // Verify that neither the customer nor the address exists in PostgreSQL
      const custRes = await db.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM customers WHERE email = 'rollback@example.com'`,
      );
      expect(Number(custRes.rows[0]!.count)).toBe(0);

      const addrRes = await db.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM customer_addresses WHERE city = 'Ghost Town'`,
      );
      expect(Number(addrRes.rows[0]!.count)).toBe(0);
    });
  });

  describe("Customer Order Summary & Spending Aggregation", () => {
    it("aggregates order count and total spend excluding cancelled, refunded, and failed orders", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "cust-orders-1");
      const orderRepo = new OrderRepository();
      const orderService = new OrderService();
      const serviceWithOrders = new CustomerService(undefined, orderService);

      const customer1 = await customerService.createCustomer(db, storeId, {
        email: "shopper1@example.com",
        firstName: "Shopper",
        lastName: "One",
        phone: "+1-555-1234",
      });

      const customer2 = await customerService.createCustomer(db, storeId, {
        email: "shopper2@example.com",
        firstName: "Shopper",
        lastName: "Two",
      });

      // Insert orders for customer1
      // 1. Non-cancelled, paid order: $50.00 (5000 cents) -> included in spend
      await orderRepo.create(db, {
        id: generateUuidV7(),
        storeId,
        customerId: customer1.id,
        orderNumber: "ORD-001",
        status: "DELIVERED",
        paymentStatus: "PAID",
        currency: "USD",
        total: 5000,
        grandTotal: 5000,
      });

      // 2. Non-cancelled, paid order: $30.00 (3000 cents) -> included in spend
      await orderRepo.create(db, {
        id: generateUuidV7(),
        storeId,
        customerId: customer1.id,
        orderNumber: "ORD-002",
        status: "PROCESSING",
        paymentStatus: "PAID",
        currency: "USD",
        total: 3000,
        grandTotal: 3000,
      });

      // 3. Cancelled order: $20.00 (2000 cents) -> excluded from spend, counted in orderCount
      await orderRepo.create(db, {
        id: generateUuidV7(),
        storeId,
        customerId: customer1.id,
        orderNumber: "ORD-003",
        status: "CANCELLED",
        paymentStatus: "PAID",
        currency: "USD",
        total: 2000,
        grandTotal: 2000,
      });

      // 4. Refunded order: $15.00 (1500 cents) -> excluded from spend, counted in orderCount
      await orderRepo.create(db, {
        id: generateUuidV7(),
        storeId,
        customerId: customer1.id,
        orderNumber: "ORD-004",
        status: "COMPLETED",
        paymentStatus: "REFUNDED",
        currency: "USD",
        total: 1500,
        grandTotal: 1500,
      });

      // 5. Failed payment order: $10.00 (1000 cents) -> excluded from spend, counted in orderCount
      await orderRepo.create(db, {
        id: generateUuidV7(),
        storeId,
        customerId: customer1.id,
        orderNumber: "ORD-005",
        status: "PENDING",
        paymentStatus: "FAILED",
        currency: "USD",
        total: 1000,
        grandTotal: 1000,
      });

      // Test individual customer order summary
      const summary1 = await orderService.getCustomerOrderSummary(db, storeId, customer1.id);
      expect(summary1.orderCount).toBe(5);
      expect(summary1.totalSpend).toBe(8000); // 5000 + 3000 (cancelled, refunded, failed excluded)
      expect(summary1.lastOrderAt).toBeDefined();

      const summary2 = await orderService.getCustomerOrderSummary(db, storeId, customer2.id);
      expect(summary2.orderCount).toBe(0);
      expect(summary2.totalSpend).toBe(0);
      expect(summary2.lastOrderAt).toBeNull();

      // Test batch customer order summaries (no N+1)
      const batchSummaries = await orderService.getCustomerOrderSummaries(db, storeId, [
        customer1.id,
        customer2.id,
      ]);
      expect(batchSummaries[customer1.id]?.orderCount).toBe(5);
      expect(batchSummaries[customer1.id]?.totalSpend).toBe(8000);
      expect(batchSummaries[customer2.id]).toBeUndefined();

      // Test customerService integration with OrderService
      const listRes = await serviceWithOrders.listCustomers(db, storeId);
      const cust1FromList = listRes.items.find((c) => c.id === customer1.id);
      const cust2FromList = listRes.items.find((c) => c.id === customer2.id);

      expect(cust1FromList?.ordersCount).toBe(5);
      expect(cust1FromList?.totalSpend).toBe(8000);
      expect(cust1FromList?.lastOrderAt).toBeDefined();

      expect(cust2FromList?.ordersCount).toBe(0);
      expect(cust2FromList?.totalSpend).toBe(0);
      expect(cust2FromList?.lastOrderAt).toBeNull();

      // Test getCustomerWithAddresses
      const cust1Detail = await serviceWithOrders.getCustomerWithAddresses(db, storeId, customer1.id);
      expect(cust1Detail.ordersCount).toBe(5);
      expect(cust1Detail.totalSpend).toBe(8000);

      // Test customer search by phone
      const phoneSearch = await serviceWithOrders.listCustomers(db, storeId, {
        search: "1234",
      });
      expect(phoneSearch.items).toHaveLength(1);
      expect(phoneSearch.items[0]!.id).toBe(customer1.id);
    });

    it("enforces tenant store isolation on customer order summaries", async () => {
      const db = await setupDb();
      const { storeId: storeA } = await seedTestStore(db, "store-iso-a");
      const { storeId: storeB } = await seedTestStore(db, "store-iso-b");
      const orderRepo = new OrderRepository();
      const orderService = new OrderService();

      const customerA = await customerService.createCustomer(db, storeA, {
        email: "isolated@example.com",
      });

      // Create order for customer in Store A
      await orderRepo.create(db, {
        id: generateUuidV7(),
        storeId: storeA,
        customerId: customerA.id,
        orderNumber: "ORD-STORE-A",
        status: "DELIVERED",
        paymentStatus: "PAID",
        currency: "USD",
        total: 5000,
        grandTotal: 5000,
      });

      // In Store B, querying customerA should return 0 orders / 0 spend (tenant-scoped)
      const summaryInStoreB = await orderService.getCustomerOrderSummary(db, storeB, customerA.id);
      expect(summaryInStoreB.orderCount).toBe(0);
      expect(summaryInStoreB.totalSpend).toBe(0);
      expect(summaryInStoreB.lastOrderAt).toBeNull();
    });
  });
});
