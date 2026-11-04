import type { Database, DatabaseClient } from "@calcart/db";
import { ProductDomainError } from "../domain/errors.js";
import { isValidProductTransition, isValidVariantTransition } from "../domain/lifecycle.js";
import { normalizeSlug } from "../domain/validation.js";
import type { ProductStatus, VariantStatus } from "../domain/entities.js";
import { CollectionRepository } from "../infrastructure/collection-repository.js";
import { ProductRepository } from "../infrastructure/product-repository.js";
import type {
  CreateProductInput,
  CreateProductOptionInput,
  CreateVariantNestedInput,
  ProductDetailDTO,
  ProductVariantDTO,
  UpdateProductInput,
} from "./dtos.js";
import { ProductService } from "./product-service.js";
import {
  PRODUCT_CSV_COLUMNS,
  PRODUCT_CSV_MAX_PRODUCTS,
  type ParsedCsvRow,
  type ParsedProductGroup,
  type ProductCsvColumn,
  type ProductCsvIssue,
  buildProductCsvTemplate,
  formatMajorUnits,
  isUuid,
  parseBooleanText,
  parseMajorUnits,
  parseProductCsv,
  ProductCsvParseError,
  serializeProductCsv,
  splitPipeList,
} from "./product-csv-format.js";

export type ProductCsvStrategy = "create" | "update" | "upsert";

export interface ProductCsvExportQuery {
  scope: "all" | "filtered" | "selected";
  status?: ProductStatus;
  search?: string;
  productIds?: string[];
}

export interface ProductCsvProductSummary {
  row: number;
  title: string;
  handle: string;
  status: string;
  variantCount: number;
  matchedProductId: string | null;
}

export interface ProductCsvPreview {
  mapping: Array<{ source: string; target: string | null }>;
  availableColumns: ProductCsvColumn[];
  columns: ProductCsvColumn[];
  productCount: number;
  variantCount: number;
  newProductCount: number;
  existingProductCount: number;
  errors: ProductCsvIssue[];
  warnings: ProductCsvIssue[];
  issuesTruncated: boolean;
  products: ProductCsvProductSummary[];
  productsTruncated: boolean;
}

export interface ProductCsvImportOutcome {
  row: number;
  title: string;
  action: "created" | "updated" | "skipped" | "failed";
  productId?: string;
  message?: string;
}

export interface ProductCsvImportResult {
  applied: boolean;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: ProductCsvIssue[];
  warnings: ProductCsvIssue[];
  issuesTruncated: boolean;
  outcomes: ProductCsvImportOutcome[];
}

export interface ProductCsvExportResult {
  csv: string;
  productCount: number;
  variantCount: number;
  truncated: boolean;
  skippedIds: number;
}

interface CatalogRefs {
  currency: string;
  types: Map<string, Array<{ id: string; name: string }>>;
  categories: Map<string, Array<{ id: string; name: string }>>;
  collections: Map<string, Array<{ id: string; title: string }>>;
}

interface ProductPlan {
  firstRow: number;
  title: string;
  handle: string;
  status: string;
  variantCount: number;
  matchedProductId: string | null;
  action: "create" | "update" | "skip" | "invalid";
  createInput?: CreateProductInput;
  updateInput?: UpdateProductInput;
}

const ISSUE_LIMIT = 1_000;
const SAMPLE_LIMIT = 50;
const OPTION_SLOTS = [1, 2, 3] as const;
const STATUSES = new Set<ProductStatus>(["DRAFT", "ACTIVE", "ARCHIVED"]);
const VARIANT_STATUSES = new Set<VariantStatus>(["ACTIVE", "INACTIVE", "ARCHIVED"]);

/**
 * Store-scoped product CSV import and export.
 * Imports run in the request, one product transaction at a time, up to the
 * row and product caps. The worker only recovers payments, orders, and
 * notifications, so it is not used for catalogues that fit in one request.
 */
export class ProductCsvService {
  constructor(
    private readonly products: ProductService = new ProductService(),
    private readonly repository: ProductRepository = new ProductRepository(),
    private readonly collections: CollectionRepository = new CollectionRepository(),
  ) {}

  template(): string {
    return buildProductCsvTemplate();
  }

  async exportCsv(
    db: Database,
    storeId: string,
    query: ProductCsvExportQuery,
  ): Promise<ProductCsvExportResult> {
    const resolved = await this.resolveExportIds(db, storeId, query);
    const collectionTitles = await this.collections.listProductCollectionTitles(
      db,
      storeId,
      resolved.ids,
    );
    const rows: string[][] = [[...PRODUCT_CSV_COLUMNS]];
    let variantCount = 0;

    for (const productId of resolved.ids) {
      const product = await this.products.getProductById(db, storeId, productId);
      const names = collectionTitles.get(productId) ?? [];
      const variants = product.variants.length > 0 ? product.variants : [];
      if (variants.length === 0) {
        rows.push(exportRow(product, null, names));
        continue;
      }
      for (const variant of variants) {
        variantCount += 1;
        rows.push(exportRow(product, variant, names));
      }
    }

    return {
      csv: `\uFEFF${serializeProductCsv(rows)}`,
      productCount: resolved.ids.length,
      variantCount,
      truncated: resolved.truncated,
      skippedIds: resolved.skippedIds,
    };
  }

  async preview(
    db: Database,
    storeId: string,
    csv: string,
    columnMap?: Record<string, string | null>,
  ): Promise<ProductCsvPreview> {
    const analysis = await this.analyze(db, storeId, csv, columnMap);
    return toPreview(analysis);
  }

