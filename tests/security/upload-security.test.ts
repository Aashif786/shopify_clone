import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import JSZip from "jszip";
import {
  UploadRejectedError,
  extractAndSaveZip,
  isActiveContent,
  readUploadedFile,
  saveUploadedFile,
  uploadResponseHeaders,
} from "../../apps/web/src/lib/storage.js";
import { GET as getUploadedFile } from "../../apps/web/app/api/v1/stores/[storeId]/uploads/[filename]/route.js";
import { GET as getPublicUpload } from "../../apps/web/app/uploads/stores/[storeId]/[filename]/route.js";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
const STORE_ID = "11111111-1111-7111-8111-111111111111";
const OTHER_STORE_ID = "22222222-2222-7222-8222-222222222222";

function uploadDirs(): string[] {
  const root = path.join(process.cwd(), "apps", "web");
  return [
    path.join(root, "public", "uploads", "stores", STORE_ID),
    path.join(root, "storage", "uploads", "stores", STORE_ID),
  ];
}

afterEach(async () => {
  await Promise.all(uploadDirs().map((dir) => fs.promises.rm(dir, { recursive: true, force: true })));
  delete process.env.UPLOAD_MAX_ZIP_ENTRIES;
  delete process.env.UPLOAD_MAX_ZIP_ENTRY_BYTES;
  delete process.env.UPLOAD_MAX_ZIP_UNCOMPRESSED_BYTES;
  delete process.env.UPLOAD_MAX_ZIP_RATIO;
  delete process.env.UPLOAD_MAX_ZIP_BYTES;
});

async function zipOf(files: Array<{ name: string; data: Buffer | string; unixPermissions?: number }>) {
  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.name, file.data, { unixPermissions: file.unixPermissions });
  }
  return zip.generateAsync({ type: "nodebuffer", platform: "UNIX" });
}

