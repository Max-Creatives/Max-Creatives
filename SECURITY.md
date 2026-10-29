# Security and operational boundaries

Phase 1 uses server-only PostgreSQL credentials, salted scrypt password hashes, random 256-bit sessions stored as SHA-256 hashes, HttpOnly/SameSite cookies, Secure cookies when APP_URL is HTTPS, session expiry/revocation, exact origin checks, bounded JSON bodies, Zod validation, and per-account database-backed login throttling (10 attempts per 15-minute window).

Reads and mutations are owner-scoped. There is no public registration. Bootstrap accounts with `npm run auth:create` in a trusted administrative shell; it refuses to overwrite an account. Each account has a separate workspace. Team roles, invitations, MFA, password change, and account recovery are not implemented. Establish an operator recovery procedure before wider access.

Deploy behind HTTPS and an edge rate limiter. Per-account throttling does not replace global/IP abuse protection: arbitrary unknown emails can still generate throttle records. Remove expired Session and LoginAttempt records periodically according to your retention policy. Align audit retention and backups with your data obligations.

Response headers prevent framing and MIME sniffing and limit referrers and browser capabilities. The baseline CSP allows inline scripts/styles for Next.js and is not a strict nonce-based policy; tighten it with a reviewed deployment-specific implementation. No third-party analytics or CDN fonts are loaded.

CSV exports/reports neutralize spreadsheet formulas. React escapes displayed text. The app does not retain raw CSV. Contact data is sensitive: restrict operator access, use private database networking and encryption at rest, and define deletion/retention policies. User-supplied sources and notes are not proof of evidence or consent.

Suppression records survive edits. Excluded leads cannot be re-enabled through the edit API. No sending endpoint exists. Future sending must recheck suppression and eligibility at execution, require human approval, use accurate sender identity and a physical address, implement working opt-outs, and record provider-confirmed results. A checkbox does not establish legal compliance.

Gmail tokens and provider keys are not implemented or stored. Future OAuth needs state/PKCE, least-privilege scopes, token encryption with a separate managed key, refresh/revocation handling, and audit review. Never put credentials in browser bundles. Future website research must implement SSRF protection and source permissions before fetching user-supplied URLs.

The local Docker database binds only to loopback. Do not expose it publicly. Production needs verified database TLS, a least-privilege runtime role, and a separate migration role with DDL permissions. Never disable certificate verification to fix connectivity. Backups contain sensitive hashes and records: encrypt them off-host and test recovery.

Report issues privately to your repository/workspace administrator with reproduction steps and no credentials or real exports. No dedicated security reporting address is configured.
