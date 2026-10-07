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
  details?: unknown;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorDetails;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
