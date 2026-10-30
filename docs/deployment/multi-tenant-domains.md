# Multi-Tenant Store Domains & DNS Deployment Guide

This guide details the deployment architecture, DNS configuration, and environment setup required to support merchant storefront platform subdomains (Phase 1) and custom branded domains (Phase 2) on Cal Cart.

---

## 1. Architecture Overview

Cal Cart uses Next.js App Router internal rewrites to seamlessly serve merchant storefronts from both custom domains, platform subdomains, and legacy path URLs without code duplication:

- **Target Custom Domain**: `https://shop.yourbrand.com/products` or `https://yourbrand.com/products`
- **Target Platform Subdomain**: `https://<store-slug>.calcart.com/products`
- **Legacy Path URL**: `https://calcart.com/stores/<store-slug>/products`
- **Local Development**: `http://<store-slug>.localhost:3000/products` or `http://localhost:3000/stores/<store-slug>/products`

```
                                  Client Request
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        │                                │                                │
Host: shop.brand.com           Host: store.calcart.com             Host: calcart.com
(Verified Custom Domain)      (Platform Subdomain)               (Platform Apex)
        │                                │                                │
 Next.js Middleware               Next.js Middleware             Next.js Middleware
 (Custom Domain Cache &          (parseHostname & Subdomain      (Pass-through to Apex
  Store Identity Resolution)      Tenant Isolation)               Landing & Admin)
        │                                │                                │
  Internal Rewrite                 Internal Rewrite                       │
  -> /stores/[slug]/products       -> /stores/[slug]/products             │
        │                                │                                │
        └────────────────────────────────┴────────────────────────────────┘
                                         │
                             Storefront Page / Catalog
```

---

## 2. Environment Variables

Configure the following environment variables in Vercel and your production `.env`:

```env
# Platform Apex Domain Configuration
PLATFORM_DOMAIN=calcart.com
NEXT_PUBLIC_PLATFORM_DOMAIN=calcart.com

# Vercel Custom Domains API Integration (Optional / Production)
# Required only if you want Cal Cart to automatically register merchant custom domains
# and provision wildcard/on-demand Let's Encrypt SSL certificates via Vercel.
VERCEL_AUTH_TOKEN=your_vercel_api_token
VERCEL_PROJECT_ID=your_vercel_project_id
VERCEL_TEAM_ID=team_xxxxxxxxxxxx  # Optional: required only for team/pro accounts
```

- When `VERCEL_AUTH_TOKEN` and `VERCEL_PROJECT_ID` are configured, Cal Cart calls `POST https://api.vercel.com/v9/projects/{projectId}/domains` upon merchant domain registration and queries `https://api.vercel.com/v9/projects/{projectId}/domains/{domain}/verify` for automated TLS issuance.
- When credentials are not configured, Cal Cart automatically generates authoritative DNS instructions (`cname.vercel-dns.com` for subdomains, `76.76.21.21` for apex, plus ownership TXT challenges) and verifies records directly via native public DNS lookups.

---

## 3. Vercel Project & DNS Configuration

### 3.1. Platform Apex & Wildcard Routing
1. Go to **Vercel Dashboard** → Select **Cal Cart Web Project** (`apps/web`).
2. Navigate to **Settings** → **Domains**.
3. Add the apex domain: `calcart.com`.
4. Add the wildcard domain: `*.calcart.com`.
5. Ensure the production branch (e.g., `main`) is assigned to both.

### 3.2. Authoritative DNS Records at Domain Registrar
Configure the following records with your authoritative DNS provider (Cloudflare, Route 53, Namecheap, etc.):

| Type    | Name             | Value                    | TTL  | Proxy Status | Purpose                       |
|---------|------------------|--------------------------|------|--------------|-------------------------------|
| `A`     | `@`              | `76.76.21.21`            | Auto | DNS Only     | Platform apex routing         |
| `CNAME` | `www`            | `cname.vercel-dns.com.`  | Auto | DNS Only     | WWW redirect/routing          |
| `CNAME` | `*`              | `cname.vercel-dns.com.`  | Auto | DNS Only     | Wildcard merchant subdomains  |

---

## 4. Merchant Custom Domain Configuration

Merchants connect their custom domains directly in the merchant dashboard under **Store & Team → Domains** (`/merchant/domains`).

### 4.1. For Subdomains (e.g. `shop.brand.com` or `www.brand.com`)
The merchant adds a `CNAME` record in their registrar:
- **Type**: `CNAME`
- **Host / Name**: `shop` (or `www`)
- **Target / Value**: `cname.vercel-dns.com`
- **TTL**: Auto / 3600

### 4.2. For Apex Root Domains (e.g. `brand.com`)
The merchant points their apex domain to the platform infrastructure:
- **Type**: `A`
- **Host / Name**: `@` (or leave blank depending on registrar)
- **Target / Value**: `76.76.21.21`
- **TTL**: Auto / 3600

### 4.3. Ownership Verification (TXT Record)
To prevent domain hijacking, an ownership verification challenge is issued:
- **Type**: `TXT`
- **Host / Name**: `_calcart-challenge.yourbrand.com`
- **Value**: `calcart-verify-<store-hash>`

---

## 5. Security & Tenant Boundary Protections

1. **Host Header Normalization**:
   Sanitizes input protocols, ports, trailing dots, and casing on the server via `@shopify-clone/tenant`.

2. **Reserved Hostnames**:
   Hostnames such as `www`, `app`, `admin`, `api`, `auth`, `checkout`, `dashboard`, `mail`, `status`, etc., can never be registered or resolved as merchant stores.

3. **Global Domain Uniqueness**:
   Database-enforced unique constraints prevent any custom domain from being connected to more than one store across the entire platform.

4. **Cross-Tenant Subdomain Traversal Prevention**:
   If a client requests `https://store-a.calcart.com/stores/store-b/...`, middleware intercepts the cross-tenant mismatch and redirects to `https://store-a.calcart.com/`.

5. **Primary Domain Fallback**:
   Disconnecting a custom domain automatically and transactionally reverts the primary domain to the platform-provided default subdomain (`<slug>.calcart.com`), ensuring the storefront remains 100% accessible. Default platform subdomains cannot be deleted.

6. **Cookie Isolation**:
   Storefront sessions and guest tokens utilize store-scoped cookie keys (`sc_<storeSlug>_guest_id`, `sc_<storeSlug>_guest_token`), preventing cross-store session pollution across disparate custom hostnames.

---

## 6. Local Development & Testing

Modern browsers treat `*.localhost` as resolving to `127.0.0.1` by RFC 6761 without modifying `/etc/hosts`.

### 6.1. Browser Testing via `*.localhost`
1. Start development server:
   ```bash
   pnpm dev
   ```
2. Navigate directly to:
   ```text
   http://souled-store.localhost:3000
   http://souled-store.localhost:3000/products
   http://localhost:3000/merchant/domains
   ```

### 6.2. Custom Domain Testing via Windows Hosts File
To simulate a live custom domain locally:
1. Open Notepad as Administrator.
2. Open `C:\Windows\System32\drivers\etc\hosts`.
3. Add:
   ```text
   127.0.0.1   shop.mytestbrand.local
   ```
4. Connect `shop.mytestbrand.local` in `/merchant/domains`.
5. In development, point your browser to `http://shop.mytestbrand.local:3000`.
