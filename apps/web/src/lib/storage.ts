import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import JSZip from "jszip";

export const ALLOWED_IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "avif",
]);

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

const ZIP_LIMIT_DEFAULTS = {
  maxCompressedBytes: 50 * 1024 * 1024,
  maxEntries: 100,
  maxTotalUncompressedBytes: 100 * 1024 * 1024,
  maxEntryBytes: 15 * 1024 * 1024,
  maxRatio: 100,
  maxPathLength: 255,
  maxImageBytes: 15 * 1024 * 1024,
};

export class UploadRejectedError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "UploadRejectedError";
    this.code = code;
  }
}

export interface UploadedFileDescriptor {
  id: string;
  url: string;
  filename: string;
  originalName: string;
  altText: string;
  size: number;
  mimeType: string;
}

type ImageKind = "jpeg" | "png" | "gif" | "webp" | "avif";

type ZipEntry = JSZip.JSZipObject & {
  _data?: {
    compressedSize?: number;
    uncompressedSize?: number;
  };
};

export function getMimeType(filenameOrExt: string): string {
  const ext = filenameOrExt.split(".").pop()?.toLowerCase() || "";
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "avif":
      return "image/avif";
    default:
      return "application/octet-stream";
  }
}

const STORE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STORE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;
const slugStoreIdCache = new Map<string, string>();

async function resolveStoreUuid(slugOrId: string): Promise<string | null> {
  if (STORE_ID_PATTERN.test(slugOrId)) {
    return slugOrId;
  }
  if (!STORE_SLUG_PATTERN.test(slugOrId)) {
    return null;
  }

  const key = slugOrId.toLowerCase();
  const cached = slugStoreIdCache.get(key);
  if (cached) return cached;

  try {
    const { getDb } = await import("./db");
    const db = getDb();
    const result = await db.query<{ id: string }>(
      "SELECT id FROM stores WHERE slug = $1 LIMIT 1",
      [key],
    );
    const resolvedId = result.rows[0]?.id;
    if (resolvedId && STORE_ID_PATTERN.test(resolvedId)) {
      slugStoreIdCache.set(key, resolvedId);
      return resolvedId;
    }
  } catch {
    // Database may not be configured or available (e.g. unit tests); proceed safely
  }

  return null;
}

export function uploadResponseHeaders(
  filename: string,
  buffer: Buffer,
): Record<string, string> {
  const length = String(buffer.length);
  const lowerName = filename.toLowerCase();
  if (
    isActiveContent(buffer) ||
    lowerName.endsWith(".svg") ||
    lowerName.endsWith(".html") ||
    lowerName.endsWith(".htm") ||
    lowerName.endsWith(".xhtml")
  ) {
    return {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": 'attachment; filename="download.bin"',
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "private, no-store",
      "Content-Length": length,
    };
  }
  return {
    "Content-Type": getMimeType(filename),
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "public, max-age=31536000, immutable",
    "Content-Length": length,
  };
}

function resolveUploadRoot(): string {
  const cwd = process.cwd();
  if (fs.existsSync(path.join(cwd, "apps", "web"))) {
    return path.join(cwd, "apps", "web");
  }
  return cwd;
}

function readBoundedInt(name: string, fallback: number, min: number, max: number): number {
  const parsed = Number(process.env[name]);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return fallback;
  return parsed;
}

