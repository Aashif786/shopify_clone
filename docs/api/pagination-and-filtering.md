# Pagination and Filtering

## 1. Purpose

This document defines pagination, filtering, sorting, and collection-query conventions for the Cal Cart commerce platform.

The goal is to provide predictable API behavior, prevent unbounded database queries, and maintain a simple implementation suitable for the Demo while leaving room for future scaling.

---

## 2. Core Principles

Collection APIs must:

- Return bounded result sets.
- Use deterministic ordering.
- Validate pagination parameters.
- Validate filter fields.
- Avoid arbitrary database query expressions.
- Preserve tenant isolation.
- Use appropriate database indexes.
- Avoid unnecessary complexity.

The API must never allow clients to request an unbounded collection.

---

## 3. Scope

These rules apply to collection endpoints such as:

```text id="h3k8p2"
/api/v1/products
/api/v1/orders
/api/v1/customers
/api/v1/inventory
/api/v1/stores
```

Exact filters and sorting options remain endpoint-specific.

---

## 4. Demo Pagination Strategy

The Demo should use **cursor-based pagination** for primary collection APIs where stable ordering and incremental traversal matter.

Typical request:

```text id="q7m4x1"
/api/v1/products?limit=25&cursor=eyJpZCI6...
```

This avoids the performance problems that can arise from very large offset values.

Simple administrative screens may use page/offset semantics internally where appropriate, but public collection contracts should prefer cursor pagination when practical.

---

## 5. Why Cursor Pagination

Cursor pagination provides:

- Stable traversal.
- Better performance for large datasets.
- Less degradation at high offsets.
- Better behavior when records are inserted during pagination.

It is particularly useful for:

- Orders.
- Products.
- Customers.
- Inventory records.
- Activity/history collections.

---

## 6. Pagination Parameters

A collection endpoint may support:

```text id="n2r8v5"
limit
cursor
```

Example:

```text id="a6k3p9"
/api/v1/orders?limit=50&cursor=...
```

Parameters must be validated.

---

## 7. Default Limit

Each endpoint should define a default page size.

A reasonable Demo default is:

```text
25
```

The exact value may vary based on the endpoint.

---

## 8. Maximum Limit

Every collection endpoint must define a maximum page size.

A reasonable default maximum is:

```text
100
```

Requests exceeding the maximum should either:

- Return a validation error, or
- Be safely capped according to the documented API contract.

The behavior must be consistent.

---

## 9. Cursor Design

A cursor should be:

- Opaque to clients.
- Stable enough for the requested traversal.
- Validated when decoded.
- Scoped to the endpoint and relevant tenant context.

Clients must not depend on the internal cursor structure.

---

## 10. Cursor Security

Cursors must not allow users to bypass:

- Tenant isolation.
- Authorization.
- Resource visibility.

A cursor generated for one store must not be usable to retrieve another store's data.

The server must apply normal authorization and tenant filtering regardless of cursor contents.

---

## 11. Stable Ordering

Cursor pagination requires deterministic ordering.

A common pattern is:

```text id="p8x2m4"
created_at DESC
id DESC
```

The unique identifier provides a deterministic tie-breaker when timestamps are equal.

The exact ordering should match the endpoint's documented semantics.

---

## 12. Avoid Non-Deterministic Ordering

Do not paginate without a stable ordering.

Avoid:

```sql
ORDER BY created_at DESC
```

when `created_at` is not unique and no deterministic tie-breaker is used.

Prefer:

```sql
ORDER BY created_at DESC, id DESC
```

where appropriate.

---

## 13. Pagination Response

A typical response should include:

```json id="q6v3m8"
{
  "data": [],
  "pagination": {
    "hasNextPage": true,
    "nextCursor": "..."
  }
}
```

The exact response contract should remain consistent across collection endpoints.

---

## 14. Empty Collections

An empty collection is a successful response.

Example:

