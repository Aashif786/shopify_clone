import type { DatabaseClient } from "@shopify-clone/db";
import type { StoreRole } from "@shopify-clone/tenant";
import type {
  InvitationStatus,
  MembershipStatus,
  Organization,
  OrganizationMembership,
  Store,
  StoreInvitation,
  StoreMembership,
  StoreSettings,
  StoreStatus,
  StoreWithSettings,
} from "../domain/entities.js";

interface StoreRow {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  status: string;
  currency: string;
  locale: string;
  timezone: string;
  created_at: Date;
  updated_at: Date;
}

interface StoreSettingsRow {
  id: string;
  store_id: string;
  contact_email: string | null;
  contact_phone: string | null;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

interface OrgRow {
  id: string;
  name: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

interface OrgMembershipRow {
  id: string;
  organization_id: string;
  user_id: string;
  role: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

interface StoreMembershipRow {
  id: string;
  store_id: string;
  user_id: string;
  role: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

function mapStore(row: StoreRow): Store {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    slug: row.slug,
    status: row.status as StoreStatus,
    currency: row.currency,
    locale: row.locale,
    timezone: row.timezone,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapStoreSettings(row: StoreSettingsRow): StoreSettings {
  return {
    id: row.id,
    storeId: row.store_id,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    description: row.description,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapOrganization(row: OrgRow): Organization {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapOrgMembership(row: OrgMembershipRow): OrganizationMembership {
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    role: row.role,
    status: row.status,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapStoreMembership(row: StoreMembershipRow): StoreMembership {
  return {
    id: row.id,
    storeId: row.store_id,
    userId: row.user_id,
    role: row.role as StoreRole,
    status: row.status as MembershipStatus,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

interface StoreInvitationRow {
  id: string;
  store_id: string;
  email: string;
  role: string;
  token_hash: string;
  invited_by_user_id: string;
  status: string;
  expires_at: Date;
  accepted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function mapStoreInvitation(row: StoreInvitationRow): StoreInvitation {
  return {
    id: row.id,
    storeId: row.store_id,
    email: row.email,
    role: row.role as StoreRole,
    tokenHash: row.token_hash,
    invitedByUserId: row.invited_by_user_id,
    status: row.status as InvitationStatus,
    expiresAt: new Date(row.expires_at),
    acceptedAt: row.accepted_at ? new Date(row.accepted_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export class StoreRepository {
  async findStoreById(
    client: DatabaseClient,
    id: string,
  ): Promise<Store | null> {
    const res = await client.query<StoreRow>(
      `SELECT id, organization_id, name, slug, status, currency, locale, timezone, created_at, updated_at
       FROM stores
       WHERE id = $1`,
      [id],
    );
    return res.rows[0] ? mapStore(res.rows[0]) : null;
  }

  async findStoreWithSettingsById(
    client: DatabaseClient,
    id: string,
  ): Promise<StoreWithSettings | null> {
    const storeRes = await client.query<StoreRow>(
      `SELECT id, organization_id, name, slug, status, currency, locale, timezone, created_at, updated_at
       FROM stores
       WHERE id = $1`,
      [id],
    );
    if (!storeRes.rows[0]) {
      return null;
    }
    const store = mapStore(storeRes.rows[0]);

    const settingsRes = await client.query<StoreSettingsRow>(
      `SELECT id, store_id, contact_email, contact_phone, description, created_at, updated_at
       FROM store_settings
       WHERE store_id = $1`,
      [id],
    );
    const settings = settingsRes.rows[0]
      ? mapStoreSettings(settingsRes.rows[0])
      : null;

    return {
      ...store,
      settings,
    };
  }

  async findStoreBySlug(
    client: DatabaseClient,
    slug: string,
  ): Promise<StoreWithSettings | null> {
    const storeRes = await client.query<StoreRow>(
      `SELECT id, organization_id, name, slug, status, currency, locale, timezone, created_at, updated_at
       FROM stores
       WHERE slug = $1`,
      [slug],
    );
    if (!storeRes.rows[0]) {
      return null;
    }
    const store = mapStore(storeRes.rows[0]);

    const settingsRes = await client.query<StoreSettingsRow>(
      `SELECT id, store_id, contact_email, contact_phone, description, created_at, updated_at
       FROM store_settings
       WHERE store_id = $1`,
      [store.id],
    );
    const settings = settingsRes.rows[0]
      ? mapStoreSettings(settingsRes.rows[0])
      : null;

    return {
      ...store,
      settings,
    };
  }

  async insertStore(
    client: DatabaseClient,
    store: Omit<Store, "createdAt" | "updatedAt">,
  ): Promise<Store> {
    const res = await client.query<StoreRow>(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, organization_id, name, slug, status, currency, locale, timezone, created_at, updated_at`,
      [
        store.id,
        store.organizationId,
        store.name,
        store.slug,
        store.status,
        store.currency,
        store.locale,
        store.timezone,
      ],
    );
    return mapStore(res.rows[0]!);
  }

  async updateStore(
    client: DatabaseClient,
    id: string,
    data: Partial<Pick<Store, "name" | "currency" | "locale" | "timezone">>,
  ): Promise<Store> {
    const updates: string[] = ["updated_at = NOW()"];
    const values: unknown[] = [id];
    let paramIdx = 2;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIdx++}`);
      values.push(data.name);
    }
    if (data.currency !== undefined) {
      updates.push(`currency = $${paramIdx++}`);
      values.push(data.currency);
    }
    if (data.locale !== undefined) {
      updates.push(`locale = $${paramIdx++}`);
      values.push(data.locale);
    }
    if (data.timezone !== undefined) {
      updates.push(`timezone = $${paramIdx++}`);
      values.push(data.timezone);
    }

    const res = await client.query<StoreRow>(
      `UPDATE stores
       SET ${updates.join(", ")}
       WHERE id = $1
       RETURNING id, organization_id, name, slug, status, currency, locale, timezone, created_at, updated_at`,
      values,
    );
    return mapStore(res.rows[0]!);
  }

  async updateStoreStatus(
    client: DatabaseClient,
    id: string,
    status: StoreStatus,
  ): Promise<Store> {
    const res = await client.query<StoreRow>(
      `UPDATE stores
       SET status = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING id, organization_id, name, slug, status, currency, locale, timezone, created_at, updated_at`,
      [id, status],
    );
    return mapStore(res.rows[0]!);
  }

  async insertStoreSettings(
    client: DatabaseClient,
    settings: Omit<StoreSettings, "createdAt" | "updatedAt">,
  ): Promise<StoreSettings> {
    const res = await client.query<StoreSettingsRow>(
      `INSERT INTO store_settings (id, store_id, contact_email, contact_phone, description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, store_id, contact_email, contact_phone, description, created_at, updated_at`,
      [
        settings.id,
        settings.storeId,
        settings.contactEmail,
        settings.contactPhone,
        settings.description,
      ],
    );
    return mapStoreSettings(res.rows[0]!);
  }

  async updateStoreSettings(
    client: DatabaseClient,
    storeId: string,
    data: Partial<
      Pick<StoreSettings, "contactEmail" | "contactPhone" | "description">
    >,
  ): Promise<StoreSettings> {
    const updates: string[] = ["updated_at = NOW()"];
    const values: unknown[] = [storeId];
    let paramIdx = 2;

    if (data.contactEmail !== undefined) {
      updates.push(`contact_email = $${paramIdx++}`);
      values.push(data.contactEmail);
    }
    if (data.contactPhone !== undefined) {
      updates.push(`contact_phone = $${paramIdx++}`);
      values.push(data.contactPhone);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIdx++}`);
      values.push(data.description);
    }

    const res = await client.query<StoreSettingsRow>(
      `UPDATE store_settings
       SET ${updates.join(", ")}
       WHERE store_id = $1
       RETURNING id, store_id, contact_email, contact_phone, description, created_at, updated_at`,
      values,
    );
    return mapStoreSettings(res.rows[0]!);
  }

  async findStoreSettings(
    client: DatabaseClient,
    storeId: string,
  ): Promise<StoreSettings | null> {
    const res = await client.query<StoreSettingsRow>(
      `SELECT id, store_id, contact_email, contact_phone, description, created_at, updated_at
       FROM store_settings
       WHERE store_id = $1`,
      [storeId],
    );
    return res.rows[0] ? mapStoreSettings(res.rows[0]) : null;
  }

  async findOrganizationById(
    client: DatabaseClient,
    id: string,
  ): Promise<Organization | null> {
    const res = await client.query<OrgRow>(
      `SELECT id, name, status, created_at, updated_at
       FROM organizations
       WHERE id = $1`,
      [id],
    );
    return res.rows[0] ? mapOrganization(res.rows[0]) : null;
  }

  async insertOrganization(
    client: DatabaseClient,
    org: Omit<Organization, "createdAt" | "updatedAt">,
  ): Promise<Organization> {
    const res = await client.query<OrgRow>(
      `INSERT INTO organizations (id, name, status)
       VALUES ($1, $2, $3)
       RETURNING id, name, status, created_at, updated_at`,
      [org.id, org.name, org.status],
    );
    return mapOrganization(res.rows[0]!);
  }

  async insertOrganizationMembership(
    client: DatabaseClient,
    m: Omit<OrganizationMembership, "createdAt" | "updatedAt">,
  ): Promise<OrganizationMembership> {
    const res = await client.query<OrgMembershipRow>(
      `INSERT INTO organization_memberships (id, organization_id, user_id, role, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, organization_id, user_id, role, status, created_at, updated_at`,
      [m.id, m.organizationId, m.userId, m.role, m.status],
    );
    return mapOrgMembership(res.rows[0]!);
  }

  async findOrganizationMembership(
    client: DatabaseClient,
    orgId: string,
    userId: string,
  ): Promise<OrganizationMembership | null> {
    const res = await client.query<OrgMembershipRow>(
      `SELECT id, organization_id, user_id, role, status, created_at, updated_at
       FROM organization_memberships
       WHERE organization_id = $1 AND user_id = $2`,
      [orgId, userId],
    );
    return res.rows[0] ? mapOrgMembership(res.rows[0]) : null;
  }

  async findUserOrganizationMemberships(
    client: DatabaseClient,
    userId: string,
  ): Promise<OrganizationMembership[]> {
    const res = await client.query<OrgMembershipRow>(
      `SELECT id, organization_id, user_id, role, status, created_at, updated_at
       FROM organization_memberships
       WHERE user_id = $1 AND status = 'ACTIVE'`,
      [userId],
    );
    return res.rows.map(mapOrgMembership);
  }

  async insertStoreMembership(
    client: DatabaseClient,
    m: Omit<StoreMembership, "createdAt" | "updatedAt">,
  ): Promise<StoreMembership> {
    const res = await client.query<StoreMembershipRow>(
      `INSERT INTO store_memberships (id, store_id, user_id, role, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, store_id, user_id, role, status, created_at, updated_at`,
      [m.id, m.storeId, m.userId, m.role, m.status],
    );
    return mapStoreMembership(res.rows[0]!);
  }

  async findStoreMembership(
    client: DatabaseClient,
    storeId: string,
    userId: string,
  ): Promise<StoreMembership | null> {
    const res = await client.query<StoreMembershipRow>(
      `SELECT id, store_id, user_id, role, status, created_at, updated_at
       FROM store_memberships
       WHERE store_id = $1 AND user_id = $2`,
      [storeId, userId],
    );
    return res.rows[0] ? mapStoreMembership(res.rows[0]) : null;
  }

  async findStoreMembershipById(
    client: DatabaseClient,
    membershipId: string,
  ): Promise<StoreMembership | null> {
    const res = await client.query<StoreMembershipRow>(
      `SELECT id, store_id, user_id, role, status, created_at, updated_at
       FROM store_memberships
       WHERE id = $1`,
      [membershipId],
    );
    return res.rows[0] ? mapStoreMembership(res.rows[0]) : null;
  }

  async listStoreMemberships(
    client: DatabaseClient,
    storeId: string,
  ): Promise<StoreMembership[]> {
    const res = await client.query<StoreMembershipRow>(
      `SELECT id, store_id, user_id, role, status, created_at, updated_at
       FROM store_memberships
       WHERE store_id = $1
       ORDER BY created_at ASC`,
      [storeId],
    );
    return res.rows.map(mapStoreMembership);
  }

  async updateStoreMembershipRole(
    client: DatabaseClient,
    membershipId: string,
    role: StoreRole,
  ): Promise<StoreMembership> {
    const res = await client.query<StoreMembershipRow>(
      `UPDATE store_memberships
       SET role = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING id, store_id, user_id, role, status, created_at, updated_at`,
      [membershipId, role],
    );
    return mapStoreMembership(res.rows[0]!);
  }

  async updateStoreMembershipStatus(
    client: DatabaseClient,
    membershipId: string,
    status: MembershipStatus,
  ): Promise<StoreMembership> {
    const res = await client.query<StoreMembershipRow>(
      `UPDATE store_memberships
       SET status = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING id, store_id, user_id, role, status, created_at, updated_at`,
      [membershipId, status],
    );
    return mapStoreMembership(res.rows[0]!);
  }

  async countActiveOwnersForUpdate(
    client: DatabaseClient,
    storeId: string,
  ): Promise<number> {
    const res = await client.query<{ id: string }>(
      `SELECT id
       FROM store_memberships
       WHERE store_id = $1 AND role = 'owner' AND status = 'ACTIVE'
       FOR UPDATE`,
      [storeId],
    );
    return res.rowCount ?? 0;
  }

  async countActiveOwners(
    client: DatabaseClient,
    storeId: string,
  ): Promise<number> {
    const res = await client.query<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM store_memberships
       WHERE store_id = $1 AND role = 'owner' AND status = 'ACTIVE'`,
      [storeId],
    );
    return parseInt(res.rows[0]?.count ?? "0", 10);
  }

  async listAllStores(
    client: DatabaseClient,
  ): Promise<(Store & { role?: StoreRole })[]> {
    const res = await client.query<StoreRow>(
      `SELECT id, organization_id, name, slug, status, currency, locale, timezone, created_at, updated_at
       FROM stores
       WHERE status != 'ARCHIVED'
       ORDER BY created_at DESC`
    );
    return res.rows.map((row) => ({
      ...mapStore(row),
      role: "owner" as StoreRole,
    }));
  }

  async listStoresByUserId(
    client: DatabaseClient,
    userId: string,
  ): Promise<(Store & { role?: StoreRole })[]> {
    const res = await client.query<StoreRow & { role?: string }>(
      `SELECT s.id, s.organization_id, s.name, s.slug, s.status, s.currency, s.locale, s.timezone, s.created_at, s.updated_at, sm.role
       FROM stores s
       JOIN store_memberships sm ON s.id = sm.store_id
       WHERE sm.user_id = $1 AND sm.status = 'ACTIVE'
       ORDER BY s.created_at DESC`,
      [userId],
    );
    return res.rows.map((row) => ({
      ...mapStore(row),
      role: row.role as StoreRole | undefined,
    }));
  }

  async insertStoreInvitation(
    client: DatabaseClient,
    invitation: {
      id: string;
      storeId: string;
      email: string;
      role: StoreRole;
      tokenHash: string;
      invitedByUserId: string;
      expiresAt: Date;
    },
  ): Promise<StoreInvitation> {
    const res = await client.query<StoreInvitationRow>(
      `INSERT INTO store_invitations (id, store_id, email, role, token_hash, invited_by_user_id, status, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7)
       RETURNING id, store_id, email, role, token_hash, invited_by_user_id, status, expires_at, accepted_at, created_at, updated_at`,
      [
        invitation.id,
        invitation.storeId,
        invitation.email,
        invitation.role,
        invitation.tokenHash,
        invitation.invitedByUserId,
        invitation.expiresAt,
      ],
    );
    return mapStoreInvitation(res.rows[0]!);
  }

  async listStoreInvitations(
    client: DatabaseClient,
    storeId: string,
  ): Promise<StoreInvitation[]> {
    const res = await client.query<StoreInvitationRow>(
      `SELECT id, store_id, email, role, token_hash, invited_by_user_id, status, expires_at, accepted_at, created_at, updated_at
       FROM store_invitations
       WHERE store_id = $1
       ORDER BY created_at DESC`,
      [storeId],
    );
    return res.rows.map(mapStoreInvitation);
  }

  async findStoreInvitationById(
    client: DatabaseClient,
    invitationId: string,
  ): Promise<StoreInvitation | null> {
    const res = await client.query<StoreInvitationRow>(
      `SELECT id, store_id, email, role, token_hash, invited_by_user_id, status, expires_at, accepted_at, created_at, updated_at
       FROM store_invitations
       WHERE id = $1`,
      [invitationId],
    );
    return res.rows[0] ? mapStoreInvitation(res.rows[0]) : null;
  }

  async findStoreInvitationByTokenHash(
    client: DatabaseClient,
    tokenHash: string,
  ): Promise<StoreInvitation | null> {
    const res = await client.query<StoreInvitationRow>(
      `SELECT id, store_id, email, role, token_hash, invited_by_user_id, status, expires_at, accepted_at, created_at, updated_at
       FROM store_invitations
       WHERE token_hash = $1`,
      [tokenHash],
    );
    return res.rows[0] ? mapStoreInvitation(res.rows[0]) : null;
  }

  async findPendingInvitationByEmail(
    client: DatabaseClient,
    storeId: string,
    email: string,
  ): Promise<StoreInvitation | null> {
    const res = await client.query<StoreInvitationRow>(
      `SELECT id, store_id, email, role, token_hash, invited_by_user_id, status, expires_at, accepted_at, created_at, updated_at
       FROM store_invitations
       WHERE store_id = $1 AND email = $2 AND status = 'PENDING' AND expires_at > NOW()`,
      [storeId, email],
    );
    return res.rows[0] ? mapStoreInvitation(res.rows[0]) : null;
  }

  async updateStoreInvitationStatus(
    client: DatabaseClient,
    invitationId: string,
    status: InvitationStatus,
    acceptedAt?: Date,
  ): Promise<StoreInvitation> {
    const res = await client.query<StoreInvitationRow>(
      `UPDATE store_invitations
       SET status = $2, accepted_at = COALESCE($3, accepted_at), updated_at = NOW()
       WHERE id = $1
       RETURNING id, store_id, email, role, token_hash, invited_by_user_id, status, expires_at, accepted_at, created_at, updated_at`,
      [invitationId, status, acceptedAt ?? null],
    );
    return mapStoreInvitation(res.rows[0]!);
  }

  async findUserById(
    client: DatabaseClient,
    userId: string,
  ): Promise<{ id: string; email: string; name: string; status: string } | null> {
    const res = await client.query<{ id: string; email: string; name: string; status: string }>(
      `SELECT id, email, name, status FROM users WHERE id = $1`,
      [userId],
    );
    return res.rows[0] ?? null;
  }

  async findUserByEmail(
    client: DatabaseClient,
    email: string,
  ): Promise<{ id: string; email: string; name: string; status: string } | null> {
    const res = await client.query<{ id: string; email: string; name: string; status: string }>(
      `SELECT id, email, name, status FROM users WHERE email = $1`,
      [email],
    );
    return res.rows[0] ?? null;
  }
}
