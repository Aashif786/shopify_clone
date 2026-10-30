import { promises as dnsPromises } from "node:dns";
import type {
  StoreDnsInstruction,
  StoreDomainSslStatus,
  StoreVerificationChallenge,
} from "../domain/entities.js";

export interface DomainProviderConfig {
  vercelAuthToken?: string;
  vercelProjectId?: string;
  vercelTeamId?: string;
  platformDomain?: string;
}

export interface RegisterDomainResult {
  verificationChallenge: StoreVerificationChallenge | null;
  dnsInstructions: StoreDnsInstruction[];
  errorReason: string | null;
}

export interface VerifyDomainResult {
  verified: boolean;
  sslStatus: StoreDomainSslStatus;
  dnsInstructions?: StoreDnsInstruction[];
  error?: string;
}

interface VercelDomainResponse {
  error?: { message?: string };
  verification?: Array<{ type?: string; domain?: string; value?: string; reason?: string }>;
  verified?: boolean;
  misconfigured?: boolean;
}

export class DomainProvider {
  private readonly authToken?: string;
  private readonly projectId?: string;
  private readonly teamId?: string;
  private readonly platformDomain: string;

  constructor(config?: DomainProviderConfig) {
    this.authToken =
      config?.vercelAuthToken ||
      process.env.VERCEL_AUTH_TOKEN ||
      process.env.VERCEL_TOKEN;
    this.projectId =
      config?.vercelProjectId ||
      process.env.VERCEL_PROJECT_ID;
    this.teamId =
      config?.vercelTeamId ||
      process.env.VERCEL_TEAM_ID;
    this.platformDomain =
      config?.platformDomain ||
      process.env.PLATFORM_DOMAIN ||
      process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ||
      "calcart.com";
  }

  getPlatformDomain(): string {
    return this.platformDomain;
  }

  isProviderConfigured(): boolean {
    return Boolean(this.authToken && this.projectId);
  }

  /**
   * Determine whether a hostname is an apex domain (e.g., example.com)
   * or a subdomain (e.g., shop.example.com, www.example.com).
   */
  isApexDomain(domain: string): boolean {
    const parts = domain.split(".").filter(Boolean);
    return parts.length <= 2;
  }

