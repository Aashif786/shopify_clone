"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useMotionValueEvent,
  useReducedMotion,
  useInView,
} from "framer-motion";
import {
  Store,
  Layers,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  ArrowUpRight,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import {
  StorefrontPreviewVisual,
  ProductsMatrixVisual,
  InventorySyncVisual,
  PaymentsWebhookVisual,
  AnalyticsTelemetryVisual,
} from "./FeatureVisuals";

interface Scene {
  id: string;
  number: string;
  category: string;
  headline: string;
  sub: string;
  accent: string;
  accentBorder: string;
  accentText: string;
  bg: string;
  icon: React.ElementType;
  detail: string;
  highlightTag: string;
  visualComponent: React.ComponentType<{ isHovered?: boolean }>;
}

const scenes: Scene[] = [
  {
    id: "storefront",
    number: "01",
    category: "STOREFRONT ENGINE",
    headline: "Your storefront,",
    sub: "beautifully alive.",
    accent: "from-cobalt-600 to-cobalt-400",
    accentBorder: "group-hover:border-cobalt-500/50",
    accentText: "text-cobalt-500 dark:text-cobalt-400",
    bg: "from-cobalt-600/10 via-cobalt-500/5 to-transparent",
    icon: Store,
    detail: "Custom themes, live catalog preview, and instant publishable variants",
    highlightTag: "14ms Edge Latency • Zero Layout Shift",
    visualComponent: StorefrontPreviewVisual,
  },
  {
    id: "catalogue",
    number: "02",
    category: "CATALOG ARCHITECTURE",
    headline: "Products that",
    sub: "tell stories.",
    accent: "from-violet-600 to-violet-400",
    accentBorder: "group-hover:border-violet-500/50",
    accentText: "text-violet-500 dark:text-violet-400",
    bg: "from-violet-600/10 via-violet-500/5 to-transparent",
    icon: Layers,
    detail: "Rich photography, standalone option publishing, and granular SKU matrices",
    highlightTag: "Independent Canonical URLs • Isolated Listings",
    visualComponent: ProductsMatrixVisual,
  },
  {
    id: "orders",
    number: "03",
    category: "CONCURRENCY ENGINE",
    headline: "Orders &",
    sub: "inventory in sync.",
    accent: "from-coral-500 to-tangerine-400",
    accentBorder: "group-hover:border-coral-500/50",
    accentText: "text-coral-500 dark:text-coral-400",
    bg: "from-coral-500/10 via-coral-400/5 to-transparent",
    icon: RefreshCw,
    detail: "Real-time stock reservation, concurrency safety, and zero oversells",
    highlightTag: "PostgreSQL SERIALIZABLE • Zero-Oversell Locks",
    visualComponent: InventorySyncVisual,
  },
  {
    id: "payments",
    number: "04",
    category: "CRYPTOGRAPHIC LEDGER",
    headline: "Payments,",
    sub: "without friction.",
    accent: "from-tangerine-500 to-lime-400",
    accentBorder: "group-hover:border-tangerine-500/50",
    accentText: "text-tangerine-500 dark:text-tangerine-400",
    bg: "from-tangerine-500/10 via-lime-400/5 to-transparent",
    icon: ShieldCheck,
    detail: "Cryptographic HMAC webhook confirmation, Razorpay integration, and instant receipts",
    highlightTag: "HMAC-SHA256 Signed • 48ms Webhook Confirmation",
    visualComponent: PaymentsWebhookVisual,
  },
  {
    id: "analytics",
    number: "05",
    category: "TELEMETRY ENGINE",
    headline: "Insight at",
    sub: "every turn.",
    accent: "from-lime-400 to-cobalt-400",
    accentBorder: "group-hover:border-lime-400/50",
    accentText: "text-lime-500 dark:text-lime-400",
    bg: "from-lime-400/10 via-cobalt-600/5 to-transparent",
    icon: TrendingUp,
    detail: "Live revenue dashboards, inventory velocity, and multi-tenant telemetry",
    highlightTag: "Real-Time Telemetry • Multi-Tenant Context",
    visualComponent: AnalyticsTelemetryVisual,
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
  const [hoveredCardIdx, setHoveredCardIdx] = useState<number | null>(null);

  const shouldReduceMotion = useReducedMotion();
  const prefersReduced = isMounted && !!shouldReduceMotion;

  const isInView = useInView(sectionRef, { once: true, margin: "-5%" });

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
  // When scrollYProgress is 0 -> 0px (Card 1)
  // By scrollYProgress 0.85 -> -travelDistance (Card 5 reached completely)
  // From 0.85 to 1.0 -> stays at -travelDistance (Card 5 stationary while pinned, before releasing pin)
  const TRAVEL_COMPLETION = 0.85;

  const x = useTransform(scrollYProgress, (rawProgress: unknown) => {
    const progress = typeof rawProgress === "number" ? rawProgress : Number(rawProgress) || 0;
    const horizontalProgress = Math.max(0, Math.min(progress / TRAVEL_COMPLETION, 1));
    const width =
      containerWidth > 0
        ? containerWidth
        : typeof window !== "undefined"
          ? window.innerWidth
          : 1200;
    const distance = travelDistance > 0 ? travelDistance : (scenes.length - 1) * width;
    return -horizontalProgress * distance;
  });

  useMotionValueEvent(scrollYProgress, "change", (latest: number) => {
    const horizontalProgress = Math.max(0, Math.min(latest / TRAVEL_COMPLETION, 1));
    const idx = Math.min(
      Math.round(horizontalProgress * (scenes.length - 1)),
      scenes.length - 1
    );
    setActiveIdx(idx);
  });

  const scrollToScene = (index: number) => {
    if (!sectionRef.current) return;
    const rect = sectionRef.current.getBoundingClientRect();
    const scrollTop = window.scrollY + rect.top;
    const scrollableDistance = sectionRef.current.offsetHeight - window.innerHeight;
    if (scrollableDistance > 0) {
      const targetFraction = (index / (scenes.length - 1)) * TRAVEL_COMPLETION;
      const targetScroll = scrollTop + targetFraction * scrollableDistance;
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

          {/* Grid of capability cards with their rich visual showcases */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {scenes.map((scene, i) => {
              const Visual = scene.visualComponent;
              const IconComp = scene.icon;
              return (
                <div
                  key={scene.id}
                  className="relative p-6 sm:p-8 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border)] flex flex-col justify-between overflow-hidden shadow-sm space-y-6"
                >
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${scene.bg} pointer-events-none`}
                    aria-hidden
                  />
                  <div className="relative z-10 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] flex items-center justify-center text-[var(--text-primary)]">
                          <IconComp size={16} className={scene.accentText} />
                        </div>
                        <span className="font-mono text-xs text-[var(--text-muted)] tracking-wider uppercase">
                          {scene.category}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-[var(--text-muted)] tracking-[0.22em] font-medium">
                        0{i + 1} / 0{scenes.length}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-display font-medium text-2xl text-[var(--text-primary)]">
                        {scene.headline}
                      </h3>
                      <div
                        className={`font-display font-bold text-2xl text-transparent bg-gradient-to-r ${scene.accent} bg-clip-text`}
                      >
                        {scene.sub}
                      </div>
                    </div>

                    <p className="font-sans text-sm text-[var(--text-muted)] leading-relaxed">
                      {scene.detail}
                    </p>

                    <div className="pt-2">
                      <Visual />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      id="platform"
      ref={sectionRef}
      className="relative bg-[var(--bg-primary)] h-[450vh] sm:h-[500vh] lg:h-[550vh]"
    >
      {/* Sticky container that locks full viewport while horizontal track translates */}
      <div
        ref={containerRef}
        className="sticky top-0 h-screen w-full overflow-hidden flex flex-col justify-center"
      >
        {/* Top Section indicator label — positioned below fixed navbar */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="absolute top-20 sm:top-24 left-6 sm:left-12 z-20 hidden sm:flex items-center gap-3 pointer-events-none"
        >
          <span className="text-[11px] font-mono font-medium text-[var(--text-muted)] tracking-[0.2em] uppercase">
            05 / A NEW DIMENSION
          </span>
          <div className="w-8 h-px bg-[var(--border)]" />
          <span className="text-[11px] font-mono font-medium text-[var(--text-muted)] tracking-wider flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cobalt-500 animate-pulse" />
            SCROLL TO DISCOVER &rarr;
          </span>
        </motion.div>

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
          {scenes.map((scene, i) => {
            const Visual = scene.visualComponent;
            const IconComp = scene.icon;
            const isSlideActive = activeIdx === i;

            return (
              <div
                key={scene.id}
                style={{ width: containerWidth > 0 ? `${containerWidth}px` : "100vw" }}
                className="relative h-screen flex-shrink-0 flex items-center px-6 sm:px-12 lg:px-16"
              >
                {/* Background ambient gradient for this scene */}
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${scene.bg} pointer-events-none transition-opacity duration-700 ${
                    isSlideActive ? "opacity-100" : "opacity-40"
                  }`}
                  aria-hidden
                />

                <div className="relative z-10 max-w-[1400px] mx-auto w-full pt-16 sm:pt-0">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center">
                    {/* Left Column: Narrative & Technical Typography (5 cols) */}
                    <div className="lg:col-span-5 space-y-6">
                      {/* Eyebrow badge with icon & slide count */}
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center justify-center text-[var(--text-primary)] shadow-xs">
                          <IconComp size={18} className={scene.accentText} />
                        </div>
                        <div>
                          <span className="font-mono text-xs font-semibold text-[var(--text-primary)] tracking-wider uppercase block">
                            {scene.category}
                          </span>
                          <span className="font-mono text-[10px] text-[var(--text-muted)] tracking-widest uppercase">
                            0{i + 1} / 0{scenes.length}
                          </span>
                        </div>
                      </div>

                      {/* Headline with Masked Word Reveal */}
                      <div>
                        <div className="overflow-hidden">
                          <motion.h2
                            animate={isSlideActive ? { y: 0, opacity: 1 } : { y: 24, opacity: 0.8 }}
                            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                            className="font-display font-medium leading-[1.04] tracking-[-0.035em] text-[clamp(2.2rem,4.5vw,4.5rem)] text-[var(--text-primary)]"
                          >
                            {scene.headline}
                          </motion.h2>
                        </div>
                        <div className="overflow-hidden">
                          <motion.div
                            animate={isSlideActive ? { y: 0, opacity: 1 } : { y: 24, opacity: 0.8 }}
                            transition={{ duration: 0.6, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
                            className={`font-display font-bold leading-[1.04] tracking-[-0.035em] text-[clamp(2.2rem,4.5vw,4.5rem)] text-transparent bg-gradient-to-r ${scene.accent} bg-clip-text`}
                          >
                            {scene.sub}
                          </motion.div>
                        </div>
                      </div>

                      {/* Detail Text & Decorative Accent Bar */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className={`h-0.5 w-10 bg-gradient-to-r ${scene.accent} shrink-0`} />
                          <span className="font-mono text-[11px] text-[var(--text-muted)] tracking-wider uppercase">
                            CORE GUARANTEE
                          </span>
                        </div>
                        <p className="font-sans text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed max-w-lg">
                          {scene.detail}
                        </p>
                      </div>

                      {/* Technical Capability Pill Tag */}
                      <div className="pt-1 flex flex-wrap items-center gap-2">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--border)] text-xs font-mono text-[var(--text-muted)]">
                          <CheckCircle2 size={12} className={scene.accentText} />
                          <span>{scene.highlightTag}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Custom Interactive Feature Visual Showcase (7 cols) */}
                    <div
                      tabIndex={0}
                      onMouseEnter={() => setHoveredCardIdx(i)}
                      onMouseLeave={() => setHoveredCardIdx(null)}
                      onFocus={() => setHoveredCardIdx(i)}
                      onBlur={() => setHoveredCardIdx(null)}
                      className={`lg:col-span-7 group relative rounded-3xl p-3 sm:p-5 bg-[var(--bg-secondary)]/40 border border-[var(--border)] ${scene.accentBorder} transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-cobalt-500 hover:-translate-y-1 hover:shadow-2xl`}
                    >
                      {/* Ambient card background glow */}
                      <div
                        className={`absolute -inset-1 rounded-3xl bg-gradient-to-r ${scene.accent} opacity-0 group-hover:opacity-15 blur-xl transition-opacity duration-500 pointer-events-none`}
                        aria-hidden
                      />

                      {/* Interactive Visual Canvas */}
                      <div className="relative z-10 w-full">
                        <Visual isHovered={hoveredCardIdx === i} />
                      </div>

                      {/* Hover / Focus Interactive Hint Badge */}
                      <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)] px-2">
                        <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider">
                          <Sparkles size={11} className={scene.accentText} />
                          Interactive Preview
                        </span>
                        <div className="flex items-center gap-1 text-[10px] group-hover:text-[var(--text-primary)] transition-colors">
                          <span>Explore dimension</span>
                          <ArrowUpRight size={12} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
