# ADR-010: Storefront Registration and Email Ownership

## Status

**Accepted**

## Date

2026-11-04

## Decision

Storefront registration never attempts to log in an existing account. New and existing emails receive the same `201` response, with no session cookie.

A customer row is linked to a user only when `customers.user_id` is null and the user's email ownership has been verified. Verification uses a single-use SHA-256 token in `email_verification_tokens`, sent by direct email and never stored or logged in plaintext. A password reset also marks the email verified, because that flow already proves access to the inbox.

`users.email_verified_at` is the verification timestamp. Existing rows stay unverified until one of those proofs. Registration rate limits use the process-local limiter, keyed by `getClientIp` and by store plus email.

## Schema

Migration `0032_email_verification.sql` adds `users.email_verified_at` and `email_verification_tokens`.
