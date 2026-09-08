# Hardening notes (post MVP Phases 1–9)

## Applied

1. **Header auth gated** — `X-Permissions` / `X-Actor-Id` only if `ALLOW_DEV_AUTH_HEADERS=true` and not production.
2. **JWT claim injection fixed** — `type` / `sub` cannot be overwritten; dedicated service JWT builder.
3. **Split signing keys** — `JWT_SECRET_KEY`, `MFA_ENCRYPTION_KEY`, `QR_HMAC_KEY` (fallback: `SECRET_KEY`).
4. **Production refuse** — weak `SECRET_KEY` / `POSTGRES_PASSWORD` / open header auth rejected.
5. **Sectoral tokens hashed** — plaintext returned once; resolve/revoke via POST body (not URL).
6. **NIC blocked on OPEN duplicates** — override requires `registry:citizen:validate_override` + justification.
7. **Audit append-only** — DB triggers block UPDATE/DELETE on `audit.events` (migration `010_hardening`).
8. **RBAC seed complete** — domain permissions mapped to roles (ONIP, civil, health, …).
9. **Security middleware** — CORS allowlist, security headers, request-id, rate limits (in-memory).
10. **Registration** — requires `ALLOW_OPEN_REGISTRATION` or `users:manage`; password policy enforced.
11. **Interop JWT** — re-validates live `ServiceClient.is_active`.
12. **QR** — dedicated key + `kid` in payload.

## Still to harden (next iterations)

- Redis rate-limit / refresh-token store (jti rotation)
- Real ABIS / KMS-HSM
- IdP OAuth2/OIDC d’État
- Online card verify: POST-only + signed QR preferred
- Login lockout / progressive delay with audit on failures
