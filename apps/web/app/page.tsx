"use client";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Activity,
  Check,
  ChevronRight,
  Layers3,
  Orbit,
  ShieldCheck,
  Sparkles,
  Store,
  Zap,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { ThemeModeToggle } from "@/components/theme-mode-toggle";
import "./home-page.css";

const capabilities = [
  {
    index: "01",
    icon: ShieldCheck,
    title: "Tenant-safe by design",
    copy: "Every organization, store, product, order, and customer stays inside its trusted boundary.",
    tag: "SECURITY FIRST",
  },
  {
    index: "02",
    icon: Orbit,
    title: "Inventory in motion",
    copy: "Reservations, releases, and adjustments move through an auditable commerce ledger.",
    tag: "REAL-TIME OPERATIONS",
  },
  {
    index: "03",
    icon: Zap,
    title: "Checkout without friction",
    copy: "Discounts, payments, and fulfillment connect through resilient, idempotent flows.",
    tag: "BUILT TO SCALE",
  },
];

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <main className="nova-page">
      <div className="nova-background-grid" aria-hidden="true" />

      <header className="nova-nav">
        <a className="nova-brand" href="/" aria-label="Shopify Clone home">
          <span className="nova-brand-icon">
            <Orbit size={23} />
          </span>
          <span className="nova-brand-name">
            CAL CART
            <small>COMMERCE PLATFORM</small>
          </span>
        </a>

        <nav
          className={`nova-nav-links ${menuOpen ? "is-open" : ""}`}
          aria-label="Primary navigation"
        >
          <a href="#system" onClick={() => setMenuOpen(false)}>
            Platform
          </a>
          <a href="#capabilities" onClick={() => setMenuOpen(false)}>
            Capabilities
          </a>
          <a href="/stores/artisan-store/products">Storefront</a>
          <div className="nova-theme-toggle">
            <ThemeModeToggle />
          </div>
          <a
            className="nova-button nova-button-primary nova-nav-cta"
            href="/merchant"
          >
            Open dashboard <ArrowUpRight size={17} />
          </a>
        </nav>

        <button
          className="nova-mobile-toggle"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X /> : <Menu />}
        </button>
      </header>

      <section className="nova-hero" aria-labelledby="hero-title">
        <div className="nova-hero-glow" aria-hidden="true" />
        <div className="nova-hero-orbit nova-orbit-one" aria-hidden="true" />
        <div className="nova-hero-orbit nova-orbit-two" aria-hidden="true" />

        <div className="nova-hero-layout">
          <div className="nova-hero-copy nova-reveal">
            <div className="nova-eyebrow">
              <span className="nova-eyebrow-icon">
                <Sparkles size={14} />
              </span>
              THE COMMERCE OPERATING SYSTEM
              <span className="nova-eyebrow-line" />
            </div>

            <h1 id="hero-title">
              Commerce,
              <br />
              <span className="nova-gradient-text">in orbit.</span>
            </h1>

            <p className="nova-hero-description">
              Your entire commerce operation, connected. Manage stores,
              inventory, orders, and customers through one intelligent
              platform built for the next generation of commerce.
            </p>

            <div className="nova-hero-actions">
              <a
                className="nova-button nova-button-primary"
                href="/merchant"
              >
                Enter the control room <ArrowUpRight size={18} />
              </a>

              <a
                className="nova-button nova-button-secondary"
                href="/stores/artisan-store"
              >
                Explore storefront <ArrowRight size={17} />
              </a>
            </div>

            <div className="nova-trust-row">
              <span>
                <Check size={14} /> Multi-tenant architecture
              </span>
              <span>
                <Check size={14} /> Auditable operations
              </span>
            </div>
          </div>

          <div
            className="nova-dashboard-wrap nova-reveal nova-reveal-delay"
            aria-label="Illustrative commerce dashboard preview"
          >
            <div className="nova-dashboard-backdrop" />

            <div className="nova-dashboard">
              <div className="nova-dashboard-topbar">
                <div className="nova-window-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </div>

                <span className="nova-dashboard-label">
                  CAL CART / OVERVIEW
                </span>

                <span className="nova-live-indicator">
                  <i /> LIVE
                </span>
              </div>

              <div className="nova-dashboard-body">
                <div className="nova-dashboard-heading">
                  <div>
                    <span className="nova-muted-label">
                      YOUR COMMERCE AT A GLANCE
                    </span>
                    <h2>Overview</h2>
                  </div>
                  <div className="nova-avatar">CC</div>
                </div>

                <div className="nova-metric-grid">
                  <article className="nova-metric-card">
                    <div className="nova-metric-label">
                      Total orders <Activity size={15} />
                    </div>
                    <strong>1,284</strong>
                    <span className="nova-metric-positive">
                      <ArrowUpRight size={14} /> 12.8%
                    </span>
                  </article>

                  <article className="nova-metric-card nova-metric-highlight">
                    <div className="nova-metric-label">
                      Revenue <Layers3 size={15} />
                    </div>
                    <strong>₹8.42L</strong>
                    <span className="nova-metric-positive">
                      <ArrowUpRight size={14} /> 18.6%
                    </span>
                  </article>
                </div>

                <div className="nova-chart-card">
                  <div className="nova-chart-heading">
                    <div>
                      <span className="nova-muted-label">
                        PERFORMANCE
                      </span>
                      <h3>Revenue overview</h3>
                    </div>
                    <span className="nova-chart-period">7 days</span>
                  </div>

                  <div className="nova-chart" aria-hidden="true">
                    <div className="nova-chart-grid">
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>

                    <svg
                      viewBox="0 0 420 128"
                      preserveAspectRatio="none"
                      role="presentation"
                    >
                      <defs>
                        <linearGradient
                          id="nova-chart-fill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#a78bfa"
                            stopOpacity=".35"
                          />
                          <stop
                            offset="100%"
                            stopColor="#a78bfa"
                            stopOpacity="0"
                          />
                        </linearGradient>
                      </defs>

                      <path
                        d="M0 103 C28 96 34 82 62 88 S103 65 126 76 S163 43 190 58 S232 66 252 39 S295 54 316 30 S359 45 382 16 S404 24 420 8 L420 128 L0 128 Z"
                        fill="url(#nova-chart-fill)"
                      />

                      <path
                        d="M0 103 C28 96 34 82 62 88 S103 65 126 76 S163 43 190 58 S232 66 252 39 S295 54 316 30 S359 45 382 16 S404 24 420 8"
                        fill="none"
                        stroke="#a78bfa"
                        strokeWidth="2.5"
                        vectorEffect="non-scaling-stroke"
                      />
                    </svg>
                  </div>

                  <div className="nova-chart-labels">
                    <span>MON</span>
                    <span>TUE</span>
                    <span>WED</span>
                    <span>THU</span>
                    <span>FRI</span>
                    <span>SAT</span>
                    <span>SUN</span>
                  </div>
                </div>

                <div className="nova-system-status">
                  <span className="nova-status-icon">
                    <ShieldCheck size={17} />
                  </span>
                  <div>
                    <strong>All systems operational</strong>
                    <span>Commerce services are ready</span>
                  </div>
                  <Check className="nova-status-check" size={17} />
                </div>
              </div>
            </div>

            <div className="nova-floating-chip nova-chip-top">
              <span className="nova-chip-icon">
                <Zap size={17} />
              </span>
              <span>
                <strong>Fast checkout</strong>
                <small>Optimized flows</small>
              </span>
            </div>

            <div className="nova-floating-chip nova-chip-bottom">
              <span className="nova-chip-pulse" />
              <span>
                <strong>Tenant isolation</strong>
                <small>Security enabled</small>
              </span>
            </div>
          </div>
        </div>

        <a className="nova-scroll-cue" href="#system">
          <span>DISCOVER THE PLATFORM</span>
          <ArrowDown size={16} />
        </a>
      </section>

      <section id="system" className="nova-system-section">
        <div className="nova-section-index">01 / THE SYSTEM</div>

        <div className="nova-system-layout">
          <div className="nova-system-copy">
            <p className="nova-section-kicker">A BETTER WAY TO BUILD</p>
            <h2>
              Not another template.
              <br />
              <span className="nova-gradient-text">
                A connected system.
              </span>
            </h2>
          </div>

          <div className="nova-system-description">
            <p>
              Great commerce is more than a storefront. It is the invisible
              system connecting products, inventory, payments, and people.
              Cal Cart brings those moving parts into one cohesive experience.
            </p>

            <a className="nova-text-link" href="/merchant">
              Explore the platform <ArrowUpRight size={17} />
            </a>
          </div>
        </div>

        <div className="nova-stats-row">
          <div className="nova-stat">
            <span>01</span>
            <strong>One platform</strong>
            <small>Connected commerce workflows</small>
          </div>

          <div className="nova-stat">
            <span>02</span>
            <strong>Clear boundaries</strong>
            <small>Tenant-aware architecture</small>
          </div>

          <div className="nova-stat">
            <span>03</span>
            <strong>Built to evolve</strong>
            <small>Modular system design</small>
          </div>

          <div className="nova-stat nova-stat-icon">
            <Orbit size={38} strokeWidth={1.2} />
          </div>
        </div>
      </section>

      <section id="capabilities" className="nova-capabilities-section">
        <div className="nova-section-heading">
          <div>
            <p className="nova-section-kicker">02 / THE ENGINE</p>
            <h2>
              Serious infrastructure.
              <br />
              <span className="nova-gradient-text">
                Effortless experience.
              </span>
            </h2>
          </div>

          <p className="nova-heading-description">
            Thoughtful engineering behind every interaction, from the first
            product view to the final order update.
          </p>
        </div>

        <div className="nova-capability-grid">
          {capabilities.map(
            ({ index, icon: Icon, title, copy, tag }) => (
              <article className="nova-capability-card" key={index}>
                <div className="nova-card-top">
                  <span className="nova-card-index">{index}</span>
                  <span className="nova-card-icon">
                    <Icon size={23} strokeWidth={1.7} />
                  </span>
                </div>

                <span className="nova-card-tag">{tag}</span>
                <h3>{title}</h3>
                <p>{copy}</p>

                <a className="nova-card-link" href="/merchant">
                  Inspect platform <ArrowUpRight size={16} />
                </a>
              </article>
            ),
          )}
        </div>
      </section>

      <section className="nova-portals-section">
        <div className="nova-portal-glow" aria-hidden="true" />

        <div className="nova-portal-heading">
          <p className="nova-section-kicker">03 / TWO PERSPECTIVES</p>
          <h2>
            One engine.
            <br />
            <span className="nova-gradient-text">Two worlds.</span>
          </h2>
          <p>
            A powerful workspace for merchants. A seamless shopping
            experience for customers. One connected commerce platform.
          </p>
        </div>

        <div className="nova-portal-grid">
          <a className="nova-portal-card" href="/merchant">
            <div className="nova-portal-card-top">
              <span className="nova-portal-icon">
                <Layers3 size={24} />
              </span>
              <ArrowUpRight size={21} />
            </div>

            <span className="nova-portal-eyebrow">
              FOR MERCHANTS
            </span>
            <h3>Take control.</h3>
            <p>
              Manage products, monitor orders, and run your operation from
              one workspace.
            </p>
            <span className="nova-portal-action">
              Open merchant dashboard <ChevronRight size={17} />
            </span>
          </a>

          <a
            className="nova-portal-card nova-portal-card-store"
            href="/stores/artisan-store"
          >
            <div className="nova-portal-card-top">
              <span className="nova-portal-icon">
                <Store size={24} />
              </span>
              <ArrowUpRight size={21} />
            </div>

            <span className="nova-portal-eyebrow">
              FOR CUSTOMERS
            </span>
            <h3>Start exploring.</h3>
            <p>
              Discover products and experience a storefront designed
              around effortless shopping.
            </p>
            <span className="nova-portal-action">
              Visit the storefront <ChevronRight size={17} />
            </span>
          </a>
        </div>
      </section>

      <section className="nova-final-cta">
        <div className="nova-final-cta-glow" aria-hidden="true" />

        <p className="nova-section-kicker">YOUR NEXT ORDER STARTS HERE</p>
        <h2>
          Ready to move
          <br />
          <span className="nova-gradient-text">commerce forward?</span>
        </h2>
        <p>
          Step into a more connected way to manage your commerce operation.
        </p>

        <a className="nova-button nova-button-primary" href="/merchant">
          Enter the control room <ArrowUpRight size={18} />
        </a>
      </section>

      <footer className="nova-footer">
        <a className="nova-footer-brand" href="/">
          <Orbit size={18} /> CAL CART
        </a>
        <span>BUILT FOR THE NEXT ORDER.</span>
        <a href="#hero-title">BACK TO TOP ↑</a>
      </footer>
    </main>
  );
}
