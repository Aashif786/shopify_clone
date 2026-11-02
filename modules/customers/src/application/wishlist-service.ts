import type { Database, DatabaseClient } from "@calcart/db";
import { WishlistRepository } from "../infrastructure/wishlist-repository.js";
import type { CustomerWishlistItem } from "../domain/entities/wishlist.js";
import type { WishlistItemDTO } from "./dtos.js";

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

export class WishlistService {
  private repo: WishlistRepository;

  constructor(repo?: WishlistRepository) {
    this.repo = repo ?? new WishlistRepository();
  }

  async addItem(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    customerId: string,
    productId: string,
    variantId?: string | null,
  ): Promise<CustomerWishlistItem> {
    return runInTransaction(clientOrDb, async (tx) => {
      return this.repo.addItem(tx, storeId, customerId, productId, variantId);
    });
  }

  async removeItem(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    customerId: string,
    productId: string,
    variantId?: string | null,
  ): Promise<boolean> {
    return runInTransaction(clientOrDb, async (tx) => {
      return this.repo.removeItem(tx, storeId, customerId, productId, variantId);
    });
  }

  async removeItemById(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    customerId: string,
    itemId: string,
  ): Promise<boolean> {
    return runInTransaction(clientOrDb, async (tx) => {
      return this.repo.removeItemById(tx, storeId, customerId, itemId);
    });
  }

  async clearWishlist(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    customerId: string,
  ): Promise<number> {
    return runInTransaction(clientOrDb, async (tx) => {
      return this.repo.clearWishlist(tx, storeId, customerId);
    });
  }

  async listWishlistItems(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    customerId: string,
  ): Promise<WishlistItemDTO[]> {
    return runInTransaction(clientOrDb, async (tx) => {
      return this.repo.listWishlistItems(tx, storeId, customerId);
    });
  }

  async countWishlistItems(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    customerId: string,
  ): Promise<number> {
    return runInTransaction(clientOrDb, async (tx) => {
      return this.repo.countWishlistItems(tx, storeId, customerId);
    });
  }

  async mergeGuestWishlist(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    customerId: string,
    items: Array<{ productId: string; variantId?: string | null }>,
  ): Promise<number> {
    if (!items || items.length === 0) return 0;
    return runInTransaction(clientOrDb, async (tx) => {
      return this.repo.mergeItems(tx, storeId, customerId, items);
    });
  }

  async batchResolveItems(
    clientOrDb: Database | DatabaseClient,
    storeId: string,
    items: Array<{ productId: string; variantId?: string | null }>,
  ): Promise<WishlistItemDTO[]> {
    if (!items || items.length === 0) return [];
    return runInTransaction(clientOrDb, async (tx) => {
      return this.repo.batchResolveItems(tx, storeId, items);
    });
  }
}
