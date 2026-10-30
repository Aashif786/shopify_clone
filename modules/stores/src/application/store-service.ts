import { createHash, randomBytes } from "node:crypto";
import type { Database } from "@shopify-clone/db";
import { generateUuidV7 } from "@shopify-clone/db";
import { requireStoreAccess, isPlatformAdmin, hasRoleAtLeast } from "@shopify-clone/tenant";
import {
  assertValidMembershipTransition,
  assertValidStoreTransition,
} from "../domain/lifecycle.js";
import {
  CannotDeleteDefaultSubdomainError,
  CannotRemoveLastOwnerError,
  DomainConflictError,
  DomainNotFoundError,
  DomainNotVerifiedError,
  DuplicateStoreSlugError,
  ImmutableFieldError,
  InsufficientStorePermissionError,
  InvalidDomainError,
  InvitationAlreadyAcceptedError,
  InvitationExpiredError,
  InvitationNotFoundError,
  InvitationRevokedError,
  MembershipAlreadyExistsError,
  MembershipNotFoundError,
  OrganizationAccessDeniedError,
  OrganizationNotFoundError,
  StoreNotFoundError,
} from "../domain/errors.js";
import { DomainProvider } from "../infrastructure/domain-provider.js";
import {
  isValidEmail,
  isValidStoreRole,
  normalizeEmail,
  normalizeSlug,
  validateStoreInput,
} from "../domain/validation.js";
import { StoreRepository } from "../infrastructure/store-repository.js";
import type {
  AddCustomDomainInput,
  AddStoreMemberInput,
  CreateStoreInput,
  CreateStoreInvitationInput,
  InvitationDetailsDTO,
  SetPrimaryDomainResultDTO,
  StoreDetailDTO,
  StoreDomainDTO,
  StoreDomainsResponseDTO,
  StoreInvitationDTO,
  StoreInvitationWithTokenDTO,
  StoreMemberDTO,
  StoreSummaryDTO,
  UpdateStoreInput,
  UpdateStoreMemberInput,
  VerifyDomainResultDTO,
} from "./dtos.js";
import {
  createDefaultLandingPageConfig,
  type StorefrontLandingPageConfig,
  type StorefrontLandingPageDTO,
  type StorefrontLandingPageRecord,
} from "../domain/landing-page.js";
import type {
  Store,
  StoreInvitation,
  StoreMembership,
  StoreRole,
  StoreStatus,
  StoreWithSettings,
} from "../domain/entities.js";

function toStorefrontLandingPageDTO(rec: StorefrontLandingPageRecord): StorefrontLandingPageDTO {
  return {
    id: rec.id,
    storeId: rec.storeId,
    draftConfig: rec.draftConfig,
    publishedConfig: rec.publishedConfig,
    version: rec.version,
    publishedAt: rec.publishedAt ? rec.publishedAt.toISOString() : null,
    createdAt: rec.createdAt.toISOString(),
    updatedAt: rec.updatedAt.toISOString(),
  };
}

