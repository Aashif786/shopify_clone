# Media Implementation

## 1. Purpose

This document defines the concrete execution-level implementation of the Media integration for the Demo.

The Media integration provides controlled storage and retrieval of binary assets such as:

- Product images.
- Store logos.
- Storefront media.
- Other supported merchant-uploaded assets.

The architecture separates:

```text
Binary object storage
```

from:

```text
Media metadata and ownership
```

PostgreSQL remains authoritative for metadata and relationships, while object storage holds the actual binary content.

---

# 2. Ownership

Media implementation is organized under:

```text
modules/media
```

The Media domain owns:

- Media metadata.
- Object references.
- Media lifecycle.
- Ownership relationships.
- Upload validation.
- Access rules.
- Object-key generation.
- Cleanup coordination.

It does not own:

```text
Product business logic
Store configuration
Order logic
Payment logic
Customer logic
```

Other domains reference Media through its public interface.

---

# 3. Storage Architecture

The Demo uses object storage for binary files.

Conceptually:

```text
Browser
   ↓
Media Application Service
   ↓
Object Storage
   +
PostgreSQL Metadata
```

Example:

```text id="a8n4zq"
PostgreSQL
├── media.id
├── media.store_id
├── media.object_key
├── media.mime_type
├── media.size
└── media.status

Object Storage
└── actual binary file
```

---

# 4. PostgreSQL as Metadata Source of Truth

PostgreSQL owns:

- Media identity.
- Store ownership.
- Object key.
- File metadata.
- Lifecycle state.
- Associations.
- Creation/update timestamps.

Object storage does not determine application ownership.

A file existing in object storage is not sufficient to make it a valid Media record.

---

# 5. Media Model

A Media record may contain:

```text id="7j3kq1"
id
store_id
object_key
original_filename
mime_type
size_bytes
status
visibility
created_at
updated_at
```

Additional fields may be added according to actual requirements.

---

# 6. Media Status

Use explicit lifecycle states.

Example:

```text id="m4x8q7"
Pending
Ready
Failed
Deleted
```

A typical upload lifecycle is:

```text id="z6v3n2"
Pending
   ↓
Ready
   ↓
Deleted
```

Failed uploads may transition to:

```text id="q9p4c6"
Failed
   ↓
Deleted/Cleanup
```

---

# 7. Why Pending State Exists

Uploads can fail after metadata creation or before object persistence.

Example:

```text id="n5c7w2"
Create Media
      ↓
Upload object
      ↓
Network failure
```

Without an explicit state, the system may incorrectly expose an incomplete file.

Only `Ready` media should normally be considered usable.

---

# 8. Object Key Generation

Object keys must be generated server-side.

Do not use raw user filenames as storage keys.

Prefer a structure such as:

```text id="b8q3mz"
stores/{storeId}/media/{mediaId}/{safeFilename}
```

or an equivalent collision-resistant structure.

The exact key format should remain an implementation detail.

---

# 9. Object Key Security

Object keys must not allow:

```text id="x7m2c4"
Path traversal
Arbitrary bucket paths
Cross-store object access
User-controlled overwrite
Unexpected executable paths
```

Do not construct keys by blindly concatenating user input.

---

# 10. File Validation

Before accepting an upload, validate:

```text id="k4v9p2"
File size
MIME type
Extension where applicable
Allowed media type
Store ownership
```

The server must enforce upload limits.

Client-side validation is only a usability feature.

---

# 11. Supported Media Types

The Demo may initially support common image formats such as:

```text id="r6c3w8"
image/jpeg
image/png
image/webp
```

Additional formats should only be enabled when there is a concrete requirement.

---

# 12. File Size Limits

Define explicit maximum sizes.

Example configuration:

```text id="n8q5t2"
MEDIA_MAX_FILE_SIZE_BYTES
```

The limit should be configurable through the centralized configuration system.

Never rely on unlimited uploads.

---

# 13. Upload Architecture

The preferred Demo flow is:

```text id="j5m9x4"
1. Authenticate/resolve Store
2. Validate requested upload
3. Create Media metadata
4. Generate object key
5. Upload object
6. Verify successful upload
7. Mark Media Ready
8. Return Media DTO
```

The implementation may use direct-to-object-storage uploads if supported by the selected provider.

---

# 14. Direct Uploads

For larger files, a signed upload flow may be preferable:

```text id="p3x8v6"
Browser
   ↓
Request upload
   ↓
Server creates Media record
   ↓
Server returns signed upload URL
   ↓
Browser → Object Storage
   ↓
Server confirms upload
   ↓
Media → Ready
```

The Demo may begin with server-mediated uploads if that significantly reduces complexity.

The abstraction should allow direct uploads later.

---

# 15. Signed Upload URLs

If signed uploads are used:

- URLs must be short-lived.
- The object key must be server-generated.
- Store ownership must already be established.
- Content type/size restrictions should be enforced where supported.
- A signed URL must not grant arbitrary bucket access.

---

# 16. Upload Completion

When using asynchronous/direct upload:

```text id="c7n5m8"
Pending Media
      ↓
Upload completed
      ↓
Server verification
      ↓
Ready
```

