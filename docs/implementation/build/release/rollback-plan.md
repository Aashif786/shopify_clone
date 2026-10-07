# Rollback Plan

## 1. Purpose

This document defines how to safely recover the Demo environment when a deployment introduces a critical application, infrastructure, configuration, or database problem.

Rollback must restore a known-good operating state without creating additional data-integrity problems.

The primary principle is:

> **Rollback the application when safe. Repair or migrate the database forward when necessary. Never blindly reverse database changes.**

---

# 2. Rollback Objectives

A rollback must prioritize:

1. Customer safety.
2. Data integrity.
3. Payment correctness.
4. Order correctness.
5. Inventory correctness.
6. Tenant isolation.
7. Service availability.
8. Recoverability.
9. Clear verification.

---

# 3. Rollback Triggers

Consider rollback when a release causes:

```text
[ ] Web unavailable
[ ] Worker continuously failing
[ ] Authentication failure
[ ] Authorization bypass
[ ] Cross-tenant data exposure
[ ] Checkout corruption
[ ] Duplicate orders
[ ] Duplicate payments
[ ] Incorrect payment state
[ ] Inventory corruption
[ ] Webhook processing failure
[ ] Critical database incompatibility
[ ] Secret/configuration exposure
[ ] Critical security vulnerability
[ ] Irrecoverable application errors
```

Not every defect requires rollback.

A minor UI issue should normally be fixed forward rather than destabilizing an otherwise healthy release.

---

# 4. Rollback Decision

Before rollback, determine:

```text
Current release
Previous known-good release
Failure type
Database state
Active transactions
Payment state
Job state
Webhook state
Customer impact
```

The rollback decision must be based on actual system state.

---

# 5. Rollback Classification

Classify the failure as one of:

| Failure | Preferred Response |
|---|---|
| Application-only defect | Application rollback |
| Configuration defect | Configuration correction |
| Dependency/runtime defect | Application/runtime rollback |
| Database-compatible defect | Application rollback |
| Non-compatible schema change | Forward repair |
| Data corruption | Recovery procedure |
| Payment uncertainty | Reconciliation first |
| Job failure | Worker rollback/recovery |
| Security exposure | Immediate containment + rollback/fix |
| Infrastructure failure | Infrastructure recovery |

---

# 6. Golden Rule for Database Rollback

Do not automatically roll back database migrations.

Database schema changes may have already been used by:

- The new application.
- Background jobs.
- Webhooks.
- Other transactions.
- Seed or migration processes.

Reversing them blindly can cause more damage than the original release.

---

# 7. Preferred Recovery Strategy

Use:

```text
Application rollback
        +
Database compatibility
        +
Forward database repair where required
```

rather than:

```text
Application rollback
        +
Blind database reversal
```

---

# 8. Previous Known-Good Release

Maintain enough release information to identify the previous known-good version:

```text
Git commit
Release identifier
Build artifact
Deployment timestamp
Migration state
Configuration version
```

The previous version must be known before beginning rollback.

---

# 9. Release Evidence

Before changing the environment, capture:

```text
Current commit
Current application version
Recent deployment logs
Web logs
Worker logs
Database migration state
Recent errors
Relevant payment/webhook/job identifiers
```

This prevents the rollback itself from destroying useful diagnostic information.

---

# 10. Stop the Rollout

When rollback is required:

```text
Stop additional deployment activity
Stop repeated failed restarts
Prevent another release from deploying
```

Do not simultaneously troubleshoot and deploy unrelated changes.

---

# 11. Protect Active Commerce Operations

If checkout/payment activity is occurring during the incident, determine whether it is safe to continue.

For critical payment uncertainty:

```text
Do not blindly retry payment
Do not blindly create another Order
Do not manually mark payment successful
```

Preserve the uncertain state until reconciliation determines the actual outcome.

---

# 12. Web Rollback

For an application-only failure:

```text
Identify previous known-good version
        ↓
Deploy previous version
        ↓
Restart Web
        ↓
Verify health
        ↓
Run smoke tests
```

The previous version must remain compatible with the current database schema.

---

# 13. Worker Rollback

If the Worker introduces a defect:

```text
Stop defective Worker
        ↓
Assess active jobs
        ↓
Deploy previous compatible Worker
        ↓
Restart Worker
        ↓
Verify job processing
```

Do not delete failed jobs merely to make the dashboard appear healthy.

---

# 14. Job Recovery

Because Demo jobs are durable and at-least-once:

```text
Job state
Lease
Retry count
Payload
```

must remain intact.

After rollback:

```text
[ ] Stale jobs recover
[ ] Failed jobs remain inspectable
[ ] Retryable jobs continue
[ ] Terminal jobs remain terminal
[ ] Idempotency prevents duplicate side effects
```

---

# 15. Database Compatibility Check

Before deploying the previous application version, determine:

