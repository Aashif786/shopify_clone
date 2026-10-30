import type { StoreRole } from "@shopify-clone/tenant";
import type { MembershipStatus, StoreStatus } from "../domain/entities.js";

export interface CreateStoreInput {
  name: string;
  slug?: string;
  currency?: string;
  locale?: string;
  timezone?: string;
  organizationId?: string;
  organizationName?: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  description?: string | null;
  status?: StoreStatus;
}

export interface UpdateStoreInput {
  name?: string;
  currency?: string;
  locale?: string;
  timezone?: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  description?: string | null;
}

export interface StoreSummaryDTO {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  status: StoreStatus;
  currency: string;
  locale: string;
  timezone: string;
  role?: StoreRole;
  createdAt: string;
  updatedAt: string;
}

export interface StoreSettingsDTO {
  contactEmail: string | null;
  contactPhone: string | null;
  description: string | null;
}

export interface StoreDetailDTO {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  status: StoreStatus;
  currency: string;
  locale: string;
  timezone: string;
  settings: StoreSettingsDTO | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoreMemberDTO {
  id: string;
  storeId: string;
  userId: string;
  role: StoreRole;
  status: MembershipStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AddStoreMemberInput {
  userId: string;
  role: StoreRole;
}

export interface UpdateStoreMemberInput {
  role?: StoreRole;
  status?: MembershipStatus;
}

export interface CreateStoreInvitationInput {
  email: string;
  role: "admin" | "staff";
}

export interface StoreInvitationDTO {
  id: string;
  storeId: string;
  email: string;
  role: StoreRole;
  status: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
}

export interface StoreInvitationWithTokenDTO extends StoreInvitationDTO {
  rawToken: string;
}

export interface InvitationDetailsDTO {
  id: string;
  storeId: string;
  storeName: string;
  storeSlug: string;
  email: string;
  role: StoreRole;
  status: string;
  expiresAt: string;
  isExpired: boolean;
}

export interface StoreDnsInstructionDTO {
  type: "CNAME" | "A" | "TXT";
  name: string;
  value: string;
  recommended: boolean;
  status?: "VALID" | "PENDING" | "FAILED";
}

export interface StoreVerificationChallengeDTO {
  type: string;
  domain: string;
  value: string;
  reason?: string;
}

export interface StoreDomainDTO {
  id: string;
  storeId: string;
  domain: string;
  subdomain: string | null;
  type: "SUBDOMAIN" | "CUSTOM";
  status: "PENDING" | "ACTIVE" | "FAILED";
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
  verifiedAt: string | null;
  verificationChallenge?: StoreVerificationChallengeDTO | null;
  dnsInstructions?: StoreDnsInstructionDTO[] | null;
  errorReason?: string | null;
  sslStatus?: "PENDING" | "ACTIVE" | "ERROR" | null;
}

export interface AddCustomDomainInput {
  domain: string;
}

export interface VerifyDomainResultDTO {
  verified: boolean;
  domain: StoreDomainDTO;
  error?: string;
}

export interface SetPrimaryDomainResultDTO {
  success: boolean;
  primaryDomain: string;
}

export interface StoreDomainsResponseDTO {
  basePlatformDomain: string;
  assignedSubdomain: string;
  assignedDomain: string;
  domains: StoreDomainDTO[];
  previewUrl: string;
  providerConfigured: boolean;
}
