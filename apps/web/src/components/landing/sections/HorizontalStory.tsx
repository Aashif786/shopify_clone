"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useMotionValueEvent,
  useReducedMotion,
} from "framer-motion";

interface Scene {
  id: string;
  headline: string;
  sub: string;
  accent: string;
  bg: string;
  icon: string;
  detail: string;
}

const scenes: Scene[] = [
  {
    id: "storefront",
    headline: "Your storefront,",
    sub: "beautifully alive.",
    accent: "from-cobalt-600 to-cobalt-400",
    bg: "from-cobalt-600/10 to-violet-600/5",
    icon: "🛍️",
    detail: "Custom themes, live catalog preview, and instant publishable variants",
  },
  {
    id: "catalogue",
    headline: "Products that",
    sub: "tell stories.",
    accent: "from-violet-600 to-violet-400",
    bg: "from-violet-600/10 to-cobalt-600/5",
    icon: "📦",
    detail: "Rich photography, standalone option publishing, and granular SKU matrices",
  },
  {
    id: "orders",
    headline: "Orders &",
    sub: "inventory in sync.",
    accent: "from-coral-500 to-tangerine-400",
    bg: "from-coral-500/10 to-tangerine-400/5",
    icon: "⚡",
    detail: "Real-time stock reservation, concurrency safety, and zero oversells",
  },
  {
    id: "payments",
    headline: "Payments,",
    sub: "without friction.",
    accent: "from-tangerine-500 to-lime-400",
    bg: "from-tangerine-500/10 to-lime-400/5",
    icon: "💳",
    detail: "Cryptographic HMAC webhook confirmation, Razorpay integration, and instant receipts",
  },
  {
    id: "analytics",
    headline: "Insight at",
    sub: "every turn.",
    accent: "from-lime-400 to-cobalt-400",
    bg: "from-lime-400/10 to-cobalt-600/5",
    icon: "📈",
    detail: "Live revenue dashboards, inventory velocity, and multi-tenant telemetry",
  },
];

