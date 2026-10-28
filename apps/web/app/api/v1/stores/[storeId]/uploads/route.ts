import { hasRoleAtLeast } from "@shopify-clone/tenant";
import {
  ApiHttpError,
  apiSuccess,
  handleApiError,
  requireAuth,
  requireStoreOrNotFound,
  resolveRequestContext,
} from "@/lib/api";
import {
  ALLOWED_IMAGE_EXTENSIONS,
  extractAndSaveZip,
  saveUploadedFile,
  type UploadedFileDescriptor,
} from "@/lib/storage";

interface RouteContext {
  params: Promise<{ storeId: string }>;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export async function POST(req: Request, context: RouteContext) {
  let requestId: string | undefined;
  try {
    const ctx = await resolveRequestContext(req);
    requestId = ctx.requestId;

    requireAuth(ctx);
    const { storeId } = await Promise.resolve(context.params);

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

    const results: UploadedFileDescriptor[] = [];

    for (const file of uploadedFiles) {
      if (file.size > MAX_FILE_SIZE) {
        throw new ApiHttpError(
          400,
          "FILE_TOO_LARGE",
          `File "${file.name}" exceeds the maximum allowed size of 50MB`
        );
      }

      const fileName = file.name || "upload";
      const ext = fileName.split(".").pop()?.toLowerCase() || "";
      const isZip = ext === "zip" || file.type.includes("zip");

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
    return handleApiError(error, requestId);
  }
}
