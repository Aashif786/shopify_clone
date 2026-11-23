import os

app_dir = "/var/www/calcart"

# 1. next.config.ts
nc_path = os.path.join(app_dir, "apps/web/next.config.ts")
if os.path.exists(nc_path):
    with open(nc_path, "r", encoding="utf-8") as f:
        content = f.read()
    if 'basePath:' not in content:
        content = content.replace("const nextConfig: NextConfig = {", 'const nextConfig: NextConfig = {\n  basePath: "/calcart",')
        with open(nc_path, "w", encoding="utf-8") as f:
            f.write(content)
        print("[patch] Added basePath to next.config.ts")

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
