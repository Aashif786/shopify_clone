import { ArrowDown, ArrowUpRight, BarChart3, Check, CircleDot, LockKeyhole, Menu, Package, Sparkles, Store } from "lucide-react";
import { ThemeModeToggle } from "@/components/theme-mode-toggle";

const chapters = [
  { number: "01", label: "Shape the storefront", title: "Make the first impression\nfeel inevitable.", copy: "A flexible front of house for the brand you are building. Bring products, stories, and a point of view into one clear experience.", icon: Store, accent: "violet" },
  { number: "02", label: "Run the operation", title: "The busy work,\nquietly handled.", copy: "Products, stock, orders, and customers move together in one calm workspace, so you can spend more time on the work that compounds.", icon: Package, accent: "coral" },
  { number: "03", label: "Keep momentum", title: "Every order is\na signal.", copy: "See what is moving, where friction appears, and what deserves your attention next. Commerce becomes a feedback loop, not a spreadsheet.", icon: BarChart3, accent: "blue" },
];

function Wordmark() {
  return <a className="story-wordmark" href="/" aria-label="Shopify Clone home"><span className="story-wordmark-mark">SC</span><span>SHOPIFY CLONE</span></a>;
}

export default function HomePage() {
  return (
    <main className="story-landing">
      <header className="story-nav">
        <Wordmark />
        <nav aria-label="Primary navigation"><a href="#chapters">How it works</a><a href="#principles">Principles</a><a href="/stores/artisan-store/products">Storefront</a><ThemeModeToggle /><a className="story-nav-cta" href="/merchant">Open dashboard <ArrowUpRight /></a></nav>
        <button className="story-mobile-menu" type="button" aria-label="Open navigation"><Menu /></button>
      </header>

      <section className="story-hero" aria-labelledby="story-title">
        <div className="story-hero-grid" aria-hidden="true" />
        <div className="story-hero-glow story-hero-glow-one" aria-hidden="true" /><div className="story-hero-glow story-hero-glow-two" aria-hidden="true" />
        <div className="story-hero-copy story-reveal"><p className="story-eyebrow"><Sparkles /> A COMMERCE SYSTEM FOR THE NEXT CHAPTER</p><h1 id="story-title">Build a store<br /><em>worth returning to.</em></h1><p className="story-hero-lede">Shopify Clone gives ambitious merchants a sharper way to launch, operate, and grow an online business.</p><div className="story-hero-actions"><a className="story-button story-button-primary" href="/merchant">Start building <ArrowUpRight /></a><a className="story-text-link" href="#chapters">See how it works <ArrowDown /></a></div></div>
        <div className="story-hero-art story-reveal story-reveal-delay" aria-label="Commerce workspace preview"><div className="story-art-window"><div className="story-art-toolbar"><span /><span /><span /><b>OVERVIEW / TODAY</b></div><div className="story-art-body"><div className="story-art-sidebar"><i /><i /><i /><i /></div><div className="story-art-main"><small>GOOD MORNING, ALEX</small><strong>Make today<br />count.</strong><div className="story-art-metrics"><span><b>2,481</b> orders</span><span><b>+18.6%</b> growth</span></div><div className="story-art-chart"><i /><i /><i /><i /><i /><i /><i /></div></div></div></div><div className="story-art-note"><CircleDot /> LIVE OPERATIONS <strong>All clear</strong></div></div>
        <div className="story-hero-foot"><span>01</span><span>SCROLL TO MOVE THROUGH THE STORY</span><span className="story-hero-line" /></div>
      </section>

      <section id="principles" className="story-intro story-reveal"><p className="story-section-label">/ THE IDEA</p><div><h2>Commerce should<br /><em>feel like craft.</em></h2><p>Not a pile of tools. Not another dashboard to decode. A considered system that makes the right next step obvious.</p></div><div className="story-intro-stamp"><LockKeyhole /><span>BUILT FOR<br />TRUST</span></div></section>

      <section id="chapters" className="story-chapters"><div className="story-chapters-head"><p className="story-section-label">/ THE JOURNEY</p><p>Three connected moments.<br />One operating rhythm.</p></div>{chapters.map(({ number, label, title, copy, icon: Icon, accent }, index) => <article className={`story-chapter story-chapter-${accent} story-reveal`} key={number}><div className="story-chapter-number">{number}</div><div className="story-chapter-copy"><p className="story-eyebrow">{label}</p><h2>{title.split("\n").map((line) => <span key={line}>{line}<br /></span>)}</h2><p>{copy}</p><a className="story-text-link" href={index === 0 ? "/stores/artisan-store" : "/merchant"}>Explore this layer <ArrowUpRight /></a></div><div className="story-chapter-visual"><div className="story-visual-card"><Icon /><span>{number} / 03</span><strong>{index === 0 ? "A STORE WITH A POINT OF VIEW" : index === 1 ? "EVERYTHING IN ITS PLACE" : "SEE THE NEXT MOVE"}</strong><div className="story-visual-lines"><i /><i /><i /></div></div><div className="story-visual-orbit" aria-hidden="true" /></div></article>)}</section>

      <section className="story-proof story-reveal"><div><p className="story-section-label">/ THE FOUNDATION</p><h2>Quietly powerful.<br /><em>Deliberately yours.</em></h2></div><div className="story-proof-list"><p><Check /> Multi-tenant from the ground up</p><p><Check /> Inventory that knows the truth</p><p><Check /> Checkout built for confidence</p><p><Check /> An interface that stays out of your way</p></div></section>

      <section className="story-cta story-reveal"><div className="story-cta-orb" aria-hidden="true" /><p className="story-section-label">/ YOUR NEXT CHAPTER</p><h2>Ready to make<br /><em>something matter?</em></h2><p>Open the workspace and see what your commerce operation can feel like.</p><a className="story-button story-button-primary" href="/merchant">Enter Shopify Clone <ArrowUpRight /></a></section>
      <footer className="story-footer"><Wordmark /><span>COMMERCE, WITH CHARACTER.</span><div><a href="/merchant">Dashboard</a><a href="/stores/artisan-store">Storefront</a><a href="mailto:hello@example.com">Contact</a></div></footer>
    </main>
  );
}
