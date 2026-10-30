# Rollback Strategy

## 1. Purpose

This document defines how the Cal Cart commerce platform recovers from unsuccessful or unsafe deployments.

Rollback must restore application availability and operational stability without compromising database integrity, tenant isolation, payment correctness, inventory correctness, or order data.

---

## 2. Rollback Principles

Rollback follows these principles:

- Prefer restoring a known-good application version.
- Never assume database rollback is safe.
- Protect transactional data above application convenience.
- Preserve auditability.
- Stop unsafe deployments quickly.
- Use immutable deployment artifacts.
- Verify system health after rollback.
- Investigate the cause before redeploying.
- Never hide deployment failures.

---

## 3. What Can Be Rolled Back

Application artifacts are normally rollback-safe:

```text
Web application image
Worker application image
Configuration version
```

Database schema and business data require separate treatment.

---

## 4. What Must Not Be Blindly Rolled Back

Do not blindly revert:

- Database migrations.
- Customer records.
- Orders.
- Payments.
- Inventory movements.
- Payment webhook records.
- Job state.
- Audit records.
- Uploaded media.
- External provider state.

External systems may already have observed or processed the operation.

---

## 5. Rollback Types

The platform distinguishes:

### Application rollback

Deploy a previous application image.

### Configuration rollback

Restore a previously known-good configuration.

### Database recovery

Restore or repair database state when necessary.

### Data correction

Apply a controlled corrective migration or administrative operation.

These are separate operations.

---

## 6. Application Rollback

The preferred rollback is:

```text
Current Release
      ↓
Problem detected
      ↓
Select previous verified release
      ↓
Deploy previous image
      ↓
Health checks
      ↓
Smoke tests
```

The previous release must be identifiable by immutable commit/image metadata.

---

## 7. Rollback Trigger Conditions

Rollback should be considered when a deployment causes:

- Application startup failure.
- Severe API errors.
- Authentication failure.
- Storefront failure.
- Checkout failure.
- Payment processing failure.
- Worker failure.
- Severe performance regression.
- Tenant isolation failure.
- Data-integrity risk.
- Critical security regression.

---

## 8. Immediate Rollback Priorities

The highest-priority rollback conditions are:

1. Tenant isolation failure.
2. Authentication/authorization bypass.
3. Payment correctness failure.
4. Inventory corruption.
5. Order corruption.
6. Severe data loss.
7. Complete application unavailability.

Business inconvenience is secondary to data and security integrity.

---

## 9. Rollback Decision

The operator should determine:

```text
Is the current release unsafe?
        │
        ├── No → Investigate / monitor
        │
        └── Yes
              ↓
        Can previous application version run safely?
              │
              ├── Yes → Application rollback
              │
              └── No → Recovery procedure
```

---

## 10. Database Compatibility

Before rolling back the application, verify that the previous application version is compatible with the current database schema.

For example:

```text
Release A
   ↓
Migration A
   ↓
Release B
   ↓
Migration B
```

If Release B has already introduced a schema change, Release A may no longer understand that schema.

Therefore, application rollback must not automatically imply database rollback.

---

## 11. Expand-and-Contract Protection

The preferred migration strategy is:

```text
Expand
   ↓
Deploy compatible application
   ↓
Migrate data
   ↓
Switch application behavior
   ↓
Contract later
```

This allows the previous application version to remain compatible for a limited rollback window.

---

## 12. Backward-Compatible Rollback

When possible, database migrations should be designed so the immediately previous application version can continue operating.

Examples include:

- Adding nullable columns.
- Adding new tables.
- Adding indexes.
- Adding optional fields.

Destructive changes should normally be delayed until rollback is no longer required.

---

## 13. Destructive Migration

Destructive migrations require additional review.

Examples:

- Dropping columns.
- Dropping tables.
- Removing required data.
- Changing data representation irreversibly.

Before performing such changes:

- Verify backups.
- Confirm rollback strategy.
- Confirm application compatibility.
- Prefer a staged migration.

---

## 14. Database Recovery

Database recovery is required when application rollback cannot resolve the issue.

Potential actions include:

