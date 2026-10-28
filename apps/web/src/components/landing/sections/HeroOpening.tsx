"use client";

import React, {  useEffect, useRef  } from "react";
import { motion, useMotionValue, useSpring, useTransform, type Variants } from "framer-motion";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

const wordVariants: Variants = {
  hidden: { opacity: 0, y: 60, skewY: 4 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    skewY: 0,
    transition: {
      delay: 0.2 + i * 0.12,
      duration: 0.85,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
};

const headlineWords = ["Commerce,", "in a different", "dimension."];

const stats = [
  { value: "10x", label: "faster launch" },
  { value: "∞", label: "scalability" },
  { value: "0", label: "friction" },
];

export default function HeroOpening() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springX = useSpring(mouseX, { stiffness: 80, damping: 20 });
  const springY = useSpring(mouseY, { stiffness: 80, damping: 20 });

  const blob1X = useTransform(springX, [-1, 1], [-30, 30]);
  const blob1Y = useTransform(springY, [-1, 1], [-20, 20]);
  const blob2X = useTransform(springX, [-1, 1], [20, -20]);
  const blob2Y = useTransform(springY, [-1, 1], [15, -15]);

  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      const { innerWidth, innerHeight } = window;
      mouseX.set((e.clientX / innerWidth) * 2 - 1);
      mouseY.set((e.clientY / innerHeight) * 2 - 1);
    };
    window.addEventListener("mousemove", handleMouse, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouse);
  }, [mouseX, mouseY]);

  return (
    <section
      ref={containerRef}
      className="relative min-h-[92vh] flex flex-col justify-center overflow-hidden bg-[var(--bg-primary)] pt-20"
    >
      {/* Animated gradient blobs tracking cursor */}
      <motion.div
        style={{ x: blob1X, y: blob1Y }}
        className="absolute top-[-10%] right-[-5%] w-[650px] h-[650px] rounded-full pointer-events-none"
        aria-hidden
      >
        <div className="w-full h-full blob bg-gradient-to-br from-cobalt-500/20 via-violet-500/15 to-transparent dark:from-cobalt-600/30 dark:via-violet-600/20 blur-3xl" />
      </motion.div>

      <motion.div
        style={{ x: blob2X, y: blob2Y }}
        className="absolute bottom-[-10%] left-[-5%] w-[580px] h-[580px] rounded-full pointer-events-none"
        aria-hidden
      >
        <div className="w-full h-full blob bg-gradient-to-tr from-coral-500/15 via-tangerine-400/10 to-transparent dark:from-coral-500/25 dark:via-tangerine-500/15 blur-3xl" />
      </motion.div>

      {/* Background oversized watermark text */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden" aria-hidden>
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.2, duration: 1.8, ease: "easeOut" }}
          className="text-[18vw] font-display font-800 text-[var(--text-primary)]/[0.03] select-none whitespace-nowrap dark:text-white/[0.035]"
        >
          CAL CART
        </motion.div>
      </div>

      {/* Main hero content */}
      <div className="relative z-10 max-w-[1400px] mx-auto px-6 pt-24 pb-16 sm:pb-24 w-full">
        {/* Eyebrow badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center gap-3 mb-8"
        >
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-secondary)]/70 backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-lime-400 animate-pulse" />
            <span className="text-[11px] font-mono font-semibold text-[var(--text-muted)] tracking-widest uppercase">
              COMMERCE OS / 001
            </span>
          </div>
        </motion.div>

        {/* Headline */}
        <h1 className="font-display font-800 leading-[0.92] tracking-tight mb-8">
          {headlineWords.map((word, i) => (
            <span key={i} className="block overflow-hidden">
              <motion.span
                custom={i}
                variants={wordVariants}
                initial="hidden"
                animate="visible"
                className={`block ${
                  i === 0
                    ? "text-[clamp(3.5rem,9vw,9.5rem)] text-[var(--text-primary)]"
                    : i === 1
                    ? "text-[clamp(2.75rem,7vw,7.5rem)] text-[var(--text-muted)]"
                    : "text-[clamp(3.5rem,9vw,9.5rem)] text-gradient-full"
                }`}
              >
                {word}
              </motion.span>
            </span>
          ))}
        </h1>

        {/* Body + CTA actions row */}
        <div className="flex flex-col lg:flex-row lg:items-end gap-8 lg:gap-16">
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-md text-base sm:text-lg text-[var(--text-muted)] leading-relaxed"
          >
            Cal Cart gives ambitious brands the infrastructure to launch stunning storefronts and run seamless multi-tenant commerce operations without the complexity.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-wrap items-center gap-4"
          >
            <Link
              href="/merchant/register"
              className="group inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-gradient-to-r from-cobalt-600 to-violet-600 text-white font-display font-700 text-sm sm:text-base shadow-lg shadow-cobalt-600/25 hover:shadow-cobalt-600/40 transition-all duration-300 hover:scale-[1.03]"
            >
              <span>Start building free</span>
              <ArrowUpRight size={16} className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>

            <a
              href="#storefront"
              className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-4 py-3 rounded-full hover:bg-[var(--bg-secondary)] transition-all"
            >
              <span>See how it works</span>
              <span className="text-xs">↓</span>
            </a>
          </motion.div>
        </div>

        {/* Stats counter row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.0, duration: 0.9 }}
          className="flex flex-wrap gap-10 sm:gap-16 mt-16 pt-8 border-t border-[var(--border)]"
        >
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.1 + i * 0.1, duration: 0.6 }}
              className="flex flex-col gap-1"
            >
              <span className="font-display text-3xl sm:text-4xl font-800 text-[var(--text-primary)]">
                {stat.value}
              </span>
              <span className="text-xs sm:text-sm text-[var(--text-muted)] font-medium capitalize">
                {stat.label}
              </span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
