import { describe, expect, it } from "vitest";
import { EmailService, generateOrderReceiptPdf } from "@calcart/email";
import type { OrderConfirmationProps } from "@calcart/email";

describe("Order Confirmation Receipt PDF & Email Attachment", () => {
  const sampleOrder: OrderConfirmationProps = {
    to: "customer@example.com",
    storeName: "Acme Store",
    storeSlug: "acme-store",
    orderNumber: "ORD-98765",
    orderId: "550e8400-e29b-41d4-a716-446655440000",
    orderDate: new Date("2026-11-20T10:00:00Z"),
    recipientName: "Jane Doe",
    currency: "USD",
    items: [
      {
        name: "Vintage Denim Jacket",
        variantTitle: "Medium / Blue",
        sku: "VDJ-MED-BLU",
        quantity: 1,
        unitPrice: 8500,
        lineTotal: 8500,
      },
      {
        name: "Organic Cotton Tee",
        variantTitle: "Large / White",
        sku: "OCT-LRG-WHT",
        quantity: 2,
        unitPrice: 2500,
        lineTotal: 5000,
      },
    ],
    subtotal: 13500,
    discountTotal: 1000,
    shippingTotal: 500,
    taxTotal: 900,
    grandTotal: 13900,
    shippingAddress: {
      name: "Jane Doe",
      addressLine1: "123 Market Street",
      addressLine2: "Suite 4B",
      city: "San Francisco",
      state: "CA",
      postalCode: "94103",
      country: "US",
    },
  };

  it("generates a valid PDF buffer with standard PDF header magic bytes", async () => {
    const pdfBuffer = await generateOrderReceiptPdf(sampleOrder);
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(1000);

    // Verify PDF magic bytes: %PDF-
    const header = pdfBuffer.slice(0, 5).toString("utf-8");
    expect(header).toBe("%PDF-");
  });

  it("attaches the receipt PDF when sending order confirmation emails", async () => {
    const emailService = new EmailService({ mode: "test" });
    const result = await emailService.sendOrderConfirmation(sampleOrder);

    expect(result.success).toBe(true);

    const captured = emailService.getCapturedEmails();
    expect(captured.length).toBe(1);

    const sent = captured[0]!;
    expect(sent.to).toBe("customer@example.com");
    expect(sent.templateName).toBe("order_confirmation");
    expect(sent.attachments).toBeDefined();
    expect(sent.attachments?.length).toBe(1);

    const attachment = sent.attachments![0]!;
    expect(attachment.filename).toBe("Receipt-ORD-98765.pdf");
    expect(attachment.contentType).toBe("application/pdf");
    expect(attachment.content).toBeInstanceOf(Buffer);
    expect((attachment.content as Buffer).slice(0, 5).toString("utf-8")).toBe("%PDF-");
  });
});
