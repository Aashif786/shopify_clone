"use client";

import React, {  useRef  } from "react";
import { motion, useInView, useScroll, useTransform } from "framer-motion";

const nodes = [
  { label: "Storefront", x: 50, y: 12, color: "#2563eb" },
  { label: "Orders", x: 18, y: 46, color: "#7c3aed" },
  { label: "Inventory", x: 82, y: 46, color: "#f43f5e" },
  { label: "Payments", x: 30, y: 82, color: "#f97316" },
  { label: "Analytics", x: 70, y: 82, color: "#a3e635" },
];

const connections: [number, number][] = [
  [0, 1],
  [0, 2],
  [1, 3],
  [2, 3],
  [1, 4],
  [2, 4],
  [3, 4],
];

const metrics = [
  { label: "Orders processed", value: "24,180", delta: "+12% vs last week", color: "text-lime-400" },
  { label: "Inventory accuracy", value: "99.8%", delta: "Concurrency-safe reservation", color: "text-cobalt-400" },
  { label: "Avg. webhook latency", value: "48ms", delta: "Cryptographic HMAC verification", color: "text-violet-400" },
  { label: "Checkout conversion", value: "4.7%", delta: "+0.9pp multi-tenant average", color: "text-coral-400" },
];

export default function CommerceOperations() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const inView = useInView(sectionRef, { once: true, margin: "-8%" });
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const graphY = useTransform(scrollYProgress, [0, 1], [30, -30]);

  return (
    <section
      id="operations"
      ref={sectionRef}
      className="relative py-32 sm:py-40 bg-[#0f0a1e] overflow-hidden text-white"
    >
      {/* Background ambient lighting */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cobalt-600/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-violet-600/20 rounded-full blur-3xl" />
        <div className="absolute top-3/4 left-1/2 w-64 h-64 bg-coral-500/15 rounded-full blur-3xl" />
      </div>

      <div className="max-w-[1400px] mx-auto px-6 relative z-10">
        {/* Section header */}
        <div className="mb-16 sm:mb-20">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="text-xs font-mono font-semibold text-white/40 tracking-widest uppercase mb-4 sm:mb-6"
          >
            04 / OPERATIONS &bull; THE COMMERCE ENGINE
          </motion.p>

          <div className="overflow-hidden mb-2 sm:mb-3">
            <motion.h2
              initial={{ y: 80, opacity: 0 }}
              animate={inView ? { y: 0, opacity: 1 } : {}}
              transition={{ delay: 0.1, duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
              className="font-display font-800 text-[clamp(2.5rem,6vw,6.5rem)] leading-tight tracking-tight text-white"
            >
              Everything works together.
            </motion.h2>
          </div>
          <div className="overflow-hidden">
            <motion.h2
              initial={{ y: 80, opacity: 0 }}
              animate={inView ? { y: 0, opacity: 1 } : {}}
              transition={{ delay: 0.2, duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
              className="font-display font-800 text-[clamp(2.5rem,6vw,6.5rem)] leading-tight tracking-tight text-gradient-full"
            >
              Beautifully.
            </motion.h2>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-20 items-center">
          {/* Left: Connected Constellation Graph */}
          <motion.div style={{ y: graphY }} className="relative">
            <div className="relative w-full aspect-square max-w-[460px] mx-auto">
              {/* SVG connection lines */}
              <svg
                className="absolute inset-0 w-full h-full"
                viewBox="0 0 100 100"
                preserveAspectRatio="xMidYMid meet"
              >
                {connections.map(([a, b], i) => {
                  const nodeA = nodes[a];
                  const nodeB = nodes[b];
                  if (!nodeA || !nodeB) return null;
                  return (
                    <motion.line
                      key={i}
                      x1={nodeA.x}
                      y1={nodeA.y}
                      x2={nodeB.x}
                      y2={nodeB.y}
                      stroke="rgba(255,255,255,0.12)"
                      strokeWidth="0.6"
                      strokeDasharray="1.5 1.5"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={inView ? { pathLength: 1, opacity: 1 } : {}}
                      transition={{ delay: 0.4 + i * 0.08, duration: 0.8 }}
                    />
                  );
                })}

                {/* Animated cycling data particle dots */}
                {inView &&
                  connections.slice(0, 5).map(([a, b], i) => {
                    const nodeA = nodes[a];
                    const nodeB = nodes[b];
                    if (!nodeA || !nodeB) return null;
                    return (
                      <motion.circle
                        key={`dot-${i}`}
                        r="1"
                        fill={nodeA.color}
                        initial={{
                          cx: nodeA.x,
                          cy: nodeA.y,
                          opacity: 0,
                        }}
                        animate={{
                          cx: [nodeA.x, nodeB.x, nodeA.x],
                          cy: [nodeA.y, nodeB.y, nodeA.y],
                          opacity: [0, 1, 1, 0],
                        }}
                        transition={{
                          duration: 3.5,
                          delay: 1.2 + i * 0.5,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      />
                    );
                  })}
              </svg>

              {/* Connected Domain Nodes */}
              {nodes.map((node, i) => (
                <motion.div
                  key={node.label}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={inView ? { opacity: 1, scale: 1 } : {}}
                  transition={{
                    delay: 0.3 + i * 0.1,
                    duration: 0.5,
                    type: "spring",
                    stiffness: 300,
                    damping: 20,
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{
                    left: `${node.x}%`,
                    top: `${node.y}%`,
                  }}
                >
                  <div
                    className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center border border-white/15 backdrop-blur-md transition-transform duration-300 hover:scale-110"
                    style={{
                      background: `${node.color}25`,
                      boxShadow: `0 0 25px ${node.color}35`,
                    }}
                  >
                    <div
                      className="w-3 h-3 rounded-full animate-pulse-glow"
                      style={{ background: node.color }}
                    />
                  </div>
                  <p className="text-center text-[11px] font-mono font-semibold text-white/70 mt-2">
                    {node.label}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right: Operational Metrics Cards */}
          <div className="flex flex-col gap-4 sm:gap-5">
            {metrics.map((m, i) => (
              <motion.div
                key={m.label}
                initial={{ opacity: 0, x: 30 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.3 + i * 0.1, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className="p-5 sm:p-6 rounded-2xl border border-white/10 hover:border-white/20 transition-all duration-300 bg-white/[0.03] backdrop-blur-xs"
              >
                <p className="text-[11px] font-mono font-medium text-white/40 uppercase tracking-widest mb-2 sm:mb-3">
                  {m.label}
                </p>
                <p className={`font-display font-800 text-3xl sm:text-4xl ${m.color} mb-1 sm:mb-1.5`}>
                  {m.value}
                </p>
                <p className="text-xs text-white/40">{m.delta}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
