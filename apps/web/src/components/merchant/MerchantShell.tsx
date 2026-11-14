"use client";

import React, { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  Menu,
  Package,
  Search,
  ShoppingBag,
  X,
  LayoutDashboard,
  Boxes,
  Percent,
  Users,
  Store,
  ShieldCheck,
  Settings,
  BarChart3,
  LogOut,
  Star,
  Undo2,
  ReceiptText,
  Truck,
  Palette,
  Globe,
  Layers,
  Code,
} from "lucide-react";
import { Badge } from "@calcart/ui";
import { hasRoleAtLeast } from "@calcart/tenant";
import { ThemeModeToggle } from "../theme-mode-toggle";
import { useStore } from "../../context/store-context";
import { useAuth } from "../../context/auth-context";

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
    id: "collections",
    label: "Collections",
    href: "/merchant/collections",
    icon: "collections",
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
    id: "shipping",
    label: "Shipping",
    href: "/merchant/shipping",
    icon: "shipping",
    category: "Commerce",
  },
  {
    id: "tax",
    label: "Tax and GST",
    href: "/merchant/tax",
    icon: "tax",
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
    id: "returns",
    label: "Returns",
    href: "/merchant/returns",
    icon: "returns",
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
    id: "analytics",
    label: "Analytics",
    href: "/merchant/analytics",
    icon: "analytics",
    category: "Sales & Customers",
  },
  {
    id: "reviews",
    label: "Reviews",
    href: "/merchant/reviews",
    icon: "reviews",
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
    id: "landing-page",
    label: "Landing Page",
    href: "/merchant/landing-page",
    icon: "landing-page",
    minRole: "admin",
    category: "Store & Team",
  },
  {
    id: "domains",
    label: "Domains",
    href: "/merchant/domains",
    icon: "domains",
    minRole: "admin",
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
    id: "developer",
    label: "API & Webhooks",
    href: "/merchant/developer",
    icon: "developer",
    minRole: "admin",
    category: "Store & Team",
  },
];

function NavIcon({ name }: { name?: string }) {
  const iconProps = { size: 16, className: "shrink-0", "aria-hidden": true };
  switch (name) {
    case "dashboard":
      return <LayoutDashboard {...iconProps} />;
    case "products":
      return <Package {...iconProps} />;
    case "collections":
      return <Layers {...iconProps} />;
    case "inventory":
      return <Boxes {...iconProps} />;
    case "discounts":
      return <Percent {...iconProps} />;
    case "orders":
      return <ShoppingBag {...iconProps} />;
    case "customers":
      return <Users {...iconProps} />;
    case "stores":
      return <Store {...iconProps} />;
    case "landing-page":
      return <Palette {...iconProps} />;
    case "domains":
      return <Globe {...iconProps} />;
    case "team":
      return <ShieldCheck {...iconProps} />;
    case "settings":
      return <Settings {...iconProps} />;
    case "analytics":
      return <BarChart3 {...iconProps} />;
    case "reviews":
      return <Star {...iconProps} />;
    case "returns":
      return <Undo2 {...iconProps} />;
    case "tax":
      return <ReceiptText {...iconProps} />;
    case "shipping":
      return <Truck {...iconProps} />;
    case "developer":
      return <Code {...iconProps} />;
    default:
      return <span className="text-xs" aria-hidden="true">•</span>;
  }
}

export interface StoreOption {
  id: string;
  name: string;
  slug: string;
  role?: "owner" | "admin" | "staff";
  status?: string;
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
  fullBleed?: boolean;
  hideHeader?: boolean;
}

