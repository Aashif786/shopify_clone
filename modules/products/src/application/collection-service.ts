import type { Database, DatabaseClient } from "@shopify-clone/db";
import { generateUuidV7 } from "@shopify-clone/db";
import type {
  CollectionStatus,
  CollectionWithProductCount,
} from "../domain/entities.js";
import {
  CollectionNotFoundError,
  DuplicateCollectionSlugError,
  ProductNotFoundError,
} from "../domain/errors.js";
import { normalizeSlug, validateProductTitle } from "../domain/validation.js";
import {
  CollectionRepository,
  type ListCollectionsOptions,
} from "../infrastructure/collection-repository.js";
import { ProductRepository } from "../infrastructure/product-repository.js";
import type {
  CollectionDTO,
  CreateCollectionInput,
  UpdateCollectionInput,
} from "./dtos.js";

function toCollectionDTO(c: CollectionWithProductCount): CollectionDTO {
  return {
    id: c.id,
    storeId: c.storeId,
    title: c.title,
    slug: c.slug,
    description: c.description,
    status: c.status,
    productCount: c.productCount,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export class CollectionService {
  constructor(
    private readonly repository: CollectionRepository = new CollectionRepository(),
    private readonly productRepository: ProductRepository = new ProductRepository(),
  ) {}

  async createCollection(
    db: Database,
    storeId: string,
    input: CreateCollectionInput,
  ): Promise<CollectionDTO> {
    const title = validateProductTitle(input.title);
    const slug = normalizeSlug(input.slug || title);
    if (!slug) {
      throw new Error("Collection slug cannot be empty");
    }

    return await db.withTransaction(async (tx) => {
      const existing = await this.repository.findCollectionBySlug(tx, storeId, slug);
      if (existing) {
        throw new DuplicateCollectionSlugError(slug);
      }

      const id = generateUuidV7();
      const status: CollectionStatus = input.status ?? "ACTIVE";

      const created = await this.repository.insertCollection(tx, {
        id,
        storeId,
        title,
        slug,
        description: input.description ?? null,
        status,
      });

      return toCollectionDTO({ ...created, productCount: 0 });
    });
  }

  async getCollectionById(
    client: DatabaseClient,
    storeId: string,
    collectionId: string,
  ): Promise<CollectionDTO> {
    const col = await this.repository.findCollectionById(client, storeId, collectionId);
    if (!col) {
      throw new CollectionNotFoundError();
    }
    return toCollectionDTO(col);
  }

  async getCollectionBySlug(
    client: DatabaseClient,
    storeId: string,
    slug: string,
  ): Promise<CollectionDTO> {
    const col = await this.repository.findCollectionBySlug(client, storeId, slug);
    if (!col) {
      throw new CollectionNotFoundError();
    }
    return toCollectionDTO(col);
  }

  async listCollections(
    client: DatabaseClient,
    storeId: string,
    options?: {
      status?: CollectionStatus;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ items: CollectionDTO[]; total: number }> {
    const opts: ListCollectionsOptions = {
      storeId,
      status: options?.status,
      limit: options?.limit,
      offset: options?.offset,
    };
    const res = await this.repository.listCollections(client, opts);
    return {
      items: res.items.map(toCollectionDTO),
      total: res.total,
    };
  }

  async updateCollection(
    db: Database,
    storeId: string,
    collectionId: string,
    input: UpdateCollectionInput,
  ): Promise<CollectionDTO> {
    return await db.withTransaction(async (tx) => {
      const existing = await this.repository.findCollectionById(tx, storeId, collectionId);
      if (!existing) {
        throw new CollectionNotFoundError();
      }

      let newSlug: string | undefined;
      if (input.slug !== undefined) {
        newSlug = normalizeSlug(input.slug);
        if (!newSlug) {
          throw new Error("Collection slug cannot be empty");
        }
        if (newSlug !== existing.slug) {
          const conflict = await this.repository.findCollectionBySlug(tx, storeId, newSlug);
          if (conflict && conflict.id !== collectionId) {
            throw new DuplicateCollectionSlugError(newSlug);
          }
        }
      }

      const updated = await this.repository.updateCollection(tx, storeId, collectionId, {
        title: input.title !== undefined ? validateProductTitle(input.title) : undefined,
        slug: newSlug,
        description: input.description,
        status: input.status,
      });

      if (!updated) {
        throw new CollectionNotFoundError();
      }

      return toCollectionDTO(updated);
    });
  }

  async deleteCollection(
    db: Database,
    storeId: string,
    collectionId: string,
  ): Promise<boolean> {
    return await db.withTransaction(async (tx) => {
      const existing = await this.repository.findCollectionById(tx, storeId, collectionId);
      if (!existing) {
        throw new CollectionNotFoundError();
      }
      return await this.repository.deleteCollection(tx, storeId, collectionId);
    });
  }

  async addProductToCollection(
    db: Database,
    storeId: string,
    collectionId: string,
    productId: string,
    position: number = 0,
  ): Promise<void> {
    await db.withTransaction(async (tx) => {
      const collection = await this.repository.findCollectionById(tx, storeId, collectionId);
      if (!collection) {
        throw new CollectionNotFoundError();
      }

      const product = await this.productRepository.findProductById(tx, storeId, productId);
      if (!product) {
        throw new ProductNotFoundError();
      }

      await this.repository.addProductToCollection(tx, storeId, collectionId, productId, position);
    });
  }

  async removeProductFromCollection(
    db: Database,
    storeId: string,
    collectionId: string,
    productId: string,
  ): Promise<boolean> {
    return await db.withTransaction(async (tx) => {
      const collection = await this.repository.findCollectionById(tx, storeId, collectionId);
      if (!collection) {
        throw new CollectionNotFoundError();
      }
      return await this.repository.removeProductFromCollection(tx, storeId, collectionId, productId);
    });
  }

  async listCollectionProductIds(
    client: DatabaseClient,
    storeId: string,
    collectionId: string,
  ): Promise<string[]> {
    return await this.repository.listCollectionProductIds(client, storeId, collectionId);
  }
}
