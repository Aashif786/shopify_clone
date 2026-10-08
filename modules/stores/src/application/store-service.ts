import type { Database } from "@shopify-clone/db";
import { generateUuidV7 } from "@shopify-clone/db";
import { requireStoreAccess } from "@shopify-clone/tenant";
import {
  assertValidMembershipTransition,
  assertValidStoreTransition,
} from "../domain/lifecycle.js";
import {
  CannotRemoveLastOwnerError,
  DuplicateStoreSlugError,
  ImmutableFieldError,
  InsufficientStorePermissionError,
  MembershipAlreadyExistsError,
  MembershipNotFoundError,
  OrganizationAccessDeniedError,
  OrganizationNotFoundError,
  StoreNotFoundError,
} from "../domain/errors.js";
import {
  isValidStoreRole,
  normalizeSlug,
  validateStoreInput,
} from "../domain/validation.js";
import { StoreRepository } from "../infrastructure/store-repository.js";
import type {
  AddStoreMemberInput,
  CreateStoreInput,
  StoreDetailDTO,
  StoreMemberDTO,
  StoreSummaryDTO,
  UpdateStoreInput,
  UpdateStoreMemberInput,
} from "./dtos.js";
import type {
  Store,
  StoreMembership,
  StoreStatus,
  StoreWithSettings,
} from "../domain/entities.js";

function toStoreSummaryDTO(store: Store): StoreSummaryDTO {
  return {
    id: store.id,
    organizationId: store.organizationId,
    name: store.name,
    slug: store.slug,
    status: store.status,
    currency: store.currency,
    locale: store.locale,
    timezone: store.timezone,
    createdAt: store.createdAt.toISOString(),
    updatedAt: store.updatedAt.toISOString(),
  };
}

function toStoreDetailDTO(store: StoreWithSettings): StoreDetailDTO {
  return {
    id: store.id,
    organizationId: store.organizationId,
    name: store.name,
    slug: store.slug,
    status: store.status,
    currency: store.currency,
    locale: store.locale,
    timezone: store.timezone,
    settings: store.settings
      ? {
          contactEmail: store.settings.contactEmail,
          contactPhone: store.settings.contactPhone,
          description: store.settings.description,
        }
      : null,
    createdAt: store.createdAt.toISOString(),
    updatedAt: store.updatedAt.toISOString(),
  };
}