function zipLimits() {
  return {
    maxCompressedBytes: readBoundedInt(
      "UPLOAD_MAX_ZIP_BYTES",
      ZIP_LIMIT_DEFAULTS.maxCompressedBytes,
      1024,
      ZIP_LIMIT_DEFAULTS.maxCompressedBytes,
    ),
    maxEntries: readBoundedInt("UPLOAD_MAX_ZIP_ENTRIES", ZIP_LIMIT_DEFAULTS.maxEntries, 1, 500),
    maxTotalUncompressedBytes: readBoundedInt(
      "UPLOAD_MAX_ZIP_UNCOMPRESSED_BYTES",
      ZIP_LIMIT_DEFAULTS.maxTotalUncompressedBytes,
      1024,
      ZIP_LIMIT_DEFAULTS.maxTotalUncompressedBytes,
    ),
    maxEntryBytes: readBoundedInt(
      "UPLOAD_MAX_ZIP_ENTRY_BYTES",
      ZIP_LIMIT_DEFAULTS.maxEntryBytes,
      1024,
      ZIP_LIMIT_DEFAULTS.maxEntryBytes,
    ),
    maxRatio: readBoundedInt("UPLOAD_MAX_ZIP_RATIO", ZIP_LIMIT_DEFAULTS.maxRatio, 2, 1000),
    maxPathLength: ZIP_LIMIT_DEFAULTS.maxPathLength,
    maxImageBytes: readBoundedInt(
      "UPLOAD_MAX_IMAGE_BYTES",
      ZIP_LIMIT_DEFAULTS.maxImageBytes,
      1024,
      ZIP_LIMIT_DEFAULTS.maxImageBytes,
    ),
  };
}

function extensionOf(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() || "";
}

function detectImageKind(buffer: Buffer): ImageKind | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "png";
  }
  const head = buffer.subarray(0, 6).toString("ascii");
  if (head === "GIF87a" || head === "GIF89a") return "gif";
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = buffer.subarray(8, Math.min(buffer.length, 32)).toString("ascii");
    if (brand.includes("avif") || brand.includes("avis")) return "avif";
  }
  return null;
}

function extensionMatchesKind(ext: string, kind: ImageKind): boolean {
  if (kind === "jpeg") return ext === "jpg" || ext === "jpeg";
  return ext === kind;
}

export function isActiveContent(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, 2048).toString("utf8").toLowerCase();
  return (
    sample.includes("<svg") ||
    sample.includes("<script") ||
    sample.includes("<html") ||
    sample.includes("<iframe") ||
    sample.includes("<!doctype html") ||
    sample.includes("<?xml") ||
    /on[a-z]+\s*=/.test(sample) ||
    sample.includes("javascript:") ||
    sample.includes("data:text/html")
  );
}

export function classifyUploadBytes(filename: string, buffer: Buffer): "image" | "quarantine" {
  const lowerName = filename.toLowerCase();
  if (
    lowerName.endsWith(".svg") ||
    lowerName.endsWith(".html") ||
    lowerName.endsWith(".htm") ||
    lowerName.endsWith(".xhtml") ||
    isActiveContent(buffer)
  ) {
    return "quarantine";
  }
  const ext = extensionOf(filename);
  const kind = detectImageKind(buffer);
  if (!kind || !ALLOWED_IMAGE_EXTENSIONS.has(ext) || !extensionMatchesKind(ext, kind)) {
    return "quarantine";
  }
  return "image";
}

function assertSafeImage(filename: string, buffer: Buffer, limits: ReturnType<typeof zipLimits>): string {
  if (buffer.length > limits.maxImageBytes) {
    throw new UploadRejectedError("FILE_TOO_LARGE", "The image exceeds the maximum allowed size.");
  }
  const ext = extensionOf(filename);
  if (!ALLOWED_IMAGE_EXTENSIONS.has(ext) || ext === "svg") {
    throw new UploadRejectedError(
      "UNSUPPORTED_FILE_TYPE",
      "Upload a JPEG, PNG, WEBP, GIF, or AVIF image.",
    );
  }
  if (isActiveContent(buffer)) {
    throw new UploadRejectedError(
      "UNSUPPORTED_FILE_TYPE",
      "This file contains active content and cannot be uploaded.",
    );
  }
  const kind = detectImageKind(buffer);
  if (!kind || !extensionMatchesKind(ext, kind)) {
    throw new UploadRejectedError(
      "UNSUPPORTED_FILE_TYPE",
      "The file contents do not match an allowed image type.",
    );
  }
  return getMimeType(ext);
}

function containedFile(directory: string, filename: string): string | null {
  const root = path.resolve(directory);
  const resolved = path.resolve(directory, filename);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return null;
  return resolved;
}

