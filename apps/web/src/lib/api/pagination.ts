import type { PaginatedResult, PaginationParams } from "@shopify-clone/types";
import { ApiHttpError } from "./errors";

export const DEFAULT_PAGE_LIMIT = 25;
export const MAX_PAGE_LIMIT = 100;
export const MIN_PAGE_LIMIT = 1;

export function parsePaginationParams(
  input: URL | URLSearchParams | Request
): PaginationParams {
  let searchParams: URLSearchParams;

  if (input instanceof Request) {
    searchParams = new URL(input.url).searchParams;
  } else if (input instanceof URL) {
    searchParams = input.searchParams;
  } else {
    searchParams = input;
  }

  let limit = DEFAULT_PAGE_LIMIT;
  const limitParam = searchParams.get("limit");

  if (limitParam !== null) {
    const parsed = Number(limitParam);
    if (!Number.isInteger(parsed) || parsed < MIN_PAGE_LIMIT || parsed > MAX_PAGE_LIMIT) {
      throw new ApiHttpError(
        400,
        "VALIDATION_ERROR",
        `Limit must be an integer between ${MIN_PAGE_LIMIT} and ${MAX_PAGE_LIMIT}`,
        {
          fields: {
            limit: `Must be an integer between ${MIN_PAGE_LIMIT} and ${MAX_PAGE_LIMIT}`,
          },
        }
      );
    }
    limit = parsed;
  }

  const cursorParam = searchParams.get("cursor");
  const cursor = cursorParam && cursorParam.trim().length > 0 ? cursorParam.trim() : undefined;

  return {
    limit,
    cursor,
  };
}

export function encodeCursor(payload: Record<string, unknown>): string {
  const json = JSON.stringify(payload);
  return Buffer.from(json, "utf-8").toString("base64url");
}

export function decodeCursor<T = Record<string, unknown>>(cursor: string): T {
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf-8");
    const parsed = JSON.parse(json);
    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("Cursor payload must be an object");
    }
    return parsed as T;
  } catch {
    throw new ApiHttpError(
      400,
      "VALIDATION_ERROR",
      "Malformed pagination cursor",
      {
        fields: {
          cursor: "Invalid cursor token",
        },
      }
    );
  }
}

export function createPaginatedResult<T>(
  itemsWithExtra: T[],
  limit: number,
  getCursor: (item: T) => string
): PaginatedResult<T> {
  const hasMore = itemsWithExtra.length > limit;
  const items = hasMore ? itemsWithExtra.slice(0, limit) : itemsWithExtra;
  const lastItem = items[items.length - 1];
  const nextCursor = hasMore && lastItem ? getCursor(lastItem) : undefined;

  return {
    items,
    hasMore,
    nextCursor,
  };
}