export function MerchantShell({
  children,
  activePath = "/merchant",
  currentStore,
  stores,
  onSelectStore,
  userName,
  userRole,
  onLogout,
  title,
  subtitle,
  headerActions,
  fullBleed = false,
  hideHeader = false,
}: MerchantShellProps) {
  let router: ReturnType<typeof useRouter> | null = null;
  try {
    router = useRouter();
  } catch {
    // Fallback when outside App Router
  }

  let pathname: string | null = null;
  try {
    pathname = usePathname();
  } catch {
    // Fallback when outside App Router
  }
  const resolvedPath = pathname || activePath;
  const [commandOpen, setCommandOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem("calcart-merchant-rail") === "collapsed");
    } catch {
      // storage unavailable
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem("calcart-merchant-rail", next ? "collapsed" : "expanded");
      } catch {
        // storage unavailable
      }
      return next;
    });
  };

  let storeContext: ReturnType<typeof useStore> | null = null;
  try {
    storeContext = useStore();
  } catch {
    // Fallback when outside StoreProvider
  }

  let authContext: ReturnType<typeof useAuth> | null = null;
  try {
    authContext = useAuth();
  } catch {
    // Fallback when outside AuthProvider
  }

  const effectiveCurrentStore = currentStore !== undefined ? currentStore : (storeContext?.activeStore ?? null);
  const effectiveStores = stores !== undefined ? stores : (storeContext?.stores ?? []);
  const effectiveOnSelectStore = onSelectStore ?? storeContext?.selectStore;
  const effectiveUserName = userName ?? authContext?.user?.name;
  const effectiveUserRole = userRole ?? effectiveCurrentStore?.role ?? "staff";
  const effectiveOnLogout = onLogout ?? authContext?.logout;

  const visibleItems = useMemo(
    () => MERCHANT_NAV_ITEMS.filter((item) => !item.minRole || hasRoleAtLeast(effectiveUserRole, item.minRole)),
    [effectiveUserRole]
  );

  const handleStoreSwitch = (newStoreId: string) => {
    if (!newStoreId || newStoreId === effectiveCurrentStore?.id) return;

    const targetStore = effectiveStores.find((s) => s.id === newStoreId);
    const targetRole = targetStore?.role || "staff";

    effectiveOnSelectStore?.(newStoreId);

    // If on a store-specific resource detail route, redirect to list
    const pathSegments = resolvedPath.split("/").filter(Boolean);
    if (pathSegments.length >= 3 && pathSegments[0] === "merchant") {
      const section = pathSegments[1];
      if (section && ["products", "orders", "discounts", "customers", "inventory"].includes(section)) {
        if (router) {
          router.push(`/merchant/${section}`);
        } else if (typeof window !== "undefined") {
          window.location.href = `/merchant/${section}`;
        }
        return;
      }
    }

    // If current route requires a role the new store lacks, redirect safely
    const currentNavItem = MERCHANT_NAV_ITEMS.find(
      (item) => resolvedPath === item.href || (item.href !== "/merchant" && resolvedPath.startsWith(`${item.href}/`))
    );
    if (currentNavItem?.minRole && !hasRoleAtLeast(targetRole, currentNavItem.minRole)) {
      if (router) {
        router.push("/merchant");
      } else if (typeof window !== "undefined") {
        window.location.href = "/merchant";
      }
    }
  };

  const activeItem =
    visibleItems.find(
      (item) => resolvedPath === item.href || (item.href !== "/merchant" && resolvedPath.startsWith(`${item.href}/`))
    ) || visibleItems[0];

  const filteredItems = visibleItems.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
      if (event.key === "Escape") {
        setCommandOpen(false);
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const go = (href: string) => {
    if (router) {
      router.push(href);
    } else if (typeof window !== "undefined") {
      window.location.href = href;
    }
    setCommandOpen(false);
    setMobileOpen(false);
  };

  // Group items by category
  const categories = useMemo(() => {
    const map = new Map<string, NavItem[]>();
    for (const item of visibleItems) {
      const cat = item.category || "General";
      if (!map.has(cat)) {
        map.set(cat, []);
      }
      map.get(cat)!.push(item);
    }
    return Array.from(map.entries());
  }, [visibleItems]);

  return (
    <div className="merchant-layout orbit-shell">
      {/* Primary Sidebar */}
      <aside
        className={`merchant-sidebar ${mobileOpen ? "is-mobile-open" : ""}${collapsed ? " is-collapsed" : ""}`}
        aria-label="Merchant Navigation"
      >
        {/* Brand / Console Header */}
        <div className="mt-rail-head">
          <Link
            href="/merchant"
            className="mt-rail-brand"
          >
            <span className="mt-rail-mark">CC</span>
            <span className="mt-rail-text text-sm font-bold leading-tight">Cal Cart</span>
          </Link>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="hidden md:inline-flex p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-pressed={collapsed}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronsRight size={15} aria-hidden="true" /> : <ChevronsLeft size={15} aria-hidden="true" />}
            </button>
            <ThemeModeToggle />
            <button
              type="button"
              className="md:hidden p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Store Selector Strip in Sidebar */}
        <div className="mt-rail-store">
          {effectiveStores && effectiveStores.length > 1 ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                <span className="uppercase tracking-wider text-[10px] font-bold">Active Store</span>
                {effectiveCurrentStore?.role && (
                  <Badge
                    variant={effectiveCurrentStore.role === "staff" ? "neutral" : "info"}
                    size="sm"
                  >
                    {effectiveCurrentStore.role.toUpperCase()}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <select
                  id="merchant-store-select"
                  data-testid="merchant-store-select"
                  aria-label="Select store"
                  className="merchant-store-select w-full py-1.5 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer truncate"
                  value={effectiveCurrentStore?.id || ""}
                  onChange={(e) => handleStoreSwitch(e.target.value)}
                >
                  {effectiveStores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.role ? s.role.toUpperCase() : "STAFF"}){s.status === "DRAFT" ? " [Draft]" : ""}
                    </option>
                  ))}
                </select>
                {effectiveCurrentStore?.status === "DRAFT" && (
                  <Badge variant="warning" size="sm">Draft</Badge>
                )}
              </div>
            </div>
          ) : effectiveCurrentStore ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-foreground truncate">{effectiveCurrentStore.name}</span>
                <span className="text-[10px] font-mono text-muted-foreground truncate">/{effectiveCurrentStore.slug}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {effectiveCurrentStore.role && (
                  <Badge
                    variant={effectiveCurrentStore.role === "staff" ? "neutral" : "info"}
                    size="sm"
                  >
                    {effectiveCurrentStore.role.toUpperCase()}
                  </Badge>
                )}
                {effectiveCurrentStore.status === "DRAFT" && (
                  <Badge variant="warning" size="sm">Draft</Badge>
                )}
                {hasRoleAtLeast(effectiveUserRole, "owner") && (
                  <Link
                    href="/merchant/stores/new"
                    className="btn btn-ghost btn-xs text-[11px] px-1.5 py-0.5"
                    title="Create another store"
                  >
                    + New Store
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <Badge variant="neutral" size="sm">No Store Selected</Badge>
              <Link href="/merchant/stores/new" className="btn btn-primary btn-xs text-[11px] px-2 py-0.5">
                + Create Store
              </Link>
            </div>
          )}
        </div>

        {/* Grouped Navigation Links */}
        <nav className="mt-rail-nav" aria-label="Primary merchant destinations">
          {categories.map(([category, items]) => (
            <div key={category} className="space-y-1">
              <div className="mt-rail-group-label">
                {category}
              </div>
              <div className="space-y-0.5">
                {items.map((item) => {
                  const isActive = activeItem?.id === item.id;
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={`orbit-rail-item group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        isActive
                          ? "is-active bg-primary/10 text-primary font-semibold"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                      }`}
                      aria-current={isActive ? "page" : undefined}
                      aria-label={item.label}
                      title={item.label}
                      onClick={() => setMobileOpen(false)}
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <span className={`orbit-rail-icon shrink-0 ${isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`}>
                          <NavIcon name={item.icon} />
                        </span>
                        <span className="orbit-rail-label truncate">{item.label}</span>
                      </span>
                      {item.badge && (
                        <span className="orbit-rail-badge px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-primary/15 text-primary">
                          {item.badge}
                        </span>
                      )}
                      {isActive && <span className="orbit-active-indicator sr-only" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Sidebar Footer: User Profile & Logout */}
        <div className="mt-rail-foot">
          {effectiveUserName && (
            <div className="orbit-user-pill flex items-center gap-2 min-w-0">
              <span className="w-7 h-7 rounded-full bg-primary/20 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                {effectiveUserName.charAt(0).toUpperCase()}
              </span>
              <div className="flex flex-col min-w-0">
                <span className="orbit-user-name text-xs font-semibold text-foreground truncate max-w-[110px]">
                  {effectiveUserName}
                </span>
                {effectiveUserRole && (
                  <span className="text-[10px] font-mono uppercase text-muted-foreground">
                    {effectiveUserRole.toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          )}
          {effectiveOnLogout && (
            <button
              type="button"
              onClick={effectiveOnLogout}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={15} aria-hidden="true" />
            </button>
          )}
        </div>
      </aside>

      {/* Mobile Backdrop */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.button
            className="orbit-mobile-backdrop"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}
      </AnimatePresence>

      {/* Main Workspace Area */}
      <div className={`merchant-main-wrapper orbit-workspace ${fullBleed ? "!min-h-0 !h-screen !overflow-hidden flex flex-col" : ""}`}>
        {/* Top Header */}
        {!hideHeader && (
        <header className="merchant-header" role="banner">
          <div className="orbit-header-left flex items-center gap-3">
            <button
              type="button"
              className="orbit-menu-trigger p-1.5 rounded-lg border border-border text-foreground md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open merchant navigation"
            >
              <Menu size={18} aria-hidden="true" />
            </button>

            {/* Breadcrumb Navigation */}
            <div className="orbit-breadcrumb flex items-center gap-2 text-xs text-muted-foreground">
              <span className="text-[12px] text-muted-foreground">{effectiveCurrentStore?.name || "Console"}</span>
              <ChevronRight size={14} className="text-border" aria-hidden="true" />
              <strong className="text-foreground font-bold">{title || activeItem?.label || "Overview"}</strong>
              {subtitle && <small className="text-muted-foreground hidden sm:inline">• {subtitle}</small>}
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="orbit-header-actions flex items-center gap-2.5">
            {/* Quick Search Palette Trigger */}
            <button
              type="button"
              className="orbit-search-trigger"
              onClick={() => setCommandOpen(true)}
              aria-label="Open command palette"
            >
              <Search size={14} aria-hidden="true" />
              <span>Search anything</span>
              <kbd>⌘K</kbd>
            </button>

            {/* Quick create */}
            <div className="mt-quick">
              <button
                type="button"
                className="btn btn--primary btn--sm"
                aria-haspopup="menu"
                aria-expanded={quickOpen}
                onClick={() => setQuickOpen((open) => !open)}
                onBlur={(event) => {
                  if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node | null)) {
                    setQuickOpen(false);
                  }
                }}
              >
                <Plus size={13} aria-hidden="true" />
                <span>Create</span>
              </button>
              {quickOpen && (
                <div className="mt-quick-menu" role="menu">
                  {[
                    { href: "/merchant/products/new", label: "Product", Icon: Package },
                    { href: "/merchant/collections/new", label: "Collection", Icon: Layers },
                    { href: "/merchant/discounts/new", label: "Discount", Icon: Percent },
                  ].map(({ href, label, Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      role="menuitem"
                      className="mt-quick-item"
                      onClick={() => setQuickOpen(false)}
                    >
                      <Icon size={14} aria-hidden="true" />
                      {label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Direct Storefront Preview Link */}
            {effectiveCurrentStore && (
              <a
                className="orbit-storefront-link"
                href={`/stores/${encodeURIComponent(effectiveCurrentStore.slug)}/products`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>View store</span>
                <ArrowUpRight size={13} aria-hidden="true" />
              </a>
            )}

            {/* Contextual actions injected by specific pages */}
            {headerActions}
          </div>
        </header>
        )}

        {/* Content Area */}
        <motion.main
          className={`merchant-content ${fullBleed ? "!p-0 !m-0 !max-w-none !min-h-0 flex-1 flex flex-col overflow-hidden h-full w-full" : ""}`}
          role="main"
          initial={fullBleed ? false : { opacity: 0, y: 6 }}
          animate={fullBleed ? false : { opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {children}
        </motion.main>
      </div>

      {/* Global Command Palette (⌘K) */}
      <AnimatePresence>
        {commandOpen && (
          <motion.div
            className="orbit-command-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(event: React.MouseEvent<HTMLDivElement>) => {
              if (event.currentTarget === event.target) setCommandOpen(false);
            }}
          >
            <motion.div
              className="orbit-command"
              initial={{ y: -16, scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: -16, scale: 0.98 }}
            >
              <div className="orbit-command-input">
                <Search size={18} aria-hidden="true" />
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Jump to a destination or action..."
                  aria-label="Search commands"
                />
              </div>
              <div className="orbit-command-group">
                <span className="orbit-kicker text-[10px] font-bold uppercase tracking-wider text-primary px-2 py-1">
                  DESTINATIONS
                </span>
                {filteredItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="orbit-command-item"
                    onClick={() => go(item.href)}
                  >
                    <NavIcon name={item.icon} />
                    <span>{item.label}</span>
                    <kbd>{item.href}</kbd>
                  </button>
                ))}
              </div>
              <div className="orbit-command-group border-t border-border/50 pt-2">
                <span className="orbit-kicker text-[10px] font-bold uppercase tracking-wider text-primary px-2 py-1">
                  ACTIONS
                </span>
                <button
                  type="button"
                  className="orbit-command-item"
                  onClick={() => go("/merchant/products/new")}
                >
                  <Package size={16} aria-hidden="true" />
                  <span>Create product</span>
                  <kbd>↵</kbd>
                </button>
                <button
                  type="button"
                  className="orbit-command-item"
                  onClick={() => go("/merchant/orders")}
                >
                  <ShoppingBag size={16} aria-hidden="true" />
                  <span>Open orders</span>
                  <kbd>↵</kbd>
                </button>
              </div>
              <p className="orbit-command-hint text-xs text-muted-foreground p-3 border-t border-border/50">
                Press <kbd className="font-mono">ESC</kbd> to close
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
