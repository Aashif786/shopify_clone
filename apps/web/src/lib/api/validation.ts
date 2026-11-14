import type {
  CollectionStatus,
  CreateCollectionInput,
  UpdateCollectionInput,
  CreateReviewInput,
  UpdateReviewInput,
  ModerateReviewInput,
  ReviewReportInput,
  ReviewStatus,
} from "@calcart/products";
import type {
  ValidationError,
  ValidationResult,
  Validator,
} from "@calcart/validation";
import {
  validationFailure,
  validationSuccess,
} from "@calcart/validation";
import { isValidEmailFormat } from "@calcart/auth";
import type { AdjustmentReason } from "@calcart/inventory";
import {
  type CustomerStatus,
  isValidCustomerStatus,
} from "@calcart/customers";
import {
  type AnalyticsPeriodPreset,
  type AnalyticsQueryDto,
  type ListOrdersQueryDto,
  type MerchantOrderStatusTarget,
  type OrderFulfillmentStatus,
  type OrderPaymentStatus,
  type OrderStatus,
  isMerchantOrderStatusTarget,
  isValidOrderFulfillmentStatus,
  isValidOrderPaymentStatus,
  isValidOrderStatus,
} from "@calcart/orders";
import { ApiHttpError } from "./errors";

export const MAX_REQUEST_BODY_BYTES = 65_536; // 64KB

export async function parseJsonBody<T = unknown>(req: Request): Promise<T> {
  const contentType = req.headers.get("content-type");
  if (!contentType || !contentType.toLowerCase().includes("application/json")) {
    throw new ApiHttpError(
      400,
      "VALIDATION_ERROR",
      "Content-Type must be application/json",
      {
        fields: {
          "content-type": "Expected application/json",
        },
      },
    );
  }

  const contentLength = req.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_REQUEST_BODY_BYTES) {
    throw new ApiHttpError(
      400,
      "VALIDATION_ERROR",
      "Request body exceeds maximum allowed size (64KB)",
      { fields: { body: "Request body exceeds maximum allowed size" } },
    );
  }

  try {
    const text = await req.text();
    if (text.length > MAX_REQUEST_BODY_BYTES) {
      throw new ApiHttpError(
        400,
        "VALIDATION_ERROR",
        "Request body exceeds maximum allowed size (64KB)",
        { fields: { body: "Request body exceeds maximum allowed size" } },
      );
    }
    if (!text.trim()) {
      throw new Error("Empty body");
    }
    return JSON.parse(text) as T;
  } catch (err) {
    if (err instanceof ApiHttpError) {
      throw err;
    }
    throw new ApiHttpError(
      400,
      "VALIDATION_ERROR",
      "Malformed JSON request body",
    );
  }
}

export async function validateBody<T>(
  req: Request,
  validator: Validator<T>,
): Promise<T> {
  const parsed = await parseJsonBody(req);
  const result = validator.validate(parsed);

  if (!result.success) {
    const fields: Record<string, string> = {};
    for (const error of result.errors) {
      fields[error.field] = error.message;
    }
    const firstErrorMessage = result.errors[0]?.message;
    const message =
      result.errors.length === 1 && firstErrorMessage
        ? firstErrorMessage
        : firstErrorMessage
          ? `Validation failed: ${firstErrorMessage}`
          : "Request validation failed";

    throw new ApiHttpError(
      400,
      "VALIDATION_ERROR",
      message,
      {
        fields,
        details: { errors: result.errors },
      },
    );
  }

  return result.data;
}

export function validateQuery<T>(
  input: Request | URL,
  validator: Validator<T>,
): T {
  const url = input instanceof Request ? new URL(input.url) : input;
  const rawParams: Record<string, string> = {};
  url.searchParams.forEach((val, key) => {
    rawParams[key] = val;
  });

  const result = validator.validate(rawParams);
  if (!result.success) {
    const fields: Record<string, string> = {};
    for (const error of result.errors) {
      fields[error.field] = error.message;
    }
    throw new ApiHttpError(
      400,
      "VALIDATION_ERROR",
      "Query parameter validation failed",
      {
        fields,
        details: { errors: result.errors },
      },
    );
  }

  return result.data;
}

export interface RegisterDto {
  email: string;
  password: string;
  name: string;
}

export const registerValidator: Validator<RegisterDto> = {
  validate(input: unknown): ValidationResult<RegisterDto> {
    const errors: ValidationError[] = [];

    if (typeof input !== "object" || input === null) {
      return validationFailure([
        { field: "body", message: "Request body must be an object" },
      ]);
    }

    const record = input as Record<string, unknown>;

    if (typeof record.email !== "string" || !record.email.trim()) {
      errors.push({ field: "email", message: "Email is required" });
    } else if (!isValidEmailFormat(record.email.trim())) {
      errors.push({ field: "email", message: "Invalid email address format" });
    }

    if (typeof record.password !== "string" || !record.password) {
      errors.push({ field: "password", message: "Password is required" });
    } else if (record.password.length < 8) {
      errors.push({
        field: "password",
        message: "Password must be at least 8 characters long",
      });
    }

    if (typeof record.name !== "string" || !record.name.trim()) {
      errors.push({ field: "name", message: "Name is required" });
    } else if (record.name.trim().length > 100) {
      errors.push({
        field: "name",
        message: "Name must not exceed 100 characters",
      });
    }

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({
      email: (record.email as string).trim(),
      password: record.password as string,
      name: (record.name as string).trim(),
    });
  },
};

export interface LoginDto {
  email: string;
  password: string;
}

export const loginValidator: Validator<LoginDto> = {
  validate(input: unknown): ValidationResult<LoginDto> {
    const errors: ValidationError[] = [];

    if (typeof input !== "object" || input === null) {
      return validationFailure([
        { field: "body", message: "Request body must be an object" },
      ]);
    }

    const record = input as Record<string, unknown>;

    if (typeof record.email !== "string" || !record.email.trim()) {
      errors.push({ field: "email", message: "Email is required" });
    }

    if (typeof record.password !== "string" || !record.password) {
      errors.push({ field: "password", message: "Password is required" });
    }

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({
      email: (record.email as string).trim(),
      password: record.password as string,
    });
  },
};

export interface CreateStoreRequestDto {
  name: string;
  slug?: string;
  currency?: string;
  locale?: string;
  timezone?: string;
  organizationId?: string;
  organizationName?: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  description?: string | null;
  status?: "DRAFT" | "ACTIVE";
}

export const createStoreValidator: Validator<CreateStoreRequestDto> = {
  validate(input: unknown): ValidationResult<CreateStoreRequestDto> {
    const errors: ValidationError[] = [];

    if (typeof input !== "object" || input === null) {
      return validationFailure([
        { field: "body", message: "Request body must be an object" },
      ]);
    }

    const record = input as Record<string, unknown>;

    if (typeof record.name !== "string" || !record.name.trim()) {
      errors.push({ field: "name", message: "Store name is required" });
    } else if (record.name.trim().length > 100) {
      errors.push({
        field: "name",
        message: "Store name must not exceed 100 characters",
      });
    }

    if (record.slug !== undefined) {
      if (typeof record.slug !== "string" || !record.slug.trim()) {
        errors.push({
          field: "slug",
          message: "Slug must be a non-empty string",
        });
      }
    }


    if (record.currency !== undefined) {
      if (
        typeof record.currency !== "string" ||
        !/^[A-Za-z]{3}$/.test(record.currency.trim())
      ) {
        errors.push({
          field: "currency",
          message: "Currency must be a 3-letter currency code",
        });
      }
    }

    if (record.locale !== undefined) {
      if (typeof record.locale !== "string" || !record.locale.trim()) {
        errors.push({
          field: "locale",
          message: "Locale must be a valid non-empty string",
        });
      }
    }

    if (record.timezone !== undefined) {
      if (typeof record.timezone !== "string" || !record.timezone.trim()) {
        errors.push({
          field: "timezone",
          message: "Timezone must be a valid non-empty string",
        });
      }
    }

    if (record.organizationId !== undefined) {
      if (
        typeof record.organizationId !== "string" ||
        !record.organizationId.trim()
      ) {
        errors.push({
          field: "organizationId",
          message: "Organization ID must be a string",
        });
      }
    }

    if (record.organizationName !== undefined) {
      if (
        typeof record.organizationName !== "string" ||
        !record.organizationName.trim()
      ) {
        errors.push({
          field: "organizationName",
          message: "Organization name must be a string",
        });
      }
    }

    if (record.contactEmail !== undefined && record.contactEmail !== null) {
      if (
        typeof record.contactEmail !== "string" ||
        !isValidEmailFormat(record.contactEmail.trim())
      ) {
        errors.push({
          field: "contactEmail",
          message: "Contact email must be a valid email address",
        });
      }
    }

    if (record.contactPhone !== undefined && record.contactPhone !== null) {
      if (
        typeof record.contactPhone !== "string" ||
        record.contactPhone.length > 30
      ) {
        errors.push({
          field: "contactPhone",
          message: "Contact phone must not exceed 30 characters",
        });
      }
    }

    if (record.description !== undefined && record.description !== null) {
      if (typeof record.description !== "string") {
        errors.push({
          field: "description",
          message: "Description must be a string",
        });
      }
    }

    if (record.status !== undefined && record.status !== null) {
      if (
        typeof record.status !== "string" ||
        !["DRAFT", "ACTIVE"].includes(record.status)
      ) {
        errors.push({
          field: "status",
          message: "Status must be either DRAFT or ACTIVE",
        });
      }
    }

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({
      name: (record.name as string).trim(),
      slug:
        record.slug !== undefined ? (record.slug as string).trim() : undefined,
      currency:
        record.currency !== undefined
          ? (record.currency as string).trim().toUpperCase()
          : undefined,
      locale:
        record.locale !== undefined
          ? (record.locale as string).trim()
          : undefined,
      timezone:
        record.timezone !== undefined
          ? (record.timezone as string).trim()
          : undefined,
      organizationId:
        record.organizationId !== undefined
          ? (record.organizationId as string).trim()
          : undefined,
      organizationName:
        record.organizationName !== undefined
          ? (record.organizationName as string).trim()
          : undefined,
      contactEmail:
        record.contactEmail !== undefined && record.contactEmail !== null
          ? (record.contactEmail as string).trim()
          : (record.contactEmail as null | undefined),
      contactPhone:
        record.contactPhone !== undefined && record.contactPhone !== null
          ? (record.contactPhone as string).trim()
          : (record.contactPhone as null | undefined),
      description:
        record.description !== undefined && record.description !== null
          ? (record.description as string).trim()
          : (record.description as null | undefined),
      status:
        record.status !== undefined && record.status !== null
          ? (record.status as "DRAFT" | "ACTIVE")
          : undefined,
    });
  },
};

export interface UpdateStoreRequestDto {
  name?: string;
  currency?: string;
  locale?: string;
  timezone?: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  description?: string | null;
}

export const updateStoreValidator: Validator<UpdateStoreRequestDto> = {
  validate(input: unknown): ValidationResult<UpdateStoreRequestDto> {
    const errors: ValidationError[] = [];

    if (typeof input !== "object" || input === null) {
      return validationFailure([
        { field: "body", message: "Request body must be an object" },
      ]);
    }

    const record = input as Record<string, unknown>;

    if (record.name !== undefined) {
      if (typeof record.name !== "string" || !record.name.trim()) {
        errors.push({
          field: "name",
          message: "Store name must be a non-empty string",
        });
      } else if (record.name.trim().length > 100) {
        errors.push({
          field: "name",
          message: "Store name must not exceed 100 characters",
        });
      }
    }


    if (record.currency !== undefined) {
      if (
        typeof record.currency !== "string" ||
        !/^[A-Za-z]{3}$/.test(record.currency.trim())
      ) {
        errors.push({
          field: "currency",
          message: "Currency must be a 3-letter currency code",
        });
      }
    }

    if (record.locale !== undefined) {
      if (typeof record.locale !== "string" || !record.locale.trim()) {
        errors.push({
          field: "locale",
          message: "Locale must be a valid non-empty string",
        });
      }
    }

    if (record.timezone !== undefined) {
      if (typeof record.timezone !== "string" || !record.timezone.trim()) {
        errors.push({
          field: "timezone",
          message: "Timezone must be a valid non-empty string",
        });
      }
    }

    if (record.contactEmail !== undefined && record.contactEmail !== null) {
      if (
        typeof record.contactEmail !== "string" ||
        !isValidEmailFormat(record.contactEmail.trim())
      ) {
        errors.push({
          field: "contactEmail",
          message: "Contact email must be a valid email address",
        });
      }
    }

    if (record.contactPhone !== undefined && record.contactPhone !== null) {
      if (
        typeof record.contactPhone !== "string" ||
        record.contactPhone.length > 30
      ) {
        errors.push({
          field: "contactPhone",
          message: "Contact phone must not exceed 30 characters",
        });
      }
    }

    if (record.description !== undefined && record.description !== null) {
      if (typeof record.description !== "string") {
        errors.push({
          field: "description",
          message: "Description must be a string",
        });
      }
    }

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({
      name:
        record.name !== undefined ? (record.name as string).trim() : undefined,
      currency:
        record.currency !== undefined
          ? (record.currency as string).trim().toUpperCase()
          : undefined,
      locale:
        record.locale !== undefined
          ? (record.locale as string).trim()
          : undefined,
      timezone:
        record.timezone !== undefined
          ? (record.timezone as string).trim()
          : undefined,
      contactEmail:
        record.contactEmail !== undefined && record.contactEmail !== null
          ? (record.contactEmail as string).trim()
          : (record.contactEmail as null | undefined),
      contactPhone:
        record.contactPhone !== undefined && record.contactPhone !== null
          ? (record.contactPhone as string).trim()
          : (record.contactPhone as null | undefined),
      description:
        record.description !== undefined && record.description !== null
          ? (record.description as string).trim()
          : (record.description as null | undefined),
    });
  },
};

export interface AddStoreMemberRequestDto {
  userId: string;
  role: "owner" | "admin" | "staff";
}

export const addStoreMemberValidator: Validator<AddStoreMemberRequestDto> = {
  validate(input: unknown): ValidationResult<AddStoreMemberRequestDto> {
    const errors: ValidationError[] = [];

    if (typeof input !== "object" || input === null) {
      return validationFailure([
        { field: "body", message: "Request body must be an object" },
      ]);
    }

    const record = input as Record<string, unknown>;

    if (typeof record.userId !== "string" || !record.userId.trim()) {
      errors.push({ field: "userId", message: "User ID is required" });
    }

    if (
      typeof record.role !== "string" ||
      !["owner", "admin", "staff"].includes(record.role.trim().toLowerCase())
    ) {
      errors.push({
        field: "role",
        message: "Role must be one of: owner, admin, staff",
      });
    }

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({
      userId: (record.userId as string).trim(),
      role: (record.role as string).trim().toLowerCase() as
        "owner" | "admin" | "staff",
    });
  },
};

export interface UpdateStoreMemberRequestDto {
  role?: "owner" | "admin" | "staff";
  status?: "INVITED" | "ACTIVE" | "SUSPENDED" | "REMOVED";
}

export const updateStoreMemberValidator: Validator<UpdateStoreMemberRequestDto> =
  {
    validate(input: unknown): ValidationResult<UpdateStoreMemberRequestDto> {
      const errors: ValidationError[] = [];

      if (typeof input !== "object" || input === null) {
        return validationFailure([
          { field: "body", message: "Request body must be an object" },
        ]);
      }

      const record = input as Record<string, unknown>;

      if (record.role !== undefined) {
        if (
          typeof record.role !== "string" ||
          !["owner", "admin", "staff"].includes(
            record.role.trim().toLowerCase(),
          )
        ) {
          errors.push({
            field: "role",
            message: "Role must be one of: owner, admin, staff",
          });
        }
      }

      if (record.status !== undefined) {
        if (
          typeof record.status !== "string" ||
          !["INVITED", "ACTIVE", "SUSPENDED", "REMOVED"].includes(
            record.status.trim().toUpperCase(),
          )
        ) {
          errors.push({
            field: "status",
            message:
              "Status must be one of: INVITED, ACTIVE, SUSPENDED, REMOVED",
          });
        }
      }

      if (errors.length > 0) {
        return validationFailure(errors);
      }

      return validationSuccess({
        role:
          record.role !== undefined
            ? ((record.role as string).trim().toLowerCase() as
                "owner" | "admin" | "staff")
            : undefined,
        status:
          record.status !== undefined
            ? ((record.status as string).trim().toUpperCase() as
                "INVITED" | "ACTIVE" | "SUSPENDED" | "REMOVED")
            : undefined,
      });
    },
  };

// -------------------------------------------------------------
// Products Domain Validators
// -------------------------------------------------------------

export interface CreateProductTypeRequestDto {
  name: string;
  slug?: string;
}

export const createProductTypeValidator: Validator<CreateProductTypeRequestDto> = {
  validate(input: unknown): ValidationResult<CreateProductTypeRequestDto> {
    const errors: ValidationError[] = [];
    if (typeof input !== "object" || input === null) {
      return validationFailure([{ field: "body", message: "Request body must be an object" }]);
    }
    const record = input as Record<string, unknown>;
    if (typeof record.name !== "string" || !record.name.trim()) {
      errors.push({ field: "name", message: "Product type name is required" });
    } else if (record.name.trim().length > 100) {
      errors.push({ field: "name", message: "Product type name cannot exceed 100 characters" });
    }
    if (record.slug !== undefined && (typeof record.slug !== "string" || !record.slug.trim())) {
      errors.push({ field: "slug", message: "Slug must be a non-empty string" });
    }
    if (errors.length > 0) return validationFailure(errors);
    return validationSuccess({
      name: (record.name as string).trim(),
      slug: record.slug !== undefined ? (record.slug as string).trim() : undefined,
    });
  },
};

export interface UpdateProductTypeRequestDto {
  name?: string;
  slug?: string;
}

export const updateProductTypeValidator: Validator<UpdateProductTypeRequestDto> = {
  validate(input: unknown): ValidationResult<UpdateProductTypeRequestDto> {
    const errors: ValidationError[] = [];
    if (typeof input !== "object" || input === null) {
      return validationFailure([{ field: "body", message: "Request body must be an object" }]);
    }
    const record = input as Record<string, unknown>;
    if (record.name !== undefined) {
      if (typeof record.name !== "string" || !record.name.trim()) {
        errors.push({ field: "name", message: "Product type name cannot be empty" });
      } else if (record.name.trim().length > 100) {
        errors.push({ field: "name", message: "Product type name cannot exceed 100 characters" });
      }
    }
    if (record.slug !== undefined && (typeof record.slug !== "string" || !record.slug.trim())) {
      errors.push({ field: "slug", message: "Slug must be a non-empty string" });
    }
    if (errors.length > 0) return validationFailure(errors);
    return validationSuccess({
      name: record.name !== undefined ? (record.name as string).trim() : undefined,
      slug: record.slug !== undefined ? (record.slug as string).trim() : undefined,
    });
  },
};

export interface CreateCategoryRequestDto {
  name: string;
  slug?: string;
  description?: string | null;
  parentId?: string | null;
  position?: number;
}

export const createCategoryValidator: Validator<CreateCategoryRequestDto> = {
  validate(input: unknown): ValidationResult<CreateCategoryRequestDto> {
    const errors: ValidationError[] = [];
    if (typeof input !== "object" || input === null) {
      return validationFailure([{ field: "body", message: "Request body must be an object" }]);
    }
    const record = input as Record<string, unknown>;
    if (typeof record.name !== "string" || !record.name.trim()) {
      errors.push({ field: "name", message: "Category name is required" });
    } else if (record.name.trim().length > 100) {
      errors.push({ field: "name", message: "Category name cannot exceed 100 characters" });
    }
    if (record.slug !== undefined && (typeof record.slug !== "string" || !record.slug.trim())) {
      errors.push({ field: "slug", message: "Slug must be a non-empty string" });
    }
    if (record.parentId !== undefined && record.parentId !== null && typeof record.parentId !== "string") {
      errors.push({ field: "parentId", message: "parentId must be a string or null" });
    }
    if (errors.length > 0) return validationFailure(errors);
    return validationSuccess({
      name: (record.name as string).trim(),
      slug: record.slug !== undefined ? (record.slug as string).trim() : undefined,
      description: record.description !== undefined ? (record.description !== null ? String(record.description).trim() : null) : undefined,
      parentId: record.parentId !== undefined ? (record.parentId !== null ? String(record.parentId).trim() : null) : undefined,
      position: typeof record.position === "number" ? record.position : undefined,
    });
  },
};

export interface UpdateCategoryRequestDto {
  name?: string;
  slug?: string;
  description?: string | null;
  parentId?: string | null;
  position?: number;
}

export const updateCategoryValidator: Validator<UpdateCategoryRequestDto> = {
  validate(input: unknown): ValidationResult<UpdateCategoryRequestDto> {
    const errors: ValidationError[] = [];
    if (typeof input !== "object" || input === null) {
      return validationFailure([{ field: "body", message: "Request body must be an object" }]);
    }
    const record = input as Record<string, unknown>;
    if (record.name !== undefined) {
      if (typeof record.name !== "string" || !record.name.trim()) {
        errors.push({ field: "name", message: "Category name cannot be empty" });
      } else if (record.name.trim().length > 100) {
        errors.push({ field: "name", message: "Category name cannot exceed 100 characters" });
      }
    }
    if (record.slug !== undefined && (typeof record.slug !== "string" || !record.slug.trim())) {
      errors.push({ field: "slug", message: "Slug must be a non-empty string" });
    }
    if (record.parentId !== undefined && record.parentId !== null && typeof record.parentId !== "string") {
      errors.push({ field: "parentId", message: "parentId must be a string or null" });
    }
    if (errors.length > 0) return validationFailure(errors);
    return validationSuccess({
      name: record.name !== undefined ? (record.name as string).trim() : undefined,
      slug: record.slug !== undefined ? (record.slug as string).trim() : undefined,
      description: record.description !== undefined ? (record.description !== null ? String(record.description).trim() : null) : undefined,
      parentId: record.parentId !== undefined ? (record.parentId !== null ? String(record.parentId).trim() : null) : undefined,
      position: typeof record.position === "number" ? record.position : undefined,
    });
  },
};

export interface AddProductMediaRequestDto {
  url: string;
  altText?: string | null;
  position?: number;
}

export const addProductMediaValidator: Validator<AddProductMediaRequestDto> = {
  validate(input: unknown): ValidationResult<AddProductMediaRequestDto> {
    const errors: ValidationError[] = [];
    if (typeof input !== "object" || input === null) {
      return validationFailure([{ field: "body", message: "Request body must be an object" }]);
    }
    const record = input as Record<string, unknown>;
    if (typeof record.url !== "string" || !record.url.trim()) {
      errors.push({ field: "url", message: "Media URL is required" });
    }
    if (errors.length > 0) return validationFailure(errors);
    return validationSuccess({
      url: (record.url as string).trim(),
      altText: record.altText !== undefined ? (record.altText !== null ? String(record.altText).trim() : null) : undefined,
      position: typeof record.position === "number" ? record.position : undefined,
    });
  },
};

export interface ReorderProductMediaRequestDto {
  mediaIds: string[];
}

export const reorderProductMediaValidator: Validator<ReorderProductMediaRequestDto> = {
  validate(input: unknown): ValidationResult<ReorderProductMediaRequestDto> {
    const errors: ValidationError[] = [];
    if (typeof input !== "object" || input === null) {
      return validationFailure([{ field: "body", message: "Request body must be an object" }]);
    }
    const record = input as Record<string, unknown>;
    if (!Array.isArray(record.mediaIds) || record.mediaIds.length === 0) {
      errors.push({ field: "mediaIds", message: "mediaIds must be a non-empty array of IDs" });
    }
    if (errors.length > 0) return validationFailure(errors);
    return validationSuccess({
      mediaIds: (record.mediaIds as unknown[]).map(String),
    });
  },
};

