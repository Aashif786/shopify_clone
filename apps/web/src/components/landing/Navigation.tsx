"use client";

import React, {  useState, useEffect  } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon, Menu, X, ArrowUpRight } from "lucide-react";
import Link from "next/link";

const STORAGE_KEY = "shopify-clone-theme";

const navLinks = [
  { label: "Platform", href: "#platform" },
  { label: "Storefront", href: "/stores/souled-store" },
  { label: "Operations", href: "#operations" },
  { label: "Growth", href: "#growth" },
];

export default function Navigation() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const darkModeActive = saved !== "light";
    setIsDark(darkModeActive);
    document.documentElement.classList.toggle("dark", darkModeActive);
    document.documentElement.classList.toggle("light", !darkModeActive);

    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    const nextMode = nextDark ? "dark" : "light";
    window.localStorage.setItem(STORAGE_KEY, nextMode);
    document.documentElement.classList.toggle("dark", nextDark);
    document.documentElement.classList.toggle("light", !nextDark);
  };

  return (
    <>
      <motion.header
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled
            ? "bg-[var(--bg-primary)]/90 backdrop-blur-xl border-b border-[var(--border)] py-3 shadow-sm"
            : "py-5 sm:py-6"
        }`}
      >
        <div className="max-w-[1400px] mx-auto px-6 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 focus:outline-none">
            <motion.div
              className="w-8 h-8 rounded-lg bg-gradient-to-br from-cobalt-600 to-violet-600 flex items-center justify-center shadow-md shadow-cobalt-600/30"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <span className="text-white font-bold text-sm font-display tracking-wider">C</span>
            </motion.div>
            <span className="font-display font-800 text-lg tracking-tight text-[var(--text-primary)]">
              Cal Cart
            </span>
          </Link>

          {/* Desktop nav links */}
          <nav className="nova-nav-links hidden md:flex items-center gap-8" aria-label="Main Navigation">
            {navLinks.map((link) => (
              <motion.a
                key={link.label}
                href={link.href}
                className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors duration-200 font-medium"
                whileHover={{ y: -1 }}
              >
                {link.label}
              </motion.a>
            ))}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Theme Toggle Button */}
            <div className="nova-theme-toggle">
              <motion.button
                type="button"
                onClick={toggleTheme}
                className="theme-mode-toggle w-9 h-9 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-muted)] border border-[var(--border)] transition-all duration-200 cursor-pointer"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
                title={`Switch to ${isDark ? "light" : "dark"} mode`}
              >
                {isDark ? <Sun size={15} /> : <Moon size={15} />}
              </motion.button>
            </div>

            {/* Merchant Sign In */}
            <Link
              href="/merchant/login"
              className="hidden lg:inline-flex items-center text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] px-3 py-2 rounded-full hover:bg-[var(--bg-muted)] transition-colors"
            >
              Sign In
            </Link>

            {/* Start Free Button */}
            <Link
              href="/merchant/register"
              className="hidden sm:inline-flex items-center gap-1.5 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)] text-xs sm:text-sm font-semibold font-display shadow-sm hover:opacity-90 transition-all duration-200"
            >
              <span>Start free</span>
              <ArrowUpRight size={14} className="opacity-70" />
            </Link>

            {/* Mobile Hamburger Button */}
            <button
              type="button"
              className="nova-mobile-toggle md:hidden w-9 h-9 flex items-center justify-center rounded-full text-[var(--text-primary)] border border-[var(--border)] bg-[var(--bg-secondary)] cursor-pointer"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle mobile menu"
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </motion.header>

      {/* Mobile Menu Drawer */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-40 bg-[var(--bg-primary)] pt-24 px-6 md:hidden flex flex-col justify-between pb-10"
          >
            <nav className="nova-nav-links is-open flex flex-col gap-6" aria-label="Mobile Navigation">
              {navLinks.map((link, i) => (
                <motion.a
                  key={link.label}
                  href={link.href}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="text-2xl font-display font-700 text-[var(--text-primary)] hover:text-cobalt-500 transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </motion.a>
              ))}

              <div className="h-px bg-[var(--border)] my-2" />

              <Link
                href="/merchant/login"
                className="text-lg font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                Merchant Sign In
              </Link>
            </nav>

            <div className="space-y-4 pt-6 border-t border-[var(--border)]">
              <Link
                href="/merchant/register"
                onClick={() => setMenuOpen(false)}
                className="flex items-center justify-center gap-2 w-full px-6 py-3.5 rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)] text-sm font-semibold font-display shadow-md"
              >
                <span>Start free</span>
                <ArrowUpRight size={15} />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
