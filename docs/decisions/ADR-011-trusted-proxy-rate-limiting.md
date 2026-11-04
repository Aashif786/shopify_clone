# ADR-011: Trusted Proxy Client IP and Rate Limits

## Status

**Accepted**

## Date

2026-11-04

## Decision

Client IP headers are untrusted unless `TRUSTED_PROXY` names the edge that overwrites them.

| Value | Header used |
|---|---|
| `none` (default) | none; every caller shares `unverified-client` |
| `forwarded:<hops>` | the `X-Forwarded-For` entry `hops` from the right |
| `cloudflare` | `cf-connecting-ip` |
| `real-ip` | `X-Real-IP` |

`cf-ray` is not proof that Cloudflare handled the request. A malformed selected address falls back to `unverified-client` and is not replaced with another client-supplied hop.

Rate limits use a `RateLimitStore`. The shipped store is an in-memory map capped at 5,000 keys per process, with one overflow bucket after that. Two processes do not share counters. A shared store can be passed into `RateLimiter` when one exists; this deployment does not include Redis or another shared backend.

Authentication, registration, email verification, password reset, invitation acceptance, payment verification, and review reporting each have their own keys. Account and token keys are counted for every request with that identifier, whether or not the account exists.

## Deployment

Leave `TRUSTED_PROXY=none` when Node receives browser connections directly. Set `forwarded:1` only for a single proxy that appends `$remote_addr` and is the only path to the app. Set `cloudflare` only when the origin firewall rejects non-Cloudflare traffic. The limiter remains process-local until a shared store is configured.