```text
Does the previous application understand the current schema?
```

If yes:

```text
Application rollback is permitted.
```

If no:

```text
Do not blindly deploy the previous application.
```

Use a compatible intermediate version or forward repair.

---

# 16. Expand-and-Contract Compatibility

Schema changes should ideally follow:

```text
Old application
      ↓
Expanded schema
      ↓
New application
      ↓
Contracted schema
```

This allows application rollback during the compatibility window.

---

# 17. Incompatible Migration

If a migration makes the previous application incompatible:

```text
Do not immediately reverse the migration.
```

Instead:

```text
Identify incompatible change
        ↓
Determine safe forward-compatible schema
        ↓
Repair/migrate
        ↓
Deploy compatible application
        ↓
Verify
```

---

# 18. Failed Migration

If a migration fails:

```text
Do not assume it completely failed.
```

Determine:

- Whether the migration was transactional.
- Whether any statements committed.
- Current schema state.
- Migration tracking state.
- Application compatibility.

Only then determine the recovery action.

---

# 19. Migration History

Never modify migration history merely to make tooling report success.

Applied migrations represent historical database changes.

If correction is necessary, use an approved forward migration or recovery procedure.

---

# 20. Data Corruption

If data corruption is suspected:

```text
Stop writes where necessary
        ↓
Identify affected records
        ↓
Preserve evidence
        ↓
Determine source of corruption
        ↓
Restore or repair using approved procedure
        ↓
Verify integrity
```

Do not mass-edit records manually without understanding the failure.

---

# 21. Payment Rollback

Payment incidents require special handling.

The payment provider may have accepted a payment even when the application failed.

Therefore:

```text
Provider state
        +
Local Payment state
        +
Webhook state
        +
Order state
```

must be reconciled.

Never assume:

```text
HTTP request failed = payment failed
```

or:

```text
HTTP request succeeded = payment definitely settled
```

---

# 22. Payment Reconciliation

For uncertain payments:

```text
Identify Payment
        ↓
Check provider reference
        ↓
Check provider state
        ↓
Check local Payment state
        ↓
Check webhook events
        ↓
Reconcile through Payments application logic
```

Do not create a second payment attempt simply because the first request timed out.

---

# 23. Order Rollback

Orders represent durable purchase history.

Do not delete Orders created before or during a failed deployment merely to restore application appearance.

If duplicate or invalid Orders were created:

```text
Preserve evidence
Identify cause
Determine financial/inventory impact
Apply controlled correction
```

Historical records must remain auditable.

---

# 24. Inventory Rollback

Inventory must be reconciled against:

```text
On-hand quantity
Reservations
Finalized reservations
Released reservations
Inventory movements
Orders
```

Do not simply overwrite the current quantity to a guessed value.

Inventory correction should use the Inventory module's authoritative operations.

---

# 25. Webhook Rollback

Webhook events already received must remain durable.

After rollback:

```text
[ ] Previously received events remain stored
[ ] Duplicate events remain deduplicated
[ ] Retryable events can be processed
[ ] Out-of-order events remain safe
```

Do not delete webhook records to suppress errors.

---

# 26. Authentication Rollback

If the release breaks authentication:

```text
Check configuration
Check session compatibility
Check database schema
Check cookies/security settings
```

If application rollback is safe, restore the previous compatible version.

Never introduce a temporary authentication bypass to restore access.

---

# 27. Tenant Isolation Incident

If cross-tenant exposure is suspected:

```text
Treat as critical security incident.
```

Immediately:

```text
Stop affected functionality
Contain access
Preserve logs
Identify affected resources
Determine exposure
Deploy safe fix or rollback
Verify isolation
```

Tenant isolation failures block release acceptance.

---

# 28. Security Incident

If the release introduces a serious security vulnerability:

```text
Contain
 ↓
Assess exposure
 ↓
Disable affected functionality if necessary
 ↓
Rollback or deploy verified fix
 ↓
Rotate affected secrets
 ↓
Verify
```

Do not keep a vulnerable version running simply because rollback is inconvenient.

---

# 29. Configuration Rollback

If the application code is correct but configuration is wrong:

```text
Restore previous known-good configuration
        ↓
Restart affected services
        ↓
Verify health
```

Do not change source code to compensate for an environment-specific configuration error.

---

# 30. Secret Exposure

If a secret is exposed:

```text
Revoke/rotate secret
        ↓
Remove exposure source
        ↓
Deploy corrected configuration
        ↓
Verify dependent integrations
```

Changing the Git file alone is insufficient if the secret remains valid.

---

# 31. Cloudflare Rollback

If Cloudflare configuration causes the failure:

```text
Identify changed configuration
        ↓
Restore previous known-good configuration
        ↓
Verify DNS/TLS/routing
```

Do not modify application code for a DNS or routing problem.

---

# 32. Object Storage Rollback

