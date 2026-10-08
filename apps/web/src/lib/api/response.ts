import { NextResponse } from "next/server";
import type {
  ApiErrorResponse,
  ApiSuccessResponse,
} from "@shopify-clone/types";

export interface ApiSuccessOptions {
  status?: number;
  headers?: HeadersInit;
  requestId?: string;
}

export interface ApiErrorOptions {
  details?: unknown;
  fields?: Record<string, string>;
  requestId?: string;
  headers?: HeadersInit;
}

export function apiSuccess<T>(
  data: T,
  options?: ApiSuccessOptions
): NextResponse<ApiSuccessResponse<T>> {
  const status = options?.status ?? 200;
  const headers = new Headers(options?.headers);

  if (options?.requestId && !headers.has("x-request-id")) {
    headers.set("x-request-id", options.requestId);
  }

  return NextResponse.json(
    {
      success: true,
      data,
    },
    {
      status,
      headers,
    }
  );
}

export function apiError(
  code: string,
  message: string,
  status: number,
  options?: ApiErrorOptions
): NextResponse<ApiErrorResponse> {
  const headers = new Headers(options?.headers);

  if (options?.requestId && !headers.has("x-request-id")) {
    headers.set("x-request-id", options.requestId);
  }

  const errorPayload: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message,
      ...(options?.requestId ? { requestId: options.requestId } : {}),
      ...(options?.details !== undefined ? { details: options.details } : {}),
      ...(options?.fields !== undefined ? { fields: options.fields } : {}),
    },
  };

  return NextResponse.json(errorPayload, {
    status,
    headers,
  });
}

export function apiNoContent(options?: {
  headers?: HeadersInit;
  requestId?: string;
}): NextResponse {
  const headers = new Headers(options?.headers);
  if (options?.requestId && !headers.has("x-request-id")) {
    headers.set("x-request-id", options.requestId);
  }

  return new NextResponse(null, {
    status: 204,
    headers,
  });
}
