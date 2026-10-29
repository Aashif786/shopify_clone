"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Globe,
  Lock,
  ShoppingBag,
  Sparkles,
  Layers,
  CheckCircle2,
  RefreshCw,
  Database,
  ShieldCheck,
  CreditCard,
  Key,
  TrendingUp,
  Activity,
  ArrowUpRight,
} from "lucide-react";

// =============================================================================
// CARD 01: Storefront Interactive Visual
// Miniature Storefront with Live Theme Switching and Fast Edge Preview
// =============================================================================
export function StorefrontPreviewVisual({ isHovered = false }: { isHovered?: boolean }) {
  const [selectedTheme, setSelectedTheme] = useState<string>("cobalt");
  const [cartCount, setCartCount] = useState<number>(2);

  const themeColors: Record<string, { bg: string; text: string; hex: string; label: string }> = {
    cobalt: { bg: "bg-cobalt-600", text: "text-cobalt-400", hex: "#2563eb", label: "Electric Cobalt" },
    violet: { bg: "bg-violet-600", text: "text-violet-400", hex: "#7c3aed", label: "Deep Violet" },
    coral: { bg: "bg-coral-500", text: "text-coral-400", hex: "#f43f5e", label: "Sunset Coral" },
    emerald: { bg: "bg-emerald-600", text: "text-emerald-400", hex: "#10b981", label: "Cyber Emerald" },
  };

  const currentTheme = themeColors[selectedTheme] ?? themeColors.cobalt!;

  return (
    <div
      className={`w-full max-w-xl mx-auto rounded-2xl bg-[var(--bg-secondary)]/90 border transition-all duration-300 overflow-hidden shadow-xl ${
        isHovered ? "border-cobalt-500/50 shadow-cobalt-500/10 shadow-2xl" : "border-[var(--border)]"
      }`}
    >
      {/* Browser Window Chrome */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--bg-primary)]/80 border-b border-[var(--border)]">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-coral-500/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-tangerine-400/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
        </div>

        {/* URL Pill */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--bg-secondary)] border border-[var(--border)] text-[11px] font-mono text-[var(--text-muted)]">
          <Lock size={10} className="text-emerald-400" />
          <span>calcart.store/souled-store</span>
        </div>

        {/* Live Status Pill */}
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-500 dark:text-emerald-400 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="hidden sm:inline">LIVE PREVIEW</span>
        </div>
      </div>

      {/* Miniature Storefront Surface */}
      <div className="p-4 sm:p-5 space-y-4">
        {/* Storefront Nav Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <div className={`w-5 h-5 rounded-md ${currentTheme.bg} flex items-center justify-center text-white text-[10px] font-bold transition-colors duration-300`}>
              S
            </div>
            <span className="font-display font-semibold text-xs tracking-tight text-[var(--text-primary)]">
              The Souled Store
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-[var(--text-muted)] hidden sm:inline">Catalog</span>
            <button
              type="button"
              onClick={() => setCartCount((c) => c + 1)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--bg-primary)] border border-[var(--border)] text-[11px] font-mono font-medium hover:border-cobalt-500 transition-colors"
            >
              <ShoppingBag size={11} className={currentTheme.text} />
              <span>Cart ({cartCount})</span>
            </button>
          </div>
        </div>

        {/* Interactive Theme Palette Controls */}
        <div className="flex items-center justify-between text-xs">
          <span className="font-mono text-[11px] text-[var(--text-muted)] flex items-center gap-1.5">
            <Sparkles size={11} className={currentTheme.text} />
            Theme Palette:
          </span>
          <div className="flex items-center gap-2">
            {Object.entries(themeColors).map(([key, item]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedTheme(key)}
                className={`w-4 h-4 rounded-full transition-transform ${
                  selectedTheme === key
                    ? "scale-125 ring-2 ring-offset-2 ring-offset-[var(--bg-secondary)] ring-[var(--text-primary)]"
                    : "opacity-70 hover:opacity-100"
                }`}
                style={{ backgroundColor: item.hex }}
                aria-label={`Select ${item.label} theme`}
              />
            ))}
          </div>
        </div>

        {/* Featured Mini Product Card */}
        <div className="p-3.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] flex flex-col sm:flex-row items-center gap-4">
          <div className="w-full sm:w-28 h-24 rounded-lg bg-[var(--bg-secondary)] flex items-center justify-center border border-[var(--border)] relative overflow-hidden shrink-0">
            <div className="text-3xl select-none">👕</div>
            <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              NEW
            </span>
          </div>

          <div className="flex-1 w-full space-y-1.5">
            <div className="flex items-center justify-between">
              <h4 className="font-display font-medium text-xs text-[var(--text-primary)]">
                The Arc Reactor Glow Tee
              </h4>
              <span className="font-mono font-bold text-xs text-[var(--text-primary)]">
                899 INR
              </span>
            </div>
            <p className="font-sans text-[11px] text-[var(--text-muted)] line-clamp-1">
              Custom themes, live preview, and instant publishable variants
            </p>
            <div className="pt-1 flex items-center justify-between">
              <span className="text-[10px] font-mono text-[var(--text-muted)]">
                Dispatch: 24h
              </span>
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                type="button"
                onClick={() => setCartCount((c) => c + 1)}
                className={`px-3 py-1 rounded-md text-[11px] font-medium text-white ${currentTheme.bg} transition-colors shadow-xs cursor-pointer`}
              >
                Instant Buy
              </motion.button>
            </div>
          </div>
        </div>

        {/* Technical Guarantee Footer */}
        <div className="pt-1 flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)] border-t border-[var(--border)]/60">
          <span className="flex items-center gap-1">
            <Globe size={10} className="text-cobalt-400" />
            Edge Cache: 14ms Latency
          </span>
          <span className="text-emerald-500 font-medium">Zero Layout Shift</span>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// CARD 02: Products & Standalone Variant Matrix Visual