export interface CreateProductRequestDto {
  title: string;
  description?: string | null;
  slug?: string;
  status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
  price?: number;
  compareAtPrice?: number | null;
  sku?: string | null;
  currency?: string;
  lowStockThreshold?: number;
  maxOrderQuantity?: number | null;
  typeId?: string | null;
  categoryId?: string | null;
  tags?: string[];
  options?: Array<{
    name: string;
    position?: number;
    values: string[];
    isPublishable?: boolean;
    optionValues?: Array<{
      value: string;
      displayTitle?: string | null;
      isPublished?: boolean;
      position?: number;
      mediaIds?: string[];
      mediaIndexes?: number[];
    }>;
  }>;
  variants?: Array<{
    title?: string;
    displayTitle?: string | null;
    publishedAsProduct?: boolean;
    sku?: string | null;
    price: number;
    compareAtPrice?: number | null;
    position?: number;
    option1?: string | null;
    option2?: string | null;
    option3?: string | null;
    imageId?: string | null;
    mediaIndex?: number | null;
    mediaIndexes?: number[];
    mediaIds?: string[];
    status?: "ACTIVE" | "INACTIVE" | "ARCHIVED";
    lowStockThreshold?: number | null;
    maxOrderQuantity?: number | null;
    inventoryQuantity?: number;
  }>;
  media?: Array<{
    url: string;
    altText?: string | null;
    position?: number;
  }>;
  collectionIds?: string[];
  codEnabled?: boolean;
}

export const createProductValidator: Validator<CreateProductRequestDto> = {
  validate(input: unknown): ValidationResult<CreateProductRequestDto> {
    const errors: ValidationError[] = [];

    if (typeof input !== "object" || input === null) {
      return validationFailure([
        { field: "body", message: "Request body must be an object" },
      ]);
    }

    const record = input as Record<string, unknown>;

    if (typeof record.title !== "string" || !record.title.trim()) {
      errors.push({
        field: "title",
        message: "Product title is required and cannot be empty",
      });
    } else if (record.title.trim().length > 255) {
      errors.push({
        field: "title",
        message: "Product title cannot exceed 255 characters",
      });
    }

    if (record.description !== undefined && record.description !== null) {
      if (typeof record.description !== "string") {
        errors.push({
          field: "description",
          message: "Product description must be a string",
        });
      }
    }

    if (record.slug !== undefined) {
      if (typeof record.slug !== "string" || !record.slug.trim()) {
        errors.push({
          field: "slug",
          message: "Product slug must be a non-empty string",
        });
      }
    }

    if (record.status !== undefined) {
      if (
        typeof record.status !== "string" ||
        !["DRAFT", "ACTIVE", "ARCHIVED"].includes(
          record.status.trim().toUpperCase(),
        )
      ) {
        errors.push({
          field: "status",
          message: "Status must be one of: DRAFT, ACTIVE, ARCHIVED",
        });
      }
    }

    if (record.price !== undefined) {
      if (
        typeof record.price !== "number" ||
        !Number.isInteger(record.price) ||
        record.price < 0
      ) {
        errors.push({
          field: "price",
          message: "Price must be a non-negative integer in minor units (e.g. cents)",
        });
      }
    }

    if (record.compareAtPrice !== undefined && record.compareAtPrice !== null) {
      if (
        typeof record.compareAtPrice !== "number" ||
        !Number.isInteger(record.compareAtPrice) ||
        record.compareAtPrice < 0
      ) {
        errors.push({
          field: "compareAtPrice",
          message:
            "Compare-at price must be a non-negative integer in minor units (e.g. cents)",
        });
      }
    }

    if (record.sku !== undefined && record.sku !== null) {
      if (typeof record.sku !== "string") {
        errors.push({
          field: "sku",
          message: "SKU must be a string",
        });
      } else if (record.sku.trim().length > 100) {
        errors.push({
          field: "sku",
          message: "SKU cannot exceed 100 characters",
        });
      }
    }


    if (record.lowStockThreshold !== undefined) {
      if (
        typeof record.lowStockThreshold !== "number" ||
        !Number.isInteger(record.lowStockThreshold) ||
        record.lowStockThreshold < 0
      ) {
        errors.push({
          field: "lowStockThreshold",
          message: "Low stock threshold must be a non-negative integer",
        });
      }
    }

    if (record.codEnabled !== undefined && typeof record.codEnabled !== "boolean") {
      errors.push({
        field: "codEnabled",
        message: "codEnabled must be a boolean",
      });
    }

    if (record.codEnabled !== undefined && typeof record.codEnabled !== "boolean") {
      errors.push({
        field: "codEnabled",
        message: "codEnabled must be a boolean",
      });
    }

    if (record.maxOrderQuantity !== undefined && record.maxOrderQuantity !== null) {
      if (
        typeof record.maxOrderQuantity !== "number" ||
        !Number.isInteger(record.maxOrderQuantity) ||
        record.maxOrderQuantity <= 0
      ) {
        errors.push({
          field: "maxOrderQuantity",
          message: "Maximum order quantity must be a positive integer",
        });
      }
    }

    if (record.variants !== undefined) {
      if (!Array.isArray(record.variants)) {
        errors.push({
          field: "variants",
          message: "Variants must be an array",
        });
      } else {
        record.variants.forEach((v, index) => {
          if (typeof v !== "object" || v === null) {
            errors.push({
              field: `variants[${index}]`,
              message: "Variant item must be an object",
            });
            return;
          }
          const vRecord = v as Record<string, unknown>;
          if (
            typeof vRecord.price !== "number" ||
            !Number.isInteger(vRecord.price) ||
            vRecord.price < 0
          ) {
            errors.push({
              field: `variants[${index}].price`,
              message: "Variant price must be a non-negative integer in minor units",
            });
          }
          if (
            vRecord.compareAtPrice !== undefined &&
            vRecord.compareAtPrice !== null &&
            (typeof vRecord.compareAtPrice !== "number" ||
              !Number.isInteger(vRecord.compareAtPrice) ||
              vRecord.compareAtPrice < 0)
          ) {
            errors.push({
              field: `variants[${index}].compareAtPrice`,
              message:
                "Variant compare-at price must be a non-negative integer in minor units",
            });
          }
          if (
            vRecord.lowStockThreshold !== undefined &&
            vRecord.lowStockThreshold !== null &&
            (typeof vRecord.lowStockThreshold !== "number" ||
              !Number.isInteger(vRecord.lowStockThreshold) ||
              vRecord.lowStockThreshold < 0)
          ) {
            errors.push({
              field: `variants[${index}].lowStockThreshold`,
              message: "Variant low stock threshold must be a non-negative integer",
            });
          }
          if (
            vRecord.mediaIndex !== undefined &&
            vRecord.mediaIndex !== null &&
            (typeof vRecord.mediaIndex !== "number" ||
              !Number.isInteger(vRecord.mediaIndex) ||
              vRecord.mediaIndex < 0)
          ) {
            errors.push({
              field: `variants[${index}].mediaIndex`,
              message: "Variant media index must be a non-negative integer",
            });
          }
          if (
            vRecord.maxOrderQuantity !== undefined &&
            vRecord.maxOrderQuantity !== null &&
            (typeof vRecord.maxOrderQuantity !== "number" ||
              !Number.isInteger(vRecord.maxOrderQuantity) ||
              vRecord.maxOrderQuantity <= 0)
          ) {
            errors.push({
              field: `variants[${index}].maxOrderQuantity`,
              message: "Variant maximum order quantity must be a positive integer",
            });
          }
          if (
            vRecord.displayTitle !== undefined &&
            vRecord.displayTitle !== null &&
            typeof vRecord.displayTitle !== "string"
          ) {
            errors.push({
              field: `variants[${index}].displayTitle`,
              message: "Variant display title must be a string",
            });
          }
          if (
            vRecord.publishedAsProduct !== undefined &&
            typeof vRecord.publishedAsProduct !== "boolean"
          ) {
            errors.push({
              field: `variants[${index}].publishedAsProduct`,
              message: "Variant publishedAsProduct must be a boolean",
            });
          }
          if (
            vRecord.mediaIndexes !== undefined &&
            (!Array.isArray(vRecord.mediaIndexes) ||
              vRecord.mediaIndexes.some((idx) => typeof idx !== "number" || !Number.isInteger(idx) || idx < 0))
          ) {
            errors.push({
              field: `variants[${index}].mediaIndexes`,
              message: "Variant mediaIndexes must be an array of non-negative integers",
            });
          }
          if (
            vRecord.mediaIds !== undefined &&
            (!Array.isArray(vRecord.mediaIds) || vRecord.mediaIds.some((id) => typeof id !== "string"))
          ) {
            errors.push({
              field: `variants[${index}].mediaIds`,
              message: "Variant mediaIds must be an array of strings",
            });
          }
        });
      }
    }

    if (record.media !== undefined) {
      if (!Array.isArray(record.media)) {
        errors.push({
          field: "media",
          message: "Media must be an array",
        });
      } else {
        record.media.forEach((m, index) => {
          if (typeof m !== "object" || m === null) {
            errors.push({
              field: `media[${index}]`,
              message: "Media item must be an object",
            });
            return;
          }
          const mRecord = m as Record<string, unknown>;
          if (typeof mRecord.url !== "string" || !mRecord.url.trim()) {
            errors.push({
              field: `media[${index}].url`,
              message: "Media URL is required",
            });
          }
        });
      }
    }

    if (record.typeId !== undefined && record.typeId !== null) {
      if (typeof record.typeId !== "string" || !record.typeId.trim()) {
        errors.push({
          field: "typeId",
          message: "Product type ID must be a valid non-empty string or null",
        });
      }
    }

    if (record.categoryId !== undefined && record.categoryId !== null) {
      if (typeof record.categoryId !== "string" || !record.categoryId.trim()) {
        errors.push({
          field: "categoryId",
          message: "Category ID must be a valid non-empty string or null",
        });
      }
    }

    if (record.tags !== undefined) {
      if (!Array.isArray(record.tags)) {
        errors.push({
          field: "tags",
          message: "Tags must be an array of strings",
        });
      } else {
        for (let i = 0; i < record.tags.length; i++) {
          if (typeof record.tags[i] !== "string") {
            errors.push({
              field: `tags[${i}]`,
              message: "Each tag must be a string",
            });
            break;
          }
        }
      }
    }

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({
      title: (record.title as string).trim(),
      description:
        record.description !== undefined
          ? record.description !== null
            ? (record.description as string).trim()
            : null
          : undefined,
      slug:
        record.slug !== undefined
          ? (record.slug as string).trim()
          : undefined,
      status:
        record.status !== undefined
          ? ((record.status as string).trim().toUpperCase() as
              "DRAFT" | "ACTIVE" | "ARCHIVED")
          : undefined,
      price: record.price !== undefined ? (record.price as number) : undefined,
      compareAtPrice:
        record.compareAtPrice !== undefined
          ? record.compareAtPrice !== null
            ? (record.compareAtPrice as number)
            : null
          : undefined,
      sku:
        record.sku !== undefined
          ? record.sku !== null
            ? (record.sku as string).trim() || null
            : null
          : undefined,
      currency:
        record.currency !== undefined
          ? (record.currency as string).trim().toUpperCase()
          : undefined,
      lowStockThreshold:
        record.lowStockThreshold !== undefined
          ? (record.lowStockThreshold as number)
          : undefined,
      maxOrderQuantity:
        record.maxOrderQuantity !== undefined
          ? (record.maxOrderQuantity as number | null)
          : undefined,
      typeId:
        record.typeId !== undefined
          ? record.typeId !== null
            ? (record.typeId as string).trim() || null
            : null
          : undefined,
      categoryId:
        record.categoryId !== undefined
          ? record.categoryId !== null
            ? (record.categoryId as string).trim() || null
            : null
          : undefined,
      tags:
        record.tags !== undefined
          ? (record.tags as string[]).map((t) => t.trim()).filter(Boolean)
          : undefined,
      options: Array.isArray(record.options)
        ? (record.options as Array<{
            name: string;
            position?: number;
            values: string[];
            isPublishable?: boolean;
            optionValues?: Array<{
              value: string;
              displayTitle?: string | null;
              isPublished?: boolean;
              position?: number;
              mediaIds?: string[];
              mediaIndexes?: number[];
            }>;
          }>).map((opt, i) => ({
            name: String(opt.name || "").trim(),
            position: typeof opt.position === "number" ? opt.position : i,
            values: Array.isArray(opt.values)
              ? opt.values.map(String).map((v) => v.trim()).filter(Boolean)
              : [],
            isPublishable: Boolean(opt.isPublishable),
            optionValues: Array.isArray(opt.optionValues)
              ? opt.optionValues.map((ov, vIdx) => ({
                  value: String(ov.value).trim(),
                  displayTitle: ov.displayTitle ? String(ov.displayTitle).trim() : null,
                  isPublished: ov.isPublished !== undefined ? Boolean(ov.isPublished) : true,
                  position: typeof ov.position === "number" ? ov.position : vIdx,
                  mediaIds: Array.isArray(ov.mediaIds) ? ov.mediaIds.map(String) : [],
                  mediaIndexes: Array.isArray(ov.mediaIndexes) ? ov.mediaIndexes.map(Number) : [],
                }))
              : undefined,
          }))
        : undefined,
      variants: record.variants as CreateProductRequestDto["variants"],
      media: record.media as CreateProductRequestDto["media"],
      codEnabled: record.codEnabled !== undefined ? Boolean(record.codEnabled) : undefined,
    });
  },
};

export interface UpdateProductRequestDto {
  title?: string;
  description?: string | null;
  slug?: string;
  status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
  lowStockThreshold?: number;
  maxOrderQuantity?: number | null;
  typeId?: string | null;
  categoryId?: string | null;
  tags?: string[];
  options?: Array<{
    name: string;
    position?: number;
    values: string[];
    isPublishable?: boolean;
    optionValues?: Array<{
      value: string;
      displayTitle?: string | null;
      isPublished?: boolean;
      position?: number;
      mediaIds?: string[];
      mediaIndexes?: number[];
    }>;
  }>;
  variants?: Array<{
    id?: string;
    title?: string;
    displayTitle?: string | null;
    publishedAsProduct?: boolean;
    sku?: string | null;
    price: number;
    compareAtPrice?: number | null;
    position?: number;
    option1?: string | null;
    option2?: string | null;
    option3?: string | null;
    imageId?: string | null;
    mediaIndex?: number | null;
    mediaIndexes?: number[];
    mediaIds?: string[];
    status?: "ACTIVE" | "INACTIVE" | "ARCHIVED";
    lowStockThreshold?: number | null;
    maxOrderQuantity?: number | null;
    inventoryQuantity?: number;
  }>;
  media?: Array<{
    id?: string;
    url: string;
    altText?: string | null;
    position?: number;
  }>;
  collectionIds?: string[];
  codEnabled?: boolean;
}

export const updateProductValidator: Validator<UpdateProductRequestDto> = {
  validate(input: unknown): ValidationResult<UpdateProductRequestDto> {
    const errors: ValidationError[] = [];

    if (typeof input !== "object" || input === null) {
      return validationFailure([
        { field: "body", message: "Request body must be an object" },
      ]);
    }

    const record = input as Record<string, unknown>;

    if (record.title !== undefined) {
      if (typeof record.title !== "string" || !record.title.trim()) {
        errors.push({
          field: "title",
          message: "Product title must be a non-empty string",
        });
      } else if (record.title.trim().length > 255) {
        errors.push({
          field: "title",
          message: "Product title cannot exceed 255 characters",
        });
      }
    }

    if (record.status !== undefined) {
      if (
        typeof record.status !== "string" ||
        !["DRAFT", "ACTIVE", "ARCHIVED"].includes(
          record.status.trim().toUpperCase(),
        )
      ) {
        errors.push({
          field: "status",
          message: "Status must be one of: DRAFT, ACTIVE, ARCHIVED",
        });
      }
    }

    if (record.media !== undefined) {
      if (!Array.isArray(record.media)) {
        errors.push({
          field: "media",
          message: "Media must be an array",
        });
      } else {
        record.media.forEach((m, index) => {
          if (typeof m !== "object" || m === null) {
            errors.push({
              field: `media[${index}]`,
              message: "Media item must be an object",
            });
            return;
          }
          const mRecord = m as Record<string, unknown>;
          if (typeof mRecord.url !== "string" || !mRecord.url.trim()) {
            errors.push({
              field: `media[${index}].url`,
              message: "Media URL is required",
            });
          }
        });
      }
    }

    if (record.description !== undefined && record.description !== null) {
      if (typeof record.description !== "string") {
        errors.push({
          field: "description",
          message: "Product description must be a string",
        });
      }
    }

    if (record.slug !== undefined) {
      if (typeof record.slug !== "string" || !record.slug.trim()) {
        errors.push({
          field: "slug",
          message: "Product slug must be a non-empty string",
        });
      }
    }

    if (record.lowStockThreshold !== undefined) {
      if (
        typeof record.lowStockThreshold !== "number" ||
        !Number.isInteger(record.lowStockThreshold) ||
        record.lowStockThreshold < 0
      ) {
        errors.push({
          field: "lowStockThreshold",
          message: "Low stock threshold must be a non-negative integer",
        });
      }
    }

    if (record.maxOrderQuantity !== undefined && record.maxOrderQuantity !== null) {
      if (
        typeof record.maxOrderQuantity !== "number" ||
        !Number.isInteger(record.maxOrderQuantity) ||
        record.maxOrderQuantity <= 0
      ) {
        errors.push({
          field: "maxOrderQuantity",
          message: "Maximum order quantity must be a positive integer",
        });
      }
    }

    if (record.typeId !== undefined && record.typeId !== null) {
      if (typeof record.typeId !== "string" || !record.typeId.trim()) {
        errors.push({
          field: "typeId",
          message: "Product type ID must be a valid non-empty string or null",
        });
      }
    }

    if (record.categoryId !== undefined && record.categoryId !== null) {
      if (typeof record.categoryId !== "string" || !record.categoryId.trim()) {
        errors.push({
          field: "categoryId",
          message: "Category ID must be a valid non-empty string or null",
        });
      }
    }

    if (record.tags !== undefined) {
      if (!Array.isArray(record.tags)) {
        errors.push({
          field: "tags",
          message: "Tags must be an array of strings",
        });
      } else {
        for (let i = 0; i < record.tags.length; i++) {
          if (typeof record.tags[i] !== "string") {
            errors.push({
              field: `tags[${i}]`,
              message: "Each tag must be a string",
            });
            break;
          }
        }
      }
    }

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({
      title:
        record.title !== undefined
          ? (record.title as string).trim()
          : undefined,
      description:
        record.description !== undefined
          ? record.description !== null
            ? (record.description as string).trim()
            : null
          : undefined,
      slug:
        record.slug !== undefined
          ? (record.slug as string).trim()
          : undefined,
      lowStockThreshold:
        record.lowStockThreshold !== undefined
          ? (record.lowStockThreshold as number)
          : undefined,
      maxOrderQuantity:
        record.maxOrderQuantity !== undefined
          ? (record.maxOrderQuantity as number | null)
          : undefined,
      typeId:
        record.typeId !== undefined
          ? record.typeId !== null
            ? (record.typeId as string).trim() || null
            : null
          : undefined,
      categoryId:
        record.categoryId !== undefined
          ? record.categoryId !== null
            ? (record.categoryId as string).trim() || null
            : null
          : undefined,
      tags:
        record.tags !== undefined
          ? (record.tags as string[]).map((t) => t.trim()).filter(Boolean)
          : undefined,
      status:
        record.status !== undefined
          ? ((record.status as string).trim().toUpperCase() as
              "DRAFT" | "ACTIVE" | "ARCHIVED")
          : undefined,
      options: Array.isArray(record.options)
        ? (record.options as Array<{
            name: string;
            position?: number;
            values: string[];
            isPublishable?: boolean;
            optionValues?: Array<{
              value: string;
              displayTitle?: string | null;
              isPublished?: boolean;
              position?: number;
              mediaIds?: string[];
              mediaIndexes?: number[];
            }>;
          }>).map((opt, i) => ({
            name: String(opt.name || "").trim(),
            position: typeof opt.position === "number" ? opt.position : i,
            values: Array.isArray(opt.values)
              ? opt.values.map(String).map((v) => v.trim()).filter(Boolean)
              : [],
            isPublishable: Boolean(opt.isPublishable),
            optionValues: Array.isArray(opt.optionValues)
              ? opt.optionValues.map((ov, vIdx) => ({
                  value: String(ov.value).trim(),
                  displayTitle: ov.displayTitle ? String(ov.displayTitle).trim() : null,
                  isPublished: ov.isPublished !== undefined ? Boolean(ov.isPublished) : true,
                  position: typeof ov.position === "number" ? ov.position : vIdx,
                  mediaIds: Array.isArray(ov.mediaIds) ? ov.mediaIds.map(String) : [],
                  mediaIndexes: Array.isArray(ov.mediaIndexes) ? ov.mediaIndexes.map(Number) : [],
                }))
              : undefined,
          }))
        : undefined,
      variants: record.variants as UpdateProductRequestDto["variants"],
      media: record.media as UpdateProductRequestDto["media"],
      codEnabled: record.codEnabled !== undefined ? Boolean(record.codEnabled) : undefined,
    });
  },
};

export interface ListProductsQueryDto {
  limit?: number;
  cursor?: string;
  status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
  typeId?: string;
  categoryId?: string;
  tag?: string;
  tags?: string[];
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  includeStandaloneVariants?: boolean;
}

export const listProductsQueryValidator: Validator<ListProductsQueryDto> = {
  validate(input: unknown): ValidationResult<ListProductsQueryDto> {
    const errors: ValidationError[] = [];
    const record = (typeof input === "object" && input !== null ? input : {}) as Record<
      string,
      unknown
    >;

    let limit: number | undefined;
    if (record.limit !== undefined && record.limit !== "") {
      const parsed = Number(record.limit);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
        errors.push({
          field: "limit",
          message: "Limit must be an integer between 1 and 100",
        });
      } else {
        limit = parsed;
      }
    }

    let status: "DRAFT" | "ACTIVE" | "ARCHIVED" | undefined;
    if (record.status !== undefined && record.status !== "") {
      const raw = String(record.status).trim().toUpperCase();
      if (!["DRAFT", "ACTIVE", "ARCHIVED"].includes(raw)) {
        errors.push({
          field: "status",
          message: "Status must be one of: DRAFT, ACTIVE, ARCHIVED",
        });
      } else {
        status = raw as "DRAFT" | "ACTIVE" | "ARCHIVED";
      }
    }

    const cursor =
      record.cursor !== undefined && String(record.cursor).trim().length > 0
        ? String(record.cursor).trim()
        : undefined;

    const typeId =
      record.typeId !== undefined && String(record.typeId).trim().length > 0
        ? String(record.typeId).trim()
        : undefined;

    const categoryId =
      record.categoryId !== undefined && String(record.categoryId).trim().length > 0
        ? String(record.categoryId).trim()
        : undefined;

    const tag =
      record.tag !== undefined && String(record.tag).trim().length > 0
        ? String(record.tag).trim()
        : undefined;

    let tags: string[] | undefined;
    if (record.tags !== undefined) {
      if (Array.isArray(record.tags)) {
        tags = (record.tags as unknown[]).map(String).map((s) => s.trim()).filter(Boolean);
      } else if (typeof record.tags === "string" && record.tags.trim()) {
        tags = record.tags.split(",").map((s) => s.trim()).filter(Boolean);
      }
    }

    const search =
      record.search !== undefined && String(record.search).trim().length > 0
        ? String(record.search).trim()
        : undefined;

    let minPrice: number | undefined;
    if (record.minPrice !== undefined && record.minPrice !== "") {
      const parsed = Number(record.minPrice);
      if (isNaN(parsed) || parsed < 0) {
        errors.push({ field: "minPrice", message: "minPrice must be a non-negative number" });
      } else {
        minPrice = Math.round(parsed);
      }
    }

    let maxPrice: number | undefined;
    if (record.maxPrice !== undefined && record.maxPrice !== "") {
      const parsed = Number(record.maxPrice);
      if (isNaN(parsed) || parsed < 0) {
        errors.push({ field: "maxPrice", message: "maxPrice must be a non-negative number" });
      } else {
        maxPrice = Math.round(parsed);
      }
    }

    let inStock: boolean | undefined;
    if (record.inStock !== undefined && record.inStock !== "") {
      inStock = record.inStock === true || record.inStock === "true" || record.inStock === "1";
    }

    let includeStandaloneVariants: boolean | undefined;
    if (record.includeStandaloneVariants !== undefined && record.includeStandaloneVariants !== "") {
      includeStandaloneVariants =
        record.includeStandaloneVariants === true ||
        record.includeStandaloneVariants === "true" ||
        record.includeStandaloneVariants === "1";
    }

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({
      limit,
      cursor,
      status,
      typeId,
      categoryId,
      tag,
      tags,
      search,
      minPrice,
      maxPrice,
      inStock,
      includeStandaloneVariants,
    });
  },
};