  async execute(
    db: Database,
    storeId: string,
    csv: string,
    strategy: ProductCsvStrategy,
    columnMap?: Record<string, string | null>,
  ): Promise<ProductCsvImportResult> {
    const analysis = await this.analyze(db, storeId, csv, columnMap);
    const reported = limitIssues(analysis.issues);
    if (analysis.issues.some((issue) => issue.severity === "error")) {
      return {
        applied: false,
        created: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
        errors: reported.errors,
        warnings: reported.warnings,
        issuesTruncated: reported.issuesTruncated,
        outcomes: [],
      };
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const outcomes: ProductCsvImportOutcome[] = [];
    let current = analysis.plans[0];

    try {
      await db.withTransaction(async (tx) => {
        for (const plan of analysis.plans) {
          current = plan;
          const action = actionFor(plan, strategy);
          if (action === "skip") {
            skipped += 1;
            outcomes.push({
              row: plan.firstRow,
              title: plan.title,
              action: "skipped",
              productId: plan.matchedProductId ?? undefined,
              message: plan.matchedProductId
                ? "Skipped because this product already exists and the strategy is create only."
                : "Skipped because this product does not exist and the strategy is update only.",
            });
            continue;
          }

          if (action === "create" && plan.createInput) {
            const product = await this.products.createProduct(tx, storeId, plan.createInput);
            created += 1;
            outcomes.push({
              row: plan.firstRow,
              title: plan.title,
              action: "created",
              productId: product.id,
            });
          } else if (action === "update" && plan.matchedProductId && plan.updateInput) {
            const product = await this.products.updateProduct(
              tx,
              storeId,
              plan.matchedProductId,
              plan.updateInput,
            );
            updated += 1;
            outcomes.push({
              row: plan.firstRow,
              title: plan.title,
              action: "updated",
              productId: product.id,
            });
          } else {
            throw new ProductDomainError(
              "This product could not be imported.",
              "IMPORT_FAILED",
              422,
            );
          }
        }
      });
    } catch (error) {
      return {
        applied: false,
        created: 0,
        updated: 0,
        skipped: 0,
        failed: 1,
        errors: [
          issue(
            current?.firstRow ?? 0,
            null,
            "error",
            "IMPORT_FAILED",
            merchantMessage(error),
          ),
        ],
        warnings: reported.warnings,
        issuesTruncated: reported.issuesTruncated,
        outcomes: [],
      };
    }

    return {
      applied: true,
      created,
      updated,
      skipped,
      failed: 0,
      errors: [],
      warnings: reported.warnings,
      issuesTruncated: reported.issuesTruncated,
      outcomes,
    };
  }

  private async analyze(
    db: Database,
    storeId: string,
    csv: string,
    columnMap?: Record<string, string | null>,
  ): Promise<{ parsedMapping: ParsedProductCsvMapping; issues: ProductCsvIssue[]; plans: ProductPlan[] }> {
    const parsed = parseProductCsv(csv, columnMap);
    const issues = [...parsed.issues];
    const present = new Set(parsed.columns);
    const refs = await this.loadRefs(db, storeId);
    const plans: ProductPlan[] = [];
    const matchedIds = new Map<string, number>();
    const newSlugs = new Map<string, number>();

    for (const group of parsed.groups) {
      const plan = await this.planGroup(db, storeId, group, present, refs, issues);
      if (plan.matchedProductId) {
        const previous = matchedIds.get(plan.matchedProductId);
        if (previous !== undefined) {
          issues.push(
            issue(
              plan.firstRow,
              "Product ID",
              "error",
              "DUPLICATE_PRODUCT_GROUP",
              `This product is also described on row ${previous}. Combine the rows into one product.`,
            ),
          );
          plan.action = "invalid";
        } else {
          matchedIds.set(plan.matchedProductId, plan.firstRow);
        }
      } else if (plan.action === "create") {
        const createdSlug = plan.createInput?.slug;
        if (createdSlug) {
          const previous = newSlugs.get(createdSlug);
          if (previous !== undefined) {
            issues.push(
              issue(
                plan.firstRow,
                "Handle",
                "error",
                "DUPLICATE_HANDLE",
                `Handle "${createdSlug}" is also used by the product on row ${previous}.`,
              ),
            );
            plan.action = "invalid";
          } else {
            newSlugs.set(createdSlug, plan.firstRow);
          }
        }
      }
      plans.push(plan);
    }

    return {
      parsedMapping: {
        mapping: parsed.mapping,
        columns: parsed.columns,
      },
      issues,
      plans,
    };
  }

  private async loadRefs(db: DatabaseClient, storeId: string): Promise<CatalogRefs> {
    const [currency, types, categories, collections] = await Promise.all([
      this.repository.findStoreCurrency(db, storeId),
      this.products.listProductTypes(db, storeId),
      this.products.listCategories(db, storeId),
      this.collections.listCollectionRefs(db, storeId),
    ]);
    return {
      currency: currency || "USD",
      types: indexBy(types, (type) => type.name.trim().toLowerCase()),
      categories: indexBy(categories, (category) => category.name.trim().toLowerCase()),
      collections: indexBy(collections, (collection) => collection.title.trim().toLowerCase()),
    };
  }

  private async resolveExportIds(
    db: Database,
    storeId: string,
    query: ProductCsvExportQuery,
  ): Promise<{ ids: string[]; truncated: boolean; skippedIds: number }> {
    if (query.scope === "selected") {
      const requested = query.productIds ?? [];
      if (requested.length === 0) {
        throw new ProductCsvParseError("Select at least one product to export.");
      }
      if (requested.length > PRODUCT_CSV_MAX_PRODUCTS) {
        throw new ProductCsvParseError(`Select at most ${PRODUCT_CSV_MAX_PRODUCTS} products to export.`);
      }
      const ids: string[] = [];
      let skippedIds = 0;
      for (const productId of requested) {
        if (!isUuid(productId)) {
          skippedIds += 1;
          continue;
        }
        const product = await this.repository.findProductById(db, storeId, productId);
        if (!product) skippedIds += 1;
        else ids.push(product.id);
      }
      return { ids, truncated: false, skippedIds };
    }

    const ids: string[] = [];
    const seen = new Set<string>();
    let cursor: string | undefined;
    let truncated = false;
    let pages = 0;
    const search = query.scope === "filtered" ? query.search?.trim().slice(0, 100) : undefined;
    const status = query.scope === "filtered" ? query.status : undefined;

    do {
      pages += 1;
      if (pages > 30) {
        truncated = true;
        break;
      }
      const page = await this.products.listProducts(db, storeId, {
        limit: 100,
        cursor,
        search: search || undefined,
        status,
        includeStandaloneVariants: false,
      });
      for (const item of page.items) {
        if (seen.has(item.id)) continue;
        if (ids.length >= PRODUCT_CSV_MAX_PRODUCTS) {
          truncated = true;
          break;
        }
        seen.add(item.id);
        ids.push(item.id);
      }
      if (truncated || !page.hasMore || !page.nextCursor) break;
      cursor = page.nextCursor;
    } while (cursor);

    return { ids, truncated, skippedIds: 0 };
  }

  private async planGroup(
    db: Database,
    storeId: string,
    group: ParsedProductGroup,
    present: Set<ProductCsvColumn>,
    refs: CatalogRefs,
    issues: ProductCsvIssue[],
  ): Promise<ProductPlan> {
    const localErrors = () =>
      issues.some(
        (item) =>
          item.severity === "error" &&
          (item.row === group.firstRow || group.rows.some((row) => row.line === item.row)),
      );

    const productId = textValue(group, "Product ID", present);
    const handleText = textValue(group, "Handle", present);
    const titleText = textValue(group, "Title", present);
    let matched: ProductDetailDTO | null = null;

    if (productId && isUuid(productId)) {
      const existing = await this.repository.findProductById(db, storeId, productId);
      if (!existing) {
        issues.push(
          issue(
            group.firstRow,
            "Product ID",
            "error",
            "PRODUCT_NOT_IN_STORE",
            "Product ID was not found in this store. Clear it to create a new product.",
          ),
        );
      } else {
        matched = await this.products.getProductById(db, storeId, existing.id);
      }
    } else if (!productId && handleText) {
      const slug = normalizeSlug(handleText);
      if (slug) {
        const existing = await this.repository.findProductBySlug(db, storeId, slug);
        if (existing) matched = await this.products.getProductById(db, storeId, existing.id);
      }
    }

    const title = titleText || matched?.title || "";
    if (!matched && !title.trim()) {
      issues.push(issue(group.firstRow, "Title", "error", "TITLE_REQUIRED", "A new product needs a title."));
    }

    let slug: string | undefined;
    if (handleText === undefined || handleText === "") {
      slug = matched ? undefined : normalizeSlug(title);
    } else {
      slug = normalizeSlug(handleText);
      if (!slug) {
        issues.push(issue(group.firstRow, "Handle", "error", "INVALID_HANDLE", "Handle cannot be empty."));
      }
    }
    if (!matched && !slug) {
      issues.push(issue(group.firstRow, "Handle", "error", "INVALID_HANDLE", "A handle could not be created from the title."));
    }
    if (slug) {
      const conflict = await this.repository.findProductBySlug(db, storeId, slug);
      if (conflict && conflict.id !== matched?.id) {
        issues.push(
          issue(
            group.firstRow,
            "Handle",
            "error",
            "HANDLE_CONFLICT",
            `Handle "${slug}" is already used by another product in this store.`,
          ),
        );
      }
    }

    const statusText = (textValue(group, "Status", present) || "").toUpperCase();
    if (statusText && !STATUSES.has(statusText as ProductStatus)) {
      issues.push(
        issue(
          group.firstRow,
          "Status",
          "error",
          "INVALID_STATUS",
          "Status must be ACTIVE, DRAFT, or ARCHIVED.",
        ),
      );
    }
    const status: ProductStatus =
      statusText && STATUSES.has(statusText as ProductStatus)
        ? (statusText as ProductStatus)
        : matched?.status ?? "DRAFT";
    if (
      matched &&
      statusText &&
      STATUSES.has(statusText as ProductStatus) &&
      status !== matched.status &&
      !isValidProductTransition(matched.status, status)
    ) {
      issues.push(
        issue(
          group.firstRow,
          "Status",
          "error",
          "INVALID_STATUS",
          `Cannot change this product from ${matched.status} to ${status}.`,
        ),
      );
    }

    for (const column of [
      "Title",
      "Description",
      "Handle",
      "Status",
      "Product Type",
      "Category",
      "Tags",
      "Collections",
    ] as const) {
      warnIfValuesDiffer(group, column, present, issues);
    }
    warnIfCurrency(group, present, refs.currency, issues);

    const typeId = resolveNamedRef(
      group,
      "Product Type",
      present,
      refs.types,
      "UNKNOWN_TYPE",
      "AMBIGUOUS_TYPE",
      issues,
    );
    const categoryId = resolveNamedRef(
      group,
      "Category",
      present,
      refs.categories,
      "UNKNOWN_CATEGORY",
      "AMBIGUOUS_CATEGORY",
      issues,
    );
    const collectionIds = resolveCollections(group, present, refs, issues);
    const media = buildMedia(group, present, issues);
    const options = buildOptions(group, present, matched, issues);
    const variants = await this.buildVariants(
      db,
      storeId,
      group,
      present,
      matched,
      media,
      issues,
    );

    if (matched && matched.variants.length > group.rows.length) {
      const omitted = matched.variants.length - group.rows.length;
      issues.push(
        issue(
          group.firstRow,
          "Variant ID",
          "warning",
          "VARIANTS_OMITTED",
          `${omitted} existing variant${omitted === 1 ? "" : "s"} ${omitted === 1 ? "is" : "are"} not in this file and will be left unchanged.`,
        ),
      );
    }

    const failed = localErrors();
    const summary: ProductPlan = {
      firstRow: group.firstRow,
      title: title || "Untitled product",
      handle: slug || matched?.slug || "",
      status,
      variantCount: group.rows.length,
      matchedProductId: matched?.id ?? null,
      action: failed ? "invalid" : matched ? "update" : "create",
    };
    if (failed) return summary;

    const shared = {
      title: titleText ? title : undefined,
      description: clearableText(group, "Description", present),
      slug,
      status: statusText ? status : undefined,
      typeId,
      categoryId,
      tags: clearableList(group, "Tags", present),
      lowStockThreshold: optionalWhole(group, "Low Stock Threshold", present),
      maxOrderQuantity: optionalWhole(group, "Max Order Quantity", present),
      options,
      variants,
      media,
      collectionIds,
    };

    if (matched) {
      summary.updateInput = stripUndefined({
        ...shared,
        title: titleText ? title : undefined,
        status: statusText ? status : undefined,
        retainUnlistedVariants: true,
      });
    } else {
      summary.createInput = {
        title,
        description: shared.description === undefined ? null : shared.description,
        slug,
        status,
        typeId: typeId === undefined ? null : typeId,
        categoryId: categoryId === undefined ? null : categoryId,
        tags: shared.tags,
        lowStockThreshold: shared.lowStockThreshold,
        maxOrderQuantity: shared.maxOrderQuantity === undefined ? null : shared.maxOrderQuantity,
        options,
        variants,
        media,
        collectionIds,
      };
    }
    return summary;
  }

  private async buildVariants(
    db: Database,
    storeId: string,
    group: ParsedProductGroup,
    present: Set<ProductCsvColumn>,
    matched: ProductDetailDTO | null,
    media: CreateProductInput["media"],
    issues: ProductCsvIssue[],
  ): Promise<CreateVariantNestedInput[]> {
    const used = new Set<string>();
    const variants: CreateVariantNestedInput[] = [];
    const optionColumnsPresent = OPTION_SLOTS.some(
      (slot) => present.has(`Option${slot} Name`) || present.has(`Option${slot} Value`),
    );

    for (let index = 0; index < group.rows.length; index += 1) {
      const row = group.rows[index];
      if (!row) continue;
      const variantId = (row.cells["Variant ID"] ?? "").trim();
      let matchedVariant: ProductVariantDTO | null = null;

      if (variantId && isUuid(variantId)) {
        const onProduct = matched?.variants.find((variant) => variant.id === variantId) ?? null;
        if (onProduct) {
          matchedVariant = onProduct;
        } else {
          const elsewhere = await this.repository.findVariantById(db, storeId, variantId);
          issues.push(
            issue(
              row.line,
              "Variant ID",
              "error",
              elsewhere ? "VARIANT_OTHER_PRODUCT" : "VARIANT_NOT_IN_STORE",
              elsewhere
                ? "Variant ID belongs to a different product. Clear it to create a new variant on this product."
                : "Variant ID was not found in this store. Clear it to create a new variant.",
            ),
          );
        }
      } else if (matched) {
        matchedVariant = matchVariant(row, present, matched.variants, used);
      }

      if (matchedVariant) {
        if (used.has(matchedVariant.id)) {
          issues.push(
            issue(row.line, "Variant ID", "error", "DUPLICATE_VARIANT_MATCH", "Two rows match the same variant."),
          );
        }
        used.add(matchedVariant.id);
      }

      const skuCell = present.has("SKU") ? (row.cells.SKU ?? "").trim() : undefined;
      const sku = skuCell === undefined ? matchedVariant?.sku ?? null : skuCell || null;
      if (sku) {
        const existingSku = await this.repository.findVariantBySku(db, storeId, sku);
        if (existingSku && existingSku.id !== matchedVariant?.id) {
          issues.push(
            issue(row.line, "SKU", "error", "SKU_CONFLICT", `SKU "${sku}" is already used by another product in this store.`),
          );
        }
      }

      const priceCell = present.has("Price") ? (row.cells.Price ?? "").trim() : undefined;
      let price = matchedVariant?.price ?? 0;
      if (priceCell === undefined || priceCell === "") {
        if (!matchedVariant) {
          issues.push(issue(row.line, "Price", "error", "PRICE_REQUIRED", "A new variant needs a price."));
        }
      } else {
        const parsed = parseMajorUnits(priceCell);
        if (parsed.ok) price = parsed.minor;
      }

      const compareCell = present.has("Compare At Price")
        ? (row.cells["Compare At Price"] ?? "").trim()
        : undefined;
      let compareAtPrice = matchedVariant?.compareAtPrice ?? null;
      if (compareCell === "") compareAtPrice = null;
      else if (compareCell) {
        const parsed = parseMajorUnits(compareCell);
        if (parsed.ok) compareAtPrice = parsed.minor;
      }

      const quantityCell = present.has("Available Quantity")
        ? (row.cells["Available Quantity"] ?? "").trim()
        : undefined;
      let inventoryQuantity: number | undefined;
      if (quantityCell !== undefined && quantityCell !== "") {
        const parsedQuantity = Number(quantityCell);
        if (!Number.isInteger(parsedQuantity) || parsedQuantity < 0) {
          issues.push(
            issue(
              row.line,
              "Available Quantity",
              "error",
              "INVALID_NUMBER",
              "Available Quantity must be a whole number of zero or more.",
            ),
          );
        } else {
          inventoryQuantity = parsedQuantity;
        }
      }

      const optionValues = optionValuesForRow(row, present, matchedVariant, optionColumnsPresent);
      const variantTitle = variantTitleFor(row, present, matchedVariant, optionValues);
      const image = variantImageFor(row, present, matchedVariant, media, issues);
      const rawVariantStatus = present.has("Variant Status")
        ? (row.cells["Variant Status"] ?? "").trim().toUpperCase()
        : "";
      if (rawVariantStatus && !VARIANT_STATUSES.has(rawVariantStatus as VariantStatus)) {
        issues.push(
          issue(
            row.line,
            "Variant Status",
            "error",
            "INVALID_VARIANT_STATUS",
            "Variant status must be ACTIVE, INACTIVE, or ARCHIVED.",
          ),
        );
      }
      const status = variantStatusFor(row, present, matchedVariant);
      if (
        matchedVariant &&
        rawVariantStatus &&
        VARIANT_STATUSES.has(rawVariantStatus as VariantStatus) &&
        status !== matchedVariant.status &&
        !isValidVariantTransition(matchedVariant.status, status)
      ) {
        issues.push(
          issue(
            row.line,
            "Variant Status",
            "error",
            "INVALID_VARIANT_STATUS",
            `Cannot change this variant from ${matchedVariant.status} to ${status}.`,
          ),
        );
      }
      const positionCell = present.has("Variant Position")
        ? (row.cells["Variant Position"] ?? "").trim()
        : "";
      const position = positionCell ? Number(positionCell) : matchedVariant?.position ?? index;

      const input: CreateVariantNestedInput & { id?: string } = {
        id: matchedVariant?.id,
        title: variantTitle,
        displayTitle: displayTitleFor(row, present, matchedVariant),
        publishedAsProduct: publishedFor(row, present, matchedVariant),
        sku,
        price,
        compareAtPrice,
        position,
        status,
        option1: optionValues.option1,
        option2: optionValues.option2,
        option3: optionValues.option3,
        inventoryQuantity,
        lowStockThreshold: optionalVariantWhole(row, "Variant Low Stock Threshold", present),
        maxOrderQuantity: optionalVariantWhole(row, "Variant Max Order Quantity", present),
      };
      if (image.kind === "preserve") {
        input.imageId = matchedVariant?.imageId ?? null;
        input.mediaIds = matchedVariant?.mediaIds ?? [];
      } else if (image.kind === "clear") {
        input.imageId = null;
        input.mediaIds = [];
      } else {
        input.mediaIndex = image.index;
        input.mediaIndexes = [image.index];
      }
      variants.push(input);
    }

    return variants;
  }
}

interface ParsedProductCsvMapping {
  mapping: Array<{ source: string; target: ProductCsvColumn | null }>;
  columns: ProductCsvColumn[];
}

function toPreview(analysis: {
  parsedMapping: ParsedProductCsvMapping;
  issues: ProductCsvIssue[];
  plans: ProductPlan[];
}): ProductCsvPreview {
  const reported = limitIssues(analysis.issues);
  const products = analysis.plans.map((plan) => ({
    row: plan.firstRow,
    title: plan.title,
    handle: plan.handle,
    status: plan.status,
    variantCount: plan.variantCount,
    matchedProductId: plan.matchedProductId,
  }));
  return {
    mapping: analysis.parsedMapping.mapping,
    availableColumns: [...PRODUCT_CSV_COLUMNS],
    columns: analysis.parsedMapping.columns,
    productCount: analysis.plans.length,
    variantCount: analysis.plans.reduce((sum, plan) => sum + plan.variantCount, 0),
    newProductCount: analysis.plans.filter((plan) => !plan.matchedProductId).length,
    existingProductCount: analysis.plans.filter((plan) => plan.matchedProductId).length,
    errors: reported.errors,
    warnings: reported.warnings,
    issuesTruncated: reported.issuesTruncated,
    products: products.slice(0, SAMPLE_LIMIT),
    productsTruncated: products.length > SAMPLE_LIMIT,
  };
}

function actionFor(plan: ProductPlan, strategy: ProductCsvStrategy): "create" | "update" | "skip" {
  if (plan.action === "invalid") return "skip";
  if (plan.matchedProductId) return strategy === "create" ? "skip" : "update";
  return strategy === "update" ? "skip" : "create";
}

function limitIssues(issues: ProductCsvIssue[]): {
  errors: ProductCsvIssue[];
  warnings: ProductCsvIssue[];
  issuesTruncated: boolean;
} {
  const errors = issues.filter((item) => item.severity === "error");
  const warnings = issues.filter((item) => item.severity === "warning");
  const limitedErrors = errors.slice(0, ISSUE_LIMIT);
  const limitedWarnings = warnings.slice(0, Math.max(0, ISSUE_LIMIT - limitedErrors.length));
  return {
    errors: limitedErrors,
    warnings: limitedWarnings,
    issuesTruncated: errors.length + warnings.length > limitedErrors.length + limitedWarnings.length,
  };
}

function issue(
  row: number,
  column: string | null,
  severity: "error" | "warning",
  code: string,
  message: string,
): ProductCsvIssue {
  return { row, column, severity, code, message };
}

function merchantMessage(error: unknown): string {
  if (error instanceof ProductDomainError) return error.message;
  if (error instanceof Error && /^(Product |SKU |Price |Compare-at |Variant |Collection |Cannot |Option )/.test(error.message)) {
    return error.message;
  }
  return "This product could not be imported.";
}

function indexBy<T extends { id: string }>(
  items: T[],
  keyOf: (item: T) => string,
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const current = map.get(key);
    if (current) current.push(item);
    else map.set(key, [item]);
  }
  return map;
}

