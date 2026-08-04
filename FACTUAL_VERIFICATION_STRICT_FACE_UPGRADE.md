# Factual Verification + Strict Face-Presence Upgrade

## Claim-level verification
- Extracts factual claims from selected resource/custom text.
- Matches each claim against selected indexed syllabus chunks.
- Supports optional accessible internal-resource evidence.
- Returns Supported, Partially Supported, Unsupported, or Conflicting.
- Shows confidence, exact evidence excerpts, source name, source match score, syllabus gaps, low-confidence statements, and time-sensitive/outdated warnings.
- Full AI Safety Review now automatically includes claim verification whenever a syllabus is selected.
- Teacher approval remains compulsory; this is source-grounded verification, not universal internet fact checking.

## Strict face-presence proctoring
- Bundles a local BlazeFace detector; no camera footage is uploaded or recorded.
- Student must pass a single-face check before quiz start.
- Face is checked about every 1.2 seconds.
- If the face leaves frame, an on-screen countdown starts.
- If the face remains missing beyond the configured grace period (default 2 seconds), the backend cancels the attempt and records score 0.
- Multiple faces or detector failure in strict mode immediately cancel the attempt.
- Teachers can configure the grace period and enable/disable strict face cancellation.

## Run
Copy your previous backend/.env, run npm install, then npm run test:upgrade and npm start.
