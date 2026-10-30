import type { DatabaseClient } from "@calcart/db";
import type { CustomerAddress } from "../domain/entities/address.js";
import type {
  Customer,
  CustomerStatus,
} from "../domain/entities/customer.js";

interface CustomerRow {
  id: string;
  store_id: string;
  user_id: string | null;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  status: CustomerStatus;
  created_at: Date;
  updated_at: Date;
}

interface CustomerAddressRow {
  id: string;
  store_id: string;
  customer_id: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  state: string | null;
  postal_code: string;
  country: string;
  phone: string | null;
  label: string | null;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
}

function mapCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    storeId: row.store_id,
    userId: row.user_id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    status: row.status,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapAddress(row: CustomerAddressRow): CustomerAddress {
  return {
    id: row.id,
    storeId: row.store_id,
    customerId: row.customer_id,
    firstName: row.first_name,
    lastName: row.last_name,
    company: row.company,
    addressLine1: row.address_line_1,
    addressLine2: row.address_line_2,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    country: row.country,
    phone: row.phone,
    label: row.label,
    isDefault: Boolean(row.is_default),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function encodeCursor(payload: { id: string; createdAt: string }): string {
  return Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
}

function decodeCursor(cursor: string): { id: string; createdAt: string } | null {
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf-8");
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.id === "string" &&
      typeof parsed.createdAt === "string"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function escapeLike(text: string): string {
  return text.replace(/[%_\\]/g, "\\$&");
}

export interface ListCustomersRepoOptions {
  storeId: string;
  status?: CustomerStatus;
  search?: string;
  limit?: number;
  cursor?: string;
}

export interface ListCustomersRepoResult {
  items: Customer[];
  hasMore: boolean;
  nextCursor?: string;
}

export class CustomerRepository {
  async insertCustomer(
    client: DatabaseClient,
    customer: {
      id: string;
      storeId: string;
      userId?: string | null;
      email: string;
      firstName?: string | null;
      lastName?: string | null;
      phone?: string | null;
      status?: CustomerStatus;
    },
  ): Promise<Customer> {
    const res = await client.query<CustomerRow>(
      `INSERT INTO customers (
        id, store_id, user_id, email, first_name, last_name, phone, status, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING id, store_id, user_id, email, first_name, last_name, phone, status, created_at, updated_at`,
      [
        customer.id,
        customer.storeId,
        customer.userId ?? null,
        customer.email,
        customer.firstName ?? null,
        customer.lastName ?? null,
        customer.phone ?? null,
        customer.status ?? "ACTIVE",
      ],
    );
    return mapCustomer(res.rows[0]!);
  }

  async findCustomerById(
    client: DatabaseClient,
    storeId: string,
    customerId: string,
  ): Promise<Customer | null> {
    const res = await client.query<CustomerRow>(
      `SELECT id, store_id, user_id, email, first_name, last_name, phone, status, created_at, updated_at
       FROM customers
       WHERE id = $1 AND store_id = $2`,
      [customerId, storeId],
    );
    if (res.rows.length === 0) {
      return null;
    }
    return mapCustomer(res.rows[0]!);
  }

  async findCustomerByIdForUpdate(
    client: DatabaseClient,
    storeId: string,
    customerId: string,
  ): Promise<Customer | null> {
    const res = await client.query<CustomerRow>(
      `SELECT id, store_id, user_id, email, first_name, last_name, phone, status, created_at, updated_at
       FROM customers
       WHERE id = $1 AND store_id = $2
       FOR UPDATE`,
      [customerId, storeId],
    );
    if (res.rows.length === 0) {
      return null;
    }
    return mapCustomer(res.rows[0]!);
  }

  async findCustomerByEmail(
    client: DatabaseClient,
    storeId: string,
    email: string,
  ): Promise<Customer | null> {
    const res = await client.query<CustomerRow>(
      `SELECT id, store_id, user_id, email, first_name, last_name, phone, status, created_at, updated_at
       FROM customers
       WHERE store_id = $1 AND email = $2`,
      [storeId, email],
    );
    if (res.rows.length === 0) {
      return null;
    }
    return mapCustomer(res.rows[0]!);
  }

  async findCustomerByUserId(
    client: DatabaseClient,
    storeId: string,
    userId: string,
  ): Promise<Customer | null> {
    const res = await client.query<CustomerRow>(
      `SELECT id, store_id, user_id, email, first_name, last_name, phone, status, created_at, updated_at
       FROM customers
       WHERE store_id = $1 AND user_id = $2`,
      [storeId, userId],
    );
    if (res.rows.length === 0) {
      return null;
    }
    return mapCustomer(res.rows[0]!);
  }

  async updateCustomer(
    client: DatabaseClient,
    storeId: string,
    customerId: string,
    fields: {
      email?: string;
      firstName?: string | null;
      lastName?: string | null;
      phone?: string | null;
      status?: CustomerStatus;
      userId?: string | null;
    },
  ): Promise<Customer | null> {
    const setClauses: string[] = [];
    const values: unknown[] = [customerId, storeId];
    let paramIdx = 3;

    if (fields.email !== undefined) {
      setClauses.push(`email = $${paramIdx++}`);
      values.push(fields.email);
    }
    if (fields.firstName !== undefined) {
      setClauses.push(`first_name = $${paramIdx++}`);
      values.push(fields.firstName);
    }
    if (fields.lastName !== undefined) {
      setClauses.push(`last_name = $${paramIdx++}`);
      values.push(fields.lastName);
    }
    if (fields.phone !== undefined) {
      setClauses.push(`phone = $${paramIdx++}`);
      values.push(fields.phone);
    }
    if (fields.status !== undefined) {
      setClauses.push(`status = $${paramIdx++}`);
      values.push(fields.status);
    }
    if (fields.userId !== undefined) {
      setClauses.push(`user_id = $${paramIdx++}`);
      values.push(fields.userId);
    }

    if (setClauses.length === 0) {
      return this.findCustomerById(client, storeId, customerId);
    }

    setClauses.push("updated_at = NOW()");

    const sql = `
      UPDATE customers
      SET ${setClauses.join(", ")}
      WHERE id = $1 AND store_id = $2
      RETURNING id, store_id, user_id, email, first_name, last_name, phone, status, created_at, updated_at
    `;

    const res = await client.query<CustomerRow>(sql, values);
    if (res.rows.length === 0) {
      return null;
    }
    return mapCustomer(res.rows[0]!);
  }

  async listCustomers(
    client: DatabaseClient,
    options: ListCustomersRepoOptions,
  ): Promise<ListCustomersRepoResult> {
    const limit = Math.min(Math.max(options.limit ?? 25, 1), 100);
    const params: unknown[] = [options.storeId];
    let paramIdx = 2;

    let filterSql = "c.store_id = $1";

    if (options.status) {
      filterSql += ` AND c.status = $${paramIdx++}`;
      params.push(options.status);
    }

    if (options.search && options.search.trim()) {
      const searchTerm = `%${escapeLike(options.search.trim())}%`;
      filterSql += ` AND (c.email ILIKE $${paramIdx} OR COALESCE(c.first_name, '') ILIKE $${paramIdx} OR COALESCE(c.last_name, '') ILIKE $${paramIdx} OR COALESCE(c.phone, '') ILIKE $${paramIdx})`;
      paramIdx++;
      params.push(searchTerm);
    }

    if (options.cursor) {
      const decoded = decodeCursor(options.cursor);
      if (decoded) {
        filterSql += ` AND (c.created_at, c.id) < ($${paramIdx++}, $${paramIdx++})`;
        params.push(new Date(decoded.createdAt), decoded.id);
      }
    }

    params.push(limit + 1);
    const limitParamIndex = paramIdx;

    const querySql = `
      SELECT
        c.id, c.store_id, c.user_id, c.email, c.first_name, c.last_name, c.phone, c.status, c.created_at, c.updated_at
      FROM customers c
      WHERE ${filterSql}
      ORDER BY c.created_at DESC, c.id DESC
      LIMIT $${limitParamIndex}
    `;

    const res = await client.query<CustomerRow>(querySql, params);
    const hasMore = res.rows.length > limit;
    const rows = hasMore ? res.rows.slice(0, limit) : res.rows;
    const items = rows.map(mapCustomer);

    let nextCursor: string | undefined;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1]!;
      nextCursor = encodeCursor({
        id: last.id,
        createdAt: last.createdAt.toISOString(),
      });
    }

    return {
      items,
      hasMore,
      nextCursor,
    };
  }

  async insertAddress(
    client: DatabaseClient,
    address: {
      id: string;
      storeId: string;
      customerId: string;
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
    },
  ): Promise<CustomerAddress> {
    const res = await client.query<CustomerAddressRow>(
      `INSERT INTO customer_addresses (
        id, store_id, customer_id, first_name, last_name, company,
        address_line_1, address_line_2, city, state, postal_code, country,
        phone, label, is_default, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
      RETURNING id, store_id, customer_id, first_name, last_name, company,
                address_line_1, address_line_2, city, state, postal_code, country,
                phone, label, is_default, created_at, updated_at`,
      [
        address.id,
        address.storeId,
        address.customerId,
        address.firstName ?? null,
        address.lastName ?? null,
        address.company ?? null,
        address.addressLine1,
        address.addressLine2 ?? null,
        address.city,
        address.state ?? null,
        address.postalCode,
        address.country,
        address.phone ?? null,
        address.label ?? null,
        Boolean(address.isDefault),
      ],
    );
    return mapAddress(res.rows[0]!);
  }

  async findAddressById(
    client: DatabaseClient,
    storeId: string,
    customerId: string,
    addressId: string,
  ): Promise<CustomerAddress | null> {
    const res = await client.query<CustomerAddressRow>(
      `SELECT id, store_id, customer_id, first_name, last_name, company,
              address_line_1, address_line_2, city, state, postal_code, country,
              phone, label, is_default, created_at, updated_at
       FROM customer_addresses
       WHERE id = $1 AND customer_id = $2 AND store_id = $3`,
      [addressId, customerId, storeId],
    );
    if (res.rows.length === 0) {
      return null;
    }
    return mapAddress(res.rows[0]!);
  }

  async findAddressByIdForUpdate(
    client: DatabaseClient,
    storeId: string,
    customerId: string,
    addressId: string,
  ): Promise<CustomerAddress | null> {
    const res = await client.query<CustomerAddressRow>(
      `SELECT id, store_id, customer_id, first_name, last_name, company,
              address_line_1, address_line_2, city, state, postal_code, country,
              phone, label, is_default, created_at, updated_at
       FROM customer_addresses
       WHERE id = $1 AND customer_id = $2 AND store_id = $3
       FOR UPDATE`,
      [addressId, customerId, storeId],
    );
    if (res.rows.length === 0) {
      return null;
    }
    return mapAddress(res.rows[0]!);
  }

  async listAddressesByCustomerId(
    client: DatabaseClient,
    storeId: string,
    customerId: string,
  ): Promise<CustomerAddress[]> {
    const res = await client.query<CustomerAddressRow>(
      `SELECT id, store_id, customer_id, first_name, last_name, company,
              address_line_1, address_line_2, city, state, postal_code, country,
              phone, label, is_default, created_at, updated_at
       FROM customer_addresses
       WHERE customer_id = $1 AND store_id = $2
       ORDER BY is_default DESC, created_at DESC, id DESC`,
      [customerId, storeId],
    );
    return res.rows.map(mapAddress);
  }

  async findDefaultAddress(
    client: DatabaseClient,
    storeId: string,
    customerId: string,
  ): Promise<CustomerAddress | null> {
    const res = await client.query<CustomerAddressRow>(
      `SELECT id, store_id, customer_id, first_name, last_name, company,
              address_line_1, address_line_2, city, state, postal_code, country,
              phone, label, is_default, created_at, updated_at
       FROM customer_addresses
       WHERE customer_id = $1 AND store_id = $2 AND is_default = TRUE
       LIMIT 1`,
      [customerId, storeId],
    );
    if (res.rows.length === 0) {
      return null;
    }
    return mapAddress(res.rows[0]!);
  }

  async updateAddress(
    client: DatabaseClient,
    storeId: string,
    customerId: string,
    addressId: string,
    fields: {
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
    },
  ): Promise<CustomerAddress | null> {
    const setClauses: string[] = [];
    const values: unknown[] = [addressId, customerId, storeId];
    let paramIdx = 4;

    if (fields.firstName !== undefined) {
      setClauses.push(`first_name = $${paramIdx++}`);
      values.push(fields.firstName);
    }
    if (fields.lastName !== undefined) {
      setClauses.push(`last_name = $${paramIdx++}`);
      values.push(fields.lastName);
    }
    if (fields.company !== undefined) {
      setClauses.push(`company = $${paramIdx++}`);
      values.push(fields.company);
    }
    if (fields.addressLine1 !== undefined) {
      setClauses.push(`address_line_1 = $${paramIdx++}`);
      values.push(fields.addressLine1);
    }
    if (fields.addressLine2 !== undefined) {
      setClauses.push(`address_line_2 = $${paramIdx++}`);
      values.push(fields.addressLine2);
    }
    if (fields.city !== undefined) {
      setClauses.push(`city = $${paramIdx++}`);
      values.push(fields.city);
    }
    if (fields.state !== undefined) {
      setClauses.push(`state = $${paramIdx++}`);
      values.push(fields.state);
    }
    if (fields.postalCode !== undefined) {
      setClauses.push(`postal_code = $${paramIdx++}`);
      values.push(fields.postalCode);
    }
    if (fields.country !== undefined) {
      setClauses.push(`country = $${paramIdx++}`);
      values.push(fields.country);
    }
    if (fields.phone !== undefined) {
      setClauses.push(`phone = $${paramIdx++}`);
      values.push(fields.phone);
    }
    if (fields.label !== undefined) {
      setClauses.push(`label = $${paramIdx++}`);
      values.push(fields.label);
    }
    if (fields.isDefault !== undefined) {
      setClauses.push(`is_default = $${paramIdx++}`);
      values.push(fields.isDefault);
    }

    if (setClauses.length === 0) {
      return this.findAddressById(client, storeId, customerId, addressId);
    }

    setClauses.push("updated_at = NOW()");

    const sql = `
      UPDATE customer_addresses
      SET ${setClauses.join(", ")}
      WHERE id = $1 AND customer_id = $2 AND store_id = $3
      RETURNING id, store_id, customer_id, first_name, last_name, company,
                address_line_1, address_line_2, city, state, postal_code, country,
                phone, label, is_default, created_at, updated_at
    `;

    const res = await client.query<CustomerAddressRow>(sql, values);
    if (res.rows.length === 0) {
      return null;
    }
    return mapAddress(res.rows[0]!);
  }

  async deleteAddress(
    client: DatabaseClient,
    storeId: string,
    customerId: string,
    addressId: string,
  ): Promise<boolean> {
    const res = await client.query(
      `DELETE FROM customer_addresses
       WHERE id = $1 AND customer_id = $2 AND store_id = $3`,
      [addressId, customerId, storeId],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async clearDefaultAddresses(
    client: DatabaseClient,
    storeId: string,
    customerId: string,
    excludeAddressId?: string,
  ): Promise<void> {
    if (excludeAddressId) {
      await client.query(
        `UPDATE customer_addresses
         SET is_default = FALSE, updated_at = NOW()
         WHERE customer_id = $1 AND store_id = $2 AND is_default = TRUE AND id != $3`,
        [customerId, storeId, excludeAddressId],
      );
    } else {
      await client.query(
        `UPDATE customer_addresses
         SET is_default = FALSE, updated_at = NOW()
         WHERE customer_id = $1 AND store_id = $2 AND is_default = TRUE`,
        [customerId, storeId],
      );
    }
  }

  async setDefaultAddress(
    client: DatabaseClient,
    storeId: string,
    customerId: string,
    addressId: string,
  ): Promise<CustomerAddress | null> {
    const res = await client.query<CustomerAddressRow>(
      `UPDATE customer_addresses
       SET is_default = TRUE, updated_at = NOW()
       WHERE id = $1 AND customer_id = $2 AND store_id = $3
       RETURNING id, store_id, customer_id, first_name, last_name, company,
                 address_line_1, address_line_2, city, state, postal_code, country,
                 phone, label, is_default, created_at, updated_at`,
      [addressId, customerId, storeId],
    );
    if (res.rows.length === 0) {
      return null;
    }
    return mapAddress(res.rows[0]!);
  }

  async userExists(client: DatabaseClient, userId: string): Promise<boolean> {
    const res = await client.query<{ exists: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM users WHERE id = $1) as exists`,
      [userId],
    );
    return Boolean(res.rows[0]?.exists);
  }

  async customerExistsGlobally(
    client: DatabaseClient,
    customerId: string,
  ): Promise<boolean> {
    const res = await client.query<{ exists: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM customers WHERE id = $1) as exists`,
      [customerId],
    );
    return Boolean(res.rows[0]?.exists);
  }

  async addressExistsGlobally(
    client: DatabaseClient,
    addressId: string,
  ): Promise<{ exists: boolean; storeId?: string; customerId?: string }> {
    const res = await client.query<{ store_id: string; customer_id: string }>(
      `SELECT store_id, customer_id FROM customer_addresses WHERE id = $1`,
      [addressId],
    );
    if (res.rows.length === 0) {
      return { exists: false };
    }
    return {
      exists: true,
      storeId: res.rows[0]!.store_id,
      customerId: res.rows[0]!.customer_id,
    };
  }
}
