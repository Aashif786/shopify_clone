"use client";

import React, { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import {
  motion,
  MotionConfig,
  AnimatePresence,
  useScroll,
  useSpring,
  useTransform,
  useMotionValue,
  useReducedMotion,
  type Variants,
} from "framer-motion";
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
  const inner = (
    <motion.span
      className={`action ${light ? "action-light" : ""}`}
      whileHover={{ y: -3, scale: 1.02 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: "spring", stiffness: 450, damping: 25 }}
    >
      <span>{children}</span>
      <motion.span
        style={{ display: "inline-flex", alignItems: "center" }}
        whileHover={{ x: 3, y: -3 }}
        transition={{ type: "spring", stiffness: 400, damping: 22 }}
      >
        <ArrowUpRight data-icon="inline-end" />
      </motion.span>
    </motion.span>
  );

  if (href.startsWith("#")) {
    return (
      <a href={href} style={{ textDecoration: "none", display: "inline-block" }}>
        {inner}
      </a>
    );
  }

  return (
    <Link href={href} style={{ textDecoration: "none", display: "inline-block" }}>
      {inner}
    </Link>
  );
}

function TiltCard<T extends "div" | "article" = "div">({
  as,
  children,
  className = "",
  style,
  tiltStrength = 6,
  whileHover,
}: {
  as?: T;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  tiltStrength?: number;
  whileHover?: { y?: number; scale?: number };
}) {
  const MotionComponent = as === "article" ? motion.article : motion.div;
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const shouldReduceMotion = useReducedMotion();

  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [tiltStrength, -tiltStrength]), {
    stiffness: 260,
    damping: 24,
  });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-tiltStrength, tiltStrength]), {
    stiffness: 260,
    damping: 24,
  });

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (shouldReduceMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    x.set(px);
    y.set(py);
  };

  const handlePointerLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <MotionComponent
      className={className}
      style={{
        ...style,
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
      }}
      whileHover={whileHover ?? { y: -6, scale: 1.015 }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      {children}
    </MotionComponent>
  );
}

const sectionVariants: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.65,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },
};