function textValue(
  group: ParsedProductGroup,
  column: ProductCsvColumn,
  present: Set<ProductCsvColumn>,
): string | undefined {
  if (!present.has(column)) return undefined;
  for (const row of group.rows) {
    const value = (row.cells[column] ?? "").trim();
    if (value) return value;
  }
  return "";
}

function clearableText(
  group: ParsedProductGroup,
  column: ProductCsvColumn,
  present: Set<ProductCsvColumn>,
): string | null | undefined {
  const value = textValue(group, column, present);
  if (value === undefined) return undefined;
  return value === "" ? null : value;
}

function clearableList(
  group: ParsedProductGroup,
  column: ProductCsvColumn,
  present: Set<ProductCsvColumn>,
): string[] | undefined {
  const value = textValue(group, column, present);
  if (value === undefined) return undefined;
  if (!value) return [];
  const seen = new Set<string>();
  const items: string[] = [];
  for (const part of splitPipeList(value)) {
    const key = part.toLowerCase();
    if (!part || seen.has(key)) continue;
    seen.add(key);
    items.push(part);
  }
  return items;
}

function optionalWhole(
  group: ParsedProductGroup,
  column: ProductCsvColumn,
  present: Set<ProductCsvColumn>,
): number | undefined {
  const value = textValue(group, column, present);
  if (!value) return undefined;
  return Number(value);
}