export interface CreateVariantRequestDto {
  title: string;
  displayTitle?: string | null;
  publishedAsProduct?: boolean;
  price: number;
  compareAtPrice?: number | null;
  sku?: string | null;
  position?: number;
  status?: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
  imageId?: string | null;
  mediaIndexes?: number[];
  mediaIds?: string[];
  lowStockThreshold?: number | null;
  maxOrderQuantity?: number | null;
  inventoryQuantity?: number;
}

export const createVariantValidator: Validator<CreateVariantRequestDto> = {
  validate(input: unknown): ValidationResult<CreateVariantRequestDto> {
    const errors: ValidationError[] = [];

    if (typeof input !== "object" || input === null) {
      return validationFailure([
        { field: "body", message: "Request body must be an object" },
      ]);
    }

    const record = input as Record<string, unknown>;

    if (typeof record.title !== "string" || !record.title.trim()) {
      errors.push({
        field: "title",
        message: "Variant title is required",
      });
    }

    if (
      typeof record.price !== "number" ||
      !Number.isInteger(record.price) ||
      record.price < 0
    ) {
      errors.push({
        field: "price",
        message: "Price must be a non-negative integer in minor units (e.g. cents)",
      });
    }

    if (record.compareAtPrice !== undefined && record.compareAtPrice !== null) {
      if (
        typeof record.compareAtPrice !== "number" ||
        !Number.isInteger(record.compareAtPrice) ||
        record.compareAtPrice < 0
      ) {
        errors.push({
          field: "compareAtPrice",
          message: "Compare-at price must be a non-negative integer in minor units",
        });
      }
    }

    if (record.sku !== undefined && record.sku !== null) {
      if (typeof record.sku !== "string") {
        errors.push({
          field: "sku",
          message: "SKU must be a string",
        });
      } else if (record.sku.trim().length > 100) {
        errors.push({
          field: "sku",
          message: "SKU cannot exceed 100 characters",
        });
      }
    }

    if (record.position !== undefined) {
      if (typeof record.position !== "number" || !Number.isInteger(record.position)) {
        errors.push({
          field: "position",
          message: "Position must be an integer",
        });
      }
    }

    if (record.lowStockThreshold !== undefined && record.lowStockThreshold !== null) {
      if (
        typeof record.lowStockThreshold !== "number" ||
        !Number.isInteger(record.lowStockThreshold) ||
        record.lowStockThreshold < 0
      ) {
        errors.push({
          field: "lowStockThreshold",
          message: "Low stock threshold must be a non-negative integer",
        });
      }
    }

    if (record.maxOrderQuantity !== undefined && record.maxOrderQuantity !== null) {
      if (
        typeof record.maxOrderQuantity !== "number" ||
        !Number.isInteger(record.maxOrderQuantity) ||
        record.maxOrderQuantity <= 0
      ) {
        errors.push({
          field: "maxOrderQuantity",
          message: "Maximum order quantity must be a positive integer",
        });
      }
    }

    if (
      record.displayTitle !== undefined &&
      record.displayTitle !== null &&
      typeof record.displayTitle !== "string"
    ) {
      errors.push({
        field: "displayTitle",
        message: "displayTitle must be a string",
      });
    }

    if (
      record.publishedAsProduct !== undefined &&
      typeof record.publishedAsProduct !== "boolean"
    ) {
      errors.push({
        field: "publishedAsProduct",
        message: "publishedAsProduct must be a boolean",
      });
    }

    if (
      record.mediaIndexes !== undefined &&
      (!Array.isArray(record.mediaIndexes) ||
        record.mediaIndexes.some((idx) => typeof idx !== "number" || !Number.isInteger(idx) || idx < 0))
    ) {
      errors.push({
        field: "mediaIndexes",
        message: "mediaIndexes must be an array of non-negative integers",
      });
    }

    if (
      record.mediaIds !== undefined &&
      (!Array.isArray(record.mediaIds) || record.mediaIds.some((id) => typeof id !== "string"))
    ) {
      errors.push({
        field: "mediaIds",
        message: "mediaIds must be an array of strings",
      });
    }

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({
      title: (record.title as string).trim(),
      displayTitle:
        record.displayTitle !== undefined && record.displayTitle !== null
          ? String(record.displayTitle).trim() || null
          : undefined,
      publishedAsProduct:
        record.publishedAsProduct !== undefined
          ? Boolean(record.publishedAsProduct)
          : undefined,
      mediaIndexes: Array.isArray(record.mediaIndexes) ? record.mediaIndexes : undefined,
      mediaIds: Array.isArray(record.mediaIds) ? record.mediaIds : undefined,
      price: record.price as number,
      compareAtPrice:
        record.compareAtPrice !== undefined
          ? record.compareAtPrice !== null
            ? (record.compareAtPrice as number)
            : null
          : undefined,
      sku:
        record.sku !== undefined
          ? record.sku !== null
            ? (record.sku as string).trim() || null
            : null
          : undefined,
      position:
        record.position !== undefined ? (record.position as number) : undefined,
      status:
        record.status !== undefined
          ? ((record.status as string).trim().toUpperCase() as "ACTIVE" | "INACTIVE" | "ARCHIVED")
          : undefined,
      option1:
        record.option1 !== undefined
          ? record.option1 !== null
            ? String(record.option1).trim()
            : null
          : undefined,
      option2:
        record.option2 !== undefined
          ? record.option2 !== null
            ? String(record.option2).trim()
            : null
          : undefined,
      option3:
        record.option3 !== undefined
          ? record.option3 !== null
            ? String(record.option3).trim()
            : null
          : undefined,
      imageId:
        record.imageId !== undefined
          ? record.imageId !== null
            ? String(record.imageId).trim()
            : null
          : undefined,
      inventoryQuantity:
        typeof record.inventoryQuantity === "number" && Number.isInteger(record.inventoryQuantity)
          ? Math.max(0, record.inventoryQuantity)
          : undefined,
      lowStockThreshold:
        record.lowStockThreshold !== undefined
          ? (record.lowStockThreshold as number | null)
          : undefined,
      maxOrderQuantity:
        record.maxOrderQuantity !== undefined
          ? (record.maxOrderQuantity as number | null)
          : undefined,
    });
  },
};

export interface UpdateVariantRequestDto {
  title?: string;
  displayTitle?: string | null;
  publishedAsProduct?: boolean;
  price?: number;
  compareAtPrice?: number | null;
  sku?: string | null;
  position?: number;
  status?: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
  imageId?: string | null;
  mediaIndexes?: number[];
  mediaIds?: string[];
  lowStockThreshold?: number | null;
  maxOrderQuantity?: number | null;
  inventoryQuantity?: number;
}

export const updateVariantValidator: Validator<UpdateVariantRequestDto> = {
  validate(input: unknown): ValidationResult<UpdateVariantRequestDto> {
    const errors: ValidationError[] = [];

    if (typeof input !== "object" || input === null) {
      return validationFailure([
        { field: "body", message: "Request body must be an object" },
      ]);
    }

    const record = input as Record<string, unknown>;

    if (record.title !== undefined) {
      if (typeof record.title !== "string" || !record.title.trim()) {
        errors.push({
          field: "title",
          message: "Variant title must be a non-empty string",
        });
      }
    }

    if (record.price !== undefined) {
      if (
        typeof record.price !== "number" ||
        !Number.isInteger(record.price) ||
        record.price < 0
      ) {
        errors.push({
          field: "price",
          message: "Price must be a non-negative integer in minor units (e.g. cents)",
        });
      }
    }

    if (record.compareAtPrice !== undefined && record.compareAtPrice !== null) {
      if (
        typeof record.compareAtPrice !== "number" ||
        !Number.isInteger(record.compareAtPrice) ||
        record.compareAtPrice < 0
      ) {
        errors.push({
          field: "compareAtPrice",
          message: "Compare-at price must be a non-negative integer in minor units",
        });
      }
    }

    if (record.sku !== undefined && record.sku !== null) {
      if (typeof record.sku !== "string") {
        errors.push({
          field: "sku",
          message: "SKU must be a string",
        });
      } else if (record.sku.trim().length > 100) {
        errors.push({
          field: "sku",
          message: "SKU cannot exceed 100 characters",
        });
      }
    }

    if (record.position !== undefined) {
      if (typeof record.position !== "number" || !Number.isInteger(record.position)) {
        errors.push({
          field: "position",
          message: "Position must be an integer",
        });
      }
    }

    if (record.status !== undefined) {
      if (
        typeof record.status !== "string" ||
        !["ACTIVE", "INACTIVE", "ARCHIVED"].includes(
          record.status.trim().toUpperCase(),
        )
      ) {
        errors.push({
          field: "status",
          message: "Status must be one of: ACTIVE, INACTIVE, ARCHIVED",
        });
      }
    }

    if (record.lowStockThreshold !== undefined && record.lowStockThreshold !== null) {
      if (
        typeof record.lowStockThreshold !== "number" ||
        !Number.isInteger(record.lowStockThreshold) ||
        record.lowStockThreshold < 0
      ) {
        errors.push({
          field: "lowStockThreshold",
          message: "Low stock threshold must be a non-negative integer",
        });
      }
    }

    if (record.maxOrderQuantity !== undefined && record.maxOrderQuantity !== null) {
      if (
        typeof record.maxOrderQuantity !== "number" ||
        !Number.isInteger(record.maxOrderQuantity) ||
        record.maxOrderQuantity <= 0
      ) {
        errors.push({
          field: "maxOrderQuantity",
          message: "Maximum order quantity must be a positive integer",
        });
      }
    }

    if (
      record.displayTitle !== undefined &&
      record.displayTitle !== null &&
      typeof record.displayTitle !== "string"
    ) {
      errors.push({
        field: "displayTitle",
        message: "displayTitle must be a string",
      });
    }

    if (
      record.publishedAsProduct !== undefined &&
      typeof record.publishedAsProduct !== "boolean"
    ) {
      errors.push({
        field: "publishedAsProduct",
        message: "publishedAsProduct must be a boolean",
      });
    }

    if (
      record.mediaIndexes !== undefined &&
      (!Array.isArray(record.mediaIndexes) ||
        record.mediaIndexes.some((idx) => typeof idx !== "number" || !Number.isInteger(idx) || idx < 0))
    ) {
      errors.push({
        field: "mediaIndexes",
        message: "mediaIndexes must be an array of non-negative integers",
      });
    }

    if (
      record.mediaIds !== undefined &&
      (!Array.isArray(record.mediaIds) || record.mediaIds.some((id) => typeof id !== "string"))
    ) {
      errors.push({
        field: "mediaIds",
        message: "mediaIds must be an array of strings",
      });
    }

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({
      title:
        record.title !== undefined
          ? (record.title as string).trim()
          : undefined,
      displayTitle:
        record.displayTitle !== undefined && record.displayTitle !== null
          ? String(record.displayTitle).trim() || null
          : undefined,
      publishedAsProduct:
        record.publishedAsProduct !== undefined
          ? Boolean(record.publishedAsProduct)
          : undefined,
      mediaIndexes: Array.isArray(record.mediaIndexes) ? record.mediaIndexes : undefined,
      mediaIds: Array.isArray(record.mediaIds) ? record.mediaIds : undefined,
      price: record.price !== undefined ? (record.price as number) : undefined,
      compareAtPrice:
        record.compareAtPrice !== undefined
          ? record.compareAtPrice !== null
            ? (record.compareAtPrice as number)
            : null
          : undefined,
      sku:
        record.sku !== undefined
          ? record.sku !== null
            ? (record.sku as string).trim() || null
            : null
          : undefined,
      position:
        record.position !== undefined ? (record.position as number) : undefined,
      status:
        record.status !== undefined
          ? ((record.status as string).trim().toUpperCase() as
              "ACTIVE" | "INACTIVE" | "ARCHIVED")
          : undefined,
      option1:
        record.option1 !== undefined
          ? record.option1 !== null
            ? String(record.option1).trim()
            : null
          : undefined,
      option2:
        record.option2 !== undefined
          ? record.option2 !== null
            ? String(record.option2).trim()
            : null
          : undefined,
      option3:
        record.option3 !== undefined
          ? record.option3 !== null
            ? String(record.option3).trim()
            : null
          : undefined,
      imageId:
        record.imageId !== undefined
          ? record.imageId !== null
            ? String(record.imageId).trim()
            : null
          : undefined,
      inventoryQuantity:
        typeof record.inventoryQuantity === "number" && Number.isInteger(record.inventoryQuantity)
          ? Math.max(0, record.inventoryQuantity)
          : undefined,
      lowStockThreshold:
        record.lowStockThreshold !== undefined
          ? (record.lowStockThreshold as number | null)
          : undefined,
      maxOrderQuantity:
        record.maxOrderQuantity !== undefined
          ? (record.maxOrderQuantity as number | null)
          : undefined,
    });
  },
};

export interface SetProductOptionsRequestDto {
  options: Array<{
    name: string;
    position?: number;
    values: string[];
    isPublishable?: boolean;
    optionValues?: Array<{
      value: string;
      displayTitle?: string | null;
      isPublished?: boolean;
      position?: number;
      mediaIds?: string[];
      mediaIndexes?: number[];
    }>;
  }>;
}

export const setProductOptionsValidator: Validator<SetProductOptionsRequestDto> = {
  validate(input: unknown): ValidationResult<SetProductOptionsRequestDto> {
    const errors: ValidationError[] = [];
    if (typeof input !== "object" || input === null) {
      return validationFailure([{ field: "body", message: "Request body must be an object" }]);
    }
    const record = input as Record<string, unknown>;
    if (!Array.isArray(record.options)) {
      errors.push({ field: "options", message: "Options must be an array" });
    } else {
      record.options.forEach((opt, idx) => {
        if (typeof opt !== "object" || opt === null) {
          errors.push({ field: `options[${idx}]`, message: "Option item must be an object" });
          return;
        }
        const optRecord = opt as Record<string, unknown>;
        if (typeof optRecord.name !== "string" || !optRecord.name.trim()) {
          errors.push({ field: `options[${idx}].name`, message: "Option name is required" });
        }
        if (!Array.isArray(optRecord.values) || optRecord.values.length === 0) {
          errors.push({ field: `options[${idx}].values`, message: "Option must have at least one value" });
        }
      });
    }
    if (errors.length > 0) return validationFailure(errors);
    return validationSuccess({
      options: (record.options as Array<{
        name: string;
        position?: number;
        values: string[];
        isPublishable?: boolean;
        optionValues?: Array<{
          value: string;
          displayTitle?: string | null;
          isPublished?: boolean;
          position?: number;
          mediaIds?: string[];
          mediaIndexes?: number[];
        }>;
      }>).map((opt, i) => ({
        name: opt.name.trim(),
        position: typeof opt.position === "number" ? opt.position : i,
        values: opt.values.map(String).map((v) => v.trim()).filter(Boolean),
        isPublishable: Boolean(opt.isPublishable),
        optionValues: Array.isArray(opt.optionValues)
          ? opt.optionValues.map((ov) => ({
              value: String(ov.value).trim(),
              displayTitle: ov.displayTitle ? String(ov.displayTitle).trim() : null,
              isPublished: ov.isPublished !== undefined ? Boolean(ov.isPublished) : true,
              position: typeof ov.position === "number" ? ov.position : 0,
              mediaIds: Array.isArray(ov.mediaIds) ? ov.mediaIds.map(String) : [],
              mediaIndexes: Array.isArray(ov.mediaIndexes) ? ov.mediaIndexes.map(Number) : [],
            }))
          : undefined,
      })),
    });
  },
};

export interface BatchUpdateVariantsRequestDto {
  variants: Array<{
    id: string;
    title?: string;
    price?: number;
    compareAtPrice?: number | null;
    sku?: string | null;
    position?: number;
    status?: "ACTIVE" | "INACTIVE" | "ARCHIVED";
    option1?: string | null;
    option2?: string | null;
    option3?: string | null;
    imageId?: string | null;
    lowStockThreshold?: number | null;
    maxOrderQuantity?: number | null;
    inventoryQuantity?: number;
  }>;
}

export const batchUpdateVariantsValidator: Validator<BatchUpdateVariantsRequestDto> = {
  validate(input: unknown): ValidationResult<BatchUpdateVariantsRequestDto> {
    const errors: ValidationError[] = [];
    if (typeof input !== "object" || input === null) {
      return validationFailure([{ field: "body", message: "Request body must be an object" }]);
    }
    const record = input as Record<string, unknown>;
    if (!Array.isArray(record.variants)) {
      errors.push({ field: "variants", message: "Variants must be an array" });
    } else {
      record.variants.forEach((v, idx) => {
        if (typeof v !== "object" || v === null) {
          errors.push({ field: `variants[${idx}]`, message: "Variant item must be an object" });
          return;
        }
        const vRecord = v as Record<string, unknown>;
        if (typeof vRecord.id !== "string" || !vRecord.id.trim()) {
          errors.push({ field: `variants[${idx}].id`, message: "Variant id is required" });
        }
      });
    }
    if (errors.length > 0) return validationFailure(errors);
    return validationSuccess({
      variants: record.variants as BatchUpdateVariantsRequestDto["variants"],
    });
  },
};

// ---------------------------------------------------------------------------
// Inventory & UUID Validators
// ---------------------------------------------------------------------------

export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value.trim());
}

export function validateUuid(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !UUID_REGEX.test(value.trim())) {
    throw new ApiHttpError(
      400,
      "VALIDATION_ERROR",
      `Invalid ${fieldName}: must be a valid UUID`,
      {
        fields: {
          [fieldName]: "Must be a valid UUID",
        },
      },
    );
  }
  return value.trim();
}

export interface AdjustInventoryRequestDto {
  quantityDelta: number;
  reason: AdjustmentReason;
  referenceType?: string | null;
  referenceId?: string | null;
}

export const adjustInventoryValidator: Validator<AdjustInventoryRequestDto> = {
  validate(input: unknown): ValidationResult<AdjustInventoryRequestDto> {
    const errors: ValidationError[] = [];

    if (typeof input !== "object" || input === null) {
      return validationFailure([
        { field: "body", message: "Request body must be an object" },
      ]);
    }

    const record = input as Record<string, unknown>;

    const rawDelta =
      record.quantityDelta !== undefined
        ? record.quantityDelta
        : record.quantity;

    if (rawDelta === undefined || rawDelta === null) {
      errors.push({
        field: "quantityDelta",
        message: "quantityDelta is required",
      });
    } else if (
      typeof rawDelta !== "number" ||
      !Number.isInteger(rawDelta) ||
      !Number.isFinite(rawDelta)
    ) {
      errors.push({
        field: "quantityDelta",
        message: "quantityDelta must be a whole integer",
      });
    } else if (rawDelta === 0) {
      errors.push({
        field: "quantityDelta",
        message: "quantityDelta cannot be zero",
      });
    }

    if (typeof record.reason !== "string" || !record.reason.trim()) {
      errors.push({
        field: "reason",
        message: "reason is required",
      });
    } else {
      const trimmedReason = record.reason.trim();
      const validReasons = [
        "INITIAL_STOCK",
        "RESTOCK",
        "MANUAL_CORRECTION",
        "DAMAGED",
        "LOST",
        "RETURNED",
        "OTHER",
      ];
      if (!validReasons.includes(trimmedReason)) {
        errors.push({
          field: "reason",
          message: `reason must be one of: ${validReasons.join(", ")}`,
        });
      }
    }

    if (record.referenceType !== undefined && record.referenceType !== null) {
      if (typeof record.referenceType !== "string" || !record.referenceType.trim()) {
        errors.push({
          field: "referenceType",
          message: "referenceType must be a non-empty string",
        });
      } else if (record.referenceType.trim().length > 255) {
        errors.push({
          field: "referenceType",
          message: "referenceType cannot exceed 255 characters",
        });
      }
    }

    if (record.referenceId !== undefined && record.referenceId !== null) {
      if (typeof record.referenceId !== "string" || !record.referenceId.trim()) {
        errors.push({
          field: "referenceId",
          message: "referenceId must be a non-empty string",
        });
      } else if (record.referenceId.trim().length > 255) {
        errors.push({
          field: "referenceId",
          message: "referenceId cannot exceed 255 characters",
        });
      }
    }

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({
      quantityDelta: rawDelta as number,
      reason: (record.reason as string).trim() as AdjustmentReason,
      referenceType:
        record.referenceType !== undefined && record.referenceType !== null
          ? (record.referenceType as string).trim()
          : null,
      referenceId:
        record.referenceId !== undefined && record.referenceId !== null
          ? (record.referenceId as string).trim()
          : null,
    });
  },
};

export interface CreateReservationRequestDto {
  variantId?: string;
  quantity?: number;
  items?: Array<{ variantId: string; quantity: number }>;
  referenceType?: string;
  referenceId?: string;
  expiresAt?: string | null;
}

