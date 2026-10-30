import type { StoreRole } from "@shopify-clone/tenant";
export type { StoreRole };

export type StoreStatus = "DRAFT" | "ACTIVE" | "SUSPENDED" | "ARCHIVED";

export type MembershipStatus = "INVITED" | "ACTIVE" | "SUSPENDED" | "REMOVED";

export type InvitationStatus = "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";

export interface Organization {
  id: string;
  name: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganizationMembership {
  id: string;
  organizationId: string;
  userId: string;
  role: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Store {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  status: StoreStatus;
  currency: string;
  locale: string;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoreSettings {
  id: string;
  storeId: string;
  contactEmail: string | null;
  contactPhone: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoreMembership {
  id: string;
  storeId: string;
  userId: string;
  role: StoreRole;
  status: MembershipStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoreWithSettings extends Store {
  settings: StoreSettings | null;
}

export interface StoreInvitation {
  id: string;
  storeId: string;
  email: string;
  role: StoreRole;
  tokenHash: string;
  invitedByUserId: string;
  status: InvitationStatus;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type StoreDomainType = "SUBDOMAIN" | "CUSTOM";
export type StoreDomainStatus = "PENDING" | "ACTIVE" | "FAILED";
export type StoreDomainSslStatus = "PENDING" | "ACTIVE" | "ERROR";

export interface StoreDnsInstruction {
  type: "CNAME" | "A" | "TXT";
  name: string;
  value: string;
  recommended: boolean;
  status?: "VALID" | "PENDING" | "FAILED";
}

export interface StoreVerificationChallenge {
  type: string;
  domain: string;
  value: string;
  reason?: string;
}

export interface StoreDomain {
  id: string;
  storeId: string;
  domain: string;
  subdomain: string | null;
  type: StoreDomainType;
  status: StoreDomainStatus;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
  verifiedAt: Date | null;
  verificationChallenge?: StoreVerificationChallenge | null;
  dnsInstructions?: StoreDnsInstruction[] | null;
  errorReason?: string | null;
  sslStatus?: StoreDomainSslStatus | null;
}
