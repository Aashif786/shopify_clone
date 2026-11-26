import type { Database, DatabaseClient } from "@calcart/db";
import { generateUuidV7 } from "@calcart/db";
import {
  BodyProfileConsentRequiredError,
  BodyProfileNotFoundError,
  InvalidBodyProfileError,
  assertValidBodyMeasurements,
  isBodyUnitPreference,
  roundToTenth,
  type BodyProfileDTO,
  type CustomerBodyProfile,
  type SaveBodyProfileInput,
} from "../domain/body-profile.js";
import {
  AVATAR_GENERATOR_VERSION,
  AvatarGenerationError,
  AvatarNotFoundError,
  computeAvatarParams,
  type AvatarDTO,
} from "../domain/avatar.js";
import { AvatarRepository, type StoredAvatar } from "../infrastructure/avatar-repository.js";
import { BodyProfileRepository } from "../infrastructure/body-profile-repository.js";

function toDTO(profile: CustomerBodyProfile): BodyProfileDTO {
  return {
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    chestCm: profile.chestCm,
    waistCm: profile.waistCm,
    hipCm: profile.hipCm,
    unitPreference: profile.unitPreference,
    consentAcknowledgedAt: profile.consentAcknowledgedAt.toISOString(),
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

function toAvatarDTO(a: StoredAvatar): AvatarDTO {
  return {
    params: a.params,
    generatorVersion: a.generatorVersion,
    generatedAt: a.generatedAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

/**
 * Sensitive Fit Check body measurements.
 *
 * Ownership contract: callers must resolve `customerId` from the authenticated
 * session (never from client input). Every operation is scoped by both store and
 * customer, so one customer can never read or change another's profile, and a
 * profile never crosses store boundaries. Measurement values are never logged.
 *
 * Whether Fit Check is enabled for the store is checked by the caller (the
 * stores module owns that rule).
 */
export class BodyProfileService {
  private readonly repo = new BodyProfileRepository();
  private readonly avatars = new AvatarRepository();

  async getProfile(
    db: Database,
    storeId: string,
    customerId: string,
  ): Promise<BodyProfileDTO | null> {
    const profile = await this.repo.find(db, storeId, customerId);
    return profile ? toDTO(profile) : null;
  }

  async saveProfile(
    db: Database,
    storeId: string,
    customerId: string,
    input: SaveBodyProfileInput,
  ): Promise<BodyProfileDTO> {
    const measurements = {
      heightCm: roundToTenth(input.heightCm),
      weightKg: roundToTenth(input.weightKg),
      chestCm: roundToTenth(input.chestCm),
      waistCm: roundToTenth(input.waistCm),
      hipCm: roundToTenth(input.hipCm),
    };
    assertValidBodyMeasurements(measurements);

    if (input.unitPreference !== undefined && !isBodyUnitPreference(input.unitPreference)) {
      throw new InvalidBodyProfileError("Invalid unit preference", {
        fields: { unitPreference: "Must be 'metric' or 'imperial'" },
      });
    }

    return db.withTransaction(async (tx) => {
      const existing = await this.repo.find(tx, storeId, customerId);
      if (!existing && input.consentAcknowledged !== true) {
        throw new BodyProfileConsentRequiredError();
      }

      const saved = await this.repo.upsert(tx, {
        id: generateUuidV7(),
        storeId,
        customerId,
        ...measurements,
        unitPreference: input.unitPreference ?? existing?.unitPreference ?? "metric",
      });
      // The avatar is always derived from the saved profile, in the same transaction.
      await this.writeAvatar(tx, storeId, customerId, saved);
      return toDTO(saved);
    });
  }

  /** Deletes the profile and the avatar derived from it. */
  async deleteProfile(
    db: Database,
    storeId: string,
    customerId: string,
  ): Promise<void> {
    await db.withTransaction(async (tx) => {
      await this.avatars.remove(tx, storeId, customerId);
      const removed = await this.repo.remove(tx, storeId, customerId);
      if (!removed) throw new BodyProfileNotFoundError();
    });
  }

  async getAvatar(
    db: Database,
    storeId: string,
    customerId: string,
  ): Promise<AvatarDTO | null> {
    const avatar = await this.avatars.find(db, storeId, customerId);
    return avatar ? toAvatarDTO(avatar) : null;
  }

  /**
   * Regenerates the avatar from the saved profile (e.g. after a generator
   * upgrade, or to recover a missing avatar).
   */
  async regenerateAvatar(
    db: Database,
    storeId: string,
    customerId: string,
  ): Promise<AvatarDTO> {
    return db.withTransaction(async (tx) => {
      const profile = await this.repo.find(tx, storeId, customerId);
      if (!profile) throw new BodyProfileNotFoundError();
      return toAvatarDTO(await this.writeAvatar(tx, storeId, customerId, profile));
    });
  }

  /** Returns the stored avatar, generating it on demand when a profile exists without one. */
  async getOrCreateAvatar(
    db: Database,
    storeId: string,
    customerId: string,
  ): Promise<AvatarDTO> {
    const existing = await this.avatars.find(db, storeId, customerId);
    if (existing && existing.generatorVersion === AVATAR_GENERATOR_VERSION) {
      return toAvatarDTO(existing);
    }
    try {
      return await this.regenerateAvatar(db, storeId, customerId);
    } catch (error) {
      if (error instanceof BodyProfileNotFoundError) throw new AvatarNotFoundError();
      throw error;
    }
  }

  private async writeAvatar(
    tx: DatabaseClient,
    storeId: string,
    customerId: string,
    profile: CustomerBodyProfile,
  ): Promise<StoredAvatar> {
    let params;
    try {
      params = computeAvatarParams(profile);
    } catch {
      throw new AvatarGenerationError();
    }
    return this.avatars.upsert(tx, { id: generateUuidV7(), storeId, customerId, params });
  }
}
