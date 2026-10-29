import type { ApiErrorResponse, ApiSuccessResponse } from "@shopify-clone/types";

export interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  storeId?: string;
  guestIdentifier?: string;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  deduplicateKey?: string;
}

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId?: string;
  readonly fields?: Record<string, string>;
  readonly details?: unknown;

  constructor(params: {
    message: string;
    code: string;
    status: number;
    requestId?: string;
    fields?: Record<string, string>;
    details?: unknown;
  }) {
    super(params.message);
    this.name = "ApiClientError";
    this.code = params.code;
    this.status = params.status;
    this.requestId = params.requestId;
    this.fields = params.fields;
    this.details = params.details;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isValidationError(): boolean {
    return this.status === 400 || this.code === "VALIDATION_ERROR";
  }

  get isConflict(): boolean {
    return this.status === 409;
  }

  get isTimeout(): boolean {
    return this.status === 408 || this.code === "TIMEOUT";
  }

  get isNetworkError(): boolean {
    return this.status === 0 || this.code === "NETWORK_ERROR";
  }

  get isServerError(): boolean {
    return this.status >= 500;
  }
}

/**
 * In-flight promise tracker for preventing duplicate simultaneous requests.
 */
const inFlightRequests = new Map<string, Promise<unknown>>();

/**
 * Delay utility for retries.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Core API Client for communicating with the backend.
 */
export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = "") {
    this.baseUrl = baseUrl;
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const {
      params,
      storeId,
      timeoutMs = 30000,
      retries = 0,
      retryDelayMs = 500,
      deduplicateKey,
      ...customInit
    } = options;

    // Deduplication check
    const dedupKey = deduplicateKey || (customInit.method && customInit.method !== "GET" ? undefined : `${customInit.method || "GET"}:${endpoint}`);
    if (dedupKey && inFlightRequests.has(dedupKey)) {
      return inFlightRequests.get(dedupKey) as Promise<T>;
    }

    const executionPromise = this.executeWithRetry<T>(
      endpoint,
      { ...customInit, params, storeId, timeoutMs },
      retries,
      retryDelayMs
    );

    if (dedupKey) {
      inFlightRequests.set(dedupKey, executionPromise);
      executionPromise
        .finally(() => {
          inFlightRequests.delete(dedupKey);
        })
        .catch(() => {});
    }

    return executionPromise;
  }

  private async executeWithRetry<T>(
    endpoint: string,
    options: RequestOptions,
    retriesLeft: number,
    delayMs: number
  ): Promise<T> {
    try {
      return await this.executeSingle<T>(endpoint, options);
    } catch (error) {
      const isRetryable =
        retriesLeft > 0 &&
        (options.method === "GET" || options.method === undefined) &&
        (error instanceof ApiClientError ? error.status >= 500 : true);

      if (isRetryable) {
        await sleep(delayMs);
        return this.executeWithRetry<T>(
          endpoint,
          options,
          retriesLeft - 1,
          delayMs * 2
        );
      }
      throw error;
    }
  }

  private async executeSingle<T>(
    endpoint: string,
    options: RequestOptions
  ): Promise<T> {
    let url = `${this.baseUrl}${endpoint}`;

    if (options.params) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      }
      const qs = searchParams.toString();
      if (qs) {
        url += (url.includes("?") ? "&" : "?") + qs;
      }
    }

    const headers = new Headers(options.headers);
    if (!headers.has("Content-Type") && options.body && typeof options.body === "string") {
      headers.set("Content-Type", "application/json");
    }
    if (options.storeId && !headers.has("x-store-id")) {
      headers.set("x-store-id", options.storeId);
    }
    if (options.guestIdentifier && !headers.has("x-guest-identifier")) {
      headers.set("x-guest-identifier", options.guestIdentifier);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs ?? 30000);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      const contentType = response.headers.get("content-type") || "";
      const isJson = contentType.includes("application/json");

      if (!response.ok) {
        let code = "UNKNOWN_ERROR";
        let message = `Request failed with status ${response.status}`;
        let requestId: string | undefined =
          response.headers.get("x-request-id") || undefined;
        let fields: Record<string, string> | undefined;
        let details: unknown;

        if (isJson) {
          try {
            const body = (await response.json()) as ApiErrorResponse;
            if (body && body.error) {
              code = body.error.code || code;
              message = body.error.message || message;
              requestId = body.error.requestId || requestId;
              fields = body.error.fields;
              details = body.error.details;
            }
          } catch {
            // Use defaults if response body parsing fails
          }
        }

        throw new ApiClientError({
          code,
          message,
          status: response.status,
          requestId,
          fields,
          details,
        });
      }

      if (response.status === 204) {
        return undefined as T;
      }

      if (isJson) {
        const body = await response.json();
        // Unwrap standard ApiSuccessResponse wrapper if present
        if (
          body !== null &&
          typeof body === "object" &&
          "success" in body &&
          body.success === true &&
          "data" in body
        ) {
          return (body as ApiSuccessResponse<T>).data;
        }
        return body as T;
      }

      return (await response.text()) as unknown as T;
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        throw err;
      }
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new ApiClientError({
          code: "TIMEOUT",
          message: "Request timed out",
          status: 408,
        });
      }
      throw new ApiClientError({
        code: "NETWORK_ERROR",
        message: err instanceof Error ? err.message : "Network request failed",
        status: 0,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Convenience methods
  get<T>(endpoint: string, options?: Omit<RequestOptions, "method" | "body">): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "GET" });
  }

  post<T>(endpoint: string, data?: unknown, options?: Omit<RequestOptions, "method" | "body">): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "POST",
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
  }

  put<T>(endpoint: string, data?: unknown, options?: Omit<RequestOptions, "method" | "body">): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
  }

  patch<T>(endpoint: string, data?: unknown, options?: Omit<RequestOptions, "method" | "body">): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
  }

  delete<T>(endpoint: string, options?: Omit<RequestOptions, "method">): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "DELETE" });
  }
}

export const apiClient = new ApiClient();