export const createReservationValidator: Validator<CreateReservationRequestDto> = {
  validate(input: unknown): ValidationResult<CreateReservationRequestDto> {
    const errors: ValidationError[] = [];

    if (typeof input !== "object" || input === null) {
      return validationFailure([
        { field: "body", message: "Request body must be an object" },
      ]);
    }

    const record = input as Record<string, unknown>;

    const hasItems = Array.isArray(record.items);
    const hasSingle =
      record.variantId !== undefined || record.quantity !== undefined;

    if (!hasItems && !hasSingle) {
      errors.push({
        field: "items",
        message: "Must provide either variantId & quantity or items array",
      });
    }

    let validatedItems: Array<{ variantId: string; quantity: number }> | undefined;
    let validatedVariantId: string | undefined;
    let validatedQuantity: number | undefined;

    if (hasItems) {
      const rawItems = record.items as unknown[];
      if (rawItems.length === 0) {
        errors.push({
          field: "items",
          message: "items array cannot be empty",
        });
      } else {
        validatedItems = [];
        rawItems.forEach((item, index) => {
          if (typeof item !== "object" || item === null) {
            errors.push({
              field: `items[${index}]`,
              message: "Each item must be an object",
            });
            return;
          }
          const itemRec = item as Record<string, unknown>;
          if (
            typeof itemRec.variantId !== "string" ||
            !UUID_REGEX.test(itemRec.variantId.trim())
          ) {
            errors.push({
              field: `items[${index}].variantId`,
              message: "variantId must be a valid UUID",
            });
          }
          if (
            typeof itemRec.quantity !== "number" ||
            !Number.isInteger(itemRec.quantity) ||
            itemRec.quantity <= 0
          ) {
            errors.push({
              field: `items[${index}].quantity`,
              message: "quantity must be a positive integer greater than 0",
            });
          }
          if (
            typeof itemRec.variantId === "string" &&
            UUID_REGEX.test(itemRec.variantId.trim()) &&
            typeof itemRec.quantity === "number" &&
            Number.isInteger(itemRec.quantity) &&
            itemRec.quantity > 0
          ) {
            validatedItems!.push({
              variantId: itemRec.variantId.trim(),
              quantity: itemRec.quantity,
            });
          }
        });
      }
    } else {
      if (
        typeof record.variantId !== "string" ||
        !UUID_REGEX.test(record.variantId.trim())
      ) {
        errors.push({
          field: "variantId",
          message: "variantId must be a valid UUID",
        });
      } else {
        validatedVariantId = record.variantId.trim();
      }

      if (
        typeof record.quantity !== "number" ||
        !Number.isInteger(record.quantity) ||
        record.quantity <= 0
      ) {
        errors.push({
          field: "quantity",
          message: "quantity must be a positive integer greater than 0",
        });
      } else {
        validatedQuantity = record.quantity;
      }
    }

    if (record.referenceType !== undefined && record.referenceType !== null) {
      if (typeof record.referenceType !== "string" || !record.referenceType.trim()) {
        errors.push({
          field: "referenceType",
          message: "referenceType must be a non-empty string",
        });
      } else if (record.referenceType.trim().length > 255) {
        errors.push({
          field: "referenceType",
          message: "referenceType cannot exceed 255 characters",
        });
      }
    }

    if (record.referenceId !== undefined && record.referenceId !== null) {
      if (typeof record.referenceId !== "string" || !record.referenceId.trim()) {
        errors.push({
          field: "referenceId",
          message: "referenceId must be a non-empty string",
        });
      } else if (record.referenceId.trim().length > 255) {
        errors.push({
          field: "referenceId",
          message: "referenceId cannot exceed 255 characters",
        });
      }
    }

    let validatedExpiresAt: string | null | undefined;
    if (record.expiresAt !== undefined && record.expiresAt !== null) {
      if (
        typeof record.expiresAt !== "string" ||
        Number.isNaN(Date.parse(record.expiresAt))
      ) {
        errors.push({
          field: "expiresAt",
          message: "expiresAt must be a valid ISO 8601 date string",
        });
      } else {
        validatedExpiresAt = new Date(record.expiresAt).toISOString();
      }
    }

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({
      variantId: validatedVariantId,
      quantity: validatedQuantity,
      items: validatedItems,
      referenceType:
        record.referenceType !== undefined && record.referenceType !== null
          ? (record.referenceType as string).trim()
          : undefined,
      referenceId:
        record.referenceId !== undefined && record.referenceId !== null
          ? (record.referenceId as string).trim()
          : undefined,
      expiresAt: validatedExpiresAt,
    });
  },
};

export interface InventoryHistoryQueryDto {
  limit?: number;
}

export const inventoryHistoryQueryValidator: Validator<InventoryHistoryQueryDto> = {
  validate(input: unknown): ValidationResult<InventoryHistoryQueryDto> {
    const errors: ValidationError[] = [];
    if (typeof input !== "object" || input === null) {
      return validationSuccess({ limit: 50 });
    }

    const record = input as Record<string, unknown>;
    let limit = 50;

    if (record.limit !== undefined) {
      const parsedLimit = Number(record.limit);
      if (
        Number.isNaN(parsedLimit) ||
        !Number.isInteger(parsedLimit) ||
        parsedLimit < 1 ||
        parsedLimit > 100
      ) {
        errors.push({
          field: "limit",
          message: "limit must be an integer between 1 and 100",
        });
      } else {
        limit = parsedLimit;
      }
    }

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({ limit });
  },
};

export interface InventoryQueryDto {
  variantId?: string;
  itemId?: string;
  availability?: boolean;
  search?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export const inventoryQueryValidator: Validator<InventoryQueryDto> = {
  validate(input: unknown): ValidationResult<InventoryQueryDto> {
    const errors: ValidationError[] = [];
    if (typeof input !== "object" || input === null) {
      return validationSuccess({});
    }

    const record = input as Record<string, unknown>;
    let variantId: string | undefined;
    let itemId: string | undefined;
    let availability: boolean | undefined;
    let search: string | undefined;
    let status: string | undefined;
    let limit: number | undefined;
    let offset: number | undefined;

    if (record.variantId !== undefined) {
      if (
        typeof record.variantId !== "string" ||
        !UUID_REGEX.test(record.variantId.trim())
      ) {
        errors.push({
          field: "variantId",
          message: "variantId must be a valid UUID",
        });
      } else {
        variantId = record.variantId.trim();
      }
    }

    if (record.itemId !== undefined) {
      if (
        typeof record.itemId !== "string" ||
        !UUID_REGEX.test(record.itemId.trim())
      ) {
        errors.push({
          field: "itemId",
          message: "itemId must be a valid UUID",
        });
      } else {
        itemId = record.itemId.trim();
      }
    }

    if (record.availability !== undefined) {
      if (record.availability === "true" || record.availability === true) {
        availability = true;
      } else if (record.availability === "false" || record.availability === false) {
        availability = false;
      }
    }

    if (record.search !== undefined && record.search !== null) {
      if (typeof record.search !== "string") {
        errors.push({
          field: "search",
          message: "search must be a string",
        });
      } else {
        search = record.search.trim().slice(0, 100);
      }
    }

    if (record.status !== undefined && record.status !== null) {
      if (typeof record.status !== "string") {
        errors.push({
          field: "status",
          message: "status must be a string",
        });
      } else {
        status = record.status.trim().toLowerCase();
      }
    }

    if (record.limit !== undefined && record.limit !== null) {
      const parsedLimit = Number(record.limit);
      if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 200) {
        errors.push({
          field: "limit",
          message: "limit must be an integer between 1 and 200",
        });
      } else {
        limit = parsedLimit;
      }
    }

    if (record.offset !== undefined && record.offset !== null) {
      const parsedOffset = Number(record.offset);
      if (!Number.isInteger(parsedOffset) || parsedOffset < 0) {
        errors.push({
          field: "offset",
          message: "offset must be a non-negative integer",
        });
      } else {
        offset = parsedOffset;
      }
    }

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({
      variantId,
      itemId,
      availability,
      search,
      status,
      limit,
      offset,
    });
  },
};

// ==========================================
// Customers Domain Validators
// ==========================================

export interface CreateCustomerRequestDto {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  userId?: string | null;
}

export const createCustomerValidator: Validator<CreateCustomerRequestDto> = {
  validate(input: unknown): ValidationResult<CreateCustomerRequestDto> {
    const errors: ValidationError[] = [];

    if (typeof input !== "object" || input === null) {
      return validationFailure([
        { field: "body", message: "Request body must be an object" },
      ]);
    }

    const record = input as Record<string, unknown>;

    if (typeof record.email !== "string" || !record.email.trim()) {
      errors.push({ field: "email", message: "Customer email is required" });
    } else if (!isValidEmailFormat(record.email.trim())) {
      errors.push({ field: "email", message: "Invalid customer email address format" });
    } else if (record.email.trim().length > 255) {
      errors.push({ field: "email", message: "Customer email cannot exceed 255 characters" });
    }

    if (record.firstName !== undefined && record.firstName !== null) {
      if (typeof record.firstName !== "string") {
        errors.push({ field: "firstName", message: "First name must be a string" });
      } else if (record.firstName.trim().length > 100) {
        errors.push({ field: "firstName", message: "First name cannot exceed 100 characters" });
      }
    }

    if (record.lastName !== undefined && record.lastName !== null) {
      if (typeof record.lastName !== "string") {
        errors.push({ field: "lastName", message: "Last name must be a string" });
      } else if (record.lastName.trim().length > 100) {
        errors.push({ field: "lastName", message: "Last name cannot exceed 100 characters" });
      }
    }

    if (record.phone !== undefined && record.phone !== null) {
      if (typeof record.phone !== "string") {
        errors.push({ field: "phone", message: "Phone must be a string" });
      } else if (record.phone.trim().length > 50) {
        errors.push({ field: "phone", message: "Phone cannot exceed 50 characters" });
      }
    }

    if (record.userId !== undefined && record.userId !== null) {
      if (typeof record.userId !== "string" || !isValidUuid(record.userId)) {
        errors.push({ field: "userId", message: "User ID must be a valid UUID" });
      }
    }

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({
      email: (record.email as string).trim(),
      firstName: typeof record.firstName === "string" ? record.firstName.trim() || null : null,
      lastName: typeof record.lastName === "string" ? record.lastName.trim() || null : null,
      phone: typeof record.phone === "string" ? record.phone.trim() || null : null,
      userId: typeof record.userId === "string" ? record.userId.trim() : null,
    });
  },
};

export interface UpdateCustomerRequestDto {
  email?: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  status?: CustomerStatus;
  userId?: string | null;
}

export const updateCustomerValidator: Validator<UpdateCustomerRequestDto> = {
  validate(input: unknown): ValidationResult<UpdateCustomerRequestDto> {
    const errors: ValidationError[] = [];

    if (typeof input !== "object" || input === null) {
      return validationFailure([
        { field: "body", message: "Request body must be an object" },
      ]);
    }

    const record = input as Record<string, unknown>;

    if (record.email !== undefined) {
      if (typeof record.email !== "string" || !record.email.trim()) {
        errors.push({ field: "email", message: "Email cannot be empty" });
      } else if (!isValidEmailFormat(record.email.trim())) {
        errors.push({ field: "email", message: "Invalid customer email address format" });
      } else if (record.email.trim().length > 255) {
        errors.push({ field: "email", message: "Customer email cannot exceed 255 characters" });
      }
    }

    if (record.firstName !== undefined && record.firstName !== null) {
      if (typeof record.firstName !== "string") {
        errors.push({ field: "firstName", message: "First name must be a string" });
      } else if (record.firstName.trim().length > 100) {
        errors.push({ field: "firstName", message: "First name cannot exceed 100 characters" });
      }
    }

    if (record.lastName !== undefined && record.lastName !== null) {
      if (typeof record.lastName !== "string") {
        errors.push({ field: "lastName", message: "Last name must be a string" });
      } else if (record.lastName.trim().length > 100) {
        errors.push({ field: "lastName", message: "Last name cannot exceed 100 characters" });
      }
    }

    if (record.phone !== undefined && record.phone !== null) {
      if (typeof record.phone !== "string") {
        errors.push({ field: "phone", message: "Phone must be a string" });
      } else if (record.phone.trim().length > 50) {
        errors.push({ field: "phone", message: "Phone cannot exceed 50 characters" });
      }
    }

    if (record.status !== undefined) {
      if (!isValidCustomerStatus(record.status)) {
        errors.push({ field: "status", message: "Status must be 'ACTIVE' or 'DISABLED'" });
      }
    }

    if (record.userId !== undefined && record.userId !== null) {
      if (typeof record.userId !== "string" || !isValidUuid(record.userId)) {
        errors.push({ field: "userId", message: "User ID must be a valid UUID" });
      }
    }

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({
      email: typeof record.email === "string" ? record.email.trim() : undefined,
      firstName:
        record.firstName !== undefined
          ? typeof record.firstName === "string"
            ? record.firstName.trim() || null
            : null
          : undefined,
      lastName:
        record.lastName !== undefined
          ? typeof record.lastName === "string"
            ? record.lastName.trim() || null
            : null
          : undefined,
      phone:
        record.phone !== undefined
          ? typeof record.phone === "string"
            ? record.phone.trim() || null
            : null
          : undefined,
      status: record.status as CustomerStatus | undefined,
      userId:
        record.userId !== undefined
          ? typeof record.userId === "string"
            ? record.userId.trim()
            : null
          : undefined,
    });
  },
};

export interface ListCustomersQueryDto {
  status?: CustomerStatus;
  search?: string;
  limit?: number;
  cursor?: string;
}

export const listCustomersQueryValidator: Validator<ListCustomersQueryDto> = {
  validate(input: unknown): ValidationResult<ListCustomersQueryDto> {
    const errors: ValidationError[] = [];
    if (typeof input !== "object" || input === null) {
      return validationSuccess({});
    }

    const record = input as Record<string, unknown>;
    let status: CustomerStatus | undefined;
    let search: string | undefined;
    let limit: number | undefined;
    let cursor: string | undefined;

    if (record.status !== undefined && record.status !== "") {
      if (!isValidCustomerStatus(record.status)) {
        errors.push({ field: "status", message: "Status must be 'ACTIVE' or 'DISABLED'" });
      } else {
        status = record.status;
      }
    }

    if (
      record.search !== undefined &&
      typeof record.search === "string" &&
      record.search.trim()
    ) {
      search = record.search.trim();
    }

    if (record.limit !== undefined && record.limit !== "") {
      const parsedLimit = Number(record.limit);
      if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
        errors.push({
          field: "limit",
          message: "Limit must be an integer between 1 and 100",
        });
      } else {
        limit = parsedLimit;
      }
    }

    if (
      record.cursor !== undefined &&
      typeof record.cursor === "string" &&
      record.cursor.trim()
    ) {
      cursor = record.cursor.trim();
    }

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({
      status,
      search,
      limit,
      cursor,
    });
  },
};

export interface CreateCustomerAddressRequestDto {
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
}

export const createCustomerAddressValidator: Validator<CreateCustomerAddressRequestDto> = {
  validate(input: unknown): ValidationResult<CreateCustomerAddressRequestDto> {
    const errors: ValidationError[] = [];

    if (typeof input !== "object" || input === null) {
      return validationFailure([
        { field: "body", message: "Request body must be an object" },
      ]);
    }

    const record = input as Record<string, unknown>;

    if (typeof record.addressLine1 !== "string" || !record.addressLine1.trim()) {
      errors.push({ field: "addressLine1", message: "Address line 1 is required" });
    } else if (record.addressLine1.trim().length > 255) {
      errors.push({ field: "addressLine1", message: "Address line 1 cannot exceed 255 characters" });
    }

    if (record.addressLine2 !== undefined && record.addressLine2 !== null) {
      if (typeof record.addressLine2 !== "string") {
        errors.push({ field: "addressLine2", message: "Address line 2 must be a string" });
      } else if (record.addressLine2.trim().length > 255) {
        errors.push({ field: "addressLine2", message: "Address line 2 cannot exceed 255 characters" });
      }
    }

    if (typeof record.city !== "string" || !record.city.trim()) {
      errors.push({ field: "city", message: "City is required" });
    } else if (record.city.trim().length > 100) {
      errors.push({ field: "city", message: "City cannot exceed 100 characters" });
    }

    if (record.state !== undefined && record.state !== null) {
      if (typeof record.state !== "string") {
        errors.push({ field: "state", message: "State must be a string" });
      } else if (record.state.trim().length > 100) {
        errors.push({ field: "state", message: "State cannot exceed 100 characters" });
      }
    }

    if (typeof record.postalCode !== "string" || !record.postalCode.trim()) {
      errors.push({ field: "postalCode", message: "Postal code is required" });
    } else if (record.postalCode.trim().length > 32) {
      errors.push({ field: "postalCode", message: "Postal code cannot exceed 32 characters" });
    }

    if (typeof record.country !== "string" || !record.country.trim()) {
      errors.push({ field: "country", message: "Country is required" });
    } else if (record.country.trim().length > 64) {
      errors.push({ field: "country", message: "Country cannot exceed 64 characters" });
    }

    if (record.firstName !== undefined && record.firstName !== null) {
      if (typeof record.firstName !== "string") {
        errors.push({ field: "firstName", message: "First name must be a string" });
      } else if (record.firstName.trim().length > 100) {
        errors.push({ field: "firstName", message: "First name cannot exceed 100 characters" });
      }
    }

    if (record.lastName !== undefined && record.lastName !== null) {
      if (typeof record.lastName !== "string") {
        errors.push({ field: "lastName", message: "Last name must be a string" });
      } else if (record.lastName.trim().length > 100) {
        errors.push({ field: "lastName", message: "Last name cannot exceed 100 characters" });
      }
    }

    if (record.company !== undefined && record.company !== null) {
      if (typeof record.company !== "string") {
        errors.push({ field: "company", message: "Company must be a string" });
      } else if (record.company.trim().length > 100) {
        errors.push({ field: "company", message: "Company cannot exceed 100 characters" });
      }
    }

    if (record.phone !== undefined && record.phone !== null) {
      if (typeof record.phone !== "string") {
        errors.push({ field: "phone", message: "Phone must be a string" });
      } else if (record.phone.trim().length > 50) {
        errors.push({ field: "phone", message: "Phone cannot exceed 50 characters" });
      }
    }

    if (record.label !== undefined && record.label !== null) {
      if (typeof record.label !== "string") {
        errors.push({ field: "label", message: "Label must be a string" });
      } else if (record.label.trim().length > 100) {
        errors.push({ field: "label", message: "Label cannot exceed 100 characters" });
      }
    }

    if (record.isDefault !== undefined && typeof record.isDefault !== "boolean") {
      errors.push({ field: "isDefault", message: "isDefault must be a boolean" });
    }

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({
      addressLine1: (record.addressLine1 as string).trim(),
      addressLine2:
        typeof record.addressLine2 === "string"
          ? record.addressLine2.trim() || null
          : null,
      city: (record.city as string).trim(),
      state:
        typeof record.state === "string" ? record.state.trim() || null : null,
      postalCode: (record.postalCode as string).trim(),
      country: (record.country as string).trim().toUpperCase(),
      firstName:
        typeof record.firstName === "string"
          ? record.firstName.trim() || null
          : null,
      lastName:
        typeof record.lastName === "string"
          ? record.lastName.trim() || null
          : null,
      company:
        typeof record.company === "string"
          ? record.company.trim() || null
          : null,
      phone:
        typeof record.phone === "string" ? record.phone.trim() || null : null,
      label:
        typeof record.label === "string" ? record.label.trim() || null : null,
      isDefault: Boolean(record.isDefault),
    });
  },
};

export interface UpdateCustomerAddressRequestDto {
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
}

export const updateCustomerAddressValidator: Validator<UpdateCustomerAddressRequestDto> = {
  validate(input: unknown): ValidationResult<UpdateCustomerAddressRequestDto> {
    const errors: ValidationError[] = [];

    if (typeof input !== "object" || input === null) {
      return validationFailure([
        { field: "body", message: "Request body must be an object" },
      ]);
    }

    const record = input as Record<string, unknown>;

    if (record.addressLine1 !== undefined) {
      if (typeof record.addressLine1 !== "string" || !record.addressLine1.trim()) {
        errors.push({ field: "addressLine1", message: "Address line 1 cannot be empty" });
      } else if (record.addressLine1.trim().length > 255) {
        errors.push({
          field: "addressLine1",
          message: "Address line 1 cannot exceed 255 characters",
        });
      }
    }

    if (record.addressLine2 !== undefined && record.addressLine2 !== null) {
      if (typeof record.addressLine2 !== "string") {
        errors.push({ field: "addressLine2", message: "Address line 2 must be a string" });
      } else if (record.addressLine2.trim().length > 255) {
        errors.push({
          field: "addressLine2",
          message: "Address line 2 cannot exceed 255 characters",
        });
      }
    }

    if (record.city !== undefined) {
      if (typeof record.city !== "string" || !record.city.trim()) {
        errors.push({ field: "city", message: "City cannot be empty" });
      } else if (record.city.trim().length > 100) {
        errors.push({ field: "city", message: "City cannot exceed 100 characters" });
      }
    }

    if (record.state !== undefined && record.state !== null) {
      if (typeof record.state !== "string") {
        errors.push({ field: "state", message: "State must be a string" });
      } else if (record.state.trim().length > 100) {
        errors.push({ field: "state", message: "State cannot exceed 100 characters" });
      }
    }

    if (record.postalCode !== undefined) {
      if (typeof record.postalCode !== "string" || !record.postalCode.trim()) {
        errors.push({ field: "postalCode", message: "Postal code cannot be empty" });
      } else if (record.postalCode.trim().length > 32) {
        errors.push({
          field: "postalCode",
          message: "Postal code cannot exceed 32 characters",
        });
      }
    }

    if (record.country !== undefined) {
      if (typeof record.country !== "string" || !record.country.trim()) {
        errors.push({ field: "country", message: "Country cannot be empty" });
      } else if (record.country.trim().length > 64) {
        errors.push({
          field: "country",
          message: "Country cannot exceed 64 characters",
        });
      }
    }

    if (record.firstName !== undefined && record.firstName !== null) {
      if (typeof record.firstName !== "string") {
        errors.push({ field: "firstName", message: "First name must be a string" });
      } else if (record.firstName.trim().length > 100) {
        errors.push({
          field: "firstName",
          message: "First name cannot exceed 100 characters",
        });
      }
    }

    if (record.lastName !== undefined && record.lastName !== null) {
      if (typeof record.lastName !== "string") {
        errors.push({ field: "lastName", message: "Last name must be a string" });
      } else if (record.lastName.trim().length > 100) {
        errors.push({
          field: "lastName",
          message: "Last name cannot exceed 100 characters",
        });
      }
    }

    if (record.company !== undefined && record.company !== null) {
      if (typeof record.company !== "string") {
        errors.push({ field: "company", message: "Company must be a string" });
      } else if (record.company.trim().length > 100) {
        errors.push({ field: "company", message: "Company cannot exceed 100 characters" });
      }
    }

    if (record.phone !== undefined && record.phone !== null) {
      if (typeof record.phone !== "string") {
        errors.push({ field: "phone", message: "Phone must be a string" });
      } else if (record.phone.trim().length > 50) {
        errors.push({ field: "phone", message: "Phone cannot exceed 50 characters" });
      }
    }

    if (record.label !== undefined && record.label !== null) {
      if (typeof record.label !== "string") {
        errors.push({ field: "label", message: "Label must be a string" });
      } else if (record.label.trim().length > 100) {
        errors.push({ field: "label", message: "Label cannot exceed 100 characters" });
      }
    }

    if (record.isDefault !== undefined && typeof record.isDefault !== "boolean") {
      errors.push({ field: "isDefault", message: "isDefault must be a boolean" });
    }

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({
      addressLine1:
        typeof record.addressLine1 === "string"
          ? record.addressLine1.trim()
          : undefined,
      addressLine2:
        record.addressLine2 !== undefined
          ? typeof record.addressLine2 === "string"
            ? record.addressLine2.trim() || null
            : null
          : undefined,
      city: typeof record.city === "string" ? record.city.trim() : undefined,
      state:
        record.state !== undefined
          ? typeof record.state === "string"
            ? record.state.trim() || null
            : null
          : undefined,
      postalCode:
        typeof record.postalCode === "string"
          ? record.postalCode.trim()
          : undefined,
      country:
        typeof record.country === "string"
          ? record.country.trim().toUpperCase()
          : undefined,
      firstName:
        record.firstName !== undefined
          ? typeof record.firstName === "string"
            ? record.firstName.trim() || null
            : null
          : undefined,
      lastName:
        record.lastName !== undefined
          ? typeof record.lastName === "string"
            ? record.lastName.trim() || null
            : null
          : undefined,
      company:
        record.company !== undefined
          ? typeof record.company === "string"
            ? record.company.trim() || null
            : null
          : undefined,
      phone:
        record.phone !== undefined
          ? typeof record.phone === "string"
            ? record.phone.trim() || null
            : null
          : undefined,
      label:
        record.label !== undefined
          ? typeof record.label === "string"
            ? record.label.trim() || null
            : null
          : undefined,
      isDefault:
        typeof record.isDefault === "boolean" ? record.isDefault : undefined,
    });
  },
};

// ==========================================
// Carts Domain Validators
// ==========================================

export interface CreateCartRequestDto {
  customerId?: string | null;
  guestIdentifier?: string | null;
  currency?: string;
  expiresAt?: string | null;
}

