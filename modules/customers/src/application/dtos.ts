import type { CustomerStatus } from "../domain/entities/customer.js";

export interface CustomerDTO {
  id: string;
  storeId: string;
  userId: string | null;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  status: CustomerStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerAddressDTO {
  id: string;
  storeId: string;
  customerId: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  country: string;
  phone: string | null;
  label: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerWithAddressesDTO extends CustomerDTO {
  addresses: CustomerAddressDTO[];
  defaultAddress: CustomerAddressDTO | null;
}

export interface CreateCustomerInput {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  userId?: string | null;
}

export interface UpdateCustomerInput {
  email?: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  status?: CustomerStatus;
  userId?: string | null;
}

export interface ListCustomersInput {
  status?: CustomerStatus;
  search?: string;
  limit?: number;
  cursor?: string;
}

export interface CustomerListDTO {
  items: CustomerDTO[];
  hasMore: boolean;
  nextCursor?: string;
}

export interface CreateCustomerAddressInput {
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state?: string | null;
  postalCode: string;
  country: string;
  phone?: string | null;
  label?: string | null;
  isDefault?: boolean;
}

export interface UpdateCustomerAddressInput {
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  addressLine1?: string;
  addressLine2?: string | null;
  city?: string;
  state?: string | null;
  postalCode?: string;
  country?: string;
  phone?: string | null;
  label?: string | null;
  isDefault?: boolean;
}
