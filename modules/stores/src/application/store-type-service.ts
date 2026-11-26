import type { Database, DatabaseClient } from "@calcart/db";
import { generateUuidV7 } from "@calcart/db";
import { requireStoreAccess } from "@calcart/tenant";
import {
  DuplicateStoreTypeKeyError,
  FitCheckNotEligibleError,
  InvalidStoreTypeError,
  StoreTypeInUseError,
  StoreTypeNotFoundError,
} from "../domain/store-type-errors.js";
import { StoreNotFoundError } from "../domain/errors.js";
import {
  assertValidStoreTypeDescription,
  assertValidStoreTypeKey,
  assertValidStoreTypeName,
  normalizeStoreTypeKey,
  type CreateStoreTypeInput,
  type StoreClassificationDTO,
  type StoreType,
  type StoreTypeDTO,
  type UpdateStoreTypeInput,
} from "../domain/store-type.js";
import { StoreTypeRepository } from "../infrastructure/store-type-repository.js";

function toDTO(type: StoreType, storeCount?: number): StoreTypeDTO {
  return {
    id: type.id,
    key: type.key,
    name: type.name,
    description: type.description,
    isFashion: type.isFashion,
    ...(storeCount !== undefined ? { storeCount } : {}),
    createdAt: type.createdAt.toISOString(),
    updatedAt: type.updatedAt.toISOString(),
  };
}

function isUniqueKeyViolation(error: unknown): boolean {
  const pgErr = error as { code?: string; constraint?: string };
  return pgErr?.code === "23505" && !!pgErr.constraint?.includes("store_types_key");
}

/**
 * Store type management and store classification / Fit Check activation.
 *
 * Platform-admin authorization for the `*StoreType*` management methods is the
 * caller's responsibility (the platform-admin app enforces `stores:write`).
 * Merchant methods enforce store membership themselves.
 */
export class StoreTypeService {
  private readonly repo = new StoreTypeRepository();

  // ---------------------------------------------------------------------
  // Platform-level store type management
  // ---------------------------------------------------------------------

  async listStoreTypes(db: Database): Promise<StoreTypeDTO[]> {
    const types = await this.repo.list(db);
    return types.map((t) => toDTO(t, t.storeCount));
  }

  async getStoreType(db: Database, id: string): Promise<StoreTypeDTO> {
    const type = await this.repo.findById(db, id);
    if (!type) throw new StoreTypeNotFoundError();
    return toDTO(type, await this.repo.countStores(db, id));
  }

  async createStoreType(
    db: Database,
    input: CreateStoreTypeInput,
  ): Promise<StoreTypeDTO> {
    const key = normalizeStoreTypeKey(input.key);
    assertValidStoreTypeKey(key);
    assertValidStoreTypeName(input.name);
    assertValidStoreTypeDescription(input.description);

    try {
      const created = await this.repo.insert(db, {
        id: generateUuidV7(),
        key,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        isFashion: input.isFashion ?? false,
      });
      return toDTO(created, 0);
    } catch (error) {
      if (isUniqueKeyViolation(error)) throw new DuplicateStoreTypeKeyError(key);
      throw error;
    }
  }

  async updateStoreType(
    db: Database,
    id: string,
    input: UpdateStoreTypeInput,
  ): Promise<StoreTypeDTO> {
    const data: UpdateStoreTypeInput = {};
    if (input.key !== undefined) {
      data.key = normalizeStoreTypeKey(input.key);
      assertValidStoreTypeKey(data.key);
    }
    if (input.name !== undefined) {
      assertValidStoreTypeName(input.name);
      data.name = input.name.trim();
    }
    if (input.description !== undefined) {
      assertValidStoreTypeDescription(input.description);
      data.description = input.description?.trim() || null;
    }
    if (input.isFashion !== undefined) data.isFashion = input.isFashion;

    try {
      return await db.withTransaction(async (tx) => {
        const existing = await this.repo.findById(tx, id, true);
        if (!existing) throw new StoreTypeNotFoundError();

        const updated = await this.repo.update(tx, id, data);

        // A type that stops being fashion can no longer host Fit Check.
        if (existing.isFashion && !updated.isFashion) {
          await this.repo.disableFitCheckForType(tx, id);
        }
        return toDTO(updated, await this.repo.countStores(tx, id));
      });
    } catch (error) {
      if (isUniqueKeyViolation(error)) {
        throw new DuplicateStoreTypeKeyError(data.key ?? "");
      }
      throw error;
    }
  }