- Corrective migration.
- Data repair.
- Point-in-time recovery where supported.
- Backup restoration.

The recovery procedure must preserve as much valid transactional data as possible.

---

## 15. Backup Before Risky Recovery

Before destructive database recovery:

```text
Current database
      ↓
Emergency backup/snapshot
      ↓
Recovery operation
```

This preserves the current state for investigation and potential data extraction.

---

## 16. Payment Data

Payment state requires special care.

Never assume a database rollback reverses an external payment provider operation.

For example:

```text
Payment provider
      │
      ▼
Payment succeeded
      │
      ▼
Application deployment fails
```

Rolling back application code does not automatically refund or reverse the payment.

Payment reconciliation must determine the actual provider state.

---

## 17. Payment Recovery

After a payment-related rollback:

- Verify payment provider events.
- Check persisted payment attempts.
- Check webhook processing.
- Identify successful external payments.
- Prevent duplicate charges.
- Reconcile payment and order state.
- Issue refunds only through controlled processes.

---

## 18. Inventory Recovery

Inventory must not be reconstructed by simply resetting quantities.

Inventory state should be reconciled using:

- Inventory records.
- Inventory adjustments.
- Reservations.
- Releases.
- Order state.
- Cancellation/refund events.

Any corrective inventory change must be auditable.

---

## 19. Order Recovery

Orders are business records and should not be deleted as part of normal rollback.

If an application release created invalid orders:

- Preserve the original records.
- Identify affected orders.
- Determine correct state.
- Apply controlled correction.
- Record the correction.

---

## 20. Worker Rollback

The worker must be rolled back consistently with the application when job contracts have changed.

Potential incompatibilities include:

- Job payload changes.
- Event schema changes.
- Database schema changes.
- State transitions.

Job handlers should therefore be designed for safe retries and controlled evolution.

---

## 21. In-Progress Jobs

During rollback, identify jobs that were:

```text
pending
running
retrying
failed
completed
```

Interrupted jobs must remain recoverable.

Do not delete job records simply because the application version changed.

---

## 22. Idempotency During Rollback

Rollback must preserve idempotency guarantees.

Retrying an operation after rollback must not create:

- Duplicate payments.
- Duplicate orders.
- Duplicate inventory adjustments.
- Duplicate webhook effects.
- Duplicate notifications where duplication is harmful.

---

## 23. Webhook Recovery

Webhook events may arrive during or after rollback.

The system must continue to:

- Verify signatures.
- Persist event identity.
- Detect duplicates.
- Handle retries.
- Respect event ordering rules where applicable.
- Reconcile external state.

Rollback must not disable webhook verification or idempotency.

---

## 24. Rollback Procedure

A standard application rollback is:

```text
1. Detect failure
2. Confirm affected release
3. Stop further deployment
4. Determine rollback target
5. Verify schema compatibility
6. Preserve relevant logs
7. Deploy previous application image
8. Restart web/worker as required
9. Run health checks
10. Run smoke tests
11. Verify critical business flows
12. Monitor system
13. Record incident
```

---

## 25. Health Verification

After rollback verify:

- Web application starts.
- Database connectivity works.
- Authentication works.
- Tenant isolation works.
- Storefront works.
- Merchant operations work.
- Worker is processing jobs.
- Payment integration is functioning.
- Webhooks are being processed.
- Monitoring is healthy.

---

## 26. Smoke Tests After Rollback

Minimum smoke tests should include:

```text
Authentication
Store access
Product retrieval
Storefront
Cart
Checkout entry
Order retrieval
Worker health
```

Sandbox payment verification should be performed when the rollback affected payment-related code.

---

## 27. Rollback Verification

A rollback is not complete merely because the previous image is running.

The system must demonstrate:

```text
Previous release running
        +
Database compatible
        +
Critical flows healthy
        +
Background jobs healthy
        +
Monitoring healthy
```

---

## 28. Deployment Freeze

After a serious rollback, additional deployments should be paused until the failure is understood.

A deployment freeze may be appropriate when:

- Data integrity is uncertain.
- Payment state is uncertain.
- Tenant isolation is compromised.
- Multiple releases fail.
- Root cause is unknown and ongoing.

---