function uploadPaths(
  storeId: string,
  filename: string,
): { publicPath: string; storagePath: string } | null {
  if (!STORE_ID_PATTERN.test(storeId) && !STORE_SLUG_PATTERN.test(storeId)) return null;
  const base = resolveUploadRoot();
  const publicPath = containedFile(
    path.join(base, "public", "uploads", "stores", storeId),
    filename,
  );
  const storagePath = containedFile(
    path.join(base, "storage", "uploads", "stores", storeId),
    filename,
  );
  if (!publicPath || !storagePath) return null;
  return { publicPath, storagePath };
}

async function removeStoredFile(storeId: string, filename: string): Promise<void> {
  if (!/^img_[a-z0-9]+_[a-z0-9_-]+\.[a-z0-9]+$/.test(filename)) return;
  const paths = uploadPaths(storeId, filename);
  if (!paths) return;
  await fs.promises.rm(paths.publicPath, { force: true });
  await fs.promises.rm(paths.storagePath, { force: true });
}

export async function removeUploadedFiles(storeId: string, filenames: string[]): Promise<void> {
  await Promise.all(filenames.map((filename) => removeStoredFile(storeId, filename)));
}

export async function saveUploadedFile(
  storeId: string,
  originalFilename: string,
  buffer: Buffer,
  providedMimeType?: string,
): Promise<UploadedFileDescriptor> {
  const limits = zipLimits();
  const mimeType = assertSafeImage(originalFilename, buffer, limits);
  if (providedMimeType && !ALLOWED_IMAGE_MIME_TYPES.has(providedMimeType)) {
    console.warn("[upload] ignored client mime type", { storeId });
  }

  const ext = extensionOf(originalFilename);
  const rawBase = path.basename(originalFilename, path.extname(originalFilename));
  const cleanBase =
    rawBase
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 50) || "image";

  const uniqueId = crypto.randomUUID();
  const shortHash = crypto.randomBytes(4).toString("hex");
  const storedFilename = `img_${shortHash}_${cleanBase}.${ext}`;
  const paths = uploadPaths(storeId, storedFilename);
  if (!paths) {
    throw new UploadRejectedError("UPLOAD_REJECTED", "The upload could not be stored.");
  }

  await fs.promises.mkdir(path.dirname(paths.storagePath), { recursive: true });

  try {
    await fs.promises.writeFile(paths.storagePath, buffer);
  } catch {
    await fs.promises.rm(paths.storagePath, { force: true });
    console.warn("[upload] write failed", { storeId });
    throw new UploadRejectedError("UPLOAD_FAILED", "The file could not be stored.");
  }

  return {
    id: uniqueId,
    url: `/api/v1/stores/${storeId}/uploads/${storedFilename}`,
    filename: storedFilename,
    originalName: path.basename(originalFilename),
    altText: rawBase.replace(/[-_]/g, " ").trim(),
    size: buffer.length,
    mimeType,
  };
}

function stopZipStream(stream: NodeJS.ReadableStream): void {
  const closable = stream as NodeJS.ReadableStream & { destroy?: () => void };
  closable.destroy?.();
}

function entryName(entry: ZipEntry): string {
  return entry.unsafeOriginalName || entry.name;
}

function toBuffer(chunk: unknown): Buffer {
  if (Buffer.isBuffer(chunk)) return chunk;
  if (chunk instanceof Uint8Array) return Buffer.from(chunk);
  throw new UploadRejectedError("ARCHIVE_INVALID", "The archive could not be read.");
}

