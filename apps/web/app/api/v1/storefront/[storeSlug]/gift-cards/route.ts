import { CartService } from "@calcart/carts";
import { generateUuidV7 } from "@calcart/db";
import { StoreService } from "@calcart/stores";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  resolveRequestContext,
} from "@/lib/api";
import { enrichCart } from "@/lib/storefront-cart-helpers";
import {
  assertCartOwnership,
  extractGuestIdentifier,
  resolveStorefrontCustomer,
} from "@/lib/storefront-auth-helpers";

const storeService = new StoreService();
const cartService = new CartService();

interface RouteContext {
  params: Promise<{ storeSlug: string }>;
}

const DEFAULT_DENOMINATIONS = [
  50000,   // 500
  100000,  // 1,000
  250000,  // 2,500
  500000,  // 5,000
];

/**
 * Returns available gift card information and denominations for this store.
 */
export async function GET(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const { storeSlug } = await Promise.resolve(context.params);
    if (!storeSlug) {
      throw new ApiHttpError(400, "INVALID_STORE_SLUG", "Store slug is required");
    }

    const store = await storeService.getStoreBySlug(ctx.db, storeSlug);
    if (store.status !== "ACTIVE") {
      throw new ApiHttpError(404, "STOREFRONT_NOT_FOUND", "Store is not publicly available");
    }

    // Check existing gift card product variants
    const variantsRes = await ctx.db.query<{
      id: string;
      title: string;
      price: string | number;
      sku: string;
    }>(
      `SELECT pv.id, pv.title, pv.price, pv.sku
         FROM product_variants pv
         JOIN products p ON p.id = pv.product_id AND p.store_id = pv.store_id
        WHERE pv.store_id = $1
          AND p.slug = 'digital-gift-card'
          AND pv.status = 'ACTIVE'
        ORDER BY pv.price ASC`,
      [store.id],
    );

    const denominations =
      variantsRes.rows.length > 0
        ? variantsRes.rows.map((r) => ({
            variantId: r.id,
            title: r.title,
            amount: Number(r.price),
            sku: r.sku,
          }))
        : DEFAULT_DENOMINATIONS.map((amount) => ({
            variantId: null,
            title: `${store.currency} ${(amount / 100).toLocaleString()}`,
            amount,
            sku: `GC-${amount}`,
          }));

    return apiSuccess(
      {
        store: {
          id: store.id,
          name: store.name,
          slug: store.slug,
          currency: store.currency,
        },
        productTitle: "Digital Gift Card",
        description:
          "Digital gift cards delivered straight to the recipient's inbox. Redeemable at checkout for any item in our store with no expiry date.",
        denominations,
      },
      { requestId },
    );
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

/**
 * Creates or selects a gift card variant and adds it to the customer/guest cart.
 */
export async function POST(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    const { storeSlug } = await Promise.resolve(context.params);
    if (!storeSlug) {
      throw new ApiHttpError(400, "INVALID_STORE_SLUG", "Store slug is required");
    }

    const store = await storeService.getStoreBySlug(ctx.db, storeSlug);
    if (store.status !== "ACTIVE") {
      throw new ApiHttpError(404, "STOREFRONT_NOT_FOUND", "Store is not publicly available");
    }

    const body: unknown = await req.json().catch(() => {
      throw new ApiHttpError(400, "VALIDATION_ERROR", "Request body must be a JSON object");
    });
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      throw new ApiHttpError(400, "VALIDATION_ERROR", "Request body must be a JSON object");
    }
    const record = body as Record<string, unknown>;

    const amount = Number(record.amount);
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new ApiHttpError(400, "VALIDATION_ERROR", "amount must be a positive integer in minor units (e.g. 50000 for ₹500)");
    }
    if (amount < 100) {
      throw new ApiHttpError(400, "VALIDATION_ERROR", "Minimum gift card amount is 100 minor units ($1.00 / ₹1.00)");
    }
    if (amount > 100000000) {
      throw new ApiHttpError(400, "VALIDATION_ERROR", "Gift card amount exceeds allowed limit");
    }

    const recipientEmail =
      typeof record.recipientEmail === "string" && record.recipientEmail.trim().length > 0
        ? record.recipientEmail.trim().toLowerCase()
        : null;
    const recipientName =
      typeof record.recipientName === "string" && record.recipientName.trim().length > 0
        ? record.recipientName.trim()
        : null;
    const message =
      typeof record.message === "string" && record.message.trim().length > 0
        ? record.message.trim().slice(0, 500)
        : null;
    const cartId = typeof record.cartId === "string" ? record.cartId : undefined;
    const guestIdentifierInput =
      typeof record.guestIdentifier === "string" ? record.guestIdentifier : undefined;

    // 1. Ensure Product "Digital Gift Card" exists for this store
    let productId: string;
    const prodRes = await ctx.db.query<{ id: string }>(
      `SELECT id FROM products WHERE store_id = $1 AND slug = 'digital-gift-card'`,
      [store.id],
    );
    if (prodRes.rows[0]) {
      productId = prodRes.rows[0].id;
    } else {
      productId = generateUuidV7();
      await ctx.db.query(
        `INSERT INTO products (
           id, store_id, title, description, slug, status, published_at
         ) VALUES ($1, $2, $3, $4, 'digital-gift-card', 'ACTIVE', NOW())
         ON CONFLICT (store_id, slug) DO UPDATE SET updated_at = NOW()
         RETURNING id`,
        [
          productId,
          store.id,
          "Digital Gift Card",
          "Digital gift card delivered instantly via email. Redeemable online at checkout.",
        ],
      );
    }

    // 2. Ensure Variant exists for this exact amount
    const sku = `GC-${amount}`;
    let variantId: string;
    const varRes = await ctx.db.query<{ id: string }>(
      `SELECT id FROM product_variants WHERE store_id = $1 AND sku = $2`,
      [store.id, sku],
    );
    if (varRes.rows[0]) {
      variantId = varRes.rows[0].id;
    } else {
      variantId = generateUuidV7();
      const variantTitle = `${store.currency} ${(amount / 100).toLocaleString()} Gift Card`;
      await ctx.db.query(
        `INSERT INTO product_variants (
           id, product_id, store_id, title, sku, price, currency, status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE')
         ON CONFLICT (store_id, sku) WHERE sku IS NOT NULL DO UPDATE SET updated_at = NOW()
         RETURNING id`,
        [
          variantId,
          productId,
          store.id,
          variantTitle,
          sku,
          amount,
          store.currency,
        ],
      );

      // Ensure inventory_items row exists so cart stock check succeeds
      const invItemId = generateUuidV7();
      await ctx.db.query(
        `INSERT INTO inventory_items (
           id, store_id, variant_id, available_quantity, reserved_quantity
         ) VALUES ($1, $2, $3, 999999, 0)
         ON CONFLICT (variant_id) DO NOTHING`,
        [invItemId, store.id, variantId],
      );
    }

    // 3. Resolve cart and caller
    const customer = await resolveStorefrontCustomer(ctx, store.id);
    const guestIdentifier = extractGuestIdentifier(req) || guestIdentifierInput;
    const caller = { customerId: customer?.id, guestIdentifier };

    let activeCartId: string | undefined;
    if (cartId) {
      try {
        const existing = await cartService.getCart(ctx.db, store.id, cartId, caller);
        if (existing.status === "ACTIVE") {
          assertCartOwnership(existing, caller);
          activeCartId = existing.id;
        }
      } catch {
        // Fall through
      }
    }

    if (!activeCartId) {
      if (customer) {
        let customerCart = await cartService.getActiveCartForCustomer(
          ctx.db,
          store.id,
          customer.id,
        );
        if (!customerCart) {
          customerCart = await cartService.getOrCreateCart(ctx.db, store.id, {
            customerId: customer.id,
            currency: store.currency,
          });
        }
        activeCartId = customerCart.id;
      } else {
        const effectiveGuestId = guestIdentifier || generateUuidV7();
        caller.guestIdentifier = effectiveGuestId;
        let guestCart = await cartService.getActiveCartForGuest(
          ctx.db,
          store.id,
          effectiveGuestId,
        );
        if (!guestCart) {
          guestCart = await cartService.getOrCreateCart(ctx.db, store.id, {
            guestIdentifier: effectiveGuestId,
            currency: store.currency,
          });
        }
        activeCartId = guestCart.id;
      }
    }

    // 4. Add gift card variant to cart
    const updated = await cartService.addItem(
      ctx.db,
      store.id,
      activeCartId,
      {
        variantId,
        quantity: 1,
      },
      caller,
    );

    // 5. Persist recipient details if specified so gift card is delivered to the intended recipient
    if (recipientEmail) {
      await ctx.db.query(
        `INSERT INTO gift_card_recipients (
           id, store_id, cart_id, variant_id, recipient_email, recipient_name, message, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (cart_id, variant_id) DO UPDATE SET
           recipient_email = EXCLUDED.recipient_email,
           recipient_name = EXCLUDED.recipient_name,
           message = EXCLUDED.message,
           updated_at = NOW()`,
        [
          generateUuidV7(),
          store.id,
          activeCartId,
          variantId,
          recipientEmail,
          recipientName,
          message,
        ],
      );
    }

    const enriched = await enrichCart(ctx.db, store.id, updated);

    const headers: Record<string, string> = {};
    if (!customer && caller.guestIdentifier) {
      headers["x-guest-identifier"] = caller.guestIdentifier;
    }

    return apiSuccess(
      {
        cart: enriched,
        variantId,
        recipientEmail,
        recipientName,
        message,
        amount,
        store: {
          id: store.id,
          name: store.name,
          slug: store.slug,
          currency: store.currency,
        },
      },
      { requestId, status: 200, headers },
    );
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
