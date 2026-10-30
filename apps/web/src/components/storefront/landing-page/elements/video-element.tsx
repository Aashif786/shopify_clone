"use client";

import React from "react";
import type { PageElement } from "@calcart/stores/landing-page";

interface VideoElementProps {
  element: PageElement;
}

export function VideoElement({ element }: VideoElementProps) {
  const content = (element.content || {}) as {
    videoUrl?: string;
    posterUrl?: string;
    aspectRatio?: "16/9" | "4/3" | "1/1" | "21/9";
    autoplay?: boolean;
    loop?: boolean;
    muted?: boolean;
    controls?: boolean;
  };
  const style = element.style || {};

  const videoUrl = content.videoUrl || "";
  const posterUrl = content.posterUrl;
  const ratio = content.aspectRatio || "16/9";
  const autoplay = content.autoplay ?? false;
  const loop = content.loop ?? true;
  const muted = content.muted ?? true;
  const controls = content.controls ?? true;

  const ratioClasses: Record<string, string> = {
    "1/1": "aspect-square",
    "4/3": "aspect-[4/3]",
    "16/9": "aspect-video",
    "21/9": "aspect-[21/9]",
  };

  const isEmbed =
    videoUrl.includes("youtube.com") ||
    videoUrl.includes("youtu.be") ||
    videoUrl.includes("vimeo.com");

  const getEmbedUrl = (url: string) => {
    if (url.includes("youtube.com/watch?v=")) {
      return url.replace("watch?v=", "embed/");
    }
    if (url.includes("youtu.be/")) {
      return url.replace("youtu.be/", "www.youtube.com/embed/");
    }
    if (url.includes("vimeo.com/")) {
      return url.replace("vimeo.com/", "player.vimeo.com/video/");
    }
    return url;
  };

  return (
    <div
      className={`w-full overflow-hidden rounded-2xl shadow-lg border border-border/40 ${
        ratioClasses[ratio] || ratioClasses["16/9"]
      } bg-black/40`}
      style={{ maxWidth: style.maxWidth || undefined }}
    >
      {isEmbed ? (
        <iframe
          src={getEmbedUrl(videoUrl)}
          className="w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : videoUrl ? (
        <video
          src={videoUrl}
          poster={posterUrl}
          autoPlay={autoplay}
          loop={loop}
          muted={muted}
          controls={controls}
          playsInline
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
          <p className="text-sm font-medium">No video URL specified</p>
          <p className="text-xs opacity-75 mt-1">Add an MP4 link or YouTube/Vimeo embed URL</p>
        </div>
      )}
    </div>
  );
}