function readZipEntry(entry: ZipEntry, maxBytes: number): Promise<Buffer> {
  const stream = entry.nodeStream("nodebuffer");
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let settled = false;

    const fail = (error: UploadRejectedError): void => {
      if (settled) return;
      settled = true;
      stopZipStream(stream);
      reject(error);
    };

    stream.on("data", (chunk: unknown) => {
      try {
        const bytes = toBuffer(chunk);
        if (total + bytes.length > maxBytes) {
          fail(
            new UploadRejectedError(
              "ARCHIVE_ENTRY_TOO_LARGE",
              "An archived file exceeds the maximum size.",
            ),
          );
          return;
        }
        chunks.push(bytes);
        total += bytes.length;
      } catch (error) {
        fail(
          error instanceof UploadRejectedError
            ? error
            : new UploadRejectedError("ARCHIVE_INVALID", "The archive could not be read."),
        );
      }
    });
    stream.on("end", () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks, total));
    });
    stream.on("error", () => {
      fail(new UploadRejectedError("ARCHIVE_INVALID", "The archive could not be read."));
    });
  });
}

function isSymlink(permissions: number | string | null): boolean {
  if (permissions == null) return false;
  const mode = typeof permissions === "string" ? Number.parseInt(permissions, 8) : permissions;
  if (!Number.isFinite(mode)) return false;
  return (mode & 0o170000) === 0o120000;
}

function canonicalZipEntryPath(rawName: string): string {
  const slashed = rawName.replaceAll("\\", "/");
  if (
    slashed.length === 0 ||
    slashed.length > ZIP_LIMIT_DEFAULTS.maxPathLength ||
    slashed.includes("\0") ||
    slashed.includes("..") ||
    slashed.startsWith("/") ||
    /^[a-zA-Z]:/.test(slashed)
  ) {
    throw new UploadRejectedError("ARCHIVE_PATH", "The archive contains an unsafe file path.");
  }
  const parts: string[] = [];
  for (const part of slashed.split("/")) {
    if (part.length === 0 || part === ".") continue;
    if (part === ".." || part.includes("\0") || /^[a-zA-Z]:/.test(part)) {
      throw new UploadRejectedError("ARCHIVE_PATH", "The archive contains an unsafe file path.");
    }
    parts.push(part);
  }
  if (parts.length === 0) {
    throw new UploadRejectedError("ARCHIVE_PATH", "The archive contains an unsafe file path.");
  }
  const canonical = parts.join("/");
  if (canonical.length > ZIP_LIMIT_DEFAULTS.maxPathLength) {
    throw new UploadRejectedError("ARCHIVE_PATH", "The archive contains an unsafe file path.");
  }
  return canonical;
}

function zipIdentity(canonical: string): string {
  if (process.platform !== "win32") return canonical;
  return canonical
    .split("/")
    .map((part) => part.replace(/[. ]+$/g, "").toLowerCase())
    .join("/");
}

function assertSafeZipPath(rawName: string, seen: Set<string>): void {
  const key = zipIdentity(canonicalZipEntryPath(rawName));
  if (seen.has(key)) {
    throw new UploadRejectedError("ARCHIVE_DUPLICATE", "The archive contains duplicate file paths.");
  }
  seen.add(key);
}

