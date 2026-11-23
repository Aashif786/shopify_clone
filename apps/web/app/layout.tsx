import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Geist, IBM_Plex_Mono, Manrope } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-display" });
const ibmPlexMono = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["400", "500", "600"] });

export const viewport: Viewport = {
  themeColor: "#101116",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Cal Cart — Commerce in motion",
  description: "A connected commerce operating system for products, storefronts, inventory, and orders.",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", geist.variable, manrope.variable, ibmPlexMono.variable)}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(() => { try { const t = localStorage.getItem("calcart-theme") === "light" ? "light" : "dark"; document.documentElement.classList.add(t); } catch (_) { document.documentElement.classList.add("dark"); } })()` }} />
        <script dangerouslySetInnerHTML={{ __html: `(() => {
          // Automatic recovery for stale chunks after production deployments
          function reloadOnChunkFailure(message) {
            if (/Loading chunk [\\d]+ failed|ChunkLoadError|Failed to fetch dynamically imported module/i.test(message)) {
              try {
                var key = "calcart_chunk_reload_ts";
                var last = sessionStorage.getItem(key);
                var now = Date.now();
                if (!last || now - parseInt(last, 10) > 10000) {
                  sessionStorage.setItem(key, String(now));
                  window.location.reload();
                }
              } catch (_) {
                window.location.reload();
              }
            }
          }
          window.addEventListener("error", function(e) {
            reloadOnChunkFailure(e && e.message ? e.message : "");
          }, true);
          window.addEventListener("unhandledrejection", function(e) {
            var reason = e && e.reason;
            var msg = (reason && reason.message) || (typeof reason === "string" ? reason : "");
            reloadOnChunkFailure(msg);
          });
        })()` }} />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
