import type { Database, DatabaseClient } from "@shopify-clone/db";
import { generateUuidV7 } from "@shopify-clone/db";
import type { CustomerAddress } from "../domain/entities/address.js";
import {
  assertValidCustomerTransition,
  type Customer,
  type CustomerStatus,
} from "../domain/entities/customer.js";
import {
  AddressNotFoundError,
  CrossStoreAddressAccessError,
  CustomerAlreadyExistsError,
  CustomerNotFoundError,
  DefaultAddressConflictError,
  DuplicateCustomerError,
  InvalidCustomerUserError,
} from "../domain/errors.js";
import {
  normalizeEmail,
  validateAddressLine,
  validateCity,
  validateCountryCode,
  validateCustomerEmail,
  validateCustomerName,
  validateCustomerPhone,
  validateCustomerStatus,
  validateOptionalAddressLine,
  validatePostalCode,
  validateState,
} from "../domain/validation.js";
import { CustomerRepository } from "../infrastructure/customer-repository.js";
import type {
  CreateCustomerAddressInput,
  CreateCustomerInput,
  CustomerAddressDTO,
  CustomerDTO,
  CustomerListDTO,
  CustomerWithAddressesDTO,
  ListCustomersInput,
  UpdateCustomerAddressInput,
  UpdateCustomerInput,
} from "./dtos.js";

function isDatabase(client: Database | DatabaseClient): client is Database {
  return "withTransaction" in client;
}

async function runInTransaction<T>(
  clientOrDb: Database | DatabaseClient,
  fn: (tx: DatabaseClient) => Promise<T>,
): Promise<T> {
  if (isDatabase(clientOrDb)) {
    return clientOrDb.withTransaction(fn);
  }
  return fn(clientOrDb);
}

function toCustomerDTO(customer: Customer): CustomerDTO {
  return {
    id: customer.id,
    storeId: customer.storeId,
    userId: customer.userId,
    email: customer.email,
    firstName: customer.firstName,
    lastName: customer.lastName,
    phone: customer.phone,
    status: customer.status,
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
  };
}

function toAddressDTO(address: CustomerAddress): CustomerAddressDTO {
  return {
    id: address.id,
    storeId: address.storeId,
    customerId: address.customerId,
    firstName: address.firstName,
    lastName: address.lastName,
    company: address.company,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2,
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    country: address.country,
    phone: address.phone,
    label: address.label,
    isDefault: address.isDefault,
    createdAt: address.createdAt.toISOString(),
    updatedAt: address.updatedAt.toISOString(),
  };
}

export class CustomerService {
  constructor(
    private readonly repo: CustomerRepository = new CustomerRepository(),
  ) {}

  async createCustomer(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    input: CreateCustomerInput,
  ): Promise<CustomerDTO> {
    const normalizedEmail = validateCustomerEmail(input.email);
    const firstName = validateCustomerName(input.firstName, "First name");
    const lastName = validateCustomerName(input.lastName, "Last name");
    const phone = validateCustomerPhone(input.phone);

    return runInTransaction(clientOrDb, async (tx) => {
      if (input.userId) {
        const userExists = await this.repo.userExists(tx, input.userId);
        if (!userExists) {
          throw new InvalidCustomerUserError(
            "Referenced user does not exist",
            { userId: input.userId },
          );
        }

        const existingUserCustomer = await this.repo.findCustomerByUserId(
          tx,
          storeId,
          input.userId,
        );
        if (existingUserCustomer) {
          throw new DuplicateCustomerError(
            "Customer already exists for this platform user in this store",
            { storeId, userId: input.userId },
          );
        }
      }

      const existingEmailCustomer = await this.repo.findCustomerByEmail(
        tx,
        storeId,
        normalizedEmail,
      );
      if (existingEmailCustomer) {
        throw new CustomerAlreadyExistsError(
          "Customer with this email already exists in this store",
          { storeId, email: normalizedEmail },
        );
      }

      try {
        const customerId = generateUuidV7();
        const customer = await this.repo.insertCustomer(tx, {
          id: customerId,
          storeId,
          userId: input.userId ?? null,
          email: normalizedEmail,
          firstName,
          lastName,
          phone,
          status: "ACTIVE",
        });
        return toCustomerDTO(customer);
      } catch (err: unknown) {
        const pgErr = err as { code?: string; constraint?: string };
        if (pgErr.code === "23505") {
          if (
            pgErr.constraint?.includes("email") ||
            pgErr.constraint === "customers_store_email_unique"
          ) {
            throw new CustomerAlreadyExistsError(
              "Customer with this email already exists in this store",
              { storeId, email: normalizedEmail },
            );
          }
          if (
            pgErr.constraint?.includes("user") ||
            pgErr.constraint === "customers_store_user_idx"
          ) {
            throw new DuplicateCustomerError(
              "Customer already exists for this platform user in this store",
              { storeId, userId: input.userId },
            );
          }
          throw new DuplicateCustomerError(
            "Customer already exists in this store",
            { storeId },
          );
        }
        throw err;
      }
    });
  }

