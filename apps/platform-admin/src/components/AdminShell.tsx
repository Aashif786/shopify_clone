"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Store,
  Users,
  CreditCard,
  Receipt,
  BarChart3,
  Activity,
  ShieldAlert,
  Sliders,
  Search,
  LogOut,
  Bell,
  Menu,
  X,
  Radio,
  FileText,
} from "lucide-react";
import { GlobalSearchModal } from "./GlobalSearchModal";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AdminShellProps {
  children: React.ReactNode;
}

export function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [incidentsCount, setIncidentsCount] = useState<number>(0);
  const [healthStatus, setHealthStatus] = useState<"HEALTHY" | "DEGRADED" | "ATTENTION">("HEALTHY");

  // Fetch admin profile
  useEffect(() => {
    fetch("/api/platform/auth/me")
      .then((res) => {
        if (!res.ok) {
          if (pathname !== "/login") router.push("/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.data?.admin) setAdmin(data.data.admin);
      })
      .catch(() => {
        if (pathname !== "/login") router.push("/login");
      });

    // Check health & incidents
    fetch("/api/platform/operations/health")
      .then((res) => res.json())
      .then((data) => {
        if (data?.data) {
          setIncidentsCount(data.data.incidents?.length ?? 0);
          setHealthStatus(data.data.worker?.status ?? "HEALTHY");
        }
      })
      .catch(() => {});
  }, [pathname, router]);

  // Keyboard shortcut for Command+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleLogout = async () => {
    await fetch("/api/platform/auth/logout", { method: "POST" });
    router.push("/login");
  };

  if (pathname === "/login") {
    return <>{children}</>;
  }

  const navGroups = [
    {
      group: "Overview",
      items: [
        { label: "Command Center", href: "/dashboard", icon: LayoutDashboard },
        { label: "Commerce Analytics", href: "/analytics", icon: BarChart3 },
      ],
    },
    {
      group: "Ecosystem & Tenancy",
      items: [
        { label: "Organizations & Tenants", href: "/tenants", icon: Building2 },
        { label: "Stores Directory", href: "/stores", icon: Store },
        { label: "Merchants & Users", href: "/merchants", icon: Users },
      ],
    },
    {
      group: "Financial Operations",
      items: [
        { label: "Payments & Reconciliation", href: "/payments", icon: CreditCard },
        { label: "Subscriptions & Billing", href: "/subscriptions", icon: Receipt },
      ],
    },
    {
      group: "Operations & Reliability",
      items: [
        {
          label: "Operations & Incidents",
          href: "/operations",
          icon: Activity,
          badge: incidentsCount > 0 ? incidentsCount : undefined,
        },
        { label: "Security & Sessions", href: "/security", icon: ShieldAlert },
        { label: "Audit Trail", href: "/audit-logs", icon: FileText },
      ],
    },
    {
      group: "Governance",
      items: [
        { label: "Feature Flags & Settings", href: "/governance", icon: Sliders },
      ],
    },
  ];

  return (
    <div className="flex min-h-screen bg-[#06090e] text-slate-100 font-sans antialiased">
      <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-18"
        } fixed inset-y-0 left-0 z-40 flex flex-col border-r border-white/10 bg-[#0c111c] transition-all duration-200 select-none`}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-white/10">
          <Link href="/dashboard" className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white font-bold tracking-wider shadow-lg shadow-blue-500/20">
              CC
            </div>
            {sidebarOpen && (
              <div className="flex flex-col">
                <span className="text-sm font-semibold tracking-tight text-white">
                  Cal Cart
                </span>
                <span className="text-[10px] font-mono text-blue-400 uppercase tracking-widest">
                  Control Center
                </span>
              </div>
            )}
          </Link>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
          >
            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {navGroups.map((group) => (
            <div key={group.group}>
              {sidebarOpen && (
                <div className="px-3 mb-2 text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  {group.group}
                </div>
              )}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        isActive
                          ? "bg-blue-600/15 border border-blue-500/30 text-white"
                          : "text-slate-400 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-blue-400" : ""}`} />
                      {sidebarOpen && <span className="truncate">{item.label}</span>}
                      {sidebarOpen && item.badge !== undefined && (
                        <span className="ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-rose-500/20 text-rose-400 border border-rose-500/30">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Administrator Profile Footer */}
        <div className="p-3 border-t border-white/10 bg-[#090d16]">
          <div className="flex items-center justify-between">
            {sidebarOpen ? (
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-xs font-semibold text-slate-200">
                  {admin?.name?.charAt(0) || "A"}
                </div>
                <div className="flex flex-col truncate">
                  <span className="text-xs font-medium text-white truncate">
                    {admin?.name || "Platform Admin"}
                  </span>
                  <span className="text-[10px] text-blue-400 font-mono uppercase truncate">
                    {admin?.role || "SUPER_ADMIN"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs text-white">
                {admin?.name?.charAt(0) || "A"}
              </div>
            )}
            <button
              onClick={handleLogout}
              title="Logout session"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col ${sidebarOpen ? "ml-64" : "ml-18"} transition-all duration-200`}>
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/10 bg-[#0c111c]/80 backdrop-blur-md px-6">
          {/* Quick Search Button */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 text-xs hover:border-white/20 hover:text-white transition-all w-72"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="flex-1 text-left">Quick jump or search...</span>
            <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono text-slate-300">
              ⌘K
            </kbd>
          </button>

          {/* Right Top Status Controls */}
          <div className="flex items-center gap-4">
            {/* Live System Pipeline Pill */}
            <div
              onClick={() => router.push("/operations")}
              className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs cursor-pointer hover:border-white/20 transition-all"
            >
              <Radio
                className={`w-3.5 h-3.5 ${
                  healthStatus === "HEALTHY"
                    ? "text-emerald-400"
                    : healthStatus === "DEGRADED"
                    ? "text-amber-400 animate-pulse"
                    : "text-rose-400 animate-ping"
                }`}
              />
              <span className="text-[11px] font-mono text-slate-300 uppercase">
                Pipeline: {healthStatus}
              </span>
            </div>

            {/* Incidents Indicator */}
            <button
              onClick={() => router.push("/operations")}
              className="relative p-2 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <Bell className="w-4 h-4" />
              {incidentsCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              )}
            </button>
          </div>
        </header>

        {/* Page Content Body */}
        <main className="flex-1 p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
