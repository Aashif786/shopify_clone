"use client";

import React, { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, Menu, ShoppingBag, X } from "lucide-react";
import { Badge } from "@shopify-clone/ui";
import { hasRoleAtLeast } from "@shopify-clone/tenant";
import { ThemeModeToggle } from "../theme-mode-toggle";

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon?: string;
  badge?: string;
  minRole?: "owner" | "admin" | "staff";
  isPlaceholder?: boolean;
  category?: string;
}

export const MERCHANT_NAV_ITEMS: NavItem[] = [
  {
    id: "dashboard",
    label: "Overview",
    href: "/merchant",
    icon: "dashboard",
    category: "Commerce",
  },
  {
    id: "products",
    label: "Products",
    href: "/merchant/products",
    icon: "products",
    category: "Commerce",
  },
  {
    id: "inventory",
    label: "Inventory",
    href: "/merchant/inventory",
    icon: "inventory",
    category: "Commerce",
  },
  {
    id: "discounts",
    label: "Discounts",
    href: "/merchant/discounts",
    icon: "discounts",
    category: "Commerce",
  },
  {
    id: "orders",
    label: "Orders",
    href: "/merchant/orders",
    icon: "orders",
    category: "Sales & Customers",
  },
  {
    id: "customers",
    label: "Customers",
    href: "/merchant/customers",
    icon: "customers",
    category: "Sales & Customers",
  },
  {
    id: "stores",
    label: "Stores",
    href: "/merchant/stores",
    icon: "stores",
    minRole: "owner",
    category: "Store & Team",
  },
  {
    id: "team",
    label: "Team and Members",
    href: "/merchant/team",
    icon: "team",
    minRole: "admin",
    category: "Store & Team",
  },
  {
    id: "settings",
    label: "Settings",
    href: "/merchant/settings",
    icon: "settings",
    minRole: "admin",
    category: "Store & Team",
  },
  {
    id: "account",
    label: "Account & Security",
    href: "/merchant/account",
    icon: "account",
    category: "Store & Team",
  },
  {
    id: "analytics",
    label: "Analytics",
    href: "/merchant/analytics",
    icon: "analytics",
    isPlaceholder: true,
    badge: "Planned",
    category: "Store & Team",
  },
];

