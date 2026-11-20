import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { formatCurrency, formatDate } from "./templates/formatters.js";
import type { OrderConfirmationProps } from "./templates/types.js";

/**
 * Generates an official, clean, professional PDF order receipt/tax summary.
 * Designed with standard dimensions (A4/Letter), typography, line items table,
 * tax & shipping breakdown, and store identification.
 */
export async function generateOrderReceiptPdf(
  props: OrderConfirmationProps,
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 dimensions in points
  const { width, height } = page.getSize();

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const primaryColor = rgb(0.09, 0.09, 0.11); // #18181b
  const mutedColor = rgb(0.44, 0.44, 0.48); // #71717a
  const borderColor = rgb(0.89, 0.89, 0.91); // #e4e4e7
  const accentColor = rgb(0.12, 0.44, 0.99); // #1f70fa
  const lightBgColor = rgb(0.97, 0.97, 0.98); // #f8f8f9

  const currency = props.currency.toUpperCase();
  const margin = 40;
  let cursorY = height - 45;

  // Header Bar / Store Name
  page.drawText(props.storeName.toUpperCase(), {
    x: margin,
    y: cursorY,
    size: 18,
    font: fontBold,
    color: primaryColor,
  });

  page.drawText("ORDER RECEIPT", {
    x: width - margin - 120,
    y: cursorY,
    size: 14,
    font: fontBold,
    color: accentColor,
  });

  cursorY -= 20;

  // Divider line
  page.drawLine({
    start: { x: margin, y: cursorY },
    end: { x: width - margin, y: cursorY },
    thickness: 1,
    color: borderColor,
  });

  cursorY -= 25;

  // Metadata block: Order details left, Customer/Shipping right
  const orderDateStr = props.orderDate ? formatDate(props.orderDate) : formatDate(new Date());

  // Left Column (Order metadata)
  page.drawText("Order Number:", { x: margin, y: cursorY, size: 9, font: fontRegular, color: mutedColor });
  page.drawText(`#${props.orderNumber}`, { x: margin + 75, y: cursorY, size: 9, font: fontBold, color: primaryColor });

  cursorY -= 15;
  page.drawText("Order Date:", { x: margin, y: cursorY, size: 9, font: fontRegular, color: mutedColor });
  page.drawText(orderDateStr, { x: margin + 75, y: cursorY, size: 9, font: fontRegular, color: primaryColor });

  cursorY -= 15;
  page.drawText("Payment Status:", { x: margin, y: cursorY, size: 9, font: fontRegular, color: mutedColor });
  page.drawText("COMPLETED / CONFIRMED", { x: margin + 75, y: cursorY, size: 9, font: fontBold, color: rgb(0.08, 0.6, 0.3) });

  // Right Column (Recipient & Shipping)
  let rightY = cursorY + 30;
  const rightX = width / 2 + 30;

  page.drawText("Billed / Shipped To:", { x: rightX, y: rightY, size: 9, font: fontBold, color: primaryColor });
  rightY -= 14;

  const recipient = props.recipientName || props.to;
  page.drawText(recipient, { x: rightX, y: rightY, size: 9, font: fontRegular, color: primaryColor });
  rightY -= 12;

  if (props.shippingAddress) {
    const addr = props.shippingAddress;
    const addrParts = [
      addr.addressLine1,
      addr.addressLine2,
      [addr.city, addr.state, addr.postalCode].filter(Boolean).join(", "),
      addr.country,
    ].filter(Boolean);

    for (const part of addrParts) {
      if (part) {
        page.drawText(part, { x: rightX, y: rightY, size: 8.5, font: fontRegular, color: mutedColor });
        rightY -= 11;
      }
    }
  }

  cursorY = Math.min(cursorY - 25, rightY - 15);

  // Line Items Table Header
  const tableTop = cursorY;
  page.drawRectangle({
    x: margin,
    y: tableTop - 4,
    width: width - margin * 2,
    height: 20,
    color: lightBgColor,
    borderColor: borderColor,
    borderWidth: 0.5,
  });

  page.drawText("ITEM DESCRIPTION", { x: margin + 8, y: tableTop + 2, size: 8, font: fontBold, color: primaryColor });
  page.drawText("QTY", { x: width - margin - 180, y: tableTop + 2, size: 8, font: fontBold, color: primaryColor });
  page.drawText("UNIT PRICE", { x: width - margin - 120, y: tableTop + 2, size: 8, font: fontBold, color: primaryColor });
  page.drawText("TOTAL", { x: width - margin - 50, y: tableTop + 2, size: 8, font: fontBold, color: primaryColor });

  cursorY -= 22;

  // Line items
  for (const item of props.items) {
    const title = item.name + (item.variantTitle ? ` (${item.variantTitle})` : "");
    const truncatedTitle = title.length > 45 ? `${title.slice(0, 42)}...` : title;

    page.drawText(truncatedTitle, { x: margin + 8, y: cursorY, size: 8.5, font: fontRegular, color: primaryColor });
    page.drawText(String(item.quantity), { x: width - margin - 175, y: cursorY, size: 8.5, font: fontRegular, color: primaryColor });
    page.drawText(formatCurrency(item.unitPrice, currency), { x: width - margin - 120, y: cursorY, size: 8.5, font: fontRegular, color: primaryColor });
    page.drawText(formatCurrency(item.lineTotal, currency), { x: width - margin - 50, y: cursorY, size: 8.5, font: fontBold, color: primaryColor });

    cursorY -= 6;
    page.drawLine({
      start: { x: margin, y: cursorY },
      end: { x: width - margin, y: cursorY },
      thickness: 0.5,
      color: borderColor,
    });
    cursorY -= 14;
  }

  cursorY -= 10;

  // Financial Summary Section (Right aligned)
  const summaryLeft = width - margin - 200;
  const summaryRight = width - margin;

  const drawSummaryLine = (label: string, value: string, isTotal = false) => {
    page.drawText(label, {
      x: summaryLeft,
      y: cursorY,
      size: isTotal ? 10 : 8.5,
      font: isTotal ? fontBold : fontRegular,
      color: isTotal ? primaryColor : mutedColor,
    });

    const valWidth = fontBold.widthOfTextAtSize(value, isTotal ? 10 : 8.5);
    page.drawText(value, {
      x: summaryRight - valWidth,
      y: cursorY,
      size: isTotal ? 10 : 8.5,
      font: fontBold,
      color: isTotal ? primaryColor : primaryColor,
    });

    cursorY -= isTotal ? 18 : 14;
  };

  drawSummaryLine("Subtotal:", formatCurrency(props.subtotal, currency));

  if (props.discountTotal && props.discountTotal > 0) {
    drawSummaryLine("Discount:", `-${formatCurrency(props.discountTotal, currency)}`);
  }

  if (props.shippingTotal !== undefined) {
    drawSummaryLine("Shipping & Handling:", formatCurrency(props.shippingTotal, currency));
  }

  if (props.taxTotal !== undefined && props.taxTotal > 0) {
    drawSummaryLine("Taxes (GST):", formatCurrency(props.taxTotal, currency));
  }

  cursorY -= 2;
  page.drawLine({
    start: { x: summaryLeft, y: cursorY + 4 },
    end: { x: summaryRight, y: cursorY + 4 },
    thickness: 1,
    color: primaryColor,
  });

  cursorY -= 6;
  drawSummaryLine("Grand Total:", formatCurrency(props.grandTotal, currency), true);

  // Footer / Notice
  cursorY = 55;
  page.drawLine({
    start: { x: margin, y: cursorY + 15 },
    end: { x: width - margin, y: cursorY + 15 },
    thickness: 0.5,
    color: borderColor,
  });

  page.drawText(`Thank you for shopping with ${props.storeName}!`, {
    x: margin,
    y: cursorY,
    size: 8.5,
    font: fontBold,
    color: primaryColor,
  });

  page.drawText(
    "This official electronic receipt serves as proof of purchase and confirmation for your order records.",
    {
      x: margin,
      y: cursorY - 12,
      size: 7.5,
      font: fontRegular,
      color: mutedColor,
    },
  );

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
