"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, FileDown, FileUp, X } from "lucide-react";
import { apiClient, ApiClientError } from "../../../lib/api-client";

type Strategy = "create" | "update" | "upsert";
type ExportScope = "all" | "filtered" | "selected";

interface CsvIssue {
  severity: "error" | "warning";
  row: number;
  column: string | null;
  code: string;
  message: string;
}

interface CsvPreview {
  mapping: Array<{ source: string; target: string | null }>;
  availableColumns: string[];
  productCount: number;
  variantCount: number;
  newProductCount: number;
  existingProductCount: number;
  errors: CsvIssue[];
  warnings: CsvIssue[];
  issuesTruncated: boolean;
  products: Array<{
    row: number;
    title: string;
    handle: string;
    status: string;
    variantCount: number;
    matchedProductId: string | null;
  }>;
  productsTruncated: boolean;
}

interface CsvImportResult {
  applied: boolean;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: CsvIssue[];
  warnings: CsvIssue[];
  outcomes: Array<{
    row: number;
    title: string;
    action: "created" | "updated" | "skipped" | "failed";
    productId?: string;
    message?: string;
  }>;
}

export interface ProductCsvActionsProps {
  storeId: string;
  canImport: boolean;
  search: string;
  status: string;
  selectedIds: string[];
  onImported: () => void;
}

const INCLUDED = [
  "Product, handle, status, type, category, tags, and collections",
  "Up to three options and every variant",
  "Price, compare-at price, SKU, and available quantity",
  "Images, alt text, and position",
];

export function ProductCsvActions({
  storeId,
  canImport,
  search,
  status,
  selectedIds,
  onImported,
}: ProductCsvActionsProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  return (
    <>
      <button type="button" className="btn btn-sm inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold" onClick={() => void downloadTemplate(storeId)}>
        <Download size={14} />
        <span>Template</span>
      </button>
      <button type="button" className="btn btn-sm inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold" onClick={() => setExportOpen(true)}>
        <FileDown size={14} />
        <span>Export</span>
      </button>
      <button
        type="button"
        className="btn btn-sm inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
        onClick={() => setImportOpen(true)}
        disabled={!canImport}
        title={canImport ? "Import products from a CSV file" : "Only store admins can import products"}
      >
        <FileUp size={14} />
        <span>Import</span>
      </button>
      {exportOpen && (
        <ExportDialog
          storeId={storeId}
          search={search}
          status={status}
          selectedIds={selectedIds}
          onClose={() => setExportOpen(false)}
        />
      )}
      {importOpen && (
        <ImportDialog
          storeId={storeId}
          onClose={() => setImportOpen(false)}
          onImported={onImported}
        />
      )}
    </>
  );
}

