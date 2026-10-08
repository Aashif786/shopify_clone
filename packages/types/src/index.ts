export type EntityId = string;

export interface PaginationParams {
  limit?: number;
  cursor?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  hasMore: boolean;
  nextCursor?: string;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorDetails {
  code: string;
  message: string;
  requestId?: string;
  details?: unknown;
  fields?: Record<string, string>;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorDetails;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export * from "./carts/index.js";