```json id="m7k2r9"
{
  "data": [],
  "pagination": {
    "hasNextPage": false,
    "nextCursor": null
  }
}
```

Do not return `404` simply because a collection contains no matching records.

---

## 15. Invalid Pagination Parameters

Invalid parameters should produce a validation error.

Examples:

```text
limit=0
limit=-10
limit=abc
invalid cursor
```

The API should return the standard validation error contract.

---

## 16. Offset Pagination

Offset pagination may be used where it is genuinely useful, particularly for simple internal administrative interfaces.

Example:

```text id="w8q4x2"
/api/v1/products?page=2&limit=25
```

However, offset pagination should not become the default for large operational collections without considering query performance.

---

## 17. Filtering Principles

Filters must be explicitly defined by each endpoint.

Example:

```text id="k4n8p2"
/api/v1/products?status=ACTIVE
/api/v1/orders?status=CONFIRMED
/api/v1/customers?status=ACTIVE
```

Do not expose arbitrary SQL-like filter expressions.

---

## 18. Filter Allowlist

Each endpoint should define allowed filter fields.

For example:

```text id="v5q2m9"
Products:
- status
- category where supported
- createdAfter
- createdBefore

Orders:
- status
- customerId where authorized
- createdAfter
- createdBefore
```

Unsupported filter fields should return a validation error.

---

## 19. Filter Operators

Keep filtering simple for the Demo.

Supported operations may include:

```text id="r3m7x8"
equals
not equals where needed
greater/less than for dates or numbers
date ranges
```

Do not introduce a generic filter language unless actual requirements justify it.

---

## 20. Date Filtering

Date filters should use an explicit format.

Prefer ISO 8601-compatible timestamps.

Examples:

```text id="f7x2m5"
createdAfter=2026-01-01T00:00:00Z
createdBefore=2026-02-01T00:00:00Z
```

The API must define timezone semantics clearly.

---

## 21. Status Filtering

Status filters must use documented enum values.

Example:

```text id="b9q4k7"
/api/v1/orders?status=PROCESSING
```

Invalid status values should be rejected rather than silently ignored.

---

## 22. Sorting

Endpoints may expose a controlled set of sortable fields.

Example:

```text id="n8v3p6"
/api/v1/products?sort=createdAt
/api/v1/orders?sort=-createdAt
```

The API must define:

- Allowed fields.
- Default order.
- Ascending/descending syntax.
- Tie-breaker behavior.

---

## 23. Sort Allowlist

Never pass arbitrary client-provided sort expressions directly into SQL.

Bad:

```text id="x2m7q4"
ORDER BY ${request.query.sort}
```

Instead, map allowed API fields to known database columns.

Conceptually:

```text id="w6r9p1"
createdAt → created_at
name      → name
```

---

## 24. Filtering and Tenant Isolation

Every collection query must apply tenant restrictions independently of user filters.

For example:

```text id="j4p8m2"
WHERE store_id = authenticatedStoreId
  AND status = requestedStatus
```

The client must never be able to override the tenant predicate.

---

## 25. Authorization and Filtering

Filtering must not bypass authorization.

For example, a staff member may be allowed to filter orders by status but not retrieve orders belonging to another store.

Authorization scope must be established before applying user-controlled filters.

---

## 26. Resource-Specific Filtering

Filtering should match the business capability.

### Products

Potential filters:

- Status.
- SKU where appropriate.
- Created date.
- Updated date.

### Customers

Potential filters:

- Status.
- Email where appropriate.
- Created date.

### Orders

Potential filters:

- Status.
- Customer.
- Date range.
- Order number where appropriate.

### Inventory

Potential filters:

- Variant.
- Low-stock condition where supported.
- Updated date.

The exact supported filters belong to each feature specification.

---

## 27. Search Versus Filtering

Filtering is not full-text search.

Simple Demo search may use PostgreSQL capabilities where appropriate.

Do not turn a simple filter into a requirement for a dedicated search engine.

A dedicated search system can be introduced later if scale or product requirements justify it.

