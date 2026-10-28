import { readUploadedFile } from "@/lib/storage";

interface RouteContext {
  params: Promise<{ storeId: string; filename: string }>;
}

export async function GET(_req: Request, context: RouteContext) {
  try {
    const { storeId, filename } = await Promise.resolve(context.params);

    const file = await readUploadedFile(storeId, filename);
    if (!file) {
      return new Response("File not found", { status: 404 });
    }

    return new Response(new Uint8Array(file.buffer), {
      status: 200,
      headers: {
        "Content-Type": file.mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(file.buffer.length),
      },
    });
  } catch {
    return new Response("Internal Server Error", { status: 500 });
  }
}
