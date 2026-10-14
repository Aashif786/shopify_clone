"use client";

import React, { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, ChevronRight, Menu, Package, Search, ShoppingBag, X } from "lucide-react";
import { Badge } from "@shopify-clone/ui";
import { hasRoleAtLeast } from "@shopify-clone/tenant";
import { ThemeModeToggle } from "../theme-mode-toggle";

export interface NavItem { id: string; label: string; href: string; icon?: string; badge?: string; minRole?: "owner" | "admin" | "staff"; isPlaceholder?: boolean; category?: string; }
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
    default:
      return <span>{name || "•"}</span>;
  }
}

export interface StoreOption { id: string; name: string; slug: string; role?: "owner" | "admin" | "staff"; }
export interface MerchantShellProps { children: ReactNode; activePath?: string; currentStore?: StoreOption | null; stores?: StoreOption[]; onSelectStore?: (storeId: string) => void; userName?: string; userEmail?: string; userRole?: "owner" | "admin" | "staff"; onLogout?: () => void; title?: string; subtitle?: string; headerActions?: ReactNode; }

export function MerchantShell({ children, activePath = "/merchant", currentStore, userRole = "owner", title, subtitle, headerActions }: MerchantShellProps) {
  const pathname = usePathname();
  const resolvedPath = pathname || activePath;
  const [commandOpen, setCommandOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const visibleItems = useMemo(() => MERCHANT_NAV_ITEMS.filter((item) => !item.minRole || hasRoleAtLeast(userRole, item.minRole)), [userRole]);
  const activeItem = visibleItems.find((item) => resolvedPath === item.href || (item.href !== "/merchant" && resolvedPath.startsWith(`${item.href}/`))) || visibleItems[0];
  const filteredItems = visibleItems.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setCommandOpen(true); }
      if (event.key === "Escape") { setCommandOpen(false); setMobileOpen(false); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const go = (href: string) => { window.location.href = href; setCommandOpen(false); setMobileOpen(false); };
  return (
    <div className="merchant-layout orbit-shell">
      <aside className={`orbit-rail ${mobileOpen ? "is-mobile-open" : ""}`} aria-label="Merchant navigation">
        <div className="orbit-rail-brand"><ShoppingBag aria-hidden="true" /><span>ORBIT</span></div>
        <nav className="orbit-rail-nav" aria-label="Primary merchant destinations">
          {visibleItems.map((item) => { const isActive = activeItem?.id === item.id; return <Link key={item.id} href={item.href} className={`orbit-rail-item ${isActive ? "is-active" : ""}`} aria-current={isActive ? "page" : undefined} aria-label={item.label} title={item.label} onClick={() => setMobileOpen(false)}><span className="orbit-rail-icon"><NavIcon name={item.icon} /></span><span className="orbit-rail-label">{item.label}</span>{isActive && <motion.span layoutId="orbit-active" className="orbit-active-indicator" />}</Link>; })}
        </nav>
        <div className="orbit-rail-bottom"><ThemeModeToggle /><button type="button" className="orbit-rail-item orbit-mobile-menu" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X aria-hidden="true" /></button></div>
      </aside>

      <AnimatePresence>
        {mobileOpen && <motion.button className="orbit-mobile-backdrop" aria-label="Close navigation" onClick={() => setMobileOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />}
      </AnimatePresence>

      <div className="merchant-main-wrapper orbit-workspace">
        <header className="merchant-header orbit-header" role="banner"><div className="orbit-header-left"><button type="button" className="orbit-menu-trigger" onClick={() => setMobileOpen(true)} aria-label="Open merchant navigation"><Menu aria-hidden="true" /></button><div className="orbit-breadcrumb"><span>MERCHANT CONSOLE</span><ChevronRight aria-hidden="true" /><strong>{title || activeItem?.label || "Overview"}</strong>{subtitle && <small>{subtitle}</small>}</div></div><div className="orbit-header-actions"><button type="button" className="orbit-search-trigger" onClick={() => setCommandOpen(true)} aria-label="Open command palette"><Search aria-hidden="true" /><span>Search anything</span><kbd>⌘K</kbd></button>{headerActions}{currentStore && <Badge variant="info" size="sm">{currentStore.name}</Badge>}{currentStore && <a className="orbit-storefront-link" href={`/stores/${encodeURIComponent(currentStore.slug)}/products`} target="_blank" rel="noopener noreferrer">View store <ArrowUpRight aria-hidden="true" /></a>}</div></header>
        <motion.main className="merchant-content orbit-content" role="main" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>{children}</motion.main>
      </div>

      <AnimatePresence>{commandOpen && <motion.div className="orbit-command-overlay" role="dialog" aria-modal="true" aria-label="Command palette" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event: React.MouseEvent<HTMLDivElement>) => { if (event.currentTarget === event.target) setCommandOpen(false); }}><motion.div className="orbit-command" initial={{ y: -18, scale: .98 }} animate={{ y: 0, scale: 1 }} exit={{ y: -18, scale: .98 }}><div className="orbit-command-input"><Search aria-hidden="true" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Jump to a destination or action..." aria-label="Search commands" /></div><div className="orbit-command-group"><span className="orbit-kicker">DESTINATIONS</span>{filteredItems.map((item) => <button key={item.id} type="button" className="orbit-command-item" onClick={() => go(item.href)}><NavIcon name={item.icon} /><span>{item.label}</span><kbd>{item.href}</kbd></button>)}</div><div className="orbit-command-group"><span className="orbit-kicker">ACTIONS</span><button type="button" className="orbit-command-item" onClick={() => go("/merchant/products/new")}><Package aria-hidden="true" /><span>Create product</span><kbd>↵</kbd></button><button type="button" className="orbit-command-item" onClick={() => go("/merchant/orders")}><ShoppingBag aria-hidden="true" /><span>Open orders</span><kbd>↵</kbd></button></div><p className="orbit-command-hint">Press <kbd>ESC</kbd> to close</p></motion.div></motion.div>}</AnimatePresence>
    </div>
  );
}
