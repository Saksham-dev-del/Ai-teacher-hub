# Verified Student Identity and Impersonation Prevention

## Purpose
This upgrade prevents another person from taking a protected quiz using a student's account.

## Flow
1. Student opens Quiz Center and explicitly consents to face identity enrollment.
2. Local Human models run face detection, face descriptor extraction, anti-spoofing and liveness checks.
3. One enrollment selfie and the numeric descriptor are encrypted before database storage.
4. Teacher/admin reviews the enrollment selfie and approves or rejects the profile.
5. Before an identity-locked quiz starts, the live descriptor is compared on the server with the approved encrypted descriptor.
6. A short-lived proof token bound to the student, quiz and device is required to create the attempt.
7. During the quiz, random continuous identity rechecks run. Repeated mismatch, severe mismatch, liveness failure, multiple faces or face absence can cancel the attempt.

## Privacy
- Continuous video is not uploaded or recorded.
- Only one consented enrollment selfie is retained for approval.
- Face descriptors and the selfie are encrypted with AES-256-GCM.
- Use a stable `FACE_IDENTITY_SECRET`; changing it after enrollment makes existing encrypted profiles unreadable.
- Provide an institutional privacy notice, retention period and appeal/retest process before real deployment.

## Recommended Testing
- Enrol a student face and confirm status is Pending.
- Log in as teacher/admin and approve it.
- Start a protected quiz with the same person: it should pass identity match.
- Try a different person: quiz start should be blocked.
- During an active quiz, substitute a different person: first mismatch requests an immediate recheck, repeated or severe mismatch cancels the attempt.
- Cover the camera or leave the frame for 2 seconds: existing strict face-presence cancellation remains active.

## Limitations
Browser-side biometric checks are defence-in-depth, not a replacement for supervised examinations or managed lockdown devices. Lighting, camera quality, facial changes and accessibility needs can produce false rejects. A teacher review and supervised retest path must remain available.
