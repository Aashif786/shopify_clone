import React from "react";
import Link from "next/link";
import { StorefrontShell } from "../../../../src/components/storefront/StorefrontShell";
import { Sparkles, ArrowRight, ShieldCheck, Gem, Compass, Check } from "lucide-react";

interface StoreAboutPageProps {
  params: Promise<{ storeSlug: string }>;
}

export default async function StoreAboutPage({ params }: StoreAboutPageProps) {
  const { storeSlug } = await params;
  const formattedStoreName = storeSlug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return (
    <StorefrontShell
      storeName={formattedStoreName}
      storeSlug={storeSlug}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-20 sm:space-y-24">
        {/* Magazine-Style Story Header (Asymmetric Split Screen) */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-primary text-xs font-mono font-bold uppercase tracking-wider">
              <Sparkles size={13} aria-hidden="true" />
              <span>PHILOSOPHY &amp; PROVENANCE</span>
            </div>

            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-foreground leading-[1.06]">
              Designed for life, <br />
              <span className="italic font-serif font-normal text-primary">built to endure.</span>
            </h1>

            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl">
              Welcome to {formattedStoreName}. We create and curate enduring pieces with intentional aesthetics, responsible materials, and meticulous craftsmanship. Every item reflects a dedication to longevity over disposable consumption.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-4">
              <Link
                href={`/stores/${encodeURIComponent(storeSlug)}/products`}
                className="btn btn-primary btn-md rounded-2xl px-7 py-3 text-xs font-mono font-bold uppercase tracking-wider shadow-lg shadow-primary/15 hover:shadow-primary/30 transition-all inline-flex items-center gap-2"
              >
                <span>Explore the Archive</span>
                <ArrowRight size={14} />
              </Link>
              <Link
                href={`/stores/${encodeURIComponent(storeSlug)}/collections`}
                className="btn btn-outline btn-md rounded-2xl px-6 py-3 text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground inline-flex items-center gap-2"
              >
                <span>View Collections</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          {/* Architectural Story Visual / Manifesto Slate */}
          <div className="lg:col-span-5">
            <div className="relative rounded-3xl border border-border/70 bg-gradient-to-br from-card/90 via-card/50 to-muted/20 p-8 sm:p-10 backdrop-blur-xl shadow-2xl space-y-6 overflow-hidden">
              <div className="flex items-center justify-between border-b border-border/60 pb-4">
                <span className="text-xs font-mono font-bold uppercase tracking-widest text-primary">MANUFACTURE NOTE</span>
                <span className="text-xs font-mono text-muted-foreground">VOL. 01 / ED. 26</span>
              </div>

              <div className="space-y-3">
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  The Cal Cart Quality Standard
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Every product released through {formattedStoreName} adheres to three non-negotiables: material traceability, fair artisan compensation, and durability testing that exceeds industry norms.
                </p>
              </div>

              <ul className="space-y-2.5 pt-2 text-xs font-mono text-muted-foreground">
                <li className="flex items-center gap-2.5">
                  <Check size={14} className="text-primary shrink-0" />
                  <span>Verified supply chains &amp; ethical origins</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check size={14} className="text-primary shrink-0" />
                  <span>Small-batch production to prevent surplus waste</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check size={14} className="text-primary shrink-0" />
                  <span>Direct-to-client pricing without middle tiers</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Structured Editorial Principles Grid */}
        <section className="space-y-8">
          <div className="space-y-2">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-primary">CORE COMMITMENTS</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              How we approach modern craftsmanship.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            <div className="p-7 sm:p-8 rounded-3xl border border-border/70 bg-card/60 backdrop-blur-md space-y-4 hover:border-primary/40 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary">
                  01
                </span>
                <Gem size={18} className="text-muted-foreground/60" />
              </div>
              <h3 className="font-bold text-lg text-foreground">Artisanal Pedigree</h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                We partner with dedicated craftspeople who preserve heritage techniques while incorporating modern precision engineering for consistent excellence.
              </p>
            </div>

            <div className="p-7 sm:p-8 rounded-3xl border border-border/70 bg-card/60 backdrop-blur-md space-y-4 hover:border-primary/40 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary">
                  02
                </span>
                <Compass size={18} className="text-muted-foreground/60" />
              </div>
              <h3 className="font-bold text-lg text-foreground">Conscious Materials</h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Raw materials are certified, recycled, or responsibly harvested. We publish lifecycle analyses to ensure minimal ecological footprints across operations.
              </p>
            </div>

            <div className="p-7 sm:p-8 rounded-3xl border border-border/70 bg-card/60 backdrop-blur-md space-y-4 hover:border-primary/40 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary">
                  03
                </span>
                <ShieldCheck size={18} className="text-muted-foreground/60" />
              </div>
              <h3 className="font-bold text-lg text-foreground">Direct Integrity</h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                No inflated designer markups or distributor markdowns. Honest pricing, carbon-neutral shipping, and lifetime support on every crafted piece.
              </p>
            </div>
          </div>
        </section>

        {/* Pull Quote in Magazine Typography */}
        <section className="p-8 sm:p-14 rounded-3xl bg-muted/20 border border-border/70 relative overflow-hidden">
          <div className="max-w-2xl mx-auto text-center space-y-4">
            <blockquote className="text-2xl sm:text-3xl lg:text-4xl font-serif italic text-foreground leading-relaxed">
              &ldquo;True luxury is knowing the origin of the objects in your life, and knowing they were crafted with unwavering intention.&rdquo;
            </blockquote>
            <span className="block text-xs font-mono font-bold uppercase tracking-widest text-primary pt-2">
              — The {formattedStoreName} Founders
            </span>
          </div>
        </section>

        {/* Bottom Editorial Callout */}
        <section className="flex flex-col sm:flex-row items-center justify-between gap-6 p-8 sm:p-10 rounded-3xl border border-border/70 bg-card/70 backdrop-blur-md">
          <div className="space-y-1 text-center sm:text-left">
            <h3 className="text-xl font-bold tracking-tight text-foreground">Ready to explore our work?</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">Browse the full seasonal catalog of handcrafted goods.</p>
          </div>
          <Link
            href={`/stores/${encodeURIComponent(storeSlug)}/products`}
            className="btn btn-primary btn-md rounded-2xl px-8 py-3 text-xs font-mono font-bold uppercase tracking-wider shadow-lg shadow-primary/15 hover:shadow-primary/30 transition-all inline-flex items-center gap-2 shrink-0"
          >
            <span>Browse Products Catalog</span>
            <ArrowRight size={14} />
          </Link>
        </section>
      </div>
    </StorefrontShell>
  );
}
