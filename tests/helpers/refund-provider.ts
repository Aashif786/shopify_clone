import type { PaymentProvider } from "@calcart/payments";

export function confirmingRefundProvider(calls?: { count: number }): PaymentProvider {
  return {
    name: "razorpay",
    createOrder: async () => {
      throw new Error("not implemented");
    },
    getPayment: async () => {
      throw new Error("not implemented");
    },
    verifyPaymentSignature: () => false,
    createRefund: async (input) => {
      if (calls) {
        calls.count += 1;
      }
      return {
        providerRefundId: `rfnd_test_${input.receipt ?? input.paymentId}`,
        amount: input.amount,
        currency: input.currency,
        status: "processed",
      };
    },
  };
}
