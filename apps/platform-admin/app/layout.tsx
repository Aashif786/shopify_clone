import type { Metadata } from "next";
import "./globals.css";
import { AdminShell } from "@/components/AdminShell";

export const metadata: Metadata = {
  title: "Cal Cart Control Center",
  description: "Enterprise Platform Administration and SaaS Command Center",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#06090e] text-slate-100 antialiased">
        <AdminShell>{children}</AdminShell>
      </body>
    </html>
  );
}