export default function Page() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [swatch, setSwatch] = useState(0);
  const [operation, setOperation] = useState(2);

  const currentSwatch = swatches[swatch] ?? swatches[0];
  const currentOp = ops[operation] ?? ops[0];

  const horizontalRef = useRef<HTMLElement>(null);
  const horizontalWrapRef = useRef<HTMLDivElement>(null);
  const horizontalTrackRef = useRef<HTMLDivElement>(null);
  const [horizontalDistance, setHorizontalDistance] = useState(0);

  useEffect(() => {
    const measure = () => {
      if (typeof window !== "undefined" && window.innerWidth <= 800) {
        setHorizontalDistance(0);
        return;
      }
      const wrap = horizontalWrapRef.current;
      const track = horizontalTrackRef.current;
      if (!wrap || !track) return;
      const distance = Math.max(0, track.scrollWidth - wrap.clientWidth + 80);
      setHorizontalDistance((prev) => (Math.abs(prev - distance) > 2 ? distance : prev));
    };

    measure();
    const frame = requestAnimationFrame(measure);
    const delayedMeasure = window.setTimeout(measure, 250);
    if (document.fonts?.ready) {
      document.fonts.ready.then(measure);
    }
    const observer = new ResizeObserver(measure);
    if (horizontalWrapRef.current) observer.observe(horizontalWrapRef.current);
    if (horizontalTrackRef.current) observer.observe(horizontalTrackRef.current);
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.clearTimeout(delayedMeasure);
      window.removeEventListener("resize", measure);
    };
  }, []);

  const { scrollYProgress } = useScroll({
    target: horizontalRef,
    offset: ["start start", "end end"],
  });

  const horizontalX = useSpring(
    useTransform(scrollYProgress, [0, 1], [0, -horizontalDistance]),
    { stiffness: 90, damping: 24, mass: 0.7 }
  );

  return (
    <MotionConfig reducedMotion="user">
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

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="mobile-menu"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] as const }}
          >
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
          </motion.div>
        )}
      </AnimatePresence>

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
          <TiltCard className="orbit-card card-one" tiltStrength={7}>
            <span>ORDER / 0092</span>
            <strong>Moving →</strong>
            <i />
          </TiltCard>
          <TiltCard className="orbit-card card-two" tiltStrength={7}>
            <span>STOCK / ORBIT TEE</span>
            <strong>124 units</strong>
            <b>+ 08%</b>
          </TiltCard>
          <div className="tiny-label label-one">STORE / LIVE</div>
          <div className="tiny-label label-two">PAYMENT / CLEARED</div>
        </div>

        <div className="hero-bottom">
          <span>SCROLL TO EXPLORE</span>
          <span>43° 12&apos; 09&quot; N / 074° 00&apos; 11&quot; W</span>
        </div>
      </section>

      <motion.section
        className="intro-section"
        id="catalog"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        variants={sectionVariants}
      >
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
      </motion.section>

      <motion.section
        className="product-lab"
        id="product"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        variants={sectionVariants}
      >
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
              <motion.button
                key={item.name}
                aria-label={item.name}
                className={swatch === i ? "selected" : ""}
                style={{ backgroundColor: item.color }}
                onClick={() => setSwatch(i)}
                whileHover={{ scale: 1.25 }}
                whileTap={{ scale: 0.9 }}
                animate={
                  swatch === i
                    ? {
                        scale: [1, 1.15, 1],
                        transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
                      }
                    : { scale: 1 }
                }
                transition={{ type: "spring", stiffness: 450, damping: 22 }}
                type="button"
              />
            ))}
          </div>
          <div className="size-row">
            <span>SIZE</span>
            {["XS", "S", "M", "L", "XL"].map((size, i) => (
              <motion.button
                key={size}
                className={i === 2 ? "size-selected" : ""}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                type="button"
              >
                {size}
              </motion.button>
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
          <motion.div
            className="tee"
            animate={{
              backgroundColor: currentSwatch.color,
              scale: [0.97, 1.02, 1],
            }}
            transition={{
              duration: 0.45,
              ease: [0.22, 1, 0.36, 1] as const,
            }}
            style={{ "--tee-color": currentSwatch.color } as CSSProperties}
          >
            <div className="tee-neck" />
            <div className="tee-print">
              O<br />
              <small>RBIT</small>
            </div>
          </motion.div>
          <div className="stage-label">
            A / FRONT VIEW <span>● ● ●</span>
          </div>
        </div>
      </motion.section>

      <motion.section
        className="world-section"
        id="world"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        variants={sectionVariants}
      >
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

        <TiltCard className="store-window" tiltStrength={5} whileHover={{ y: -8, scale: 1.01 }}>
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
        </TiltCard>
      </motion.section>

      <motion.section
        className="engine-section"
        id="engine"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        variants={sectionVariants}
      >
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
            <motion.button
              key={label}
              className={`op-node node-${i} ${operation === i ? "active" : ""}`}
              onClick={() => setOperation(i)}
              whileHover={{ scale: 1.1, x: 4 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              type="button"
            >
              <span className="node-dot" />
              <small>0{i + 1}</small>
              <strong>{label}</strong>
            </motion.button>
          ))}
          <AnimatePresence mode="wait">
            <motion.div
              key={operation}
              className="op-detail"
              initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] as const }}
            >
              <p>SELECTED SYSTEM / 0{operation + 1}</p>
              <h3>{currentOp[0]}</h3>
              <span>{currentOp[1]}</span>
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.section>

      <section
        className="manifesto"
        ref={horizontalRef}
        style={{
          height: horizontalDistance > 0 ? `calc(100svh + ${horizontalDistance}px)` : undefined,
        }}
      >
        <div className="manifesto-sticky">
          <div className="manifesto-header">
            <p className="eyebrow">05 / A NEW DIMENSION</p>
            <h2>
              Scroll beyond
              <br />
              <em>the ordinary.</em>
            </h2>
          </div>
          <div ref={horizontalWrapRef} className="manifesto-track-wrap">
            <motion.div
              ref={horizontalTrackRef}
              className="manifesto-track"
              style={{ x: horizontalDistance > 0 ? horizontalX : undefined }}
            >
              <TiltCard as="article" tiltStrength={5}>
                <span>01 — THE CATALOG</span>
                <h3>
                  Build around
                  <br />
                  the way people buy.
                </h3>
                <Mark />
              </TiltCard>
              <TiltCard as="article" tiltStrength={5}>
                <span>02 — THE STOREFRONT</span>
                <h3>
                  Give every product
                  <br />
                  a place to shine.
                </h3>
                <Mark inverse />
              </TiltCard>
              <TiltCard as="article" tiltStrength={5}>
                <span>03 — THE TRANSACTION</span>
                <h3>
                  Every selection
                  <br />
                  moves toward a purchase.
                </h3>
                <Mark />
              </TiltCard>
            </motion.div>
          </div>
          <div className="manifesto-progress">
            <span>01 / 03</span>
            <div className="manifesto-progress-bar">
              <motion.div
                className="manifesto-progress-fill"
                style={{ scaleX: scrollYProgress, transformOrigin: "left" }}
              />
            </div>
            <span>SCROLL TRACK</span>
          </div>
        </div>
      </section>

      <motion.section
        className="details"
        id="details"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        variants={sectionVariants}
      >
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
          <TiltCard as="article" tiltStrength={6}>
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
          </TiltCard>
          <TiltCard as="article" tiltStrength={6}>
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
          </TiltCard>
          <TiltCard as="article" tiltStrength={6}>
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
          </TiltCard>
        </div>
      </motion.section>

      <motion.section
        className="cta-section"
        id="start"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        variants={sectionVariants}
      >
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
      </motion.section>

      <motion.footer
        id="footer"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.1 }}
        variants={sectionVariants}
      >
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
      </motion.footer>
      </main>
    </MotionConfig>
  );
}