---

## 28. N+1 Query Prevention

Collection endpoints should avoid N+1 database queries.

If each returned item requires a separate query for related data, inspect whether the query can be safely:

- Joined.
- Batched.
- Prefetched.

Do not solve every N+1 problem with indiscriminate eager loading.

Fetch only the data required by the endpoint.

---

## 29. Query Limits

Queries should remain bounded.

Avoid endpoints that effectively perform:

```text id="c5m8v2"
SELECT * FROM very_large_table
```

without pagination.

Even internal endpoints should have sensible operational limits.

---

## 30. Indexing

Filters and sort orders used frequently should be supported by appropriate database indexes.

Index design must consider:

- Tenant scope.
- Filter fields.
- Sort fields.
- Query selectivity.
- Write overhead.

For example, a store-scoped order listing may benefit from an index involving:

```text id="q8r3m6"
store_id
created_at
id
```

The exact index should be derived from actual query patterns.

---

## 31. Pagination and Transactions

Collection reads generally do not require long-running transactions.

Use normal read consistency unless a specific workflow requires stronger guarantees.

Do not hold database transactions open while sending paginated results to clients.

---

## 32. Pagination and Caching

Cache collection responses only when:

- The data is safe to cache.
- Tenant scope is included.
- Authorization implications are understood.
- Invalidation behavior is acceptable.

Private merchant/customer data should not be cached as globally shared content.

---

## 33. API Contract Consistency

Collection endpoints should use consistent conventions for:

- `limit`.
- `cursor`.
- Pagination metadata.
- Filter naming.
- Sort naming.
- Error responses.

Endpoint-specific differences should be intentional and documented.

---

## 34. Backward Compatibility

Changing pagination behavior can break API consumers.

Avoid silently changing:

- Default ordering.
- Maximum page size.
- Cursor semantics.
- Filter meanings.
- Sort semantics.

If a breaking change is necessary, follow the API versioning strategy.

---

## 35. Testing

Pagination and filtering tests should cover:

### Pagination

- Default limit.
- Custom limit.
- Maximum limit.
- Invalid limit.
- First page.
- Next page.
- Final page.
- Empty result.
- Stable ordering.
- Invalid cursor.

### Filtering

- Valid filters.
- Invalid filters.
- Multiple filters.
- Date ranges.
- Status filters.
- No matching records.

### Security

- Cross-tenant filtering.
- Unauthorized resource filtering.
- Cursor reuse across tenants.
- Resource visibility restrictions.

---

## 36. Performance Testing

For important collection endpoints, verify:

- Query execution time.
- Index usage where appropriate.
- Behavior with realistic record counts.
- Large cursor traversal.
- Combined filters and sorting.

Performance testing should focus on real query patterns rather than theoretical maximums.

---

## 37. Demo-to-V1 Evolution

The Demo should establish a stable collection-query contract without introducing a dedicated search infrastructure.

V1 may later add:

- Advanced search.
- Search indexing.
- Faceted filtering.
- Distributed search.
- Advanced analytics queries.
- High-scale cursor infrastructure.

These changes should be introduced only when actual product or scale requirements justify them.

---

## 38. Pagination and Filtering Checklist

Before releasing a collection endpoint:

```text id="u7k3m8"
[ ] Result set is bounded
[ ] Default limit is defined
[ ] Maximum limit is defined
[ ] Pagination strategy is defined
[ ] Ordering is deterministic
[ ] Cursor is opaque where applicable
[ ] Cursor respects tenant scope
[ ] Filters are explicitly allowed
[ ] Sort fields are allowlisted
[ ] Tenant filtering is enforced server-side
[ ] Authorization is enforced
[ ] Database indexes are appropriate
[ ] N+1 behavior was considered
[ ] Empty results are handled correctly
[ ] Invalid parameters return validation errors
[ ] Tests cover pagination and filtering
[ ] Security tests cover tenant isolation
[ ] API documentation is updated
``` 