  async getCustomerById(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    customerId: string,
  ): Promise<CustomerDTO> {
    return runInTransaction(clientOrDb, async (tx) => {
      const customer = await this.repo.findCustomerById(tx, storeId, customerId);
      if (!customer) {
        throw new CustomerNotFoundError("Customer not found", {
          storeId,
          customerId,
        });
      }
      return toCustomerDTO(customer);
    });
  }

  async getCustomerByEmail(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    email: string,
  ): Promise<CustomerDTO | null> {
    const normalized = normalizeEmail(email);
    return runInTransaction(clientOrDb, async (tx) => {
      const customer = await this.repo.findCustomerByEmail(
        tx,
        storeId,
        normalized,
      );
      return customer ? toCustomerDTO(customer) : null;
    });
  }

  async getCustomerByUserId(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    userId: string,
  ): Promise<CustomerDTO | null> {
    return runInTransaction(clientOrDb, async (tx) => {
      const customer = await this.repo.findCustomerByUserId(
        tx,
        storeId,
        userId,
      );
      return customer ? toCustomerDTO(customer) : null;
    });
  }

  async getCustomerWithAddresses(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    customerId: string,
  ): Promise<CustomerWithAddressesDTO> {
    return runInTransaction(clientOrDb, async (tx) => {
      const customer = await this.repo.findCustomerById(tx, storeId, customerId);
      if (!customer) {
        throw new CustomerNotFoundError("Customer not found", {
          storeId,
          customerId,
        });
      }

      const addresses = await this.repo.listAddressesByCustomerId(
        tx,
        storeId,
        customerId,
      );
      const defaultAddr = addresses.find((a) => a.isDefault) ?? null;

      return {
        ...toCustomerDTO(customer),
        addresses: addresses.map(toAddressDTO),
        defaultAddress: defaultAddr ? toAddressDTO(defaultAddr) : null,
      };
    });
  }

