"use client";

import React, {  useRef, useState  } from "react";
import { motion, useScroll, useTransform, useMotionValueEvent } from "framer-motion";

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
  const sectionRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  // Calculate percentage to translate from 0 to -(scenes.length - 1) * (100 / scenes.length)%
  const maxTranslatePercent = ((scenes.length - 1) / scenes.length) * 100;
  const x = useTransform(scrollYProgress, [0, 1], ["0%", `-${maxTranslatePercent}%`]);

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const idx = Math.min(Math.floor(latest * scenes.length), scenes.length - 1);
    setActiveIdx(idx);
  });

  return (
    <section
      id="platform"
      ref={sectionRef}
      className="relative bg-[var(--bg-primary)] h-[350vh] sm:h-[400vh]"
    >
      {/* Sticky container that locks full viewport while horizontal track translates */}
      <div className="sticky top-0 h-screen w-full overflow-hidden flex flex-col justify-center">
        {/* Top Section indicator label */}
        <div className="absolute top-8 left-6 sm:left-12 z-20 flex items-center gap-3 pointer-events-none">
          <span className="text-[11px] font-mono font-semibold text-[var(--text-muted)] tracking-widest uppercase">
            05 / A NEW DIMENSION
          </span>
          <div className="w-8 h-px bg-[var(--border)]" />
          <span className="text-[11px] font-mono text-[var(--text-muted)]">SCROLL TO DISCOVER &rarr;</span>
        </div>

        {/* Progress indicator pill dots */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 pointer-events-none">
          {scenes.map((scene, i) => (
            <div
              key={scene.id}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                activeIdx === i
                  ? "w-7 bg-cobalt-500 shadow-sm shadow-cobalt-500/50"
                  : "w-1.5 bg-[var(--text-muted)]/40"
              }`}
            />
          ))}
        </div>

        {/* Horizontal moving track */}
        <motion.div
          style={{ x }}
          className="flex will-change-transform h-full"
          style-width={`${scenes.length * 100}vw`}
        >
          {scenes.map((scene, i) => (
            <div
              key={scene.id}
              className="relative w-screen h-screen flex-shrink-0 flex items-center"
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
                    <span className="text-5xl sm:text-7xl lg:text-9xl select-none" role="img" aria-label={scene.id}>
                      {scene.icon}
                    </span>
                    <span className="font-mono text-xs text-[var(--text-muted)] tracking-[0.3em] font-semibold">
                      0{i + 1} / 0{scenes.length}
                    </span>
                  </div>

                  {/* Scene content headline & detail */}
                  <div className="flex-1 min-w-0">
                    <div className="overflow-hidden">
                      <div className="font-display font-800 leading-[1.08] tracking-tight text-[clamp(2.5rem,6vw,7rem)] text-[var(--text-muted)]">
                        {scene.headline}
                      </div>
                    </div>
                    <div className="overflow-hidden">
                      <div
                        className={`font-display font-800 leading-[1.08] tracking-tight text-[clamp(2.5rem,6vw,7rem)] text-transparent bg-gradient-to-r ${scene.accent} bg-clip-text`}
                      >
                        {scene.sub}
                      </div>
                    </div>
                    <div className="mt-6 sm:mt-8 flex items-center gap-4">
                      <div className={`h-0.5 w-12 bg-gradient-to-r ${scene.accent} shrink-0`} />
                      <p className="text-sm sm:text-base text-[var(--text-muted)] leading-relaxed">
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
