/**
 * Cal Cart product CSV.
 *
 * One row is one variant. Repeat product columns on each variant row, or leave
 * Product ID, Handle, and Title blank to continue the previous product.
 *
 * Updates match a product by Product ID, otherwise by Handle. A Product ID that
 * does not belong to the current store is rejected and is never used to create
 * a product. Variant rows match by Variant ID, then SKU, then option values,
 * then variant title.
 *
 * Prices are major units with up to two decimal places (19.00). They are stored
 * as integer minor units. Tags, collections, and image URLs are separated with |.
 *
 * Omitted columns keep the current value on update. A blank Description, SKU,
 * Compare At Price, Tags, Product Type, Category, or Collections cell clears
 * that value. A blank Image URLs cell clears the gallery. A blank Price or
 * Available Quantity keeps the current value.
 * Available Quantity 0 sets available stock to zero and does not change reserved
 * stock. Published At, Created At, Updated At, and Currency are informational.
 *
 * The catalogue does not store vendor, barcode, cost, weight, tax, shipping,
 * SEO title, meta description, metafields, or inventory locations.
 *
 * Rows whose first field starts with # are comments. Cells that start with
 * =, +, -, or @ are prefixed on export so a spreadsheet does not treat them
 * as formulas, and that prefix is removed on import.
 */

export const PRODUCT_CSV_MAX_BYTES = 5 * 1024 * 1024;
export const PRODUCT_CSV_MAX_ROWS = 5_000;
export const PRODUCT_CSV_MAX_PRODUCTS = 2_000;

export const PRODUCT_CSV_COLUMNS = [
  "Product ID",
  "Title",
  "Description",
  "Handle",
  "Status",
  "Product Type",
  "Category",
  "Tags",
  "Collections",
  "Published At",
  "Created At",
  "Updated At",
  "Low Stock Threshold",
  "Max Order Quantity",
  "Option1 Name",
  "Option1 Value",
  "Option1 Publishable",
  "Option2 Name",
  "Option2 Value",
  "Option2 Publishable",
  "Option3 Name",
  "Option3 Value",
  "Option3 Publishable",
  "Variant ID",
  "Variant Title",
  "Variant Display Title",
  "Variant Published As Product",
  "SKU",
  "Price",
  "Compare At Price",
  "Currency",
  "Variant Status",
  "Variant Position",
  "Variant Low Stock Threshold",
  "Variant Max Order Quantity",
  "Available Quantity",
  "Image URLs",
  "Image Alt Texts",
  "Image Positions",
  "Variant Image URL",
] as const;

export type ProductCsvColumn = (typeof PRODUCT_CSV_COLUMNS)[number];

export const READ_ONLY_CSV_COLUMNS: ReadonlySet<ProductCsvColumn> = new Set([
  "Published At",
  "Created At",
  "Updated At",
  "Currency",
]);

const COLUMN_ALIASES: Record<string, ProductCsvColumn> = {
  "product title": "Title",
  body: "Description",
  slug: "Handle",
  "url handle": "Handle",
  "product status": "Status",
  type: "Product Type",
  "option 1 name": "Option1 Name",
  "option 1 value": "Option1 Value",
  "option 1 publishable": "Option1 Publishable",
  "option 2 name": "Option2 Name",
  "option 2 value": "Option2 Value",
  "option 2 publishable": "Option2 Publishable",
  "option 3 name": "Option3 Name",
  "option 3 value": "Option3 Value",
  "option 3 publishable": "Option3 Publishable",
  "display title": "Variant Display Title",
  "published as product": "Variant Published As Product",
  "compare-at price": "Compare At Price",
  "inventory quantity": "Available Quantity",
  inventory: "Available Quantity",
  "image url": "Image URLs",
  "featured image": "Image URLs",
  "image alt text": "Image Alt Texts",
};

