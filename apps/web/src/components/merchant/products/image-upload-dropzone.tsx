"use client";

import React, { useState, useRef, useCallback } from "react";
import { UploadCloud, FolderArchive, Image as ImageIcon, AlertCircle, Loader2 } from "lucide-react";
import JSZip from "jszip";
import { apiClient, ApiClientError } from "../../../lib/api-client";

export interface UploadedMediaItem {
  id?: string;
  url: string;
  altText: string;
}

interface ImageUploadDropzoneProps {
  storeId: string;
  onUploadComplete: (items: UploadedMediaItem[]) => void;
  className?: string;
  compact?: boolean;
  disabled?: boolean;
}

const SUPPORTED_IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "gif", "svg", "avif"];

export function ImageUploadDropzone({
  storeId,
  onUploadComplete,
  className = "",
  compact = false,
  disabled = false,
}: ImageUploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  const processAndUploadFiles = useCallback(
    async (fileList: FileList | File[]) => {
      if (disabled || isProcessing) return;
      setError(null);
      setIsProcessing(true);

      const files = Array.from(fileList);
      if (files.length === 0) {
        setIsProcessing(false);
        return;
      }

      try {
        const formData = new FormData();
        let totalImageCount = 0;
        let zipArchiveCount = 0;

        for (const file of files) {
          const ext = file.name.split(".").pop()?.toLowerCase() || "";
          const isZip = ext === "zip" || file.type.includes("zip");

          if (isZip) {
            zipArchiveCount++;
            setStatusMessage(`Reading ZIP archive: ${file.name}...`);
            // Client-side validation of zip with JSZip to ensure it has valid images
            try {
              const zip = await JSZip.loadAsync(file);
              let zipImgCount = 0;
              for (const [entryPath, entry] of Object.entries(zip.files)) {
                if (entry.dir) continue;
                if (
                  entryPath.includes("__MACOSX") ||
                  entryPath.startsWith(".") ||
                  entryPath.includes("/.")
                ) {
                  continue;
                }
                const entryExt = entryPath.split(".").pop()?.toLowerCase() || "";
                if (SUPPORTED_IMAGE_EXTS.includes(entryExt)) {
                  zipImgCount++;
                }
              }

              if (zipImgCount === 0) {
                throw new Error(
                  `No supported image files found inside "${file.name}". Valid formats: JPG, PNG, WEBP, GIF, SVG, AVIF.`
                );
              }
              totalImageCount += zipImgCount;
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : "Failed to read zip archive";
              throw new Error(msg);
            }

            formData.append("files", file);
          } else if (SUPPORTED_IMAGE_EXTS.includes(ext) || file.type.startsWith("image/")) {
            totalImageCount++;
            formData.append("files", file);
          } else {
            throw new Error(
              `"${file.name}" is not a supported image or .zip archive. Supported formats: JPG, PNG, WEBP, GIF, SVG, AVIF, ZIP.`
            );
          }
        }

        if (totalImageCount === 0) {
          throw new Error("No valid images selected for upload.");
        }

        const uploadLabel =
          zipArchiveCount > 0
            ? `Uploading and extracting ${totalImageCount} image${totalImageCount === 1 ? "" : "s"}...`
            : `Uploading ${totalImageCount} image${totalImageCount === 1 ? "" : "s"}...`;

        setStatusMessage(uploadLabel);

        const response = await apiClient.post<{
          files: Array<{
            id: string;
            url: string;
            originalName: string;
            altText: string;
          }>;
        }>(`/api/v1/stores/${storeId}/uploads`, formData, { storeId });

        if (response && response.files && response.files.length > 0) {
          const newItems: UploadedMediaItem[] = response.files.map((f) => ({
            id: f.id,
            url: f.url,
            altText: f.altText || f.originalName,
          }));

          onUploadComplete(newItems);
          setStatusMessage(null);
        } else {
          throw new Error("Server returned an empty response");
        }
      } catch (err: unknown) {
        if (err instanceof ApiClientError) {
          setError(err.message || "Failed to upload images");
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("An unexpected error occurred during image upload");
        }
      } finally {
        setIsProcessing(false);
        setStatusMessage(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        if (zipInputRef.current) zipInputRef.current.value = "";
      }
    },
    [disabled, isProcessing, storeId, onUploadComplete]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || isProcessing) return;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled || isProcessing) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processAndUploadFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processAndUploadFiles(e.target.files);
    }
  };

  return (
    <div className={`image-upload-dropzone space-y-2.5 ${className}`}>
      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/avif"
        className="hidden"
        onChange={handleFileSelect}
        disabled={disabled || isProcessing}
      />
      <input
        ref={zipInputRef}
        type="file"
        accept=".zip,application/zip,application/x-zip-compressed"
        className="hidden"
        onChange={handleFileSelect}
        disabled={disabled || isProcessing}
      />

      {/* Main Dropzone Surface */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl transition-all duration-200 text-center select-none ${
          compact ? "p-4 sm:p-5" : "p-6 sm:p-8"
        } ${
          isDragging
            ? "border-primary bg-primary/10 ring-2 ring-primary/30 scale-[1.005]"
            : "border-border/70 bg-muted/15 hover:border-primary/50 hover:bg-muted/25"
        } ${disabled || isProcessing ? "opacity-70 pointer-events-none" : "cursor-pointer"}`}
        onClick={() => {
          if (!isProcessing && !disabled && fileInputRef.current) {
            fileInputRef.current.click();
          }
        }}
      >
        <div className="flex flex-col items-center justify-center gap-2.5 max-w-md mx-auto">
          {/* Animated Icon Badge */}
          <div
            className={`rounded-full flex items-center justify-center transition-transform ${
              compact ? "w-10 h-10" : "w-12 h-12"
            } ${
              isDragging
                ? "bg-primary text-primary-foreground scale-110 shadow-md shadow-primary/25"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {isProcessing ? (
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            ) : isDragging ? (
              <UploadCloud className="w-6 h-6 animate-bounce" />
            ) : (
              <UploadCloud className="w-5 h-5" />
            )}
          </div>

          {/* Primary Action & Guidance Text */}
          <div className="space-y-1">
            <p className="text-xs sm:text-sm font-semibold text-foreground">
              {isProcessing
                ? statusMessage || "Processing files..."
                : isDragging
                ? "Drop your images or .zip archive here"
                : "Drag & drop product images, or choose files"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Supports JPG, PNG, WEBP, GIF, SVG, AVIF, or a <strong className="text-foreground font-semibold">.ZIP</strong> archive containing multiple images (up to 50MB)
            </p>
          </div>

          {/* Quick Action Buttons */}
          {!isProcessing && (
            <div
              className="flex items-center gap-2 pt-1 flex-wrap justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs active:scale-[0.98]"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Browse Images</span>
              </button>

              <button
                type="button"
                onClick={() => zipInputRef.current?.click()}
                disabled={disabled}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border/80 bg-background text-foreground hover:bg-muted transition-colors shadow-xs active:scale-[0.98]"
                title="Extract and upload all images inside a .zip file"
              >
                <FolderArchive className="w-3.5 h-3.5 text-amber-500" />
                <span>Upload ZIP</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Error Reporting Banner */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold">Upload error: </span>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-xs hover:underline font-semibold ml-2"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
