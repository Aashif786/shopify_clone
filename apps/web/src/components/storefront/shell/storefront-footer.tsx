import React from "react";
import Link from "next/link";
import { Lock } from "lucide-react";

export interface FooterLink {
  label: string;
  href: string;
}

interface StorefrontFooterProps {
  storeName: string;
  shopLinks: FooterLink[];
  accountLinks: FooterLink[];
}

/**
 * Colophon-style footer: the store name set large as the closing mark, with two quiet
 * link columns and the payment note. Only states what is true of the platform
 * (payments are processed by Razorpay); no invented guarantees or badges.
 */
export function StorefrontFooter({ storeName, shopLinks, accountLinks }: StorefrontFooterProps) {
  return (
    <footer
      className="storefront-footer mt-24 w-full border-t border-[color:var(--at-hairline)] pb-8 pt-14 lg:mt-32 lg:pt-20"
      role="contentinfo"
    >
      <div className="at-container">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
          <p className="at-display-lg m-0 lg:col-span-6">{storeName}</p>

          <nav aria-label="Shop" className="lg:col-span-2 lg:col-start-8">
            <h2 className="at-eyebrow mb-4">Shop</h2>
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-sm">
              {shopLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="at-link text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Account and orders" className="lg:col-span-2">
            <h2 className="at-eyebrow mb-4">Account</h2>
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-sm">
              {accountLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="at-link text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-[color:var(--at-hairline)] pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            &copy; {new Date().getFullYear()} {storeName}
          </span>
          <span className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="inline-flex items-center gap-1.5">
              <Lock size={11} strokeWidth={1.5} aria-hidden="true" />
              Payments processed by Razorpay
            </span>
            <span>Powered by Cal Cart</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
