import React from "react";

export default function HomePage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "var(--color-bg)", color: "var(--color-text)" }}>
      {/* Top Navigation */}
      <header
        style={{
          borderBottom: "1px solid var(--color-border)",
          backgroundColor: "var(--color-surface)",
          position: "sticky",
          top: 0,
          zIndex: "var(--z-sticky, 200)",
        }}
      >
        <div
          style={{
            maxWidth: "var(--container-xl, 1280px)",
            margin: "0 auto",
            padding: "var(--space-4) var(--space-6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <span style={{ fontSize: "var(--font-size-2xl)", lineHeight: 1 }}>🛍️</span>
            <div>
              <span style={{ fontWeight: "var(--font-weight-bold)", fontSize: "var(--font-size-lg)" }}>
                Shopify Clone
              </span>
              <span
                style={{
                  marginLeft: "var(--space-2)",
                  fontSize: "var(--font-size-xs)",
                  padding: "2px 8px",
                  borderRadius: "var(--radius-full)",
                  backgroundColor: "var(--color-primary-subtle)",
                  color: "var(--color-primary)",
                  fontWeight: "var(--font-weight-semibold)",
                }}
              >
                Demo
              </span>
            </div>
          </div>

          <nav style={{ display: "flex", alignItems: "center", gap: "var(--space-6)" }}>
            <a
              href="/merchant"
              style={{
                color: "var(--color-text)",
                fontWeight: "var(--font-weight-medium)",
                fontSize: "var(--font-size-sm)",
              }}
            >
              Merchant Admin
            </a>
            <a
              href="/stores/artisan-store/products"
              style={{
                color: "var(--color-text)",
                fontWeight: "var(--font-weight-medium)",
                fontSize: "var(--font-size-sm)",
              }}
            >
              Storefront
            </a>
            <a
              href="/api/v1/health"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "var(--color-text-muted)",
                fontSize: "var(--font-size-sm)",
              }}
            >
              System Health
            </a>
            <a
              href="/merchant"
              className="btn btn-primary btn-sm"
              style={{ textDecoration: "none" }}
            >
              Launch Dashboard →
            </a>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section
        style={{
          padding: "var(--space-16) var(--space-6) var(--space-12)",
          textAlign: "center",
          backgroundColor: "var(--color-surface)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div style={{ maxWidth: "860px", margin: "0 auto" }}>
          <div
            style={{
              display: "inline-block",
              marginBottom: "var(--space-4)",
              padding: "var(--space-1) var(--space-3)",
              backgroundColor: "var(--color-primary-subtle)",
              color: "var(--color-primary)",
              borderRadius: "var(--radius-full)",
              fontSize: "var(--font-size-xs)",
              fontWeight: "var(--font-weight-semibold)",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            Multi-Tenant Commerce Engine
          </div>

          <h1
            style={{
              fontSize: "var(--font-size-3xl)",
              fontWeight: "var(--font-weight-bold)",
              lineHeight: "var(--line-height-tight, 1.2)",
              margin: "0 0 var(--space-4)",
              color: "var(--color-text)",
            }}
          >
            Real, Functional Multi-Tenant Commerce Architecture
          </h1>

          <p
            style={{
              fontSize: "var(--font-size-lg)",
              color: "var(--color-text-muted)",
              lineHeight: "var(--line-height-relaxed, 1.6)",
              margin: "0 auto var(--space-8)",
              maxWidth: "680px",
            }}
          >
            A high-integrity modular monolith built with PostgreSQL, Next.js, and strict tenant
            isolation. Featuring concurrent-safe inventory tracking, dynamic discounts, and resilient checkout pipelines.
          </p>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "var(--space-4)",
              flexWrap: "wrap",
            }}
          >
            <a
              href="/merchant"
              className="btn btn-primary btn-lg"
              style={{ textDecoration: "none" }}
            >
              Merchant Administration 📊
            </a>
            <a
              href="/stores/artisan-store/products"
              className="btn btn-outline btn-lg"
              style={{ textDecoration: "none" }}
            >
              Customer Storefront 🛍️
            </a>
          </div>
        </div>
      </section>

      {/* Architecture Highlights */}
      <section
        style={{
          maxWidth: "var(--container-xl, 1280px)",
          margin: "0 auto",
          padding: "var(--space-12) var(--space-6)",
          width: "100%",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "var(--space-10)" }}>
          <h2
            style={{
              fontSize: "var(--font-size-2xl)",
              fontWeight: "var(--font-weight-bold)",
              margin: "0 0 var(--space-2)",
            }}
          >
            Platform Capabilities
          </h2>
          <p style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-md)", margin: 0 }}>
            Engineered for correctness, tenant boundaries, and payment reliability.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "var(--space-6)",
          }}
        >
          {/* Card 1 */}
          <div
            className="card"
            style={{
              padding: "var(--space-6)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-3)",
            }}
          >
            <div style={{ fontSize: "var(--font-size-2xl)" }}>🏢</div>
            <h3 style={{ margin: 0, fontSize: "var(--font-size-lg)", fontWeight: "var(--font-weight-semibold)" }}>
              Tenant Isolation
            </h3>
            <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)", lineHeight: 1.5 }}>
              Strict organization and store scoping. Data queries are verified server-side with zero cross-tenant leakage.
            </p>
          </div>

          {/* Card 2 */}
          <div
            className="card"
            style={{
              padding: "var(--space-6)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-3)",
            }}
          >
            <div style={{ fontSize: "var(--font-size-2xl)" }}>📦</div>
            <h3 style={{ margin: 0, fontSize: "var(--font-size-lg)", fontWeight: "var(--font-weight-semibold)" }}>
              Inventory Safety
            </h3>
            <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)", lineHeight: 1.5 }}>
              Concurrency-safe ledger adjustments, reservation expirations, and atomic stock release on checkout or order cancellation.
            </p>
          </div>

          {/* Card 3 */}
          <div
            className="card"
            style={{
              padding: "var(--space-6)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-3)",
            }}
          >
            <div style={{ fontSize: "var(--font-size-2xl)" }}>🏷️</div>
            <h3 style={{ margin: 0, fontSize: "var(--font-size-lg)", fontWeight: "var(--font-weight-semibold)" }}>
              Discounts Engine
            </h3>
            <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)", lineHeight: 1.5 }}>
              Percentage and fixed promotional vouchers with minimum spend validation, usage limits, and persistent redemption ledgers.
            </p>
          </div>

          {/* Card 4 */}
          <div
            className="card"
            style={{
              padding: "var(--space-6)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-3)",
            }}
          >
            <div style={{ fontSize: "var(--font-size-2xl)" }}>💳</div>
            <h3 style={{ margin: 0, fontSize: "var(--font-size-lg)", fontWeight: "var(--font-weight-semibold)" }}>
              Checkout & Payments
            </h3>
            <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)", lineHeight: 1.5 }}>
              Integrated with Razorpay test mode. Fully idempotent order completion, webhook HMAC verification, and recovery jobs.
            </p>
          </div>
        </div>

        {/* Quick Access Portals */}
        <div
          style={{
            marginTop: "var(--space-12)",
            backgroundColor: "var(--color-surface)",
            borderRadius: "var(--radius-xl)",
            border: "1px solid var(--color-border)",
            padding: "var(--space-8)",
          }}
        >
          <h3
            style={{
              fontSize: "var(--font-size-xl)",
              fontWeight: "var(--font-weight-bold)",
              margin: "0 0 var(--space-6)",
              textAlign: "center",
            }}
          >
            Demo Navigation Directory
          </h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "var(--space-6)",
            }}
          >
            <div style={{ padding: "var(--space-4)", borderLeft: "3px solid var(--color-primary)" }}>
              <h4 style={{ margin: "0 0 var(--space-2)", fontSize: "var(--font-size-base)" }}>Merchant Operations</h4>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                <li>
                  <a href="/merchant" style={{ color: "var(--color-primary)", fontWeight: "var(--font-weight-medium)" }}>
                    Overview Dashboard (/merchant)
                  </a>
                </li>
                <li>
                  <a href="/merchant/products" style={{ color: "var(--color-primary)", fontWeight: "var(--font-weight-medium)" }}>
                    Products & Variants (/merchant/products)
                  </a>
                </li>
                <li>
                  <a href="/merchant/discounts" style={{ color: "var(--color-primary)", fontWeight: "var(--font-weight-medium)" }}>
                    Promotions & Discounts (/merchant/discounts)
                  </a>
                </li>
              </ul>
            </div>

            <div style={{ padding: "var(--space-4)", borderLeft: "3px solid var(--color-success, #16a34a)" }}>
              <h4 style={{ margin: "0 0 var(--space-2)", fontSize: "var(--font-size-base)" }}>Customer Experience</h4>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                <li>
                  <a href="/stores/artisan-store/products" style={{ color: "var(--color-primary)", fontWeight: "var(--font-weight-medium)" }}>
                    Artisan Store Catalog (/stores/artisan-store/products)
                  </a>
                </li>
                <li>
                  <a href="/stores/artisan-store/cart" style={{ color: "var(--color-primary)", fontWeight: "var(--font-weight-medium)" }}>
                    Shopping Cart & Discounts (/stores/artisan-store/cart)
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          marginTop: "auto",
          borderTop: "1px solid var(--color-border)",
          backgroundColor: "var(--color-surface)",
          padding: "var(--space-6)",
          textAlign: "center",
          fontSize: "var(--font-size-xs)",
          color: "var(--color-text-muted)",
        }}
      >
        <p style={{ margin: 0 }}>
          Shopify Clone · Modular Monolith Commerce Platform · Built with Next.js, PostgreSQL & TypeScript
        </p>
      </footer>
    </div>
  );
}
