import { hasRoleAtLeast } from "@calcart/tenant";
import {
  ApiHttpError,
  apiError,
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
} from "@/lib/api";
import {
  ALLOWED_IMAGE_EXTENSIONS,
  extractAndSaveZip,
  removeUploadedFiles,
  saveUploadedFile,
  UploadRejectedError,
  type UploadedFileDescriptor,
} from "@/lib/storage";

interface RouteContext {
  params: Promise<{ storeId: string }>;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

function uploadLabel(name: string): string {
  const base = name.split(/[/\\]/).pop() || "upload";
  const cleaned = base.replace(/[^\x20-\x7e]/g, "").slice(0, 80);
  return cleaned || "upload";
}

export async function POST(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  let storeId: string | undefined;
  const results: UploadedFileDescriptor[] = [];
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    ({ storeId } = await Promise.resolve(context.params));

    const member = await requireStoreOrNotFound(ctx, storeId);
    if (!hasRoleAtLeast(member.role, "admin")) {
      throw new ApiHttpError(
        403,
        "FORBIDDEN",
        "Upload requires at least admin role in this store"
      );
    }

    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      throw new ApiHttpError(
        400,
        "INVALID_CONTENT_TYPE",
        "Request must be multipart/form-data"
      );
    }

    const formData = await req.formData();
    const uploadedFiles: File[] = [];

    // Collect all files from 'files' or 'file' or all entries
    for (const [, value] of formData.entries()) {
      if (value && typeof value === "object" && "arrayBuffer" in value && "name" in value) {
        uploadedFiles.push(value as File);
      }
    }

    if (uploadedFiles.length === 0) {
      throw new ApiHttpError(
        400,
        "VALIDATION_ERROR",
        "No files were provided in the upload request"
      );
    }

    for (const file of uploadedFiles) {
      if (file.size > MAX_FILE_SIZE) {
        throw new ApiHttpError(
          400,
          "FILE_TOO_LARGE",
          `File "${uploadLabel(file.name)}" exceeds the maximum allowed size of 50MB`
        );
      }

      const fileName = uploadLabel(file.name || "upload");
      const ext = fileName.split(".").pop()?.toLowerCase() || "";
      const isZip =
        ext === "zip" ||
        file.type === "application/zip" ||
        file.type === "application/x-zip-compressed";

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (isZip) {
        const extracted = await extractAndSaveZip(storeId, buffer);
        if (extracted.length === 0) {
          throw new ApiHttpError(
            400,
            "EMPTY_ZIP_ARCHIVE",
            `No valid images found in zip archive "${fileName}". Supported formats: ${Array.from(ALLOWED_IMAGE_EXTENSIONS).join(", ")}`
          );
        }
        results.push(...extracted);
      } else if (ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
        const descriptor = await saveUploadedFile(storeId, fileName, buffer, file.type);
        results.push(descriptor);
      } else {
        throw new ApiHttpError(
          400,
          "UNSUPPORTED_FILE_TYPE",
          `File "${fileName}" is not a supported format. Please upload images (${Array.from(ALLOWED_IMAGE_EXTENSIONS).join(", ")}) or a .zip archive.`
        );
      }
    }

    return apiSuccess({ files: results }, { status: 201, requestId });
  } catch (error) {
    if (typeof storeId === "string" && results.length > 0) {
      try {
        await removeUploadedFiles(
          storeId,
          results.map((file) => file.filename),
        );
      } catch {
        console.warn("[upload] cleanup failed", { requestId });
      }
    }
    if (error instanceof UploadRejectedError) {
      console.warn("[upload] rejected", { code: error.code, requestId });
      return apiError(error.code, error.message, 400, { requestId });
    }
    return handleApiError(error, requestId);
  }
}
