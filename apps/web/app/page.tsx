import { ArrowDown, ArrowUpRight, Layers3, Orbit, ShieldCheck, Sparkles, Store, Zap } from "lucide-react";
import { ThemeModeToggle } from "@/components/theme-mode-toggle";
import { NovaCommerceScene } from "@/components/immersive/NovaCommerceScene";

const capabilities = [
  { index: "01", icon: ShieldCheck, title: "Tenant-safe by design", copy: "Every organization, store, product, order, and customer stays inside its trusted boundary." },
  { index: "02", icon: Orbit, title: "Inventory in motion", copy: "Reservations, releases, and adjustments move through an auditable commerce ledger." },
  { index: "03", icon: Zap, title: "Checkout without friction", copy: "Discounts, payments, and fulfillment connect through resilient, idempotent flows." },
];

export default function HomePage() {
  return (
    <main className="landing-page nova-cinematic-page">
      <header className="landing-nav nova-glass-panel">
        <a className="landing-brand" href="/" aria-label="Shopify Clone home"><span className="landing-mark">SC</span><span>SHOPIFY CLONE <small>DEMO</small></span></a>
        <nav className="landing-nav-links" aria-label="Primary navigation">
          <a href="#system">System</a><a href="#capabilities">Capabilities</a><a href="/stores/artisan-store/products">Storefront</a><ThemeModeToggle /><a className="nova-pill nova-pill-primary" href="/merchant">Open dashboard <ArrowUpRight /></a>
        </nav>
      </header>

      <section className="nova-hero-scene" aria-labelledby="landing-hero-title">
        <div className="nova-hero-noise" aria-hidden="true" /><div className="nova-hero-orbit nova-hero-orbit--one" aria-hidden="true" /><div className="nova-hero-orbit nova-hero-orbit--two" aria-hidden="true" />
        <div className="nova-hero-copy nova-reveal">
          <p className="nova-kicker"><Sparkles /> THE COMMERCE OPERATING SYSTEM</p>
          <h1 id="landing-hero-title">Commerce,<br /><em>in orbit.</em></h1>
          <p className="nova-hero-lede">A cinematic control plane for stores that move at the speed of imagination.</p>
          <div className="nova-hero-actions"><a className="nova-pill nova-pill-primary" href="/merchant">Enter the control room <ArrowUpRight /></a><a className="nova-pill nova-pill-ghost" href="/stores/artisan-store">Explore a live storefront <ArrowDown /></a></div>
          <div className="nova-hero-meta"><span><i /> POSTGRESQL CORE</span><span><i /> MULTI-TENANT</span><span><i /> PAYMENT READY</span></div>
        </div>
        <NovaCommerceScene density="hero" className="nova-hero-3d" />
        <div className="nova-hero-console nova-glass-panel nova-reveal nova-reveal-delay" aria-label="Commerce system preview">
          <div className="nova-console-top"><span>LIVE / COMMERCE CORE</span><span className="nova-status"><i /> OPERATIONAL</span></div>
          <div className="nova-console-sphere"><div className="nova-sphere-ring nova-sphere-ring--one" /><div className="nova-sphere-ring nova-sphere-ring--two" /><div className="nova-sphere-core"><Store /></div></div>
          <div className="nova-console-readout"><strong>12,842</strong><span>events processed today</span><b>+28.4%</b></div>
        </div>
        <a className="nova-scroll-cue" href="#system"><span>SCROLL TO EXPLORE</span><ArrowDown /></a>
      </section>

      <section id="system" className="nova-story-section nova-story-section--intro nova-scroll-scene">
        <div className="nova-section-index">01 / THE SYSTEM</div><div className="nova-story-copy"><p className="nova-kicker">A LIVING ARCHITECTURE</p><h2>Not a template.<br /><em>A point of view.</em></h2><p>Shopify Clone is a modular commerce engine shaped around the moments that matter: a product discovered, a cart assembled, a payment trusted, an order delivered.</p></div>
        <div className="nova-story-stat nova-glass-panel"><span>ACTIVE SURFACES</span><strong>24</strong><small>routes connected through one visual language</small></div>
      </section>

      <section id="capabilities" className="nova-capability-section nova-scroll-scene"><div className="nova-section-heading"><p className="nova-kicker">02 / THE ENGINE</p><h2>Designed to feel<br /><em>alive.</em></h2></div><div className="nova-capability-grid">{capabilities.map(({ index, icon: Icon, title, copy }) => <article className="nova-capability-card nova-glass-panel" key={index}><div className="nova-card-index">{index}</div><Icon /><h3>{title}</h3><p>{copy}</p><a href="/merchant">Inspect system <ArrowUpRight /></a></article>)}</div></section>

      <section className="nova-portal-section nova-scroll-scene"><div className="nova-portal-glow" aria-hidden="true" /><div className="nova-portal-content"><p className="nova-kicker">03 / TWO PERSPECTIVES</p><h2>One engine.<br /><em>Two worlds.</em></h2><div className="nova-portal-links"><a className="nova-portal-card nova-glass-panel" href="/merchant"><Layers3 /><span>MERCHANT CONTROL</span><strong>Run the operation <ArrowUpRight /></strong></a><a className="nova-portal-card nova-glass-panel" href="/stores/artisan-store"><Store /><span>CUSTOMER EXPERIENCE</span><strong>Enter the storefront <ArrowUpRight /></strong></a></div></div></section>
      <footer className="nova-footer"><span>SHOPIFY CLONE / KINETIC NOVA</span><span>BUILT FOR THE NEXT ORDER</span></footer>
    </main>
  );
}
