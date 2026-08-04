# Phase 5 + 6 Security Testing Checklist

## Automated checks

Run from the backend folder:

```powershell
npm install
npm run test:phase2
npm run test:phase3
npm run test:phase4
npm run test:secure
npm run test:phase5
npm run test:phase6
npm audit --omit=dev
```

## Authentication tests

- Register with a weak password and confirm rejection.
- Register/login with a compliant password.
- Enter a wrong password repeatedly and confirm temporary lockout.
- Refresh a session and confirm the previous refresh token cannot be reused.
- Use **logout all devices** and confirm older access tokens are rejected after expiry/validation.
- Confirm a student cannot access teacher/admin routes through a direct API call.

## Quiz zero-trust tests

- Inspect the quiz-list API and confirm it contains no questions or answer keys.
- Start an attempt and confirm question order remains stable on resume.
- Modify the visible countdown and confirm the server still rejects an expired attempt.
- Submit a fake `score` value and confirm backend grading ignores it.
- Reuse a submission nonce and confirm rejection.
- Send an old heartbeat/autosave sequence and confirm replay rejection.
- Change the browser/device fingerprint and confirm the attempt is blocked/flagged.
- Open the attempt on another device and confirm binding enforcement.
- Leave fullscreen or hide the tab and verify integrity events.
- Disable/stop the camera and verify interruption handling.
- Disconnect/reconnect network and verify evidence is logged.

## Upload tests

Expected allowed:
- valid text-based `.pdf`,
- valid `.png`, `.jpg`, `.jpeg`.

Expected blocked:
- `syllabus.pdf.exe`,
- renamed EXE with `.pdf`,
- HTML/JS/SVG/BAT/PS1 files,
- image with mismatched MIME/magic bytes,
- oversized file,
- prompt-injection-like document should be flagged and sanitized.

## Admin command-center tests

- Confirm alerts are visible only to admins.
- Acknowledge and resolve an alert.
- View pseudonymized audit metadata.
- Revoke a user session.
- Confirm full secrets/tokens are never displayed.

## Browser/privacy verification

- Camera permission must be explicit.
- Camera preview should remain local.
- No raw camera stream or frame should appear in network requests.
- Explain monitoring and appeal/review policy to students before use.
