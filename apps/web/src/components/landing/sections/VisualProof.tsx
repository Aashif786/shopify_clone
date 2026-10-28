"use client";

import React, {  useRef  } from "react";
import { motion, useInView } from "framer-motion";

const capabilities = [
  {
    title: "Launch in a day",
    body: "Go from concept to live production storefront in hours. No agency retainers. No fragile configurations. Just your brand.",
    gradient: "from-cobalt-600 to-violet-600",
    span: "col-span-1 md:col-span-2",
    img: "https://images.pexels.com/photos/6167446/pexels-photo-6167446.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
  },
  {
    title: "Every payment flow",
    body: "Razorpay integration, cards, UPI, wallets, and instant cryptographically-verified HMAC receipts.",
    gradient: "from-coral-500 to-tangerine-400",
    span: "col-span-1",
    img: null,
  },
  {
    title: "Zero-oversell inventory",
    body: "Concurrency-safe row-level stock reservations prevent overselling during intense viral drops and sales peaks.",
    gradient: "from-violet-600 to-cobalt-400",
    span: "col-span-1",
    img: null,
  },
  {
    title: "Insights you can act on",
    body: "Real-time revenue telemetry that surfaces what matters: conversion rate, average order value, and product performance.",
    gradient: "from-tangerine-400 to-lime-400",
    span: "col-span-1 md:col-span-2",
    img: "https://images.pexels.com/photos/8101512/pexels-photo-8101512.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
  },
];

export default function VisualProof() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-5%" });

  return (
    <section ref={ref} className="py-28 sm:py-36 bg-[var(--bg-secondary)] overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6">
        {/* Header */}
        <div className="mb-14 sm:mb-16 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5 }}
              className="text-xs font-mono font-semibold text-[var(--text-muted)] tracking-widest uppercase mb-3 sm:mb-4"
            >
              06 / BUILT FOR THE DETAILS &bull; PLATFORM CAPABILITIES
            </motion.p>
            <div className="overflow-hidden">
              <motion.h2
                initial={{ y: 60, opacity: 0 }}
                animate={inView ? { y: 0, opacity: 1 } : {}}
                transition={{ delay: 0.1, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                className="font-display font-800 text-[clamp(2.25rem,4.5vw,4.5rem)] leading-tight tracking-tight text-[var(--text-primary)]"
              >
                Everything you need.
                <br />
                <span className="text-gradient-cobalt">Nothing you don't.</span>
              </motion.h2>
            </div>
          </div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.25, duration: 0.7 }}
            className="max-w-xs text-sm text-[var(--text-muted)] leading-relaxed"
          >
            A complete commerce stack, designed to stay out of your way and let you focus on building products customers crave.
          </motion.p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
          {capabilities.map((cap, i) => (
            <motion.div
              key={cap.title}
              initial={{ opacity: 0, y: 40 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.15 + i * 0.1, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className={`relative rounded-3xl overflow-hidden border border-[var(--border)] ${cap.span} group shadow-sm`}
            >
              {cap.img ? (
                /* Image Card */
                <div className="relative h-72 md:h-80 w-full overflow-hidden bg-[var(--bg-muted)]">
                  <img
                    src={cap.img}
                    alt={cap.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
                  <div className="absolute bottom-0 left-0 p-6 sm:p-8">
                    <h3 className="font-display font-700 text-2xl text-white mb-2">{cap.title}</h3>
                    <p className="text-sm text-white/80 max-w-sm leading-relaxed">{cap.body}</p>
                  </div>
                </div>
              ) : (
                /* Text Card */
                <div
                  className="h-72 md:h-80 p-6 sm:p-8 flex flex-col justify-between"
                  style={{ background: "var(--bg-muted)" }}
                >
                  <div
                    className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${cap.gradient} flex items-center justify-center shadow-md`}
                  >
                    <div className="w-3.5 h-3.5 rounded-full bg-white/40" />
                  </div>
                  <div>
                    <h3 className="font-display font-700 text-2xl text-[var(--text-primary)] mb-2.5">
                      {cap.title}
                    </h3>
                    <p className="text-sm text-[var(--text-muted)] leading-relaxed">{cap.body}</p>
                  </div>
                  <div className={`h-0.5 w-full bg-gradient-to-r ${cap.gradient} opacity-50`} />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