export async function extractAndSaveZip(
  storeId: string,
  zipBuffer: Buffer,
): Promise<UploadedFileDescriptor[]> {
  const limits = zipLimits();
  if (zipBuffer.length > limits.maxCompressedBytes) {
    throw new UploadRejectedError("ARCHIVE_TOO_LARGE", "The archive exceeds the maximum compressed size.");
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(zipBuffer);
  } catch {
    console.warn("[upload] malformed archive", { storeId });
    throw new UploadRejectedError("ARCHIVE_INVALID", "The archive could not be read.");
  }

  const entries = Object.values(zip.files) as ZipEntry[];
  if (entries.length > limits.maxEntries) {
    throw new UploadRejectedError("ARCHIVE_TOO_MANY_ENTRIES", "The archive contains too many files.");
  }

  const seen = new Set<string>();
  let totalUncompressed = 0;
  const saved: string[] = [];
  const results: UploadedFileDescriptor[] = [];

  try {
    for (const entry of entries) {
      assertSafeZipPath(entryName(entry), seen);
      if (isSymlink(entry.unixPermissions)) {
        throw new UploadRejectedError("ARCHIVE_SYMLINK", "The archive contains a symbolic link.");
      }
      if (entry.dir) continue;

      const name = entryName(entry);
      const compressed = entry._data?.compressedSize;
      const uncompressed = entry._data?.uncompressedSize;
      if (uncompressed === undefined || compressed === undefined) {
        throw new UploadRejectedError("ARCHIVE_INVALID", "The archive could not be read.");
      }
      if (uncompressed > limits.maxEntryBytes) {
        throw new UploadRejectedError("ARCHIVE_ENTRY_TOO_LARGE", "An archived file exceeds the maximum size.");
      }
      const ratio = uncompressed / Math.max(compressed, 1);
      if (ratio > limits.maxRatio) {
        throw new UploadRejectedError("ARCHIVE_RATIO", "The archive is too heavily compressed.");
      }
      totalUncompressed += uncompressed;
      if (totalUncompressed > limits.maxTotalUncompressedBytes) {
        throw new UploadRejectedError(
          "ARCHIVE_TOO_LARGE",
          "The archive expands beyond the maximum allowed size.",
        );
      }

      if (
        name.includes("__MACOSX") ||
        path.posix.basename(name).startsWith(".") ||
        name.endsWith(".DS_Store") ||
        !ALLOWED_IMAGE_EXTENSIONS.has(extensionOf(name))
      ) {
        continue;
      }

      const readCap = Math.min(uncompressed, limits.maxEntryBytes);
      const fileBuffer = await readZipEntry(entry, readCap);
      if (fileBuffer.length > limits.maxEntryBytes || fileBuffer.length > uncompressed) {
        throw new UploadRejectedError("ARCHIVE_ENTRY_TOO_LARGE", "An archived file exceeds the maximum size.");
      }
      const actualRatio = fileBuffer.length / Math.max(compressed, 1);
      if (actualRatio > limits.maxRatio) {
        throw new UploadRejectedError("ARCHIVE_RATIO", "The archive is too heavily compressed.");
      }
      const uploaded = await saveUploadedFile(storeId, path.posix.basename(name), fileBuffer);
      saved.push(uploaded.filename);
      results.push(uploaded);
    }
  } catch (error) {
    await Promise.all(saved.map((filename) => removeStoredFile(storeId, filename)));
    if (error instanceof UploadRejectedError) {
      console.warn("[upload] archive rejected", { storeId, code: error.code });
      throw error;
    }
    console.warn("[upload] archive extraction failed", { storeId });
    throw new UploadRejectedError("ARCHIVE_INVALID", "The archive could not be read.");
  }

  return results;
}

export async function readUploadedFile(
  storeId: string,
  filename: string,
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  if (
    !filename ||
    filename.includes("..") ||
    filename.includes("/") ||
    filename.includes("\\") ||
    filename.includes("\0")
  ) {
    return null;
  }

  let paths = uploadPaths(storeId, filename);
  let targetPath = paths
    ? (await regularFile(paths.storagePath))
      ? paths.storagePath
      : (await regularFile(paths.publicPath))
        ? paths.publicPath
        : null
    : null;

  if (!targetPath && !STORE_ID_PATTERN.test(storeId) && STORE_SLUG_PATTERN.test(storeId)) {
    const resolvedUuid = await resolveStoreUuid(storeId);
    if (resolvedUuid && resolvedUuid !== storeId) {
      paths = uploadPaths(resolvedUuid, filename);
      if (paths) {
        targetPath = (await regularFile(paths.storagePath))
          ? paths.storagePath
          : (await regularFile(paths.publicPath))
            ? paths.publicPath
            : null;
      }
    }
  }

  if (!targetPath) return null;

  const buffer = await fs.promises.readFile(targetPath);
  if (
    classifyUploadBytes(filename, buffer) === "quarantine" &&
    !isActiveContent(buffer) &&
    !filename.toLowerCase().endsWith(".svg")
  ) {
    return null;
  }
  return { buffer, mimeType: getMimeType(filename) };
}

async function regularFile(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.promises.lstat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}