function ExportDialog({
  storeId,
  search,
  status,
  selectedIds,
  onClose,
}: {
  storeId: string;
  search: string;
  status: string;
  selectedIds: string[];
  onClose: () => void;
}) {
  const [scope, setScope] = useState<ExportScope>(selectedIds.length > 0 ? "selected" : "filtered");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();

  async function runExport() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/v1/stores/${storeId}/products/export`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "x-store-id": storeId,
        },
        body: JSON.stringify({
          scope,
          status: scope === "filtered" && status !== "ALL" ? status : undefined,
          search: scope === "filtered" ? search : undefined,
          productIds: scope === "selected" ? selectedIds : undefined,
        }),
      });
      if (!response.ok) {
        throw new Error(await errorMessage(response));
      }
      const count = response.headers.get("X-Export-Product-Count") ?? "0";
      const variants = response.headers.get("X-Export-Variant-Count") ?? "0";
      const truncated = response.headers.get("X-Export-Truncated") === "1";
      const skipped = response.headers.get("X-Export-Skipped") ?? "0";
      downloadBlob(await response.blob(), "cal-cart-products.csv");
      const notes = [
        `Exported ${count} products and ${variants} variants.`,
        truncated ? "The export stopped at 2000 products." : "",
        skipped !== "0" ? `${skipped} selected products were not in this store and were left out.` : "",
      ].filter(Boolean);
      setMessage(notes.join(" "));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <CsvDialog titleId={titleId} title="Export products" onClose={onClose}>
      <fieldset className="space-y-2" disabled={busy}>
        <legend className="text-xs font-semibold text-foreground">What to export</legend>
        <ScopeOption
          name="export-scope"
          value="all"
          checked={scope === "all"}
          onChange={() => setScope("all")}
          label="All products"
          detail="Every product in this store, up to 2000."
        />
        <ScopeOption
          name="export-scope"
          value="filtered"
          checked={scope === "filtered"}
          onChange={() => setScope("filtered")}
          label="Current search and status"
          detail={filterDetail(search, status)}
        />
        <ScopeOption
          name="export-scope"
          value="selected"
          checked={scope === "selected"}
          onChange={() => setScope("selected")}
          label={`Selected products (${selectedIds.length})`}
          detail="Only the products checked in the list."
          disabled={selectedIds.length === 0}
        />
      </fieldset>
      <div className="mt-4 rounded-lg border border-border/70 bg-muted/30 p-3">
        <p className="text-xs font-semibold text-foreground">Included data</p>
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          {INCLUDED.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          Prices are decimal amounts such as 19.00. The file can be edited and imported again.
        </p>
      </div>
      {busy && <Progress label="Preparing the CSV" />}
      {message && <p className="mt-3 text-xs text-foreground" role="status">{message}</p>}
      {error && <p className="mt-3 text-xs text-red-600" role="alert">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="btn btn-sm rounded-lg px-3 py-1.5 text-xs" onClick={onClose}>Close</button>
        <button
          type="button"
          className="btn btn-primary btn-sm rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          onClick={() => void runExport()}
          disabled={busy || (scope === "selected" && selectedIds.length === 0)}
        >
          {busy ? "Exporting..." : "Download CSV"}
        </button>
      </div>
    </CsvDialog>
  );
}

function ImportDialog({
  storeId,
  onClose,
  onImported,
}: {
  storeId: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const running = useRef(false);
  const idempotencyKey = useRef<string | null>(null);
  const titleId = useId();
  const [fileName, setFileName] = useState<string | null>(null);
  const [csv, setCsv] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [mappingDirty, setMappingDirty] = useState(false);
  const [strategy, setStrategy] = useState<Strategy>("upsert");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("Checking the file");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CsvImportResult | null>(null);

  useEffect(() => {
    idempotencyKey.current = null;
  }, [csv, strategy, mapping]);

  async function loadFile(file: File) {
    setError(null);
    setResult(null);
    setPreview(null);
    setConfirmed(false);
    if (file.size > 5 * 1024 * 1024) {
      setError("The CSV file exceeds the 5 MB limit.");
      return;
    }
    if (file.name && !file.name.toLowerCase().endsWith(".csv") && file.type && !file.type.includes("csv") && file.type !== "text/plain") {
      setError("Upload a .csv file.");
      return;
    }
    const text = await file.text();
    if (text.includes("\u0000")) {
      setError("This file is not a UTF-8 CSV.");
      return;
    }
    setFileName(file.name);
    setCsv(text);
    await requestPreview(text);
  }

  async function requestPreview(text = csv, nextMapping?: Record<string, string | null>) {
    if (!text) return;
    setBusy(true);
    setBusyLabel("Checking the file");
    setError(null);
    try {
      const response = await apiClient.post<CsvPreview>(
        `/api/v1/stores/${storeId}/products/import/preview`,
        { csv: text, columnMap: nextMapping },
        { storeId, timeoutMs: 120_000 },
      );
      setPreview(response);
      if (!nextMapping) {
        const initial: Record<string, string | null> = {};
        for (const column of response.mapping) initial[column.source] = column.target;
        setMapping(initial);
      }
      setMappingDirty(false);
    } catch (err) {
      setPreview(null);
      setError(err instanceof ApiClientError ? err.message : "The CSV could not be checked.");
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    if (!csv || !preview || running.current) return;
    running.current = true;
    setBusy(true);
    setBusyLabel("Importing products");
    setError(null);
    try {
      if (!idempotencyKey.current) idempotencyKey.current = crypto.randomUUID();
      const response = await apiClient.post<CsvImportResult>(
        `/api/v1/stores/${storeId}/products/import`,
        { csv, strategy, columnMap: mapping },
        {
          storeId,
          timeoutMs: 180_000,
          headers: { "Idempotency-Key": idempotencyKey.current },
        },
      );
      idempotencyKey.current = null;
      setResult(response);
      if (response.applied) onImported();
    } catch (err) {
      const retryable = err instanceof ApiClientError && (err.status === 0 || err.status === 408 || err.status === 409);
      if (!retryable) idempotencyKey.current = null;
      if (err instanceof ApiClientError && err.code === "CSV_VALIDATION_FAILED" && isImportResult(err.details)) {
        setResult(err.details);
      } else {
        setError(err instanceof ApiClientError ? err.message : "Import failed.");
      }
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  const willCreate = strategy === "update" ? 0 : preview?.newProductCount ?? 0;
  const willUpdate = strategy === "create" ? 0 : preview?.existingProductCount ?? 0;
  const willSkip =
    strategy === "create"
      ? preview?.existingProductCount ?? 0
      : strategy === "update"
        ? preview?.newProductCount ?? 0
        : 0;
  const blocked = !preview || preview.errors.length > 0 || mappingDirty || !confirmed;

  return (
    <CsvDialog titleId={titleId} title="Import products" onClose={onClose} wide>
      <div
        className={`rounded-xl border border-dashed p-4 transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-border bg-muted/20"}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          const file = event.dataTransfer.files[0];
          if (file) void loadFile(file);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          id="product-csv-file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void loadFile(file);
          }}
        />
        <label htmlFor="product-csv-file" className="flex cursor-pointer flex-col gap-1 text-xs">
          <span className="font-semibold text-foreground">Drop a CSV here or browse</span>
          <span className="text-muted-foreground">UTF-8, up to 5 MB and 5,000 rows. Use the template for the column names.</span>
        </label>
        {fileName && (
          <p className="mt-2 text-xs text-foreground">
            {fileName}
            {csv ? ` · ${Math.max(1, Math.round(csv.length / 1024))} KB` : ""}
          </p>
        )}
      </div>

      {busy && <Progress label={busyLabel} />}
      {error && <p className="mt-3 text-xs text-red-600" role="alert">{error}</p>}

      {preview && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="Products" value={preview.productCount} />
            <Metric label="Variants" value={preview.variantCount} />
            <Metric label="New" value={preview.newProductCount} />
            <Metric label="Existing" value={preview.existingProductCount} />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-foreground">Column mapping</h3>
              <button
                type="button"
                className="text-xs font-semibold text-primary disabled:opacity-50"
                disabled={!mappingDirty || busy}
                onClick={() => void requestPreview(csv, mapping)}
              >
                Update preview
              </button>
            </div>
            <div className="max-h-40 space-y-2 overflow-auto pr-1">
              {preview.mapping.map((column, index) => (
                <label key={`${column.source}-${index}`} className="grid grid-cols-[1fr_1fr] items-center gap-2 text-xs">
                  <span className="truncate text-muted-foreground">{column.source}</span>
                  <select
                    className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                    value={mapping[column.source] ?? ""}
                    aria-label={`Map ${column.source}`}
                    onChange={(event) => {
                      setMapping((current) => ({
                        ...current,
                        [column.source]: event.target.value || null,
                      }));
                      setMappingDirty(true);
                      setConfirmed(false);
                    }}
                  >
                    <option value="">Ignore</option>
                    {preview.availableColumns.map((target) => (
                      <option key={target} value={target}>{target}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>

          <IssueList title="Errors" issues={preview.errors} tone="danger" truncated={preview.issuesTruncated} />
          <IssueList title="Warnings" issues={preview.warnings} tone="warning" truncated={preview.issuesTruncated} />

          {preview.products.length > 0 && (
            <div className="overflow-auto rounded-lg border border-border/70">
              <table className="w-full text-left text-xs">
                <caption className="sr-only">Import preview</caption>
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1.5 font-semibold">Row</th>
                    <th className="px-2 py-1.5 font-semibold">Product</th>
                    <th className="px-2 py-1.5 font-semibold">Handle</th>
                    <th className="px-2 py-1.5 font-semibold">Variants</th>
                    <th className="px-2 py-1.5 font-semibold">Match</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.products.slice(0, 8).map((product) => (
                    <tr key={`${product.row}-${product.handle}`} className="border-t border-border/60">
                      <td className="px-2 py-1.5 font-mono">{product.row}</td>
                      <td className="px-2 py-1.5">{product.title}</td>
                      <td className="px-2 py-1.5 font-mono">{product.handle || "—"}</td>
                      <td className="px-2 py-1.5">{product.variantCount}</td>
                      <td className="px-2 py-1.5">{product.matchedProductId ? "Update" : "Create"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-foreground">Import strategy</legend>
            <StrategyOption value="upsert" current={strategy} onChange={setStrategy} label="Create new products and update existing products" />
            <StrategyOption value="create" current={strategy} onChange={setStrategy} label="Create new products only" />
            <StrategyOption value="update" current={strategy} onChange={setStrategy} label="Update existing products only" />
            <p className="text-xs text-muted-foreground">
              This will create {willCreate}, update {willUpdate}, and skip {willSkip}. Products are saved one at a time. A failed product is left unchanged.
            </p>
          </fieldset>

          <label className="flex items-start gap-2 text-xs">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-primary"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <span>I have reviewed the preview. Importing will change this store&apos;s catalogue as shown.</span>
          </label>
        </div>
      )}

      {result && <ResultSummary result={result} />}

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {(preview?.errors.length || preview?.warnings.length) ? (
          <button
            type="button"
            className="btn btn-sm rounded-lg px-3 py-1.5 text-xs"
            onClick={() => downloadText(issuesToCsv([...(preview?.errors ?? []), ...(preview?.warnings ?? [])]), "cal-cart-import-issues.csv")}
          >
            Download issue report
          </button>
        ) : null}
        <button type="button" className="btn btn-sm rounded-lg px-3 py-1.5 text-xs" onClick={onClose}>Close</button>
        <button
          type="button"
          className="btn btn-primary btn-sm rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          disabled={blocked || busy || !csv}
          onClick={() => void runImport()}
        >
          {busy ? "Working..." : "Import products"}
        </button>
      </div>
    </CsvDialog>
  );
}

function ResultSummary({ result }: { result: CsvImportResult }) {
  const failures = result.outcomes.filter((outcome) => outcome.action === "failed");
  return (
    <div className="mt-4 rounded-lg border border-border/70 p-3" role="status">
      <p className="text-xs font-semibold text-foreground">
        {result.applied ? "Import finished" : "Import was not applied"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Created {result.created}, updated {result.updated}, skipped {result.skipped}, failed {result.failed}.
      </p>
      {failures.length > 0 && (
        <ul className="mt-2 max-h-28 space-y-1 overflow-auto text-xs text-red-600">
          {failures.slice(0, 8).map((failure) => (
            <li key={`${failure.row}-${failure.title}`}>Row {failure.row}: {failure.message || "This product could not be imported."}</li>
          ))}
        </ul>
      )}
      {failures.length > 0 && (
        <button
          type="button"
          className="mt-2 text-xs font-semibold text-primary"
          onClick={() => downloadText(outcomesToCsv(failures), "cal-cart-import-failures.csv")}
        >
          Download failure report
        </button>
      )}
    </div>
  );
}

function CsvDialog({
  title,
  titleId,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  titleId: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const dialog = (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="modal max-h-[85dvh] overflow-auto"
        style={{ width: "100%", maxWidth: wide ? "48rem" : "32rem" }}
      >
        <div className="modal__header">
          <h2 id={titleId} className="modal__title">{title}</h2>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onClose} aria-label="Close dialog">
            <X size={16} />
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );

  // These actions live in the merchant header, which uses backdrop-filter.
  // That makes the header the containing block for position:fixed, so the
  // dialog opens against the button and spills over the top bar.
  if (typeof document === "undefined") {
    return dialog;
  }
  return createPortal(dialog, document.body);
}

function ScopeOption({
  name,
  value,
  checked,
  onChange,
  label,
  detail,
  disabled = false,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  detail: string;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${checked ? "border-primary" : "border-border"} ${disabled ? "opacity-50" : ""}`}>
      <input className="mt-0.5" type="radio" name={name} value={value} checked={checked} disabled={disabled} onChange={onChange} />
      <span>
        <span className="block font-semibold text-foreground">{label}</span>
        <span className="text-muted-foreground">{detail}</span>
      </span>
    </label>
  );
}

function StrategyOption({
  value,
  current,
  onChange,
  label,
}: {
  value: Strategy;
  current: Strategy;
  onChange: (value: Strategy) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 text-xs">
      <input type="radio" name="import-strategy" value={value} checked={current === value} onChange={() => onChange(value)} />
      <span>{label}</span>
    </label>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border/70 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

function IssueList({
  title,
  issues,
  tone,
  truncated,
}: {
  title: string;
  issues: CsvIssue[];
  tone: "danger" | "warning";
  truncated: boolean;
}) {
  if (issues.length === 0) return null;
  const color = tone === "danger" ? "text-red-600" : "text-amber-700";
  return (
    <div>
      <h3 className={`text-xs font-semibold ${color}`}>{title} ({issues.length})</h3>
      <ul className="mt-1 max-h-28 space-y-1 overflow-auto text-xs">
        {issues.slice(0, 8).map((item, index) => (
          <li key={`${item.row}-${item.code}-${index}`} className={color}>
            Row {item.row}{item.column ? `, ${item.column}` : ""}: {item.message}
          </li>
        ))}
      </ul>
      {truncated && <p className="mt-1 text-xs text-muted-foreground">The on-screen list is shortened. Download the issue report for the rest.</p>}
    </div>
  );
}

function Progress({ label }: { label: string }) {
  return (
    <div className="mt-3" role="progressbar" aria-valuetext={label}>
      <div className="h-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function filterDetail(search: string, status: string): string {
  const parts: string[] = [];
  if (search.trim()) parts.push(`search "${search.trim()}"`);
  if (status !== "ALL") parts.push(status.toLowerCase());
  return parts.length > 0 ? `Matches ${parts.join(" and ")} across the catalogue.` : "Every status, using the catalogue search.";
}

function isImportResult(value: unknown): value is CsvImportResult {
  return Boolean(value && typeof value === "object" && "applied" in value && "outcomes" in value);
}

async function downloadTemplate(storeId: string) {
  const response = await fetch(`/api/v1/stores/${storeId}/products/import/template`, {
    credentials: "same-origin",
    headers: { "x-store-id": storeId },
  });
  if (!response.ok) return;
  downloadBlob(await response.blob(), "cal-cart-product-template.csv");
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    return body.error?.message || "The request failed.";
  } catch {
    return "The request failed.";
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadText(csv: string, filename: string) {
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), filename);
}

function issuesToCsv(issues: CsvIssue[]): string {
  const rows = ["Row,Column,Severity,Code,Message"];
  for (const item of issues) {
    rows.push([item.row, item.column ?? "", item.severity, item.code, item.message].map(csvCell).join(","));
  }
  return `${rows.join("\r\n")}\r\n`;
}

function outcomesToCsv(outcomes: CsvImportResult["outcomes"]): string {
  const rows = ["Row,Product,Result,Message"];
  for (const outcome of outcomes) {
    rows.push([outcome.row, outcome.title, outcome.action, outcome.message ?? ""].map(csvCell).join(","));
  }
  return `${rows.join("\r\n")}\r\n`;
}

function csvCell(value: string | number): string {
  const text = String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}
