"use client";

import React, { useRef, useState } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useInView,
  useReducedMotion,
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

interface DimensionConfig {
  id: string;
  sectionId: string;
  number: string;
  dimensionCode: string;
  category: string;
  headline: string;
  sub: string;
  accent: string;
  accentBorder: string;
  accentText: string;
  bgGlow: string;
  icon: React.ElementType;
  detail: string;
  highlightTag: string;
  visualComponent: React.ComponentType<{ isHovered?: boolean }>;
  isReversed: boolean;
  bgClass: string;
}

const dimensions: DimensionConfig[] = [
  {
    id: "storefront",
    sectionId: "platform", // Preserves anchor target for Navigation "Platform" link
    number: "01",
    dimensionCode: "05.1",
    category: "STOREFRONT ENGINE",
    headline: "Your storefront,",
    sub: "beautifully alive.",
    accent: "from-cobalt-600 to-cobalt-400",
    accentBorder: "hover:border-cobalt-500/50",
    accentText: "text-cobalt-500 dark:text-cobalt-400",
    bgGlow: "from-cobalt-600/15 via-violet-600/10 to-transparent",
    icon: Store,
    detail: "Custom themes, live catalog preview, and instant publishable variants",
    highlightTag: "14ms Edge Latency • Zero Layout Shift",
    visualComponent: StorefrontPreviewVisual,
    isReversed: false,
    bgClass: "bg-[var(--bg-secondary)]",
  },
  {
    id: "catalogue",
    sectionId: "catalog-dimension",
    number: "02",
    dimensionCode: "05.2",
    category: "CATALOG ARCHITECTURE",
    headline: "Products that",
    sub: "tell stories.",
    accent: "from-violet-600 to-violet-400",
    accentBorder: "hover:border-violet-500/50",
    accentText: "text-violet-500 dark:text-violet-400",
    bgGlow: "from-violet-600/15 via-cobalt-600/10 to-transparent",
    icon: Layers,
    detail: "Rich photography, standalone option publishing, and granular SKU matrices",
    highlightTag: "Independent Canonical URLs • Isolated Listings",
    visualComponent: ProductsMatrixVisual,
    isReversed: true,
    bgClass: "bg-[var(--bg-primary)]",
  },
  {
    id: "orders",
    sectionId: "orders-dimension",
    number: "03",
    dimensionCode: "05.3",
    category: "CONCURRENCY ENGINE",
    headline: "Orders &",
    sub: "inventory in sync.",
    accent: "from-coral-500 to-tangerine-400",
    accentBorder: "hover:border-coral-500/50",
    accentText: "text-coral-500 dark:text-coral-400",
    bgGlow: "from-coral-500/15 via-tangerine-500/10 to-transparent",
    icon: RefreshCw,
    detail: "Real-time stock reservation, concurrency safety, and zero oversells",
    highlightTag: "PostgreSQL SERIALIZABLE • Zero-Oversell Locks",
    visualComponent: InventorySyncVisual,
    isReversed: false,
    bgClass: "bg-[var(--bg-secondary)]",
  },
  {
    id: "payments",
    sectionId: "payments-dimension",
    number: "04",
    dimensionCode: "05.4",
    category: "CRYPTOGRAPHIC LEDGER",
    headline: "Payments,",
    sub: "without friction.",
    accent: "from-tangerine-500 to-lime-400",
    accentBorder: "hover:border-tangerine-500/50",
    accentText: "text-tangerine-500 dark:text-tangerine-400",
    bgGlow: "from-tangerine-500/15 via-lime-400/10 to-transparent",
    icon: ShieldCheck,
    detail: "Cryptographic HMAC webhook confirmation, Razorpay integration, and instant receipts",
    highlightTag: "HMAC-SHA256 Signed • 48ms Webhook Confirmation",
    visualComponent: PaymentsWebhookVisual,
    isReversed: true,
    bgClass: "bg-[var(--bg-primary)]",
  },
  {
    id: "analytics",
    sectionId: "telemetry-dimension",
    number: "05",
    dimensionCode: "05.5",
    category: "TELEMETRY ENGINE",
    headline: "Insight at",
    sub: "every turn.",
    accent: "from-lime-400 to-cobalt-400",
    accentBorder: "hover:border-lime-400/50",
    accentText: "text-lime-500 dark:text-lime-400",
    bgGlow: "from-lime-400/15 via-cobalt-600/10 to-transparent",
    icon: TrendingUp,
    detail: "Live revenue dashboards, inventory velocity, and multi-tenant telemetry",
    highlightTag: "Real-Time Telemetry • Multi-Tenant Context",
    visualComponent: AnalyticsTelemetryVisual,
    isReversed: false,
    bgClass: "bg-[var(--bg-secondary)]",
  },
];

