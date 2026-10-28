"use client";

import React, {  useRef  } from "react";
import { motion, useInView, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

const products = [
  {
    id: 1,
    src: "https://images.pexels.com/photos/30405428/pexels-photo-30405428.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    alt: "Editorial fashion product",
    label: "The Essence Tee",
    price: "$68",
    tag: "New Arrival",
    tagColor: "bg-lime-400 text-black",
  },
  {
    id: 2,
    src: "https://images.pexels.com/photos/34939754/pexels-photo-34939754.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    alt: "Luxury skincare set",
    label: "Ceramic Ritual Set",
    price: "$145",
    tag: "Bestseller",
    tagColor: "bg-cobalt-600 text-white",
  },
  {
    id: 3,
    src: "https://images.pexels.com/photos/8102290/pexels-photo-8102290.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    alt: "Beauty serum bottle",
    label: "Midnight Amber Extract",
    price: "$89",
    tag: "Limited Drop",
    tagColor: "bg-coral-500 text-white",
  },
];

const marqueeItems = [
  "Beautiful storefronts",
  "Real-time inventory",
  "Instant checkout",
  "Global payments",
  "Custom branding",
  "Mobile-first design",
];

export default function StorefrontShowcase() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const inView = useInView(sectionRef, { once: true, margin: "-5%" });
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  const y1 = useTransform(scrollYProgress, [0, 1], [50, -50]);
  const y2 = useTransform(scrollYProgress, [0, 1], [25, -70]);
  const y3 = useTransform(scrollYProgress, [0, 1], [65, -25]);
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "25%"]);

  return (
    <section
      id="storefront"
      ref={sectionRef}
      className="relative py-28 sm:py-36 overflow-hidden bg-[var(--bg-primary)]"
    >
      {/* Background gradient overlay */}
      <motion.div
        style={{ y: bgY }}
        className="absolute inset-0 pointer-events-none"
        aria-hidden
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--border)] to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600/5 via-transparent to-cobalt-600/5" />
      </motion.div>

      {/* Infinite scrolling marquee ribbon */}
      <div className="overflow-hidden mb-20 border-y border-[var(--border)] py-4 bg-[var(--bg-secondary)]/40">
        <div className="flex gap-12 animate-scroll-marquee whitespace-nowrap">
          {[...marqueeItems, ...marqueeItems, ...marqueeItems].map((item, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-4 text-xs font-mono font-medium text-[var(--text-muted)] uppercase tracking-[0.2em] shrink-0"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-cobalt-500 inline-block shrink-0" />
              {item}
            </span>
          ))}
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          {/* Left: Copy & Features */}
          <div className="order-2 lg:order-1">
            <div className="overflow-hidden mb-4">
              <motion.p
                initial={{ y: 30, opacity: 0 }}
                animate={inView ? { y: 0, opacity: 1 } : {}}
                transition={{ duration: 0.6 }}
                className="text-xs font-mono font-medium text-[var(--text-muted)] tracking-[0.2em] uppercase"
              >
                02 / STOREFRONT EXPERIENCE
              </motion.p>
            </div>

            <div className="overflow-hidden mb-3">
              <motion.h2
                initial={{ y: 80, opacity: 0 }}
                animate={inView ? { y: 0, opacity: 1 } : {}}
                transition={{ delay: 0.1, duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
                className="font-display font-bold leading-[1.05] tracking-[-0.03em] text-[clamp(2.25rem,4.5vw,4.5rem)] text-[var(--text-primary)]"
              >
                Give your products a world
              </motion.h2>
            </div>
            <div className="overflow-hidden mb-8">
              <motion.h2
                initial={{ y: 80, opacity: 0 }}
                animate={inView ? { y: 0, opacity: 1 } : {}}
                transition={{ delay: 0.2, duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
                className="font-display font-bold leading-[1.05] tracking-[-0.03em] text-[clamp(2.25rem,4.5vw,4.5rem)] text-gradient-cobalt"
              >
                of their own.
              </motion.h2>
            </div>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.3, duration: 0.7 }}
              className="font-sans text-base text-[var(--text-muted)] leading-[1.7] max-w-md mb-8"
            >
              Design editorial storefronts with high-performance catalogs, responsive variant pickers, and pixel-perfect typography. Real commerce connected straight to your database.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.4, duration: 0.7 }}
              className="flex flex-col gap-3.5 mb-10"
            >
              {[
                "Zero-friction discovery & instant checkout drawer",
                "Variant-specific galleries with standalone publishable listings",
                "Fully responsive mobile and desktop architecture",
              ].map((feat) => (
                <div key={feat} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-cobalt-600 to-violet-600 flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 10 8" className="w-2.5 h-2 fill-white">
                      <path
                        d="M1 4l2.5 2.5L9 1"
                        stroke="white"
                        strokeWidth="1.5"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <span className="text-sm font-normal text-[var(--text-secondary)] leading-relaxed">{feat}</span>
                </div>
              ))}
            </motion.div>

            <Link
              href="/stores/souled-store"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-[var(--border)] text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] hover:border-foreground/30 transition-all tracking-[-0.01em]"
            >
              <span>Explore live demo storefront</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>

          {/* Right: Floating Product Composition */}
          <div className="order-1 lg:order-2 relative h-[480px] sm:h-[580px] lg:h-[640px]">
            {[
              {
                style: y1,
                product: products[0]!,
                w: 240,
                h: 320,
                cls: "absolute top-0 left-[2%] sm:left-[5%] z-10",
              },
              {
                style: y2,
                product: products[1]!,
                w: 270,
                h: 360,
                cls: "absolute top-[12%] right-[2%] sm:right-[5%] z-20",
              },
              {
                style: y3,
                product: products[2]!,
                w: 210,
                h: 270,
                cls: "absolute bottom-2 left-[20%] sm:left-[28%] z-30",
              },
            ].map(({ style, product, w, h, cls }, i) => {
              if (!product) return null;
              return (
              <motion.div
                key={product.id}
                style={{ y: style }}
                initial={{ opacity: 0, scale: 0.9, y: 40 }}
                animate={inView ? { opacity: 1, scale: 1, y: 0 } : {}}
                transition={{ delay: 0.2 + i * 0.15, duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
                className={`${cls} group cursor-pointer`}
              >
                <div
                  className="relative overflow-hidden rounded-2xl shadow-xl border border-white/10 dark:border-white/5 bg-[var(--bg-muted)]"
                  style={{ width: w, height: h }}
                >
                  <img
                    src={product.src}
                    alt={product.alt}
                    className="object-cover w-full h-full transition-transform duration-700 ease-out group-hover:scale-105"
                    loading="lazy"
                  />
                  {/* Product card bottom gradient tag */}
                  <div className="absolute bottom-0 left-0 right-0 p-3.5 bg-gradient-to-t from-black/75 via-black/30 to-transparent">
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-white/80 text-xs font-medium mb-0.5 tracking-normal">{product.label}</p>
                        <p className="text-white font-mono font-semibold text-sm sm:text-base tracking-tight">{product.price}</p>
                      </div>
                      <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full tracking-wider uppercase ${product.tagColor}`}>
                        {product.tag}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );})}

            {/* Floating Live badge */}
            <motion.div
              animate={{ y: [0, -10, 0], rotate: [0, 4, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-[38%] left-[45%] z-40 glass rounded-xl px-4 py-2.5 pointer-events-none shadow-lg"
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-lime-400 animate-pulse" />
                <span className="text-xs font-mono font-medium text-[var(--text-primary)] whitespace-nowrap tracking-wide">
                  Live &bull; 247 visitors
                </span>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
