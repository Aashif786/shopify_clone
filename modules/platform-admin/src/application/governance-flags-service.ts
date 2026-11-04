import type { Database } from "@calcart/db";
import { PlatformAuditService } from "./audit-service.js";
import type { PlatformAdminRole } from "../domain/roles.js";

export interface FeatureFlagRecord {
  id: string;
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  scopeType: "GLOBAL" | "TENANT" | "STORE";
  targetIds: string[];
  rolloutPercentage: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformPlanRecord {
  id: string;
  code: string;
  name: string;
  description: string;
  monthlyPriceCents: number;
  currency: string;
  maxStores: number;
  maxProductsPerStore: number;
  transactionFeeBasisPoints: number;
  features: string[];
  status: "ACTIVE" | "ARCHIVED";
}

export class PlatformGovernanceService {
  private readonly auditService: PlatformAuditService;

  constructor(private readonly db: Database) {
    this.auditService = new PlatformAuditService(db);
  }

  async listFeatureFlags(): Promise<FeatureFlagRecord[]> {
    const res = await this.db.query<{
      id: string;
      key: string;
      name: string;
      description: string;
      enabled: boolean;
      scope_type: "GLOBAL" | "TENANT" | "STORE";
      target_ids: string | string[];
      rollout_percentage: number;
      created_at: Date;
      updated_at: Date;
    }>("SELECT * FROM platform_feature_flags ORDER BY key ASC");

    return res.rows.map((r) => ({
      id: r.id,
      key: r.key,
      name: r.name,
      description: r.description,
      enabled: r.enabled,
      scopeType: r.scope_type,
      targetIds: typeof r.target_ids === "string" ? JSON.parse(r.target_ids) : r.target_ids,
      rolloutPercentage: r.rollout_percentage,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
    }));
  }

  async updateFeatureFlag(params: {
    key: string;
    enabled: boolean;
    rolloutPercentage?: number;
    reason: string;
    actorId: string;
    actorRole: PlatformAdminRole;
  }): Promise<void> {
    const existingRes = await this.db.query<{ id: string; enabled: boolean; rollout_percentage: number }>(
      "SELECT id, enabled, rollout_percentage FROM platform_feature_flags WHERE key = $1",
      [params.key]
    );
    const existing = existingRes.rows[0];
    if (!existing) throw new Error("Feature flag not found");

    const rollout = params.rolloutPercentage !== undefined ? params.rolloutPercentage : existing.rollout_percentage;

    await this.db.query(
      `UPDATE platform_feature_flags
       SET enabled = $1, rollout_percentage = $2, updated_at = NOW()
       WHERE key = $3`,
      [params.enabled, rollout, params.key]
    );

    await this.auditService.record({
      actorId: params.actorId,
      actorRole: params.actorRole,
      action: "feature_flag.update",
      resourceType: "platform_feature_flag",
      resourceId: params.key,
      reason: params.reason,
      status: "SUCCESS",
      details: {
        previousEnabled: existing.enabled,
        newEnabled: params.enabled,
        previousRollout: existing.rollout_percentage,
        newRollout: rollout,
      },
    });
  }

  async listPlans(): Promise<PlatformPlanRecord[]> {
    const res = await this.db.query<{
      id: string;
      code: string;
      name: string;
      description: string;
      monthly_price_cents: number;
      currency: string;
      max_stores: number;
      max_products_per_store: number;
      transaction_fee_basis_points: number;
      features: string | string[];
      status: "ACTIVE" | "ARCHIVED";
    }>("SELECT * FROM platform_plans ORDER BY monthly_price_cents ASC");

    return res.rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      monthlyPriceCents: r.monthly_price_cents,
      currency: r.currency,
      maxStores: r.max_stores,
      maxProductsPerStore: r.max_products_per_store,
      transactionFeeBasisPoints: r.transaction_fee_basis_points,
      features: typeof r.features === "string" ? JSON.parse(r.features) : r.features,
      status: r.status,
    }));
  }

  async getSubscriptionsOverview(): Promise<{
    plans: PlatformPlanRecord[];
    activeSubscriptions: number;
    mrrCents: number;
    subscribersByPlan: Record<string, number>;
  }> {
    const plans = await this.listPlans();
    const countRes = await this.db.query<{
      plan_code: string;
      sub_count: string;
      plan_price: string;
    }>(
      `SELECT
         pp.code as plan_code,
         COUNT(ps.id)::text as sub_count,
         pp.monthly_price_cents::text as plan_price
       FROM platform_plans pp
       LEFT JOIN platform_subscriptions ps ON ps.plan_id = pp.id AND ps.status = 'ACTIVE'
       GROUP BY pp.id, pp.code, pp.monthly_price_cents`
    );

    let activeSubscriptions = 0;
    let mrrCents = 0;
    const subscribersByPlan: Record<string, number> = {};

    for (const row of countRes.rows) {
      const cnt = parseInt(row.sub_count, 10);
      const price = parseInt(row.plan_price, 10);
      subscribersByPlan[row.plan_code] = cnt;
      activeSubscriptions += cnt;
      mrrCents += cnt * price;
    }

    return {
      plans,
      activeSubscriptions,
      mrrCents,
      subscribersByPlan,
    };
  }

  async updateTenantSubscription(params: {
    tenantId: string;
    planCode: string;
    reason: string;
    actorId: string;
    actorRole: PlatformAdminRole;
  }): Promise<void> {
    const planRes = await this.db.query<{ id: string; name: string }>(
      "SELECT id, name FROM platform_plans WHERE code = $1",
      [params.planCode]
    );
    const plan = planRes.rows[0];
    if (!plan) throw new Error("Plan not found");

    const subRes = await this.db.query<{ id: string; plan_id: string }>(
      "SELECT id, plan_id FROM platform_subscriptions WHERE organization_id = $1",
      [params.tenantId]
    );
    const sub = subRes.rows[0];

    if (sub) {
      await this.db.query(
        "UPDATE platform_subscriptions SET plan_id = $1, updated_at = NOW() WHERE id = $2",
        [plan.id, sub.id]
      );
    } else {
      await this.db.query(
        `INSERT INTO platform_subscriptions (id, organization_id, plan_id, status, current_period_start, current_period_end)
         VALUES (gen_random_uuid(), $1, $2, 'ACTIVE', NOW(), NOW() + INTERVAL '30 days')`,
        [params.tenantId, plan.id]
      );
    }

    await this.auditService.record({
      actorId: params.actorId,
      actorRole: params.actorRole,
      action: "subscription.plan_changed",
      resourceType: "platform_subscription",
      resourceId: params.tenantId,
      tenantId: params.tenantId,
      reason: params.reason,
      status: "SUCCESS",
      details: { newPlanCode: params.planCode, newPlanName: plan.name },
    });
  }

  async getSystemSettings(): Promise<Record<string, unknown>> {
    const res = await this.db.query<{ key: string; value: string | Record<string, unknown> }>(
      "SELECT key, value FROM platform_system_settings"
    );

    const settings: Record<string, unknown> = {};
    for (const row of res.rows) {
      settings[row.key] = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
    }
    return settings;
  }
}