export const createCartValidator: Validator<CreateCartRequestDto> = {
  validate(input: unknown): ValidationResult<CreateCartRequestDto> {
    const errors: ValidationError[] = [];

    if (typeof input !== "object" || input === null) {
      return validationFailure([
        { field: "body", message: "Request body must be an object" },
      ]);
    }

    const record = input as Record<string, unknown>;

    if (record.customerId !== undefined && record.customerId !== null) {
      if (typeof record.customerId !== "string" || !isValidUuid(record.customerId)) {
        errors.push({ field: "customerId", message: "Customer ID must be a valid UUID" });
      }
    }

    if (record.guestIdentifier !== undefined && record.guestIdentifier !== null) {
      if (typeof record.guestIdentifier !== "string" || !record.guestIdentifier.trim()) {
        errors.push({ field: "guestIdentifier", message: "Guest identifier cannot be empty" });
      } else if (record.guestIdentifier.trim().length > 255) {
        errors.push({
          field: "guestIdentifier",
          message: "Guest identifier cannot exceed 255 characters",
        });
      }
    }

    if (record.currency !== undefined && record.currency !== null) {
      if (typeof record.currency !== "string" || !/^[A-Z]{3}$/.test(record.currency.trim())) {
        errors.push({
          field: "currency",
          message: "Currency must be a 3-letter ISO code (e.g. USD)",
        });
      }
    }

    if (record.expiresAt !== undefined && record.expiresAt !== null) {
      if (typeof record.expiresAt !== "string" || isNaN(Date.parse(record.expiresAt))) {
        errors.push({
          field: "expiresAt",
          message: "expiresAt must be a valid ISO date string",
        });
      }
    }

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({
      customerId: typeof record.customerId === "string" ? record.customerId.trim() : null,
      guestIdentifier:
        typeof record.guestIdentifier === "string"
          ? record.guestIdentifier.trim()
          : null,
      currency: typeof record.currency === "string" ? record.currency.trim() : undefined,
      expiresAt: typeof record.expiresAt === "string" ? record.expiresAt.trim() : null,
    });
  },
};

export interface AddCartItemRequestDto {
  variantId: string;
  quantity: number;
}

export const addCartItemValidator: Validator<AddCartItemRequestDto> = {
  validate(input: unknown): ValidationResult<AddCartItemRequestDto> {
    const errors: ValidationError[] = [];

    if (typeof input !== "object" || input === null) {
      return validationFailure([
        { field: "body", message: "Request body must be an object" },
      ]);
    }

    const record = input as Record<string, unknown>;

    if (typeof record.variantId !== "string" || !isValidUuid(record.variantId)) {
      errors.push({ field: "variantId", message: "Variant ID must be a valid UUID" });
    }

    if (
      typeof record.quantity !== "number" ||
      !Number.isInteger(record.quantity) ||
      record.quantity <= 0
    ) {
      errors.push({ field: "quantity", message: "Quantity must be a positive integer" });
    } else if (record.quantity > 999999) {
      errors.push({ field: "quantity", message: "Quantity cannot exceed 999999" });
    }

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({
      variantId: (record.variantId as string).trim(),
      quantity: record.quantity as number,
    });
  },
};

export interface UpdateCartItemQuantityRequestDto {
  quantity: number;
}

export const updateCartItemQuantityValidator: Validator<UpdateCartItemQuantityRequestDto> = {
  validate(input: unknown): ValidationResult<UpdateCartItemQuantityRequestDto> {
    const errors: ValidationError[] = [];

    if (typeof input !== "object" || input === null) {
      return validationFailure([
        { field: "body", message: "Request body must be an object" },
      ]);
    }

    const record = input as Record<string, unknown>;

    if (
      typeof record.quantity !== "number" ||
      !Number.isInteger(record.quantity) ||
      record.quantity < 0
    ) {
      errors.push({
        field: "quantity",
        message: "Quantity must be a non-negative integer (0 to remove item)",
      });
    } else if (record.quantity > 999999) {
      errors.push({ field: "quantity", message: "Quantity cannot exceed 999999" });
    }

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({
      quantity: record.quantity as number,
    });
  },
};

export interface AssociateCustomerRequestDto {
  customerId: string;
}

export const associateCustomerValidator: Validator<AssociateCustomerRequestDto> = {
  validate(input: unknown): ValidationResult<AssociateCustomerRequestDto> {
    const errors: ValidationError[] = [];

    if (typeof input !== "object" || input === null) {
      return validationFailure([
        { field: "body", message: "Request body must be an object" },
      ]);
    }

    const record = input as Record<string, unknown>;

    if (typeof record.customerId !== "string" || !isValidUuid(record.customerId)) {
      errors.push({ field: "customerId", message: "Customer ID must be a valid UUID" });
    }

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({
      customerId: (record.customerId as string).trim(),
    });
  },
};

export interface CartQueryDto {
  customerId?: string;
  guestIdentifier?: string;
}

export const cartQueryValidator: Validator<CartQueryDto> = {
  validate(input: unknown): ValidationResult<CartQueryDto> {
    const errors: ValidationError[] = [];

    if (typeof input !== "object" || input === null) {
      return validationSuccess({});
    }

    const record = input as Record<string, unknown>;

    if (record.customerId !== undefined) {
      if (typeof record.customerId !== "string" || !isValidUuid(record.customerId)) {
        errors.push({ field: "customerId", message: "Customer ID must be a valid UUID" });
      }
    }

    if (record.guestIdentifier !== undefined) {
      if (typeof record.guestIdentifier !== "string" || !record.guestIdentifier.trim()) {
        errors.push({ field: "guestIdentifier", message: "Guest identifier cannot be empty" });
      }
    }

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({
      customerId:
        typeof record.customerId === "string" ? record.customerId.trim() : undefined,
      guestIdentifier:
        typeof record.guestIdentifier === "string"
          ? record.guestIdentifier.trim()
          : undefined,
    });
  },
};

// ---------------------------------------------------------------------------
// Checkout Validators
// ---------------------------------------------------------------------------

export interface CheckoutAddressInputDto {
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state?: string | null;
  postalCode: string;
  country: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
}

function parseCheckoutAddressInput(
  raw: unknown,
  fieldPrefix: string,
  errors: ValidationError[],
): CheckoutAddressInputDto | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  if (typeof raw !== "object" || raw === null) {
    errors.push({ field: fieldPrefix, message: `${fieldPrefix} must be an object` });
    return null;
  }
  const rec = raw as Record<string, unknown>;
  const addressLine1 = rec.addressLine1 ?? rec.address1;
  const state = rec.state ?? rec.province;

  if (typeof addressLine1 !== "string" || !addressLine1.trim()) {
    errors.push({ field: `${fieldPrefix}.addressLine1`, message: "addressLine1 is required" });
  } else if (addressLine1.trim().length > 255) {
    errors.push({ field: `${fieldPrefix}.addressLine1`, message: "addressLine1 cannot exceed 255 characters" });
  }

  if (typeof rec.city !== "string" || !rec.city.trim()) {
    errors.push({ field: `${fieldPrefix}.city`, message: "city is required" });
  } else if (rec.city.trim().length > 100) {
    errors.push({ field: `${fieldPrefix}.city`, message: "city cannot exceed 100 characters" });
  }

  if (typeof rec.postalCode !== "string" || !rec.postalCode.trim()) {
    errors.push({ field: `${fieldPrefix}.postalCode`, message: "postalCode is required" });
  } else if (rec.postalCode.trim().length > 20) {
    errors.push({ field: `${fieldPrefix}.postalCode`, message: "postalCode cannot exceed 20 characters" });
  }

  if (typeof rec.country !== "string" || !rec.country.trim()) {
    errors.push({ field: `${fieldPrefix}.country`, message: "country is required" });
  } else if (rec.country.trim().length > 100) {
    errors.push({ field: `${fieldPrefix}.country`, message: "country cannot exceed 100 characters" });
  }

  return {
    addressLine1: typeof addressLine1 === "string" ? addressLine1.trim() : "",
    addressLine2:
      typeof rec.addressLine2 === "string"
        ? rec.addressLine2.trim()
        : typeof rec.address2 === "string"
          ? rec.address2.trim()
          : null,
    city: typeof rec.city === "string" ? rec.city.trim() : "",
    state: typeof state === "string" ? state.trim() : null,
    postalCode: typeof rec.postalCode === "string" ? rec.postalCode.trim() : "",
    country: typeof rec.country === "string" ? rec.country.trim() : "",
    firstName: typeof rec.firstName === "string" ? rec.firstName.trim() : null,
    lastName: typeof rec.lastName === "string" ? rec.lastName.trim() : null,
    phone: typeof rec.phone === "string" ? rec.phone.trim() : null,
  };
}

export interface CreateCheckoutRequestDto {
  cartId: string;
  customerId?: string | null;
  guestIdentifier?: string | null;
  email?: string | null;
  currency?: string;
  shippingAddress?: CheckoutAddressInputDto | null;
  billingAddress?: CheckoutAddressInputDto | null;
  expiresAt?: string | null;
}

export const createCheckoutValidator: Validator<CreateCheckoutRequestDto> = {
  validate(input: unknown): ValidationResult<CreateCheckoutRequestDto> {
    const errors: ValidationError[] = [];

    if (typeof input !== "object" || input === null) {
      return validationFailure([
        { field: "body", message: "Request body must be an object" },
      ]);
    }

    const record = input as Record<string, unknown>;

    if (!record.cartId || typeof record.cartId !== "string" || !isValidUuid(record.cartId)) {
      errors.push({ field: "cartId", message: "Cart ID is required and must be a valid UUID" });
    }

    if (record.customerId !== undefined && record.customerId !== null) {
      if (typeof record.customerId !== "string" || !isValidUuid(record.customerId)) {
        errors.push({ field: "customerId", message: "Customer ID must be a valid UUID" });
      }
    }

    if (record.email !== undefined && record.email !== null) {
      if (typeof record.email !== "string" || !isValidEmailFormat(record.email.trim())) {
        errors.push({ field: "email", message: "Email must be a valid email address" });
      }
    }

    if (record.currency !== undefined && record.currency !== null) {
      if (typeof record.currency !== "string" || !/^[A-Z]{3}$/.test(record.currency.trim())) {
        errors.push({
          field: "currency",
          message: "Currency must be a 3-letter uppercase ISO code (e.g. USD)",
        });
      }
    }

    if (record.expiresAt !== undefined && record.expiresAt !== null) {
      if (typeof record.expiresAt !== "string" || isNaN(Date.parse(record.expiresAt))) {
        errors.push({
          field: "expiresAt",
          message: "expiresAt must be a valid ISO date string",
        });
      }
    }

    const shippingAddress = parseCheckoutAddressInput(
      record.shippingAddress,
      "shippingAddress",
      errors,
    );
    const billingAddress = parseCheckoutAddressInput(
      record.billingAddress,
      "billingAddress",
      errors,
    );

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({
      cartId: (record.cartId as string).trim(),
      customerId: typeof record.customerId === "string" ? record.customerId.trim() : null,
      guestIdentifier:
        typeof record.guestIdentifier === "string" && record.guestIdentifier.trim()
          ? record.guestIdentifier.trim()
          : undefined,
      email: typeof record.email === "string" ? record.email.trim() : null,
      currency: typeof record.currency === "string" ? record.currency.trim() : undefined,
      shippingAddress,
      billingAddress,
      expiresAt: typeof record.expiresAt === "string" ? record.expiresAt.trim() : null,
    });
  },
};

export interface CheckoutItemActionDto {
  action: "add" | "update" | "remove";
  variantId?: string;
  itemId?: string;
  quantity?: number;
}

export interface UpdateCheckoutRequestDto {
  customerId?: string | null;
  email?: string | null;
  shippingAddress?: CheckoutAddressInputDto | null;
  billingAddress?: CheckoutAddressInputDto | null;
  discountTotal?: number;
  taxTotal?: number;
  shippingTotal?: number;
  itemAction?: CheckoutItemActionDto;
}

export const updateCheckoutValidator: Validator<UpdateCheckoutRequestDto> = {
  validate(input: unknown): ValidationResult<UpdateCheckoutRequestDto> {
    const errors: ValidationError[] = [];

    if (typeof input !== "object" || input === null) {
      return validationFailure([
        { field: "body", message: "Request body must be an object" },
      ]);
    }

    const record = input as Record<string, unknown>;

    // Prevent direct status tampering via PATCH
    if (record.status !== undefined) {
      errors.push({
        field: "status",
        message: "Status cannot be updated directly; use explicit lifecycle endpoints.",
      });
    }

    if (record.paymentStatus !== undefined || record.payment_status !== undefined) {
      errors.push({
        field: "paymentStatus",
        message: "Payment status cannot be updated directly; use payment orchestration.",
      });
    }

    let hasField = false;

    if (record.customerId !== undefined) {
      hasField = true;
      if (
        record.customerId !== null &&
        (typeof record.customerId !== "string" || !isValidUuid(record.customerId))
      ) {
        errors.push({ field: "customerId", message: "Customer ID must be a valid UUID or null" });
      }
    }

    if (record.email !== undefined) {
      hasField = true;
      if (
        record.email !== null &&
        (typeof record.email !== "string" || !isValidEmailFormat(record.email.trim()))
      ) {
        errors.push({ field: "email", message: "Email must be a valid email address or null" });
      }
    }

    let shippingAddress: CheckoutAddressInputDto | null | undefined = undefined;
    if (record.shippingAddress !== undefined) {
      hasField = true;
      if (record.shippingAddress === null) {
        shippingAddress = null;
      } else {
        shippingAddress = parseCheckoutAddressInput(record.shippingAddress, "shippingAddress", errors);
      }
    }

    let billingAddress: CheckoutAddressInputDto | null | undefined = undefined;
    if (record.billingAddress !== undefined) {
      hasField = true;
      if (record.billingAddress === null) {
        billingAddress = null;
      } else {
        billingAddress = parseCheckoutAddressInput(record.billingAddress, "billingAddress", errors);
      }
    }

    if (record.discountTotal !== undefined) {
      hasField = true;
      if (
        typeof record.discountTotal !== "number" ||
        !Number.isInteger(record.discountTotal) ||
        record.discountTotal < 0
      ) {
        errors.push({
          field: "discountTotal",
          message: "discountTotal must be a non-negative integer (minor units)",
        });
      }
    }

    if (record.taxTotal !== undefined) {
      hasField = true;
      if (
        typeof record.taxTotal !== "number" ||
        !Number.isInteger(record.taxTotal) ||
        record.taxTotal < 0
      ) {
        errors.push({
          field: "taxTotal",
          message: "taxTotal must be a non-negative integer (minor units)",
        });
      }
    }

    if (record.shippingTotal !== undefined) {
      hasField = true;
      if (
        typeof record.shippingTotal !== "number" ||
        !Number.isInteger(record.shippingTotal) ||
        record.shippingTotal < 0
      ) {
        errors.push({
          field: "shippingTotal",
          message: "shippingTotal must be a non-negative integer (minor units)",
        });
      }
    }

    let itemAction: CheckoutItemActionDto | undefined = undefined;
    if (record.itemAction !== undefined) {
      hasField = true;
      if (typeof record.itemAction !== "object" || record.itemAction === null) {
        errors.push({ field: "itemAction", message: "itemAction must be an object" });
      } else {
        const actionRec = record.itemAction as Record<string, unknown>;
        const act = actionRec.action;
        if (act !== "add" && act !== "update" && act !== "remove") {
          errors.push({
            field: "itemAction.action",
            message: "itemAction.action must be 'add', 'update', or 'remove'",
          });
        } else if (act === "add") {
          if (typeof actionRec.variantId !== "string" || !isValidUuid(actionRec.variantId)) {
            errors.push({
              field: "itemAction.variantId",
              message: "variantId must be a valid UUID for add action",
            });
          }
          if (
            typeof actionRec.quantity !== "number" ||
            !Number.isInteger(actionRec.quantity) ||
            actionRec.quantity <= 0
          ) {
            errors.push({
              field: "itemAction.quantity",
              message: "quantity must be a positive integer for add action",
            });
          }
        } else if (act === "update") {
          const hasVariant = typeof actionRec.variantId === "string" && isValidUuid(actionRec.variantId);
          const hasItem = typeof actionRec.itemId === "string" && isValidUuid(actionRec.itemId);
          if (!hasVariant && !hasItem) {
            errors.push({
              field: "itemAction",
              message: "Either variantId or itemId must be a valid UUID for update action",
            });
          }
          if (
            typeof actionRec.quantity !== "number" ||
            !Number.isInteger(actionRec.quantity) ||
            actionRec.quantity <= 0
          ) {
            errors.push({
              field: "itemAction.quantity",
              message: "quantity must be a positive integer for update action",
            });
          }
        } else if (act === "remove") {
          const hasVariant = typeof actionRec.variantId === "string" && isValidUuid(actionRec.variantId);
          const hasItem = typeof actionRec.itemId === "string" && isValidUuid(actionRec.itemId);
          if (!hasVariant && !hasItem) {
            errors.push({
              field: "itemAction",
              message: "Either variantId or itemId must be a valid UUID for remove action",
            });
          }
        }

        if (errors.length === 0) {
          itemAction = {
            action: act as "add" | "update" | "remove",
            variantId: typeof actionRec.variantId === "string" ? actionRec.variantId.trim() : undefined,
            itemId: typeof actionRec.itemId === "string" ? actionRec.itemId.trim() : undefined,
            quantity: typeof actionRec.quantity === "number" ? actionRec.quantity : undefined,
          };
        }
      }
    }

    if (!hasField && record.status === undefined) {
      errors.push({
        field: "body",
        message: "At least one valid update field must be provided.",
      });
    }

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({
      customerId:
        record.customerId === null
          ? null
          : typeof record.customerId === "string"
            ? record.customerId.trim()
            : undefined,
      email:
        record.email === null
          ? null
          : typeof record.email === "string"
            ? record.email.trim()
            : undefined,
      shippingAddress,
      billingAddress,
      discountTotal: typeof record.discountTotal === "number" ? record.discountTotal : undefined,
      taxTotal: typeof record.taxTotal === "number" ? record.taxTotal : undefined,
      shippingTotal: typeof record.shippingTotal === "number" ? record.shippingTotal : undefined,
      itemAction,
    });
  },
};

export const listOrdersQueryValidator: Validator<ListOrdersQueryDto> = {
  validate(input: unknown): ValidationResult<ListOrdersQueryDto> {
    const errors: ValidationError[] = [];
    if (typeof input !== "object" || input === null) {
      return validationSuccess({});
    }

    const record = input as Record<string, unknown>;
    let status: OrderStatus | undefined;
    let paymentStatus: OrderPaymentStatus | undefined;
    let fulfillmentStatus: OrderFulfillmentStatus | undefined;
    let customerId: string | undefined;
    let orderNumber: string | undefined;
    let limit: number | undefined;
    let cursor: string | undefined;

    if (record.status !== undefined && record.status !== "") {
      if (!isValidOrderStatus(record.status)) {
        errors.push({
          field: "status",
          message: "Status must be a valid order status",
        });
      } else {
        status = record.status;
      }
    }

    if (record.paymentStatus !== undefined && record.paymentStatus !== "") {
      if (!isValidOrderPaymentStatus(record.paymentStatus)) {
        errors.push({
          field: "paymentStatus",
          message: "paymentStatus must be a valid order payment status",
        });
      } else {
        paymentStatus = record.paymentStatus;
      }
    }

    if (record.fulfillmentStatus !== undefined && record.fulfillmentStatus !== "") {
      if (!isValidOrderFulfillmentStatus(record.fulfillmentStatus)) {
        errors.push({
          field: "fulfillmentStatus",
          message: "fulfillmentStatus must be a valid order fulfillment status",
        });
      } else {
        fulfillmentStatus = record.fulfillmentStatus;
      }
    }

    if (record.customerId !== undefined && record.customerId !== "") {
      if (typeof record.customerId !== "string" || !UUID_REGEX.test(record.customerId.trim())) {
        errors.push({
          field: "customerId",
          message: "customerId must be a valid UUID",
        });
      } else {
        customerId = record.customerId.trim();
      }
    }

    if (record.orderNumber !== undefined && record.orderNumber !== "") {
      if (typeof record.orderNumber !== "string" || record.orderNumber.trim().length === 0) {
        errors.push({
          field: "orderNumber",
          message: "orderNumber must be a non-empty string",
        });
      } else {
        orderNumber = record.orderNumber.trim();
      }
    }

    if (record.limit !== undefined && record.limit !== "") {
      const parsedLimit = Number(record.limit);
      if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
        errors.push({
          field: "limit",
          message: "Limit must be an integer between 1 and 100",
        });
      } else {
        limit = parsedLimit;
      }
    }

    if (record.cursor !== undefined && record.cursor !== "") {
      if (typeof record.cursor !== "string" || !record.cursor.trim()) {
        errors.push({
          field: "cursor",
          message: "Cursor must be a valid non-empty string",
        });
      } else {
        cursor = record.cursor.trim();
      }
    }

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({
      status,
      paymentStatus,
      fulfillmentStatus,
      customerId,
      orderNumber,
      limit,
      cursor,
    });
  },
};

export interface CancelOrderBodyDto {
  reason: string;
}

export const cancelOrderValidator: Validator<CancelOrderBodyDto> = {
  validate(input: unknown): ValidationResult<CancelOrderBodyDto> {
    const errors: ValidationError[] = [];
    if (typeof input !== "object" || input === null) {
      return validationFailure([
        {
          field: "body",
          message: "Request body must be a JSON object",
        },
      ]);
    }

    const record = input as Record<string, unknown>;

    if (
      record.reason === undefined ||
      typeof record.reason !== "string" ||
      record.reason.trim().length === 0
    ) {
      errors.push({
        field: "reason",
        message: "Cancellation reason is required and must not be empty",
      });
    } else if (record.reason.trim().length > 500) {
      errors.push({
        field: "reason",
        message: "Cancellation reason cannot exceed 500 characters",
      });
    }

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({
      reason: (record.reason as string).trim(),
    });
  },
};

export interface FulfillOrderBodyDto {
  fulfillmentStatus?: "FULFILLED" | "PARTIALLY_FULFILLED";
  trackingNumber?: string | null;
  trackingCompany?: string | null;
  carrier?: string | null;
  trackingUrl?: string | null;
  reason?: string | null;
}

/**
 * Accepts only absolute http(s) URLs, mirroring the `isHttpUrl` guard used by
 * the product CSV importer. Used to validate merchant-entered carrier tracking
 * links before they are persisted and rendered as links.
 */