function toStoreSummaryDTO(store: Store & { role?: StoreRole }): StoreSummaryDTO {
  return {
    id: store.id,
    organizationId: store.organizationId,
    name: store.name,
    slug: store.slug,
    status: store.status,
    currency: store.currency,
    locale: store.locale,
    timezone: store.timezone,
    role: store.role,
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

function toStoreInvitationDTO(inv: StoreInvitation): StoreInvitationDTO {
  return {
    id: inv.id,
    storeId: inv.storeId,
    email: inv.email,
    role: inv.role,
    status: inv.status,
    expiresAt: inv.expiresAt.toISOString(),
    acceptedAt: inv.acceptedAt ? inv.acceptedAt.toISOString() : null,
    createdAt: inv.createdAt.toISOString(),
  };
}


function toStoreDomainDTO(d: StoreDomain): StoreDomainDTO {
  return {
    id: d.id,
    storeId: d.storeId,
    domain: d.domain,
    subdomain: d.subdomain,
    type: d.type,
    status: d.status,
    isPrimary: d.isPrimary,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    verifiedAt: d.verifiedAt ? d.verifiedAt.toISOString() : null,
    verificationChallenge: d.verificationChallenge ?? null,
    dnsInstructions: d.dnsInstructions ?? null,
    errorReason: d.errorReason ?? null,
    sslStatus: d.sslStatus ?? null,
  };
}

function normalizeCustomDomain(raw: string): string {
  let domain = raw.toLowerCase().trim();
  domain = domain.replace(/^https?:\/\//i, "");
  domain = domain.split("/")[0] || "";
  domain = domain.split(":")[0] || "";
  domain = domain.replace(/\.+$/, "");
  return domain;
}

function validateCustomDomainFormat(domain: string, platformDomain: string): void {
  if (!domain || domain.length < 3 || domain.length > 253) {
    throw new InvalidDomainError(domain, "Domain must be between 3 and 253 characters");
  }

  if (!domain.includes(".")) {
    throw new InvalidDomainError(
      domain,
      "Domain must be a fully qualified domain name (e.g. shop.example.com or example.com)",
    );
  }

  const fqdnPattern = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z0-9-]{1,63})+$/;
  if (!fqdnPattern.test(domain)) {
    throw new InvalidDomainError(domain, "Domain contains invalid characters or malformed labels");
  }

  const normalizedPlatform = platformDomain.toLowerCase().trim();
  if (domain === normalizedPlatform || domain === "localhost" || domain === "127.0.0.1") {
    throw new InvalidDomainError(domain, "Platform domain cannot be registered as a custom domain");
  }

  if (domain.endsWith(`.${normalizedPlatform}`)) {
    throw new InvalidDomainError(
      domain,
      "Custom domains cannot be subdomains of the platform. Use your assigned platform subdomain instead",
    );
  }
}

export class StoreService {
  private readonly domainProvider: DomainProvider;

  constructor(
    private readonly repo: StoreRepository = new StoreRepository(),
    domainProvider?: DomainProvider,
  ) {
    this.domainProvider = domainProvider ?? new DomainProvider();
  }

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
        // Reuse existing owner organization if user already owns one (avoid duplicate org creation upon retry)
        const userOrgs = await this.repo.findUserOrganizationMemberships(tx, userId);
        const existingOwnerOrg = userOrgs.find((m) => m.role === "owner");

        if (existingOwnerOrg) {
          orgId = existingOwnerOrg.organizationId;
        } else {
          orgId = generateUuidV7();
          const orgName = input.organizationName?.trim() || input.name.trim();
          await this.repo.insertOrganization(tx, {
            id: orgId,
            name: orgName,
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
          status: input.status ?? "DRAFT",
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

      // 6. Ensure default platform subdomain
      const platformDomain = process.env.PLATFORM_DOMAIN?.trim() || process.env.NEXT_PUBLIC_PLATFORM_DOMAIN?.trim() || "calcart.com";
      await this.repo.ensureDefaultSubdomain(tx, storeId, normalizedSlug, platformDomain);

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
    const isSuper = await isPlatformAdmin(db, userId);
    if (isSuper) {
      const allStores = await this.repo.listAllStores(db);
      const userMemberships = await this.repo.listStoresByUserId(db, userId);
      const membershipMap = new Map(userMemberships.map((s) => [s.id, s.role]));
      return allStores.map((s) => ({
        ...toStoreSummaryDTO(s),
        role: membershipMap.get(s.id) ?? ("owner" as StoreRole),
      }));
    }
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
    const callerMembership = await requireStoreAccess(db, storeId, userId, "admin");

    if (!isValidStoreRole(input.role)) {
      throw new InsufficientStorePermissionError(
        `Invalid role '${input.role}'`,
      );
    }

    if (input.role === "owner" && callerMembership.role !== "owner" && !callerMembership.isPlatformAdmin) {
      throw new InsufficientStorePermissionError(
        "Only a store owner can grant the owner role to a member",
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
    const callerMembership = await requireStoreAccess(db, storeId, userId, "admin");

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

      // 1. Last owner protection with concurrency-safe row lock
      if (target.role === "owner" && target.status === "ACTIVE") {
        const isDemoting = input.role !== undefined && input.role !== "owner";
        const isDeactivating =
          input.status !== undefined && input.status !== "ACTIVE";

        if (isDemoting || isDeactivating) {
          const ownerCount = await this.repo.countActiveOwnersForUpdate(tx, storeId);
          if (ownerCount <= 1) {
            throw new CannotRemoveLastOwnerError(
              "Cannot demote or deactivate the last remaining active owner of the store",
            );
          }
        }
      }

      // 2. Self-promotion prevention: staff/admin cannot self-promote to higher roles
      if (target.userId === userId && input.role !== undefined && input.role !== target.role) {
        if (!hasRoleAtLeast(target.role, input.role)) {
          throw new InsufficientStorePermissionError(
            "Users cannot self-promote their own store membership role",
          );
        }
      }

      // 3. Privilege escalation: non-owner cannot promote anyone to owner
      if (input.role === "owner" && callerMembership.role !== "owner" && !callerMembership.isPlatformAdmin) {
        throw new InsufficientStorePermissionError(
          "Only a store owner can promote a member to owner",
        );
      }

      // 4. Non-owner cannot modify an owner's role or status
      if (target.role === "owner" && callerMembership.role !== "owner" && !callerMembership.isPlatformAdmin) {
        throw new InsufficientStorePermissionError(
          "Only a store owner can modify an owner's membership",
        );
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
    const callerMembership = await requireStoreAccess(db, storeId, userId, "admin");

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

      // Non-owner cannot remove an owner
      if (target.role === "owner" && callerMembership.role !== "owner" && !callerMembership.isPlatformAdmin) {
        throw new InsufficientStorePermissionError(
          "Only a store owner can remove an owner",
        );
      }

      if (target.role === "owner" && target.status === "ACTIVE") {
        const ownerCount = await this.repo.countActiveOwnersForUpdate(tx, storeId);
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

  // --- Invitations ---

  async createStoreInvitation(
    db: Database,
    storeId: string,
    userId: string,
    input: CreateStoreInvitationInput,
  ): Promise<StoreInvitationWithTokenDTO> {
    await requireStoreAccess(db, storeId, userId, "admin");

    const email = normalizeEmail(input.email);
    if (!isValidEmail(email)) {
      throw new InsufficientStorePermissionError("Invalid email address format");
    }

    if (input.role !== "admin" && input.role !== "staff") {
      throw new InsufficientStorePermissionError("Invited role must be 'admin' or 'staff'");
    }

    return await db.withTransaction(async (tx) => {
      // Check if user with this email already exists and has active membership
      const existingUser = await this.repo.findUserByEmail(tx, email);
      if (existingUser) {
        const existingMembership = await this.repo.findStoreMembership(
          tx,
          storeId,
          existingUser.id,
        );
        if (
          existingMembership &&
          (existingMembership.status === "ACTIVE" || existingMembership.status === "INVITED")
        ) {
          throw new MembershipAlreadyExistsError(
            `User with email '${email}' is already an active or invited member of this store`,
          );
        }
      }

      // Check if there's an existing pending invitation for this email
      const existingInv = await this.repo.findPendingInvitationByEmail(
        tx,
        storeId,
        email,
      );
      if (existingInv) {
        // Revoke the previous pending invite so new one replaces it
        await this.repo.updateStoreInvitationStatus(tx, existingInv.id, "REVOKED");
      }

      const rawToken = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");
      const invitationId = generateUuidV7();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const created = await this.repo.insertStoreInvitation(tx, {
        id: invitationId,
        storeId,
        email,
        role: input.role,
        tokenHash,
        invitedByUserId: userId,
        expiresAt,
      });

      return {
        ...toStoreInvitationDTO(created),
        rawToken,
      };
    });
  }

  async listStoreInvitations(
    db: Database,
    storeId: string,
    userId: string,
  ): Promise<StoreInvitationDTO[]> {
    await requireStoreAccess(db, storeId, userId, "admin");
    const invitations = await this.repo.listStoreInvitations(db, storeId);
    return invitations.map(toStoreInvitationDTO);
  }

  async revokeStoreInvitation(
    db: Database,
    storeId: string,
    userId: string,
    invitationId: string,
  ): Promise<StoreInvitationDTO> {
    await requireStoreAccess(db, storeId, userId, "admin");

    return await db.withTransaction(async (tx) => {
      const inv = await this.repo.findStoreInvitationById(tx, invitationId);
      if (!inv || inv.storeId !== storeId) {
        throw new InvitationNotFoundError("Invitation not found");
      }

      if (inv.status !== "PENDING") {
        throw new InsufficientStorePermissionError(
          `Cannot revoke invitation with status '${inv.status}'`,
        );
      }

      const updated = await this.repo.updateStoreInvitationStatus(
        tx,
        inv.id,
        "REVOKED",
      );
      return toStoreInvitationDTO(updated);
    });
  }

  async getInvitationDetails(
    db: Database,
    rawToken: string,
  ): Promise<InvitationDetailsDTO> {
    const tokenHash = createHash("sha256").update(rawToken.trim()).digest("hex");
    const inv = await this.repo.findStoreInvitationByTokenHash(db, tokenHash);
    if (!inv) {
      throw new InvitationNotFoundError("Invitation not found or invalid token");
    }

    const store = await this.repo.findStoreById(db, inv.storeId);
    if (!store) {
      throw new StoreNotFoundError("Invited store no longer exists");
    }

    const isExpired = inv.expiresAt < new Date();

    return {
      id: inv.id,
      storeId: inv.storeId,
      storeName: store.name,
      storeSlug: store.slug,
      email: inv.email,
      role: inv.role,
      status: isExpired && inv.status === "PENDING" ? "EXPIRED" : inv.status,
      expiresAt: inv.expiresAt.toISOString(),
      isExpired,
    };
  }

  async acceptStoreInvitation(
    db: Database,
    rawToken: string,
    userId: string,
  ): Promise<StoreMemberDTO> {
    const tokenHash = createHash("sha256").update(rawToken.trim()).digest("hex");

    return await db.withTransaction(async (tx) => {
      const inv = await this.repo.findStoreInvitationByTokenHash(tx, tokenHash);
      if (!inv) {
        throw new InvitationNotFoundError("Invitation not found or invalid token");
      }

      if (inv.status === "ACCEPTED") {
        throw new InvitationAlreadyAcceptedError("This invitation has already been accepted");
      }

      if (inv.status === "REVOKED") {
        throw new InvitationRevokedError("This invitation has been revoked");
      }

      if (inv.expiresAt < new Date()) {
        await this.repo.updateStoreInvitationStatus(tx, inv.id, "EXPIRED");
        throw new InvitationExpiredError("This invitation has expired");
      }

      const store = await this.repo.findStoreById(tx, inv.storeId);
      if (!store) {
        throw new StoreNotFoundError("Invited store no longer exists");
      }

      // Verify invitation recipient email matches accepting user email
      const user = await this.repo.findUserById(tx, userId);
      if (user && user.email.toLowerCase().trim() !== inv.email.toLowerCase().trim()) {
        throw new InsufficientStorePermissionError(
          "This invitation was sent to a different email address",
        );
      }

      // Check if membership already exists for this user in this store
      const existing = await this.repo.findStoreMembership(tx, inv.storeId, userId);
      let membership: StoreMembership;

      if (existing) {
        const updatedRole = await this.repo.updateStoreMembershipRole(
          tx,
          existing.id,
          inv.role,
        );
        membership = await this.repo.updateStoreMembershipStatus(
          tx,
          updatedRole.id,
          "ACTIVE",
        );
      } else {
        membership = await this.repo.insertStoreMembership(tx, {
          id: generateUuidV7(),
          storeId: inv.storeId,
          userId,
          role: inv.role,
          status: "ACTIVE",
        });
      }

      // Mark invitation as accepted
      await this.repo.updateStoreInvitationStatus(tx, inv.id, "ACCEPTED", new Date());

      return toStoreMemberDTO(membership);
    });
  }

  async getLandingPage(
    db: Database,
    storeId: string,
    userId: string,
  ): Promise<StorefrontLandingPageDTO> {
    await requireStoreAccess(db, storeId, userId);
    const store = await this.repo.findStoreById(db, storeId);
    if (!store) {
      throw new StoreNotFoundError(storeId);
    }
    const existing = await this.repo.findLandingPageByStoreId(db, storeId);
    if (existing) {
      return toStorefrontLandingPageDTO(existing);
    }
    const defaultDraft = createDefaultLandingPageConfig(store.name);
    return {
      id: "default",
      storeId,
      draftConfig: defaultDraft,
      publishedConfig: null,
      version: 1,
      publishedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async saveLandingPageDraft(
    db: Database,
    storeId: string,
    userId: string,
    draftConfig: StorefrontLandingPageConfig,
  ): Promise<StorefrontLandingPageDTO> {
    await requireStoreAccess(db, storeId, userId, "admin");
    return await db.withTransaction(async (tx) => {
      const store = await this.repo.findStoreById(tx, storeId);
      if (!store) {
        throw new StoreNotFoundError(storeId);
      }
      const rec = await this.repo.upsertLandingPageDraft(tx, storeId, draftConfig);
      return toStorefrontLandingPageDTO(rec);
    });
  }

  async publishLandingPage(
    db: Database,
    storeId: string,
    userId: string,
    configToPublish?: StorefrontLandingPageConfig,
  ): Promise<StorefrontLandingPageDTO> {
    await requireStoreAccess(db, storeId, userId, "admin");
    return await db.withTransaction(async (tx) => {
      const store = await this.repo.findStoreById(tx, storeId);
      if (!store) {
        throw new StoreNotFoundError(storeId);
      }

      let config = configToPublish;
      if (!config) {
        const existing = await this.repo.findLandingPageByStoreId(tx, storeId);
        config = existing?.draftConfig || createDefaultLandingPageConfig(store.name);
      }

      const rec = await this.repo.publishLandingPage(tx, storeId, config);
      return toStorefrontLandingPageDTO(rec);
    });
  }

  async resetLandingPageDraft(
    db: Database,
    storeId: string,
    userId: string,
  ): Promise<StorefrontLandingPageDTO> {
    await requireStoreAccess(db, storeId, userId, "admin");
    return await db.withTransaction(async (tx) => {
      const store = await this.repo.findStoreById(tx, storeId);
      if (!store) {
        throw new StoreNotFoundError(storeId);
      }
      const fallback = createDefaultLandingPageConfig(store.name);
      const rec = await this.repo.resetLandingPageDraft(tx, storeId, fallback);
      return toStorefrontLandingPageDTO(rec);
    });
  }

  async getPublishedLandingPageBySlug(
    db: Database,
    storeSlug: string,
  ): Promise<{
    store: StoreSummaryDTO;
    config: StorefrontLandingPageConfig | null;
    publishedAt: string | null;
  }> {
    const store = await this.repo.findStoreBySlug(db, storeSlug);
    if (!store) {
      throw new StoreNotFoundError(storeSlug);
    }
    const rec = await this.repo.findLandingPageByStoreId(db, store.id);
    return {
      store: toStoreSummaryDTO(store),
      config: rec?.publishedConfig || null,
      publishedAt: rec?.publishedAt ? rec.publishedAt.toISOString() : null,
    };
  }

  async getStoreDomains(
    db: Database,
    storeId: string,
    actorUserId: string,
  ): Promise<StoreDomainsResponseDTO> {
    await requireStoreAccess(db, storeId, actorUserId, "staff");
    const store = await this.getStoreById(db, storeId, actorUserId);

    const platformDomain =
      process.env.PLATFORM_DOMAIN?.trim() ||
      process.env.NEXT_PUBLIC_PLATFORM_DOMAIN?.trim() ||
      "calcart.com";

    // Guarantee default subdomain exists
    await this.repo.ensureDefaultSubdomain(db, storeId, store.slug, platformDomain);

    const domainRecords = await this.repo.findDomainsByStoreId(db, storeId);
    const assignedSubdomain = store.slug;
    const assignedDomain = `${store.slug}.${platformDomain}`;

    const isLocal =
      platformDomain.includes("localhost") ||
      platformDomain.includes("127.0.0.1") ||
      platformDomain.includes(".local") ||
      platformDomain.includes(".test");

    const primaryDomain = domainRecords.find((d) => d.isPrimary) || domainRecords[0];
    const previewUrl =
      primaryDomain && primaryDomain.type === "CUSTOM" && primaryDomain.status === "ACTIVE"
        ? `https://${primaryDomain.domain}`
        : isLocal
          ? `http://${assignedSubdomain}.localhost:3000`
          : `https://${assignedDomain}`;

    return {
      basePlatformDomain: platformDomain,
      assignedSubdomain,
      assignedDomain,
      previewUrl,
      providerConfigured: this.domainProvider.isProviderConfigured(),
      domains: domainRecords.map(toStoreDomainDTO),
    };
  }

  async addCustomDomain(
    db: Database,
    storeId: string,
    actorUserId: string,
    input: AddCustomDomainInput,
  ): Promise<StoreDomainDTO> {
    await requireStoreAccess(db, storeId, actorUserId, "admin");
    await this.getStoreById(db, storeId, actorUserId);

    const platformDomain =
      process.env.PLATFORM_DOMAIN?.trim() ||
      process.env.NEXT_PUBLIC_PLATFORM_DOMAIN?.trim() ||
      "calcart.com";

    const normalizedDomain = normalizeCustomDomain(input.domain);
    validateCustomDomainFormat(normalizedDomain, platformDomain);

    // Enforce global uniqueness across all stores
    const existing = await this.repo.findDomainByHostname(db, normalizedDomain);
    if (existing) {
      if (existing.storeId === storeId) {
        throw new DomainConflictError(
          normalizedDomain,
          `Domain '${normalizedDomain}' is already connected to your store`,
        );
      }
      throw new DomainConflictError(
        normalizedDomain,
        `Domain '${normalizedDomain}' is already registered to another store`,
      );
    }

    // Register with provider (Vercel API or standard DNS instructions)
    const regResult = await this.domainProvider.registerCustomDomain(normalizedDomain, storeId);

    const created = await this.repo.insertStoreDomain(db, {
      storeId,
      domain: normalizedDomain,
      subdomain: null,
      type: "CUSTOM",
      status: "PENDING",
      isPrimary: false,
      verificationChallenge: regResult.verificationChallenge,
      dnsInstructions: regResult.dnsInstructions,
      errorReason: regResult.errorReason,
      sslStatus: "PENDING",
    });

    return toStoreDomainDTO(created);
  }

  async verifyCustomDomain(
    db: Database,
    storeId: string,
    actorUserId: string,
    domainId: string,
  ): Promise<VerifyDomainResultDTO> {
    await requireStoreAccess(db, storeId, actorUserId, "admin");
    const domain = await this.repo.findDomainById(db, domainId);
    if (!domain || domain.storeId !== storeId) {
      throw new DomainNotFoundError(`Domain '${domainId}' not found for store '${storeId}'`);
    }

    if (domain.type === "SUBDOMAIN") {
      return {
        verified: true,
        domain: toStoreDomainDTO(domain),
      };
    }

    const verifyResult = await this.domainProvider.verifyCustomDomain(
      domain.domain,
      domain.verificationChallenge,
    );

    if (verifyResult.verified) {
      const updated = await this.repo.updateStoreDomainVerification(db, domainId, {
        status: "ACTIVE",
        verifiedAt: new Date(),
        errorReason: null,
        sslStatus: "ACTIVE",
        dnsInstructions: verifyResult.dnsInstructions || domain.dnsInstructions,
      });
      return {
        verified: true,
        domain: toStoreDomainDTO(updated!),
      };
    }

    const updated = await this.repo.updateStoreDomainVerification(db, domainId, {
      status: "FAILED",
      verifiedAt: null,
      errorReason: verifyResult.error || "DNS verification check failed",
      sslStatus: verifyResult.sslStatus,
      dnsInstructions: verifyResult.dnsInstructions || domain.dnsInstructions,
    });

    return {
      verified: false,
      domain: toStoreDomainDTO(updated!),
      error: verifyResult.error,
    };
  }

  async setPrimaryStoreDomain(
    db: Database,
    storeId: string,
    actorUserId: string,
    domainId: string,
  ): Promise<SetPrimaryDomainResultDTO> {
    await requireStoreAccess(db, storeId, actorUserId, "admin");
    const domain = await this.repo.findDomainById(db, domainId);
    if (!domain || domain.storeId !== storeId) {
      throw new DomainNotFoundError(`Domain '${domainId}' not found for store '${storeId}'`);
    }

    if (domain.status !== "ACTIVE" || !domain.verifiedAt) {
      throw new DomainNotVerifiedError(
        domain.domain,
        `Domain '${domain.domain}' must be verified and active before it can be set as primary`,
      );
    }

    await db.withTransaction(async (tx) => {
      await this.repo.setPrimaryDomain(tx, storeId, domainId);
    });

    return {
      success: true,
      primaryDomain: domain.domain,
    };
  }

  async removeCustomDomain(
    db: Database,
    storeId: string,
    actorUserId: string,
    domainId: string,
  ): Promise<{ success: boolean; removedDomain: string }> {
    await requireStoreAccess(db, storeId, actorUserId, "admin");
    const domain = await this.repo.findDomainById(db, domainId);
    if (!domain || domain.storeId !== storeId) {
      throw new DomainNotFoundError(`Domain '${domainId}' not found for store '${storeId}'`);
    }

    if (domain.type === "SUBDOMAIN") {
      throw new CannotDeleteDefaultSubdomainError();
    }

    await db.withTransaction(async (tx) => {
      if (domain.isPrimary) {
        const domains = await this.repo.findDomainsByStoreId(tx, storeId);
        const defaultSubdomain = domains.find((d) => d.type === "SUBDOMAIN");
        if (defaultSubdomain) {
          await this.repo.setPrimaryDomain(tx, storeId, defaultSubdomain.id);
        }
      }
      await this.repo.deleteStoreDomain(tx, storeId, domainId);
    });

    await this.domainProvider.removeCustomDomain(domain.domain);

    return {
      success: true,
      removedDomain: domain.domain,
    };
  }

  async resolveStoreByDomain(
    db: Database,
    hostname: string,
  ): Promise<StoreDetailDTO | null> {
    const domainRecord = await this.repo.findDomainByHostname(db, hostname);
    if (!domainRecord || domainRecord.status !== "ACTIVE") {
      return null;
    }

    const store = await this.repo.findStoreWithSettingsById(db, domainRecord.storeId);
    if (!store || store.status !== "ACTIVE") {
      return null;
    }
    return toStoreDetailDTO(store);
  }

}