function toStoreMemberDTO(m: StoreMembership): StoreMemberDTO {
  return {
    id: m.id,
    storeId: m.storeId,
    userId: m.userId,
    role: m.role,
    status: m.status,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

export class StoreService {
  constructor(private readonly repo: StoreRepository = new StoreRepository()) {}

  async createStore(
    db: Database,
    userId: string,
    input: CreateStoreInput,
  ): Promise<StoreDetailDTO> {
    const rawSlug = input.slug?.trim() || normalizeSlug(input.name);
    const normalizedSlug = normalizeSlug(rawSlug);

    const validationErrors = validateStoreInput({
      name: input.name,
      slug: normalizedSlug,
      currency: input.currency?.toUpperCase() ?? "USD",
      locale: input.locale ?? "en-US",
      timezone: input.timezone ?? "UTC",
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
    });

    if (validationErrors.length > 0) {
      throw validationErrors;
    }

    const currency = (input.currency ?? "USD").toUpperCase();
    const locale = input.locale ?? "en-US";
    const timezone = input.timezone ?? "UTC";

    return await db.withTransaction(async (tx) => {
      // 1. Check slug uniqueness
      const existingSlug = await this.repo.findStoreBySlug(tx, normalizedSlug);
      if (existingSlug) {
        throw new DuplicateStoreSlugError(normalizedSlug);
      }

      // 2. Organization handling
      let orgId: string;
      if (input.organizationId) {
        const org = await this.repo.findOrganizationById(
          tx,
          input.organizationId,
        );
        if (!org) {
          throw new OrganizationNotFoundError(
            "Provided organization does not exist",
          );
        }

        const orgMembership = await this.repo.findOrganizationMembership(
          tx,
          input.organizationId,
          userId,
        );
        if (
          !orgMembership ||
          orgMembership.status !== "ACTIVE" ||
          (orgMembership.role !== "owner" && orgMembership.role !== "admin")
        ) {
          throw new OrganizationAccessDeniedError(
            "User does not have permission to create stores under this organization",
          );
        }
        orgId = input.organizationId;
      } else {
        orgId = generateUuidV7();
        await this.repo.insertOrganization(tx, {
          id: orgId,
          name: input.name.trim(),
          status: "ACTIVE",
        });

        await this.repo.insertOrganizationMembership(tx, {
          id: generateUuidV7(),
          organizationId: orgId,
          userId,
          role: "owner",
          status: "ACTIVE",
        });
      }

      // 3. Create Store
      const storeId = generateUuidV7();
      let store: Store;
      try {
        store = await this.repo.insertStore(tx, {
          id: storeId,
          organizationId: orgId,
          name: input.name.trim(),
          slug: normalizedSlug,
          status: "DRAFT",
          currency,
          locale,
          timezone,
        });
      } catch (err: unknown) {
        const pgErr = err as { code?: string; constraint?: string };
        if (pgErr.code === "23505" && pgErr.constraint?.includes("slug")) {
          throw new DuplicateStoreSlugError(normalizedSlug);
        }
        throw err;
      }

      // 4. Create Store Settings
      const settingsId = generateUuidV7();
      const settings = await this.repo.insertStoreSettings(tx, {
        id: settingsId,
        storeId,
        contactEmail: input.contactEmail?.trim() || null,
        contactPhone: input.contactPhone?.trim() || null,
        description: input.description?.trim() || null,
      });

      // 5. Create Owner Membership
      const membershipId = generateUuidV7();
      await this.repo.insertStoreMembership(tx, {
        id: membershipId,
        storeId,
        userId,
        role: "owner",
        status: "ACTIVE",
      });

      return toStoreDetailDTO({
        ...store,
        settings,
      });
    });
  }

  async getStoreById(
    db: Database,
    storeId: string,
    userId: string,
  ): Promise<StoreDetailDTO> {
    await requireStoreAccess(db, storeId, userId);

    const store = await this.repo.findStoreWithSettingsById(db, storeId);
    if (!store) {
      throw new StoreNotFoundError(`Store '${storeId}' not found`);
    }

    return toStoreDetailDTO(store);
  }

  async getStoreBySlug(db: Database, slug: string): Promise<StoreDetailDTO> {
    const normalized = normalizeSlug(slug);
    const store = await this.repo.findStoreBySlug(db, normalized);
    if (!store) {
      throw new StoreNotFoundError(`Store with slug '${slug}' not found`);
    }

    return toStoreDetailDTO(store);
  }

  async listUserStores(
    db: Database,
    userId: string,
  ): Promise<StoreSummaryDTO[]> {
    const stores = await this.repo.listStoresByUserId(db, userId);
    return stores.map(toStoreSummaryDTO);
  }

  async updateStore(
    db: Database,
    storeId: string,
    userId: string,
    input: UpdateStoreInput,
  ): Promise<StoreDetailDTO> {
    await requireStoreAccess(db, storeId, userId, "admin");

    const validationErrors = validateStoreInput({
      name: input.name ?? "Valid Name",
      currency: input.currency?.toUpperCase(),
      locale: input.locale,
      timezone: input.timezone,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
    });

    // Remove synthetic name error if name was not provided
    const filteredErrors =
      input.name === undefined
        ? validationErrors.filter((e) => e.field !== "name")
        : validationErrors;

    if (filteredErrors.length > 0) {
      throw filteredErrors;
    }

    return await db.withTransaction(async (tx) => {
      const existing = await this.repo.findStoreById(tx, storeId);
      if (!existing) {
        throw new StoreNotFoundError(`Store '${storeId}' not found`);
      }

      if (
        input.currency &&
        input.currency.toUpperCase() !== existing.currency
      ) {
        if (existing.status !== "DRAFT") {
          throw new ImmutableFieldError(
            "currency",
            "Store currency cannot be modified once the store has been activated",
          );
        }
      }

      const updateData: Partial<
        Pick<Store, "name" | "currency" | "locale" | "timezone">
      > = {};
      if (input.name !== undefined) {
        updateData.name = input.name.trim();
      }
      if (input.currency !== undefined) {
        updateData.currency = input.currency.toUpperCase();
      }
      if (input.locale !== undefined) {
        updateData.locale = input.locale;
      }
      if (input.timezone !== undefined) {
        updateData.timezone = input.timezone;
      }

      if (Object.keys(updateData).length > 0) {
        await this.repo.updateStore(tx, storeId, updateData);
      }

      const settingsUpdate: {
        contactEmail?: string | null;
        contactPhone?: string | null;
        description?: string | null;
      } = {};
      let hasSettingsUpdate = false;

      if (input.contactEmail !== undefined) {
        settingsUpdate.contactEmail = input.contactEmail
          ? input.contactEmail.trim()
          : null;
        hasSettingsUpdate = true;
      }
      if (input.contactPhone !== undefined) {
        settingsUpdate.contactPhone = input.contactPhone
          ? input.contactPhone.trim()
          : null;
        hasSettingsUpdate = true;
      }
      if (input.description !== undefined) {
        settingsUpdate.description = input.description
          ? input.description.trim()
          : null;
        hasSettingsUpdate = true;
      }

      if (hasSettingsUpdate) {
        const currentSettings = await this.repo.findStoreSettings(tx, storeId);
        if (currentSettings) {
          await this.repo.updateStoreSettings(tx, storeId, settingsUpdate);
        } else {
          await this.repo.insertStoreSettings(tx, {
            id: generateUuidV7(),
            storeId,
            contactEmail: settingsUpdate.contactEmail ?? null,
            contactPhone: settingsUpdate.contactPhone ?? null,
            description: settingsUpdate.description ?? null,
          });
        }
      }

      const updated = await this.repo.findStoreWithSettingsById(tx, storeId);
      return toStoreDetailDTO(updated!);
    });
  }

  async changeStoreStatus(
    db: Database,
    storeId: string,
    userId: string,
    targetStatus: StoreStatus,
  ): Promise<StoreDetailDTO> {
    if (targetStatus === "ARCHIVED") {
      await requireStoreAccess(db, storeId, userId, "owner");
    } else {
      await requireStoreAccess(db, storeId, userId, "admin");
    }

    return await db.withTransaction(async (tx) => {
      const store = await this.repo.findStoreWithSettingsById(tx, storeId);
      if (!store) {
        throw new StoreNotFoundError(`Store '${storeId}' not found`);
      }

      assertValidStoreTransition(store.status, targetStatus);

      if (store.status !== targetStatus) {
        await this.repo.updateStoreStatus(tx, storeId, targetStatus);
      }

      const updated = await this.repo.findStoreWithSettingsById(tx, storeId);
      return toStoreDetailDTO(updated!);
    });
  }

  async activateStore(
    db: Database,
    storeId: string,
    userId: string,
  ): Promise<StoreDetailDTO> {
    return this.changeStoreStatus(db, storeId, userId, "ACTIVE");
  }

  async suspendStore(
    db: Database,
    storeId: string,
    userId: string,
  ): Promise<StoreDetailDTO> {
    return this.changeStoreStatus(db, storeId, userId, "SUSPENDED");
  }

  async reactivateStore(
    db: Database,
    storeId: string,
    userId: string,
  ): Promise<StoreDetailDTO> {
    return this.changeStoreStatus(db, storeId, userId, "ACTIVE");
  }

  async archiveStore(
    db: Database,
    storeId: string,
    userId: string,
  ): Promise<StoreDetailDTO> {
    return this.changeStoreStatus(db, storeId, userId, "ARCHIVED");
  }

  // --- Memberships ---

  async listStoreMembers(
    db: Database,
    storeId: string,
    userId: string,
  ): Promise<StoreMemberDTO[]> {
    await requireStoreAccess(db, storeId, userId, "admin");
    const members = await this.repo.listStoreMemberships(db, storeId);
    return members.map(toStoreMemberDTO);
  }

  async addStoreMember(
    db: Database,
    storeId: string,
    userId: string,
    input: AddStoreMemberInput,
  ): Promise<StoreMemberDTO> {
    await requireStoreAccess(db, storeId, userId, "admin");

    if (!isValidStoreRole(input.role)) {
      throw new InsufficientStorePermissionError(
        `Invalid role '${input.role}'`,
      );
    }

    return await db.withTransaction(async (tx) => {
      const existing = await this.repo.findStoreMembership(
        tx,
        storeId,
        input.userId,
      );
      if (existing) {
        if (existing.status === "ACTIVE" || existing.status === "INVITED") {
          throw new MembershipAlreadyExistsError(
            `User '${input.userId}' already has an active or pending membership in this store`,
          );
        }
        // Reactivate previously removed/suspended membership with requested role
        const updated = await this.repo.updateStoreMembershipRole(
          tx,
          existing.id,
          input.role,
        );
        const reactivated = await this.repo.updateStoreMembershipStatus(
          tx,
          updated.id,
          "ACTIVE",
        );
        return toStoreMemberDTO(reactivated);
      }

      const membershipId = generateUuidV7();
      const created = await this.repo.insertStoreMembership(tx, {
        id: membershipId,
        storeId,
        userId: input.userId,
        role: input.role,
        status: "ACTIVE",
      });

      return toStoreMemberDTO(created);
    });
  }

  async updateStoreMember(
    db: Database,
    storeId: string,
    userId: string,
    targetMembershipId: string,
    input: UpdateStoreMemberInput,
  ): Promise<StoreMemberDTO> {
    await requireStoreAccess(db, storeId, userId, "admin");

    if (input.role && !isValidStoreRole(input.role)) {
      throw new InsufficientStorePermissionError(
        `Invalid role '${input.role}'`,
      );
    }

    return await db.withTransaction(async (tx) => {
      const target = await this.repo.findStoreMembershipById(
        tx,
        targetMembershipId,
      );
      if (!target || target.storeId !== storeId) {
        throw new MembershipNotFoundError(
          `Membership '${targetMembershipId}' not found in this store`,
        );
      }

      // Last owner protection
      if (target.role === "owner" && target.status === "ACTIVE") {
        const isDemoting = input.role !== undefined && input.role !== "owner";
        const isDeactivating =
          input.status !== undefined && input.status !== "ACTIVE";

        if (isDemoting || isDeactivating) {
          const ownerCount = await this.repo.countActiveOwners(tx, storeId);
          if (ownerCount <= 1) {
            throw new CannotRemoveLastOwnerError(
              "Cannot demote or deactivate the last remaining active owner of the store",
            );
          }
        }
      }

      let current = target;
      if (input.status !== undefined && input.status !== current.status) {
        assertValidMembershipTransition(current.status, input.status);
        current = await this.repo.updateStoreMembershipStatus(
          tx,
          current.id,
          input.status,
        );
      }

      if (input.role !== undefined && input.role !== current.role) {
        current = await this.repo.updateStoreMembershipRole(
          tx,
          current.id,
          input.role,
        );
      }

      return toStoreMemberDTO(current);
    });
  }

  async removeStoreMember(
    db: Database,
    storeId: string,
    userId: string,
    targetMembershipId: string,
  ): Promise<void> {
    await requireStoreAccess(db, storeId, userId, "admin");

    await db.withTransaction(async (tx) => {
      const target = await this.repo.findStoreMembershipById(
        tx,
        targetMembershipId,
      );
      if (!target || target.storeId !== storeId) {
        throw new MembershipNotFoundError(
          `Membership '${targetMembershipId}' not found in this store`,
        );
      }

      if (target.role === "owner" && target.status === "ACTIVE") {
        const ownerCount = await this.repo.countActiveOwners(tx, storeId);
        if (ownerCount <= 1) {
          throw new CannotRemoveLastOwnerError(
            "Cannot remove the last remaining active owner of the store",
          );
        }
      }

      assertValidMembershipTransition(target.status, "REMOVED");
      await this.repo.updateStoreMembershipStatus(tx, target.id, "REMOVED");
    });
  }
}
