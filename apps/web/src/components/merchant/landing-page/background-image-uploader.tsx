"use client";

import React, { useState, useRef, useCallback } from "react";
import {
  UploadCloud,
  Image as ImageIcon,
  Loader2,
  AlertCircle,
  X,
  Link as LinkIcon,
  Check,
} from "lucide-react";
import { apiClient, ApiClientError } from "../../../lib/api-client";
import { Input } from "@/components/ui/input";

interface BackgroundImageUploaderProps {
  imageUrl?: string;
  onImageUrlChange: (url: string) => void;
  storeId?: string;
  label?: string;
  className?: string;
}

const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15MB

export function BackgroundImageUploader({
  imageUrl = "",
  onImageUrlChange,
  storeId,
  label = "Background Image",
  className = "",
}: BackgroundImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(
    async (file: File) => {
      if (!storeId) {
        setError("Store context not loaded. Please try again.");
        return;
      }

      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      if (ext === "svg" || file.type === "image/svg+xml") {
        setError("SVG background images are not supported for security reasons.");
        return;
      }

      if (file.size > MAX_UPLOAD_BYTES) {
        setError("Image size exceeds the 15MB limit.");
        return;
      }

      setError(null);
      setIsUploading(true);

      try {
        const formData = new FormData();
        formData.append("files", file);

        const response = await apiClient.post<{
          files: Array<{
            id: string;
            url: string;
            filename: string;
            originalName: string;
          }>;
        }>(`/api/v1/stores/${storeId}/uploads`, formData, { storeId });

        if (response?.files && response.files.length > 0) {
          const uploadedUrl = response.files[0]?.url;
          if (uploadedUrl) {
            onImageUrlChange(uploadedUrl);
          }
        } else {
          throw new Error("Server returned an empty upload response.");
        }
      } catch (err: unknown) {
        if (err instanceof ApiClientError) {
          setError(err.message || "Failed to upload image.");
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("An error occurred during upload.");
        }
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [storeId, onImageUrlChange]
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (isUploading) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file) handleUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUploading) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file) handleUpload(file);
    }
  };

  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={SUPPORTED_IMAGE_TYPES.join(",")}
        className="hidden"
        onChange={handleFileChange}
        disabled={isUploading}
      />

      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5 text-primary" />
          <span>{label}</span>
        </label>
        <button
          type="button"
          onClick={() => setShowManualInput((prev) => !prev)}
          className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors cursor-pointer"
        >
          <LinkIcon className="w-3 h-3" />
          <span>{showManualInput ? "Hide URL" : "Enter URL"}</span>
        </button>
      </div>

      {/* Image Preview & Actions (When image exists) */}
      {imageUrl ? (
        <div className="relative rounded-xl border border-border/80 bg-muted/20 p-2.5 transition-all">
          <div className="flex items-center gap-3">
            <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-border/60 bg-muted shrink-0">
              <img
                src={imageUrl}
                alt="Background preview"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <p className="text-xs font-medium text-foreground truncate" title={imageUrl}>
                {imageUrl.startsWith("/api/") ? "Uploaded Store Media" : imageUrl}
              </p>
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-500 font-medium">
                <Check className="w-3 h-3" />
                <span>Active Image</span>
              </div>
              <div className="flex items-center gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="text-[11px] font-semibold text-primary hover:underline cursor-pointer disabled:opacity-50"
                >
                  {isUploading ? "Uploading..." : "Replace"}
                </button>
                <span className="text-border">•</span>
                <button
                  type="button"
                  onClick={() => onImageUrlChange("")}
                  disabled={isUploading}
                  className="text-[11px] font-medium text-destructive hover:underline cursor-pointer"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Dropzone Surface (When no image set) */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => {
            if (!isUploading) fileInputRef.current?.click();
          }}
          className={`relative border-2 border-dashed rounded-xl p-4 transition-all duration-200 text-center select-none cursor-pointer ${
            isDragging
              ? "border-primary bg-primary/10 ring-2 ring-primary/30 scale-[1.005]"
              : "border-border/70 bg-muted/15 hover:border-primary/50 hover:bg-muted/25"
          } ${isUploading ? "opacity-75 pointer-events-none" : ""}`}
        >
          <div className="flex flex-col items-center justify-center gap-2">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-transform ${
                isDragging
                  ? "bg-primary text-primary-foreground scale-110"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {isUploading ? (
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              ) : (
                <UploadCloud className="w-4 h-4" />
              )}
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-foreground">
                {isUploading ? "Uploading image..." : "Upload background image"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Drop file here or click to browse (JPG, PNG, WEBP up to 15MB)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Manual URL Input (Expandable) */}
      {showManualInput && (
        <div className="space-y-1 pt-1">
          <Input
            value={imageUrl}
            onChange={(e) => onImageUrlChange(e.target.value)}
            placeholder="https://images.unsplash.com/... or /api/v1/stores/..."
            className="h-8 text-xs font-mono"
          />
          <p className="text-[10px] text-muted-foreground">
            Supports uploaded store assets or remote CDN URLs whitelisted in configuration.
          </p>
        </div>
      )}

      {/* Error Message Banner */}
      {error && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <div className="flex-1 text-[11px] leading-tight">
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
