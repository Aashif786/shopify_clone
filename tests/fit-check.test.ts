import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateUuidV7, runMigrations, type Database } from "@calcart/db";
import {
  BodyProfileConsentRequiredError,
  BodyProfileNotFoundError,
  AVATAR_GENERATOR_VERSION,
  AvatarNotFoundError,
  BodyProfileService,
  CustomerService,
  InvalidBodyProfileError,
} from "@calcart/customers";
import {
  DuplicateStoreTypeKeyError,
  FitCheckNotEligibleError,
  InvalidStoreTypeError,
  StoreTypeInUseError,
  StoreTypeNotFoundError,
  StoreTypeService,
} from "@calcart/stores";
import { ForbiddenError } from "@calcart/tenant";
import { hasPlatformPermission } from "@calcart/platform-admin";
import { createIsolatedDatabase } from "./helpers/postgres.js";

const GOOD_MEASUREMENTS = {
  heightCm: 172.5,
  weightKg: 68,
  chestCm: 92,
  waistCm: 76,
  hipCm: 98,
};

describe("Fit Check: store types, activation and body profiles", { timeout: 120_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  let db: Database;
  const types = new StoreTypeService();
  const profiles = new BodyProfileService();
  const customers = new CustomerService();

  beforeAll(async () => {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    db = isolated.database;
  }, 120_000);

  afterAll(async () => {
    await close?.();
  });

  async function seedStore(slug: string): Promise<string> {
    const orgId = generateUuidV7();
    const storeId = generateUuidV7();
    await db.query(`INSERT INTO organizations (id, name, status) VALUES ($1, $2, 'ACTIVE')`, [
      orgId,
      `Org ${slug}`,
    ]);
    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, $3, $4, 'ACTIVE', 'USD', 'en-US', 'UTC')`,
      [storeId, orgId, `Store ${slug}`, slug],
    );
    return storeId;
  }

  async function seedMember(storeId: string, role: "owner" | "admin" | "staff", tag: string) {
    const userId = generateUuidV7();
    await db.query(
      `INSERT INTO users (id, email, name, password_hash, status)
       VALUES ($1, $2, 'Member', 'scrypt:hash', 'ACTIVE')`,
      [userId, `${tag}-${userId}@test.local`],
    );
    await db.query(
      `INSERT INTO store_memberships (id, store_id, user_id, role, status)
       VALUES ($1, $2, $3, $4, 'ACTIVE')`,
      [generateUuidV7(), storeId, userId, role],
    );
    return userId;
  }

  async function typeId(key: string): Promise<string> {
    const all = await types.listStoreTypes(db);
    const found = all.find((t) => t.key === key);
    if (!found) throw new Error(`missing seeded type ${key}`);
    return found.id;
  }

  async function seedCustomer(storeId: string, email: string) {
    return customers.createCustomer(db, storeId, { email });
  }

  describe("Phase 1: platform store-type management", () => {
    it("seeds default types and marks only clothing/fashion as fashion", async () => {
      const all = await types.listStoreTypes(db);
      expect(all.map((t) => t.key)).toEqual(
        expect.arrayContaining([
          "clothing_fashion",
          "electronics",
          "home_furniture",
          "beauty_personal_care",
          "sports_fitness",
          "grocery",
          "general_retail",
        ]),
      );
      expect(all.filter((t) => t.isFashion).map((t) => t.key)).toEqual(["clothing_fashion"]);
    });

    it("creates, edits and deletes an unused store type", async () => {
      const created = await types.createStoreType(db, {
        key: "  Jewellery_Watches ",
        name: "Jewellery",
        description: "Rings",
      });
      expect(created.key).toBe("jewellery_watches");
      expect(created.isFashion).toBe(false);

      const updated = await types.updateStoreType(db, created.id, {
        name: "Jewellery & Watches",
        isFashion: true,
      });
      expect(updated.name).toBe("Jewellery & Watches");
      expect(updated.isFashion).toBe(true);

      await expect(types.deleteStoreType(db, created.id)).resolves.toEqual({
        deleted: true,
        reassignedStores: 0,
      });
      await expect(types.getStoreType(db, created.id)).rejects.toBeInstanceOf(
        StoreTypeNotFoundError,
      );
    });

    it("rejects duplicate identifiers and invalid input", async () => {
      await expect(
        types.createStoreType(db, { key: "grocery", name: "Another grocery" }),
      ).rejects.toBeInstanceOf(DuplicateStoreTypeKeyError);
      await expect(
        types.createStoreType(db, { key: "Bad Key!", name: "x" }),
      ).rejects.toBeInstanceOf(InvalidStoreTypeError);
      await expect(
        types.createStoreType(db, { key: "ok_key", name: "   " }),
      ).rejects.toBeInstanceOf(InvalidStoreTypeError);

      const other = await types.createStoreType(db, { key: "dup_edit", name: "Dup edit" });
      await expect(
        types.updateStoreType(db, other.id, { key: "grocery" }),
      ).rejects.toBeInstanceOf(DuplicateStoreTypeKeyError);
    });

    it("blocks deleting a type in use unless stores are reassigned", async () => {
      const storeId = await seedStore("in-use-store");
      const t = await types.createStoreType(db, { key: "in_use_type", name: "In use" });
      await db.query(`UPDATE stores SET store_type_id = $1 WHERE id = $2`, [t.id, storeId]);

      await expect(types.deleteStoreType(db, t.id)).rejects.toBeInstanceOf(StoreTypeInUseError);

      const result = await types.deleteStoreType(db, t.id, {
        reassignToId: await typeId("electronics"),
      });
      expect(result.reassignedStores).toBe(1);
      const row = await db.query<{ key: string }>(
        `SELECT t.key FROM stores s JOIN store_types t ON t.id = s.store_type_id WHERE s.id = $1`,
        [storeId],
      );
      expect(row.rows[0]?.key).toBe("electronics");
    });

    it("disables Fit Check when a store is reassigned to a non-fashion type", async () => {
      const storeId = await seedStore("reassign-fit-store");
      const owner = await seedMember(storeId, "owner", "reassign");
      const fashion = await types.createStoreType(db, {
        key: "temp_fashion",
        name: "Temp fashion",
        isFashion: true,
      });
      await types.setStoreType(db, storeId, owner, { storeTypeId: fashion.id });
      await types.setFitCheckEnabled(db, storeId, owner, true);

      await types.deleteStoreType(db, fashion.id, { reassignToId: await typeId("general_retail") });
      expect(await types.isFitCheckActive(db, storeId)).toBe(false);
    });

    it("cannot reassign to the type being deleted or to a missing type", async () => {
      const storeId = await seedStore("bad-reassign-store");
      const t = await types.createStoreType(db, { key: "bad_reassign", name: "Bad reassign" });
      await db.query(`UPDATE stores SET store_type_id = $1 WHERE id = $2`, [t.id, storeId]);
      await expect(
        types.deleteStoreType(db, t.id, { reassignToId: t.id }),
      ).rejects.toBeInstanceOf(InvalidStoreTypeError);
      await expect(
        types.deleteStoreType(db, t.id, { reassignToId: generateUuidV7() }),
      ).rejects.toBeInstanceOf(StoreTypeNotFoundError);
    });

    it("turning off the fashion flag disables Fit Check on its stores", async () => {
      const storeId = await seedStore("unflag-store");
      const owner = await seedMember(storeId, "owner", "unflag");
      const t = await types.createStoreType(db, {
        key: "unflag_type",
        name: "Unflag",
        isFashion: true,
      });
      await types.setStoreType(db, storeId, owner, { storeTypeId: t.id });
      await types.setFitCheckEnabled(db, storeId, owner, true);

      await types.updateStoreType(db, t.id, { isFashion: false });
      expect(await types.isFitCheckActive(db, storeId)).toBe(false);
      const c = await types.getStoreClassification(db, storeId, owner);
      expect(c.fitCheckEnabled).toBe(false);
    });

    it("limits management to roles holding stores:write", () => {
      expect(hasPlatformPermission("super_admin", "stores:write")).toBe(true);
      expect(hasPlatformPermission("platform_admin", "stores:write")).toBe(true);
      expect(hasPlatformPermission("analyst", "stores:write")).toBe(false);
      expect(hasPlatformPermission("finance_admin", "stores:write")).toBe(false);
    });

    it("classifies pre-existing and newly inserted stores as general_retail with Fit Check off", async () => {
      const storeId = await seedStore("default-class-store");
      const row = await db.query<{ key: string; fit_check_enabled: boolean }>(
        `SELECT t.key, s.fit_check_enabled FROM stores s
         JOIN store_types t ON t.id = s.store_type_id WHERE s.id = $1`,
        [storeId],
      );
      expect(row.rows[0]).toEqual({ key: "general_retail", fit_check_enabled: false });
    });
  });

  describe("Phase 2: merchant classification and activation", () => {
    it("selecting Clothing does not enable Fit Check; activation is explicit", async () => {
      const storeId = await seedStore("clothing-store");
      const owner = await seedMember(storeId, "owner", "clothing");

      const afterType = await types.setStoreType(db, storeId, owner, {
        storeTypeId: await typeId("clothing_fashion"),
      });
      expect(afterType.fitCheckEligible).toBe(true);
      expect(afterType.fitCheckEnabled).toBe(false);
      expect(afterType.fitCheckActive).toBe(false);
      expect(await types.isFitCheckActive(db, storeId)).toBe(false);

      const enabled = await types.setFitCheckEnabled(db, storeId, owner, true);
      expect(enabled.fitCheckActive).toBe(true);
      expect(await types.isFitCheckActive(db, storeId)).toBe(true);

      const disabled = await types.setFitCheckEnabled(db, storeId, owner, false);
      expect(disabled.fitCheckEnabled).toBe(false);
    });

    it("rejects activation on non-eligible stores (service and database)", async () => {
      const storeId = await seedStore("electronics-store");
      const owner = await seedMember(storeId, "owner", "electronics");
      await types.setStoreType(db, storeId, owner, { storeTypeId: await typeId("electronics") });

      await expect(types.setFitCheckEnabled(db, storeId, owner, true)).rejects.toBeInstanceOf(
        FitCheckNotEligibleError,
      );
      // Direct SQL bypassing the service is rejected by the database trigger.
      await expect(
        db.query(`UPDATE stores SET fit_check_enabled = TRUE WHERE id = $1`, [storeId]),
      ).rejects.toThrow(/Fit Check requires/);
    });

    it("requires confirmation, then disables Fit Check on an incompatible type change", async () => {
      const storeId = await seedStore("switch-store");
      const owner = await seedMember(storeId, "owner", "switch");
      await types.setStoreType(db, storeId, owner, { storeTypeId: await typeId("clothing_fashion") });
      await types.setFitCheckEnabled(db, storeId, owner, true);

      const target = await typeId("grocery");
      await expect(
        types.setStoreType(db, storeId, owner, { storeTypeId: target }),
      ).rejects.toBeInstanceOf(InvalidStoreTypeError);
      expect(await types.isFitCheckActive(db, storeId)).toBe(true);

      const result = await types.setStoreType(db, storeId, owner, {
        storeTypeId: target,
        confirmDisableFitCheck: true,
      });
      expect(result.fitCheckDisabled).toBe(true);
      expect(result.fitCheckEnabled).toBe(false);
      expect(result.storeType.key).toBe("grocery");
    });

    it("switching between compatible types keeps Fit Check on", async () => {
      const storeId = await seedStore("compat-store");
      const owner = await seedMember(storeId, "owner", "compat");
      const fashion2 = await types.createStoreType(db, {
        key: "streetwear",
        name: "Streetwear",
        isFashion: true,
      });
      await types.setStoreType(db, storeId, owner, { storeTypeId: await typeId("clothing_fashion") });
      await types.setFitCheckEnabled(db, storeId, owner, true);
      const result = await types.setStoreType(db, storeId, owner, { storeTypeId: fashion2.id });
      expect(result.fitCheckDisabled).toBe(false);
      expect(result.fitCheckActive).toBe(true);
    });

    it("only owners/admins can change classification; non-members are denied", async () => {
      const storeId = await seedStore("auth-store");
      const staff = await seedMember(storeId, "staff", "staff");
      const otherStoreId = await seedStore("auth-other-store");
      const outsider = await seedMember(otherStoreId, "owner", "outsider");
      const clothing = await typeId("clothing_fashion");

      await expect(
        types.setStoreType(db, storeId, staff, { storeTypeId: clothing }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      await expect(types.setFitCheckEnabled(db, storeId, staff, true)).rejects.toBeInstanceOf(
        ForbiddenError,
      );
      await expect(
        types.setStoreType(db, storeId, outsider, { storeTypeId: clothing }),
      ).rejects.toThrow();
      await expect(types.getStoreClassification(db, storeId, outsider)).rejects.toThrow();
    });

    it("rejects an unknown store type id", async () => {
      const storeId = await seedStore("unknown-type-store");
      const owner = await seedMember(storeId, "owner", "unknown");
      await expect(
        types.setStoreType(db, storeId, owner, { storeTypeId: generateUuidV7() }),
      ).rejects.toBeInstanceOf(StoreTypeNotFoundError);
    });
  });

  describe("Phase 3: customer body profiles", () => {
    it("creates, reads, updates and deletes a profile", async () => {
      const storeId = await seedStore("profile-store");
      const c = await seedCustomer(storeId, "p1@example.com");

      expect(await profiles.getProfile(db, storeId, c.id)).toBeNull();

      const created = await profiles.saveProfile(db, storeId, c.id, {
        ...GOOD_MEASUREMENTS,
        consentAcknowledged: true,
      });
      expect(created.heightCm).toBe(172.5);
      expect(created.unitPreference).toBe("metric");

      const updated = await profiles.saveProfile(db, storeId, c.id, {
        ...GOOD_MEASUREMENTS,
        weightKg: 70.04,
        unitPreference: "imperial",
      });
      expect(updated.weightKg).toBe(70);
      expect(updated.unitPreference).toBe("imperial");
      expect(updated.consentAcknowledgedAt).toBe(created.consentAcknowledgedAt);

      expect((await profiles.getProfile(db, storeId, c.id))?.weightKg).toBe(70);

      await profiles.deleteProfile(db, storeId, c.id);
      expect(await profiles.getProfile(db, storeId, c.id)).toBeNull();
      await expect(profiles.deleteProfile(db, storeId, c.id)).rejects.toBeInstanceOf(
        BodyProfileNotFoundError,
      );
    });

    it("requires consent on first save only", async () => {
      const storeId = await seedStore("consent-store");
      const c = await seedCustomer(storeId, "consent@example.com");
      await expect(
        profiles.saveProfile(db, storeId, c.id, GOOD_MEASUREMENTS),
      ).rejects.toBeInstanceOf(BodyProfileConsentRequiredError);
      await expect(
        profiles.saveProfile(db, storeId, c.id, { ...GOOD_MEASUREMENTS, consentAcknowledged: false }),
      ).rejects.toBeInstanceOf(BodyProfileConsentRequiredError);
    });

    it("validates every measurement range and reports per-field errors", async () => {
      const storeId = await seedStore("validation-store");
      const c = await seedCustomer(storeId, "val@example.com");
      const attempt = (override: Partial<typeof GOOD_MEASUREMENTS>) =>
        profiles.saveProfile(db, storeId, c.id, {
          ...GOOD_MEASUREMENTS,
          ...override,
          consentAcknowledged: true,
        });

      for (const bad of [
        { heightCm: 99 },
        { heightCm: 251 },
        { weightKg: 24 },
        { weightKg: 301 },
        { chestCm: 49 },
        { waistCm: 39 },
        { hipCm: 221 },
        { heightCm: Number.NaN },
      ]) {
        await expect(attempt(bad)).rejects.toBeInstanceOf(InvalidBodyProfileError);
      }

      const err = await attempt({ heightCm: 10, waistCm: 500 }).catch((e) => e);
      expect(Object.keys(err.details.fields).sort()).toEqual(["heightCm", "waistCm"]);
      expect(await profiles.getProfile(db, storeId, c.id)).toBeNull();
    });

    it("keeps profiles private to the owning customer", async () => {
      const storeId = await seedStore("owner-store");
      const a = await seedCustomer(storeId, "a@example.com");
      const b = await seedCustomer(storeId, "b@example.com");
      await profiles.saveProfile(db, storeId, a.id, { ...GOOD_MEASUREMENTS, consentAcknowledged: true });

      expect(await profiles.getProfile(db, storeId, b.id)).toBeNull();
      await expect(profiles.deleteProfile(db, storeId, b.id)).rejects.toBeInstanceOf(
        BodyProfileNotFoundError,
      );
      expect(await profiles.getProfile(db, storeId, a.id)).not.toBeNull();
    });

    it("isolates profiles across stores", async () => {
      const storeA = await seedStore("iso-store-a");
      const storeB = await seedStore("iso-store-b");
      const ca = await seedCustomer(storeA, "same@example.com");
      const cb = await seedCustomer(storeB, "same@example.com");
      await profiles.saveProfile(db, storeA, ca.id, { ...GOOD_MEASUREMENTS, consentAcknowledged: true });

      // Wrong store/customer combinations never resolve a profile.
      expect(await profiles.getProfile(db, storeB, ca.id)).toBeNull();
      expect(await profiles.getProfile(db, storeB, cb.id)).toBeNull();
      await expect(
        profiles.saveProfile(db, storeB, ca.id, { ...GOOD_MEASUREMENTS, consentAcknowledged: true }),
      ).rejects.toThrow();
      await expect(profiles.deleteProfile(db, storeB, ca.id)).rejects.toBeInstanceOf(
        BodyProfileNotFoundError,
      );
      expect(await profiles.getProfile(db, storeA, ca.id)).not.toBeNull();
    });

    it("removes the profile when the customer is deleted", async () => {
      const storeId = await seedStore("cascade-store");
      const c = await seedCustomer(storeId, "cascade@example.com");
      await profiles.saveProfile(db, storeId, c.id, { ...GOOD_MEASUREMENTS, consentAcknowledged: true });
      await db.query(`DELETE FROM customers WHERE id = $1`, [c.id]);
      const left = await db.query(`SELECT 1 FROM customer_body_profiles WHERE customer_id = $1`, [c.id]);
      expect(left.rows).toHaveLength(0);
    });
  });

  describe("Phase 4: avatar generation and persistence", () => {
    it("generates and persists an avatar whenever a profile is saved", async () => {
      const storeId = await seedStore("avatar-store");
      const c = await seedCustomer(storeId, "av1@example.com");
      expect(await profiles.getAvatar(db, storeId, c.id)).toBeNull();

      await profiles.saveProfile(db, storeId, c.id, { ...GOOD_MEASUREMENTS, consentAcknowledged: true });
      const avatar = await profiles.getAvatar(db, storeId, c.id);
      expect(avatar?.generatorVersion).toBe(AVATAR_GENERATOR_VERSION);
      expect(avatar?.params.heightCm).toBe(172.5);
    });

    it("regenerates the avatar when measurements change", async () => {
      const storeId = await seedStore("avatar-regen-store");
      const c = await seedCustomer(storeId, "av2@example.com");
      await profiles.saveProfile(db, storeId, c.id, { ...GOOD_MEASUREMENTS, consentAcknowledged: true });
      const before = await profiles.getAvatar(db, storeId, c.id);

      await profiles.saveProfile(db, storeId, c.id, { ...GOOD_MEASUREMENTS, heightCm: 185, waistCm: 90 });
      const after = await profiles.getAvatar(db, storeId, c.id);
      expect(after?.params.heightCm).toBe(185);
      expect(after?.params.torsoRings).not.toEqual(before?.params.torsoRings);
      const count = await db.query(`SELECT 1 FROM customer_body_avatars WHERE customer_id = $1`, [c.id]);
      expect(count.rows).toHaveLength(1);
    });

    it("recreates a missing avatar on demand and refuses without a profile", async () => {
      const storeId = await seedStore("avatar-recover-store");
      const c = await seedCustomer(storeId, "av3@example.com");
      await expect(profiles.getOrCreateAvatar(db, storeId, c.id)).rejects.toBeInstanceOf(
        AvatarNotFoundError,
      );
      await profiles.saveProfile(db, storeId, c.id, { ...GOOD_MEASUREMENTS, consentAcknowledged: true });
      await db.query(`DELETE FROM customer_body_avatars WHERE customer_id = $1`, [c.id]);
      expect((await profiles.getOrCreateAvatar(db, storeId, c.id)).params.heightCm).toBe(172.5);
      expect((await profiles.regenerateAvatar(db, storeId, c.id)).generatorVersion).toBe(
        AVATAR_GENERATOR_VERSION,
      );
    });

    it("deletes the avatar together with the profile", async () => {
      const storeId = await seedStore("avatar-delete-store");
      const c = await seedCustomer(storeId, "av4@example.com");
      await profiles.saveProfile(db, storeId, c.id, { ...GOOD_MEASUREMENTS, consentAcknowledged: true });
      await profiles.deleteProfile(db, storeId, c.id);
      expect(await profiles.getAvatar(db, storeId, c.id)).toBeNull();
    });

    it("never exposes an avatar across customers or stores", async () => {
      const storeA = await seedStore("avatar-iso-a");
      const storeB = await seedStore("avatar-iso-b");
      const a = await seedCustomer(storeA, "iso-a@example.com");
      const other = await seedCustomer(storeA, "iso-other@example.com");
      const b = await seedCustomer(storeB, "iso-b@example.com");
      await profiles.saveProfile(db, storeA, a.id, { ...GOOD_MEASUREMENTS, consentAcknowledged: true });

      expect(await profiles.getAvatar(db, storeA, other.id)).toBeNull();
      expect(await profiles.getAvatar(db, storeB, a.id)).toBeNull();
      expect(await profiles.getAvatar(db, storeB, b.id)).toBeNull();
      await expect(profiles.regenerateAvatar(db, storeB, a.id)).rejects.toBeInstanceOf(
        BodyProfileNotFoundError,
      );
    });
  });
});