Application rollback must not delete media objects.

PostgreSQL media metadata and object storage content should remain recoverable.

If a release introduced invalid media behavior:

```text
Rollback application
        ↓
Preserve stored objects
        ↓
Repair metadata/object relationships separately
```

---

# 33. Notification Rollback

If notifications are malfunctioning:

```text
Stop repeated failing deliveries
        ↓
Rollback/fix notification code
        ↓
Preserve notification records
        ↓
Retry safe pending notifications
```

Avoid sending duplicate transactional emails.

---

# 34. Smoke Tests After Rollback

After application recovery:

```text
[ ] Web health
[ ] Worker health
[ ] Database connectivity
[ ] Merchant login
[ ] Storefront
[ ] Product display
[ ] Cart
[ ] Checkout
[ ] Payment sandbox
[ ] Order creation
[ ] Background jobs
```

For payment-related incidents, add provider/webhook verification.

---

# 35. Tenant Security Verification

After any security-related rollback:

```text
Tenant A cannot access Tenant B
Tenant A cannot modify Tenant B
Merchant roles remain enforced
Customer cannot access another customer's data
Guest cart ownership remains isolated
```

This is a mandatory release gate.

---

# 36. Post-Rollback Monitoring

Observe:

```text
Application errors
Worker failures
Database errors
Payment errors
Webhook failures
Authentication failures
Authorization failures
```

Compare against the known-good baseline where practical.

---

# 37. Rollback Completion Criteria

Rollback is complete only when:

```text
Known-good application
        +
Compatible database
        +
Healthy Web
        +
Healthy Worker
        +
Verified critical flows
        +
No active critical errors
```

---

# 38. Incident Record

Record:

```text
Release that failed
Failure timestamp
Affected components
Customer impact
Database state
Payment impact
Rollback decision
Rollback version
Actions performed
Verification results
Root cause
Corrective action
```

---

# 39. Root Cause Follow-Up

A rollback restores service but does not resolve the underlying engineering problem.

After recovery:

```text
Identify root cause
Add regression test
Correct implementation
Review architecture if necessary
Update documentation
Release again through normal verification
```

---

# 40. Hotfix After Rollback

A hotfix must follow:

```text
Issue
 ↓
Reproduction
 ↓
Targeted fix
 ↓
Regression test
 ↓
CI
 ↓
Review
 ↓
Deployment
 ↓
Smoke test
```

Avoid stacking undocumented emergency changes on top of a rollback.

---

# 41. AI Rollback Rules

AI agents must:

1. Read the actual root `AGENTS.md`.
2. Read the release, deployment, database, security, and verification documentation.
3. Never blindly reverse database migrations.
4. Never delete Orders, Payments, Webhooks, Jobs, or Inventory records to hide a failure.
5. Never manually mark payments successful.
6. Never bypass authentication or authorization.
7. Never disable tenant isolation.
8. Never expose secrets.
9. Never claim rollback success without verification.
10. Never perform destructive recovery without explicit authorization and an approved procedure.

---

# 42. Rollback Checklist

## Before rollback

```text
[ ] Failure classified
[ ] Current release identified
[ ] Previous release identified
[ ] Database state checked
[ ] Migration state checked
[ ] Payment uncertainty assessed
[ ] Active jobs assessed
[ ] Relevant logs preserved
```

## During rollback

```text
[ ] Deployment stopped
[ ] Unsafe traffic/functions contained
[ ] Application compatibility confirmed
[ ] Previous version deployed if safe
[ ] Worker state preserved
[ ] Database left intact unless recovery requires otherwise
```

## After rollback

```text
[ ] Web healthy
[ ] Worker healthy
[ ] Database healthy
[ ] Authentication works
[ ] Authorization works
[ ] Tenant isolation verified
[ ] Storefront works
[ ] Checkout works
[ ] Payment state verified
[ ] Orders verified
[ ] Inventory verified
[ ] Webhooks verified
[ ] Monitoring verified
```

---

# 43. Definition of Done

The rollback is complete when:

```text
[ ] Incident contained
[ ] Known-good application restored or safe forward repair deployed
[ ] Database integrity preserved
[ ] Payment state reconciled
[ ] Inventory state verified
[ ] Order state verified
[ ] Jobs recoverable
[ ] Webhooks recoverable
[ ] Tenant isolation verified
[ ] Authentication/authorization verified
[ ] Critical user flows verified
[ ] Monitoring stable
[ ] Incident documented
[ ] Root-cause follow-up created
```

---

# 44. Final Principle

Rollback is not:

```text
"Put the old code back."
```

It is:

```text
Understand state
      ↓
Protect data
      ↓
Restore compatible application state
      ↓
Reconcile external effects
      ↓
Verify critical business flows
      ↓
Resume normal operation
```

For this commerce platform, **data correctness is more important than pretending the deployment never happened**.