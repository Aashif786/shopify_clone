export interface RazorpayOrderDTO {
  providerOrderId: string;
  amount: number;
  currency: string;
  razorpayKeyId: string;
  paymentId: string;
  attemptId: string;
}

export interface VerifyRazorpayCallbackInput {
  storeId: string;
  checkoutId?: string;
  paymentId: string;
  attemptId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface RazorpayPaymentDetailsDTO {
  providerPaymentId: string;
  providerOrderId: string | null;
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  method?: string;
  captured: boolean;
  errorCode?: string | null;
  errorMessage?: string | null;
}
