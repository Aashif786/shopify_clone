"use client";

import React, {  useRef  } from "react";
import { motion, useInView, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

const floatingWords = ["Commerce", "Identity", "Growth", "Beauty", "Future", "Clarity"];

export default function FinalCTA() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const inView = useInView(sectionRef, { once: true, margin: "-5%" });
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  const bg1Y = useTransform(scrollYProgress, [0, 1], [-50, 50]);
  const bg2Y = useTransform(scrollYProgress, [0, 1], [50, -50]);
  const textScale = useTransform(scrollYProgress, [0, 0.5, 1], [0.96, 1, 1.02]);

  return (
    <section
      ref={sectionRef}
      className="relative py-32 sm:py-44 overflow-hidden text-white"
      style={{
        background:
          "linear-gradient(180deg, var(--bg-primary) 0%, #0d1b3e 50%, #0f0a1e 100%)",
      }}
    >
      {/* Background blobs */}
      <motion.div style={{ y: bg1Y }} className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute top-1/4 left-1/4 w-[550px] h-[550px] bg-gradient-to-br from-cobalt-600/25 to-violet-600/15 rounded-full blur-3xl" />
      </motion.div>
      <motion.div style={{ y: bg2Y }} className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute bottom-1/4 right-1/4 w-[480px] h-[480px] bg-gradient-to-tl from-coral-500/20 to-tangerine-400/10 rounded-full blur-3xl" />
      </motion.div>

      {/* Floating word cloud (decorative background) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        {floatingWords.map((word, i) => (
          <motion.div
            key={word}
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ delay: 0.4 + i * 0.1, duration: 1 }}
            className="absolute font-display font-800 text-white/[0.035] select-none pointer-events-none"
            style={{
              fontSize: `${[72, 54, 90, 64, 80, 60][i]}px`,
              left: `${[6, 62, 18, 76, 12, 82][i]}%`,
              top: `${[12, 22, 52, 62, 76, 42][i]}%`,
            }}
          >
            <motion.span
              animate={{
                y: [0, -14, 0],
                rotate: [-2 + i, 2 - i, -2 + i],
              }}
              transition={{
                duration: 6 + i,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="block"
            >
              {word}
            </motion.span>
          </motion.div>
        ))}
      </div>

      {/* Main CTA Content */}
      <div className="relative z-10 max-w-[1400px] mx-auto px-6 text-center">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-xs font-mono font-semibold text-white/40 tracking-widest uppercase mb-8 sm:mb-10"
        >
          08 / YOUR NEXT CHAPTER &bull; READY TO BEGIN
        </motion.p>

        <motion.div style={{ scale: textScale }}>
          <div className="overflow-hidden mb-2">
            <motion.h2
              initial={{ y: 90, opacity: 0 }}
              animate={inView ? { y: 0, opacity: 1 } : {}}
              transition={{ delay: 0.1, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              className="font-display font-800 text-[clamp(2.75rem,8.5vw,9.5rem)] leading-tight tracking-tight text-white"
            >
              Your brand.
            </motion.h2>
          </div>
          <div className="overflow-hidden mb-2">
            <motion.h2
              initial={{ y: 90, opacity: 0 }}
              animate={inView ? { y: 0, opacity: 1 } : {}}
              transition={{ delay: 0.2, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              className="font-display font-800 text-[clamp(2.75rem,8.5vw,9.5rem)] leading-tight tracking-tight text-white/50"
            >
              Without the
            </motion.h2>
          </div>
          <div className="overflow-hidden mb-12 sm:mb-16">
            <motion.h2
              initial={{ y: 90, opacity: 0 }}
              animate={inView ? { y: 0, opacity: 1 } : {}}
              transition={{ delay: 0.3, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              className="font-display font-800 text-[clamp(2.75rem,8.5vw,9.5rem)] leading-tight tracking-tight text-gradient-full"
            >
              friction.
            </motion.h2>
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.45, duration: 0.8 }}
          className="text-base sm:text-lg text-white/60 max-w-lg mx-auto mb-10 sm:mb-12 leading-relaxed"
        >
          Join the next generation of commerce merchants building high-conversion, effortless storefronts with Cal Cart.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.6, duration: 0.8 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            href="/merchant/register"
            className="group inline-flex items-center gap-2.5 px-8 sm:px-10 py-4 sm:py-5 rounded-full bg-gradient-to-r from-cobalt-600 to-violet-600 text-white font-display font-700 text-base sm:text-lg shadow-2xl shadow-cobalt-600/35 hover:shadow-cobalt-600/60 transition-all duration-300 hover:scale-[1.04]"
          >
            <span>Start building free</span>
            <ArrowUpRight size={18} className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
          <Link
            href="/stores/souled-store"
            className="inline-flex items-center gap-2 px-7 sm:px-8 py-4 sm:py-5 rounded-full border border-white/20 text-white/80 hover:text-white hover:border-white/40 font-display font-600 text-sm sm:text-base transition-all duration-200 hover:scale-[1.02]"
          >
            Explore live demo store
          </Link>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.8, duration: 0.8 }}
          className="mt-8 text-xs font-mono text-white/40"
        >
          Real multi-tenant database &bull; Cryptographic checkout &bull; Instant setup
        </motion.p>
      </div>
    </section>
  );
}