## 29. Incident Investigation

The investigation should identify:

- Failed release.
- Commit SHA.
- Deployment time.
- Failure start time.
- Affected components.
- Affected tenants or users.
- Database changes.
- External integrations involved.
- Logs and monitoring evidence.
- Recovery actions.
- Root cause.
- Preventive actions.

---

## 30. Rollback Auditability

Rollback actions should be recorded.

Useful information includes:

```text
release rolled back
previous release
operator/automation
timestamp
reason
migration state
health-check result
```

Do not include secrets or sensitive credentials.

---

## 31. Rollback Testing

Rollback procedures must be tested periodically.

At minimum, verify that:

- Previous application images remain available.
- Deployment scripts can select previous versions.
- Health checks work.
- Database backups are usable.
- Recovery procedures are documented.
- Operators understand the procedure.

A rollback strategy that exists only in a Markdown file is not a strategy. It is literature.

---

## 32. Backup Restoration Testing

Database backup restoration should be tested separately from normal deployment.

The test should verify:

```text
Backup
  ↓
Restore
  ↓
Migration compatibility
  ↓
Application connection
  ↓
Data verification
```

Restore tests should not overwrite the live Demo database.

---

## 33. Rollback and External Services

External services may have state that cannot be rolled back.

Examples:

- Payment providers.
- Email providers.
- Object storage.
- OAuth providers.
- Third-party webhooks.

The recovery process must reconcile external state instead of pretending distributed systems obey our Git history.

---

## 34. Security Rollback

If a release introduces a security vulnerability:

1. Restrict affected functionality if necessary.
2. Roll back to a safe version when compatible.
3. Rotate exposed credentials if applicable.
4. Review logs for exploitation.
5. Patch the vulnerable code.
6. Test the fix.
7. Redeploy.

Security rollback takes priority over feature availability.

---

## 35. Tenant Isolation Incident

If tenant isolation is compromised:

- Immediately restrict the affected functionality.
- Stop further deployment.
- Determine affected scope.
- Preserve logs and evidence.
- Restore a known-safe application version if possible.
- Verify tenant isolation.
- Investigate data exposure.
- Rotate credentials if required.
- Document the incident.

Tenant isolation failures are critical security incidents.

---

## 36. Failed Migration

If a migration fails:

```text
Migration failure
      ↓
Do not continue blindly
      ↓
Inspect database state
      ↓
Determine whether migration is transactional
      ↓
Recover safely
      ↓
Verify schema
      ↓
Resume deployment or restore previous state
```

Do not simply rerun a partially successful migration without understanding its state.

---

## 37. Deployment State

The deployment system should maintain enough information to determine:

- Current application version.
- Previous known-good version.
- Database migration state.
- Worker version.
- Deployment status.

This information supports reliable recovery.

---

## 38. Demo Rollback Simplicity

The Demo environment should keep rollback operationally simple.

Preferred approach:

```text
Immutable Docker images
+
Versioned migrations
+
Automated health checks
+
Versioned deployment scripts
+
Database backups
```

Complex orchestration is not required.

---

## 39. V1 Evolution

As the platform evolves, rollback may gain:

- Blue/green deployments.
- Canary releases.
- Automated rollback triggers.
- Managed database point-in-time recovery.
- Multiple application instances.
- Deployment approval gates.
- Advanced release observability.

These should be introduced when operational requirements justify them.

---

## 40. Definition of Done

The rollback strategy is complete when:

```text
[ ] Previous application versions are retained
[ ] Deployments use identifiable immutable artifacts
[ ] Application rollback is documented
[ ] Database rollback is treated separately
[ ] Migration compatibility is considered
[ ] Payment recovery is documented
[ ] Inventory recovery is documented
[ ] Order recovery is documented
[ ] Worker rollback is documented
[ ] Webhook recovery is documented
[ ] Idempotency is preserved
[ ] Health checks exist
[ ] Smoke tests exist
[ ] Database backups exist
[ ] Backup restoration is tested
[ ] Rollback actions are auditable
[ ] Serious failures trigger deployment freeze where appropriate
[ ] AI agents cannot perform unsafe rollback actions autonomously
```