  async updateCustomer(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    customerId: string,
    input: UpdateCustomerInput,
  ): Promise<CustomerDTO> {
    return runInTransaction(clientOrDb, async (tx) => {
      const existing = await this.repo.findCustomerByIdForUpdate(
        tx,
        storeId,
        customerId,
      );
      if (!existing) {
        throw new CustomerNotFoundError("Customer not found", {
          storeId,
          customerId,
        });
      }

      let validatedStatus: CustomerStatus | undefined;
      if (input.status !== undefined) {
        validatedStatus = validateCustomerStatus(input.status);
        assertValidCustomerTransition(existing.status, validatedStatus);
      }

      let normalizedEmail: string | undefined;
      if (input.email !== undefined) {
        normalizedEmail = validateCustomerEmail(input.email);
        if (normalizedEmail !== existing.email) {
          const emailCheck = await this.repo.findCustomerByEmail(
            tx,
            storeId,
            normalizedEmail,
          );
          if (emailCheck && emailCheck.id !== customerId) {
            throw new CustomerAlreadyExistsError(
              "Customer with this email already exists in this store",
              { storeId, email: normalizedEmail },
            );
          }
        }
      }

      if (input.userId !== undefined && input.userId !== existing.userId) {
        if (input.userId !== null) {
          const userExists = await this.repo.userExists(tx, input.userId);
          if (!userExists) {
            throw new InvalidCustomerUserError(
              "Referenced user does not exist",
              { userId: input.userId },
            );
          }
          const userCheck = await this.repo.findCustomerByUserId(
            tx,
            storeId,
            input.userId,
          );
          if (userCheck && userCheck.id !== customerId) {
            throw new DuplicateCustomerError(
              "Customer already exists for this platform user in this store",
              { storeId, userId: input.userId },
            );
          }
        }
      }

      const firstName =
        input.firstName !== undefined
          ? validateCustomerName(input.firstName, "First name")
          : undefined;
      const lastName =
        input.lastName !== undefined
          ? validateCustomerName(input.lastName, "Last name")
          : undefined;
      const phone =
        input.phone !== undefined
          ? validateCustomerPhone(input.phone)
          : undefined;

      try {
        const updated = await this.repo.updateCustomer(tx, storeId, customerId, {
          email: normalizedEmail,
          firstName,
          lastName,
          phone,
          status: validatedStatus,
          userId: input.userId,
        });

        if (!updated) {
          throw new CustomerNotFoundError("Customer not found", {
            storeId,
            customerId,
          });
        }

        return toCustomerDTO(updated);
      } catch (err: unknown) {
        const pgErr = err as { code?: string; constraint?: string };
        if (pgErr.code === "23505") {
          if (
            pgErr.constraint?.includes("email") ||
            pgErr.constraint === "customers_store_email_unique"
          ) {
            throw new CustomerAlreadyExistsError(
              "Customer with this email already exists in this store",
              { storeId, email: normalizedEmail },
            );
          }
          if (
            pgErr.constraint?.includes("user") ||
            pgErr.constraint === "customers_store_user_idx"
          ) {
            throw new DuplicateCustomerError(
              "Customer already exists for this platform user in this store",
              { storeId, userId: input.userId },
            );
          }
          throw new DuplicateCustomerError(
            "Customer already exists in this store",
            { storeId },
          );
        }
        throw err;
      }
    });
  }

  async changeCustomerStatus(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    customerId: string,
    newStatus: CustomerStatus,
  ): Promise<CustomerDTO> {
    return this.updateCustomer(clientOrDb, storeId, customerId, {
      status: newStatus,
    });
  }

  async disableCustomer(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    customerId: string,
  ): Promise<CustomerDTO> {
    return this.changeCustomerStatus(clientOrDb, storeId, customerId, "DISABLED");
  }

  async enableCustomer(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    customerId: string,
  ): Promise<CustomerDTO> {
    return this.changeCustomerStatus(clientOrDb, storeId, customerId, "ACTIVE");
  }

  async listCustomers(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    options?: ListCustomersInput,
  ): Promise<CustomerListDTO> {
    return runInTransaction(clientOrDb, async (tx) => {
      const res = await this.repo.listCustomers(tx, {
        storeId,
        status: options?.status,
        search: options?.search,
        limit: options?.limit,
        cursor: options?.cursor,
      });

      return {
        items: res.items.map(toCustomerDTO),
        hasMore: res.hasMore,
        nextCursor: res.nextCursor,
      };
    });
  }

  async createAddress(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    customerId: string,
    input: CreateCustomerAddressInput,
  ): Promise<CustomerAddressDTO> {
    const addressLine1 = validateAddressLine(
      input.addressLine1,
      "Address line 1",
    );
    const addressLine2 = validateOptionalAddressLine(
      input.addressLine2,
      "Address line 2",
    );
    const city = validateCity(input.city);
    const state = validateState(input.state);
    const postalCode = validatePostalCode(input.postalCode);
    const country = validateCountryCode(input.country);
    const firstName = validateCustomerName(input.firstName, "First name");
    const lastName = validateCustomerName(input.lastName, "Last name");
    const company = validateCustomerName(input.company, "Company");
    const phone = validateCustomerPhone(input.phone);
    const label = validateCustomerName(input.label, "Label");

    return runInTransaction(clientOrDb, async (tx) => {
      const customer = input.isDefault
        ? await this.repo.findCustomerByIdForUpdate(tx, storeId, customerId)
        : await this.repo.findCustomerById(tx, storeId, customerId);

      if (!customer) {
        throw new CustomerNotFoundError("Customer not found", {
          storeId,
          customerId,
        });
      }

      if (input.isDefault) {
        await this.repo.clearDefaultAddresses(tx, storeId, customerId);
      }

      try {
        const addressId = generateUuidV7();
        const address = await this.repo.insertAddress(tx, {
          id: addressId,
          storeId,
          customerId,
          firstName,
          lastName,
          company,
          addressLine1,
          addressLine2,
          city,
          state,
          postalCode,
          country,
          phone,
          label,
          isDefault: input.isDefault,
        });
        return toAddressDTO(address);
      } catch (err: unknown) {
        const pgErr = err as { code?: string; constraint?: string };
        if (
          pgErr.code === "23505" &&
          (pgErr.constraint?.includes("default") ||
            pgErr.constraint === "customer_addresses_customer_default_idx")
        ) {
          throw new DefaultAddressConflictError(
            "Conflict occurred while designating default address",
            { storeId, customerId },
          );
        }
        if (pgErr.code === "23503") {
          throw new CrossStoreAddressAccessError(
            "Address cannot be created: customer does not belong to authorized store",
            { storeId, customerId },
          );
        }
        throw err;
      }
    });
  }

