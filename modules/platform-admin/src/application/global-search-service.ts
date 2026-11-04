import type { Database } from "@calcart/db";

export interface SearchResultItem {
  id: string;
  type: "organization" | "store" | "merchant" | "order" | "payment";
  title: string;
  subtitle: string;
  url: string;
  status?: string;
}

export class PlatformGlobalSearchService {
  constructor(private readonly db: Database) {}

  async search(query: string, limit = 20): Promise<SearchResultItem[]> {
    const q = query.trim();
    if (!q || q.length < 2) return [];

    const results: SearchResultItem[] = [];
    const term = `%${q}%`;

    // 1. Organizations
    const orgsRes = await this.db.query<{
      id: string;
      name: string;
      status: string;
    }>(
      `SELECT id, name, status
       FROM organizations
       WHERE name ILIKE $1 OR id::text ILIKE $1
       LIMIT 5`,
      [term]
    );
    for (const r of orgsRes.rows) {
      results.push({
        id: r.id,
        type: "organization",
        title: r.name,
        subtitle: `Organization • Status: ${r.status}`,
        url: `/tenants/${r.id}`,
        status: r.status,
      });
    }

    // 2. Stores
    const storesRes = await this.db.query<{
      id: string;
      name: string;
      slug: string;
      status: string;
    }>(
      `SELECT id, name, slug, status
       FROM stores
       WHERE name ILIKE $1 OR slug ILIKE $1 OR id::text ILIKE $1
       LIMIT 5`,
      [term]
    );
    for (const r of storesRes.rows) {
      results.push({
        id: r.id,
        type: "store",
        title: r.name,
        subtitle: `Store • slug: ${r.slug} • ${r.status}`,
        url: `/stores/${r.id}`,
        status: r.status,
      });
    }

    // 3. Merchants / Users
    const usersRes = await this.db.query<{
      id: string;
      email: string;
      name: string;
      status: string;
    }>(
      `SELECT id, email, name, status
       FROM users
       WHERE email ILIKE $1 OR name ILIKE $1 OR id::text ILIKE $1
       LIMIT 5`,
      [term]
    );
    for (const r of usersRes.rows) {
      results.push({
        id: r.id,
        type: "merchant",
        title: r.name || r.email,
        subtitle: `User • ${r.email} • Status: ${r.status}`,
        url: `/users/${r.id}`,
        status: r.status,
      });
    }

    // 4. Orders (using total column from orders table)
    const ordersRes = await this.db.query<{
      id: string;
      order_number: string;
      total: number;
      currency: string;
      status: string;
    }>(
      `SELECT id, order_number, total, currency, status
       FROM orders
       WHERE order_number ILIKE $1 OR id::text ILIKE $1
       LIMIT 5`,
      [term]
    );
    for (const r of ordersRes.rows) {
      results.push({
        id: r.id,
        type: "order",
        title: `Order #${r.order_number}`,
        subtitle: `Order • ${(r.total / 100).toFixed(2)} ${r.currency} • ${r.status}`,
        url: `/orders/${r.id}`,
        status: r.status,
      });
    }

    // 5. Payments (joining payment_attempts for provider refs)
    const paymentsRes = await this.db.query<{
      id: string;
      amount: number;
      currency: string;
      status: string;
      provider_payment_id: string | null;
    }>(
      `SELECT
        p.id,
        p.amount,
        p.currency,
        p.status,
        MAX(pa.provider_payment_id) AS provider_payment_id
       FROM payments p
       LEFT JOIN payment_attempts pa ON pa.payment_id = p.id
       WHERE p.id::text ILIKE $1 OR pa.provider_payment_id ILIKE $1 OR pa.provider_order_id ILIKE $1
       GROUP BY p.id, p.amount, p.currency, p.status
       LIMIT 5`,
      [term]
    );
    for (const r of paymentsRes.rows) {
      results.push({
        id: r.id,
        type: "payment",
        title: `Payment: ${r.provider_payment_id || r.id}`,
        subtitle: `Payment • ${(r.amount / 100).toFixed(2)} ${r.currency} • ${r.status}`,
        url: `/payments/${r.id}`,
        status: r.status,
      });
    }

    return results.slice(0, limit);
  }
}