function warnIfValuesDiffer(
  group: ParsedProductGroup,
  column: ProductCsvColumn,
  present: Set<ProductCsvColumn>,
  issues: ProductCsvIssue[],
): void {
  if (!present.has(column)) return;
  const values = new Set(
    group.rows.map((row) => (row.cells[column] ?? "").trim()).filter((value) => value.length > 0),
  );
  if (values.size > 1) {
    issues.push(
      issue(
        group.firstRow,
        column,
        "warning",
        "INCONSISTENT_PRODUCT_FIELD",
        `${column} differs between rows of this product. The first value will be used.`,
      ),
    );
  }
}

function warnIfCurrency(
  group: ParsedProductGroup,
  present: Set<ProductCsvColumn>,
  currency: string,
  issues: ProductCsvIssue[],
): void {
  if (!present.has("Currency")) return;
  for (const row of group.rows) {
    const value = (row.cells.Currency ?? "").trim();
    if (value && value.toUpperCase() !== currency.toUpperCase()) {
      issues.push(
        issue(
          row.line,
          "Currency",
          "warning",
          "CURRENCY_IGNORED",
          `Currency ${value} was ignored. This store uses ${currency}.`,
        ),
      );
      return;
    }
  }
}

function resolveNamedRef(
  group: ParsedProductGroup,
  column: "Product Type" | "Category",
  present: Set<ProductCsvColumn>,
  refs: Map<string, Array<{ id: string }>>,
  unknownCode: string,
  ambiguousCode: string,
  issues: ProductCsvIssue[],
): string | null | undefined {
  const value = textValue(group, column, present);
  if (value === undefined) return undefined;
  if (!value) return null;
  const matches = refs.get(value.toLowerCase()) ?? [];
  const match = matches[0];
  if (!match) {
    issues.push(issue(group.firstRow, column, "error", unknownCode, `${column} "${value}" does not exist in this store.`));
    return undefined;
  }
  if (matches.length > 1) {
    issues.push(issue(group.firstRow, column, "error", ambiguousCode, `${column} "${value}" matches more than one record in this store.`));
    return undefined;
  }
  return match.id;
}