  async getAddressById(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    customerId: string,
    addressId: string,
  ): Promise<CustomerAddressDTO> {
    return runInTransaction(clientOrDb, async (tx) => {
      const customer = await this.repo.findCustomerById(tx, storeId, customerId);
      if (!customer) {
        throw new CustomerNotFoundError("Customer not found", {
          storeId,
          customerId,
        });
      }

      const address = await this.repo.findAddressById(
        tx,
        storeId,
        customerId,
        addressId,
      );
      if (!address) {
        const globalCheck = await this.repo.addressExistsGlobally(tx, addressId);
        if (globalCheck.exists) {
          throw new CrossStoreAddressAccessError(
            "Address does not belong to the authorized store or customer",
            { storeId, customerId, addressId },
          );
        }
        throw new AddressNotFoundError("Address not found", { addressId });
      }

      return toAddressDTO(address);
    });
  }

  async listAddresses(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    customerId: string,
  ): Promise<CustomerAddressDTO[]> {
    return runInTransaction(clientOrDb, async (tx) => {
      const customer = await this.repo.findCustomerById(tx, storeId, customerId);
      if (!customer) {
        throw new CustomerNotFoundError("Customer not found", {
          storeId,
          customerId,
        });
      }

      const addresses = await this.repo.listAddressesByCustomerId(
        tx,
        storeId,
        customerId,
      );
      return addresses.map(toAddressDTO);
    });
  }

  async updateAddress(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    customerId: string,
    addressId: string,
    input: UpdateCustomerAddressInput,
  ): Promise<CustomerAddressDTO> {
    const addressLine1 =
      input.addressLine1 !== undefined
        ? validateAddressLine(input.addressLine1, "Address line 1")
        : undefined;
    const addressLine2 =
      input.addressLine2 !== undefined
        ? validateOptionalAddressLine(input.addressLine2, "Address line 2")
        : undefined;
    const city =
      input.city !== undefined ? validateCity(input.city) : undefined;
    const state =
      input.state !== undefined ? validateState(input.state) : undefined;
    const postalCode =
      input.postalCode !== undefined
        ? validatePostalCode(input.postalCode)
        : undefined;
    const country =
      input.country !== undefined
        ? validateCountryCode(input.country)
        : undefined;
    const firstName =
      input.firstName !== undefined
        ? validateCustomerName(input.firstName, "First name")
        : undefined;
    const lastName =
      input.lastName !== undefined
        ? validateCustomerName(input.lastName, "Last name")
        : undefined;
    const company =
      input.company !== undefined
        ? validateCustomerName(input.company, "Company")
        : undefined;
    const phone =
      input.phone !== undefined
        ? validateCustomerPhone(input.phone)
        : undefined;
    const label =
      input.label !== undefined
        ? validateCustomerName(input.label, "Label")
        : undefined;

    return runInTransaction(clientOrDb, async (tx) => {
      const customer = await this.repo.findCustomerById(tx, storeId, customerId);
      if (!customer) {
        throw new CustomerNotFoundError("Customer not found", {
          storeId,
          customerId,
        });
      }

      const existing = await this.repo.findAddressByIdForUpdate(
        tx,
        storeId,
        customerId,
        addressId,
      );
      if (!existing) {
        const globalCheck = await this.repo.addressExistsGlobally(tx, addressId);
        if (globalCheck.exists) {
          throw new CrossStoreAddressAccessError(
            "Address does not belong to the authorized store or customer",
            { storeId, customerId, addressId },
          );
        }
        throw new AddressNotFoundError("Address not found", { addressId });
      }

      if (input.isDefault === true && !existing.isDefault) {
        await this.repo.findCustomerByIdForUpdate(tx, storeId, customerId);
        await this.repo.clearDefaultAddresses(tx, storeId, customerId, addressId);
      }

      try {
        const updated = await this.repo.updateAddress(
          tx,
          storeId,
          customerId,
          addressId,
          {
            firstName,
            lastName,
            company,
            addressLine1,
            addressLine2,
            city,
            state,
            postalCode,
            country,
            phone,
            label,
            isDefault: input.isDefault,
          },
        );

        if (!updated) {
          throw new AddressNotFoundError("Address not found", { addressId });
        }

        return toAddressDTO(updated);
      } catch (err: unknown) {
        const pgErr = err as { code?: string; constraint?: string };
        if (
          pgErr.code === "23505" &&
          (pgErr.constraint?.includes("default") ||
            pgErr.constraint === "customer_addresses_customer_default_idx")
        ) {
          throw new DefaultAddressConflictError(
            "Conflict occurred while designating default address",
            { storeId, customerId },
          );
        }
        throw err;
      }
    });
  }

