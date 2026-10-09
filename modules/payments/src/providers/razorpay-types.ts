export interface RazorpayOrderRequest {
  amount: number;
  currency: string;
  receipt: string;
  payment_capture?: 0 | 1;
  notes?: Record<string, string>;
}

export interface RazorpayOrderResponse {
  id: string;
  entity: "order";
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt?: string;
  status: "created" | "attempted" | "paid";
  attempts: number;
  notes?: Record<string, unknown>;
  created_at: number;
}

export type RazorpayPaymentStatus =
  | "created"
  | "authorized"
  | "captured"
  | "refunded"
  | "failed";

export interface RazorpayPaymentResponse {
  id: string;
  entity: "payment";
  amount: number;
  currency: string;
  status: RazorpayPaymentStatus;
  order_id?: string | null;
  method: string;
  captured: boolean;
  amount_refunded?: number;
  error_code?: string | null;
  error_description?: string | null;
  error_source?: string | null;
  error_step?: string | null;
  error_reason?: string | null;
  notes?: Record<string, unknown>;
  created_at: number;
}

export interface RazorpayRefundRequest {
  amount?: number;
  reverse_all?: 0 | 1;
  notes?: Record<string, string>;
  receipt?: string;
}

export interface RazorpayRefundResponse {
  id: string;
  entity: "refund";
  amount: number;
  currency: string;
  payment_id: string;
  status: "pending" | "processed" | "failed";
  notes?: Record<string, unknown>;
  receipt?: string | null;
  created_at: number;
}

export interface RazorpayErrorResponse {
  error: {
    code: string;
    description: string;
    source?: string;
    step?: string;
    reason?: string;
    field?: string;
  };
}

export class RazorpayError extends Error {
  readonly code: string;
  readonly statusCode?: number;
  readonly details?: unknown;

  constructor(
    message: string,
    code: string,
    statusCode?: number,
    details?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class RazorpayAuthenticationError extends RazorpayError {
  constructor(message: string = "Razorpay API authentication failed", details?: unknown) {
    super(message, "RAZORPAY_AUTHENTICATION_ERROR", 401, details);
  }
}

export class RazorpayRateLimitError extends RazorpayError {
  constructor(message: string = "Razorpay rate limit exceeded", details?: unknown) {
    super(message, "RAZORPAY_RATE_LIMIT", 429, details);
  }
}

export class RazorpayApiError extends RazorpayError {
  constructor(message: string, statusCode: number, code: string, details?: unknown) {
    super(message, code, statusCode, details);
  }
}

export class RazorpayNetworkError extends RazorpayError {
  constructor(message: string = "Failed to communicate with Razorpay API", details?: unknown) {
    super(message, "RAZORPAY_NETWORK_ERROR", 0, details);
  }
}

export class RazorpayTimeoutError extends RazorpayError {
  constructor(message: string = "Request to Razorpay API timed out", details?: unknown) {
    super(message, "RAZORPAY_TIMEOUT_ERROR", 408, details);
  }
}

export class RazorpayServerError extends RazorpayError {
  constructor(message: string = "Razorpay internal server error", statusCode = 500, details?: unknown) {
    super(message, "RAZORPAY_SERVER_ERROR", statusCode, details);
  }
}
