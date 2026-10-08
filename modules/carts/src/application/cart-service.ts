import type { Database, DatabaseClient } from "@shopify-clone/db";
import { Cart } from "../domain/cart.js";
import {
  CartItemNotFoundError,
  CartNotFoundError,
  CrossStoreCustomerError,
  CrossStoreVariantError,
  CustomerNotFoundError,
  InvalidCurrencyError,
  ProductVariantNotFoundError,
  ProductVariantUnavailableError,
} from "../domain/cart-errors.js";
import type { CartStatus } from "../domain/cart-state.js";
import { CartRepository } from "../infrastructure/cart-repository.js";
import {
  toCartDTO,
  toCartItemDTO,
  type AddCartItemInput,
  type CartDTO,
  type CartItemDTO,
  type CreateCartInput,
  type UpdateCartItemQuantityInput,
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

export class CartService {
  constructor(
    private readonly repository: CartRepository = new CartRepository(),
  ) {}

  async createCart(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    input?: CreateCartInput,
  ): Promise<CartDTO> {
    return runInTransaction(clientOrDb, async (tx) => {
      if (input?.customerId) {
        const customer = await this.repository.findCustomer(tx, input.customerId);
        if (!customer) {
          throw new CustomerNotFoundError(`Customer '${input.customerId}' not found`);
        }
        if (customer.storeId !== storeId) {
          throw new CrossStoreCustomerError(
            `Customer '${input.customerId}' does not belong to store '${storeId}'`,
          );
        }
      }

      const cart = Cart.create({
        storeId,
        customerId: input?.customerId,
        guestIdentifier: input?.guestIdentifier,
        currency: input?.currency,
        expiresAt: input?.expiresAt,
      });

      await this.repository.create(tx, cart);
      return toCartDTO(cart);
    });
  }

  async getCart(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    cartId: string,
  ): Promise<CartDTO> {
    const cart = await this.repository.findWithItems(clientOrDb, storeId, cartId);
    if (!cart) {
      throw new CartNotFoundError(`Cart '${cartId}' not found in store '${storeId}'`);
    }
    return toCartDTO(cart);
  }

  async getActiveCartForCustomer(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    customerId: string,
  ): Promise<CartDTO | null> {
    const customer = await this.repository.findCustomer(clientOrDb, customerId);
    if (!customer) {
      throw new CustomerNotFoundError(`Customer '${customerId}' not found`);
    }
    if (customer.storeId !== storeId) {
      throw new CrossStoreCustomerError(
        `Customer '${customerId}' does not belong to store '${storeId}'`,
      );
    }

    const cart = await this.repository.findActiveByCustomerId(
      clientOrDb,
      storeId,
      customerId,
    );
    if (!cart) {
      return null;
    }
    return toCartDTO(cart);
  }

  async getActiveCartForGuest(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    guestIdentifier: string,
  ): Promise<CartDTO | null> {
    const cart = await this.repository.findActiveByGuestIdentifier(
      clientOrDb,
      storeId,
      guestIdentifier,
    );
    if (!cart) {
      return null;
    }
    return toCartDTO(cart);
  }

  async getOrCreateCart(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    params?: {
      customerId?: string | null;
      guestIdentifier?: string | null;
      currency?: string;
    },
  ): Promise<CartDTO> {
    return runInTransaction(clientOrDb, async (tx) => {
      if (params?.customerId) {
        const customer = await this.repository.findCustomer(tx, params.customerId);
        if (!customer) {
          throw new CustomerNotFoundError(`Customer '${params.customerId}' not found`);
        }
        if (customer.storeId !== storeId) {
          throw new CrossStoreCustomerError(
            `Customer '${params.customerId}' does not belong to store '${storeId}'`,
          );
        }

        const existing = await this.repository.findActiveByCustomerId(
          tx,
          storeId,
          params.customerId,
          true,
        );
        if (existing) {
          return toCartDTO(existing);
        }
      } else if (params?.guestIdentifier) {
        const existing = await this.repository.findActiveByGuestIdentifier(
          tx,
          storeId,
          params.guestIdentifier,
          true,
        );
        if (existing) {
          return toCartDTO(existing);
        }
      }

      const cart = Cart.create({
        storeId,
        customerId: params?.customerId,
        guestIdentifier: params?.guestIdentifier,
        currency: params?.currency,
      });

      await this.repository.create(tx, cart);
      return toCartDTO(cart);
    });
  }

  async addItem(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    cartId: string,
    input: AddCartItemInput,
  ): Promise<CartDTO> {
    return runInTransaction(clientOrDb, async (tx) => {
      const cart = await this.repository.findWithItems(tx, storeId, cartId, true);
      if (!cart) {
        throw new CartNotFoundError(`Cart '${cartId}' not found in store '${storeId}'`);
      }

      const variant = await this.repository.findVariant(tx, input.variantId);
      if (!variant) {
        throw new ProductVariantNotFoundError(
          `Product variant '${input.variantId}' not found`,
        );
      }
      if (variant.storeId !== storeId) {
        throw new CrossStoreVariantError(
          `Product variant '${input.variantId}' does not belong to store '${storeId}'`,
        );
      }
      if (variant.status !== "ACTIVE" || variant.productStatus !== "ACTIVE") {
        throw new ProductVariantUnavailableError(
          `Product variant '${input.variantId}' is unavailable for purchase`,
        );
      }
      if (variant.currency && variant.currency !== cart.currency) {
        throw new InvalidCurrencyError(
          `Product variant currency '${variant.currency}' does not match cart currency '${cart.currency}'`,
        );
      }

      const item = cart.addItem({
        variantId: input.variantId,
        quantity: input.quantity,
        unitPrice: variant.price,
      });

      await this.repository.saveItem(tx, item);
      await this.repository.update(tx, cart);

      return toCartDTO(cart);
    });
  }

  async updateItemQuantity(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    cartId: string,
    variantIdOrItemId: string,
    input: UpdateCartItemQuantityInput | number,
  ): Promise<CartDTO> {
    const quantity = typeof input === "number" ? input : input.quantity;

    return runInTransaction(clientOrDb, async (tx) => {
      const cart = await this.repository.findWithItems(tx, storeId, cartId, true);
      if (!cart) {
        throw new CartNotFoundError(`Cart '${cartId}' not found in store '${storeId}'`);
      }

      const existingItem =
        cart.getItem(variantIdOrItemId) ?? cart.getItemById(variantIdOrItemId);
      if (!existingItem) {
        throw new CartItemNotFoundError(
          `Cart item '${variantIdOrItemId}' not found in cart '${cartId}'`,
        );
      }

      const variantId = existingItem.variantId;
      const updatedItem = cart.updateItemQuantity(variantId, quantity);

      if (updatedItem === null) {
        await this.repository.deleteItem(tx, storeId, cartId, variantId);
      } else {
        await this.repository.saveItem(tx, updatedItem);
      }

      await this.repository.update(tx, cart);
      return toCartDTO(cart);
    });
  }

  async removeItem(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    cartId: string,
    variantIdOrItemId: string,
  ): Promise<CartDTO> {
    return runInTransaction(clientOrDb, async (tx) => {
      const cart = await this.repository.findWithItems(tx, storeId, cartId, true);
      if (!cart) {
        throw new CartNotFoundError(`Cart '${cartId}' not found in store '${storeId}'`);
      }

      const existingItem =
        cart.getItem(variantIdOrItemId) ?? cart.getItemById(variantIdOrItemId);
      if (!existingItem) {
        throw new CartItemNotFoundError(
          `Cart item '${variantIdOrItemId}' not found in cart '${cartId}'`,
        );
      }

      const variantId = existingItem.variantId;
      cart.removeItem(variantId);

      await this.repository.deleteItem(tx, storeId, cartId, variantId);
      await this.repository.update(tx, cart);

      return toCartDTO(cart);
    });
  }

  async clearCart(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    cartId: string,
  ): Promise<CartDTO> {
    return runInTransaction(clientOrDb, async (tx) => {
      const cart = await this.repository.findWithItems(tx, storeId, cartId, true);
      if (!cart) {
        throw new CartNotFoundError(`Cart '${cartId}' not found in store '${storeId}'`);
      }

      cart.clear();

      await this.repository.clearItems(tx, storeId, cartId);
      await this.repository.update(tx, cart);

      return toCartDTO(cart);
    });
  }

  async associateCustomer(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    cartId: string,
    customerId: string,
  ): Promise<CartDTO> {
    return runInTransaction(clientOrDb, async (tx) => {
      const customer = await this.repository.findCustomer(tx, customerId);
      if (!customer) {
        throw new CustomerNotFoundError(`Customer '${customerId}' not found`);
      }
      if (customer.storeId !== storeId) {
        throw new CrossStoreCustomerError(
          `Customer '${customerId}' does not belong to store '${storeId}'`,
        );
      }

      const cart = await this.repository.findWithItems(tx, storeId, cartId, true);
      if (!cart) {
        throw new CartNotFoundError(`Cart '${cartId}' not found in store '${storeId}'`);
      }

      cart.assignCustomer(customerId);
      await this.repository.update(tx, cart);

      return toCartDTO(cart);
    });
  }

  async transitionCartStatus(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    cartId: string,
    newStatus: CartStatus,
  ): Promise<CartDTO> {
    return runInTransaction(clientOrDb, async (tx) => {
      const cart = await this.repository.findWithItems(tx, storeId, cartId, true);
      if (!cart) {
        throw new CartNotFoundError(`Cart '${cartId}' not found in store '${storeId}'`);
      }

      cart.transitionTo(newStatus);
      await this.repository.update(tx, cart);

      return toCartDTO(cart);
    });
  }

  async getItem(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    cartId: string,
    variantIdOrItemId: string,
  ): Promise<CartItemDTO> {
    const cart = await this.repository.findById(clientOrDb, storeId, cartId);
    if (!cart) {
      throw new CartNotFoundError(`Cart '${cartId}' not found in store '${storeId}'`);
    }

    const item = await this.repository.getItem(
      clientOrDb,
      storeId,
      cartId,
      variantIdOrItemId,
    );
    if (!item) {
      throw new CartItemNotFoundError(
        `Cart item '${variantIdOrItemId}' not found in cart '${cartId}'`,
      );
    }

    return toCartItemDTO(item);
  }

  async listItems(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    cartId: string,
  ): Promise<CartItemDTO[]> {
    const cart = await this.repository.findById(clientOrDb, storeId, cartId);
    if (!cart) {
      throw new CartNotFoundError(`Cart '${cartId}' not found in store '${storeId}'`);
    }

    const items = await this.repository.listItems(clientOrDb, storeId, cartId);
    return items.map(toCartItemDTO);
  }
}
