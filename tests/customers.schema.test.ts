import { afterEach, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@calcart/db";
import { createIsolatedDatabase } from "./helpers/postgres.js";

describe("Customers PostgreSQL Schema Integration", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;

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
    slug = "store-1",
  ): Promise<{ orgId: string; storeId: string }> {
    const orgId = generateUuidV7();
    const storeId = generateUuidV7();
    await db.query(
      `INSERT INTO organizations (id, name, status) VALUES ($1, $2, 'ACTIVE')`,
      [orgId, `Org ${slug}`],
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
    email = "user@test.com",
  ): Promise<string> {
    const userId = generateUuidV7();
    await db.query(
      `INSERT INTO users (id, email, name, password_hash, status)
       VALUES ($1, $2, 'Test User', 'hash', 'ACTIVE')`,
      [userId, email],
    );
    return userId;
  }

  describe("Customers Table Schema & Invariants", () => {
    it("creates valid customer with default ACTIVE status", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "cust-insert");
      const customerId = generateUuidV7();

      await db.query(
        `INSERT INTO customers (id, store_id, email, first_name, last_name, phone)
         VALUES ($1, $2, 'shopper@test.com', 'Alice', 'Smith', '+1234567890')`,
        [customerId, storeId],
      );

      const res = await db.query<{
        id: string;
        store_id: string;
        user_id: string | null;
        email: string;
        status: string;
        first_name: string;
      }>(`SELECT * FROM customers WHERE id = $1`, [customerId]);

      expect(res.rows).toHaveLength(1);
      const row = res.rows[0]!;
      expect(row.id).toBe(customerId);
      expect(row.store_id).toBe(storeId);
      expect(row.user_id).toBeNull();
      expect(row.email).toBe("shopper@test.com");
      expect(row.status).toBe("ACTIVE");
      expect(row.first_name).toBe("Alice");
    });

    it("associates customer with platform user successfully", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "cust-user");
      const userId = await seedTestUser(db, "member@platform.com");
      const customerId = generateUuidV7();

      await db.query(
        `INSERT INTO customers (id, store_id, user_id, email, status)
         VALUES ($1, $2, $3, 'member@platform.com', 'ACTIVE')`,
        [customerId, storeId, userId],
      );

      const res = await db.query<{ user_id: string }>(
        `SELECT user_id FROM customers WHERE id = $1`,
        [customerId],
      );
      expect(res.rows[0]!.user_id).toBe(userId);
    });

    it("enforces store-scoped email uniqueness (rejects duplicate email in same store)", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "cust-dup-email");

      await db.query(
        `INSERT INTO customers (id, store_id, email) VALUES ($1, $2, 'dup@test.com')`,
        [generateUuidV7(), storeId],
      );

      // Attempt second insert with same store and email
      await expect(
        db.query(
          `INSERT INTO customers (id, store_id, email) VALUES ($1, $2, 'dup@test.com')`,
          [generateUuidV7(), storeId],
        ),
      ).rejects.toThrow();
    });

    it("allows same email across different stores (store-scoped uniqueness)", async () => {
      const db = await setupDb();
      const storeA = await seedTestStore(db, "store-a");
      const storeB = await seedTestStore(db, "store-b");

      const idA = generateUuidV7();
      const idB = generateUuidV7();

      await db.query(
        `INSERT INTO customers (id, store_id, email) VALUES ($1, $2, 'common@test.com')`,
        [idA, storeA.storeId],
      );

      await expect(
        db.query(
          `INSERT INTO customers (id, store_id, email) VALUES ($1, $2, 'common@test.com')`,
          [idB, storeB.storeId],
        ),
      ).resolves.toBeDefined();
    });

    it("enforces email normalization check constraint (rejects uppercase or un-trimmed email)", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "cust-email-check");

      // Uppercase rejected
      await expect(
        db.query(
          `INSERT INTO customers (id, store_id, email) VALUES ($1, $2, 'UPPERCASE@TEST.COM')`,
          [generateUuidV7(), storeId],
        ),
      ).rejects.toThrow();

      // Leading/trailing whitespace rejected
      await expect(
        db.query(
          `INSERT INTO customers (id, store_id, email) VALUES ($1, $2, ' user@test.com ')`,
          [generateUuidV7(), storeId],
        ),
      ).rejects.toThrow();

      // Empty string rejected
      await expect(
        db.query(
          `INSERT INTO customers (id, store_id, email) VALUES ($1, $2, '')`,
          [generateUuidV7(), storeId],
        ),
      ).rejects.toThrow();
    });

    it("enforces status check constraint (rejects invalid status values)", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "cust-status-check");

      await expect(
        db.query(
          `INSERT INTO customers (id, store_id, email, status) VALUES ($1, $2, 'user@test.com', 'PENDING')`,
          [generateUuidV7(), storeId],
        ),
      ).rejects.toThrow();

      await expect(
        db.query(
          `INSERT INTO customers (id, store_id, email, status) VALUES ($1, $2, 'user@test.com', 'DELETED')`,
          [generateUuidV7(), storeId],
        ),
      ).rejects.toThrow();
    });

    it("enforces platform user uniqueness per store (at most one customer per user in a store)", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "cust-user-uniq");
      const userId = await seedTestUser(db, "unique@platform.com");

      await db.query(
        `INSERT INTO customers (id, store_id, user_id, email)
         VALUES ($1, $2, $3, 'first@store.com')`,
        [generateUuidV7(), storeId, userId],
      );

      // Attempt second customer with same userId in the same store
      await expect(
        db.query(
          `INSERT INTO customers (id, store_id, user_id, email)
           VALUES ($1, $2, $3, 'second@store.com')`,
          [generateUuidV7(), storeId, userId],
        ),
      ).rejects.toThrow();

      // Multiple guest customers (user_id IS NULL) must be allowed
      await expect(
        db.query(
          `INSERT INTO customers (id, store_id, user_id, email)
           VALUES ($1, $2, NULL, 'guest1@store.com')`,
          [generateUuidV7(), storeId],
        ),
      ).resolves.toBeDefined();

      await expect(
        db.query(
          `INSERT INTO customers (id, store_id, user_id, email)
           VALUES ($1, $2, NULL, 'guest2@store.com')`,
          [generateUuidV7(), storeId],
        ),
      ).resolves.toBeDefined();
    });
  });

  describe("Customer Addresses Schema & Tenant Constraints", () => {
    it("creates address successfully for a valid store customer", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "addr-insert");
      const customerId = generateUuidV7();
      await db.query(
        `INSERT INTO customers (id, store_id, email) VALUES ($1, $2, 'addr@test.com')`,
        [customerId, storeId],
      );

      const addressId = generateUuidV7();
      await db.query(
        `INSERT INTO customer_addresses (
           id, store_id, customer_id, address_line_1, city, postal_code, country, is_default
         ) VALUES ($1, $2, $3, '100 Main St', 'Boston', '02101', 'US', TRUE)`,
        [addressId, storeId, customerId],
      );

      const res = await db.query<{ id: string; is_default: boolean }>(
        `SELECT id, is_default FROM customer_addresses WHERE id = $1`,
        [addressId],
      );
      expect(res.rows).toHaveLength(1);
      expect(res.rows[0]!.is_default).toBe(true);
    });

    it("strictly prevents cross-store address association via composite foreign key", async () => {
      const db = await setupDb();
      const storeA = await seedTestStore(db, "store-a-addr");
      const storeB = await seedTestStore(db, "store-b-addr");

      // Customer belongs to Store A
      const customerId = generateUuidV7();
      await db.query(
        `INSERT INTO customers (id, store_id, email) VALUES ($1, $2, 'cust@a.com')`,
        [customerId, storeA.storeId],
      );

      // Attempt to create address for Customer A but specify store_id of Store B
      await expect(
        db.query(
          `INSERT INTO customer_addresses (
             id, store_id, customer_id, address_line_1, city, postal_code, country
           ) VALUES ($1, $2, $3, '123 Fake St', 'Anytown', '12345', 'US')`,
          [generateUuidV7(), storeB.storeId, customerId],
        ),
      ).rejects.toThrow();
    });

    it("enforces at most one default address per customer", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "addr-default-uniq");
      const customerId = generateUuidV7();
      await db.query(
        `INSERT INTO customers (id, store_id, email) VALUES ($1, $2, 'default@test.com')`,
        [customerId, storeId],
      );

      // Insert first default address -> OK
      await db.query(
        `INSERT INTO customer_addresses (
           id, store_id, customer_id, address_line_1, city, postal_code, country, is_default
         ) VALUES ($1, $2, $3, '1st Default St', 'City', '11111', 'US', TRUE)`,
        [generateUuidV7(), storeId, customerId],
      );

      // Insert second default address for same customer -> MUST FAIL
      await expect(
        db.query(
          `INSERT INTO customer_addresses (
             id, store_id, customer_id, address_line_1, city, postal_code, country, is_default
           ) VALUES ($1, $2, $3, '2nd Default St', 'City', '22222', 'US', TRUE)`,
          [generateUuidV7(), storeId, customerId],
        ),
      ).rejects.toThrow();

      // Multiple non-default addresses are permitted
      await expect(
        db.query(
          `INSERT INTO customer_addresses (
             id, store_id, customer_id, address_line_1, city, postal_code, country, is_default
           ) VALUES ($1, $2, $3, 'Non Default St 1', 'City', '33333', 'US', FALSE)`,
          [generateUuidV7(), storeId, customerId],
        ),
      ).resolves.toBeDefined();

      await expect(
        db.query(
          `INSERT INTO customer_addresses (
             id, store_id, customer_id, address_line_1, city, postal_code, country, is_default
           ) VALUES ($1, $2, $3, 'Non Default St 2', 'City', '44444', 'US', FALSE)`,
          [generateUuidV7(), storeId, customerId],
        ),
      ).resolves.toBeDefined();
    });

    it("rejects empty required address fields via CHECK constraints", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "addr-check-empty");
      const customerId = generateUuidV7();
      await db.query(
        `INSERT INTO customers (id, store_id, email) VALUES ($1, $2, 'empty@test.com')`,
        [customerId, storeId],
      );

      // Empty address_line_1
      await expect(
        db.query(
          `INSERT INTO customer_addresses (
             id, store_id, customer_id, address_line_1, city, postal_code, country
           ) VALUES ($1, $2, $3, '', 'City', '12345', 'US')`,
          [generateUuidV7(), storeId, customerId],
        ),
      ).rejects.toThrow();

      // Empty city
      await expect(
        db.query(
          `INSERT INTO customer_addresses (
             id, store_id, customer_id, address_line_1, city, postal_code, country
           ) VALUES ($1, $2, $3, '123 Line', '  ', '12345', 'US')`,
          [generateUuidV7(), storeId, customerId],
        ),
      ).rejects.toThrow();

      // Empty postal_code
      await expect(
        db.query(
          `INSERT INTO customer_addresses (
             id, store_id, customer_id, address_line_1, city, postal_code, country
           ) VALUES ($1, $2, $3, '123 Line', 'City', '', 'US')`,
          [generateUuidV7(), storeId, customerId],
        ),
      ).rejects.toThrow();

      // Empty country
      await expect(
        db.query(
          `INSERT INTO customer_addresses (
             id, store_id, customer_id, address_line_1, city, postal_code, country
           ) VALUES ($1, $2, $3, '123 Line', 'City', '12345', '')`,
          [generateUuidV7(), storeId, customerId],
        ),
      ).rejects.toThrow();
    });

    it("cascade deletes customer addresses when parent customer is deleted", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "addr-cascade");
      const customerId = generateUuidV7();
      await db.query(
        `INSERT INTO customers (id, store_id, email) VALUES ($1, $2, 'cascade@test.com')`,
        [customerId, storeId],
      );

      const addressId = generateUuidV7();
      await db.query(
        `INSERT INTO customer_addresses (
           id, store_id, customer_id, address_line_1, city, postal_code, country
         ) VALUES ($1, $2, $3, '123 Cascade St', 'City', '12345', 'US')`,
        [addressId, storeId, customerId],
      );

      // Delete customer
      await db.query(`DELETE FROM customers WHERE id = $1`, [customerId]);

      // Verify address was cascade-deleted
      const res = await db.query(
        `SELECT id FROM customer_addresses WHERE id = $1`,
        [addressId],
      );
      expect(res.rows).toHaveLength(0);
    });

    it("restricts store deletion when customer records exist", async () => {
      const db = await setupDb();
      const { storeId } = await seedTestStore(db, "store-restrict");
      await db.query(
        `INSERT INTO customers (id, store_id, email) VALUES ($1, $2, 'restrict@test.com')`,
        [generateUuidV7(), storeId],
      );

      // Attempt deleting store -> restricted
      await expect(
        db.query(`DELETE FROM stores WHERE id = $1`, [storeId]),
      ).rejects.toThrow();
    });
  });
});
