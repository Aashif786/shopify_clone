"use client";

import React, {  useRef  } from "react";
import { motion, useInView, useScroll, useTransform } from "framer-motion";

const stages = [
  {
    stage: "Day 1",
    title: "Launch your first store",
    desc: "Go live with a bespoke customer storefront, catalog matrix, and multi-tenant payment handling before the weekend.",
    gradient: "from-cobalt-600 to-cobalt-400",
    accent: "#2563eb",
  },
  {
    stage: "Month 3",
    title: "Find your operational rhythm",
    desc: "Automate recurring inventory updates. Orders fulfill with real database tracking. You focus entirely on customer acquisition.",
    gradient: "from-violet-600 to-violet-400",
    accent: "#7c3aed",
  },
  {
    stage: "Year 1",
    title: "Scale without technical debt",
    desc: "Publish standalone option listings, launch multiple brand storefronts, and invite team members with granular permissions.",
    gradient: "from-coral-500 to-tangerine-400",
    accent: "#f43f5e",
  },
  {
    stage: "Beyond",
    title: "Commerce at any altitude",
    desc: "From your initial ten orders to ten million in volume, Cal Cart remains the same unified platform without migrations or limits.",
    gradient: "from-tangerine-400 to-lime-400",
    accent: "#f97316",
  },
];

export default function GrowthStory() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const inView = useInView(sectionRef, { once: true, margin: "-8%" });
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  const lineHeight = useTransform(scrollYProgress, [0.1, 0.9], ["0%", "100%"]);
  const bgShift = useTransform(scrollYProgress, [0, 1], [0, -50]);

  return (
    <section
      id="growth"
      ref={sectionRef}
      className="relative py-28 sm:py-36 overflow-hidden bg-[var(--bg-primary)]"
    >
      {/* Background ambient lighting */}
      <motion.div
        style={{ y: bgShift }}
        className="absolute inset-0 pointer-events-none"
        aria-hidden
      >
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-lime-400/10 via-tangerine-400/8 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-cobalt-600/10 via-violet-600/8 to-transparent rounded-full blur-3xl" />
      </motion.div>

      <div className="max-w-[1400px] mx-auto px-6 relative z-10">
        {/* Header */}
        <div className="max-w-3xl mb-20 sm:mb-24">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="text-xs font-mono font-medium text-[var(--text-muted)] tracking-[0.2em] uppercase mb-4 sm:mb-6"
          >
            07 / GROWTH STORY
          </motion.p>
          <div className="overflow-hidden mb-2">
            <motion.h2
              initial={{ y: 80, opacity: 0 }}
              animate={inView ? { y: 0, opacity: 1 } : {}}
              transition={{ delay: 0.1, duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
              className="font-display font-bold text-[clamp(2.5rem,5.5vw,5.5rem)] leading-[1.05] tracking-[-0.035em] text-[var(--text-primary)]"
            >
              Make your next stage
            </motion.h2>
          </div>
          <div className="overflow-hidden">
            <motion.h2
              initial={{ y: 80, opacity: 0 }}
              animate={inView ? { y: 0, opacity: 1 } : {}}
              transition={{ delay: 0.2, duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
              className="font-display font-bold text-[clamp(2.5rem,5.5vw,5.5rem)] leading-[1.05] tracking-[-0.035em] text-gradient-warm"
            >
              feel natural.
            </motion.h2>
          </div>
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Animated vertical timeline bar */}
          <div className="absolute left-6 top-0 bottom-0 w-px bg-[var(--border)] hidden md:block" aria-hidden>
            <motion.div
              style={{ height: lineHeight }}
              className="absolute top-0 left-0 w-full bg-gradient-to-b from-cobalt-600 via-violet-600 to-lime-400"
            />
          </div>

          <div className="flex flex-col gap-0">
            {stages.map((stage, i) => (
              <motion.div
                key={stage.stage}
                initial={{ opacity: 0, x: -25 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.2 + i * 0.15, duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
                className="relative flex gap-8 md:gap-16 items-start py-10 sm:py-12 border-b border-[var(--border)] last:border-0 group"
              >
                {/* Timeline node dot */}
                <div className="hidden md:flex shrink-0 w-12 items-center justify-center pt-1.5">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={inView ? { scale: 1 } : {}}
                    transition={{ delay: 0.3 + i * 0.15, type: "spring", stiffness: 300 }}
                    className="w-3.5 h-3.5 rounded-full border-2 border-[var(--bg-primary)] relative z-10"
                    style={{
                      background: stage.accent,
                      boxShadow: `0 0 16px ${stage.accent}70`,
                    }}
                  />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-3.5">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold font-mono text-white tracking-[0.14em] uppercase bg-gradient-to-r ${stage.gradient} shadow-xs w-fit`}
                    >
                      {stage.stage}
                    </span>
                    <h3 className="font-display font-bold text-xl sm:text-2xl md:text-3xl text-[var(--text-primary)] tracking-[-0.02em]">
                      {stage.title}
                    </h3>
                  </div>
                  <p className="font-sans text-sm sm:text-base text-[var(--text-muted)] leading-[1.7] max-w-2xl">
                    {stage.desc}
                  </p>
                </div>

                {/* Hover progress bar accent line */}
                <div
                  className={`absolute left-0 bottom-0 h-0.5 w-0 bg-gradient-to-r ${stage.gradient} group-hover:w-full transition-all duration-700`}
                />
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
