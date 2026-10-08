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
