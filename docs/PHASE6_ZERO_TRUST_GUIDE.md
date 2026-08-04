# Phase 6 — Zero-Trust Security & Anti-Tamper Architecture

Phase 6 treats the browser, user input, uploaded documents and submitted scores as untrusted. Sensitive decisions are made and verified on the backend.

## Zero-trust quiz flow

1. The student requests a quiz attempt.
2. The server validates role, quiz publication state, attempt count and account status.
3. The server creates:
   - an attempt ID,
   - a random attempt token whose hash is stored in MongoDB,
   - a one-time submission nonce whose hash is stored in MongoDB,
   - a server deadline,
   - randomized question and option order,
   - a browser/device binding hash.
4. The browser receives questions without answer keys.
5. Heartbeats, autosaves, integrity events and final submission require the attempt token and device fingerprint.
6. Sequence numbers prevent replayed heartbeats, autosaves and integrity events.
7. The final submission requires the one-time nonce.
8. The backend grades answers against the private answer key and atomically locks the attempt.
9. Answer keys are hidden while another attempt is still permitted.

## Authentication architecture

- HS256 JWT verification with explicit issuer, audience and token type.
- Short-lived access token.
- Opaque refresh token stored as a hash in MongoDB.
- Refresh-token family rotation.
- Reuse detection revokes the session family, increments token version and emits a critical alert.
- Role checks execute on backend routes; hiding a frontend button is not treated as authorization.
- Disabled users and outdated token versions are rejected.

## Audit and incident visibility

The system records security-relevant metadata without storing plaintext credentials, API keys or raw refresh tokens.

Examples:
- login success/failure,
- account lockout,
- refresh-token reuse,
- role-denied routes,
- quiz token/device mismatch,
- replayed sequences,
- suspicious document uploads,
- resource mutations,
- session revocation.

The Admin **Zero-Trust Command Center** displays open alerts, high-severity alerts, blocked requests, failed logins, active sessions, flagged attempts and recent audit activity.

## Prompt-injection protection

Uploaded PDFs are reference data, not instructions. The RAG pipeline:
- scans common instruction-hijacking patterns,
- stores a document risk score and findings,
- neutralizes suspicious instruction lines before chunking,
- inserts an explicit rule into AI prompts that uploaded text is untrusted,
- prohibits revealing credentials, system prompts or private data.

This reduces risk but cannot mathematically guarantee detection of every adversarial document. Faculty review remains required.

## Production deployment requirements

Before public deployment:
- Enable MongoDB authentication and least-privilege database users.
- Use MongoDB Atlas IP allowlists or private networking.
- Set `NODE_ENV=production`, `COOKIE_SECURE=true` and HTTPS.
- Set an exact `ALLOWED_ORIGINS` value; do not use `*`.
- Use long independent values for `JWT_SECRET` and `AUDIT_HASH_SECRET`.
- Put rate-limit state in Redis or another shared store when running multiple server instances.
- Put private media in encrypted object storage with signed access URLs.
- Centralize logs, enable backups and test restoration.
- Rotate Gemini/database credentials immediately after suspected exposure.
