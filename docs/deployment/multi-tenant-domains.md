# Multi-Tenant Store Domains & DNS Deployment Guide

This guide details the deployment architecture, DNS configuration, and environment setup required to support merchant storefront subdomains (Phase 1) and custom domains (Phase 2) on Cal Cart.

---

## 1. Architecture Overview

Cal Cart uses Next.js App Router internal rewrites to seamlessly serve merchant storefronts from both subdomain URLs and legacy path URLs without code duplication:

- **Target Subdomain URL**: `https://<store-slug>.calcart.com/products`
- **Legacy Path URL**: `https://calcart.com/stores/<store-slug>/products`
- **Local Development**: `http://<store-slug>.localhost:3000/products` or `http://localhost:3000/stores/<store-slug>/products`

```
                          Client Request
                                |
               +----------------+----------------+
               |                                 |
     Host: store.calcart.com             Host: calcart.com
               |                                 |
      Next.js Middleware                Next.js Middleware
 (parseHostname + Tenant Isolation)    (Pass-through to apex)
               |                                 |
   Internal App Router Rewrite                   |
  -> /stores/store/products                      |
               |                                 |
        Storefront Page                   Landing/Admin Page
```

---

## 2. Vercel Configuration (Production)

To enable wildcard subdomain routing in Vercel:

### 2.1. Add Domains in Vercel Project Settings
1. Go to **Vercel Dashboard** → Select **Cal Cart Web Project** (`apps/web`).
2. Navigate to **Settings** → **Domains**.
3. Add the apex domain: `calcart.com` (Select "Recommended: Redirect to www" or direct apex as appropriate).
4. Add the wildcard domain: `*.calcart.com`.
5. Ensure the production branch (e.g. `main`) is assigned to both domains.

### 2.2. Configure DNS Records at Domain Registrar / DNS Provider
Create the following DNS records with your authoritative DNS provider (e.g., Cloudflare, Route 53, Namecheap):

| Type  | Name             | Value                    | TTL  | Proxy Status |
|-------|------------------|--------------------------|------|--------------|
| `A`   | `@`              | `76.76.21.21`            | Auto | DNS Only     |
| `CNAME` | `www`          | `cname.vercel-dns.com.`  | Auto | DNS Only     |
| `CNAME` | `*`            | `cname.vercel-dns.com.`  | Auto | DNS Only     |

> [!IMPORTANT]
> If using Cloudflare DNS, set the Proxy status to **DNS only (Grey Cloud)** for the wildcard `*` record so Vercel can automatically issue and renew the Let's Encrypt wildcard SSL certificate for `*.calcart.com`.

---

## 3. Environment Variables

Configure the following environment variables in Vercel and local `.env`:

```env
# Server-side platform apex domain
PLATFORM_DOMAIN=calcart.com

# Client-accessible platform apex domain
NEXT_PUBLIC_PLATFORM_DOMAIN=calcart.com
```

- When `PLATFORM_DOMAIN` is omitted, the platform defaults to `calcart.com`.
- In staging or preview environments, set `PLATFORM_DOMAIN=staging.calcart.com` to prevent collisions.

---

## 4. Local Development & Testing

Modern browsers (Chrome, Edge, Firefox, Brave) treat `*.localhost` as resolving to `127.0.0.1` automatically by RFC 6761 without modifying `/etc/hosts`.

### 4.1. Browser Testing via `*.localhost`
1. Start the development server:
   ```bash
   pnpm dev
   ```
2. In your browser, navigate directly to:
   ```text
   http://souled-store.localhost:3000
   http://souled-store.localhost:3000/products
   http://souled-store.localhost:3000/cart
   ```
3. Test platform apex pass-through:
   ```text
   http://localhost:3000/stores/souled-store
   http://localhost:3000/merchant/domains
   ```

### 4.2. Testing via Windows Hosts File (Optional)
If testing a custom test domain (e.g., `teststore.local`):
1. Open Notepad as Administrator.
2. Open `C:\Windows\System32\drivers\etc\hosts`.
3. Add:
   ```text
   127.0.0.1   teststore.local
   127.0.0.1   alpha.teststore.local
   ```
4. Set `PLATFORM_DOMAIN=teststore.local` in `.env.local` and restart the dev server.

---

## 5. Security & Tenant Boundary Protections

1. **Server-Side Host Header Parsing**:
   The host header is normalized and parsed on the server using `parseHostname` in `@shopify-clone/tenant`. Port numbers, trailing dots, and invalid characters are sanitized.

2. **Reserved Infrastructure Subdomains**:
   The following hostnames are strictly reserved and never resolved as merchant stores:
   - `www`, `app`, `admin`, `api`, `dashboard`, `auth`, `login`, `signup`, `static`, `assets`, `cdn`, `mail`, `status`, `portal`, `checkout`, `pay`, `staging`, `dev`, `test`, `demo`.

3. **Cross-Tenant Subdomain Traversal Prevention**:
   If a user visits `https://store-a.calcart.com/stores/store-b/...`, middleware intercepts the cross-tenant mismatch and redirects the client to `/` on `store-a`, preventing tenant leakage.

4. **Preserved Storefront Capabilities**:
   Because Next.js internal rewrites route subdomain traffic to the underlying App Router page controllers, all existing server components, client components, cart session contexts, and catalog APIs continue to function with full fidelity.

---

## 6. Phase 2: Custom Domains Preview & Limitations

### 6.1. Current Phase 1 Scope
Phase 1 implements:
- Database schema (`store_domains` table) storing subdomain and custom domain records.
- Middleware hostname parsing and rewriting for platform subdomains.
- Merchant dashboard `/merchant/domains` page displaying the assigned subdomain, verification status, and DNS connection guides.
- Automatic default subdomain allocation on new store creation.

### 6.2. Phase 2 Custom Domain Requirements
Connecting arbitrary merchant-owned apex or subdomains (e.g., `shop.brand.com` or `brand.com`) requires:
1. **Dynamic SSL Termination**:
   - Integration with Vercel's Custom Domains API (`POST /v9/projects/{projectId}/domains`), or
   - Reverse-proxy SSL issuance via Cloudflare for SaaS (SSL for SaaS custom hostnames) or Caddy with on-demand TLS.
2. **DNS Verification**:
   - CNAME record pointing to `cname.calcart.com` or `cname.vercel-dns.com`.
   - TXT ownership verification token (`_calcart-challenge.brand.com`).
3. **Database Domain Resolution**:
   - Middleware or Edge Config resolving `CUSTOM` domain records from `store_domains` where `status = 'ACTIVE'` and `verified_at IS NOT NULL`.