Never mark Media as Ready merely because a signed URL was generated.

---

# 17. Object Verification

Where practical, verify:

```text id="q4x8z1"
Object exists
Expected object key
Expected content type
Expected size
```

The exact verification depth depends on the object-storage provider.

---

# 18. Media Access

Media access must be controlled by visibility.

Example:

```text id="m8c5v2"
Public
Private
```

Public Storefront media can use public URLs or appropriately scoped delivery URLs.

Private media should use signed access URLs.

---

# 19. Public Media

Product images intended for the Storefront may be publicly accessible.

However:

```text id="v5q9n3"
Public
≠
Unrestricted application metadata
```

Only the binary object should be exposed as required.

Internal metadata should remain protected.

---

# 20. Private Media

Private media should not be served through predictable unrestricted URLs.

Use:

```text id="z2k7p4"
Authenticated request
      ↓
Authorization
      ↓
Signed URL / controlled stream
```

---

# 21. Media Associations

Media can be associated with domain resources through explicit relationships.

For example:

```text id="b7n4x8"
Product
   ↓
Product Media
   ↓
Media
```

The Products module owns the meaning of the Product-to-Media relationship.

Media owns the Media resource itself.

---

# 22. Product Image Flow

Example:

```text id="w4m8q2"
Merchant
   ↓
Upload Image
   ↓
Media Created
   ↓
Product Media Association
   ↓
Product Published
   ↓
Storefront Displays Image
```

A Product should not reference a Media record belonging to another Store.

---

# 23. Store Logo Flow

Similarly:

```text id="r8c2v5"
Merchant
   ↓
Upload Logo
   ↓
Media
   ↓
Store Configuration
   ↓
Public Storefront
```

The Store domain owns Store configuration.

Media only provides the asset.

---

# 24. Cross-Store Association Protection

When associating Media with a domain resource:

```text id="x6n3m9"
Media.store_id
=
Resource.store_id
```

must be verified.

A Media ID alone is never sufficient authorization.

---

# 25. Deletion

Deleting Media should be a controlled lifecycle operation.

Example:

```text id="k9v4c6"
Ready
   ↓
Deleted
```

The system should remove or schedule removal of the corresponding object.

---

# 26. Safe Deletion Ordering

Avoid deleting the object before database relationships are safely removed or invalidated.

A safe sequence is:

```text id="p7x2m8"
Remove/disable associations
      ↓
Mark Media deleted
      ↓
Delete object
      ↓
Verify cleanup
```

For production-scale systems, object deletion may be asynchronous.

---

# 27. Orphan Cleanup

Orphaned objects may occur when:

```text id="m5c8q4"
Object upload succeeds
Database update fails
```

or:

```text id="z8n3v6"
Media metadata created
Upload fails
```

The Demo should provide a cleanup mechanism rather than assuming these cases never happen.

---

# 28. Cleanup Job

The Worker may process stale Media records:

```text id="c4q7m9"
Find Pending/Failed media older than threshold
        ↓
Verify object state
        ↓
Clean object/metadata
        ↓
Mark final state
```

Cleanup must be idempotent.

---

# 29. Media Repository

Repository operations may include:

```text id="b6n8x4"
create
findById
findByStore
updateStatus
deleteMetadata
findStaleUploads
```

All queries must enforce Store scope where applicable.

---

# 30. Object Storage Adapter

Object storage operations should be abstracted.

Example:

```text id="v8m4q2"
ObjectStorage
 ├── putObject()
 ├── deleteObject()
 ├── getObjectMetadata()
 ├── createUploadUrl()
 └── createDownloadUrl()
```

The domain must not depend directly on an S3-compatible SDK.

---

# 31. Storage Provider Configuration

Configuration should be centralized.

Possible values:

```text id="q5c8n3"
OBJECT_STORAGE_ENDPOINT
OBJECT_STORAGE_BUCKET
OBJECT_STORAGE_REGION
OBJECT_STORAGE_ACCESS_KEY
OBJECT_STORAGE_SECRET_KEY
```

Provider-specific configuration belongs in the infrastructure/configuration layer.

---

# 32. Credentials

Object storage credentials must:

- Never be committed.
- Never be returned to clients.
- Never be logged.
- Be loaded from server-side configuration.
- Be rotated when necessary.

---

# 33. Media DTOs

Use explicit DTOs.

Example:

```text id="n7x4m8"
MediaSummary
MediaDetail
CreateMediaInput
UploadInstruction
MediaAccessResponse
```

Do not return storage-provider SDK objects.

---

# 34. Media API

Typical endpoints may include:

```text id="j8c5v2"
POST   /api/v1/media
GET    /api/v1/media/:id
DELETE /api/v1/media/:id
```

If direct uploads are implemented:

```text id="p6m9x4"
POST /api/v1/media/upload-url
POST /api/v1/media/:id/complete
```

Exact routes must follow the API contract.

---

# 35. Authorization

Media operations must verify the caller's permissions.

Merchant operations may require:

```text id="c8v4n7"
Owner
Admin
Staff
```

according to the platform authorization matrix.

Public Storefront access must only expose explicitly public Media.

---

# 36. Tenant Isolation

