import type { Metadata } from "next";
import "./globals.css";
import { AdminShell } from "@/components/AdminShell";

export const metadata: Metadata = {
  title: "Cal Cart Control Center",
  description: "Enterprise Platform Administration and SaaS Command Center",
};

const themeScript = `
  (function() {
    try {
      var stored = localStorage.getItem('calcart-platform-theme');
      var theme = stored === 'light' ? 'light' : 'dark';
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(theme);
      document.documentElement.setAttribute('data-theme', theme);
    } catch (e) {}
  })();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-[#06090e] text-slate-100 antialiased transition-colors duration-200">
        <AdminShell>{children}</AdminShell>
      </body>
    </html>
  );
}

