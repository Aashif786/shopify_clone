export interface CustomerAddress {
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
  createdAt: Date;
  updatedAt: Date;
}