const PRODUCT_STATUSES = new Set(["DRAFT", "ACTIVE", "ARCHIVED"]);
const VARIANT_STATUSES = new Set(["ACTIVE", "INACTIVE", "ARCHIVED"]);
const BOOL_COLUMNS: ProductCsvColumn[] = [
  "Option1 Publishable",
  "Option2 Publishable",
  "Option3 Publishable",
  "Variant Published As Product",
];
const INT_COLUMNS: ProductCsvColumn[] = [
  "Low Stock Threshold",
  "Max Order Quantity",
  "Variant Position",
  "Variant Low Stock Threshold",
  "Variant Max Order Quantity",
  "Available Quantity",
];
const OPTION_SLOTS = [1, 2, 3] as const;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class ProductCsvParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductCsvParseError";
  }
}

export interface ProductCsvIssue {
  severity: "error" | "warning";
  row: number;
  column: string | null;
  code: string;
  message: string;
}

export interface ParsedCsvRow {
  line: number;
  cells: Partial<Record<ProductCsvColumn, string>>;
}

export interface ParsedProductGroup {
  key: string;
  firstRow: number;
  rows: ParsedCsvRow[];
}

export interface ParsedProductCsv {
  sourceHeaders: string[];
  mapping: Array<{ source: string; target: ProductCsvColumn | null }>;
  columns: ProductCsvColumn[];
  groups: ParsedProductGroup[];
  issues: ProductCsvIssue[];
}