function resolveCollections(
  group: ParsedProductGroup,
  present: Set<ProductCsvColumn>,
  refs: CatalogRefs,
  issues: ProductCsvIssue[],
): string[] | undefined {
  const value = textValue(group, "Collections", present);
  if (value === undefined) return undefined;
  if (!value) return [];
  const ids: string[] = [];
  for (const name of splitPipeList(value).filter(Boolean)) {
    const matches = refs.collections.get(name.toLowerCase()) ?? [];
    const match = matches[0];
    if (!match) {
      issues.push(
        issue(group.firstRow, "Collections", "error", "UNKNOWN_COLLECTION", `Collection "${name}" does not exist in this store.`),
      );
      continue;
    }
    if (matches.length > 1) {
      issues.push(
        issue(
          group.firstRow,
          "Collections",
          "error",
          "AMBIGUOUS_COLLECTION",
          `Collection "${name}" matches more than one collection in this store.`,
        ),
      );
      continue;
    }
    ids.push(match.id);
  }
  return ids;
}

function buildMedia(
  group: ParsedProductGroup,
  present: Set<ProductCsvColumn>,
  issues: ProductCsvIssue[],
): CreateProductInput["media"] {
  const galleryPresent = present.has("Image URLs") || present.has("Image Alt Texts") || present.has("Image Positions");
  const variantPresent = present.has("Variant Image URL");
  if (!galleryPresent && !variantPresent) return undefined;

  const media: Array<{ url: string; altText: string | null; position: number }> = [];
  const seen = new Set<string>();
  const add = (url: string, altText: string | null, position: number | null) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    media.push({ url, altText, position: position ?? media.length });
  };

  if (galleryPresent) {
    for (const row of group.rows) {
      const urls = splitPipeList(row.cells["Image URLs"] ?? "");
      const alts = splitPipeList(row.cells["Image Alt Texts"] ?? "");
      const positions = splitPipeList(row.cells["Image Positions"] ?? "");
      urls.forEach((url, index) => {
        const positionText = positions[index] ?? "";
        add(url, alts[index] || null, /^\d+$/.test(positionText) ? Number(positionText) : null);
      });
    }
    return media;
  }

  for (const row of group.rows) {
    const url = (row.cells["Variant Image URL"] ?? "").trim();
    if (url) add(url, null, null);
  }
  if (media.length === 0) {
    issues.push(
      issue(group.firstRow, "Variant Image URL", "warning", "IMAGES_UNCHANGED", "No variant image URL was provided, so images stay unchanged when this column is the only image column and every cell is blank."),
    );
    return undefined;
  }
  return media;
}

