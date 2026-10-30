# Dependency Management

## 1. Purpose

This document defines how third-party and internal dependencies are selected, installed, updated, reviewed, and removed in the Cal Cart commerce platform.

The objective is to keep the dependency graph:

- Small.
- Secure.
- Predictable.
- Reproducible.
- Maintainable.
- Compatible with the modular-monolith architecture.

A dependency should solve a real problem, not merely provide another way to write three lines of code. Humanity has suffered enough package managers.

---

## 2. Core Principles

The project follows these principles:

1. Prefer existing project capabilities before adding dependencies.
2. Prefer platform capabilities when they are sufficient.
3. Add dependencies only when they provide meaningful value.
4. Keep dependencies scoped to the package or application that needs them.
5. Avoid unnecessary transitive dependency growth.
6. Pin and lock dependency versions through the repository lockfile.
7. Review security and maintenance implications before adding important dependencies.
8. Remove unused dependencies.
9. Do not introduce infrastructure dependencies prematurely.
10. AI agents must not add dependencies without understanding their architectural impact.

---

## 3. Package Manager

The repository uses **pnpm**.

Dependency operations should therefore use pnpm rather than mixing package managers.

Examples:

```powershell
pnpm install
pnpm add <package>
pnpm add -D <package>
pnpm remove <package>
```

Do not introduce:

```text
npm
yarn
bun
```

as competing package-management workflows unless the project architecture explicitly changes.

---

## 4. Lockfile

The repository lockfile is authoritative for reproducible dependency installation.

The lockfile must be committed to source control.

Developers and CI should use the lockfile consistently.

Do not manually edit the lockfile unless there is a specific package-manager-supported reason.

---

## 5. Dependency Categories

Dependencies should be classified conceptually.

### Runtime dependencies

Required by the application at runtime.

Examples:

```text
web framework
database driver
validation library
payment SDK
storage SDK
```

### Development dependencies

Required for development, testing, linting, formatting, or build tooling.

Examples:

```text
test runner
type tooling
linting
formatting
Playwright
```

### Internal workspace dependencies

Packages and modules within the repository.

Examples:

```text
packages/db
packages/auth
packages/validation
```

Internal dependencies should use the workspace's established pnpm configuration.

---

## 6. Dependency Ownership

Dependencies should be installed at the narrowest appropriate scope.

If only `apps/web` needs a package, it should generally belong to `apps/web`.

If multiple packages genuinely require the dependency, workspace-level installation may be appropriate.

Do not put every dependency in the root package merely for convenience.

---

## 7. Dependency Selection

Before adding a dependency, evaluate:

1. Is the capability already implemented?
2. Is the capability provided by Node.js, Next.js, PostgreSQL, or another existing platform component?
3. Is there already a project dependency that provides it?
4. Is the dependency actively maintained?
5. Does it have a reasonable security history?
6. Does it introduce significant transitive dependencies?
7. Does its license fit the project?
8. Does it introduce unnecessary architectural coupling?
9. Will it still be useful when the Demo evolves toward V1?

A dependency should have a clear reason for existing.

---

## 8. Avoid Duplicate Libraries

Do not introduce multiple libraries for the same responsibility without a documented reason.

Examples:

```text
two validation libraries
two HTTP clients
two date libraries
two logging libraries
multiple ORM/query layers
multiple UI component systems
```

Choose one established project approach and follow it.

If a replacement is required, migrate deliberately rather than adding the new library alongside the old one indefinitely.

---

## 9. Framework Dependencies

Core framework dependencies should be treated as architectural dependencies.

Examples:

```text
Next.js
React
TypeScript
database layer
testing framework
```

Changing these requires more scrutiny than adding a small utility library.

Do not upgrade major framework versions casually.

---

## 10. Database Dependencies

Database-related dependencies must preserve the architecture's PostgreSQL source-of-truth model.

Adding:

```text
ORM
query builder
migration framework
database driver
caching database
secondary database
```

requires consideration of how it interacts with:

- Existing database access.
- Transactions.
- Migrations.
- Concurrency.
- Module ownership.
- Testing.
- Deployment.

Do not introduce a second database access abstraction simply because it is convenient for one feature.

---

## 11. Payment Dependencies

Payment provider SDKs should be isolated behind the Payments module.

Provider SDKs should not become dependencies throughout the application.

Preferred:

```text
Payments module
    ↓
Provider interface
    ↓
Provider adapter
    ↓
Provider SDK
```

This allows the payment provider to change without spreading provider-specific types across the platform.

---

## 12. External Integration Dependencies