export function isProductCsvColumn(value: string): value is ProductCsvColumn {
  return (PRODUCT_CSV_COLUMNS as readonly string[]).includes(value);
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function formatMajorUnits(minor: number): string {
  const negative = minor < 0;
  const absolute = Math.abs(minor);
  const whole = Math.floor(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

export function parseMajorUnits(
  raw: string,
): { ok: true; minor: number } | { ok: false; message: string } {
  const value = raw.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    return {
      ok: false,
      message: "Enter a price like 19.00. Use major units and at most two decimal places.",
    };
  }
  const [whole, fraction = ""] = value.split(".");
  const minor = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
  if (!Number.isSafeInteger(minor) || minor > 100_000_000_00) {
    return { ok: false, message: "Price is too large." };
  }
  return { ok: true, minor };
}

export function splitPipeList(raw: string): string[] {
  if (!raw.trim()) return [];
  return raw.split("|").map((part) => part.trim());
}

export function buildProductCsvTemplate(): string {
  const comments = [
    "# Cal Cart product CSV (UTF-8). One row per variant. Repeat the product columns on each variant row, or leave Product ID, Handle, and Title blank to continue the previous product.",
    "# Prices are major units with up to two decimals (19.00). The store saves them as integer minor units.",
    "# Updates match a product by Product ID, then by Handle. Variant rows match by Variant ID, then SKU, then option values, then variant title. A Product ID that is not in this store is rejected. Clear Product ID and Variant ID to create new records.",
    "# Create requires Title and Price. On update, an omitted column keeps the current value. A blank Description, SKU, Compare At Price, Tags, Product Type, Category, Collections, or Image URLs cell clears that value. A blank Price or Available Quantity keeps the current value. 0 sets available stock to zero.",
    "# Separate tags, collections, and image URLs with |. Image Alt Texts and Image Positions follow the same order as Image URLs.",
    "# Published At, Created At, Updated At, and Currency are informational. Currency always stays the store currency.",
    "# This catalogue has no vendor, barcode, cost, weight, tax, shipping, SEO title, meta description, metafield, or inventory-location fields, so those values cannot be imported.",
    "# Re-importing an export updates products in place. Variants missing from an update are removed, or archived when an order still references them. Rows whose first field starts with # are comments.",
  ];
  const table = serializeProductCsv([
    [...PRODUCT_CSV_COLUMNS],
    templateRow({
      Title: "Example Tee",
      Description: "A soft cotton tee",
      Handle: "example-tee",
      Status: "ACTIVE",
      "Product Type": "Apparel",
      Category: "Tops",
      Tags: "cotton|summer",
      Collections: "New arrivals",
      "Low Stock Threshold": "5",
      "Option1 Name": "Size",
      "Option1 Value": "Small",
      "Option1 Publishable": "false",
      "Variant Title": "Small",
      "Variant Published As Product": "false",
      SKU: "TEE-S",
      Price: "19.00",
      "Compare At Price": "24.00",
      "Variant Status": "ACTIVE",
      "Variant Position": "0",
      "Available Quantity": "10",
      "Image URLs": "https://example.com/tee.jpg",
      "Image Alt Texts": "Example tee",
      "Image Positions": "0",
      "Variant Image URL": "https://example.com/tee.jpg",
    }),
    templateRow({
      Title: "Example Tee",
      Description: "A soft cotton tee",
      Handle: "example-tee",
      Status: "ACTIVE",
      "Product Type": "Apparel",
      Category: "Tops",
      Tags: "cotton|summer",
      Collections: "New arrivals",
      "Low Stock Threshold": "5",
      "Option1 Name": "Size",
      "Option1 Value": "Medium",
      "Option1 Publishable": "false",
      "Variant Title": "Medium",
      "Variant Published As Product": "false",
      SKU: "TEE-M",
      Price: "19.00",
      "Compare At Price": "24.00",
      "Variant Status": "ACTIVE",
      "Variant Position": "1",
      "Available Quantity": "5",
      "Image URLs": "https://example.com/tee.jpg",
      "Image Alt Texts": "Example tee",
      "Image Positions": "0",
      "Variant Image URL": "https://example.com/tee.jpg",
    }),
    templateRow({
      Title: "Example Hat",
      Description: "A wool hat",
      Handle: "example-hat",
      Status: "DRAFT",
      Tags: "wool",
      "Low Stock Threshold": "5",
      "Variant Title": "Default Title",
      "Variant Published As Product": "false",
      SKU: "HAT-1",
      Price: "12.50",
      "Variant Status": "ACTIVE",
      "Variant Position": "0",
      "Available Quantity": "3",
    }),
  ]);
  return `\uFEFF${comments.join("\r\n")}\r\n${table}`;
}

export function serializeProductCsv(rows: Array<Array<string | number | null | undefined>>): string {
  return `${rows
    .map((row) => row.map((cell) => escapeCell(cell == null ? "" : String(cell))).join(","))
    .join("\r\n")}\r\n`;
}

export function parseProductCsv(
  text: string,
  columnMap?: Record<string, string | null>,
): ParsedProductCsv {
  if (text.length > PRODUCT_CSV_MAX_BYTES || text.includes("\u0000")) {
    throw new ProductCsvParseError(
      text.includes("\u0000")
        ? "This file is not a UTF-8 CSV."
        : "The CSV file exceeds the 5 MB limit.",
    );
  }

  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const records = parseRecords(source);
  const issues: ProductCsvIssue[] = [];
  const content = records.filter((record) => !isCommentRecord(record.cells));
  const header = content[0];
  if (!header || header.cells.every((cell) => cell.trim() === "")) {
    throw new ProductCsvParseError("The CSV needs a header row.");
  }

  const sourceHeaders = header.cells.map((cell) => cell.trim());
  if (sourceHeaders.some((headerCell) => headerCell.length === 0)) {
    issues.push(makeIssue(header.line, null, "error", "EMPTY_HEADER", "Every header cell needs a name."));
  }
  const seenHeaders = new Set<string>();
  for (const headerCell of sourceHeaders) {
    const key = headerCell.toLowerCase();
    if (!key) continue;
    if (seenHeaders.has(key)) {
      issues.push(
        makeIssue(header.line, headerCell, "error", "DUPLICATE_HEADER", `The column "${headerCell}" appears more than once.`),
      );
    }
    seenHeaders.add(key);
  }

  const mapping = resolveMapping(sourceHeaders, columnMap, header.line, issues);
  const columns: ProductCsvColumn[] = [];
  const seenTargets = new Set<ProductCsvColumn>();
  for (const entry of mapping) {
    if (entry.target && !seenTargets.has(entry.target)) {
      seenTargets.add(entry.target);
      columns.push(entry.target);
    }
  }

  if (!seenTargets.has("Product ID") && !seenTargets.has("Title") && !seenTargets.has("Handle")) {
    issues.push(
      makeIssue(
        header.line,
        null,
        "error",
        "MISSING_IDENTITY_COLUMN",
        "Map a Title, Handle, or Product ID column before importing.",
      ),
    );
  }

  const dataRecords = content.slice(1).filter((record) => record.cells.some((cell) => cell.trim() !== ""));
  if (dataRecords.length === 0) {
    issues.push(makeIssue(header.line, null, "error", "NO_ROWS", "The CSV has no product rows."));
  }
  if (dataRecords.length > PRODUCT_CSV_MAX_ROWS) {
    throw new ProductCsvParseError(
      `A CSV import can include at most ${PRODUCT_CSV_MAX_ROWS} data rows.`,
    );
  }

  const rows: ParsedCsvRow[] = [];
  for (const record of dataRecords) {
    if (record.cells.length > sourceHeaders.length) {
      issues.push(
        makeIssue(record.line, null, "error", "EXTRA_CELLS", "This row has more cells than the header."),
      );
    }
    const cells: Partial<Record<ProductCsvColumn, string>> = {};
    mapping.forEach((entry, index) => {
      if (!entry.target) return;
      cells[entry.target] = undoSpreadsheetGuard(record.cells[index] ?? "");
    });
    const row: ParsedCsvRow = { line: record.line, cells };
    validateRow(row, seenTargets, issues);
    rows.push(row);
  }

  const groups = groupRows(rows, issues);
  if (groups.length > PRODUCT_CSV_MAX_PRODUCTS) {
    throw new ProductCsvParseError(
      `A CSV import can include at most ${PRODUCT_CSV_MAX_PRODUCTS} products.`,
    );
  }
  validateGroups(groups, seenTargets, issues);

  return { sourceHeaders, mapping, columns, groups, issues };
}

function templateRow(values: Partial<Record<ProductCsvColumn, string>>): string[] {
  return PRODUCT_CSV_COLUMNS.map((column) => values[column] ?? "");
}

function makeIssue(
  row: number,
  column: string | null,
  severity: "error" | "warning",
  code: string,
  message: string,
): ProductCsvIssue {
  return { severity, row, column, code, message };
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function autoTarget(header: string): ProductCsvColumn | null {
  const normalized = normalizeHeader(header);
  const canonical = PRODUCT_CSV_COLUMNS.find((column) => column.toLowerCase() === normalized);
  if (canonical) return canonical;
  return COLUMN_ALIASES[normalized] ?? null;
}

function resolveMapping(
  headers: string[],
  columnMap: Record<string, string | null> | undefined,
  headerLine: number,
  issues: ProductCsvIssue[],
): Array<{ source: string; target: ProductCsvColumn | null }> {
  const used = new Set<ProductCsvColumn>();
  return headers.map((header) => {
    let target: ProductCsvColumn | null = null;
    if (columnMap && Object.prototype.hasOwnProperty.call(columnMap, header)) {
      const requested = columnMap[header];
      if (requested === null || requested === "") {
        target = null;
      } else if (isProductCsvColumn(requested)) {
        target = requested;
      } else {
        issues.push(
          makeIssue(headerLine, header, "error", "UNKNOWN_TARGET", `Cannot map "${header}" to an unknown field.`),
        );
      }
    } else if (!columnMap) {
      target = autoTarget(header);
      if (!target && header.trim()) {
        issues.push(
          makeIssue(
            headerLine,
            header,
            "warning",
            "IGNORED_COLUMN",
            `Column "${header}" is not a Cal Cart product field and will be ignored.`,
          ),
        );
      }
    } else if (header.trim()) {
      issues.push(
        makeIssue(headerLine, header, "warning", "UNMAPPED_COLUMN", `Column "${header}" is not mapped.`),
      );
    }

    if (target && used.has(target)) {
      issues.push(
        makeIssue(
          headerLine,
          header,
          "error",
          "DUPLICATE_MAPPING",
          `More than one column is mapped to ${target}.`,
        ),
      );
      target = null;
    }
    if (target) used.add(target);
    return { source: header, target };
  });
}

interface CsvRecord {
  line: number;
  cells: string[];
}

function parseRecords(text: string): CsvRecord[] {
  const records: CsvRecord[] = [];
  let cell = "";
  let row: string[] = [];
  let rowStartLine = 1;
  let line = 1;
  let inQuotes = false;

  const pushRow = () => {
    row.push(cell);
    cell = "";
    if (!(row.length === 1 && (row[0] ?? "") === "")) {
      records.push({ line: rowStartLine, cells: row });
    }
    row = [];
    rowStartLine = line;
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === undefined) break;
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        if (char === "\n") line += 1;
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      line += 1;
      pushRow();
      continue;
    }
    cell += char;
  }

  if (inQuotes) {
    throw new ProductCsvParseError("The CSV has an unterminated quoted field.");
  }
  if (cell.length > 0 || row.length > 0) {
    pushRow();
  }
  return records;
}

function isCommentRecord(cells: string[]): boolean {
  return (cells[0] ?? "").trim().startsWith("#");
}

function undoSpreadsheetGuard(value: string): string {
  if (value.startsWith("'") && /^[=+\-@\t\r]/.test(value.slice(1))) {
    return value.slice(1);
  }
  return value;
}

function escapeCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

function validateRow(
  row: ParsedCsvRow,
  present: Set<ProductCsvColumn>,
  issues: ProductCsvIssue[],
): void {
  const cell = (column: ProductCsvColumn): string | undefined => {
    if (!present.has(column)) return undefined;
    return row.cells[column] ?? "";
  };

  const productId = cell("Product ID")?.trim() ?? "";
  if (productId && !isUuid(productId)) {
    issues.push(makeIssue(row.line, "Product ID", "error", "INVALID_PRODUCT_ID", "Product ID must be a UUID from this store."));
  }
  const variantId = cell("Variant ID")?.trim() ?? "";
  if (variantId && !isUuid(variantId)) {
    issues.push(makeIssue(row.line, "Variant ID", "error", "INVALID_VARIANT_ID", "Variant ID must be a UUID from this store."));
  }

  const title = cell("Title");
  if (title && title.trim().length > 255) {
    issues.push(makeIssue(row.line, "Title", "error", "TITLE_TOO_LONG", "Title cannot exceed 255 characters."));
  }
  const description = cell("Description");
  if (description && description.length > 20_000) {
    issues.push(makeIssue(row.line, "Description", "error", "DESCRIPTION_TOO_LONG", "Description cannot exceed 20000 characters."));
  }
  const handle = cell("Handle");
  if (handle && handle.trim().length > 200) {
    issues.push(makeIssue(row.line, "Handle", "error", "HANDLE_TOO_LONG", "Handle cannot exceed 200 characters."));
  }
  const sku = cell("SKU");
  if (sku && sku.trim().length > 100) {
    issues.push(makeIssue(row.line, "SKU", "error", "SKU_TOO_LONG", "SKU cannot exceed 100 characters."));
  }

  const status = cell("Status")?.trim() ?? "";
  if (status && !PRODUCT_STATUSES.has(status.toUpperCase())) {
    issues.push(makeIssue(row.line, "Status", "error", "INVALID_STATUS", "Status must be ACTIVE, DRAFT, or ARCHIVED."));
  }
  const variantStatus = cell("Variant Status")?.trim() ?? "";
  if (variantStatus && !VARIANT_STATUSES.has(variantStatus.toUpperCase())) {
    issues.push(
      makeIssue(row.line, "Variant Status", "error", "INVALID_VARIANT_STATUS", "Variant status must be ACTIVE, INACTIVE, or ARCHIVED."),
    );
  }

  for (const column of BOOL_COLUMNS) {
    const value = cell(column)?.trim() ?? "";
    if (value && !isBooleanText(value)) {
      issues.push(makeIssue(row.line, column, "error", "INVALID_BOOLEAN", `${column} must be true or false.`));
    }
  }
  for (const column of INT_COLUMNS) {
    const value = cell(column)?.trim() ?? "";
    if (!value) continue;
    const message = wholeNumberMessage(value, column);
    if (message) issues.push(makeIssue(row.line, column, "error", "INVALID_NUMBER", message));
  }

  for (const column of ["Price", "Compare At Price"] as const) {
    const value = cell(column)?.trim() ?? "";
    if (!value) continue;
    const parsed = parseMajorUnits(value);
    if (!parsed.ok) issues.push(makeIssue(row.line, column, "error", "INVALID_PRICE", parsed.message));
  }

  const variantImage = cell("Variant Image URL")?.trim() ?? "";
  if (variantImage && !isHttpUrl(variantImage)) {
    issues.push(makeIssue(row.line, "Variant Image URL", "error", "INVALID_URL", "Variant image URL must start with http:// or https://."));
  }

  validatePipeList(row, "Image URLs", cell("Image URLs"), issues, (part) => {
    if (!part) return "Image URLs has an empty entry. Remove the extra |.";
    if (!isHttpUrl(part)) return "Each image URL must start with http:// or https://.";
    return null;
  });
  const urls = splitPipeList(cell("Image URLs") ?? "");
  const alts = splitPipeList(cell("Image Alt Texts") ?? "");
  const positions = splitPipeList(cell("Image Positions") ?? "");
  if ((cell("Image Alt Texts") ?? "").trim() && urls.length > 0 && alts.length !== urls.length) {
    issues.push(
      makeIssue(row.line, "Image Alt Texts", "error", "LIST_LENGTH", "Image Alt Texts must have one entry for each image URL."),
    );
  }
  if ((cell("Image Positions") ?? "").trim()) {
    if (positions.some((part) => wholeNumberMessage(part, "Image position"))) {
      issues.push(makeIssue(row.line, "Image Positions", "error", "INVALID_NUMBER", "Each image position must be a whole number."));
    } else if (urls.length > 0 && positions.length !== urls.length) {
      issues.push(
        makeIssue(row.line, "Image Positions", "error", "LIST_LENGTH", "Image Positions must have one entry for each image URL."),
      );
    }
  }

  const tags = splitPipeList(cell("Tags") ?? "").filter(Boolean);
  if (tags.length > 50 || tags.some((tag) => tag.length > 50)) {
    issues.push(makeIssue(row.line, "Tags", "error", "INVALID_TAGS", "Use at most 50 tags, and keep each tag to 50 characters."));
  }
  const collections = splitPipeList(cell("Collections") ?? "").filter(Boolean);
  if (collections.length > 50 || collections.some((title) => title.length > 255)) {
    issues.push(
      makeIssue(row.line, "Collections", "error", "INVALID_COLLECTIONS", "Use at most 50 collections, and keep each name to 255 characters."),
    );
  }
}

function validatePipeList(
  row: ParsedCsvRow,
  column: ProductCsvColumn,
  raw: string | undefined,
  issues: ProductCsvIssue[],
  check: (part: string) => string | null,
): void {
  if (!raw || !raw.trim()) return;
  for (const part of splitPipeList(raw)) {
    const message = check(part);
    if (message) {
      issues.push(makeIssue(row.line, column, "error", "INVALID_LIST", message));
      return;
    }
  }
}

function isBooleanText(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return ["true", "false", "yes", "no", "y", "n", "1", "0"].includes(normalized);
}

export function parseBooleanText(value: string): boolean | null {
  const normalized = value.trim().toLowerCase();
  if (["true", "yes", "y", "1"].includes(normalized)) return true;
  if (["false", "no", "n", "0"].includes(normalized)) return false;
  return null;
}

function wholeNumberMessage(value: string, label: string): string | null {
  if (!/^\d+$/.test(value.trim())) {
    return `${label} must be a whole number of 0 or more.`;
  }
  if (value.trim().length > 7 || Number(value) > 1_000_000) {
    return `${label} cannot be greater than 1000000.`;
  }
  return null;
}

function isHttpUrl(value: string): boolean {
  if (value.length > 2000 || /\s/.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function groupRows(rows: ParsedCsvRow[], issues: ProductCsvIssue[]): ParsedProductGroup[] {
  const groups: ParsedProductGroup[] = [];
  const byKey = new Map<string, ParsedProductGroup>();
  let current: ParsedProductGroup | null = null;

  for (const row of rows) {
    const productId = (row.cells["Product ID"] ?? "").trim();
    const handle = (row.cells["Handle"] ?? "").trim();
    const title = (row.cells["Title"] ?? "").trim();
    if (!productId && !handle && !title) {
      if (!current) {
        issues.push(
          makeIssue(
            row.line,
            "Title",
            "error",
            "ORPHAN_VARIANT",
            "This variant row has no product. Add a Title, Handle, or Product ID, or place it under a product row.",
          ),
        );
        continue;
      }
      current.rows.push(row);
      continue;
    }

    const key = productId
      ? `id:${productId.toLowerCase()}`
      : handle
        ? `handle:${handle.toLowerCase()}`
        : `title:${title.toLowerCase()}`;
    let group = byKey.get(key);
    if (!group) {
      group = { key, firstRow: row.line, rows: [] };
      byKey.set(key, group);
      groups.push(group);
      if (key.startsWith("title:")) {
        issues.push(
          makeIssue(
            row.line,
            "Handle",
            "warning",
            "TITLE_ONLY_PRODUCT",
            "This product has no Product ID or Handle, so it cannot update an existing product. A new product will be created, and another row with the same title will be treated as the same product.",
          ),
        );
      }
    }
    group.rows.push(row);
    current = group;
  }

  return groups;
}

function validateGroups(
  groups: ParsedProductGroup[],
  present: Set<ProductCsvColumn>,
  issues: ProductCsvIssue[],
): void {
  const variantIds = new Map<string, number>();
  const skus = new Map<string, number>();

  for (const group of groups) {
    const groupSkus = new Set<string>();
    for (const slot of OPTION_SLOTS) {
      const nameColumn = `Option${slot} Name` as ProductCsvColumn;
      const valueColumn = `Option${slot} Value` as ProductCsvColumn;
      if (!present.has(nameColumn) && !present.has(valueColumn)) continue;
      const names = new Set<string>();
      let sawValue = false;
      for (const row of group.rows) {
        const name = (row.cells[nameColumn] ?? "").trim();
        const value = (row.cells[valueColumn] ?? "").trim();
        if (name) names.add(name.toLowerCase());
        if (value) sawValue = true;
        if (name.length > 100) {
          issues.push(makeIssue(row.line, nameColumn, "error", "OPTION_NAME_TOO_LONG", "Option names cannot exceed 100 characters."));
        }
        if (value.length > 255) {
          issues.push(makeIssue(row.line, valueColumn, "error", "OPTION_VALUE_TOO_LONG", "Option values cannot exceed 255 characters."));
        }
      }
      if (names.size > 1) {
        issues.push(
          makeIssue(
            group.firstRow,
            nameColumn,
            "error",
            "INCONSISTENT_OPTION",
            `${nameColumn} must be the same on every row of this product.`,
          ),
        );
      }
      if (sawValue && names.size === 0) {
        issues.push(
          makeIssue(group.firstRow, nameColumn, "error", "OPTION_VALUE_WITHOUT_NAME", `${valueColumn} needs ${nameColumn}.`),
        );
      }
    }

    for (const row of group.rows) {
      const variantId = (row.cells["Variant ID"] ?? "").trim().toLowerCase();
      if (variantId) {
        const previous = variantIds.get(variantId);
        if (previous !== undefined) {
          issues.push(
            makeIssue(row.line, "Variant ID", "error", "DUPLICATE_VARIANT_ID", `Variant ID is also used on row ${previous}.`),
          );
        } else {
          variantIds.set(variantId, row.line);
        }
      }
      const sku = (row.cells["SKU"] ?? "").trim();
      if (!sku) continue;
      const lowered = sku.toLowerCase();
      if (groupSkus.has(lowered)) {
        issues.push(makeIssue(row.line, "SKU", "error", "DUPLICATE_SKU", `SKU "${sku}" is repeated on this product.`));
      }
      groupSkus.add(lowered);
      const exact = skus.get(sku);
      if (exact !== undefined) {
        issues.push(makeIssue(row.line, "SKU", "error", "DUPLICATE_SKU", `SKU "${sku}" is also used on row ${exact}.`));
      } else {
        skus.set(sku, row.line);
      }
    }
  }
}
