"use client";

import React from "react";

import Link from "next/link";

const links = {
  Platform: [
    { label: "Storefront", href: "/stores/souled-store" },
    { label: "Products", href: "/merchant/products" },
    { label: "Inventory", href: "/merchant/inventory" },
    { label: "Orders", href: "/merchant/orders" },
    { label: "Analytics", href: "/merchant/analytics" },
  ],
  Merchant: [
    { label: "Get Started", href: "/merchant/register" },
    { label: "Sign In", href: "/merchant/login" },
    { label: "Dashboard", href: "/merchant" },
    { label: "Store Settings", href: "/merchant/stores" },
  ],
  Storefronts: [
    { label: "Souled Store", href: "/stores/souled-store" },
    { label: "Catalog Discovery", href: "/stores/souled-store/products" },
    { label: "Artisan Store", href: "/stores/artisan-store" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "#" },
    { label: "Terms of Service", href: "#" },
    { label: "Security & Isolation", href: "#" },
  ],
};

export default function Footer() {
  return (
    <footer className="relative bg-[#080512] border-t border-white/5 overflow-hidden text-white">
      {/* Top ambient glow line */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-px bg-gradient-to-r from-transparent via-cobalt-600/50 to-transparent pointer-events-none"
        aria-hidden
      />

      <div className="max-w-[1400px] mx-auto px-6 pt-20 pb-12">
        {/* Top row */}
        <div className="flex flex-col lg:flex-row gap-16 lg:gap-24 mb-20">
          {/* Brand Column */}
          <div className="shrink-0 max-w-xs">
            <Link href="/" className="flex items-center gap-2.5 mb-6">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cobalt-600 to-violet-600 flex items-center justify-center shadow-md shadow-cobalt-600/30">
                <span className="text-white font-bold text-sm font-display tracking-wider">C</span>
              </div>
              <span className="font-display font-800 text-lg text-white tracking-tight">
                Cal Cart
              </span>
            </Link>
            <p className="text-sm text-white/40 leading-relaxed mb-8">
              Commerce should feel effortless. Powerful multi-tenant infrastructure designed for modern merchants and unforgettable storefronts.
            </p>
            <Link
              href="/merchant/register"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/10 text-white/70 hover:text-white hover:border-white/30 text-xs font-semibold uppercase tracking-wider transition-all duration-200"
            >
              Start free today →
            </Link>
          </div>

          {/* Links Grid */}
          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-10">
            {Object.entries(links).map(([category, items]) => (
              <div key={category}>
                <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-5 font-mono">
                  {category}
                </p>
                <ul className="flex flex-col gap-3">
                  {items.map((item) => (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        className="text-sm text-white/50 hover:text-white transition-colors duration-200"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-8 border-t border-white/5">
          <p className="text-xs text-white/30">
            &copy; {new Date().getFullYear()} Cal Cart Systems. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <span className="text-xs text-emerald-400/80 inline-flex items-center gap-1.5 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              All systems nominal
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
