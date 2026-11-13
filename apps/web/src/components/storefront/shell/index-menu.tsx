"use client";

import React from "react";

import Link from "next/link";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { CurrencySelector } from "../currency-selector";

export interface IndexMenuLink {
  label: string;
  href: string;
}

interface IndexMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The shell root. The popup is portalled into it so it inherits the merchant theme variables. */
  container: HTMLElement | null;
  storeName: string;
  navLinks: IndexMenuLink[];
  utilityLinks: IndexMenuLink[];
  showCurrency: boolean;
}

/**
 * Full-screen "index": the storefront's mobile/tablet navigation, set like a magazine
 * contents page. Base UI's Dialog supplies the focus trap, Escape handling, scroll lock
 * and aria wiring; the enter/exit is a 220ms opacity + 8px translate (composite only),
 * defined in globals.css under `.at-index`.
 */
export function IndexMenu({
  open,
  onOpenChange,
  container,
  storeName,
  navLinks,
  utilityLinks,
  showCurrency,
}: IndexMenuProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal container={container ?? undefined}>
        <Dialog.Popup className="at-index" data-testid="storefront-index-menu">
          <div className="at-container flex h-[var(--at-header-h)] shrink-0 items-center justify-between">
            <Dialog.Title className="at-eyebrow">{storeName} — Index</Dialog.Title>
            <Dialog.Close
              className="at-press -mr-2 inline-flex h-11 w-11 items-center justify-center text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              aria-label="Close navigation menu"
            >
              <X size={22} strokeWidth={1.5} aria-hidden="true" />
            </Dialog.Close>
          </div>

          <div className="at-container flex flex-1 flex-col pb-10">
            <nav aria-label="Storefront index" className="border-t border-[color:var(--at-hairline)]">
              <ol className="m-0 list-none p-0">
                {navLinks.map((link, i) => (
                  <li
                    key={link.href}
                    className="at-rise border-b border-[color:var(--at-hairline)]"
                    style={{ "--i": i } as React.CSSProperties}
                  >
                    <Link
                      href={link.href}
                      onClick={() => onOpenChange(false)}
                      className="group flex items-baseline gap-5 py-5 text-foreground"
                    >
                      <span className="at-eyebrow at-num w-6 shrink-0">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="at-display-md">{link.label}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </nav>

            <div className="mt-auto pt-10">
              <p className="at-eyebrow mb-4">Your account</p>
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {utilityLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={() => onOpenChange(false)}
                      className="flex min-h-11 items-center text-base text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
              {showCurrency && (
                <div className="mt-6 flex items-center justify-between border-t border-[color:var(--at-hairline)] pt-4">
                  <span className="at-eyebrow">Currency</span>
                  <CurrencySelector />
                </div>
              )}
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