  async deleteAddress(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    customerId: string,
    addressId: string,
  ): Promise<void> {
    return runInTransaction(clientOrDb, async (tx) => {
      const customer = await this.repo.findCustomerById(tx, storeId, customerId);
      if (!customer) {
        throw new CustomerNotFoundError("Customer not found", {
          storeId,
          customerId,
        });
      }

      const existing = await this.repo.findAddressById(
        tx,
        storeId,
        customerId,
        addressId,
      );
      if (!existing) {
        const globalCheck = await this.repo.addressExistsGlobally(tx, addressId);
        if (globalCheck.exists) {
          throw new CrossStoreAddressAccessError(
            "Address does not belong to the authorized store or customer",
            { storeId, customerId, addressId },
          );
        }
        throw new AddressNotFoundError("Address not found", { addressId });
      }

      await this.repo.deleteAddress(tx, storeId, customerId, addressId);
    });
  }

  async setDefaultAddress(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    customerId: string,
    addressId: string,
  ): Promise<CustomerAddressDTO> {
    return runInTransaction(clientOrDb, async (tx) => {
      const customer = await this.repo.findCustomerByIdForUpdate(
        tx,
        storeId,
        customerId,
      );
      if (!customer) {
        throw new CustomerNotFoundError("Customer not found", {
          storeId,
          customerId,
        });
      }

      const address = await this.repo.findAddressByIdForUpdate(
        tx,
        storeId,
        customerId,
        addressId,
      );
      if (!address) {
        const globalCheck = await this.repo.addressExistsGlobally(tx, addressId);
        if (globalCheck.exists) {
          throw new CrossStoreAddressAccessError(
            "Address does not belong to the authorized store or customer",
            { storeId, customerId, addressId },
          );
        }
        throw new AddressNotFoundError("Address not found", { addressId });
      }

      if (address.isDefault) {
        return toAddressDTO(address);
      }

      await this.repo.clearDefaultAddresses(tx, storeId, customerId, addressId);

      try {
        const updated = await this.repo.setDefaultAddress(
          tx,
          storeId,
          customerId,
          addressId,
        );
        if (!updated) {
          throw new AddressNotFoundError("Address not found", { addressId });
        }
        return toAddressDTO(updated);
      } catch (err: unknown) {
        const pgErr = err as { code?: string; constraint?: string };
        if (
          pgErr.code === "23505" &&
          (pgErr.constraint?.includes("default") ||
            pgErr.constraint === "customer_addresses_customer_default_idx")
        ) {
          throw new DefaultAddressConflictError(
            "Conflict occurred while designating default address",
            { storeId, customerId },
          );
        }
        throw err;
      }
    });
  }
}