The same principle applies to:

- Email.
- Object storage.
- Authentication providers.
- Shipping providers.
- Tax providers.
- External APIs.

Provider-specific dependencies should remain close to the integration boundary.

---

## 13. Security Review

Before adding a dependency that handles sensitive functionality, review:

- Security history.
- Maintenance activity.
- Known vulnerabilities.
- Package ownership.
- Dependency provenance.
- Required permissions.
- Runtime behavior.

Extra scrutiny is required for dependencies handling:

```text
authentication
authorization
payments
cryptography
file uploads
webhooks
database access
```

---

## 14. Vulnerability Management

Dependency vulnerabilities should be reviewed rather than automatically ignored.

Use the package manager's available audit mechanisms and CI security tooling where configured.

A vulnerability should be evaluated based on:

- Severity.
- Whether the affected package is actually used.
- Whether the vulnerable code path is reachable.
- Whether an upgrade is available.
- Whether upgrading introduces breaking changes.
- Whether a temporary mitigation is required.

Do not suppress vulnerability warnings without documenting the reason.

---

## 15. Versioning

Use stable dependency versions appropriate for the project.

Avoid automatically adopting major-version upgrades without review.

### Patch updates

Generally lower risk, but should still be tested.

### Minor updates

Review release notes and verify compatibility.

### Major updates

Require deliberate evaluation because they may introduce:

- Breaking APIs.
- Changed runtime behavior.
- Migration requirements.
- Security implications.

---

## 16. Dependency Updates

Dependency updates should be performed deliberately.

A normal update workflow is:

```text
1. Identify dependency
2. Review available version
3. Review changelog/release notes
4. Update dependency
5. Update lockfile
6. Run tests
7. Run typecheck
8. Run lint
9. Run build
10. Review resulting changes
```

Do not combine a large dependency upgrade with unrelated feature development unless necessary.

---

## 17. Major Dependency Upgrades

Major upgrades should have a clear migration plan.

Examples:

```text
Next.js major upgrade
React major upgrade
database library major upgrade
authentication library major upgrade
payment SDK major upgrade
```

Before upgrading:

- Identify breaking changes.
- Identify deprecated APIs.
- Identify migration steps.
- Review affected modules.
- Review deployment implications.
- Run the complete verification suite.

---

## 18. Removing Dependencies

Unused dependencies should be removed.

Before removing a dependency:

1. Search the repository for usage.
2. Check configuration and build files.
3. Check scripts.
4. Remove the package.
5. Update the lockfile.
6. Run verification.

Do not leave abandoned dependencies indefinitely.

---

## 19. Transitive Dependencies

Transitive dependencies should generally be managed through the direct dependency that introduces them.

Do not manually install a transitive package merely to make it available to application code unless there is a clear reason.

If a transitive dependency creates a security or compatibility issue:

1. Check whether the parent package has an update.
2. Check whether another supported version resolves the issue.
3. Consider a temporary override only when justified.
4. Document the override and its removal condition.

---

## 20. Dependency Overrides

Package-manager overrides/resolutions may be used when necessary for:

- Security fixes.
- Compatibility fixes.
- Temporary ecosystem issues.

Overrides must be documented when they are non-obvious.

Avoid using overrides to hide unresolved dependency conflicts indefinitely.

---

## 21. Internal Workspace Dependencies

Internal packages should have clear responsibilities.

Example:

```text
apps/web
    ↓
packages/auth
packages/tenant
packages/validation
```

A business module should not depend on an unrelated application package.

Avoid dependency directions such as:

```text
packages/db
    ↓
apps/web
```

Shared lower-level packages must remain independent of higher-level applications.

---

## 22. Circular Dependencies

Circular dependencies should be avoided.

Examples:

```text
products → inventory → products
```

or:

```text
packages/auth → modules/orders → packages/auth
```

When a circular dependency appears, review the ownership boundary rather than immediately adding an abstraction to conceal it.

Possible solutions include:

- Moving a shared primitive to the appropriate package.
- Defining a public interface.
- Using a domain event.
- Reconsidering module ownership.

---

## 23. Dependency Injection

Do not introduce a dependency injection framework merely because the application has multiple services.

Simple constructor/function injection is generally preferred when sufficient.

Example:

```ts id="n5v4p1"
function createOrderService(
  orderRepository: OrderRepository,
  inventory: InventoryService,
) {
  // ...
}
```

A framework should be introduced only when its complexity provides meaningful value.

---

## 24. Utility Libraries

Small utility functions should generally remain local when they are simple and domain-specific.