export default function HorizontalStory() {
  const sectionRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const [activeIdx, setActiveIdx] = useState(0);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [travelDistance, setTravelDistance] = useState<number>(0);
  const [isMounted, setIsMounted] = useState<boolean>(false);

  const shouldReduceMotion = useReducedMotion();
  const prefersReduced = isMounted && !!shouldReduceMotion;

  // Measure actual container and track dimensions to compute exact travel distance
  const updateMeasurements = useCallback(() => {
    if (!containerRef.current || !trackRef.current) return;
    const cWidth = containerRef.current.clientWidth;
    const tWidth = trackRef.current.scrollWidth;

    setContainerWidth(cWidth);

    // Exact horizontal distance needed to scroll the entire track until the final card aligns perfectly
    const distance = Math.max(0, tWidth - cWidth);
    setTravelDistance(distance);
  }, []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (prefersReduced) return;

    updateMeasurements();

    // Re-measure after initial layout pass and image/font settlement
    const rafId = requestAnimationFrame(() => {
      updateMeasurements();
    });

    window.addEventListener("resize", updateMeasurements, { passive: true });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        updateMeasurements();
      });
      if (containerRef.current) resizeObserver.observe(containerRef.current);
      if (trackRef.current) resizeObserver.observe(trackRef.current);
    }

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", updateMeasurements);
      resizeObserver?.disconnect();
    };
  }, [updateMeasurements, prefersReduced]);

  // Framer Motion scroll binding
  // start start: when top of sectionRef hits top of viewport (pinning begins)
  // end end: when bottom of sectionRef hits bottom of viewport (pinning ends)
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  // Calculate horizontal translate mapping:
  // When scrollYProgress is 0 -> 0px
  // When scrollYProgress is 1 -> -travelDistance (px)
  const x = useTransform(scrollYProgress, (rawProgress: unknown) => {
    const progress = typeof rawProgress === "number" ? rawProgress : Number(rawProgress) || 0;
    const clampedProgress = Math.max(0, Math.min(progress, 1));
    const distance =
      travelDistance > 0
        ? travelDistance
        : (scenes.length - 1) *
          (containerWidth || (typeof window !== "undefined" ? window.innerWidth : 1200));
    return -clampedProgress * distance;
  });

  useMotionValueEvent(scrollYProgress, "change", (latest: number) => {
    const idx = Math.max(0, Math.min(Math.floor(latest * scenes.length), scenes.length - 1));
    setActiveIdx(idx);
  });

  const scrollToScene = (index: number) => {
    if (!sectionRef.current) return;
    const rect = sectionRef.current.getBoundingClientRect();
    const scrollTop = window.scrollY + rect.top;
    const scrollableDistance = sectionRef.current.offsetHeight - window.innerHeight;
    if (scrollableDistance > 0) {
      const targetScroll = scrollTop + (index / (scenes.length - 1)) * scrollableDistance;
      window.scrollTo({ top: targetScroll, behavior: "smooth" });
    }
  };

  // Accessible reduced-motion alternative layout
  if (prefersReduced) {
    return (
      <section
        id="platform"
        ref={sectionRef}
        className="relative bg-[var(--bg-primary)] py-20 px-6 sm:px-12 border-t border-[var(--border)]"
      >
        <div className="max-w-[1400px] mx-auto">
          {/* Section indicator label */}
          <div className="flex items-center gap-3 mb-12">
            <span className="text-[11px] font-mono font-medium text-[var(--text-muted)] tracking-[0.2em] uppercase">
              05 / A NEW DIMENSION
            </span>
            <div className="w-8 h-px bg-[var(--border)]" />
            <span className="text-[11px] font-mono font-medium text-[var(--text-muted)] tracking-wider">
              KEY CAPABILITIES
            </span>
          </div>

          {/* Grid of capability cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {scenes.map((scene, i) => (
              <div
                key={scene.id}
                className="relative p-8 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border)] flex flex-col justify-between overflow-hidden shadow-xs"
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${scene.bg} pointer-events-none`}
                  aria-hidden
                />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-4xl" role="img" aria-label={scene.id}>
                      {scene.icon}
                    </span>
                    <span className="font-mono text-xs text-[var(--text-muted)] tracking-[0.22em] font-medium">
                      0{i + 1} / 0{scenes.length}
                    </span>
                  </div>
                  <h3 className="font-display font-medium text-2xl text-[var(--text-muted)] mb-1">
                    {scene.headline}
                  </h3>
                  <div
                    className={`font-display font-bold text-2xl text-transparent bg-gradient-to-r ${scene.accent} bg-clip-text mb-4`}
                  >
                    {scene.sub}
                  </div>
                  <p className="font-sans text-sm text-[var(--text-muted)] leading-[1.6]">
                    {scene.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      id="platform"
      ref={sectionRef}
      className="relative bg-[var(--bg-primary)] h-[400vh] sm:h-[450vh] lg:h-[500vh]"
    >
      {/* Sticky container that locks full viewport while horizontal track translates */}
      <div
        ref={containerRef}
        className="sticky top-0 h-screen w-full overflow-hidden flex flex-col justify-center"
      >
        {/* Top Section indicator label — positioned below fixed navbar */}
        <div className="absolute top-20 sm:top-24 left-6 sm:left-12 z-20 flex items-center gap-3 pointer-events-none">
          <span className="text-[11px] font-mono font-medium text-[var(--text-muted)] tracking-[0.2em] uppercase">
            05 / A NEW DIMENSION
          </span>
          <div className="w-8 h-px bg-[var(--border)]" />
          <span className="text-[11px] font-mono font-medium text-[var(--text-muted)] tracking-wider">
            SCROLL TO DISCOVER &rarr;
          </span>
        </div>

        {/* Progress indicator pill dots with interactive click navigation */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
          {scenes.map((scene, i) => (
            <button
              type="button"
              key={scene.id}
              onClick={() => scrollToScene(i)}
              aria-label={`Jump to slide 0${i + 1}: ${scene.headline}`}
              className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cobalt-500 ${
                activeIdx === i
                  ? "w-7 bg-cobalt-500 shadow-sm shadow-cobalt-500/50"
                  : "w-1.5 bg-[var(--text-muted)]/40 hover:bg-[var(--text-muted)]/70"
              }`}
            />
          ))}
        </div>

        {/* Horizontal moving track */}
        <motion.div
          ref={trackRef}
          style={{ x }}
          className="flex will-change-transform h-full"
        >
          {scenes.map((scene, i) => (
            <div
              key={scene.id}
              style={{ width: containerWidth > 0 ? `${containerWidth}px` : "100vw" }}
              className="relative h-screen flex-shrink-0 flex items-center"
            >
              {/* Background gradient for this scene */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${scene.bg} pointer-events-none`}
                aria-hidden
              />

              <div className="relative z-10 max-w-[1400px] mx-auto px-6 sm:px-16 w-full">
                <div className="flex flex-col lg:flex-row items-start lg:items-center gap-10 lg:gap-16">
                  {/* Scene number and badge */}
                  <div className="flex flex-row lg:flex-col items-center lg:items-start gap-4 lg:gap-6 shrink-0">
                    <span
                      className="text-5xl sm:text-7xl lg:text-9xl select-none"
                      role="img"
                      aria-label={scene.id}
                    >
                      {scene.icon}
                    </span>
                    <span className="font-mono text-xs text-[var(--text-muted)] tracking-[0.22em] font-medium">
                      0{i + 1} / 0{scenes.length}
                    </span>
                  </div>

                  {/* Scene content headline & detail */}
                  <div className="flex-1 min-w-0">
                    <div className="overflow-hidden">
                      <div className="font-display font-medium leading-[1.04] tracking-[-0.035em] text-[clamp(2.5rem,5.5vw,6rem)] text-[var(--text-muted)]">
                        {scene.headline}
                      </div>
                    </div>
                    <div className="overflow-hidden">
                      <div
                        className={`font-display font-bold leading-[1.04] tracking-[-0.035em] text-[clamp(2.5rem,5.5vw,6rem)] text-transparent bg-gradient-to-r ${scene.accent} bg-clip-text`}
                      >
                        {scene.sub}
                      </div>
                    </div>
                    <div className="mt-6 sm:mt-8 flex items-center gap-4">
                      <div className={`h-0.5 w-12 bg-gradient-to-r ${scene.accent} shrink-0`} />
                      <p className="font-sans text-sm sm:text-base text-[var(--text-muted)] leading-[1.7] max-w-xl">
                        {scene.detail}
                      </p>
                    </div>
                  </div>

                  {/* Right abstract metrics / UI visual */}
                  <div className="hidden xl:flex flex-col gap-3 shrink-0 w-72">
                    {Array.from({ length: 4 }).map((_, j) => (
                      <div
                        key={j}
                        className="h-12 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center px-4 gap-3 shadow-xs"
                        style={{ opacity: 1 - j * 0.18 }}
                      >
                        <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${scene.accent}`} />
                        <div
                          className="h-2 rounded-full bg-[var(--text-muted)]/20"
                          style={{ width: `${[70, 55, 80, 45][j]}%` }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
