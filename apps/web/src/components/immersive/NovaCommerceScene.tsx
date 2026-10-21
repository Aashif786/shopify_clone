"use client";

import React, { useEffect, useRef, useState } from "react";

export function checkWebGLSupport(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

interface NovaCommerceSceneProps {
  density?: "hero" | "storefront" | "catalog";
  className?: string;
}

export function NovaCommerceScene({
  density = "hero",
  className = "",
}: NovaCommerceSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    setIsSupported(checkWebGLSupport());

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(motionQuery.matches);
    const motionHandler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    motionQuery.addEventListener("change", motionHandler);

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry?.isIntersecting ?? false);
      },
      { rootMargin: "100px" }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      motionQuery.removeEventListener("change", motionHandler);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!isSupported || reducedMotion || !isVisible) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.offsetWidth || 300);
    let height = (canvas.height = canvas.offsetHeight || 200);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth || 300;
      height = canvas.height = canvas.offsetHeight || 200;
    };
    window.addEventListener("resize", handleResize);

    const particleCount = density === "catalog" ? 20 : density === "storefront" ? 30 : 45;
    const particles = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 2 + 1,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      color:
        Math.random() > 0.5
          ? "rgba(168, 216, 255, 0.45)"
          : Math.random() > 0.5
          ? "rgba(168, 117, 255, 0.45)"
          : "rgba(101, 88, 245, 0.45)",
    }));

    let t = 0;
    const render = () => {
      t += 0.01;
      ctx.clearRect(0, 0, width, height);

      // Render glowing kinetic nodes
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 8 + Math.sin(t) * 2;
        ctx.shadowColor = p.color;
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
    };
  }, [isSupported, reducedMotion, isVisible, density]);

  // Graceful fallback when WebGL/Canvas is unavailable or reduced-motion is requested
  if (!isSupported || reducedMotion) {
    return (
      <div
        ref={containerRef}
        className={`nova-3d-scene nova-3d-scene-fallback ${className}`}
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(168, 117, 255, 0.15) 0%, transparent 70%)",
        }}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className={`nova-3d-scene ${className}`}
      aria-hidden="true"
      style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
