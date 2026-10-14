"use client";

import React, { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, BarChart3, Boxes, ChevronRight, Command as LayoutDashboard, Menu, Package, Percent, Search, Settings2, ShoppingBag, Store, ShieldCheck, Users, X } from "lucide-react";
import { Badge } from "@shopify-clone/ui";
import { hasRoleAtLeast } from "@shopify-clone/tenant";
import { ThemeModeToggle } from "../theme-mode-toggle";

export interface NavItem { id: string; label: string; href: string; icon?: string; badge?: string; minRole?: "owner" | "admin" | "staff"; isPlaceholder?: boolean; category?: string; }
export const MERCHANT_NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Overview", href: "/merchant", icon: "dashboard", category: "Commerce" },
  { id: "products", label: "Products", href: "/merchant/products", icon: "products", category: "Commerce" },
  { id: "inventory", label: "Inventory", href: "/merchant/inventory", icon: "inventory", category: "Commerce" },
  { id: "discounts", label: "Discounts", href: "/merchant/discounts", icon: "discounts", category: "Commerce" },
  { id: "orders", label: "Orders", href: "/merchant/orders", icon: "orders", category: "Sales & Customers" },
  { id: "customers", label: "Customers", href: "/merchant/customers", icon: "customers", category: "Sales & Customers" },
  { id: "stores", label: "Stores", href: "/merchant/stores", icon: "stores", minRole: "owner", category: "Store & Team" },
  { id: "team", label: "Team and Members", href: "/merchant/team", icon: "team", minRole: "admin", category: "Store & Team" },
  { id: "settings", label: "Settings", href: "/merchant/settings", icon: "settings", minRole: "admin", category: "Store & Team" },
];

const ICONS: Record<string, React.ComponentType<{ "aria-hidden"?: boolean }>> = { dashboard: LayoutDashboard, products: Package, inventory: Boxes, discounts: Percent, orders: ShoppingBag, customers: Users, stores: Store, team: ShieldCheck, settings: Settings2, analytics: BarChart3 };
function NavIcon({ name }: { name?: string }) { const Icon = ICONS[name || "dashboard"] || LayoutDashboard; return <Icon aria-hidden={true} />; }

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

      <AnimatePresence>{commandOpen && <motion.div className="orbit-command-overlay" role="dialog" aria-modal="true" aria-label="Command palette" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.currentTarget === event.target) setCommandOpen(false); }}><motion.div className="orbit-command" initial={{ y: -18, scale: .98 }} animate={{ y: 0, scale: 1 }} exit={{ y: -18, scale: .98 }}><div className="orbit-command-input"><Search aria-hidden="true" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Jump to a destination or action..." aria-label="Search commands" /></div><div className="orbit-command-group"><span className="orbit-kicker">DESTINATIONS</span>{filteredItems.map((item) => <button key={item.id} type="button" className="orbit-command-item" onClick={() => go(item.href)}><NavIcon name={item.icon} /><span>{item.label}</span><kbd>{item.href}</kbd></button>)}</div><div className="orbit-command-group"><span className="orbit-kicker">ACTIONS</span><button type="button" className="orbit-command-item" onClick={() => go("/merchant/products/new")}><Package aria-hidden="true" /><span>Create product</span><kbd>↵</kbd></button><button type="button" className="orbit-command-item" onClick={() => go("/merchant/orders")}><ShoppingBag aria-hidden="true" /><span>Open orders</span><kbd>↵</kbd></button></div><p className="orbit-command-hint">Press <kbd>ESC</kbd> to close</p></motion.div></motion.div>}</AnimatePresence>
    </div>
  );
}