function isHttpTrackingUrl(value: string): boolean {
  if (value.length > 2000 || /\s/.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export const fulfillOrderValidator: Validator<FulfillOrderBodyDto> = {
  validate(input: unknown): ValidationResult<FulfillOrderBodyDto> {
    const errors: ValidationError[] = [];
    if (typeof input !== "object" || input === null) {
      return validationFailure([
        {
          field: "body",
          message: "Request body must be a JSON object",
        },
      ]);
    }

    const record = input as Record<string, unknown>;

    let fulfillmentStatus: "FULFILLED" | "PARTIALLY_FULFILLED" = "FULFILLED";
    if (record.fulfillmentStatus !== undefined && record.fulfillmentStatus !== null) {
      if (
        record.fulfillmentStatus !== "FULFILLED" &&
        record.fulfillmentStatus !== "PARTIALLY_FULFILLED"
      ) {
        errors.push({
          field: "fulfillmentStatus",
          message: "fulfillmentStatus must be either 'FULFILLED' or 'PARTIALLY_FULFILLED'",
        });
      } else {
        fulfillmentStatus = record.fulfillmentStatus as "FULFILLED" | "PARTIALLY_FULFILLED";
      }
    }

    let trackingNumber: string | null = null;
    if (record.trackingNumber !== undefined && record.trackingNumber !== null) {
      if (typeof record.trackingNumber !== "string") {
        errors.push({
          field: "trackingNumber",
          message: "trackingNumber must be a string",
        });
      } else {
        trackingNumber = record.trackingNumber.trim() || null;
      }
    }

    let trackingCompany: string | null = null;
    const rawCompany = record.trackingCompany ?? record.carrier;
    if (rawCompany !== undefined && rawCompany !== null) {
      if (typeof rawCompany !== "string") {
        errors.push({
          field: "trackingCompany",
          message: "trackingCompany or carrier must be a string",
        });
      } else {
        trackingCompany = rawCompany.trim() || null;
      }
    }

    let reason: string | null = null;
    if (record.reason !== undefined && record.reason !== null) {
      if (typeof record.reason !== "string") {
        errors.push({
          field: "reason",
          message: "reason must be a string",
        });
      } else {
        reason = record.reason.trim() || null;
      }
    }

    let trackingUrl: string | null = null;
    if (record.trackingUrl !== undefined && record.trackingUrl !== null) {
      if (typeof record.trackingUrl !== "string") {
        errors.push({
          field: "trackingUrl",
          message: "trackingUrl must be a string",
        });
      } else {
        const candidate = record.trackingUrl.trim();
        if (candidate.length === 0) {
          trackingUrl = null;
        } else if (!isHttpTrackingUrl(candidate)) {
          // Reject non-http(s) schemes at the boundary. The stored value is
          // later rendered as an anchor href in order views and in the
          // fulfillment email, so a `javascript:`/`data:` URL must never be
          // persisted in the first place.
          errors.push({
            field: "trackingUrl",
            message: "trackingUrl must be a valid http(s) URL",
          });
        } else {
          trackingUrl = candidate;
        }
      }
    }

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({
      fulfillmentStatus,
      trackingNumber,
      trackingCompany,
      carrier: trackingCompany,
      trackingUrl,
      reason,
    });
  },
};

export interface UpdateOrderStatusBodyDto {
  toStatus: MerchantOrderStatusTarget;
  reason: string | null;
}

/**
 * Body of `POST /orders/:orderId/status`. Only the statuses a merchant may move
 * an order to are accepted; `CANCELLED` is rejected on purpose (it has its own
 * workflow with refund and stock side effects). Whether the move is legal from
 * the order's current status is decided by the order state machine, not here.
 */
export const updateOrderStatusValidator: Validator<UpdateOrderStatusBodyDto> = {
  validate(input: unknown): ValidationResult<UpdateOrderStatusBodyDto> {
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      return validationFailure([
        { field: "body", message: "Request body must be a JSON object" },
      ]);
    }

    const record = input as Record<string, unknown>;
    const errors: ValidationError[] = [];

    if (!isMerchantOrderStatusTarget(record.toStatus)) {
      errors.push({
        field: "toStatus",
        message:
          "toStatus must be one of CONFIRMED, PROCESSING, SHIPPED, DELIVERED or COMPLETED. Use the cancel endpoint to cancel an order.",
      });
    }

    let reason: string | null = null;
    if (record.reason !== undefined && record.reason !== null) {
      if (typeof record.reason !== "string") {
        errors.push({ field: "reason", message: "reason must be a string" });
      } else if (record.reason.trim().length > 500) {
        errors.push({ field: "reason", message: "reason cannot exceed 500 characters" });
      } else {
        reason = record.reason.trim() || null;
      }
    }

    if (errors.length > 0 || !isMerchantOrderStatusTarget(record.toStatus)) {
      return validationFailure(errors);
    }

    return validationSuccess({ toStatus: record.toStatus, reason });
  },
};


export interface CreateRefundBodyDto {
  amount?: number;
  reason: string;
  idempotencyKey?: string;
}

export const createRefundValidator: Validator<CreateRefundBodyDto> = {
  validate(input: unknown): ValidationResult<CreateRefundBodyDto> {
    const errors: ValidationError[] = [];
    if (typeof input !== "object" || input === null) {
      return validationFailure([
        {
          field: "body",
          message: "Request body must be a JSON object",
        },
      ]);
    }

    const record = input as Record<string, unknown>;

    if (
      record.reason === undefined ||
      typeof record.reason !== "string" ||
      record.reason.trim().length === 0
    ) {
      errors.push({
        field: "reason",
        message: "Refund reason is required and must not be empty",
      });
    } else if (record.reason.trim().length > 500) {
      errors.push({
        field: "reason",
        message: "Refund reason cannot exceed 500 characters",
      });
    }

    let amount: number | undefined;
    if (record.amount !== undefined && record.amount !== null) {
      if (typeof record.amount !== "number" || !Number.isInteger(record.amount) || record.amount <= 0) {
        errors.push({
          field: "amount",
          message: "Refund amount must be a positive integer in minor units (paise/cents)",
        });
      } else {
        amount = record.amount;
      }
    }

    let idempotencyKey: string | undefined;
    if (record.idempotencyKey !== undefined && record.idempotencyKey !== null) {
      if (typeof record.idempotencyKey !== "string" || record.idempotencyKey.trim().length === 0) {
        errors.push({
          field: "idempotencyKey",
          message: "idempotencyKey must be a non-empty string if provided",
        });
      } else if (!/^[\x21-\x7E]{1,255}$/.test(record.idempotencyKey.trim())) {
        errors.push({
          field: "idempotencyKey",
          message: "idempotencyKey must be 1 to 255 printable characters",
        });
      } else {
        idempotencyKey = record.idempotencyKey.trim();
      }
    }

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({
      reason: (record.reason as string).trim(),
      amount,
      idempotencyKey,
    });
  },
};

export interface CreateDiscountRequestDto {
  code: string;
  name: string;
  description?: string | null;
  type: "PERCENTAGE" | "FIXED_AMOUNT";
  value: number;
  currency?: string | null;
  status?: "DRAFT" | "ACTIVE" | "DISABLED" | "EXPIRED";
  minimumSubtotal?: number;
  maxDiscountAmount?: number | null;
  usageLimit?: number | null;
  appliesToFirstTimeCustomer?: boolean;
  eligibleProductIds?: string[];
  eligibleCollectionIds?: string[];
  eligibleCategoryIds?: string[];
  eligibleProductTypeIds?: string[];
  eligibleTagIds?: string[];
  startsAt?: string | null;
  endsAt?: string | null;
}

export interface UpdateDiscountRequestDto {
  name?: string;
  description?: string | null;
  status?: "DRAFT" | "ACTIVE" | "DISABLED" | "EXPIRED";
  minimumSubtotal?: number;
  maxDiscountAmount?: number | null;
  usageLimit?: number | null;
  appliesToFirstTimeCustomer?: boolean;
  eligibleProductIds?: string[];
  eligibleCollectionIds?: string[];
  eligibleCategoryIds?: string[];
  eligibleProductTypeIds?: string[];
  eligibleTagIds?: string[];
  startsAt?: string | null;
  endsAt?: string | null;
}

export const createDiscountValidator: Validator<CreateDiscountRequestDto> = {
  validate(input: unknown): ValidationResult<CreateDiscountRequestDto> {
    const errors: ValidationError[] = [];

    if (typeof input !== "object" || input === null) {
      return validationFailure([
        { field: "body", message: "Request body must be a JSON object" },
      ]);
    }

    const record = input as Record<string, unknown>;

    // Code
    if (typeof record.code !== "string" || !record.code.trim()) {
      errors.push({ field: "code", message: "Discount code is required" });
    } else {
      const trimmedCode = record.code.trim().toUpperCase();
      if (trimmedCode.length > 64) {
        errors.push({ field: "code", message: "Discount code cannot exceed 64 characters" });
      } else if (!/^[A-Z0-9_-]+$/.test(trimmedCode)) {
        errors.push({
          field: "code",
          message: "Discount code must contain only letters, numbers, hyphens, and underscores",
        });
      }
    }

    // Name
    if (typeof record.name !== "string" || !record.name.trim()) {
      errors.push({ field: "name", message: "Discount name is required" });
    } else if (record.name.trim().length > 255) {
      errors.push({ field: "name", message: "Discount name cannot exceed 255 characters" });
    }

    // Type
    const validTypes = ["PERCENTAGE", "FIXED_AMOUNT"];
    if (typeof record.type !== "string" || !validTypes.includes(record.type)) {
      errors.push({
        field: "type",
        message: "Discount type must be either PERCENTAGE or FIXED_AMOUNT",
      });
    }

    // Value
    if (record.value === undefined || record.value === null || typeof record.value !== "number" || isNaN(record.value)) {
      errors.push({ field: "value", message: "Discount value is required and must be a number" });
    } else if (!Number.isInteger(record.value) || record.value <= 0) {
      errors.push({ field: "value", message: "Discount value must be a positive integer" });
    } else if (record.type === "PERCENTAGE" && record.value > 100) {
      errors.push({ field: "value", message: "Percentage discount cannot exceed 100%" });
    }

    // Currency
    if (record.type === "FIXED_AMOUNT") {
      if (typeof record.currency !== "string" || record.currency.trim().length !== 3) {
        errors.push({
          field: "currency",
          message: "Currency is required for fixed amount discounts (3-letter ISO code)",
        });
      }
    }

    // Status
    if (record.status !== undefined && record.status !== null) {
      const validStatuses = ["DRAFT", "ACTIVE", "DISABLED", "EXPIRED"];
      if (typeof record.status !== "string" || !validStatuses.includes(record.status)) {
        errors.push({ field: "status", message: "Invalid discount status" });
      }
    }

    // Minimum Subtotal
    if (record.minimumSubtotal !== undefined && record.minimumSubtotal !== null) {
      if (typeof record.minimumSubtotal !== "number" || !Number.isInteger(record.minimumSubtotal) || record.minimumSubtotal < 0) {
        errors.push({ field: "minimumSubtotal", message: "Minimum subtotal must be a non-negative integer" });
      }
    }

    // Max Discount Amount
    if (record.maxDiscountAmount !== undefined && record.maxDiscountAmount !== null) {
      if (typeof record.maxDiscountAmount !== "number" || !Number.isInteger(record.maxDiscountAmount) || record.maxDiscountAmount <= 0) {
        errors.push({ field: "maxDiscountAmount", message: "Max discount amount must be a positive integer" });
      }
    }

    // Usage Limit
    if (record.usageLimit !== undefined && record.usageLimit !== null) {
      if (typeof record.usageLimit !== "number" || !Number.isInteger(record.usageLimit) || record.usageLimit <= 0) {
        errors.push({ field: "usageLimit", message: "Usage limit must be a positive integer" });
      }
    }

    // Date range
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    if (record.startsAt !== undefined && record.startsAt !== null && record.startsAt !== "") {
      startDate = new Date(record.startsAt as string);
      if (isNaN(startDate.getTime())) {
        errors.push({ field: "startsAt", message: "Invalid start date format" });
      }
    }
    if (record.endsAt !== undefined && record.endsAt !== null && record.endsAt !== "") {
      endDate = new Date(record.endsAt as string);
      if (isNaN(endDate.getTime())) {
        errors.push({ field: "endsAt", message: "Invalid end date format" });
      }
    }
    if (startDate && endDate && endDate <= startDate) {
      errors.push({ field: "endsAt", message: "End date must be after start date" });
    }

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({
      code: (record.code as string).trim().toUpperCase(),
      name: (record.name as string).trim(),
      description: record.description ? (record.description as string).trim() : null,
      type: record.type as "PERCENTAGE" | "FIXED_AMOUNT",
      value: record.value as number,
      currency: record.currency ? (record.currency as string).trim().toUpperCase() : null,
      status: (record.status as "DRAFT" | "ACTIVE" | "DISABLED" | "EXPIRED") ?? "ACTIVE",
      minimumSubtotal: (record.minimumSubtotal as number) ?? 0,
      maxDiscountAmount: (record.maxDiscountAmount as number) ?? null,
      usageLimit: (record.usageLimit as number) ?? null,
      appliesToFirstTimeCustomer: Boolean(record.appliesToFirstTimeCustomer),
      eligibleProductIds: Array.isArray(record.eligibleProductIds) ? (record.eligibleProductIds as string[]) : undefined,
      eligibleCollectionIds: Array.isArray(record.eligibleCollectionIds) ? (record.eligibleCollectionIds as string[]) : undefined,
      eligibleCategoryIds: Array.isArray(record.eligibleCategoryIds) ? (record.eligibleCategoryIds as string[]) : undefined,
      eligibleProductTypeIds: Array.isArray(record.eligibleProductTypeIds) ? (record.eligibleProductTypeIds as string[]) : undefined,
      eligibleTagIds: Array.isArray(record.eligibleTagIds) ? (record.eligibleTagIds as string[]) : undefined,
      startsAt: record.startsAt ? (record.startsAt as string) : null,
      endsAt: record.endsAt ? (record.endsAt as string) : null,
    });
  },
};

export const updateDiscountValidator: Validator<UpdateDiscountRequestDto> = {
  validate(input: unknown): ValidationResult<UpdateDiscountRequestDto> {
    const errors: ValidationError[] = [];

    if (typeof input !== "object" || input === null) {
      return validationFailure([
        { field: "body", message: "Request body must be a JSON object" },
      ]);
    }

    const record = input as Record<string, unknown>;

    // Name
    if (record.name !== undefined) {
      if (typeof record.name !== "string" || !record.name.trim()) {
        errors.push({ field: "name", message: "Discount name cannot be empty" });
      } else if (record.name.trim().length > 255) {
        errors.push({ field: "name", message: "Discount name cannot exceed 255 characters" });
      }
    }

    // Status
    if (record.status !== undefined) {
      const validStatuses = ["DRAFT", "ACTIVE", "DISABLED", "EXPIRED"];
      if (typeof record.status !== "string" || !validStatuses.includes(record.status)) {
        errors.push({ field: "status", message: "Invalid discount status" });
      }
    }

    // Minimum Subtotal
    if (record.minimumSubtotal !== undefined && record.minimumSubtotal !== null) {
      if (typeof record.minimumSubtotal !== "number" || !Number.isInteger(record.minimumSubtotal) || record.minimumSubtotal < 0) {
        errors.push({ field: "minimumSubtotal", message: "Minimum subtotal must be a non-negative integer" });
      }
    }

    // Max Discount Amount
    if (record.maxDiscountAmount !== undefined && record.maxDiscountAmount !== null) {
      if (typeof record.maxDiscountAmount !== "number" || !Number.isInteger(record.maxDiscountAmount) || record.maxDiscountAmount <= 0) {
        errors.push({ field: "maxDiscountAmount", message: "Max discount amount must be a positive integer" });
      }
    }

    // Usage Limit
    if (record.usageLimit !== undefined && record.usageLimit !== null) {
      if (typeof record.usageLimit !== "number" || !Number.isInteger(record.usageLimit) || record.usageLimit <= 0) {
        errors.push({ field: "usageLimit", message: "Usage limit must be a positive integer" });
      }
    }

    // Date range
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    if (record.startsAt !== undefined && record.startsAt !== null && record.startsAt !== "") {
      startDate = new Date(record.startsAt as string);
      if (isNaN(startDate.getTime())) {
        errors.push({ field: "startsAt", message: "Invalid start date format" });
      }
    }
    if (record.endsAt !== undefined && record.endsAt !== null && record.endsAt !== "") {
      endDate = new Date(record.endsAt as string);
      if (isNaN(endDate.getTime())) {
        errors.push({ field: "endsAt", message: "Invalid end date format" });
      }
    }
    if (startDate && endDate && endDate <= startDate) {
      errors.push({ field: "endsAt", message: "End date must be after start date" });
    }

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({
      name: record.name !== undefined ? (record.name as string).trim() : undefined,
      description: record.description !== undefined ? (record.description ? (record.description as string).trim() : null) : undefined,
      status: record.status !== undefined ? (record.status as "DRAFT" | "ACTIVE" | "DISABLED" | "EXPIRED") : undefined,
      minimumSubtotal: record.minimumSubtotal !== undefined ? (record.minimumSubtotal as number) : undefined,
      maxDiscountAmount: record.maxDiscountAmount !== undefined ? (record.maxDiscountAmount as number | null) : undefined,
      usageLimit: record.usageLimit !== undefined ? (record.usageLimit as number | null) : undefined,
      appliesToFirstTimeCustomer:
        record.appliesToFirstTimeCustomer !== undefined
          ? Boolean(record.appliesToFirstTimeCustomer)
          : undefined,
      eligibleProductIds: Array.isArray(record.eligibleProductIds)
        ? (record.eligibleProductIds as string[])
        : undefined,
      eligibleCollectionIds: Array.isArray(record.eligibleCollectionIds)
        ? (record.eligibleCollectionIds as string[])
        : undefined,
      eligibleCategoryIds: Array.isArray(record.eligibleCategoryIds)
        ? (record.eligibleCategoryIds as string[])
        : undefined,
      eligibleProductTypeIds: Array.isArray(record.eligibleProductTypeIds)
        ? (record.eligibleProductTypeIds as string[])
        : undefined,
      eligibleTagIds: Array.isArray(record.eligibleTagIds)
        ? (record.eligibleTagIds as string[])
        : undefined,
      startsAt: record.startsAt !== undefined ? (record.startsAt ? (record.startsAt as string) : null) : undefined,
      endsAt: record.endsAt !== undefined ? (record.endsAt ? (record.endsAt as string) : null) : undefined,
    });
  },
};

// -------------------------------------------------------------
// Authentication, Invitation and Customer Account Validators
// -------------------------------------------------------------

export interface ForgotPasswordDto {
  email: string;
}

export const forgotPasswordValidator: Validator<ForgotPasswordDto> = {
  validate(input: unknown): ValidationResult<ForgotPasswordDto> {
    const errors: ValidationError[] = [];
    if (typeof input !== "object" || input === null) {
      return validationFailure([{ field: "body", message: "Request body must be an object" }]);
    }
    const record = input as Record<string, unknown>;
    if (typeof record.email !== "string" || !record.email.trim()) {
      errors.push({ field: "email", message: "Email is required" });
    } else if (!isValidEmailFormat(record.email.trim())) {
      errors.push({ field: "email", message: "Invalid email address format" });
    }
    if (errors.length > 0) return validationFailure(errors);
    return validationSuccess({ email: (record.email as string).trim() });
  },
};

export interface ResetPasswordDto {
  token: string;
  newPassword: string;
}

export const resetPasswordValidator: Validator<ResetPasswordDto> = {
  validate(input: unknown): ValidationResult<ResetPasswordDto> {
    const errors: ValidationError[] = [];
    if (typeof input !== "object" || input === null) {
      return validationFailure([{ field: "body", message: "Request body must be an object" }]);
    }
    const record = input as Record<string, unknown>;
    if (typeof record.token !== "string" || !record.token.trim()) {
      errors.push({ field: "token", message: "Reset token is required" });
    }
    if (typeof record.newPassword !== "string" || !record.newPassword) {
      errors.push({ field: "newPassword", message: "New password is required" });
    } else if (record.newPassword.length < 8) {
      errors.push({ field: "newPassword", message: "New password must be at least 8 characters long" });
    }
    if (errors.length > 0) return validationFailure(errors);
    return validationSuccess({
      token: (record.token as string).trim(),
      newPassword: record.newPassword as string,
    });
  },
};

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export const changePasswordValidator: Validator<ChangePasswordDto> = {
  validate(input: unknown): ValidationResult<ChangePasswordDto> {
    const errors: ValidationError[] = [];
    if (typeof input !== "object" || input === null) {
      return validationFailure([{ field: "body", message: "Request body must be an object" }]);
    }
    const record = input as Record<string, unknown>;
    if (typeof record.currentPassword !== "string" || !record.currentPassword) {
      errors.push({ field: "currentPassword", message: "Current password is required" });
    }
    if (typeof record.newPassword !== "string" || !record.newPassword) {
      errors.push({ field: "newPassword", message: "New password is required" });
    } else if (record.newPassword.length < 8) {
      errors.push({ field: "newPassword", message: "New password must be at least 8 characters long" });
    }
    if (errors.length > 0) return validationFailure(errors);
    return validationSuccess({
      currentPassword: record.currentPassword as string,
      newPassword: record.newPassword as string,
    });
  },
};

export interface UpdateProfileDto {
  name?: string;
}

export const updateProfileValidator: Validator<UpdateProfileDto> = {
  validate(input: unknown): ValidationResult<UpdateProfileDto> {
    const errors: ValidationError[] = [];
    if (typeof input !== "object" || input === null) {
      return validationFailure([{ field: "body", message: "Request body must be an object" }]);
    }
    const record = input as Record<string, unknown>;
    if (record.name !== undefined) {
      if (typeof record.name !== "string" || !record.name.trim()) {
        errors.push({ field: "name", message: "Name must not be empty" });
      } else if (record.name.trim().length > 100) {
        errors.push({ field: "name", message: "Name must not exceed 100 characters" });
      }
    }
    if (errors.length > 0) return validationFailure(errors);
    return validationSuccess({
      name: record.name !== undefined ? (record.name as string).trim() : undefined,
    });
  },
};

export interface CreateStoreInvitationDto {
  email: string;
  role: "admin" | "staff";
}

export const createStoreInvitationValidator: Validator<CreateStoreInvitationDto> = {
  validate(input: unknown): ValidationResult<CreateStoreInvitationDto> {
    const errors: ValidationError[] = [];
    if (typeof input !== "object" || input === null) {
      return validationFailure([{ field: "body", message: "Request body must be an object" }]);
    }
    const record = input as Record<string, unknown>;
    if (typeof record.email !== "string" || !record.email.trim()) {
      errors.push({ field: "email", message: "Email is required" });
    } else if (!isValidEmailFormat(record.email.trim())) {
      errors.push({ field: "email", message: "Invalid email address format" });
    }
    if (typeof record.role !== "string" || !["admin", "staff"].includes(record.role.trim().toLowerCase())) {
      errors.push({ field: "role", message: "Role must be 'admin' or 'staff'" });
    }
    if (errors.length > 0) return validationFailure(errors);
    return validationSuccess({
      email: (record.email as string).trim(),
      role: (record.role as string).trim().toLowerCase() as "admin" | "staff",
    });
  },
};

export interface AcceptInvitationDto {
  name?: string;
  password?: string;
}

export const acceptInvitationValidator: Validator<AcceptInvitationDto> = {
  validate(input: unknown): ValidationResult<AcceptInvitationDto> {
    const errors: ValidationError[] = [];
    if (typeof input !== "object" || input === null) {
      return validationFailure([{ field: "body", message: "Request body must be an object" }]);
    }
    const record = input as Record<string, unknown>;
    if (record.name !== undefined) {
      if (typeof record.name !== "string" || !record.name.trim()) {
        errors.push({ field: "name", message: "Name must not be empty" });
      }
    }
    if (record.password !== undefined) {
      if (typeof record.password !== "string" || record.password.length < 8) {
        errors.push({ field: "password", message: "Password must be at least 8 characters long" });
      }
    }
    if (errors.length > 0) return validationFailure(errors);
    return validationSuccess({
      name: record.name !== undefined ? (record.name as string).trim() : undefined,
      password: record.password !== undefined ? (record.password as string) : undefined,
    });
  },
};

export interface CustomerRegisterDto {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export const customerRegisterValidator: Validator<CustomerRegisterDto> = {
  validate(input: unknown): ValidationResult<CustomerRegisterDto> {
    const errors: ValidationError[] = [];
    if (typeof input !== "object" || input === null) {
      return validationFailure([{ field: "body", message: "Request body must be an object" }]);
    }
    const record = input as Record<string, unknown>;
    if (typeof record.email !== "string" || !record.email.trim()) {
      errors.push({ field: "email", message: "Email is required" });
    } else if (!isValidEmailFormat(record.email.trim())) {
      errors.push({ field: "email", message: "Invalid email address format" });
    }
    if (typeof record.password !== "string" || !record.password) {
      errors.push({ field: "password", message: "Password is required" });
    } else if (record.password.length < 8) {
      errors.push({ field: "password", message: "Password must be at least 8 characters long" });
    }
    if (record.firstName !== undefined && typeof record.firstName !== "string") {
      errors.push({ field: "firstName", message: "First name must be a string" });
    }
    if (record.lastName !== undefined && typeof record.lastName !== "string") {
      errors.push({ field: "lastName", message: "Last name must be a string" });
    }
    if (record.phone !== undefined && typeof record.phone !== "string") {
      errors.push({ field: "phone", message: "Phone must be a string" });
    }
    if (errors.length > 0) return validationFailure(errors);
    return validationSuccess({
      email: (record.email as string).trim(),
      password: record.password as string,
      firstName: record.firstName !== undefined ? (record.firstName as string).trim() : undefined,
      lastName: record.lastName !== undefined ? (record.lastName as string).trim() : undefined,
      phone: record.phone !== undefined ? (record.phone as string).trim() : undefined,
    });
  },
};

export interface VerifyEmailDto {
  token: string;
}

export const verifyEmailValidator: Validator<VerifyEmailDto> = {
  validate(input: unknown): ValidationResult<VerifyEmailDto> {
    if (typeof input !== "object" || input === null) {
      return validationFailure([{ field: "body", message: "Request body must be an object" }]);
    }
    const record = input as Record<string, unknown>;
    if (typeof record.token !== "string" || record.token.trim().length < 20) {
      return validationFailure([{ field: "token", message: "Verification token is required" }]);
    }
    return validationSuccess({ token: record.token.trim() });
  },
};

export interface UpdateCustomerProfileDto {
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export const updateCustomerProfileValidator: Validator<UpdateCustomerProfileDto> = {
  validate(input: unknown): ValidationResult<UpdateCustomerProfileDto> {
    const errors: ValidationError[] = [];
    if (typeof input !== "object" || input === null) {
      return validationFailure([{ field: "body", message: "Request body must be an object" }]);
    }
    const record = input as Record<string, unknown>;
    if (record.firstName !== undefined && typeof record.firstName !== "string") {
      errors.push({ field: "firstName", message: "First name must be a string" });
    }
    if (record.lastName !== undefined && typeof record.lastName !== "string") {
      errors.push({ field: "lastName", message: "Last name must be a string" });
    }
    if (record.phone !== undefined && typeof record.phone !== "string") {
      errors.push({ field: "phone", message: "Phone must be a string" });
    }
    if (errors.length > 0) return validationFailure(errors);
    return validationSuccess({
      firstName: record.firstName !== undefined ? (record.firstName as string).trim() : undefined,
      lastName: record.lastName !== undefined ? (record.lastName as string).trim() : undefined,
      phone: record.phone !== undefined ? (record.phone as string).trim() : undefined,
    });
  },
};

export interface StorefrontAddressDto {
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state?: string | null;
  postalCode: string;
  country: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
}

function validateAddressRecord(addr: unknown, prefix: string, errors: ValidationError[]): StorefrontAddressDto | null {
  if (typeof addr !== "object" || addr === null || Array.isArray(addr)) {
    errors.push({ field: prefix, message: `${prefix} must be an object` });
    return null;
  }
  const r = addr as Record<string, unknown>;
  const addressLine1 = (typeof r.addressLine1 === "string" ? r.addressLine1 : typeof r.address1 === "string" ? r.address1 : "")?.trim();
  const addressLine2 = (typeof r.addressLine2 === "string" ? r.addressLine2 : typeof r.address2 === "string" ? r.address2 : null)?.trim() || null;

  if (!addressLine1) {
    errors.push({ field: `${prefix}.addressLine1`, message: "Address line 1 is required" });
  } else if (addressLine1.length > 255) {
    errors.push({ field: `${prefix}.addressLine1`, message: "Address line 1 must not exceed 255 characters" });
  }

  if (addressLine2 && addressLine2.length > 255) {
    errors.push({ field: `${prefix}.addressLine2`, message: "Address line 2 must not exceed 255 characters" });
  }

  if (typeof r.city !== "string" || !r.city.trim()) {
    errors.push({ field: `${prefix}.city`, message: "City is required" });
  } else if (r.city.trim().length > 100) {
    errors.push({ field: `${prefix}.city`, message: "City must not exceed 100 characters" });
  }

  if (r.state !== undefined && r.state !== null) {
    if (typeof r.state !== "string" || r.state.trim().length > 100) {
      errors.push({ field: `${prefix}.state`, message: "State must not exceed 100 characters" });
    }
  }

  if (typeof r.postalCode !== "string" || !r.postalCode.trim()) {
    errors.push({ field: `${prefix}.postalCode`, message: "Postal code is required" });
  } else if (r.postalCode.trim().length > 20) {
    errors.push({ field: `${prefix}.postalCode`, message: "Postal code must not exceed 20 characters" });
  }

  if (typeof r.country !== "string" || !r.country.trim()) {
    errors.push({ field: `${prefix}.country`, message: "Country is required" });
  } else if (r.country.trim().length > 100) {
    errors.push({ field: `${prefix}.country`, message: "Country must not exceed 100 characters" });
  }

  if (r.firstName !== undefined && r.firstName !== null) {
    if (typeof r.firstName !== "string" || r.firstName.trim().length > 100) {
      errors.push({ field: `${prefix}.firstName`, message: "First name must not exceed 100 characters" });
    }
  }

  if (r.lastName !== undefined && r.lastName !== null) {
    if (typeof r.lastName !== "string" || r.lastName.trim().length > 100) {
      errors.push({ field: `${prefix}.lastName`, message: "Last name must not exceed 100 characters" });
    }
  }

  if (r.phone !== undefined && r.phone !== null) {
    if (typeof r.phone !== "string" || r.phone.trim().length > 50) {
      errors.push({ field: `${prefix}.phone`, message: "Phone must not exceed 50 characters" });
    }
  }

  return {
    addressLine1,
    addressLine2,
    city: typeof r.city === "string" ? r.city.trim() : "",
    state: typeof r.state === "string" ? r.state.trim() : null,
    postalCode: typeof r.postalCode === "string" ? r.postalCode.trim() : "",
    country: typeof r.country === "string" ? r.country.trim() : "",
    firstName: typeof r.firstName === "string" ? r.firstName.trim() : null,
    lastName: typeof r.lastName === "string" ? r.lastName.trim() : null,
    phone: typeof r.phone === "string" ? r.phone.trim() : null,
  };
}

export interface UpdateCheckoutDto {
  email?: string;
  shippingAddress?: StorefrontAddressDto;
  billingAddress?: StorefrontAddressDto;
}

export const storefrontUpdateCheckoutValidator: Validator<UpdateCheckoutDto> = {
  validate(input: unknown): ValidationResult<UpdateCheckoutDto> {
    const errors: ValidationError[] = [];
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      return validationFailure([{ field: "body", message: "Request body must be an object" }]);
    }
    const record = input as Record<string, unknown>;

    if (record.email !== undefined) {
      if (typeof record.email !== "string" || !record.email.trim()) {
        errors.push({ field: "email", message: "Email must be a non-empty string" });
      } else if (record.email.trim().length > 255 || !isValidEmailFormat(record.email.trim())) {
        errors.push({ field: "email", message: "Invalid email address format" });
      }
    }

    let shippingAddress: StorefrontAddressDto | undefined;
    if (record.shippingAddress !== undefined) {
      const res = validateAddressRecord(record.shippingAddress, "shippingAddress", errors);
      if (res) shippingAddress = res;
    }

    let billingAddress: StorefrontAddressDto | undefined;
    if (record.billingAddress !== undefined) {
      const res = validateAddressRecord(record.billingAddress, "billingAddress", errors);
      if (res) billingAddress = res;
    }

    if (errors.length > 0) return validationFailure(errors);

    return validationSuccess({
      email: typeof record.email === "string" ? record.email.trim() : undefined,
      shippingAddress,
      billingAddress,
    });
  },
};

export interface AddCartItemDto {
  variantId: string;
  quantity: number;
  cartId?: string;
  guestIdentifier?: string;
}

export const storefrontAddCartItemValidator: Validator<AddCartItemDto> = {
  validate(input: unknown): ValidationResult<AddCartItemDto> {
    const errors: ValidationError[] = [];
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      return validationFailure([{ field: "body", message: "Request body must be an object" }]);
    }
    const record = input as Record<string, unknown>;

    if (typeof record.variantId !== "string" || !record.variantId.trim()) {
      errors.push({ field: "variantId", message: "Product variant ID is required" });
    } else if (!UUID_REGEX.test(record.variantId.trim())) {
      errors.push({ field: "variantId", message: "variantId must be a valid UUID" });
    }

    let quantity = 1;
    if (record.quantity !== undefined) {
      if (
        typeof record.quantity !== "number" ||
        !Number.isInteger(record.quantity) ||
        record.quantity < 1 ||
        record.quantity > 999
      ) {
        errors.push({ field: "quantity", message: "Quantity must be an integer between 1 and 999" });
      } else {
        quantity = record.quantity;
      }
    }

    if (record.cartId !== undefined) {
      if (typeof record.cartId !== "string" || !UUID_REGEX.test(record.cartId.trim())) {
        errors.push({ field: "cartId", message: "cartId must be a valid UUID" });
      }
    }

    if (record.guestIdentifier !== undefined) {
      if (typeof record.guestIdentifier !== "string" || record.guestIdentifier.trim().length > 100) {
        errors.push({ field: "guestIdentifier", message: "guestIdentifier must be a string up to 100 characters" });
      }
    }

    if (errors.length > 0) return validationFailure(errors);

    return validationSuccess({
      variantId: (record.variantId as string).trim(),
      quantity,
      cartId: typeof record.cartId === "string" ? record.cartId.trim() : undefined,
      guestIdentifier: typeof record.guestIdentifier === "string" ? record.guestIdentifier.trim() : undefined,
    });
  },
};

export interface UpdateCartItemQuantityDto {
  cartId: string;
  quantity: number;
  guestIdentifier?: string;
}

export const storefrontUpdateCartItemQuantityValidator: Validator<UpdateCartItemQuantityDto> = {
  validate(input: unknown): ValidationResult<UpdateCartItemQuantityDto> {
    const errors: ValidationError[] = [];
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      return validationFailure([{ field: "body", message: "Request body must be an object" }]);
    }
    const record = input as Record<string, unknown>;

    if (typeof record.cartId !== "string" || !record.cartId.trim()) {
      errors.push({ field: "cartId", message: "cartId is required" });
    } else if (!UUID_REGEX.test(record.cartId.trim())) {
      errors.push({ field: "cartId", message: "cartId must be a valid UUID" });
    }

    if (
      typeof record.quantity !== "number" ||
      !Number.isInteger(record.quantity) ||
      record.quantity < 0 ||
      record.quantity > 999
    ) {
      errors.push({ field: "quantity", message: "Quantity must be an integer between 0 and 999" });
    }

    if (record.guestIdentifier !== undefined && record.guestIdentifier !== null) {
      if (typeof record.guestIdentifier !== "string" || !record.guestIdentifier.trim()) {
        errors.push({ field: "guestIdentifier", message: "guestIdentifier cannot be empty" });
      } else if (record.guestIdentifier.trim().length > 255) {
        errors.push({ field: "guestIdentifier", message: "guestIdentifier must be a string up to 255 characters" });
      }
    }

    if (errors.length > 0) return validationFailure(errors);

    return validationSuccess({
      cartId: (record.cartId as string).trim(),
      quantity: record.quantity as number,
      guestIdentifier:
        typeof record.guestIdentifier === "string" && record.guestIdentifier.trim()
          ? record.guestIdentifier.trim()
          : undefined,
    });
  },
};

