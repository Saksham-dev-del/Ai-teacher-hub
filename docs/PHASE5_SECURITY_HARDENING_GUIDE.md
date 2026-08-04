# Phase 5 — Security Hardening & Anti-Tamper Guide

Phase 5 hardens the existing secure quiz experience without removing Phase 1–4 features.

## Implemented controls

### Secure browser quiz session
- Consent gate before camera/fullscreen monitoring begins.
- Camera continuity checks remain local in the browser; video is not recorded or uploaded.
- Fullscreen exit, tab/window hiding, clipboard actions, restricted shortcuts, camera interruptions and network changes are logged as integrity events.
- A signed server heartbeat keeps the attempt alive and prevents a disconnected browser from silently extending the test.
- Answer autosave uses monotonically increasing sequence numbers so replayed or out-of-order writes are rejected.
- The server controls the deadline; changing the device clock or editing the visible countdown does not extend the attempt.

### Strict uploads
- Syllabus: PDF extension, MIME type and `%PDF-` file signature must all match.
- Visual assets: PNG/JPG/JPEG extension, MIME type and magic bytes must all match.
- Double extensions and executable/script extensions are rejected.
- Filenames are replaced with random server-side names.
- Uploaded media is stored outside the public frontend and served only through authenticated routes.

### Account protection
- Password policy checks length and character diversity.
- Repeated failed logins cause a temporary account lock.
- Access tokens are short-lived and stored in `sessionStorage`.
- Refresh tokens use HttpOnly, SameSite=Strict cookies and are rotated after every refresh.
- Logout-all increments the user's token version and invalidates existing sessions.

### API protection
- Security headers and Content Security Policy.
- Origin checks on state-changing requests.
- Request body size limits.
- NoSQL/prototype-pollution key blocking.
- Separate rate limits for login, registration, AI generation, exports, uploads and quiz events.

## Important limitations

A normal website cannot enumerate, disable or guarantee the absence of browser extensions. It also cannot provide the same control as a managed lockdown browser. For high-stakes examinations, use institution-managed devices, kiosk/lockdown software and human review in addition to these controls.

Camera or face-presence signals can have false positives because of lighting, hardware and browser limitations. The application records integrity evidence and risk signals; a teacher/admin should review the event history before applying disciplinary action.