function buildOptions(
  group: ParsedProductGroup,
  present: Set<ProductCsvColumn>,
  matched: ProductDetailDTO | null,
  issues: ProductCsvIssue[],
): CreateProductOptionInput[] | undefined {
  const anyOption = OPTION_SLOTS.some(
    (slot) =>
      present.has(`Option${slot} Name`) ||
      present.has(`Option${slot} Value`) ||
      present.has(`Option${slot} Publishable`),
  );
  if (!anyOption) return undefined;

  const options: CreateProductOptionInput[] = [];
  for (const slot of OPTION_SLOTS) {
    const nameColumn = `Option${slot} Name` as ProductCsvColumn;
    const valueColumn = `Option${slot} Value` as ProductCsvColumn;
    const publishableColumn = `Option${slot} Publishable` as ProductCsvColumn;
    const name = textValue(group, nameColumn, present);
    if (!name) {
      const existingSlot = [...(matched?.options ?? [])].sort(
        (left, right) => left.position - right.position,
      )[slot - 1];
      if (existingSlot) {
        options.push({
          name: existingSlot.name,
          position: existingSlot.position,
          values: existingSlot.values,
          isPublishable: existingSlot.isPublishable,
          optionValues: existingSlot.optionValues?.map((optionValue, index) => ({
            value: optionValue.value,
            displayTitle: optionValue.displayTitle,
            isPublished: optionValue.isPublished,
            position: optionValue.position ?? index,
          })),
        });
      }
      continue;
    }
    const values: string[] = [];
    const seen = new Set<string>();
    for (const row of group.rows) {
      const value = (row.cells[valueColumn] ?? "").trim();
      const key = value.toLowerCase();
      if (!value || seen.has(key)) continue;
      seen.add(key);
      values.push(value);
    }
    if (values.length === 0) continue;

    const existing = matched?.options?.find((option) => option.name.trim().toLowerCase() === name.toLowerCase());
    let isPublishable = Boolean(existing?.isPublishable);
    if (present.has(publishableColumn)) {
      const flags = group.rows
        .map((row) => (row.cells[publishableColumn] ?? "").trim())
        .filter(Boolean)
        .map((value) => parseBooleanText(value))
        .filter((value): value is boolean => value !== null);
      if (flags.length > 0) isPublishable = flags.some((flag) => flag);
    }

    options.push({
      name,
      position: slot - 1,
      values,
      isPublishable,
      optionValues: values.map((value, index) => {
        const rows = group.rows.filter((row) => (row.cells[valueColumn] ?? "").trim().toLowerCase() === value.toLowerCase());
        const existingValue = existing?.optionValues?.find(
          (optionValue) => optionValue.value.trim().toLowerCase() === value.toLowerCase(),
        );
        const displayCells = rows
          .map((row) => (row.cells["Variant Display Title"] ?? "").trim())
          .filter(Boolean);
        if (new Set(displayCells).size > 1) {
          issues.push(
            issue(
              group.firstRow,
              "Variant Display Title",
              "warning",
              "INCONSISTENT_DISPLAY_TITLE",
              `Option value "${value}" has more than one display title. The first one will be used.`,
            ),
          );
        }
        const publishedCells = present.has("Variant Published As Product")
          ? rows
              .map((row) => (row.cells["Variant Published As Product"] ?? "").trim())
              .filter(Boolean)
              .map((cell) => parseBooleanText(cell))
              .filter((cell): cell is boolean => cell !== null)
          : [];
        return {
          value,
          displayTitle: present.has("Variant Display Title")
            ? displayCells[0] ?? null
            : existingValue?.displayTitle ?? null,
          isPublished:
            publishedCells.length > 0
              ? publishedCells.some((published) => published)
              : (existingValue?.isPublished ?? false),
          position: index,
        };
      }),
    });
  }
  return options;
}

