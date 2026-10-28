"use client";

import React, {  useRef  } from "react";
import { motion, useInView } from "framer-motion";

const pillars = [
  {
    number: "01",
    title: "Human-first design",
    body: "Every customer interaction, from initial discovery to instant checkout, is engineered to feel natural. Commerce should never feel like clunky software.",
    accent: "from-cobalt-600 to-cobalt-400",
  },
  {
    number: "02",
    title: "Power you can't see",
    body: "Concurrency-safe inventory, cryptographic payment webhooks, and automatic stock reservation operate silently behind the scenes. The engine is invisible; the performance is undeniable.",
    accent: "from-violet-600 to-violet-400",
  },
  {
    number: "03",
    title: "Built to scale with you",
    body: "Whether you are dispatching twenty packages a day or ten thousand during flash drops, Cal Cart adapts effortlessly without costly re-platforming or fragile plugins.",
    accent: "from-coral-500 to-tangerine-400",
  },
];

const phraseWords = ["Your brand.", "Without", "the friction."];

export default function BrandPhilosophy() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });

  return (
    <section
      id="philosophy"
      ref={ref}
      className="relative py-28 sm:py-36 bg-[var(--bg-secondary)] overflow-hidden"
    >
      {/* Subtle grain texture overlay */}
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E\")",
        }}
        aria-hidden
      />

      {/* Ambient background blob */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-gradient-to-r from-cobalt-600/10 via-violet-600/10 to-coral-500/10 blur-3xl pointer-events-none"
        aria-hidden
      />

      <div className="max-w-[1400px] mx-auto px-6 relative z-10">
        {/* Oversized quote */}
        <div className="mb-20 sm:mb-24">
          <div className="overflow-hidden mb-4">
            <motion.p
              initial={{ y: 30, opacity: 0 }}
              animate={inView ? { y: 0, opacity: 1 } : {}}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="text-xs font-mono font-semibold text-[var(--text-muted)] tracking-widest uppercase"
            >
              Our belief
            </motion.p>
          </div>

          <div className="flex flex-col gap-1 sm:gap-2">
            {phraseWords.map((phrase, i) => (
              <div key={phrase} className="overflow-hidden">
                <motion.div
                  initial={{ y: 100, opacity: 0 }}
                  animate={inView ? { y: 0, opacity: 1 } : {}}
                  transition={{
                    delay: 0.1 + i * 0.14,
                    duration: 0.85,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className={`font-display font-800 leading-tight tracking-tight ${
                    i === 0
                      ? "text-[clamp(2.75rem,7vw,8rem)] text-[var(--text-primary)]"
                      : i === 1
                      ? "text-[clamp(2.75rem,7vw,8rem)] text-[var(--text-muted)]"
                      : "text-[clamp(2.75rem,7vw,8rem)] text-gradient-cobalt"
                  }`}
                >
                  {phrase}
                </motion.div>
              </div>
            ))}
          </div>
        </div>

        {/* 3 Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[var(--border)] rounded-2xl overflow-hidden border border-[var(--border)]">
          {pillars.map((p, i) => (
            <motion.div
              key={p.number}
              initial={{ opacity: 0, y: 35 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{
                delay: 0.35 + i * 0.12,
                duration: 0.75,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="relative bg-[var(--bg-secondary)] p-8 sm:p-10 group hover:bg-[var(--bg-muted)] transition-colors duration-300"
            >
              <div
                className={`text-xs font-mono font-bold text-transparent bg-gradient-to-r ${p.accent} bg-clip-text mb-6 tracking-widest`}
              >
                {p.number}
              </div>
              <h3 className="font-display font-700 text-xl text-[var(--text-primary)] mb-3 leading-snug">
                {p.title}
              </h3>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                {p.body}
              </p>
              <motion.div
                className={`absolute bottom-0 left-0 h-0.5 w-0 bg-gradient-to-r ${p.accent}`}
                whileInView={{ width: "100%" }}
                transition={{ delay: 0.5 + i * 0.1, duration: 0.8 }}
                viewport={{ once: true }}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
