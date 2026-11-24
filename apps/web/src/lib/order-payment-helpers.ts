import type { Database, DatabaseClient } from "@calcart/db";

/**
 * Checks whether an order is explicitly backed by a Cash on Delivery (COD) payment method.
 * Unpaid online payments (e.g. Razorpay) with paymentStatus PENDING must NEVER be inferred as COD.
 */
export async function isOrderCodPayment(
  db: Database | DatabaseClient,
  storeId: string,
  orderId: string,
  checkoutId?: string | null,
): Promise<boolean> {
  const paymentRes = await db.query<{ provider: string }>(
    `SELECT provider FROM payments
     WHERE store_id = $1 AND (order_id = $2 OR (checkout_id = $3 AND $3 IS NOT NULL))
     ORDER BY created_at DESC
     LIMIT 1`,
    [storeId, orderId, checkoutId ?? null],
  );
  if (paymentRes.rows[0]?.provider?.trim().toUpperCase() === "COD") {
    return true;
  }

  const attemptRes = await db.query<{ provider: string }>(
    `SELECT pa.provider FROM payment_attempts pa
     JOIN payments p ON pa.payment_id = p.id AND pa.store_id = p.store_id
     WHERE pa.store_id = $1 AND (p.order_id = $2 OR (p.checkout_id = $3 AND $3 IS NOT NULL))
     ORDER BY pa.created_at DESC
     LIMIT 1`,
    [storeId, orderId, checkoutId ?? null],
  );
  if (attemptRes.rows[0]?.provider?.trim().toUpperCase() === "COD") {
    return true;
  }

  return false;
}