function matchVariant(
  row: ParsedCsvRow,
  present: Set<ProductCsvColumn>,
  variants: ProductVariantDTO[],
  used: Set<string>,
): ProductVariantDTO | null {
  const available = variants.filter((variant) => !used.has(variant.id));
  const sku = present.has("SKU") ? (row.cells.SKU ?? "").trim() : "";
  if (sku) {
    const bySku = available.find((variant) => variant.sku === sku);
    if (bySku) return bySku;
  }
  const optionKey = optionKeyFor(row, present);
  if (optionKey) {
    const byOption = available.find((variant) => optionKeyForVariant(variant) === optionKey);
    if (byOption) return byOption;
  }
  const title = present.has("Variant Title") ? (row.cells["Variant Title"] ?? "").trim().toLowerCase() : "";
  if (title) {
    return available.find((variant) => variant.title.trim().toLowerCase() === title) ?? null;
  }
  return null;
}

function optionKeyFor(row: ParsedCsvRow, present: Set<ProductCsvColumn>): string {
  return [1, 2, 3]
    .map((slot) => {
      const column = `Option${slot} Value` as ProductCsvColumn;
      if (!present.has(column)) return "";
      return (row.cells[column] ?? "").trim().toLowerCase();
    })
    .filter(Boolean)
    .join(" / ");
}

function optionKeyForVariant(variant: ProductVariantDTO): string {
  return [variant.option1, variant.option2, variant.option3]
    .map((value) => (value ?? "").trim().toLowerCase())
    .filter(Boolean)
    .join(" / ");
}

function optionValuesForRow(
  row: ParsedCsvRow,
  present: Set<ProductCsvColumn>,
  matched: ProductVariantDTO | null,
  optionColumnsPresent: boolean,
): { option1: string | null; option2: string | null; option3: string | null } {
    if (!optionColumnsPresent) {
    return {
      option1: matched?.option1 ?? null,
      option2: matched?.option2 ?? null,
      option3: matched?.option3 ?? null,
    };
  }
  const value = (slot: 1 | 2 | 3, current: string | null | undefined): string | null => {
    const column = `Option${slot} Value` as ProductCsvColumn;
    if (!present.has(column)) return current ?? null;
    const cell = (row.cells[column] ?? "").trim();
    if (!cell) return current ?? null;
    return cell;
  };
  return {
    option1: value(1, matched?.option1),
    option2: value(2, matched?.option2),
    option3: value(3, matched?.option3),
  };
}

function variantTitleFor(
  row: ParsedCsvRow,
  present: Set<ProductCsvColumn>,
  matched: ProductVariantDTO | null,
  options: { option1: string | null; option2: string | null; option3: string | null },
): string {
  const cell = present.has("Variant Title") ? (row.cells["Variant Title"] ?? "").trim() : "";
  if (cell) return cell;
  if (matched?.title) return matched.title;
  const joined = [options.option1, options.option2, options.option3].filter(Boolean).join(" / ");
  return joined || "Default Title";
}

function displayTitleFor(
  row: ParsedCsvRow,
  present: Set<ProductCsvColumn>,
  matched: ProductVariantDTO | null,
): string | null {
  if (!present.has("Variant Display Title")) return matched?.displayTitle ?? null;
  return (row.cells["Variant Display Title"] ?? "").trim() || null;
}