  /**
   * Deletes a store type. When stores still use it, deletion is refused
   * unless `reassignToId` names another type to move them to.
   */
  async deleteStoreType(
    db: Database,
    id: string,
    options: { reassignToId?: string } = {},
  ): Promise<{ deleted: true; reassignedStores: number }> {
    return db.withTransaction(async (tx) => {
      const existing = await this.repo.findById(tx, id, true);
      if (!existing) throw new StoreTypeNotFoundError();

      const inUse = await this.repo.countStores(tx, id);
      let reassigned = 0;

      if (inUse > 0) {
        if (!options.reassignToId) throw new StoreTypeInUseError(inUse);
        if (options.reassignToId === id) {
          throw new InvalidStoreTypeError(
            "Cannot reassign stores to the store type being deleted",
          );
        }
        const target = await this.repo.findById(tx, options.reassignToId, true);
        if (!target) throw new StoreTypeNotFoundError("Reassignment target not found");
        reassigned = await this.repo.reassignStores(tx, id, target.id, target.isFashion);
      }

      await this.repo.remove(tx, id);
      return { deleted: true as const, reassignedStores: reassigned };
    });
  }

  // ---------------------------------------------------------------------
  // Merchant classification and Fit Check activation
  // ---------------------------------------------------------------------

  /** Selectable store types for merchants (no store counts). */
  async listSelectableStoreTypes(db: Database): Promise<StoreTypeDTO[]> {
    const types = await this.repo.list(db);
    return types.map((t) => toDTO(t));
  }

  async getStoreClassification(
    db: Database,
    storeId: string,
    userId: string,
  ): Promise<StoreClassificationDTO> {
    await requireStoreAccess(db, storeId, userId);
    return this.loadClassification(db, storeId);
  }

  /**
   * Public (unauthenticated) check used by storefront routes. Returns only a
   * boolean so no store configuration leaks.
   */
  async isFitCheckActive(db: Database, storeId: string): Promise<boolean> {
    const c = await this.repo.getStoreClassification(db, storeId);
    return !!c && c.type.isFashion && c.fitCheckEnabled;
  }

  async setStoreType(
    db: Database,
    storeId: string,
    userId: string,
    input: { storeTypeId: string; confirmDisableFitCheck?: boolean },
  ): Promise<StoreClassificationDTO & { fitCheckDisabled: boolean }> {
    await requireStoreAccess(db, storeId, userId, "admin");

    return db.withTransaction(async (tx) => {
      const current = await this.repo.getStoreClassification(tx, storeId, true);
      if (!current) throw new StoreNotFoundError(`Store '${storeId}' not found`);

      const target = await this.repo.findById(tx, input.storeTypeId);
      if (!target) throw new StoreTypeNotFoundError();

      const wouldDisable = current.fitCheckEnabled && !target.isFashion;
      if (wouldDisable && !input.confirmDisableFitCheck) {
        throw new InvalidStoreTypeError(
          "Changing to this store type will disable Fit Check. Confirm to proceed.",
          { requiresConfirmation: true, field: "confirmDisableFitCheck" },
        );
      }

      await this.repo.setStoreClassification(tx, storeId, {
        storeTypeId: target.id,
        ...(wouldDisable ? { fitCheckEnabled: false } : {}),
      });

      return {
        ...(await this.loadClassification(tx, storeId)),
        fitCheckDisabled: wouldDisable,
      };
    });
  }

  async setFitCheckEnabled(
    db: Database,
    storeId: string,
    userId: string,
    enabled: boolean,
  ): Promise<StoreClassificationDTO> {
    await requireStoreAccess(db, storeId, userId, "admin");

    return db.withTransaction(async (tx) => {
      const current = await this.repo.getStoreClassification(tx, storeId, true);
      if (!current) throw new StoreNotFoundError(`Store '${storeId}' not found`);

      if (enabled && !current.type.isFashion) throw new FitCheckNotEligibleError();

      await this.repo.setStoreClassification(tx, storeId, { fitCheckEnabled: enabled });
      return this.loadClassification(tx, storeId);
    });
  }

  private async loadClassification(
    db: DatabaseClient,
    storeId: string,
  ): Promise<StoreClassificationDTO> {
    const c = await this.repo.getStoreClassification(db, storeId);
    if (!c) throw new StoreNotFoundError(`Store '${storeId}' not found`);
    return {
      storeId,
      storeType: toDTO(c.type),
      fitCheckEligible: c.type.isFashion,
      fitCheckEnabled: c.fitCheckEnabled,
      fitCheckActive: c.type.isFashion && c.fitCheckEnabled,
    };
  }
}