function IndividualDimensionSection({
  dimension,
  index,
  total,
  isFirst = false,
}: {
  dimension: DimensionConfig;
  index: number;
  total: number;
  isFirst?: boolean;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { once: true, margin: "-12%" });
  const shouldReduceMotion = useReducedMotion();
  const [isHovered, setIsHovered] = useState(false);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  // Parallax subtle background shift
  const bgY = useTransform(
    scrollYProgress,
    [0, 1],
    shouldReduceMotion ? ["0%", "0%"] : ["-10%", "10%"]
  );

  // Parallax subtle visual card elevation shift
  const cardY = useTransform(
    scrollYProgress,
    [0, 1],
    shouldReduceMotion ? [0, 0] : [24, -24]
  );

  const Visual = dimension.visualComponent;
  const IconComp = dimension.icon;

  return (
    <section
      id={dimension.sectionId}
      ref={sectionRef}
      className={`relative py-28 sm:py-36 overflow-hidden ${dimension.bgClass} border-t border-[var(--border)]`}
    >
      {/* Parallax Ambient Glow Background */}
      <motion.div
        style={{ y: bgY }}
        className="absolute inset-0 pointer-events-none"
        aria-hidden
      >
        <div
          className={`absolute ${
            dimension.isReversed ? "top-1/4 right-[-5%]" : "top-1/4 left-[-5%]"
          } w-[650px] h-[650px] rounded-full bg-gradient-to-br ${dimension.bgGlow} blur-3xl opacity-60`}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[var(--border)]/10 to-transparent" />
      </motion.div>

      <div className="max-w-[1400px] mx-auto px-6 relative z-10">
        {/* If first section, show overarching 05 / A NEW DIMENSION category label */}
        {isFirst && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-3 mb-16 sm:mb-20"
          >
            <span className="text-[11px] font-mono font-medium text-[var(--text-muted)] tracking-[0.2em] uppercase">
              05 / A NEW DIMENSION
            </span>
            <div className="w-8 h-px bg-[var(--border)]" />
            <span className="text-[11px] font-mono font-medium text-[var(--text-muted)] tracking-wider">
              KEY CAPABILITIES • SCROLL TO DISCOVER
            </span>
          </motion.div>
        )}

        {/* Section Grid: Alternating Layout between Narrative and Visual Showcase */}
        <div
          className={`grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center ${
            dimension.isReversed ? "lg:[&>*:first-child]:order-2" : ""
          }`}
        >
          {/* Narrative Column (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Header Badge & Category */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center gap-3"
            >
              <div className="w-9 h-9 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] flex items-center justify-center text-[var(--text-primary)] shadow-xs">
                <IconComp size={18} className={dimension.accentText} />
              </div>
              <div>
                <span className="font-mono text-xs font-semibold text-[var(--text-primary)] tracking-wider uppercase block">
                  {dimension.category}
                </span>
                <span className="font-mono text-[10px] text-[var(--text-muted)] tracking-widest uppercase">
                  0{index + 1} / 0{total}
                </span>
              </div>
            </motion.div>

            {/* Masked Line Reveal Headline */}
            <div>
              <div className="overflow-hidden">
                <motion.h2
                  initial={{ y: 36, opacity: 0 }}
                  animate={inView ? { y: 0, opacity: 1 } : {}}
                  transition={{ duration: 0.7, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
                  className="font-display font-medium leading-[1.04] tracking-[-0.035em] text-[clamp(2.4rem,4.5vw,4.5rem)] text-[var(--text-primary)]"
                >
                  {dimension.headline}
                </motion.h2>
              </div>
              <div className="overflow-hidden">
                <motion.div
                  initial={{ y: 36, opacity: 0 }}
                  animate={inView ? { y: 0, opacity: 1 } : {}}
                  transition={{ duration: 0.7, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  className={`font-display font-bold leading-[1.04] tracking-[-0.035em] text-[clamp(2.4rem,4.5vw,4.5rem)] text-transparent bg-gradient-to-r ${dimension.accent} bg-clip-text`}
                >
                  {dimension.sub}
                </motion.div>
              </div>
            </div>

            {/* Detail Description & Guarantee Accent */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className={`h-0.5 w-10 bg-gradient-to-r ${dimension.accent} shrink-0`} />
                <span className="font-mono text-[11px] text-[var(--text-muted)] tracking-wider uppercase">
                  CORE GUARANTEE
                </span>
              </div>
              <p className="font-sans text-base text-[var(--text-secondary)] leading-relaxed max-w-lg">
                {dimension.detail}
              </p>
            </motion.div>

            {/* Architectural Highlight Tag */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={inView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.5, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="pt-2 flex flex-wrap items-center gap-2"
            >
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[var(--bg-primary)] border border-[var(--border)] text-xs font-mono text-[var(--text-muted)] shadow-xs">
                <CheckCircle2 size={13} className={dimension.accentText} />
                <span>{dimension.highlightTag}</span>
              </div>
            </motion.div>
          </div>

          {/* Interactive Feature Showcase Column (7 cols) */}
          <motion.div
            style={{ y: cardY }}
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
            transition={{ duration: 0.8, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
            tabIndex={0}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onFocus={() => setIsHovered(true)}
            onBlur={() => setIsHovered(false)}
            className={`lg:col-span-7 group relative rounded-3xl p-3 sm:p-5 bg-[var(--bg-primary)]/50 border border-[var(--border)] ${dimension.accentBorder} transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-cobalt-500 hover:-translate-y-1 hover:shadow-2xl`}
          >
            {/* Ambient Card Glow */}
            <div
              className={`absolute -inset-1 rounded-3xl bg-gradient-to-r ${dimension.accent} opacity-0 group-hover:opacity-15 blur-xl transition-opacity duration-500 pointer-events-none`}
              aria-hidden
            />

            {/* Interactive Visual Canvas */}
            <div className="relative z-10 w-full">
              <Visual isHovered={isHovered} />
            </div>

            {/* Micro Interaction Footer */}
            <div className="mt-3.5 flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)] px-2">
              <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider">
                <Sparkles size={11} className={dimension.accentText} />
                Interactive Showcase
              </span>
              <div className="flex items-center gap-1 text-[10px] group-hover:text-[var(--text-primary)] transition-colors">
                <span>{dimension.dimensionCode} Architecture</span>
                <ArrowUpRight size={12} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export default function HorizontalStory() {
  return (
    <div className="relative flex flex-col">
      {dimensions.map((dim, i) => (
        <IndividualDimensionSection
          key={dim.id}
          dimension={dim}
          index={i}
          total={dimensions.length}
          isFirst={i === 0}
        />
      ))}
    </div>
  );
}
