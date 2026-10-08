import type { StoreRole } from "@shopify-clone/tenant";

export type StoreStatus = "DRAFT" | "ACTIVE" | "SUSPENDED" | "ARCHIVED";

export type MembershipStatus = "INVITED" | "ACTIVE" | "SUSPENDED" | "REMOVED";

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