  /**
   * Register domain with hosting provider or generate authoritative DNS instructions.
   */
  async registerCustomDomain(
    domain: string,
    storeId: string,
  ): Promise<RegisterDomainResult> {
    const normalized = domain.toLowerCase().trim();

    // 1. If Vercel API credentials are provided, register with Vercel Custom Domains API
    if (this.isProviderConfigured()) {
      try {
        const teamParam = this.teamId ? `?teamId=${encodeURIComponent(this.teamId)}` : "";
        const url = `https://api.vercel.com/v9/projects/${this.projectId}/domains${teamParam}`;

        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.authToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: normalized }),
        });

        const data = (await res.json().catch(() => ({}))) as VercelDomainResponse;

        if (!res.ok) {
          const errorMessage =
            data?.error?.message || `Vercel API error (${res.status}): ${res.statusText}`;
          return {
            verificationChallenge: null,
            dnsInstructions: this.generateStandardDnsInstructions(normalized, storeId),
            errorReason: errorMessage,
          };
        }

        const verificationChallenge =
          Array.isArray(data.verification) && data.verification.length > 0
            ? {
                type: data.verification[0].type || "TXT",
                domain: data.verification[0].domain || `_vercel.${normalized}`,
                value: data.verification[0].value || "",
                reason: data.verification[0].reason || "pending_token",
              }
            : null;

        const dnsInstructions = this.generateStandardDnsInstructions(normalized, storeId);
        if (verificationChallenge) {
          dnsInstructions.push({
            type: "TXT",
            name: verificationChallenge.domain,
            value: verificationChallenge.value,
            recommended: true,
            status: "PENDING",
          });
        }

        return {
          verificationChallenge,
          dnsInstructions,
          errorReason: null,
        };
      } catch (err) {
        return {
          verificationChallenge: null,
          dnsInstructions: this.generateStandardDnsInstructions(normalized, storeId),
          errorReason:
            err instanceof Error
              ? `Failed to communicate with Vercel API: ${err.message}`
              : "Vercel API request failed",
        };
      }
    }

    // 2. Provider not configured: Generate standard authoritative DNS instructions
    return {
      verificationChallenge: {
        type: "TXT",
        domain: `_calcart-challenge.${normalized}`,
        value: `calcart-verify-${storeId.replace(/-/g, "").slice(0, 16)}`,
        reason: "domain_ownership_challenge",
      },
      dnsInstructions: this.generateStandardDnsInstructions(normalized, storeId),
      errorReason: null,
    };
  }

  /**
   * Verify domain ownership, DNS routing, and SSL status.
   * Performs real verification via Vercel API or authoritative public DNS lookup.
   */
  async verifyCustomDomain(
    domain: string,
    existingChallenge?: StoreVerificationChallenge | null,
  ): Promise<VerifyDomainResult> {
    const normalized = domain.toLowerCase().trim();

    // 1. If Vercel API is configured: query Vercel verification & domain config
    if (this.isProviderConfigured()) {
      try {
        const teamParam = this.teamId ? `?teamId=${encodeURIComponent(this.teamId)}` : "";
        
        // Step A: Trigger verification check
        const verifyRes = await fetch(
          `https://api.vercel.com/v9/projects/${this.projectId}/domains/${normalized}/verify${teamParam}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${this.authToken}`,
            },
          },
        );
        const verifyData = (await verifyRes.json().catch(() => ({}))) as VercelDomainResponse;

        // Step B: Fetch domain config / SSL status
        const configRes = await fetch(
          `https://api.vercel.com/v9/projects/${this.projectId}/domains/${normalized}/config${teamParam}`,
          {
            headers: {
              Authorization: `Bearer ${this.authToken}`,
            },
          },
        );
        const configData = (await configRes.json().catch(() => ({}))) as VercelDomainResponse;

        if (verifyData.verified && !configData.misconfigured) {
          return {
            verified: true,
            sslStatus: "ACTIVE",
          };
        }

        const reason =
          verifyData?.error?.message ||
          (configData.misconfigured
            ? `DNS misconfiguration detected for ${normalized}. Ensure CNAME or A records point correctly.`
            : "Domain ownership verification is still pending at Vercel.");

        return {
          verified: false,
          sslStatus: "PENDING",
          error: reason,
        };
      } catch (err) {
        return {
          verified: false,
          sslStatus: "ERROR",
          error:
            err instanceof Error
              ? `Vercel verification failed: ${err.message}`
              : "Verification request failed",
        };
      }
    }

    // 2. Real Public DNS Verification (Native DNS Query)
    return await this.performRealDnsVerification(normalized, existingChallenge);
  }

  /**
   * Remove domain from hosting provider.
   */
  async removeCustomDomain(domain: string): Promise<{ success: boolean; error?: string }> {
    const normalized = domain.toLowerCase().trim();

    if (this.isProviderConfigured()) {
      try {
        const teamParam = this.teamId ? `?teamId=${encodeURIComponent(this.teamId)}` : "";
        const res = await fetch(
          `https://api.vercel.com/v9/projects/${this.projectId}/domains/${normalized}${teamParam}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${this.authToken}`,
            },
          },
        );
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as VercelDomainResponse;
          return {
            success: false,
            error: data?.error?.message || `Vercel removal returned ${res.status}`,
          };
        }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : "Failed to remove domain from Vercel",
        };
      }
    }

    return { success: true };
  }

  /**
   * Helper: Generate standard DNS instructions based on apex vs subdomain.
   */
  generateStandardDnsInstructions(
    domain: string,
    storeId: string,
  ): StoreDnsInstruction[] {
    const isApex = this.isApexDomain(domain);
    const token = `calcart-verify-${storeId.replace(/-/g, "").slice(0, 16)}`;

    if (isApex) {
      return [
        {
          type: "A",
          name: "@",
          value: "76.76.21.21",
          recommended: true,
          status: "PENDING",
        },
        {
          type: "TXT",
          name: `_calcart-challenge.${domain}`,
          value: token,
          recommended: true,
          status: "PENDING",
        },
      ];
    }

    // Subdomain (e.g., shop.example.com or www.example.com)
    const hostPart = domain.split(".")[0] || domain;
    return [
      {
        type: "CNAME",
        name: hostPart,
        value: "cname.vercel-dns.com",
        recommended: true,
        status: "PENDING",
      },
      {
        type: "TXT",
        name: `_calcart-challenge.${domain}`,
        value: token,
        recommended: false,
        status: "PENDING",
      },
    ];
  }

  /**
   * Helper: Real DNS query using node:dns/promises to inspect live DNS records.
   */
  private async performRealDnsVerification(
    domain: string,
    challenge?: StoreVerificationChallenge | null,
  ): Promise<VerifyDomainResult> {
    const isApex = this.isApexDomain(domain);

    try {
      // Check 1: CNAME record verification
      if (!isApex) {
        try {
          const cnames = await dnsPromises.resolveCname(domain);
          const hasVercelCname = cnames.some((c) =>
            c.toLowerCase().includes("vercel-dns.com") ||
            c.toLowerCase().includes("calcart.com") ||
            c.toLowerCase().includes("vercel.app")
          );

          if (hasVercelCname) {
            return {
              verified: true,
              sslStatus: "ACTIVE",
            };
          }
        } catch {
          // Fall through to A record and TXT checks
        }
      }

      // Check 2: A record verification
      try {
        const aRecords = await dnsPromises.resolve4(domain);
        const hasVercelIp = aRecords.includes("76.76.21.21");

        if (hasVercelIp) {
          return {
            verified: true,
            sslStatus: "ACTIVE",
          };
        }
      } catch {
        // Fall through to TXT challenge check
      }

      // Check 3: TXT challenge verification
      if (challenge?.value) {
        try {
          const txtHost = challenge.domain || `_calcart-challenge.${domain}`;
          const txtRecords = await dnsPromises.resolveTxt(txtHost);
          const flatTxt = txtRecords.flat().map((t) => t.trim());

          if (flatTxt.includes(challenge.value)) {
            return {
              verified: true,
              sslStatus: "ACTIVE",
            };
          }
        } catch {
          // TXT not found
        }
      }

      // If all real DNS lookups yielded no matching record:
      return {
        verified: false,
        sslStatus: "PENDING",
        error: isApex
          ? `No A record pointing to 76.76.21.21 or TXT ownership token found for ${domain}. Please allow up to 24 hours for DNS propagation.`
          : `No CNAME record pointing to cname.vercel-dns.com found for ${domain}. Please check your DNS registrar settings.`,
      };
    } catch (error) {
      return {
        verified: false,
        sslStatus: "ERROR",
        error:
          error instanceof Error
            ? `DNS lookup failed: ${error.message}`
            : "DNS verification failed",
      };
    }
  }
}
