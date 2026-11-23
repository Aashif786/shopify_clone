import os

app_dir = "/var/www/calcart"

# 1. next.config.ts
nc_path = os.path.join(app_dir, "apps/web/next.config.ts")
if os.path.exists(nc_path):
    with open(nc_path, "r", encoding="utf-8") as f:
        content = f.read()
    if 'outputFileTracingRoot' not in content:
        if 'import path from "node:path";' not in content:
            content = 'import path from "node:path";\nimport { fileURLToPath } from "node:url";\n' + content
            content = content.replace('const nextConfig: NextConfig = {', 'const __dirname = path.dirname(fileURLToPath(import.meta.url));\n\nconst nextConfig: NextConfig = {\n  outputFileTracingRoot: path.resolve(__dirname, "../../"),')
        else:
            content = content.replace('const nextConfig: NextConfig = {', 'const nextConfig: NextConfig = {\n  outputFileTracingRoot: path.resolve(__dirname, "../../"),')
    if 'basePath:' not in content:
        content = content.replace("const nextConfig: NextConfig = {", 'const nextConfig: NextConfig = {\n  basePath: "/calcart",')
    with open(nc_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("[patch] Updated next.config.ts with basePath and outputFileTracingRoot")

# 2. security-headers.ts
sh_path = os.path.join(app_dir, "apps/web/src/lib/security-headers.ts")
if os.path.exists(sh_path):
    with open(sh_path, "r", encoding="utf-8") as f:
        content = f.read()
    if 'static.cloudflareinsights.com' not in content:
        content = content.replace('"https://checkout.razorpay.com",', '"https://checkout.razorpay.com",\n    "https://static.cloudflareinsights.com",')
        content = content.replace('"https://lumberjack-cx.razorpay.com",', '"https://lumberjack-cx.razorpay.com",\n    "https://cloudflareinsights.com",\n    "https://*.cloudflareinsights.com",')
        content = content.replace('"https://checkout.razorpay.com",\n      "https://www.youtube.com"', '"https://checkout.razorpay.com",\n      "https://static.cloudflareinsights.com",\n      "https://www.youtube.com"')
        with open(sh_path, "w", encoding="utf-8") as f:
            f.write(content)
        print("[patch] Added Cloudflare Insights to security-headers.ts")

# 3. api-client.ts
ac_path = os.path.join(app_dir, "apps/web/src/lib/api-client.ts")
if os.path.exists(ac_path):
    with open(ac_path, "r", encoding="utf-8") as f:
        content = f.read()
    old_c = """  constructor(baseUrl: string = "") {
    this.baseUrl = baseUrl;
  }"""
    new_c = """  constructor(baseUrl?: string) {
    if (baseUrl !== undefined) {
      this.baseUrl = baseUrl;
    } else if (typeof window !== "undefined") {
      this.baseUrl = "/calcart";
    } else {
      this.baseUrl = "";
    }
  }"""
    if old_c in content:
        content = content.replace(old_c, new_c)
        old_execute = "let url = `${this.baseUrl}${endpoint}`;"
        new_execute = """const prefix = this.baseUrl;
    let url = (prefix && !endpoint.startsWith(prefix) && endpoint.startsWith("/")) ? `${prefix}${endpoint}` : `${prefix}${endpoint}`;"""
        content = content.replace(old_execute, new_execute)
        with open(ac_path, "w", encoding="utf-8") as f:
            f.write(content)
        print("[patch] Added /calcart baseUrl to api-client.ts")

# 4. design-theme-fonts.ts
dtf_path = os.path.join(app_dir, "apps/web/src/lib/design-theme-fonts.ts")
if os.path.exists(dtf_path):
    with open(dtf_path, "r", encoding="utf-8") as f:
        content = f.read()
    if 'preload: false' in content or 'axes: ["opsz"]' in content:
        content = content.replace('  preload: false,\n', '')
        content = content.replace('  axes: ["opsz"],\n', '')
        with open(dtf_path, "w", encoding="utf-8") as f:
            f.write(content)
        print("[patch] Removed problematic font options in design-theme-fonts.ts")
