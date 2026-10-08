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
      }
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
      "Malformed JSON request body"
    );
  }
}

export async function validateBody<T>(
  req: Request,
  validator: Validator<T>
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
      }
    );
  }

  return result.data;
}

export function validateQuery<T>(
  input: Request | URL,
  validator: Validator<T>
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
      }
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
