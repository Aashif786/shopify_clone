import { describe, expect, it } from "vitest";
import {
  buildProductCsvTemplate,
  parseMajorUnits,
  parseProductCsv,
  ProductCsvParseError,
  serializeProductCsv,
} from "@calcart/products";

describe("product CSV format", () => {
  it("parses the template into two products and three variants", () => {
    const parsed = parseProductCsv(buildProductCsvTemplate());
    expect(parsed.issues.filter((issue) => issue.severity === "error")).toEqual([]);
    expect(parsed.groups).toHaveLength(2);
    expect(parsed.groups[0]?.rows).toHaveLength(2);
    expect(parsed.groups[0]?.rows[0]?.cells.Title).toBe("Example Tee");
    expect(parsed.groups[0]?.rows[1]?.cells.SKU).toBe("TEE-M");
    expect(parsed.groups[1]?.rows[0]?.cells.Handle).toBe("example-hat");
    expect(parsed.groups.reduce((sum, group) => sum + group.rows.length, 0)).toBe(3);
  });

  it("removes the spreadsheet formula guard on import", () => {
    const csv = serializeProductCsv([
      ["Title", "Description", "Handle", "Price"],
      ["Hat", "=1+1", "hat", "10.00"],
    ]);
    expect(csv).toContain("'=1+1");
    const parsed = parseProductCsv(csv);
    expect(parsed.groups[0]?.rows[0]?.cells.Description).toBe("=1+1");
    expect(parsed.issues.filter((issue) => issue.severity === "error")).toEqual([]);
  });

  it("reports the row and column for an invalid price", () => {
    const parsed = parseProductCsv("Title,Price\nHat,free\n");
    const error = parsed.issues.find((issue) => issue.code === "INVALID_PRICE");
    expect(error?.row).toBe(2);
    expect(error?.column).toBe("Price");
  });

  it("rejects a repeated SKU and an invalid product id", () => {
    const parsed = parseProductCsv(
      "Product ID,Title,Handle,SKU,Price\nnot-a-uuid,Hat,hat,SAME,10\n,Cap,cap,SAME,12\n",
    );
    expect(parsed.issues.some((issue) => issue.code === "INVALID_PRODUCT_ID")).toBe(true);
    expect(parsed.issues.some((issue) => issue.code === "DUPLICATE_SKU")).toBe(true);
  });

  it("groups a blank identity row with the previous product", () => {
    const parsed = parseProductCsv(
      "Title,Handle,Option1 Name,Option1 Value,SKU,Price\nTee,tee,Size,Small,TEE-S,19.00\n,,,Medium,TEE-M,19.00\n",
    );
    expect(parsed.groups).toHaveLength(1);
    expect(parsed.groups[0]?.rows).toHaveLength(2);
    expect(parsed.issues.filter((issue) => issue.severity === "error")).toEqual([]);
  });

  it("warns when a column is not a product field", () => {
    const parsed = parseProductCsv("Title,Vendor\nHat,Acme\n");
    expect(parsed.issues.some((issue) => issue.code === "IGNORED_COLUMN" && issue.column === "Vendor")).toBe(true);
  });

  it("rejects an unterminated quoted field", () => {
    expect(() => parseProductCsv('Title\n"Hat')).toThrow(ProductCsvParseError);
  });

  it("parses major-unit prices into minor units", () => {
    expect(parseMajorUnits("19.00")).toEqual({ ok: true, minor: 1900 });
    expect(parseMajorUnits("12.5")).toEqual({ ok: true, minor: 1250 });
    expect(parseMajorUnits("-1").ok).toBe(false);
  });
});
