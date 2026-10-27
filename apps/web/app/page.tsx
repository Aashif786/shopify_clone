"use client";

import React, { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, ChevronDown, Menu, Sparkles, X } from "lucide-react";
import "./landing-page.css";

const swatches = [
  { name: "Signal orange", color: "#ef6b42", price: "$68", stock: "Available" },
  { name: "Cobalt blue", color: "#3558e8", price: "$68", stock: "Available" },
  { name: "Moss green", color: "#66735b", price: "$72", stock: "Low stock" },
] as const;

const ops = [
  ["CATALOG", "Every product, option, and detail in one organized system."],
  ["INVENTORY", "Know what is available and keep stock connected to the buying experience."],
  ["CHECKOUT", "A clear path from product selection to purchase."],
  ["ORDERS", "Follow the journey from payment to fulfillment."],
  ["AUTOMATION", "Keep important events connected across your workflow."],
] as const;

function Mark({ inverse = false }: { inverse?: boolean }) {
  return (
    <span className={`mark ${inverse ? "mark-inverse" : ""}`} aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

function Button({
  children,
  light = false,
  href = "/merchant/register",
}: {
  children: ReactNode;
  light?: boolean;
  href?: string;
}) {
  if (href.startsWith("#")) {
    return (
      <a href={href} className={`action ${light ? "action-light" : ""}`}>
        {children}
        <ArrowUpRight data-icon="inline-end" />
      </a>
    );
  }

  return (
    <Link href={href} className={`action ${light ? "action-light" : ""}`}>
      {children}
      <ArrowUpRight data-icon="inline-end" />
    </Link>
  );
}

export default function Page() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [swatch, setSwatch] = useState(0);
  const [operation, setOperation] = useState(2);

  const currentSwatch = swatches[swatch] ?? swatches[0];
  const currentOp = ops[operation] ?? ops[0];

  useEffect(() => {
    const revealTargets = document.querySelectorAll<HTMLElement>(
      "section, .site-header, footer, .orbit-card, .tiny-label, .detail-grid article, .manifesto article"
    );
    revealTargets.forEach((element, index) => {
      element.classList.add("motion-target");
      element.style.setProperty("--motion-delay", `${Math.min(index % 5, 4) * 90}ms`);
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("is-visible");
        });
      },
      { threshold: 0.12 }
    );
    revealTargets.forEach((element) => observer.observe(element));

    const tiltTargets = document.querySelectorAll<HTMLElement>(
      ".store-window, .detail-grid article, .manifesto article, .orbit-card"
    );
    const handlePointerMove = (event: PointerEvent) => {
      const target = event.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      const rotateX = ((event.clientY - rect.top) / rect.height - 0.5) * -5;
      const rotateY = ((event.clientX - rect.left) / rect.width - 0.5) * 5;
      target.style.setProperty("--tilt-x", `${rotateX}deg`);
      target.style.setProperty("--tilt-y", `${rotateY}deg`);
    };
    const resetTilt = (event: PointerEvent) => {
      const target = event.currentTarget as HTMLElement;
      target.style.setProperty("--tilt-x", "0deg");
      target.style.setProperty("--tilt-y", "0deg");
    };
    tiltTargets.forEach((target) => {
      target.addEventListener("pointermove", handlePointerMove);
      target.addEventListener("pointerleave", resetTilt);
    });

    return () => {
      observer.disconnect();
      tiltTargets.forEach((target) => {
        target.removeEventListener("pointermove", handlePointerMove);
        target.removeEventListener("pointerleave", resetTilt);
      });
    };
  }, []);

  return (
    <main className="site-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Cal Cart home">
          <Mark /> CAL<span>CART</span>
        </a>
        <nav className="desktop-nav" aria-label="Main navigation">
          <a href="#catalog">
            Platform <ChevronDown />
          </a>
          <a href="#world">Storefronts</a>
          <a href="#engine">Operations</a>
          <a href="#details">Explore</a>
        </nav>
        <div className="header-actions">
          <Link className="login" href="/merchant/login">
            Sign in
          </Link>
          <Button href="/merchant/register">Build your store</Button>
        </div>
        <button
          className="menu-trigger"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen(!menuOpen)}
          type="button"
        >
          {menuOpen ? <X /> : <Menu />}
        </button>
      </header>

      {menuOpen && (
        <div className="mobile-menu">
          <a href="#catalog" onClick={() => setMenuOpen(false)}>
            Platform
          </a>
          <a href="#world" onClick={() => setMenuOpen(false)}>
            Storefronts
          </a>
          <a href="#engine" onClick={() => setMenuOpen(false)}>
            Operations
          </a>
          <a href="#details" onClick={() => setMenuOpen(false)}>
            Explore
          </a>
          <Link href="/merchant/login" className="login" onClick={() => setMenuOpen(false)}>
            Sign in
          </Link>
          <Button href="/merchant/register">Build your store</Button>
        </div>
      )}

      <section className="hero" id="top">
        <div className="hero-grid" />
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="pulse" /> COMMERCE OS / 001
          </p>
          <h1>
            Everything
            <br />
            <em>you sell.</em>
            <br />
            <span>
              One system
              <br />
              that moves.
            </span>
          </h1>
          <p className="lede">
            From your first product to your next thousand orders, Cal Cart brings your storefront,
            inventory, customers, and operations into one connected commerce engine.
          </p>
          <div className="hero-buttons">
            <Button href="/merchant/register">Enter Cal Cart</Button>
            <a className="text-link" href="#catalog">
              See how it works <ArrowDownRight />
            </a>
          </div>
        </div>

        <div className="orbit-scene" aria-label="Illustration of connected commerce objects">
          <div className="orbit orbit-a" />
          <div className="orbit orbit-b" />
          <div className="core">
            <Mark inverse />
            <small>
              CAL
              <br />
              CART
            </small>
          </div>
          <div className="orbit-card card-one">
            <span>ORDER / 0092</span>
            <strong>Moving →</strong>
            <i />
          </div>
          <div className="orbit-card card-two">
            <span>STOCK / ORBIT TEE</span>
            <strong>124 units</strong>
            <b>+ 08%</b>
          </div>
          <div className="tiny-label label-one">STORE / LIVE</div>
          <div className="tiny-label label-two">PAYMENT / CLEARED</div>
        </div>

        <div className="hero-bottom">
          <span>SCROLL TO EXPLORE</span>
          <span>43° 12&apos; 09&quot; N / 074° 00&apos; 11&quot; W</span>
        </div>
      </section>

      <section className="intro-section" id="catalog">
        <div className="section-index">01 / THE CATALOG</div>
        <div>
          <h2>
            A product is
            <br />
            <em>never just</em>
            <br />
            a product.
          </h2>
          <p>
            Every option, every image, every variation. Build a catalog that reflects the way people
            actually shop.
          </p>
          <a className="text-link dark-link" href="#product">
            Open the lab <ArrowUpRight />
          </a>
        </div>
      </section>

      <section className="product-lab" id="product">
        <div className="lab-copy">
          <p className="eyebrow dark-eyebrow">PRODUCT / 001</p>
          <h3>
            ORBIT
            <br />
            <span>TEE</span>
          </h3>
          <p className="lab-description">
            One product. A hundred possibilities. Every detail connected.
          </p>
          <div className="lab-data">
            <span>
              VARIANTS <b>15 COMBINATIONS</b>
            </span>
            <span>
              STOCK <b className={swatch === 2 ? "warn" : ""}>{currentSwatch.stock.toUpperCase()}</b>
            </span>
          </div>
          <div className="swatch-row" aria-label="Choose color">
            <span>COLORWAY</span>
            {swatches.map((item, i) => (
              <button
                key={item.name}
                aria-label={item.name}
                className={swatch === i ? "selected" : ""}
                style={{ backgroundColor: item.color }}
                onClick={() => setSwatch(i)}
                type="button"
              />
            ))}
          </div>
          <div className="size-row">
            <span>SIZE</span>
            {["XS", "S", "M", "L", "XL"].map((size, i) => (
              <button key={size} className={i === 2 ? "size-selected" : ""} type="button">
                {size}
              </button>
            ))}
          </div>
          <div className="price-line">
            <strong>{currentSwatch.price}</strong>
            <span>Ships in 2–4 days</span>
          </div>
        </div>

        <div className="tee-stage">
          <div className="stage-code">
            VARIANT SYSTEM
            <br />
            <b>ACTIVE / {String(swatch + 1).padStart(2, "0")}</b>
          </div>
          <div
            className="tee"
            style={{ "--tee-color": currentSwatch.color } as CSSProperties}
          >
            <div className="tee-neck" />
            <div className="tee-print">
              O<br />
              <small>RBIT</small>
            </div>
          </div>
          <div className="stage-label">
            A / FRONT VIEW <span>● ● ●</span>
          </div>
        </div>
      </section>

      <section className="world-section" id="world">
        <div className="section-index">02 / STOREFRONT</div>
        <div className="world-heading">
          <p className="eyebrow">THE STORE IS YOUR WORLD</p>
          <h2>
            Your brand
            <br />
            deserves more
            <br />
            <em>than a template.</em>
          </h2>
          <p>
            Create a shopping experience that feels unmistakably yours, from the first impression to
            the final purchase.
          </p>
        </div>

        <div className="store-window">
          <div className="window-top">
            <span>orbit-supply.co</span>
            <span>SHOP / ABOUT / JOURNAL</span>
            <span>03 — 04</span>
          </div>
          <div className="store-image">
            <div className="store-sun" />
            <span>
              ORBIT
              <br />
              <b>SUPPLY</b>
            </span>
          </div>
          <div className="store-bottom">
            <strong>
              OBJECTS FOR
              <br />
              AN UNSTILL LIFE.
            </strong>
            <Link href="/stores/artisan-store/products">
              Explore collection <ArrowUpRight />
            </Link>
          </div>
        </div>
      </section>

      <section className="engine-section" id="engine">
        <div className="section-index">04 / OPERATIONS</div>
        <div className="engine-heading">
          <p className="eyebrow">THE COMMERCE ENGINE</p>
          <h2>
            Behind every
            <br />
            great store is a
            <br />
            <em>system that works.</em>
          </h2>
        </div>

        <div className="engine-map">
          <div className="map-lines" />
          {ops.map(([label], i) => (
            <button
              key={label}
              className={`op-node node-${i} ${operation === i ? "active" : ""}`}
              onClick={() => setOperation(i)}
              type="button"
            >
              <span className="node-dot" />
              <small>0{i + 1}</small>
              <strong>{label}</strong>
            </button>
          ))}
          <div className="op-detail">
            <p>SELECTED SYSTEM / 0{operation + 1}</p>
            <h3>{currentOp[0]}</h3>
            <span>{currentOp[1]}</span>
          </div>
        </div>
      </section>

      <section className="manifesto">
        <p className="eyebrow">05 / A NEW DIMENSION</p>
        <h2>
          Scroll beyond
          <br />
          <em>the ordinary.</em>
        </h2>
        <div className="manifesto-track">
          <article>
            <span>01 — THE CATALOG</span>
            <h3>
              Build around
              <br />
              the way people buy.
            </h3>
            <Mark />
          </article>
          <article>
            <span>02 — THE STOREFRONT</span>
            <h3>
              Give every product
              <br />
              a place to shine.
            </h3>
            <Mark inverse />
          </article>
          <article>
            <span>03 — THE TRANSACTION</span>
            <h3>
              Every selection
              <br />
              moves toward a purchase.
            </h3>
            <Mark />
          </article>
        </div>
      </section>

      <section className="details" id="details">
        <div className="section-index">06 / BUILT FOR THE DETAILS</div>
        <div className="details-head">
          <h2>
            Powerful where it matters.
            <br />
            <em>Effortless where it should be.</em>
          </h2>
          <p>
            Commerce is made of details. Cal Cart keeps them connected, so you can keep moving.
          </p>
        </div>

        <div className="detail-grid">
          <article>
            <span>01</span>
            <Sparkles />
            <h3>
              Product
              <br />
              intelligence
            </h3>
            <p>
              Organize products, options, categories, and collections without losing the details.
            </p>
          </article>
          <article>
            <span>02</span>
            <Sparkles />
            <h3>
              Inventory
              <br />
              awareness
            </h3>
            <p>
              Connect stock availability to the products customers actually buy.
            </p>
          </article>
          <article>
            <span>03</span>
            <Sparkles />
            <h3>
              Merchant
              <br />
              control
            </h3>
            <p>
              Manage your store through a focused workspace built for real operations.
            </p>
          </article>
        </div>
      </section>

      <section className="cta-section" id="start">
        <div className="cta-orbit" />
        <p className="eyebrow">08 / YOUR NEXT CHAPTER</p>
        <h2>
          Your next store
          <br />
          <em>starts here.</em>
        </h2>
        <p>
          Bring your products, your ideas, and your ambition. Build a commerce experience that grows
          with you.
        </p>
        <Button light href="/merchant/register">
          Build your store
        </Button>
      </section>

      <footer id="footer">
        <div className="footer-top">
          <a className="brand" href="#top">
            <Mark inverse /> CAL<span>CART</span>
          </a>
          <div className="footer-statement">
            COMMERCE DOESN&apos;T
            <br />
            <em>STAND STILL.</em>
          </div>
        </div>

        <div className="footer-links">
          <div>
            <span>PLATFORM</span>
            <Link href="/merchant/products">Product management</Link>
            <Link href="/stores/artisan-store">Storefronts</Link>
            <Link href="/merchant/inventory">Inventory</Link>
            <Link href="/merchant/orders">Orders</Link>
          </div>
          <div>
            <span>EXPLORE</span>
            <a href="#details">Features</a>
            <a href="#engine">How it works</a>
            <a href="#product">Product experience</a>
          </div>
          <div>
            <span>ACCOUNT</span>
            <Link href="/merchant/login">Sign in</Link>
            <Link href="/merchant/register">Create a store</Link>
          </div>
          <div>
            <span>RESOURCES</span>
            <Link href="/merchant">Documentation</Link>
            <a href="mailto:support@calcart.dev">Help</a>
            <a href="mailto:support@calcart.dev">Contact</a>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© 2026 CAL CART SYSTEMS</span>
          <span>
            ALL SYSTEMS NOMINAL <i />
          </span>
          <span>PRIVACY / TERMS</span>
        </div>
      </footer>
    </main>
  );
}
