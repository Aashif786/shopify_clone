import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@calcart/auth",
    "@calcart/config",
    "@calcart/db",
    "@calcart/email",
    "@calcart/platform-admin",
    "@calcart/tenant",
    "@calcart/types",
    "@calcart/ui",
    "@calcart/validation",
  ],
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-Platform-Admin-Portal",
            value: "Cal Cart Control Center",
          },
        ],
      },
    ];
  },
  webpack: (config, { dev }) => {
    config.resolve = config.resolve || {};
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
      ".cjs": [".cts", ".cjs"],
    };

    if (dev) {
      config.watchOptions = {
        ignored: ["**/node_modules/**", "**/.git/**", "**/.next/**"],
      };
    }

    return config;
  },
};

export default nextConfig;
