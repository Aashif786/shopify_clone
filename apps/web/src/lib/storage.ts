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
  "svg",
  "avif",
]);

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/avif",
]);

export interface UploadedFileDescriptor {
  id: string;
  url: string;
  filename: string;
  originalName: string;
  altText: string;
  size: number;
  mimeType: string;
}

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
    case "svg":
      return "image/svg+xml";
    case "avif":
      return "image/avif";
    default:
      return "application/octet-stream";
  }
}

function resolveUploadRoot(): string {
  const cwd = process.cwd();
  if (fs.existsSync(path.join(cwd, "apps", "web"))) {
    return path.join(cwd, "apps", "web");
  }
  return cwd;
}

export async function saveUploadedFile(
  storeId: string,
  originalFilename: string,
  buffer: Buffer,
  providedMimeType?: string
): Promise<UploadedFileDescriptor> {
  const ext = originalFilename.split(".").pop()?.toLowerCase() || "jpg";
  if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
    throw new Error(
      `Unsupported file extension: .${ext}. Allowed extensions: ${Array.from(ALLOWED_IMAGE_EXTENSIONS).join(", ")}`
    );
  }

  const mimeType =
    providedMimeType && ALLOWED_IMAGE_MIME_TYPES.has(providedMimeType)
      ? providedMimeType
      : getMimeType(ext);

  // Sanitize base filename
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

  const base = resolveUploadRoot();
  const publicDir = path.join(base, "public", "uploads", "stores", storeId);
  const storageDir = path.join(base, "storage", "uploads", "stores", storeId);

  await fs.promises.mkdir(publicDir, { recursive: true });
  await fs.promises.mkdir(storageDir, { recursive: true });

  await fs.promises.writeFile(path.join(publicDir, storedFilename), buffer);
  await fs.promises.writeFile(path.join(storageDir, storedFilename), buffer);

  const humanReadableAlt = rawBase.replace(/[-_]/g, " ").trim();

  return {
    id: uniqueId,
    url: `/api/v1/stores/${storeId}/uploads/${storedFilename}`,
    filename: storedFilename,
    originalName: originalFilename,
    altText: humanReadableAlt,
    size: buffer.length,
    mimeType,
  };
}

export async function extractAndSaveZip(
  storeId: string,
  zipBuffer: Buffer
): Promise<UploadedFileDescriptor[]> {
  const zip = await JSZip.loadAsync(zipBuffer);
  const results: UploadedFileDescriptor[] = [];

  for (const [entryPath, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    // Filter out macOS metadata / hidden files
    if (
      entryPath.includes("__MACOSX") ||
      entryPath.startsWith(".") ||
      entryPath.includes("/.") ||
      entryPath.endsWith(".DS_Store")
    ) {
      continue;
    }

    const ext = entryPath.split(".").pop()?.toLowerCase() || "";
    if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
      continue;
    }

    const fileBuffer = await entry.async("nodebuffer");
    if (fileBuffer.length === 0) continue;

    const originalName = path.basename(entryPath);
    const uploaded = await saveUploadedFile(storeId, originalName, fileBuffer);
    results.push(uploaded);
  }

  return results;
}

export async function readUploadedFile(
  storeId: string,
  filename: string
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  // Prevent directory traversal
  if (
    !filename ||
    filename.includes("..") ||
    filename.includes("/") ||
    filename.includes("\\") ||
    filename.includes("\0")
  ) {
    return null;
  }

  const base = resolveUploadRoot();
  const storagePath = path.join(base, "storage", "uploads", "stores", storeId, filename);
  const publicPath = path.join(base, "public", "uploads", "stores", storeId, filename);

  let targetPath: string | null = null;
  if (fs.existsSync(storagePath)) {
    targetPath = storagePath;
  } else if (fs.existsSync(publicPath)) {
    targetPath = publicPath;
  }

  if (!targetPath) return null;

  const buffer = await fs.promises.readFile(targetPath);
  const mimeType = getMimeType(filename);
  return { buffer, mimeType };
}
