import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { classifyUploadBytes } from "./storage.js";

const STORE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface PublicUploadMigrationResult {
  imagesKept: number;
  quarantined: number;
  publicRemoved: number;
  skipped: number;
  conflicts: number;
}

type CopyState = "ready" | "conflict" | "mismatch";

/**
 * Copies files out of `public/uploads` so Next.js cannot serve them as static
 * files. Raster images land in `storage/uploads`. Everything else is copied to
 * `storage/uploads-quarantine` and is not served. A public file is removed only
 * after the destination hash matches the source. Safe to run more than once.
 */
export async function migratePublicUploads(webRoot: string): Promise<PublicUploadMigrationResult> {
  const result: PublicUploadMigrationResult = {
    imagesKept: 0,
    quarantined: 0,
    publicRemoved: 0,
    skipped: 0,
    conflicts: 0,
  };
  const publicRoot = path.resolve(webRoot, "public", "uploads");
  if (!(await directoryExists(publicRoot))) return result;

  await walk(publicRoot, publicRoot, webRoot, result);
  await removeEmptyDirectories(publicRoot);
  return result;
}

async function walk(
  publicRoot: string,
  current: string,
  webRoot: string,
  result: PublicUploadMigrationResult,
): Promise<void> {
  const entries = await fs.promises.readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    const source = path.join(current, entry.name);
    const stat = await fs.promises.lstat(source);
    if (stat.isSymbolicLink()) {
      await fs.promises.unlink(source);
      result.quarantined += 1;
      result.publicRemoved += 1;
      continue;
    }
    if (stat.isDirectory()) {
      await walk(publicRoot, source, webRoot, result);
      continue;
    }
    if (!stat.isFile()) {
      result.skipped += 1;
      continue;
    }

    const relative = path.relative(publicRoot, source);
    const parts = relative.split(path.sep);
    const storeId = parts[1];
    const filename = parts[2];
    if (
      parts.length === 3 &&
      parts[0] === "stores" &&
      storeId !== undefined &&
      filename !== undefined &&
      STORE_ID_PATTERN.test(storeId) &&
      isSafeFilename(filename)
    ) {
      try {
        await migrateStoreFile(webRoot, storeId, filename, source, result);
      } catch {
        console.warn("[upload] migration skipped a file", { storeId });
        result.skipped += 1;
      }
      continue;
    }

    try {
      await quarantineLooseFile(webRoot, relative, source, result);
    } catch {
      console.warn("[upload] migration skipped a loose file");
      result.skipped += 1;
    }
  }
}

async function migrateStoreFile(
  webRoot: string,
  storeId: string,
  filename: string,
  source: string,
  result: PublicUploadMigrationResult,
): Promise<void> {
  const prefix = await readPrefix(source, 4096);
  const disposition = classifyUploadBytes(filename, prefix);
  const storagePath = path.resolve(webRoot, "storage", "uploads", "stores", storeId, filename);
  const quarantinePath = path.resolve(
    webRoot,
    "storage",
    "uploads-quarantine",
    "stores",
    storeId,
    filename,
  );

  if (disposition === "image") {
    const stored = await ensureVerifiedCopy(source, storagePath);
    if (stored === "mismatch") return;
    if (stored === "conflict") {
      const quarantined = await ensureVerifiedCopy(source, quarantinePath);
      if (quarantined !== "ready") return;
      await removeVerifiedSource(source, quarantinePath);
      result.conflicts += 1;
      result.quarantined += 1;
      result.publicRemoved += 1;
      return;
    }
    await removeVerifiedSource(source, storagePath);
    result.imagesKept += 1;
    result.publicRemoved += 1;
    return;
  }

  const quarantined = await ensureVerifiedCopy(source, quarantinePath);
  if (quarantined !== "ready") return;
  if (await sameBytes(storagePath, quarantinePath)) {
    await removeVerifiedSource(storagePath, quarantinePath);
  }
  await removeVerifiedSource(source, quarantinePath);
  result.quarantined += 1;
  result.publicRemoved += 1;
}

async function quarantineLooseFile(
  webRoot: string,
  relative: string,
  source: string,
  result: PublicUploadMigrationResult,
): Promise<void> {
  const safeRelative = relative
    .split(path.sep)
    .filter((part) => part !== ".." && part !== "." && part.length > 0)
    .join(path.sep);
  if (safeRelative.length === 0) {
    result.skipped += 1;
    return;
  }
  const quarantinePath = path.resolve(webRoot, "storage", "uploads-quarantine", "loose", safeRelative);
  const copied = await ensureVerifiedCopy(source, quarantinePath);
  if (copied !== "ready") return;
  await removeVerifiedSource(source, quarantinePath);
  result.quarantined += 1;
  result.publicRemoved += 1;
}

async function ensureVerifiedCopy(source: string, destination: string): Promise<CopyState> {
  const sourceHash = await hashFile(source);
  if (await regularFile(destination)) {
    const destinationHash = await hashFile(destination);
    return destinationHash === sourceHash ? "ready" : "conflict";
  }
  await fs.promises.mkdir(path.dirname(destination), { recursive: true });
  const temporary = path.join(
    path.dirname(destination),
    `.${path.basename(destination)}.${crypto.randomBytes(4).toString("hex")}.partial`,
  );
  try {
    await fs.promises.copyFile(source, temporary);
    if ((await hashFile(temporary)) !== sourceHash) return "mismatch";
    await fs.promises.rename(temporary, destination);
    if ((await hashFile(destination)) !== sourceHash) {
      await fs.promises.rm(destination, { force: true });
      return "mismatch";
    }
    return "ready";
  } finally {
    await fs.promises.rm(temporary, { force: true });
  }
}

async function removeVerifiedSource(source: string, verifiedCopy: string): Promise<void> {
  if (!(await sameBytes(source, verifiedCopy))) {
    throw new Error("Upload migration verification failed");
  }
  await fs.promises.rm(source);
}

async function sameBytes(left: string, right: string): Promise<boolean> {
  if (!(await regularFile(left)) || !(await regularFile(right))) return false;
  return (await hashFile(left)) === (await hashFile(right));
}

async function hashFile(filePath: string): Promise<string> {
  const hash = crypto.createHash("sha256");
  const stream = fs.createReadStream(filePath);
  for await (const chunk of stream) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

async function readPrefix(filePath: string, maxBytes: number): Promise<Buffer> {
  const handle = await fs.promises.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(maxBytes);
    const { bytesRead } = await handle.read(buffer, 0, maxBytes, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

function isSafeFilename(name: string): boolean {
  return (
    name.length > 0 &&
    name.length <= 255 &&
    name !== "." &&
    name !== ".." &&
    !name.includes("..") &&
    !/[/\\\0]/.test(name)
  );
}

async function regularFile(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.promises.lstat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function directoryExists(dir: string): Promise<boolean> {
  try {
    const stat = await fs.promises.lstat(dir);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function removeEmptyDirectories(root: string): Promise<void> {
  if (!(await directoryExists(root))) return;
  const entries = await fs.promises.readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    await removeEmptyDirectories(path.join(root, entry.name));
  }
  const remaining = await fs.promises.readdir(root);
  if (remaining.length === 0) {
    await fs.promises.rmdir(root).catch(() => undefined);
  }
}
