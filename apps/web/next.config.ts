import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@shopify-clone/auth",
    "@shopify-clone/config",
    "@shopify-clone/db",
    "@shopify-clone/event-bus",
    "@shopify-clone/tenant",
    "@shopify-clone/types",
    "@shopify-clone/ui",
    "@shopify-clone/validation",
  ],
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
      ".cjs": [".cts", ".cjs"],
    };
    return config;
  },
};

export default nextConfig;