export interface ApplyDiscountDto {
  cartId: string;
  code: string;
  guestIdentifier?: string;
}

export const applyDiscountValidator: Validator<ApplyDiscountDto> = {
  validate(input: unknown): ValidationResult<ApplyDiscountDto> {
    const errors: ValidationError[] = [];
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      return validationFailure([{ field: "body", message: "Request body must be an object" }]);
    }
    const record = input as Record<string, unknown>;

    if (typeof record.cartId !== "string" || !record.cartId.trim()) {
      errors.push({ field: "cartId", message: "cartId is required" });
    } else if (!UUID_REGEX.test(record.cartId.trim())) {
      errors.push({ field: "cartId", message: "cartId must be a valid UUID" });
    }

    if (typeof record.code !== "string" || !record.code.trim()) {
      errors.push({ field: "code", message: "Discount code cannot be empty" });
    } else if (record.code.trim().length > 50) {
      errors.push({ field: "code", message: "Discount code must not exceed 50 characters" });
    }

    if (record.guestIdentifier !== undefined && record.guestIdentifier !== null) {
      if (typeof record.guestIdentifier !== "string" || !record.guestIdentifier.trim()) {
        errors.push({ field: "guestIdentifier", message: "guestIdentifier cannot be empty" });
      } else if (record.guestIdentifier.trim().length > 255) {
        errors.push({ field: "guestIdentifier", message: "guestIdentifier must be a string up to 255 characters" });
      }
    }

    if (errors.length > 0) return validationFailure(errors);

    return validationSuccess({
      cartId: (record.cartId as string).trim(),
      code: (record.code as string).trim(),
      guestIdentifier:
        typeof record.guestIdentifier === "string" && record.guestIdentifier.trim()
          ? record.guestIdentifier.trim()
          : undefined,
    });
  },
};

export interface VerifyPaymentDto {
  paymentId: string;
  attemptId: string;
  razorpayPaymentId: string;
  razorpayOrderId: string;
  razorpaySignature: string;
}

export const verifyPaymentValidator: Validator<VerifyPaymentDto> = {
  validate(input: unknown): ValidationResult<VerifyPaymentDto> {
    const errors: ValidationError[] = [];
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      return validationFailure([{ field: "body", message: "Request body must be an object" }]);
    }
    const record = input as Record<string, unknown>;

    if (typeof record.paymentId !== "string" || !record.paymentId.trim()) {
      errors.push({ field: "paymentId", message: "paymentId is required" });
    } else if (!UUID_REGEX.test(record.paymentId.trim())) {
      errors.push({ field: "paymentId", message: "paymentId must be a valid UUID" });
    }

    if (typeof record.attemptId !== "string" || !record.attemptId.trim()) {
      errors.push({ field: "attemptId", message: "attemptId is required" });
    } else if (!UUID_REGEX.test(record.attemptId.trim())) {
      errors.push({ field: "attemptId", message: "attemptId must be a valid UUID" });
    }

    const rzpPaymentId = (record.razorpayPaymentId || record.razorpay_payment_id) as string | undefined;
    if (typeof rzpPaymentId !== "string" || !rzpPaymentId.trim()) {
      errors.push({ field: "razorpayPaymentId", message: "razorpayPaymentId is required" });
    } else if (rzpPaymentId.trim().length > 100) {
      errors.push({ field: "razorpayPaymentId", message: "razorpayPaymentId must not exceed 100 characters" });
    }

    const rzpOrderId = (record.razorpayOrderId || record.razorpay_order_id) as string | undefined;
    if (typeof rzpOrderId !== "string" || !rzpOrderId.trim()) {
      errors.push({ field: "razorpayOrderId", message: "razorpayOrderId is required" });
    } else if (rzpOrderId.trim().length > 100) {
      errors.push({ field: "razorpayOrderId", message: "razorpayOrderId must not exceed 100 characters" });
    }

    const rzpSignature = (record.razorpaySignature || record.razorpay_signature) as string | undefined;
    if (typeof rzpSignature !== "string" || !rzpSignature.trim()) {
      errors.push({ field: "razorpaySignature", message: "razorpaySignature is required" });
    } else if (rzpSignature.trim().length > 255) {
      errors.push({ field: "razorpaySignature", message: "razorpaySignature must not exceed 255 characters" });
    }

    if (errors.length > 0) return validationFailure(errors);

    return validationSuccess({
      paymentId: (record.paymentId as string).trim(),
      attemptId: (record.attemptId as string).trim(),
      razorpayPaymentId: rzpPaymentId!.trim(),
      razorpayOrderId: rzpOrderId!.trim(),
      razorpaySignature: rzpSignature!.trim(),
    });
  },
};

const VALID_ANALYTICS_PERIODS: Set<string> = new Set([
  "7d",
  "30d",
  "90d",
  "current_month",
  "previous_month",
  "custom",
]);

export const analyticsQueryValidator: Validator<AnalyticsQueryDto> = {
  validate(input: unknown): ValidationResult<AnalyticsQueryDto> {
    const errors: ValidationError[] = [];
    if (typeof input !== "object" || input === null) {
      return validationSuccess({ period: "30d" });
    }

    const record = input as Record<string, unknown>;
    let period: AnalyticsPeriodPreset | undefined;
    let startDate: string | undefined;
    let endDate: string | undefined;
    let limit: number | undefined;

    if (record.period !== undefined && record.period !== "") {
      if (typeof record.period !== "string" || !VALID_ANALYTICS_PERIODS.has(record.period)) {
        errors.push({
          field: "period",
          message: "period must be one of: 7d, 30d, 90d, current_month, previous_month, custom",
        });
      } else {
        period = record.period as AnalyticsPeriodPreset;
      }
    } else {
      period = "30d";
    }

    if (record.startDate !== undefined && record.startDate !== "") {
      if (typeof record.startDate !== "string" || Number.isNaN(Date.parse(record.startDate))) {
        errors.push({
          field: "startDate",
          message: "startDate must be a valid ISO 8601 date string",
        });
      } else {
        startDate = record.startDate;
      }
    }

    if (record.endDate !== undefined && record.endDate !== "") {
      if (typeof record.endDate !== "string" || Number.isNaN(Date.parse(record.endDate))) {
        errors.push({
          field: "endDate",
          message: "endDate must be a valid ISO 8601 date string",
        });
      } else {
        endDate = record.endDate;
      }
    }

    if (period === "custom") {
      if (!startDate) {
        errors.push({
          field: "startDate",
          message: "startDate is required when period is custom",
        });
      }
      if (!endDate) {
        errors.push({
          field: "endDate",
          message: "endDate is required when period is custom",
        });
      }
    }

    if (startDate && endDate && !errors.some((e) => e.field === "startDate" || e.field === "endDate")) {
      const startMs = Date.parse(startDate);
      const endMs = Date.parse(endDate);
      if (startMs > endMs) {
        errors.push({
          field: "startDate",
          message: "startDate cannot be after endDate",
        });
      }
      const maxRangeMs = 366 * 24 * 60 * 60 * 1000;
      if (endMs - startMs > maxRangeMs) {
        errors.push({
          field: "endDate",
          message: "Date range cannot exceed 366 days",
        });
      }
    }

    if (record.limit !== undefined && record.limit !== "") {
      const parsedLimit = Number(record.limit);
      if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 50) {
        errors.push({
          field: "limit",
          message: "limit must be an integer between 1 and 50",
        });
      } else {
        limit = parsedLimit;
      }
    }

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({
      period,
      startDate,
      endDate,
      limit,
    });
  },
};

export const createCollectionValidator: Validator<CreateCollectionInput> = {
  validate(input: unknown): ValidationResult<CreateCollectionInput> {
    const errors: ValidationError[] = [];

    if (typeof input !== "object" || input === null) {
      return validationFailure([
        { field: "body", message: "Request body must be an object" },
      ]);
    }

    const record = input as Record<string, unknown>;

    if (typeof record.title !== "string" || !record.title.trim()) {
      errors.push({
        field: "title",
        message: "Collection title is required and cannot be empty",
      });
    } else if (record.title.trim().length > 255) {
      errors.push({
        field: "title",
        message: "Collection title cannot exceed 255 characters",
      });
    }

    if (record.slug !== undefined && typeof record.slug !== "string") {
      errors.push({
        field: "slug",
        message: "Slug must be a string",
      });
    }

    if (record.description !== undefined && record.description !== null && typeof record.description !== "string") {
      errors.push({
        field: "description",
        message: "Description must be a string or null",
      });
    }

    if (
      record.status !== undefined &&
      record.status !== "ACTIVE" &&
      record.status !== "ARCHIVED"
    ) {
      errors.push({
        field: "status",
        message: "Status must be 'ACTIVE' or 'ARCHIVED'",
      });
    }

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({
      title: (record.title as string).trim(),
      slug: typeof record.slug === "string" ? record.slug.trim() : undefined,
      description: typeof record.description === "string" ? record.description.trim() : null,
      status: record.status as CollectionStatus | undefined,
    });
  },
};

export const updateCollectionValidator: Validator<UpdateCollectionInput> = {
  validate(input: unknown): ValidationResult<UpdateCollectionInput> {
    const errors: ValidationError[] = [];

    if (typeof input !== "object" || input === null) {
      return validationFailure([
        { field: "body", message: "Request body must be an object" },
      ]);
    }

    const record = input as Record<string, unknown>;

    if (record.title !== undefined) {
      if (typeof record.title !== "string" || !record.title.trim()) {
        errors.push({
          field: "title",
          message: "Collection title cannot be empty",
        });
      } else if (record.title.trim().length > 255) {
        errors.push({
          field: "title",
          message: "Collection title cannot exceed 255 characters",
        });
      }
    }

    if (record.slug !== undefined) {
      if (typeof record.slug !== "string" || !record.slug.trim()) {
        errors.push({
          field: "slug",
          message: "Slug must be a non-empty string",
        });
      }
    }

    if (record.description !== undefined && record.description !== null && typeof record.description !== "string") {
      errors.push({
        field: "description",
        message: "Description must be a string or null",
      });
    }

    if (
      record.status !== undefined &&
      record.status !== "ACTIVE" &&
      record.status !== "ARCHIVED"
    ) {
      errors.push({
        field: "status",
        message: "Status must be 'ACTIVE' or 'ARCHIVED'",
      });
    }

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({
      title: typeof record.title === "string" ? record.title.trim() : undefined,
      slug: typeof record.slug === "string" ? record.slug.trim() : undefined,
      description: typeof record.description === "string" ? record.description.trim() : (record.description === null ? null : undefined),
      status: record.status as CollectionStatus | undefined,
    });
  },
};

export interface AddCollectionProductInput {
  productId: string;
  position?: number;
}

export const addCollectionProductValidator: Validator<AddCollectionProductInput> = {
  validate(input: unknown): ValidationResult<AddCollectionProductInput> {
    const errors: ValidationError[] = [];

    if (typeof input !== "object" || input === null) {
      return validationFailure([
        { field: "body", message: "Request body must be an object" },
      ]);
    }

    const record = input as Record<string, unknown>;

    if (typeof record.productId !== "string" || !record.productId.trim()) {
      errors.push({
        field: "productId",
        message: "productId is required and must be a valid UUID string",
      });
    }

    if (record.position !== undefined) {
      const pos = Number(record.position);
      if (!Number.isInteger(pos) || pos < 0) {
        errors.push({
          field: "position",
          message: "position must be a non-negative integer",
        });
      }
    }

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({
      productId: (record.productId as string).trim(),
      position: record.position !== undefined ? Number(record.position) : undefined,
    });
  },
};

export interface ReorderCollectionProductsInput {
  productIds: string[];
}

export const reorderCollectionProductsValidator: Validator<ReorderCollectionProductsInput> = {
  validate(input: unknown): ValidationResult<ReorderCollectionProductsInput> {
    const errors: ValidationError[] = [];

    if (typeof input !== "object" || input === null) {
      return validationFailure([
        { field: "body", message: "Request body must be an object" },
      ]);
    }

    const record = input as Record<string, unknown>;

    if (!Array.isArray(record.productIds)) {
      errors.push({
        field: "productIds",
        message: "productIds is required and must be an array of strings",
      });
    } else {
      for (let i = 0; i < record.productIds.length; i++) {
        if (typeof record.productIds[i] !== "string" || !record.productIds[i].trim()) {
          errors.push({
            field: `productIds[${i}]`,
            message: "Each productId must be a non-empty string",
          });
        }
      }
    }

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({
      productIds: (record.productIds as string[]).map((id) => id.trim()),
    });
  },
};