function publishedFor(
  row: ParsedCsvRow,
  present: Set<ProductCsvColumn>,
  matched: ProductVariantDTO | null,
): boolean {
  const cell = present.has("Variant Published As Product")
    ? (row.cells["Variant Published As Product"] ?? "").trim()
    : "";
  if (!cell) return Boolean(matched?.publishedAsProduct);
  return parseBooleanText(cell) ?? false;
}

function variantStatusFor(
  row: ParsedCsvRow,
  present: Set<ProductCsvColumn>,
  matched: ProductVariantDTO | null,
): VariantStatus {
  const cell = present.has("Variant Status") ? (row.cells["Variant Status"] ?? "").trim().toUpperCase() : "";
  if (cell && VARIANT_STATUSES.has(cell as VariantStatus)) return cell as VariantStatus;
  return matched?.status ?? "ACTIVE";
}

function optionalVariantWhole(
  row: ParsedCsvRow,
  column: ProductCsvColumn,
  present: Set<ProductCsvColumn>,
): number | undefined {
  if (!present.has(column)) return undefined;
  const value = (row.cells[column] ?? "").trim();
  if (!value) return undefined;
  return Number(value);
}

function variantImageFor(
  row: ParsedCsvRow,
  present: Set<ProductCsvColumn>,
  matched: ProductVariantDTO | null,
  media: CreateProductInput["media"],
  issues: ProductCsvIssue[],
): { kind: "preserve" } | { kind: "clear" } | { kind: "index"; index: number } {
  if (!present.has("Variant Image URL")) {
    return media === undefined ? { kind: "preserve" } : imageIndex(row, matched, media, issues);
  }
  const url = (row.cells["Variant Image URL"] ?? "").trim();
  if (!url) return { kind: "clear" };
  const list = media ?? [];
  let index = list.findIndex((item) => item.url === url);
  if (index < 0) {
    list.push({ url, altText: null, position: list.length });
    index = list.length - 1;
    issues.push(
      issue(row.line, "Variant Image URL", "warning", "IMAGE_ADDED", "The variant image was added to the product gallery."),
    );
  }
  return { kind: "index", index };
}

function imageIndex(
  row: ParsedCsvRow,
  matched: ProductVariantDTO | null,
  media: NonNullable<CreateProductInput["media"]>,
  issues: ProductCsvIssue[],
): { kind: "preserve" } | { kind: "clear" } | { kind: "index"; index: number } {
  const current = matched?.imageUrl?.trim();
  if (!current) return { kind: "clear" };
  const index = media.findIndex((item) => item.url === current);
  if (index < 0) {
    issues.push(
      issue(
        row.line,
        "Variant Image URL",
        "warning",
        "VARIANT_IMAGE_UNMATCHED",
        "The current variant image is not in the imported gallery, so that variant image link will be cleared.",
      ),
    );
    return { kind: "clear" };
  }
  return { kind: "index", index };
}

function stripUndefined<T extends object>(value: T): T {
  const copy = { ...value };
  for (const key of Object.keys(copy) as Array<keyof T>) {
    if (copy[key] === undefined) delete copy[key];
  }
  return copy;
}

function exportRow(
  product: ProductDetailDTO,
  variant: ProductVariantDTO | null,
  collectionNames: string[],
): string[] {
  const options = [...(product.options ?? [])].sort((left, right) => left.position - right.position);
  const media = [...product.media].sort((left, right) => left.position - right.position);
  const values: Partial<Record<ProductCsvColumn, string>> = {
    "Product ID": product.id,
    Title: product.title,
    Description: product.description ?? "",
    Handle: product.slug,
    Status: product.status,
    "Product Type": product.typeName ?? product.type?.name ?? "",
    Category: product.categoryName ?? product.category?.name ?? "",
    Tags: pipe(product.tags ?? []),
    Collections: pipe(collectionNames),
    "Published At": product.publishedAt ?? "",
    "Created At": product.createdAt,
    "Updated At": product.updatedAt,
    "Low Stock Threshold": String(product.lowStockThreshold),
    "Max Order Quantity": product.maxOrderQuantity == null ? "" : String(product.maxOrderQuantity),
    "Image URLs": pipe(media.map((item) => item.url)),
    "Image Alt Texts": pipe(media.map((item) => item.altText ?? "")),
    "Image Positions": media.map((item) => String(item.position)).join("|"),
  };

  OPTION_SLOTS.forEach((slot) => {
    const option = options[slot - 1];
    if (!option) return;
    values[`Option${slot} Name`] = option.name;
    values[`Option${slot} Publishable`] = option.isPublishable ? "true" : "false";
  });

  if (variant) {
    values["Option1 Value"] = variant.option1 ?? "";
    values["Option2 Value"] = variant.option2 ?? "";
    values["Option3 Value"] = variant.option3 ?? "";
    values["Variant ID"] = variant.id;
    values["Variant Title"] = variant.title;
    values["Variant Display Title"] = variant.displayTitle ?? "";
    values["Variant Published As Product"] = variant.publishedAsProduct ? "true" : "false";
    values.SKU = variant.sku ?? "";
    values.Price = formatMajorUnits(variant.price);
    values["Compare At Price"] = variant.compareAtPrice == null ? "" : formatMajorUnits(variant.compareAtPrice);
    values.Currency = variant.currency;
    values["Variant Status"] = variant.status;
    values["Variant Position"] = String(variant.position);
    values["Variant Low Stock Threshold"] =
      variant.lowStockThreshold == null ? "" : String(variant.lowStockThreshold);
    values["Variant Max Order Quantity"] =
      variant.maxOrderQuantity == null ? "" : String(variant.maxOrderQuantity);
    values["Available Quantity"] =
      variant.inventoryQuantity == null ? "" : String(variant.inventoryQuantity);
    values["Variant Image URL"] = variant.imageUrl ?? "";
  }

  return PRODUCT_CSV_COLUMNS.map((column) => values[column] ?? "");
}

function pipe(values: string[]): string {
  return values.map((value) => value.replace(/\|/g, "/")).join("|");
}