function NavIcon({ name }: { name?: string }) {
  switch (name) {
    case "dashboard":
    case "📊":
      return (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect width="7" height="9" x="3" y="3" rx="1" />
          <rect width="7" height="5" x="14" y="3" rx="1" />
          <rect width="7" height="9" x="14" y="12" rx="1" />
          <rect width="7" height="5" x="3" y="16" rx="1" />
        </svg>
      );
    case "products":
      return (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m7.5 4.27 9 5.15" />
          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
          <path d="m3.3 7 8.7 5 8.7-5" />
          <path d="M12 22V12" />
        </svg>
      );
    case "inventory":
      return (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      );
    case "discounts":
      return (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
          <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />
        </svg>
      );
    case "orders":
    case "📑":
      return (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
          <path d="M3 6h18" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      );
    case "customers":
    case "👥":
      return (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "stores":
      return (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
          <path d="M2 7h20" />
        </svg>
      );
    case "team":
      return (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case "settings":
    case "⚙️":
      return (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case "analytics":
    case "📈":
      return (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      );
    case "account":
      return (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    default:
      return <span>{name || "•"}</span>;
  }
}

export interface StoreOption {
  id: string;
  name: string;
  slug: string;
  role?: "owner" | "admin" | "staff";
}

export interface MerchantShellProps {
  children: ReactNode;
  activePath?: string;
  currentStore?: StoreOption | null;
  stores?: StoreOption[];
  onSelectStore?: (storeId: string) => void;
  userName?: string;
  userEmail?: string;
  userRole?: "owner" | "admin" | "staff";
  onLogout?: () => void;
  title?: string;
  subtitle?: string;
  headerActions?: ReactNode;
}

export function MerchantShell({
  children,
  activePath = "/merchant",
  currentStore,
  stores = [],
  onSelectStore,
  userName = "Merchant User",
  userEmail,
  userRole = "owner",
  onLogout,
  title,
  subtitle,
  headerActions,
}: MerchantShellProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Filter navigation items by role
  const visibleNavItems = MERCHANT_NAV_ITEMS.filter((item) => {
    if (!item.minRole) return true;
    return hasRoleAtLeast(userRole, item.minRole);
  });

  // Group items by category
  const categories = Array.from(
    new Set(visibleNavItems.map((item) => item.category || "General"))
  );

  const userInitials = (userName || "M")
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "M";

  return (
    <div className="merchant-layout">
      {/* Mobile Drawer Backdrop */}
      {isMobileMenuOpen && (
        <div
          className="merchant-drawer-backdrop"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`merchant-sidebar ${isMobileMenuOpen ? "open" : ""}`}
        aria-label="Merchant Navigation"
      >
        <div className="merchant-sidebar-header">
          <div className="merchant-brand-wrap">
            <div className="merchant-brand-icon" aria-hidden="true">
              <ShoppingBag aria-hidden="true" />
            </div>
            <div>
              <div className="merchant-brand-title">Shopify Clone</div>
              <div className="merchant-brand-subtitle">Merchant Console</div>
            </div>
          </div>
          {isMobileMenuOpen && (
            <button
              type="button"
              className="btn btn-ghost btn-sm merchant-mobile-toggle"
              onClick={() => setIsMobileMenuOpen(false)}
              aria-label="Close navigation menu"
              >
                <X aria-hidden="true" />
              </button>
          )}
        </div>

        {/* Store Selector */}
        {stores.length > 0 ? (
          <div className="merchant-store-select-wrap">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-1)" }}>
              <label htmlFor="merchant-store-select" className="merchant-store-select-label" style={{ margin: 0 }}>
                Active Store
              </label>
              <a
                href="/merchant/stores/new"
                style={{
                  fontSize: "var(--font-size-xs)",
                  color: "var(--color-primary)",
                  textDecoration: "none",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "2px",
                }}
                title="Create a new merchant store"
              >
                + New Store
              </a>
            </div>
            <select
              id="merchant-store-select"
              className="select input-sm merchant-store-select"
              value={currentStore?.id || ""}
              onChange={(e) => onSelectStore?.(e.target.value)}
              aria-label="Select active store"
            >
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name} {store.role ? `(${store.role})` : ""}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div
            className="merchant-store-select-wrap"
            style={{
              padding: "var(--space-3)",
              backgroundColor: "var(--color-bg)",
              borderRadius: "var(--radius-md)",
              border: "1px dashed var(--color-border)",
            }}
          >
            <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginBottom: "var(--space-2)" }}>
              No active store
            </div>
            <a
              href="/merchant/stores/new"
              className="btn btn-primary btn-sm"
              style={{ width: "100%", justifyContent: "center", display: "inline-flex" }}
            >
              + Create Store
            </a>
          </div>
        )}

        {/* Navigation items categorized */}
        <nav className="merchant-nav" aria-label="Main Navigation">
          {categories.map((cat) => {
            const items = visibleNavItems.filter(
              (i) => (i.category || "General") === cat
            );
            return (
              <div key={cat} className="merchant-nav-category-group">
                <div className="merchant-nav-category-title">{cat}</div>
                <ul className="merchant-nav-list">
                  {items.map((item) => {
                    const isActive = activePath === item.href;
                    return (
                      <motion.li
                        key={item.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.24, delay: 0.04 * items.indexOf(item) }}
                      >
                        <a
                          href={item.href}
                          className={`merchant-nav-link ${isActive ? "active" : ""}`}
                          aria-current={isActive ? "page" : undefined}
                          onClick={() => {
                            setIsMobileMenuOpen(false);
                          }}
                        >
                          <span className="merchant-nav-item-content">
                            <span className="merchant-nav-icon" aria-hidden="true">
                              <NavIcon name={item.icon} />
                            </span>
                            <span className="merchant-nav-label">{item.label}</span>
                          </span>
                          {item.badge && (
                            <Badge
                              variant={item.isPlaceholder ? "neutral" : "info"}
                              size="sm"
                            >
                              {item.badge}
                            </Badge>
                          )}
                        </a>
                      </motion.li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        {/* Sidebar Footer / User Profile */}
        <div className="merchant-sidebar-footer">
          <div className="merchant-user-profile">
            <div className="merchant-user-avatar" aria-hidden="true">
              {userInitials}
            </div>
            <div className="merchant-user-info">
              <span className="merchant-user-name" title={userName}>
                {userName}
              </span>
              <span className="merchant-user-role">
                {userRole ? userRole.toUpperCase() : "STAFF"}
                {userEmail ? ` · ${userEmail}` : ""}
              </span>
            </div>
            {onLogout && (
              <button
                type="button"
                className="btn btn-ghost btn-sm merchant-logout-btn"
                onClick={onLogout}
                aria-label="Log out"
                title="Log out"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" x2="9" y1="12" y2="12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="merchant-main-wrapper">
        <header className="merchant-header" role="banner">
          <div className="merchant-header-left">
            <button
              type="button"
              className="btn btn-ghost btn-sm merchant-mobile-toggle"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu aria-hidden="true" />
            </button>
            <div className="merchant-header-titles">
              {title && <h1 className="merchant-page-title">{title}</h1>}
              {subtitle && <p className="merchant-header-subtitle">{subtitle}</p>}
            </div>
          </div>

<div className="merchant-header-right">
  <ThemeModeToggle />
  {headerActions}
            {currentStore && (
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <a
                  href={`/stores/${encodeURIComponent(currentStore.slug)}/products`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline btn-sm merchant-view-storefront-btn"
                  title="View Customer Storefront"
                >
                  View Storefront <ArrowUpRight aria-hidden="true" />
                </a>
                <Badge variant="info" size="sm">
                  Store: {currentStore.name}
                </Badge>
              </div>
            )}
          </div>
        </header>

        <motion.main
          className="merchant-content"
          role="main"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}
