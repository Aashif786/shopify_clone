import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  generateUuidV7,
  runMigrations,
  type Database,
} from "@calcart/db";
import { serializeSessionCookie } from "@calcart/auth";
import { createIsolatedDatabase } from "./helpers/postgres.js";
import JSZip from "jszip";
import { POST as uploadFiles } from "../apps/web/app/api/v1/stores/[storeId]/uploads/route.js";
import { GET as getUploadedFile } from "../apps/web/app/api/v1/stores/[storeId]/uploads/[filename]/route.js";
import {
  saveUploadedFile,
  readUploadedFile,
  extractAndSaveZip,
} from "../apps/web/src/lib/storage.js";

declare global {
  var __calcart_web_db: unknown;
}

describe("Stores Uploads API & Storage (/api/v1/stores/[storeId]/uploads)", { timeout: 30_000 }, () => {
  let close: (() => Promise<void>) | undefined;
  let db: Database;
  let testStoreId: string;
  let adminCookie: string;
  let staffCookie: string;

  beforeEach(async () => {
    const isolated = await createIsolatedDatabase();
    close = isolated.close;
    await runMigrations(isolated.database);
    db = isolated.database;
    global.__calcart_web_db = isolated.database;

    // Create an organization
    const orgId = generateUuidV7();
    await db.query(
      `INSERT INTO organizations (id, name, status) VALUES ($1, $2, $3)`,
      [orgId, "Upload Test Org", "ACTIVE"]
    );

    // Create store
    testStoreId = generateUuidV7();
    await db.query(
      `INSERT INTO stores (id, organization_id, name, slug, status, currency, locale, timezone) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [testStoreId, orgId, "Upload Test Store", `store-${Date.now()}`, "ACTIVE", "USD", "en", "UTC"]
    );

    // Create admin user
    const adminUserId = generateUuidV7();
    const adminSessionId = generateUuidV7();
    await db.query(
      `INSERT INTO users (id, email, name, password_hash, status) VALUES ($1, $2, $3, $4, $5)`,
      [adminUserId, `admin-${Date.now()}@test.com`, "Admin User", "hash", "ACTIVE"]
    );
    await db.query(
      `INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL '1 day')`,
      [adminSessionId, adminUserId]
    );
    await db.query(
      `INSERT INTO store_memberships (id, store_id, user_id, role, status) VALUES ($1, $2, $3, $4, $5)`,
      [generateUuidV7(), testStoreId, adminUserId, "admin", "ACTIVE"]
    );
    adminCookie = serializeSessionCookie(adminSessionId);

    // Create staff user (cannot upload)
    const staffUserId = generateUuidV7();
    const staffSessionId = generateUuidV7();
    await db.query(
      `INSERT INTO users (id, email, name, password_hash, status) VALUES ($1, $2, $3, $4, $5)`,
      [staffUserId, `staff-${Date.now()}@test.com`, "Staff User", "hash", "ACTIVE"]
    );
    await db.query(
      `INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL '1 day')`,
      [staffSessionId, staffUserId]
    );
    await db.query(
      `INSERT INTO store_memberships (id, store_id, user_id, role, status) VALUES ($1, $2, $3, $4, $5)`,
      [generateUuidV7(), testStoreId, staffUserId, "staff", "ACTIVE"]
    );
    staffCookie = serializeSessionCookie(staffSessionId);
  });

  afterEach(async () => {
    global.__calcart_web_db = undefined;
    if (close) {
      await close();
      close = undefined;
    }
  });

  describe("Storage Engine (Unit)", () => {
    it("saves and reads a single image successfully", async () => {
      const dummyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
      const saved = await saveUploadedFile(testStoreId, "product-sample.png", dummyPng);

      expect(saved.filename).toMatch(/^img_[a-f0-9]+_product-sample\.png$/);
      expect(saved.url).toBe(`/api/v1/stores/${testStoreId}/uploads/${saved.filename}`);
      expect(saved.mimeType).toBe("image/png");
      expect(saved.size).toBe(dummyPng.length);

      const retrieved = await readUploadedFile(testStoreId, saved.filename);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.mimeType).toBe("image/png");
      expect(retrieved?.buffer.equals(dummyPng)).toBe(true);
    });

    it("prevents directory traversal attacks", async () => {
      expect(await readUploadedFile(testStoreId, "../secret.txt")).toBeNull();
      expect(await readUploadedFile(testStoreId, "..\\secret.txt")).toBeNull();
      expect(await readUploadedFile(testStoreId, "sub/dir/img.png")).toBeNull();
    });

    it("extracts and saves images from a zip archive", async () => {
      const zip = new JSZip();
      const dummyPng = Buffer.from("dummy-png-content");
      const dummyJpg = Buffer.from("dummy-jpg-content");

      zip.file("shirt-front.png", dummyPng);
      zip.file("folder/shirt-back.jpg", dummyJpg);
      zip.file("readme.txt", "Text file should be ignored");
      zip.file("__MACOSX/._shirt-front.png", "Mac metadata should be ignored");

      const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
      const extracted = await extractAndSaveZip(testStoreId, zipBuffer);

      expect(extracted.length).toBe(2);
      expect(extracted.map((f) => f.originalName)).toContain("shirt-front.png");
      expect(extracted.map((f) => f.originalName)).toContain("shirt-back.jpg");

      for (const item of extracted) {
        const read = await readUploadedFile(testStoreId, item.filename);
        expect(read).not.toBeNull();
      }
    });
  });

  describe("Upload API Route (POST /api/v1/stores/[storeId]/uploads)", () => {
    it("returns 401 when request is unauthenticated", async () => {
      const formData = new FormData();
      formData.append("files", new Blob(["dummy"]), "test.png");

      const req = new Request(`http://localhost/api/v1/stores/${testStoreId}/uploads`, {
        method: "POST",
        body: formData,
      });

      const res = await uploadFiles(req, { params: Promise.resolve({ storeId: testStoreId }) });
      expect(res.status).toBe(401);
    });

    it("returns 403 when user does not have admin role", async () => {
      const formData = new FormData();
      formData.append("files", new Blob(["dummy"]), "test.png");

      const req = new Request(`http://localhost/api/v1/stores/${testStoreId}/uploads`, {
        method: "POST",
        headers: {
          Cookie: staffCookie,
        },
        body: formData,
      });

      const res = await uploadFiles(req, { params: Promise.resolve({ storeId: testStoreId }) });
      expect(res.status).toBe(403);
    });

    it("uploads single and multiple images for authenticated admin", async () => {
      const formData = new FormData();
      formData.append(
        "files",
        new Blob(["test-png-binary"], { type: "image/png" }),
        "tshirt-black.png"
      );
      formData.append(
        "files",
        new Blob(["test-jpg-binary"], { type: "image/jpeg" }),
        "tshirt-white.jpg"
      );

      const req = new Request(`http://localhost/api/v1/stores/${testStoreId}/uploads`, {
        method: "POST",
        headers: {
          Cookie: adminCookie,
        },
        body: formData,
      });

      const res = await uploadFiles(req, { params: Promise.resolve({ storeId: testStoreId }) });
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.files).toHaveLength(2);
      expect(body.data.files[0].originalName).toBe("tshirt-black.png");
      expect(body.data.files[0].url).toContain(`/api/v1/stores/${testStoreId}/uploads/`);
      expect(body.data.files[1].originalName).toBe("tshirt-white.jpg");
    });

    it("uploads a zip archive and returns all extracted image descriptors", async () => {
      const zip = new JSZip();
      zip.file("lookbook1.webp", Buffer.from("webp-data"));
      zip.file("lookbook2.png", Buffer.from("png-data"));
      zip.file("license.md", "ignore me");

      const zipBlob = await zip.generateAsync({ type: "blob" });

      const formData = new FormData();
      formData.append("files", zipBlob, "lookbook-pack.zip");

      const req = new Request(`http://localhost/api/v1/stores/${testStoreId}/uploads`, {
        method: "POST",
        headers: {
          Cookie: adminCookie,
        },
        body: formData,
      });

      const res = await uploadFiles(req, { params: Promise.resolve({ storeId: testStoreId }) });
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.files).toHaveLength(2);
      expect(body.data.files.map((f: { originalName: string }) => f.originalName)).toContain("lookbook1.webp");
      expect(body.data.files.map((f: { originalName: string }) => f.originalName)).toContain("lookbook2.png");
    });

    it("rejects unsupported file extensions with 400", async () => {
      const formData = new FormData();
      formData.append("files", new Blob(["malicious-code"]), "virus.exe");

      const req = new Request(`http://localhost/api/v1/stores/${testStoreId}/uploads`, {
        method: "POST",
        headers: {
          Cookie: adminCookie,
        },
        body: formData,
      });

      const res = await uploadFiles(req, { params: Promise.resolve({ storeId: testStoreId }) });
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNSUPPORTED_FILE_TYPE");
    });
  });

  describe("File Serving Route (GET /api/v1/stores/[storeId]/uploads/[filename])", () => {
    it("serves saved image file with proper cache headers", async () => {
      const dummyPng = Buffer.from("png-image-bits");
      const saved = await saveUploadedFile(testStoreId, "served-photo.png", dummyPng);

      const req = new Request(`http://localhost${saved.url}`, { method: "GET" });
      const res = await getUploadedFile(req, {
        params: Promise.resolve({ storeId: testStoreId, filename: saved.filename }),
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("image/png");
      expect(res.headers.get("cache-control")).toContain("public");
      const arrayBuffer = await res.arrayBuffer();
      expect(Buffer.from(arrayBuffer).equals(dummyPng)).toBe(true);
    });

    it("returns 404 for nonexistent files", async () => {
      const req = new Request(`http://localhost/api/v1/stores/${testStoreId}/uploads/does-not-exist.jpg`, {
        method: "GET",
      });
      const res = await getUploadedFile(req, {
        params: Promise.resolve({ storeId: testStoreId, filename: "does-not-exist.jpg" }),
      });

      expect(res.status).toBe(404);
    });
  });
});
