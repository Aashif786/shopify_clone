import {
  RazorpayApiError,
  RazorpayAuthenticationError,
  RazorpayErrorResponse,
  RazorpayNetworkError,
  RazorpayOrderRequest,
  RazorpayOrderResponse,
  RazorpayPaymentResponse,
  RazorpayRateLimitError,
  RazorpayServerError,
  RazorpayTimeoutError,
} from "../providers/razorpay-types.js";

export type HttpTransport = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface RazorpayClientOptions {
  keyId: string;
  keySecret: string;
  baseUrl?: string;
  timeoutMs?: number;
  transport?: HttpTransport;
}

export class RazorpayClient {
  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly transport: HttpTransport;

  constructor(options: RazorpayClientOptions) {
    if (!options.keyId || !options.keyId.trim()) {
      throw new Error("Razorpay keyId is required");
    }
    if (!options.keySecret || !options.keySecret.trim()) {
      throw new Error("Razorpay keySecret is required");
    }

    this.keyId = options.keyId.trim();
    this.keySecret = options.keySecret.trim();
    this.baseUrl = (options.baseUrl ?? "https://api.razorpay.com/v1").replace(/\/+$/, "");
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.transport = options.transport ?? globalThis.fetch;
  }

  private getAuthHeader(): string {
    const credentials = `${this.keyId}:${this.keySecret}`;
    return `Basic ${Buffer.from(credentials).toString("base64")}`;
  }

  async createOrder(request: RazorpayOrderRequest): Promise<RazorpayOrderResponse> {
    return this.request<RazorpayOrderResponse>("/orders", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  async getPayment(paymentId: string): Promise<RazorpayPaymentResponse> {
    if (!paymentId || !paymentId.trim()) {
      throw new Error("Payment ID is required for Razorpay lookup");
    }
    return this.request<RazorpayPaymentResponse>(`/payments/${encodeURIComponent(paymentId.trim())}`, {
      method: "GET",
    });
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    const headers: Record<string, string> = {
      Authorization: this.getAuthHeader(),
      "Content-Type": "application/json",
      Accept: "application/json",
      ...((init.headers as Record<string, string>) ?? {}),
    };

    try {
      const response = await this.transport(url, {
        ...init,
        headers,
        signal: controller.signal,
      });

      const text = await response.text();
      let body: unknown;
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        if (response.ok) {
          throw new RazorpayServerError(
            `Malformed JSON response from Razorpay API: ${text.slice(0, 100)}`,
            response.status,
          );
        }
        body = { raw: text };
      }

      if (response.ok) {
        if (!body || typeof body !== "object") {
          throw new RazorpayServerError("Invalid JSON response format from Razorpay API", response.status);
        }
        return body as T;
      }

      this.handleHttpError(response.status, body);
    } catch (error: unknown) {
      if (
        error instanceof RazorpayApiError ||
        error instanceof RazorpayAuthenticationError ||
        error instanceof RazorpayRateLimitError ||
        error instanceof RazorpayServerError ||
        error instanceof RazorpayTimeoutError
      ) {
        throw error;
      }

      if (
        (error instanceof Error && error.name === "AbortError") ||
        controller.signal.aborted
      ) {
        throw new RazorpayTimeoutError(
          `Razorpay request to ${path} timed out after ${this.timeoutMs}ms`,
        );
      }

      const msg = error instanceof Error ? error.message : "Network error";
      // Ensure keySecret is not leaked in error messages
      const safeMsg = msg
        .split(this.keySecret)
        .join("[REDACTED]")
        .split(this.getAuthHeader())
        .join("[REDACTED]");
      throw new RazorpayNetworkError(`Razorpay network failure: ${safeMsg}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private handleHttpError(status: number, body: unknown): never {
    const errorBody = body as Partial<RazorpayErrorResponse>;
    const err = errorBody?.error;
    const errorCode = err?.code ?? `HTTP_${status}`;
    const errorDesc = err?.description ?? "Razorpay API error";

    if (status === 401) {
      throw new RazorpayAuthenticationError("Invalid Razorpay API credentials");
    }

    if (status === 429) {
      throw new RazorpayRateLimitError("Razorpay API rate limit exceeded");
    }

    if (status >= 500) {
      throw new RazorpayServerError(
        `Razorpay API server error (${status}): ${errorDesc}`,
        status,
        { code: errorCode, description: errorDesc },
      );
    }

    throw new RazorpayApiError(
      `Razorpay API error: ${errorDesc}`,
      status,
      errorCode,
      { code: errorCode, description: errorDesc, source: err?.source, step: err?.step },
    );
  }
}