Every Media operation must enforce Store ownership.

For example:

```text id="m4x8q7"
findMedia(storeId, mediaId)
```

rather than:

```text id="q9c3v5"
findMedia(mediaId)
```

where the latter could allow cross-tenant object discovery.

---

# 37. API Error Handling

Use stable application error codes.

Examples:

```text id="x7n4m8"
MEDIA_NOT_FOUND
MEDIA_TYPE_NOT_ALLOWED
MEDIA_TOO_LARGE
MEDIA_UPLOAD_FAILED
MEDIA_NOT_READY
MEDIA_ACCESS_DENIED
MEDIA_ALREADY_DELETED
```

Do not expose raw storage-provider errors to clients.

---

# 38. Media Security

Protect against:

```text id="v5c8q2"
Path traversal
Cross-tenant access
Unauthorized deletion
Malicious file types
Oversized uploads
Object overwrite
Signed URL abuse
Secret leakage
```

Where file processing is introduced later, content scanning should be added as a separate capability rather than embedded into core Media ownership.

---

# 39. Caching

Public media may be cached aggressively because binary assets are generally immutable after publication.

Object URLs should preferably reference immutable object keys.

For example:

```text id="z4m8n6"
media/{mediaId}/original
```

If the object changes, create a new object/version rather than silently replacing a published asset where cache consistency would become problematic.

---

# 40. Media Events

Potential events include:

```text id="c6x9m4"
MediaCreated
MediaReady
MediaFailed
MediaDeleted
```

Consumers may include:

```text id="n5v8q2"
Products
Stores
Storefront
Cleanup jobs
```

Events must represent committed facts.

---

# 41. Media Jobs

Worker jobs may handle:

```text id="p8m4x7"
Upload verification
Orphan cleanup
Stale upload cleanup
Object deletion
Media processing in future
```

Jobs must be safe for at-least-once execution.

---

# 42. Transaction Boundaries

Database transactions should cover Media metadata state changes.

Object-storage operations should not unnecessarily occur inside long-running database transactions.

Example:

```text id="q7c4m9"
BEGIN
  Create Pending Media
COMMIT

Upload Object

BEGIN
  Mark Media Ready
COMMIT
```

If the upload fails, the Media record remains recoverable/cleanable.

---

# 43. Failure Recovery

Important failure cases include:

```text id="v8m5c2"
Database succeeds, object upload fails
Object upload succeeds, database update fails
Object exists but Media is Pending
Media is Deleted but object remains
Signed URL expires
Object storage temporarily unavailable
```

Each case must have a deterministic recovery or cleanup path.

---

# 44. Media Tests

Unit tests should cover:

```text id="x4n8q7"
[ ] Object-key generation
[ ] Filename sanitization
[ ] MIME validation
[ ] File-size validation
[ ] Media state transitions
[ ] Visibility rules
[ ] Access authorization
[ ] Cross-store validation
```

---

# 45. Integration Tests

Verify:

```text id="m6c4v9"
[ ] Media metadata persistence
[ ] Object-storage adapter
[ ] Upload flow
[ ] Upload completion
[ ] Signed URL generation
[ ] Media deletion
[ ] Cleanup workflow
[ ] Product-media association
[ ] Store-media association
```

---

# 46. Failure-Recovery Tests

Verify:

```text id="q8x3n5"
[ ] Upload failure
[ ] Object-storage timeout
[ ] Database failure after upload
[ ] Database failure before upload
[ ] Stale Pending media cleanup
[ ] Duplicate cleanup job
[ ] Repeated delete request
```

No failure should leave uncontrolled cross-tenant access or permanently orphaned critical metadata.

---

# 47. Implementation Sequence

Implement Media in this order:

```text id="p4m8x6"
1. Define Media schema
2. Define Media state machine
3. Create database migration
4. Implement object-storage interface
5. Implement object-storage adapter
6. Implement object-key generation
7. Implement upload validation
8. Implement Media repository
9. Implement Media application service
10. Implement upload flow
11. Implement upload completion
12. Implement access URL generation
13. Implement deletion
14. Implement cleanup jobs
15. Integrate Products
16. Integrate Stores
17. Implement Media APIs
18. Add authorization
19. Add tenant isolation
20. Add unit tests
21. Add integration tests
22. Add failure-recovery tests
23. Verify object-storage security
```

---

# 48. Definition of Done

Media implementation is complete when:

```text id="n9c5x7"
[ ] Media schema exists
[ ] Media lifecycle is implemented
[ ] Object storage is abstracted
[ ] Object keys are server-generated
[ ] Upload validation works
[ ] File-size limits work
[ ] MIME validation works
[ ] Pending/Ready states work
[ ] Public/private access works
[ ] Signed URLs work where required
[ ] Product associations work
[ ] Store associations work
[ ] Cross-store associations are rejected
[ ] Media deletion works
[ ] Orphan cleanup works
[ ] Cleanup jobs are idempotent
[ ] Tenant isolation works
[ ] Authorization works
[ ] Sensitive storage credentials are protected
[ ] Unit tests pass
[ ] Integration tests pass
[ ] Failure-recovery tests pass
```