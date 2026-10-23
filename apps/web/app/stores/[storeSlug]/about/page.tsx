import React from "react";
import { StorefrontShell } from "../../../../src/components/storefront/StorefrontShell";
import { Sparkles, ArrowRight } from "lucide-react";

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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20 space-y-16">
        {/* Editorial Story Header */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-primary text-xs font-semibold">
            <Sparkles size={13} /> Our Philosophy & Craft
          </span>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground leading-tight">
            Designed for everyday life, <br />
            <span className="italic font-serif font-normal text-primary">built to endure.</span>
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            Welcome to {formattedStoreName}. We are dedicated to creating and curating handcrafted, high-quality pieces with timeless aesthetics, ethical sourcing, and uncompromising attention to detail.
          </p>
        </div>

        {/* Narrative Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-3xl border border-border/70 bg-card/60 backdrop-blur-md space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              01
            </div>
            <h3 className="font-bold text-base text-foreground">Artisanal Roots</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              We collaborate with skilled craftspeople who take pride in every stitch, bevel, and finish, prioritizing longevity over mass production.
            </p>
          </div>

          <div className="p-6 rounded-3xl border border-border/70 bg-card/60 backdrop-blur-md space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              02
            </div>
            <h3 className="font-bold text-base text-foreground">Sustainable Sourcing</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Every raw material is responsibly sourced, recycled, or certified low-impact to minimize environmental footprints.
            </p>
          </div>

          <div className="p-6 rounded-3xl border border-border/70 bg-card/60 backdrop-blur-md space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              03
            </div>
            <h3 className="font-bold text-base text-foreground">Direct Transparency</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              No retail markups or middle agents. Honest pricing, carbon-neutral shipping, and dedicated direct-to-customer care.
            </p>
          </div>
        </div>

        {/* Pull Quote */}
        <div className="p-8 sm:p-10 rounded-3xl bg-muted/20 border border-border/60 text-center space-y-3">
          <blockquote className="text-xl sm:text-2xl font-serif italic text-foreground max-w-xl mx-auto leading-relaxed">
            “True luxury is knowing the origin of the objects in your life, and knowing they were made with care.”
          </blockquote>
          <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            — The {formattedStoreName} Founders
          </span>
        </div>

        {/* CTA */}
        <div className="text-center pt-4">
          <a
            href={`/stores/${encodeURIComponent(storeSlug)}/products`}
            className="btn btn-primary btn-md rounded-2xl px-8 py-3.5 text-xs font-bold shadow-lg hover:shadow-primary/20 transition-all inline-flex items-center gap-2"
          >
            <span>Browse Products Catalog</span>
            <ArrowRight size={15} />
          </a>
        </div>
      </div>
    </StorefrontShell>
  );
}