describe("upload content security", () => {
  it("saves a real PNG and rejects SVG content disguised as PNG", async () => {
    const saved = await saveUploadedFile(STORE_ID, "photo.png", PNG, "image/svg+xml");
    expect(saved.mimeType).toBe("image/png");
    expect(fs.existsSync(path.join(uploadDirs()[0]!, saved.filename))).toBe(false);
    expect(fs.existsSync(path.join(uploadDirs()[1]!, saved.filename))).toBe(true);

    const jpeg = await saveUploadedFile(
      STORE_ID,
      "photo.jpg",
      Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
      "application/octet-stream",
    );
    expect(jpeg.mimeType).toBe("image/jpeg");
    const gif = await saveUploadedFile(STORE_ID, "anim.gif", Buffer.from("GIF89a"));
    expect(gif.mimeType).toBe("image/gif");
    const webp = await saveUploadedFile(
      STORE_ID,
      "photo.webp",
      Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP")]),
    );
    expect(webp.mimeType).toBe("image/webp");

    const svg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script><image href="https://evil.example/a.svg"></image></svg>`,
    );
    const html = Buffer.from(
      `<!doctype html><html><iframe src="javascript:alert(1)"></iframe><script>alert(1)</script></html>`,
    );
    expect(isActiveContent(svg)).toBe(true);
    expect(isActiveContent(html)).toBe(true);
    await expect(saveUploadedFile(STORE_ID, "photo.png", svg, "image/png")).rejects.toMatchObject({
      code: "UNSUPPORTED_FILE_TYPE",
    });
    await expect(saveUploadedFile(STORE_ID, "page.png", html, "text/html")).rejects.toMatchObject({
      code: "UNSUPPORTED_FILE_TYPE",
    });
    await expect(saveUploadedFile(STORE_ID, "logo.svg", PNG)).rejects.toBeInstanceOf(UploadRejectedError);
    await expect(saveUploadedFile("../not-a-store", "photo.png", PNG)).rejects.toMatchObject({
      code: "UPLOAD_REJECTED",
    });
    expect(await readUploadedFile("..", "photo.png")).toBeNull();
    expect(await readUploadedFile(OTHER_STORE_ID, saved.filename)).toBeNull();
    const otherStore = await getUploadedFile(new Request("http://localhost/uploads/file"), {
      params: Promise.resolve({ storeId: OTHER_STORE_ID, filename: saved.filename }),
    });
    expect(otherStore.status).toBe(404);
    expect(await readUploadedFile(STORE_ID, "not-an-image.png")).toBeNull();
    const storageDir = uploadDirs()[1]!;
    await fs.promises.writeFile(path.join(storageDir, "not-an-image.png"), Buffer.from("not-a-real-png"));
    expect(await readUploadedFile(STORE_ID, "not-an-image.png")).toBeNull();
  });

  it("downloads stored SVG-like bytes instead of rendering them", async () => {
    const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`);
    const headers = uploadResponseHeaders("img_abcd_logo.svg", svg);
    expect(headers["Content-Type"]).toBe("application/octet-stream");
    expect(headers["Content-Disposition"]).toContain("attachment");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Content-Security-Policy"]).toContain("sandbox");

    const root = path.join(process.cwd(), "apps", "web", "storage", "uploads", "stores", STORE_ID);
    await fs.promises.mkdir(root, { recursive: true });
    await fs.promises.writeFile(path.join(root, "img_abcd_logo.svg"), svg);
    const response = await getUploadedFile(
      new Request("http://localhost/uploads/file"),
      { params: Promise.resolve({ storeId: STORE_ID, filename: "img_abcd_logo.svg" }) },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/octet-stream");
    expect(response.headers.get("content-disposition")).toContain("attachment");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-security-policy")).toContain("sandbox");

    const publicResponse = await getPublicUpload(new Request("http://localhost/uploads/file"), {
      params: Promise.resolve({ storeId: STORE_ID, filename: "img_abcd_logo.svg" }),
    });
    expect(publicResponse.status).toBe(200);
    expect(publicResponse.headers.get("content-type")).toBe(response.headers.get("content-type"));
    expect(publicResponse.headers.get("content-disposition")).toBe(
      response.headers.get("content-disposition"),
    );
    expect(publicResponse.headers.get("x-content-type-options")).toBe("nosniff");
    expect(publicResponse.headers.get("content-security-policy")).toContain("sandbox");
  });

  it("extracts a valid image archive", async () => {
    const archive = await zipOf([
      { name: "front.png", data: PNG },
      { name: "notes.txt", data: "ignore" },
    ]);
    const saved = await extractAndSaveZip(STORE_ID, archive);
    expect(saved).toHaveLength(1);
    expect(saved[0]?.originalName).toBe("front.png");
  });

  it("rejects unsafe archives and removes partial files", async () => {
    process.env.UPLOAD_MAX_ZIP_ENTRIES = "2";
    const tooMany = await zipOf([
      { name: "a.png", data: PNG },
      { name: "b.png", data: PNG },
      { name: "c.png", data: PNG },
    ]);
    await expect(extractAndSaveZip(STORE_ID, tooMany)).rejects.toMatchObject({
      code: "ARCHIVE_TOO_MANY_ENTRIES",
    });

    await expect(
      extractAndSaveZip(STORE_ID, await zipOf([{ name: "../secret.png", data: PNG }])),
    ).rejects.toMatchObject({ code: "ARCHIVE_PATH" });
    await expect(
      extractAndSaveZip(STORE_ID, await zipOf([{ name: "/tmp/secret.png", data: PNG }])),
    ).rejects.toMatchObject({ code: "ARCHIVE_PATH" });
    await expect(
      extractAndSaveZip(STORE_ID, await zipOf([{ name: "C:/secret.png", data: PNG }])),
    ).rejects.toMatchObject({ code: "ARCHIVE_PATH" });
    await expect(
      extractAndSaveZip(STORE_ID, await zipOf([{ name: "C:secret.png", data: PNG }])),
    ).rejects.toMatchObject({ code: "ARCHIVE_PATH" });
    await expect(
      extractAndSaveZip(
        STORE_ID,
        await zipOf([{ name: `${"a".repeat(260)}.png`, data: PNG }]),
      ),
    ).rejects.toMatchObject({ code: "ARCHIVE_PATH" });
    await expect(
      extractAndSaveZip(
        STORE_ID,
        await zipOf([{ name: "link.png", data: PNG, unixPermissions: 0o120777 }]),
      ),
    ).rejects.toMatchObject({ code: "ARCHIVE_SYMLINK" });

    process.env.UPLOAD_MAX_ZIP_ENTRIES = "10";
    process.env.UPLOAD_MAX_ZIP_ENTRY_BYTES = "2048";
    const bulky = new JSZip();
    bulky.file("big.png", Buffer.concat([PNG, Buffer.alloc(5000, 1)]));
    await expect(extractAndSaveZip(STORE_ID, await bulky.generateAsync({ type: "nodebuffer" }))).rejects.toMatchObject({
      code: "ARCHIVE_ENTRY_TOO_LARGE",
    });

    delete process.env.UPLOAD_MAX_ZIP_ENTRY_BYTES;
    process.env.UPLOAD_MAX_ZIP_UNCOMPRESSED_BYTES = "1024";
    const wide = new JSZip();
    wide.file("wide.png", Buffer.concat([PNG, Buffer.alloc(2000, 7)]));
    await expect(
      extractAndSaveZip(STORE_ID, await wide.generateAsync({ type: "nodebuffer", compression: "STORE" })),
    ).rejects.toMatchObject({ code: "ARCHIVE_TOO_LARGE" });

    process.env.UPLOAD_MAX_ZIP_UNCOMPRESSED_BYTES = String(2 * 1024 * 1024);
    process.env.UPLOAD_MAX_ZIP_RATIO = "2";
    process.env.UPLOAD_MAX_ZIP_UNCOMPRESSED_BYTES = String(2 * 1024 * 1024);
    const repetitive = new JSZip();
    repetitive.file("repeat.png", Buffer.concat([PNG, Buffer.alloc(50_000, 0)]));
    await expect(
      extractAndSaveZip(STORE_ID, await repetitive.generateAsync({ type: "nodebuffer", compression: "DEFLATE" })),
    ).rejects.toMatchObject({ code: "ARCHIVE_RATIO" });

    const left = await fs.promises.readdir(uploadDirs()[1]!).catch(() => []);
    expect(left).toEqual([]);
  });

  it("rejects duplicate archive paths and cleans up files written before the failure", async () => {
    const mixedCase = await zipOf([
      { name: "photos/a.png", data: PNG },
      { name: "photos/A.PNG", data: PNG },
    ]);
    if (process.platform === "win32") {
      await expect(extractAndSaveZip(STORE_ID, mixedCase)).rejects.toMatchObject({
        code: "ARCHIVE_DUPLICATE",
      });
    } else {
      const saved = await extractAndSaveZip(STORE_ID, mixedCase);
      expect(saved).toHaveLength(2);
      await Promise.all(saved.map((file) => fs.promises.rm(path.join(uploadDirs()[1]!, file.filename))));
    }

    await expect(
      extractAndSaveZip(
        STORE_ID,
        await zipOf([
          { name: "photos/a.png", data: PNG },
          { name: "photos\\a.png", data: PNG },
        ]),
      ),
    ).rejects.toMatchObject({ code: "ARCHIVE_DUPLICATE" });
    const foldedDotSegment = await zipOf([
      { name: "photos/a.png", data: PNG },
      { name: "photos/./a.png", data: PNG },
    ]);
    const folded = await extractAndSaveZip(STORE_ID, foldedDotSegment);
    expect(folded).toHaveLength(1);
    await fs.promises.rm(path.join(uploadDirs()[1]!, folded[0]!.filename));

    await expect(
      extractAndSaveZip(
        STORE_ID,
        await zipOf([
          { name: "ok.png", data: PNG },
          { name: "../evil.png", data: PNG },
        ]),
      ),
    ).rejects.toMatchObject({ code: "ARCHIVE_PATH" });

    const left = await fs.promises.readdir(uploadDirs()[1]!).catch(() => []);
    expect(left).toEqual([]);
  });

  it("rejects a malformed archive", async () => {
    await expect(extractAndSaveZip(STORE_ID, Buffer.from("not a zip"))).rejects.toMatchObject({
      code: "ARCHIVE_INVALID",
    });
  });
});