export const createReviewValidator: Validator<CreateReviewInput> = {
  validate(data: unknown): ValidationResult<CreateReviewInput> {
    if (!data || typeof data !== "object") {
      return validationFailure([{ field: "body", message: "Request body must be an object" }]);
    }
    const record = data as Record<string, unknown>;
    const errors: ValidationError[] = [];

    const rating = Number(record.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      errors.push({ field: "rating", message: "Rating must be an integer between 1 and 5" });
    }

    if (typeof record.title !== "string" || !record.title.trim() || record.title.trim().length > 150) {
      errors.push({ field: "title", message: "Title is required and must not exceed 150 characters" });
    }

    if (typeof record.content !== "string" || !record.content.trim() || record.content.trim().length > 3000) {
      errors.push({ field: "content", message: "Review content is required and must not exceed 3000 characters" });
    }

    let variantId: string | undefined;
    if (record.variantId !== undefined && record.variantId !== null) {
      if (typeof record.variantId !== "string" || !record.variantId.trim()) {
        errors.push({ field: "variantId", message: "variantId must be a valid UUID string" });
      } else {
        variantId = record.variantId.trim();
      }
    }

    let orderId: string | undefined;
    if (record.orderId !== undefined && record.orderId !== null) {
      if (typeof record.orderId !== "string" || !record.orderId.trim()) {
        errors.push({ field: "orderId", message: "orderId must be a valid UUID string" });
      } else {
        orderId = record.orderId.trim();
      }
    }

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({
      rating,
      title: (record.title as string).trim(),
      content: (record.content as string).trim(),
      variantId,
      orderId,
    });
  },
};

export const updateReviewValidator: Validator<UpdateReviewInput> = {
  validate(data: unknown): ValidationResult<UpdateReviewInput> {
    if (!data || typeof data !== "object") {
      return validationFailure([{ field: "body", message: "Request body must be an object" }]);
    }
    const record = data as Record<string, unknown>;
    const errors: ValidationError[] = [];

    let rating: number | undefined;
    if (record.rating !== undefined) {
      rating = Number(record.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        errors.push({ field: "rating", message: "Rating must be an integer between 1 and 5" });
      }
    }

    let title: string | undefined;
    if (record.title !== undefined) {
      if (typeof record.title !== "string" || !record.title.trim() || record.title.trim().length > 150) {
        errors.push({ field: "title", message: "Title must be between 1 and 150 characters" });
      } else {
        title = record.title.trim();
      }
    }

    let content: string | undefined;
    if (record.content !== undefined) {
      if (typeof record.content !== "string" || !record.content.trim() || record.content.trim().length > 3000) {
        errors.push({ field: "content", message: "Content must be between 1 and 3000 characters" });
      } else {
        content = record.content.trim();
      }
    }

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({
      rating,
      title,
      content,
    });
  },
};

export const moderateReviewValidator: Validator<ModerateReviewInput> = {
  validate(data: unknown): ValidationResult<ModerateReviewInput> {
    if (!data || typeof data !== "object") {
      return validationFailure([{ field: "body", message: "Request body must be an object" }]);
    }
    const record = data as Record<string, unknown>;
    const errors: ValidationError[] = [];

    const validStatuses = ["PENDING", "PUBLISHED", "REJECTED", "HIDDEN"];
    if (typeof record.status !== "string" || !validStatuses.includes(record.status)) {
      errors.push({ field: "status", message: `Status must be one of: ${validStatuses.join(", ")}` });
    }

    let reason: string | undefined;
    if (record.reason !== undefined && record.reason !== null) {
      if (typeof record.reason !== "string") {
        errors.push({ field: "reason", message: "Reason must be a string" });
      } else {
        reason = record.reason.trim();
      }
    }

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({
      status: record.status as ReviewStatus,
      reason,
    });
  },
};

export const replyReviewValidator: Validator<{ replyText: string }> = {
  validate(data: unknown): ValidationResult<{ replyText: string }> {
    if (!data || typeof data !== "object") {
      return validationFailure([{ field: "body", message: "Request body must be an object" }]);
    }
    const record = data as Record<string, unknown>;
    const errors: ValidationError[] = [];

    if (typeof record.replyText !== "string" || !record.replyText.trim() || record.replyText.trim().length > 2000) {
      errors.push({ field: "replyText", message: "Reply text is required and must not exceed 2000 characters" });
    }

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({
      replyText: (record.replyText as string).trim(),
    });
  },
};

export const reportReviewValidator: Validator<ReviewReportInput> = {
  validate(data: unknown): ValidationResult<ReviewReportInput> {
    if (!data || typeof data !== "object") {
      return validationFailure([{ field: "body", message: "Request body must be an object" }]);
    }
    const record = data as Record<string, unknown>;
    const errors: ValidationError[] = [];

    if (typeof record.reason !== "string" || !record.reason.trim() || record.reason.trim().length > 200) {
      errors.push({ field: "reason", message: "Reason is required and must not exceed 200 characters" });
    }

    let details: string | undefined;
    if (record.details !== undefined && record.details !== null) {
      if (typeof record.details !== "string") {
        errors.push({ field: "details", message: "Details must be a string" });
      } else {
        details = record.details.trim();
      }
    }

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({
      reason: (record.reason as string).trim(),
      details,
    });
  },
};

// ---------------------------------------------------------------------------
// Returns / RMA (GAP-13)
// ---------------------------------------------------------------------------

export interface CreateReturnRequestBodyDto {
  reason: string;
  customerNote?: string | null;
  items: Array<{ orderItemId: string; quantity: number }>;
}

/**
 * Validates a customer's return request. Only *which* lines and *how many*
 * units are accepted from the client; eligibility, pricing and refund amounts
 * are always recomputed server-side from the persisted order.
 */
export const createReturnRequestValidator: Validator<CreateReturnRequestBodyDto> = {
  validate(input: unknown): ValidationResult<CreateReturnRequestBodyDto> {
    const errors: ValidationError[] = [];
    if (typeof input !== "object" || input === null) {
      return validationFailure([
        { field: "body", message: "Request body must be a JSON object" },
      ]);
    }

    const record = input as Record<string, unknown>;

    let reason = "";
    if (typeof record.reason !== "string" || record.reason.trim().length === 0) {
      errors.push({ field: "reason", message: "A return reason is required" });
    } else if (record.reason.trim().length > 500) {
      errors.push({
        field: "reason",
        message: "Return reason cannot exceed 500 characters",
      });
    } else {
      reason = record.reason.trim();
    }

    let customerNote: string | null = null;
    if (record.customerNote !== undefined && record.customerNote !== null) {
      if (typeof record.customerNote !== "string") {
        errors.push({
          field: "customerNote",
          message: "customerNote must be a string",
        });
      } else if (record.customerNote.trim().length > 2000) {
        errors.push({
          field: "customerNote",
          message: "customerNote cannot exceed 2000 characters",
        });
      } else {
        customerNote = record.customerNote.trim() || null;
      }
    }

    const items: Array<{ orderItemId: string; quantity: number }> = [];
    if (!Array.isArray(record.items) || record.items.length === 0) {
      errors.push({
        field: "items",
        message: "Select at least one item to return",
      });
    } else if (record.items.length > 200) {
      errors.push({
        field: "items",
        message: "A return request cannot contain more than 200 line items",
      });
    } else {
      const seen = new Set<string>();
      record.items.forEach((raw, index) => {
        if (typeof raw !== "object" || raw === null) {
          errors.push({
            field: `items[${index}]`,
            message: "Each return item must be an object",
          });
          return;
        }
        const item = raw as Record<string, unknown>;

        if (
          typeof item.orderItemId !== "string" ||
          !UUID_REGEX.test(item.orderItemId.trim())
        ) {
          errors.push({
            field: `items[${index}].orderItemId`,
            message: "orderItemId must be a valid UUID",
          });
          return;
        }
        const orderItemId = item.orderItemId.trim();

        if (seen.has(orderItemId)) {
          errors.push({
            field: `items[${index}].orderItemId`,
            message: "Each order item may only appear once",
          });
          return;
        }
        seen.add(orderItemId);

        if (
          typeof item.quantity !== "number" ||
          !Number.isInteger(item.quantity) ||
          item.quantity <= 0 ||
          item.quantity > 100_000
        ) {
          errors.push({
            field: `items[${index}].quantity`,
            message: "quantity must be a positive integer",
          });
          return;
        }

        items.push({ orderItemId, quantity: item.quantity });
      });
    }

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({ reason, customerNote, items });
  },
};

export interface ReturnDecisionBodyDto {
  merchantNote?: string | null;
}

/** Shared body shape for merchant approve / reject / receive actions. */
export const returnDecisionValidator: Validator<ReturnDecisionBodyDto> = {
  validate(input: unknown): ValidationResult<ReturnDecisionBodyDto> {
    // An empty body is valid: the merchant note is always optional.
    if (input === undefined || input === null) {
      return validationSuccess({ merchantNote: null });
    }
    if (typeof input !== "object") {
      return validationFailure([
        { field: "body", message: "Request body must be a JSON object" },
      ]);
    }

    const record = input as Record<string, unknown>;
    if (record.merchantNote === undefined || record.merchantNote === null) {
      return validationSuccess({ merchantNote: null });
    }
    if (typeof record.merchantNote !== "string") {
      return validationFailure([
        { field: "merchantNote", message: "merchantNote must be a string" },
      ]);
    }
    if (record.merchantNote.trim().length > 2000) {
      return validationFailure([
        {
          field: "merchantNote",
          message: "merchantNote cannot exceed 2000 characters",
        },
      ]);
    }

    return validationSuccess({
      merchantNote: record.merchantNote.trim() || null,
    });
  },
};

export interface UpdateReturnPolicyBodyDto {
  isReturnsEnabled?: boolean;
  returnWindowDays?: number;
}

export const updateReturnPolicyValidator: Validator<UpdateReturnPolicyBodyDto> = {
  validate(input: unknown): ValidationResult<UpdateReturnPolicyBodyDto> {
    const errors: ValidationError[] = [];
    if (typeof input !== "object" || input === null) {
      return validationFailure([
        { field: "body", message: "Request body must be a JSON object" },
      ]);
    }

    const record = input as Record<string, unknown>;
    const result: UpdateReturnPolicyBodyDto = {};

    if (record.isReturnsEnabled !== undefined && record.isReturnsEnabled !== null) {
      if (typeof record.isReturnsEnabled !== "boolean") {
        errors.push({
          field: "isReturnsEnabled",
          message: "isReturnsEnabled must be a boolean",
        });
      } else {
        result.isReturnsEnabled = record.isReturnsEnabled;
      }
    }

    if (record.returnWindowDays !== undefined && record.returnWindowDays !== null) {
      if (
        typeof record.returnWindowDays !== "number" ||
        !Number.isInteger(record.returnWindowDays) ||
        record.returnWindowDays < 0 ||
        record.returnWindowDays > 365
      ) {
        errors.push({
          field: "returnWindowDays",
          message: "returnWindowDays must be an integer between 0 and 365",
        });
      } else {
        result.returnWindowDays = record.returnWindowDays;
      }
    }

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    if (
      result.isReturnsEnabled === undefined &&
      result.returnWindowDays === undefined
    ) {
      return validationFailure([
        {
          field: "body",
          message: "Provide isReturnsEnabled or returnWindowDays to update",
        },
      ]);
    }

    return validationSuccess(result);
  },
};


// ---------------------------------------------------------------------------
// Tax / GST (GAP-11)
// ---------------------------------------------------------------------------

export interface UpdateTaxSettingsBodyDto {
  isEnabled?: boolean;
  legalName?: string | null;
  gstin?: string | null;
  stateCode?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  postalCode?: string | null;
  defaultGstRateBps?: number;
  pricesIncludeTax?: boolean;
}

/**
 * Shape-checks the tax settings body. Domain rules (GSTIN checksum, state
 * match, completeness before enabling) are enforced by `TaxService`, which is
 * the single place those rules live.
 */
export const updateTaxSettingsValidator: Validator<UpdateTaxSettingsBodyDto> = {
  validate(input: unknown): ValidationResult<UpdateTaxSettingsBodyDto> {
    const errors: ValidationError[] = [];
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      return validationFailure([
        { field: "body", message: "Request body must be a JSON object" },
      ]);
    }

    const record = input as Record<string, unknown>;
    const result: UpdateTaxSettingsBodyDto = {};

    if (record.isEnabled !== undefined) {
      if (typeof record.isEnabled !== "boolean") {
        errors.push({ field: "isEnabled", message: "isEnabled must be a boolean" });
      } else {
        result.isEnabled = record.isEnabled;
      }
    }

    if (record.pricesIncludeTax !== undefined) {
      if (typeof record.pricesIncludeTax !== "boolean") {
        errors.push({ field: "pricesIncludeTax", message: "pricesIncludeTax must be a boolean" });
      } else {
        result.pricesIncludeTax = record.pricesIncludeTax;
      }
    }

    const textFields: Array<[keyof UpdateTaxSettingsBodyDto, number]> = [
      ["legalName", 200],
      ["gstin", 15],
      ["stateCode", 2],
      ["addressLine1", 200],
      ["addressLine2", 200],
      ["city", 100],
      ["postalCode", 6],
    ];
    for (const [field, maxLength] of textFields) {
      const value = record[field];
      if (value === undefined) continue;
      if (value === null) {
        (result as Record<string, unknown>)[field] = null;
        continue;
      }
      if (typeof value !== "string") {
        errors.push({ field, message: `${field} must be a string or null` });
      } else if (value.trim().length > maxLength) {
        errors.push({
          field,
          message: `${field} cannot exceed ${maxLength} characters`,
        });
      } else {
        (result as Record<string, unknown>)[field] = value;
      }
    }

    if (record.defaultGstRateBps !== undefined) {
      if (
        typeof record.defaultGstRateBps !== "number" ||
        !Number.isInteger(record.defaultGstRateBps) ||
        record.defaultGstRateBps < 0 ||
        record.defaultGstRateBps > 4000
      ) {
        errors.push({
          field: "defaultGstRateBps",
          message: "defaultGstRateBps must be a whole number between 0 and 4000",
        });
      } else {
        result.defaultGstRateBps = record.defaultGstRateBps;
      }
    }

    if (errors.length > 0) {
      return validationFailure(errors);
    }
    if (Object.keys(result).length === 0) {
      return validationFailure([
        { field: "body", message: "Provide at least one tax setting to update" },
      ]);
    }
    return validationSuccess(result);
  },
};

export interface SetProductTaxProfileBodyDto {
  hsnCode: string;
  gstRateBps: number;
}

export const setProductTaxProfileValidator: Validator<SetProductTaxProfileBodyDto> = {
  validate(input: unknown): ValidationResult<SetProductTaxProfileBodyDto> {
    const errors: ValidationError[] = [];
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      return validationFailure([
        { field: "body", message: "Request body must be a JSON object" },
      ]);
    }

    const record = input as Record<string, unknown>;

    if (
      typeof record.hsnCode !== "string" ||
      !/^[0-9]{4,8}$/.test(record.hsnCode.trim())
    ) {
      errors.push({
        field: "hsnCode",
        message: "hsnCode must be 4 to 8 digits",
      });
    }

    if (
      typeof record.gstRateBps !== "number" ||
      !Number.isInteger(record.gstRateBps) ||
      record.gstRateBps < 0 ||
      record.gstRateBps > 4000
    ) {
      errors.push({
        field: "gstRateBps",
        message: "gstRateBps must be a whole number between 0 and 4000",
      });
    }

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({
      hsnCode: (record.hsnCode as string).trim(),
      gstRateBps: record.gstRateBps as number,
    });
  },
};

// ---------------------------------------------------------------------------
// Shipping (GAP-12 / M6a)
//
// These check request SHAPE only. The business rules (valid state codes, band
// ordering, and so on) are enforced once, in `ShippingService`.
// ---------------------------------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStringList(
  record: Record<string, unknown>,
  field: string,
  errors: ValidationError[],
): string[] | undefined {
  const value = record[field];
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    errors.push({ field, message: `${field} must be an array of strings` });
    return undefined;
  }
  return value as string[];
}

function readIntField(
  record: Record<string, unknown>,
  field: string,
  errors: ValidationError[],
  options: { nullable?: boolean } = {},
): number | null | undefined {
  const value = record[field];
  if (value === undefined) return undefined;
  if (value === null && options.nullable) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    errors.push({
      field,
      message: `${field} must be a whole number, 0 or more${options.nullable ? " (or null)" : ""}`,
    });
    return undefined;
  }
  return value;
}

export interface UpdateShippingSettingsBodyDto {
  isEnabled?: boolean;
  defaultWeightGrams?: number;
}

export const updateShippingSettingsValidator: Validator<UpdateShippingSettingsBodyDto> = {
  validate(input: unknown): ValidationResult<UpdateShippingSettingsBodyDto> {
    if (!isPlainObject(input)) {
      return validationFailure([{ field: "body", message: "Request body must be a JSON object" }]);
    }
    const errors: ValidationError[] = [];
    const result: UpdateShippingSettingsBodyDto = {};

    if (input.isEnabled !== undefined) {
      if (typeof input.isEnabled !== "boolean") {
        errors.push({ field: "isEnabled", message: "isEnabled must be a boolean" });
      } else {
        result.isEnabled = input.isEnabled;
      }
    }
    const weight = readIntField(input, "defaultWeightGrams", errors);
    if (typeof weight === "number") result.defaultWeightGrams = weight;

    if (errors.length > 0) return validationFailure(errors);
    if (Object.keys(result).length === 0) {
      return validationFailure([
        { field: "body", message: "Provide isEnabled or defaultWeightGrams to update" },
      ]);
    }
    return validationSuccess(result);
  },
};

export interface ShippingZoneBodyDto {
  name: string;
  countryCodes?: string[];
  stateCodes?: string[];
  postalPrefixes?: string[];
  priority?: number;
  isActive?: boolean;
}

export const shippingZoneValidator: Validator<ShippingZoneBodyDto> = {
  validate(input: unknown): ValidationResult<ShippingZoneBodyDto> {
    if (!isPlainObject(input)) {
      return validationFailure([{ field: "body", message: "Request body must be a JSON object" }]);
    }
    const errors: ValidationError[] = [];

    if (typeof input.name !== "string" || input.name.trim().length === 0) {
      errors.push({ field: "name", message: "name is required" });
    }
    const countryCodes = readStringList(input, "countryCodes", errors);
    const stateCodes = readStringList(input, "stateCodes", errors);
    const postalPrefixes = readStringList(input, "postalPrefixes", errors);
    const priority = readIntField(input, "priority", errors);

    let isActive: boolean | undefined;
    if (input.isActive !== undefined) {
      if (typeof input.isActive !== "boolean") {
        errors.push({ field: "isActive", message: "isActive must be a boolean" });
      } else {
        isActive = input.isActive;
      }
    }

    if (errors.length > 0) return validationFailure(errors);
    return validationSuccess({
      name: input.name as string,
      countryCodes,
      stateCodes,
      postalPrefixes,
      priority: typeof priority === "number" ? priority : undefined,
      isActive,
    });
  },
};

export interface ShippingRateBodyDto {
  name: string;
  price: number;
  minWeightGrams?: number;
  maxWeightGrams?: number | null;
  minSubtotal?: number;
  maxSubtotal?: number | null;
  freeOverSubtotal?: number | null;
  estimatedDaysMin?: number | null;
  estimatedDaysMax?: number | null;
  isActive?: boolean;
}

export const shippingRateValidator: Validator<ShippingRateBodyDto> = {
  validate(input: unknown): ValidationResult<ShippingRateBodyDto> {
    if (!isPlainObject(input)) {
      return validationFailure([{ field: "body", message: "Request body must be a JSON object" }]);
    }
    const errors: ValidationError[] = [];

    if (typeof input.name !== "string" || input.name.trim().length === 0) {
      errors.push({ field: "name", message: "name is required" });
    }
    const price = readIntField(input, "price", errors);
    if (price === undefined && !errors.some((e) => e.field === "price")) {
      errors.push({ field: "price", message: "price is required" });
    }

    const minWeightGrams = readIntField(input, "minWeightGrams", errors);
    const maxWeightGrams = readIntField(input, "maxWeightGrams", errors, { nullable: true });
    const minSubtotal = readIntField(input, "minSubtotal", errors);
    const maxSubtotal = readIntField(input, "maxSubtotal", errors, { nullable: true });
    const freeOverSubtotal = readIntField(input, "freeOverSubtotal", errors, { nullable: true });
    const estimatedDaysMin = readIntField(input, "estimatedDaysMin", errors, { nullable: true });
    const estimatedDaysMax = readIntField(input, "estimatedDaysMax", errors, { nullable: true });

    let isActive: boolean | undefined;
    if (input.isActive !== undefined) {
      if (typeof input.isActive !== "boolean") {
        errors.push({ field: "isActive", message: "isActive must be a boolean" });
      } else {
        isActive = input.isActive;
      }
    }

    if (errors.length > 0) return validationFailure(errors);
    return validationSuccess({
      name: input.name as string,
      price: price as number,
      minWeightGrams: minWeightGrams as number | undefined,
      maxWeightGrams,
      minSubtotal: minSubtotal as number | undefined,
      maxSubtotal,
      freeOverSubtotal,
      estimatedDaysMin,
      estimatedDaysMax,
      isActive,
    });
  },
};

export interface SetProductWeightBodyDto {
  weightGrams: number;
}

export const setProductWeightValidator: Validator<SetProductWeightBodyDto> = {
  validate(input: unknown): ValidationResult<SetProductWeightBodyDto> {
    if (!isPlainObject(input)) {
      return validationFailure([{ field: "body", message: "Request body must be a JSON object" }]);
    }
    const errors: ValidationError[] = [];
    const weight = readIntField(input, "weightGrams", errors);
    if (weight === undefined && errors.length === 0) {
      errors.push({ field: "weightGrams", message: "weightGrams is required" });
    }
    if (errors.length > 0) return validationFailure(errors);
    return validationSuccess({ weightGrams: weight as number });
  },
};

export interface SelectShippingRateBodyDto {
  rateId: string;
}

export const selectShippingRateValidator: Validator<SelectShippingRateBodyDto> = {
  validate(input: unknown): ValidationResult<SelectShippingRateBodyDto> {
    if (!isPlainObject(input)) {
      return validationFailure([{ field: "body", message: "Request body must be a JSON object" }]);
    }
    if (typeof input.rateId !== "string" || !UUID_REGEX.test(input.rateId.trim())) {
      return validationFailure([{ field: "rateId", message: "rateId must be a valid UUID" }]);
    }
    return validationSuccess({ rateId: input.rateId.trim() });
  },
};


export interface SubscribeNewsletterBodyDto {
  email: string;
  source?: string;
}

export const subscribeNewsletterValidator: Validator<SubscribeNewsletterBodyDto> = {
  validate(data: unknown): ValidationResult<SubscribeNewsletterBodyDto> {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return validationFailure([{ field: "body", message: "Request body must be a JSON object" }]);
    }

    const record = data as Record<string, unknown>;
    const errors: ValidationError[] = [];

    if (!record.email || typeof record.email !== "string" || !record.email.trim()) {
      errors.push({ field: "email", message: "Email is required" });
    } else if (!isValidEmailFormat(record.email.trim())) {
      errors.push({ field: "email", message: "Invalid email address format" });
    } else if (record.email.trim().length > 255) {
      errors.push({ field: "email", message: "Email must not exceed 255 characters" });
    }

    let source = "STOREFRONT_LANDING";
    if (record.source !== undefined && record.source !== null) {
      if (typeof record.source !== "string") {
        errors.push({ field: "source", message: "source must be a string" });
      } else {
        source = record.source.trim().slice(0, 50) || "STOREFRONT_LANDING";
      }
    }

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({
      email: (record.email as string).trim().toLowerCase(),
      source,
    });
  },
};