// Independent Option Publishing & Granular SKU Matrix Architecture
// =============================================================================
export function ProductsMatrixVisual({ isHovered = false }: { isHovered?: boolean }) {
  const [selectedModel, setSelectedModel] = useState<string>("Black");
  const [selectedSize, setSelectedSize] = useState<string>("M");

  const models = [
    { name: "Black", skuPart: "BLK", hex: "#1e1e24" },
    { name: "Blue", skuPart: "BLU", hex: "#2563eb" },
    { name: "Red", skuPart: "RED", hex: "#ef4444" },
  ];

  const sizes = ["S", "M", "L", "XL"];

  return (
    <div
      className={`w-full max-w-xl mx-auto rounded-2xl bg-[var(--bg-secondary)]/90 border p-5 space-y-4 shadow-xl transition-all duration-300 ${
        isHovered ? "border-violet-500/50 shadow-violet-500/10 shadow-2xl" : "border-[var(--border)]"
      }`}
    >
      {/* Header with Variant Isolation Badge */}
      <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-violet-500">
            <Layers size={14} />
          </div>
          <div>
            <h4 className="font-display font-semibold text-xs text-[var(--text-primary)]">
              Product Catalog Matrix
            </h4>
            <span className="font-mono text-[10px] text-[var(--text-muted)]">
              Standalone Option Isolation
            </span>
          </div>
        </div>

        <span className="px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-600 dark:text-violet-400 font-mono text-[10px] font-medium">
          CANONICAL URLS
        </span>
      </div>

      {/* Interactive Publishable Option Switcher */}
      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider">
              Publishable Option: Model (Standalone Listing)
            </span>
            <span className="text-[10px] font-mono text-violet-500">
              Listing: /the-essence-tee-{selectedModel.toLowerCase()}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {models.map((m) => (
              <button
                key={m.name}
                type="button"
                onClick={() => setSelectedModel(m.name)}
                className={`flex items-center justify-center gap-2 py-2 rounded-lg border text-xs font-medium font-mono transition-all cursor-pointer ${
                  selectedModel === m.name
                    ? "bg-[var(--bg-primary)] border-violet-500 text-violet-600 dark:text-violet-300 shadow-xs ring-1 ring-violet-500"
                    : "bg-[var(--bg-primary)]/60 border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-muted)]"
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.hex }} />
                <span>{m.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider">
              Configurable Choice: Size
            </span>
            <span className="text-[10px] font-mono text-[var(--text-muted)]">
              Stock: 186 units
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {sizes.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSelectedSize(s)}
                className={`py-1.5 rounded-lg border text-xs font-mono font-medium transition-all cursor-pointer ${
                  selectedSize === s
                    ? "bg-violet-600 text-white border-violet-600 shadow-xs"
                    : "bg-[var(--bg-primary)] border-[var(--border)] text-[var(--text-muted)] hover:border-violet-400"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Resolved SKU Matrix Card */}
      <div className="p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] flex items-center justify-between">
        <div className="space-y-0.5">
          <span className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
            Resolved Purchasable SKU
          </span>
          <div className="font-mono font-semibold text-xs text-[var(--text-primary)]">
            ESS-TEE-{models.find((m) => m.name === selectedModel)?.skuPart || "BLK"}-{selectedSize}
          </div>
        </div>
        <div className="text-right">
          <span className="font-mono text-[10px] text-emerald-500 font-medium block">
            ● IN STOCK
          </span>
          <span className="font-mono font-semibold text-xs text-[var(--text-primary)]">
            899.00 INR
          </span>
        </div>
      </div>

      {/* Technical Spec Note */}
      <p className="text-[11px] font-sans text-[var(--text-muted)] leading-relaxed">
        Publishable options generate independent storefront search indexes and canonical pages, while keeping all internal size and color permutations fully intact.
      </p>
    </div>
  );
}

// =============================================================================
// CARD 03: Orders & Concurrency-Safe Inventory Visual
// Atomic Stock Reservation, Concurrency Safety, and Zero Overselling
// =============================================================================
export function InventorySyncVisual({ isHovered = false }: { isHovered?: boolean }) {
  const [activeStep, setActiveStep] = useState<number>(2);

  const steps = [
    { label: "Cart Session Initialized", status: "complete" },
    { label: "Stock Reserved in PostgreSQL", status: "complete" },
    { label: "Concurrency Lock: Verified", status: "active" },
    { label: "Order Dispatched & Synced", status: "pending" },
  ];

  return (
    <div
      className={`w-full max-w-xl mx-auto rounded-2xl bg-[var(--bg-secondary)]/90 border p-5 space-y-4 shadow-xl transition-all duration-300 ${
        isHovered ? "border-coral-500/50 shadow-coral-500/10 shadow-2xl" : "border-[var(--border)]"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-coral-500/10 border border-coral-500/20 flex items-center justify-center text-coral-500">
            <RefreshCw size={14} className="animate-spin-slow" />
          </div>
          <div>
            <h4 className="font-display font-semibold text-xs text-[var(--text-primary)]">
              Concurrency-Safe Engine
            </h4>
            <span className="font-mono text-[10px] text-[var(--text-muted)]">
              Real-Time Stock Locks
            </span>
          </div>
        </div>

        <span className="px-2 py-0.5 rounded-full bg-coral-500/10 border border-coral-500/20 text-coral-600 dark:text-coral-400 font-mono text-[10px] font-medium">
          ZERO OVERSELL
        </span>
      </div>

      {/* Real-time Stock Matrix Metrics */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] text-center">
          <span className="font-mono text-[10px] text-[var(--text-muted)] block uppercase">Available</span>
          <span className="font-mono font-bold text-lg text-emerald-500">186</span>
        </div>
        <div className="p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] text-center">
          <span className="font-mono text-[10px] text-[var(--text-muted)] block uppercase">Reserved</span>
          <span className="font-mono font-bold text-lg text-tangerine-500">4</span>
        </div>
        <div className="p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] text-center">
          <span className="font-mono text-[10px] text-[var(--text-muted)] block uppercase">On-Hand</span>
          <span className="font-mono font-bold text-lg text-cobalt-500">190</span>
        </div>
      </div>

      {/* Transaction Pipeline Visualization */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-wider block">
            Atomic Transaction Lifecycle
          </span>
          <span className="font-mono text-[10px] text-coral-500">
            Click step to inspect
          </span>
        </div>
        <div className="space-y-2">
          {steps.map((st, i) => (
            <button
              key={st.label}
              type="button"
              onClick={() => setActiveStep(i)}
              className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-xs font-mono transition-all text-left cursor-pointer ${
                i <= activeStep
                  ? "bg-[var(--bg-primary)] border-[var(--border)] text-[var(--text-primary)]"
                  : "bg-transparent border-transparent text-[var(--text-muted)] opacity-60 hover:opacity-90"
              }`}
            >
              <div className="flex items-center gap-2">
                {i < activeStep ? (
                  <CheckCircle2 size={13} className="text-emerald-500" />
                ) : i === activeStep ? (
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-coral-500 border-t-transparent animate-spin inline-block" />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border border-[var(--border)]" />
                )}
                <span className="text-[11px]">{st.label}</span>
              </div>
              <span className="text-[10px] text-[var(--text-muted)]">
                {i < activeStep ? "Verified" : i === activeStep ? "Running" : "Queued"}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Database Lock Footer */}
      <div className="pt-1 flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)] border-t border-[var(--border)]/60">
        <span className="flex items-center gap-1.5">
          <Database size={11} className="text-coral-500" />
          Isolation: REPEATABLE READ
        </span>
        <span className="text-coral-500 font-medium">Safe Across Flash Drops</span>
      </div>
    </div>
  );
}

// =============================================================================
// CARD 04: Payments & Cryptographic Verification Visual
// Razorpay Integration, HMAC-SHA256 Verification, and Idempotency
// =============================================================================
export function PaymentsWebhookVisual({ isHovered = false }: { isHovered?: boolean }) {
  return (
    <div
      className={`w-full max-w-xl mx-auto rounded-2xl bg-[var(--bg-secondary)]/90 border p-5 space-y-4 shadow-xl transition-all duration-300 ${
        isHovered ? "border-tangerine-500/50 shadow-tangerine-500/10 shadow-2xl" : "border-[var(--border)]"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-tangerine-500/10 border border-tangerine-500/20 flex items-center justify-center text-tangerine-500">
            <ShieldCheck size={14} />
          </div>
          <div>
            <h4 className="font-display font-semibold text-xs text-[var(--text-primary)]">
              Payments Engine
            </h4>
            <span className="font-mono text-[10px] text-[var(--text-muted)]">
              HMAC-SHA256 Webhook Verification
            </span>
          </div>
        </div>

        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-mono text-[10px] font-medium">
          CRYPTOGRAPHIC VERIFIED
        </span>
      </div>

      {/* Transaction Details Box */}
      <div className="p-3.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
            Order Total
          </span>
          <span className="font-mono font-bold text-sm text-[var(--text-primary)]">
            ₹1,798.00 INR
          </span>
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)] pt-1 border-t border-[var(--border)]/60">
          <span className="flex items-center gap-1.5">
            <CreditCard size={12} className="text-tangerine-500" />
            Gateway: Razorpay Checkout
          </span>
          <span className="text-emerald-500 font-medium">Captured • 48ms</span>
        </div>
      </div>

      {/* Signature Verification Log */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)] uppercase">
          <span>Cryptographic Signature Proof</span>
          <span className="text-emerald-500">256-bit Valid</span>
        </div>

        <div className="p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] font-mono text-[10px] space-y-1.5 text-[var(--text-muted)]">
          <div className="flex items-center justify-between">
            <span>x-razorpay-signature:</span>
            <span className="text-[var(--text-primary)] truncate max-w-[200px]">
              9a4f21b7c093e8...d9e1
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>computed_hmac_hash:</span>
            <span className="text-emerald-500 truncate max-w-[200px]">
              9a4f21b7c093e8...d9e1 ✓
            </span>
          </div>
        </div>
      </div>

      {/* Idempotency Footer */}
      <div className="pt-1 flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)] border-t border-[var(--border)]/60">
        <span className="flex items-center gap-1.5">
          <Key size={11} className="text-tangerine-500" />
          Idempotency: Replay Immune
        </span>
        <span className="text-tangerine-500 font-medium">No Duplicate Charges</span>
      </div>
    </div>
  );
}

// =============================================================================
// CARD 05: Analytics & Real-Time Telemetry Visual
// Multi-Tenant Analytics, Sparkline Telemetry, and Inventory Velocity
// =============================================================================
export function AnalyticsTelemetryVisual({ isHovered = false }: { isHovered?: boolean }) {
  return (
    <div
      className={`w-full max-w-xl mx-auto rounded-2xl bg-[var(--bg-secondary)]/90 border p-5 space-y-4 shadow-xl transition-all duration-300 ${
        isHovered ? "border-lime-400/50 shadow-lime-400/10 shadow-2xl" : "border-[var(--border)]"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-lime-400/10 border border-lime-400/20 flex items-center justify-center text-lime-400">
            <TrendingUp size={14} />
          </div>
          <div>
            <h4 className="font-display font-semibold text-xs text-[var(--text-primary)]">
              Telemetry & Velocity
            </h4>
            <span className="font-mono text-[10px] text-[var(--text-muted)]">
              Multi-Tenant Real-Time Metrics
            </span>
          </div>
        </div>

        <span className="px-2 py-0.5 rounded-full bg-lime-400/10 border border-lime-400/20 text-lime-600 dark:text-lime-400 font-mono text-[10px] font-medium">
          STREAM ACTIVE
        </span>
      </div>

      {/* Revenue Snapshot Box */}
      <div className="p-3.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
            Gross Volume (Cycle)
          </span>
          <span className="font-mono text-xs font-semibold text-lime-500 flex items-center gap-1">
            <ArrowUpRight size={12} />
            +18.4%
          </span>
        </div>

        <div className="font-display font-bold text-2xl text-[var(--text-primary)] tracking-tight">
          ₹1,24,580.00
        </div>
      </div>

      {/* SVG Curving Sparkline Graph */}
      <div className="p-3.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] space-y-2">
        <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)]">
          <span>Sales Velocity by Hour</span>
          <span className="text-lime-500 font-semibold">Peak: 420 orders/h</span>
        </div>

        {/* Smooth SVG Area Chart */}
        <div className="h-16 w-full relative">
          <svg
            viewBox="0 0 300 80"
            className="w-full h-full overflow-visible"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="telemetryGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#a3e635" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#a3e635" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <path
              d="M0,60 Q40,55 80,45 T160,25 T220,15 T300,5 L300,80 L0,80 Z"
              fill="url(#telemetryGrad)"
            />
            <path
              d="M0,60 Q40,55 80,45 T160,25 T220,15 T300,5"
              fill="none"
              stroke="#a3e635"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle cx="220" cy="15" r="4" fill="#a3e635" className="animate-pulse" />
          </svg>
        </div>
      </div>

      {/* Key Multi-Tenant Benchmarks */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="p-2.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)]">
          <span className="font-mono text-[9px] text-[var(--text-muted)] block uppercase">Conversion</span>
          <span className="font-mono font-bold text-xs text-[var(--text-primary)]">4.8% (+0.9pp)</span>
        </div>
        <div className="p-2.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)]">
          <span className="font-mono text-[9px] text-[var(--text-muted)] block uppercase">Inventory Turn</span>
          <span className="font-mono font-bold text-xs text-[var(--text-primary)]">14.2 units/h</span>
        </div>
      </div>

      {/* Tenant Context Footer */}
      <div className="pt-1 flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)] border-t border-[var(--border)]/60">
        <span className="flex items-center gap-1.5">
          <Activity size={11} className="text-lime-400" />
          Tenant: store_souled_store
        </span>
        <span className="text-lime-500 font-medium">Sub-Second Updates</span>
      </div>
    </div>
  );
}
