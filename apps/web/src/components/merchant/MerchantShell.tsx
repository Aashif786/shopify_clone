"use client";

import React, { useState, type ReactNode } from "react";
import { Badge } from "@shopify-clone/ui";
import { hasRoleAtLeast } from "@shopify-clone/tenant";

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon?: string;
  badge?: string;
  minRole?: "owner" | "admin" | "staff";
  isPlaceholder?: boolean;
}

export const MERCHANT_NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", href: "/merchant", icon: "📊" },
  { id: "products", label: "Products", href: "/merchant/products", icon: "📦" },
  { id: "orders", label: "Orders", href: "/merchant/orders", icon: "📑" },
  { id: "customers", label: "Customers", href: "/merchant/customers", icon: "👥" },
  { id: "discounts", label: "Discounts", href: "/merchant/discounts", icon: "🏷️" },
  { id: "settings", label: "Settings", href: "/merchant/settings", icon: "⚙️", minRole: "admin", isPlaceholder: true },
];

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
}: MerchantShellProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Filter navigation items by role
  const visibleNavItems = MERCHANT_NAV_ITEMS.filter((item) => {
    if (!item.minRole) return true;
    return hasRoleAtLeast(userRole, item.minRole);
  });

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
          <div className="merchant-brand-title">Shopify Clone</div>
          {isMobileMenuOpen && (
            <button
              type="button"
              className="btn btn-ghost btn-sm merchant-mobile-toggle"
              onClick={() => setIsMobileMenuOpen(false)}
              aria-label="Close navigation menu"
            >
              ✕
            </button>
          )}
        </div>

        {/* Store Selector */}
        {stores.length > 0 && (
          <div className="merchant-store-select-wrap">
            <label htmlFor="merchant-store-select" className="sr-only">
              Current Store
            </label>
            <select
              id="merchant-store-select"
              className="select input-sm"
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
        )}

        {/* Navigation items */}
        <nav className="merchant-nav" aria-label="Main Navigation">
          <ul className="merchant-nav-list">
            {visibleNavItems.map((item) => {
              const isActive = activePath === item.href;
              return (
                <li key={item.id}>
                  <a
                    href={item.href}
                    className={`merchant-nav-link ${isActive ? "active" : ""}`}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <span className="merchant-nav-item-content">
                      {item.icon && (
                        <span className="merchant-nav-icon" aria-hidden="true">
                          {item.icon}
                        </span>
                      )}
                      <span>{item.label}</span>
                    </span>
                    {item.badge && (
                      <Badge variant="neutral" size="sm">
                        {item.badge}
                      </Badge>
                    )}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Sidebar Footer / User Profile */}
        <div className="merchant-sidebar-footer">
          <div className="merchant-user-profile">
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
                className="btn btn-ghost btn-sm"
                onClick={onLogout}
                aria-label="Log out"
                title="Log out"
              >
                🚪
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
              ☰
            </button>
            {title && <h1 className="merchant-page-title">{title}</h1>}
          </div>

          <div className="merchant-header-right">
            {currentStore && (
              <Badge variant="info" size="sm">
                Store: {currentStore.name}
              </Badge>
            )}
          </div>
        </header>

        <main className="merchant-content" role="main">
          {children}
        </main>
      </div>
    </div>
  );
}