Do not add a large general-purpose library solely for one trivial helper.

However, do not recreate complex, security-sensitive functionality unnecessarily.

For example:

```text id="w4m2p7"
cryptography
secure token generation
password hashing
```

should use well-established libraries or platform primitives.

---

## 25. Date and Time Libraries

The project should avoid multiple competing date/time libraries.

Date and time behavior must be consistent across:

- API.
- Database.
- Workers.
- Tests.
- Domain logic.

When introducing or replacing a date/time dependency, document the expected timezone and serialization behavior.

---

## 26. Frontend Dependencies

Frontend dependencies should be evaluated for:

- Bundle size.
- Server/client compatibility.
- Accessibility.
- Maintenance.
- Security.
- Hydration behavior.
- Next.js compatibility.

Avoid adding a frontend library when the existing UI system or browser APIs are sufficient.

---

## 27. UI Dependencies

Shared UI dependencies belong in the appropriate UI package or application scope.

Do not allow unrelated business modules to become dependent on frontend libraries.

Domain code must remain UI-independent.

---

## 28. Testing Dependencies

Testing dependencies should remain separated from production runtime dependencies.

Examples include:

```text
Vitest
Playwright
test utilities
mocking tools
```

Test-only libraries must not be imported into production application paths.

---

## 29. Development Tooling Dependencies

Linting, formatting, type-checking, code generation, and development tooling should be scoped appropriately.

Tooling changes should not silently alter runtime behavior.

---

## 30. License Considerations

Before introducing a dependency into the project, confirm that its license is compatible with the intended use of the platform.

Dependencies with unclear or incompatible licensing should not be introduced without explicit review.

License metadata should be considered particularly important for dependencies that will be distributed with the product.

---

## 31. Dependency Documentation

Important dependencies should have a clear reason for their existence.

For non-obvious architectural dependencies, document:

- Why it exists.
- Which module owns it.
- What problem it solves.
- Important constraints.
- Replacement considerations if relevant.

Not every small utility package needs an ADR.

Architecturally significant dependencies may require an ADR under:

```text
docs/decisions/
```

---

## 32. AI-Assisted Dependency Changes

AI agents must treat dependency changes as architectural changes when appropriate.

Before adding a dependency, the agent must:

1. Inspect existing dependencies.
2. Search for an existing project capability.
3. Identify the package/application that actually needs it.
4. Assess whether it affects module boundaries.
5. Review the dependency's purpose and compatibility.
6. Add it at the narrowest appropriate scope.
7. Update the lockfile.
8. Run applicable verification.
9. Report the dependency addition explicitly.

AI agents must not add dependencies simply because a generated solution is easier with them.

---

## 33. Prohibited Dependency Practices

Do not:

- Commit generated `node_modules`.
- Commit secrets contained in package configuration.
- Mix package managers.
- Add duplicate libraries without justification.
- Install every package at the workspace root.
- Use abandoned packages without explicit justification.
- Ignore known security vulnerabilities without review.
- Add production dependencies for test-only functionality.
- Add infrastructure dependencies before the requirement exists.
- Replace an established library without a migration reason.

---

## 34. Demo Dependency Strategy

The Demo intentionally keeps its dependency graph relatively small.

Prefer:

```text id="e3k9v2"
Next.js
TypeScript
PostgreSQL tooling
Validation
Authentication
Testing
Required provider SDKs
Required UI tooling
```

Add infrastructure such as Redis, search engines, queues, or distributed systems only when a demonstrated requirement exists.

The architecture should remain ready for future extraction without requiring those systems during Demo development.

---

## 35. Dependency Review Checklist

Before adding a dependency:

- [ ] Existing project capability checked.
- [ ] Platform capability checked.
- [ ] Dependency purpose documented.
- [ ] Correct workspace scope identified.
- [ ] Security implications reviewed.
- [ ] License compatibility considered.
- [ ] Maintenance status considered.
- [ ] Transitive dependency impact considered.
- [ ] Module boundary impact considered.
- [ ] Testing impact considered.
- [ ] Lockfile updated.
- [ ] Verification completed.

---

## 36. Definition of Done

Dependency management is complete when:

- Dependencies are intentional.
- Dependencies are installed at the correct scope.
- Versions are reproducible.
- Security concerns are reviewed.
- Unused dependencies are removed.
- Provider-specific dependencies remain isolated.
- Internal workspace dependencies follow architectural boundaries.
- Dependency updates are verified.
- AI-assisted dependency changes follow the same review standards.
- The dependency graph remains appropriately simple for the Demo and capable of evolving toward V1.     