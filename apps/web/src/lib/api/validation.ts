import type {
  ValidationError,
  ValidationResult,
  Validator,
} from "@shopify-clone/validation";
import {
  validationFailure,
  validationSuccess,
} from "@shopify-clone/validation";
import { isValidEmailFormat } from "@shopify-clone/auth";
import type { AdjustmentReason } from "@shopify-clone/inventory";
import {
  type CustomerStatus,
  isValidCustomerStatus,
} from "@shopify-clone/customers";
import { ApiHttpError } from "./errors";

export async function parseJsonBody(req: Request): Promise<unknown> {
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

  try {
    const text = await req.text();
    if (!text.trim()) {
      throw new Error("Empty body");
    }
    return JSON.parse(text);
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
    throw new ApiHttpError(
      400,
      "VALIDATION_ERROR",
      "Request validation failed",
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
  contactEmail?: string | null;
  contactPhone?: string | null;
  description?: string | null;
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

export interface CreateProductRequestDto {
  title: string;
  description?: string | null;
  slug?: string;
  status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
  price?: number;
  compareAtPrice?: number | null;
  sku?: string | null;
  currency?: string;
  variants?: Array<{
    title?: string;
    sku?: string | null;
    price: number;
    compareAtPrice?: number | null;
    position?: number;
  }>;
  media?: Array<{
    url: string;
    altText?: string | null;
    position?: number;
  }>;
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
      variants: record.variants as CreateProductRequestDto["variants"],
      media: record.media as CreateProductRequestDto["media"],
    });
  },
};

export interface UpdateProductRequestDto {
  title?: string;
  description?: string | null;
  slug?: string;
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
    });
  },
};

export interface ListProductsQueryDto {
  limit?: number;
  cursor?: string;
  status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
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

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({
      limit,
      cursor,
      status,
    });
  },
};

export interface CreateVariantRequestDto {
  title: string;
  price: number;
  compareAtPrice?: number | null;
  sku?: string | null;
  position?: number;
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

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({
      title: (record.title as string).trim(),
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
    });
  },
};

export interface UpdateVariantRequestDto {
  title?: string;
  price?: number;
  compareAtPrice?: number | null;
  sku?: string | null;
  position?: number;
  status?: "ACTIVE" | "INACTIVE" | "ARCHIVED";
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

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({
      title:
        record.title !== undefined
          ? (record.title as string).trim()
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
      position:
        record.position !== undefined ? (record.position as number) : undefined,
      status:
        record.status !== undefined
          ? ((record.status as string).trim().toUpperCase() as
              "ACTIVE" | "INACTIVE" | "ARCHIVED")
          : undefined,
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
}

export const inventoryQueryValidator: Validator<InventoryQueryDto> = {
  validate(input: unknown): ValidationResult<InventoryQueryDto> {
    const errors: ValidationError[] = [];
    if (typeof input !== "object" || input === null) {
      return validationFailure([
        {
          field: "query",
          message: "Either variantId or itemId query parameter is required",
        },
      ]);
    }

    const record = input as Record<string, unknown>;
    let variantId: string | undefined;
    let itemId: string | undefined;
    let availability: boolean | undefined;

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

    if (!variantId && !itemId) {
      errors.push({
        field: "query",
        message: "Either variantId or itemId query parameter is required",
      });
    }

    if (errors.length > 0) {
      return validationFailure(errors);
    }

    return validationSuccess({
      variantId,
      itemId,
      availability,
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
