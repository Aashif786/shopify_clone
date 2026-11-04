# ADR-013: Upload Content and Archive Limits

## Status

**Accepted**

## Date

2026-11-04

## Decision

Merchant image uploads accept only JPEG, PNG, WEBP, GIF, and AVIF, and the file bytes must match that type. SVG, HTML, script, and XML uploads are rejected. Files are stored under `apps/web/storage/uploads` and are not copied into `public/`, because Next.js serves `public/` as static files and would skip the upload response headers. A stored file whose body still looks like SVG or HTML is served as `application/octet-stream` with `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, and `Content-Security-Policy: default-src 'none'; sandbox`, so it is not rendered in the application origin.

ZIP import rejects unsafe paths, duplicate paths, and symbolic links when the archive records Unix mode `0120000`. JSZip does not provide another symlink signal. An entry with no Unix permission metadata is treated as a normal file, so symlink detection is not complete for archives that omit that metadata. Declared compressed size, entry count, per-entry size, total uncompressed size, and compression ratio are checked before inflation. The bytes actually read from an entry are capped at the smaller of the declared uncompressed size and the per-entry limit; a larger stream aborts the archive and deletes files already written. Paths are compared after slash normalization. On Windows the comparison is case-insensitive and ignores trailing dots and spaces, matching NTFS. On a case-sensitive filesystem the comparison stays case-sensitive. Archive paths are not used as the stored filename. JSZip keeps one entry when two names fold to the same internal key, such as `photos/a.png` and `photos/./a.png`, so that pair is extracted once.

`migratePublicUploads` copies existing `public/uploads` files into `storage/uploads` when the bytes are a real raster image, and into `storage/uploads-quarantine` otherwise. The public file is deleted only after the destination hash matches. Product image URLs already point at the upload routes, which read private storage, so those references do not need to be rewritten. The migration is safe to run again.

## Configuration

See `.env.example` for `UPLOAD_MAX_*`. The defaults are the maximum accepted values. There is no separate asset origin in this deployment; download headers are the isolation control for leftover active content.
