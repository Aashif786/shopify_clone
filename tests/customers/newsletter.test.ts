import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@calcart/db";
import {
  NewsletterService,
  NewsletterRepository,
  InvalidCustomerEmailError,
} from "@calcart/customers";
import { createIsolatedDatabase } from "../helpers/postgres.js";

describe("Newsletter Application Service & Repository Integration (Bug I)", { timeout: 60_000 }, () => {
  let db: Database;
  let close: (() => Promise<void>) | undefined;
  const newsletterService = new NewsletterService();
  const repo = new NewsletterRepository();

  beforeAll(async () => {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    db = isolated.database;
  }, 60_000);

  afterAll(async () => {
    if (close) {
      await close();
      close = undefined;
    }
  });

  async function seedTestStore(
    slug: string,
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

  describe("Validation", () => {
    it("fails closed on invalid or empty email format", async () => {
      const { storeId } = await seedTestStore(`val-store-${Date.now()}`);

      await expect(
        newsletterService.subscribe(db, storeId, { email: "" }),
      ).rejects.toThrow(InvalidCustomerEmailError);

      await expect(
        newsletterService.subscribe(db, storeId, { email: "not-an-email" }),
      ).rejects.toThrow(InvalidCustomerEmailError);

      await expect(
        newsletterService.subscribe(db, storeId, { email: "user@" }),
      ).rejects.toThrow(InvalidCustomerEmailError);
    });

    it("requires a non-empty storeId", async () => {
      await expect(
        newsletterService.subscribe(db, "", { email: "hello@domain.com" }),
      ).rejects.toThrow("storeId is required");
    });
  });

  describe("Subscription & Idempotency", () => {
    it("successfully creates a new subscriber in the store", async () => {
      const { storeId } = await seedTestStore(`sub-store-${Date.now()}`);

      const result = await newsletterService.subscribe(db, storeId, {
        email: "Visitor@Brand.COM  ",
        source: "STOREFRONT_LANDING",
      });

      expect(result.isNew).toBe(true);
      expect(result.subscriber.email).toBe("visitor@brand.com");
      expect(result.subscriber.status).toBe("SUBSCRIBED");
      expect(result.subscriber.source).toBe("STOREFRONT_LANDING");
      expect(result.subscriber.unsubscribedAt).toBeNull();
      expect(result.message).toContain("Thank you for subscribing");

      // Verify in DB
      const inDb = await repo.findByStoreAndEmail(db, storeId, "visitor@brand.com");
      expect(inDb).not.toBeNull();
      expect(inDb?.email).toBe("visitor@brand.com");
      expect(inDb?.status).toBe("SUBSCRIBED");
    });

    it("is idempotent on repeated subscription without duplicate errors", async () => {
      const { storeId } = await seedTestStore(`idemp-store-${Date.now()}`);

      const first = await newsletterService.subscribe(db, storeId, {
        email: "repeat@customer.com",
      });
      expect(first.isNew).toBe(true);

      const second = await newsletterService.subscribe(db, storeId, {
        email: "repeat@customer.com",
      });
      expect(second.isNew).toBe(false);
      expect(second.subscriber.id).toBe(first.subscriber.id);
      expect(second.message).toContain("already subscribed");

      // Verify row count is 1
      const count = await repo.countByStore(db, storeId);
      expect(count.total).toBe(1);
      expect(count.active).toBe(1);
    });

    it("resubscribes an unsubscribed user and clears unsubscribedAt", async () => {
      const { storeId } = await seedTestStore(`resub-store-${Date.now()}`);

      await newsletterService.subscribe(db, storeId, { email: "churn@domain.com" });
      const unsub = await newsletterService.unsubscribe(db, storeId, "churn@domain.com");
      expect(unsub.success).toBe(true);

      const churned = await repo.findByStoreAndEmail(db, storeId, "churn@domain.com");
      expect(churned?.status).toBe("UNSUBSCRIBED");
      expect(churned?.unsubscribedAt).not.toBeNull();

      // Resubscribe
      const resub = await newsletterService.subscribe(db, storeId, { email: "churn@domain.com" });
      expect(resub.subscriber.status).toBe("SUBSCRIBED");
      expect(resub.subscriber.unsubscribedAt).toBeNull();

      const activeCount = await repo.countByStore(db, storeId);
      expect(activeCount.total).toBe(1);
      expect(activeCount.active).toBe(1);
    });
  });

  describe("Tenant Isolation", () => {
    it("isolates subscribers across stores for the same email address", async () => {
      const { storeId: storeA } = await seedTestStore(`iso-store-a-${Date.now()}`);
      const { storeId: storeB } = await seedTestStore(`iso-store-b-${Date.now()}`);

      const subA = await newsletterService.subscribe(db, storeA, { email: "shopper@calcart.test" });
      const subB = await newsletterService.subscribe(db, storeB, { email: "shopper@calcart.test" });

      expect(subA.subscriber.id).not.toBe(subB.subscriber.id);
      expect(subA.subscriber.storeId).toBe(storeA);
      expect(subB.subscriber.storeId).toBe(storeB);

      // Store A counts
      const countA = await repo.countByStore(db, storeA);
      expect(countA.total).toBe(1);

      // Unsubscribing in Store A does not affect Store B
      await newsletterService.unsubscribe(db, storeA, "shopper@calcart.test");

      const recordA = await repo.findByStoreAndEmail(db, storeA, "shopper@calcart.test");
      const recordB = await repo.findByStoreAndEmail(db, storeB, "shopper@calcart.test");

      expect(recordA?.status).toBe("UNSUBSCRIBED");
      expect(recordB?.status).toBe("SUBSCRIBED");
    });
  });
});
