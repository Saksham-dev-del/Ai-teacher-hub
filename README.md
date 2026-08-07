# AI Teacher Resource Hub & Lesson Plan Assistant — Phase 7 + Phase 8

A full-stack AI-powered academic content and assessment platform for college faculty, students and administrators. It supports B.Tech, B.Com, BCA, BBA, B.Sc, BA, MBA, MCA, Diploma and related courses.

This package preserves Phases 1–6 and adds a **Phase 7 Personalized AI Learning Engine** plus a **Phase 8 Academic Planning and Assessment Suite**. Existing RAG, detailed PDF/PPT, secure quiz, camera/fullscreen integrity, server-side grading, audit and zero-trust features remain available.


## What Phase 7 Adds — Personalized AI Learning Engine

- AI lesson-plan personalization using class performance, teaching style and English/Hindi/Hinglish preferences.
- Server-side student learning-level detection from quiz attempts: Needs revision, Beginner, Intermediate or Advanced.
- Weak-topic and weak-Bloom analysis with recommended learning mode.
- Adaptive notes: short exam notes, detailed classroom notes, easy explanations, last-minute revision and important-questions mode.
- AI feedback on saved resources with clarity, completeness, examples, assessment-readiness and improvement suggestions.
- Difficulty/format conversion: easier, advanced, exam, viva, PPT points and assignment modes.
- Explain Like I’m 5, Exam Booster, Auto Summary and interactive Flashcards.
- Phase 7 outputs are stored as auditable MongoDB artifacts.

## What Phase 8 Adds — Academic Planning and Assessment Suite

- Unit-wise course planner with notes, assignments, quizzes, weekly sessions and revision tasks.
- Question-paper generator for Unit Test, Internal Exam, Mid-Term and End-Semester.
- Supported question formats: MCQ, 2 marks, 5 marks, 10 marks, case study, numerical and coding questions.
- Blueprint validation that blocks generation until unit marks exactly equal the paper total.
- Deterministic exact-mark construction with answer-key guidance.
- AI rubric generator with weighted criteria and four performance levels.
- Smart revision planner based on exam date and daily study time.
- AI case-study generator and Coding Lab Assistant with practical-file format.
- Attendance-based reminders that recommend catch-up notes, quiz and doubt-clearing support.
- Phase 8 outputs and attendance records are stored in MongoDB with audit events.

## What Phase 5 Adds — Security Hardening & Anti-Tamper

- Consent-based camera continuity and fullscreen monitoring.
- Tab/window, clipboard, restricted-shortcut, camera and network integrity events.
- Server heartbeat, secure answer autosave and server-controlled deadline.
- Strict PDF/image extension, MIME and magic-byte validation.
- Double-extension blocking, randomized storage names and private authenticated media delivery.
- Strong-password policy, failed-login lockout and route-specific rate limiting.
- CSP/security headers, origin checks, request-size limits and NoSQL/prototype-key filtering.

## What Phase 6 Adds — Zero-Trust Security & Anti-Tamper

- Quiz answer keys stay on the backend and are never included in student quiz-list responses.
- The backend ignores client score claims and performs all grading itself.
- Every attempt receives a random token, one-time submission nonce, server deadline and device binding.
- Question and option order are randomized and stored for the attempt.
- Heartbeat, autosave and integrity events use anti-replay sequence numbers.
- Final submission is atomic and permanently locks the attempt.
- Short access tokens, HttpOnly rotating refresh cookies, reuse detection and logout-all session invalidation.
- Audit logs, security alerts and an Admin **Zero-Trust Command Center**.
- Uploaded syllabus text is scanned and neutralized for prompt-injection-style instructions before RAG indexing.

## What Phase 4 Adds

### Detailed Multi-Stage Content Engine

The generator no longer depends on one short AI response. It uses a staged workflow:

```text
Teacher brief
  -> multi-source RAG retrieval
  -> academic outline planning
  -> section-wise batch expansion
  -> visual and image placement
  -> Bloom questions and CO mapping
  -> quality and export validation
  -> editable teacher preview
  -> detailed PDF / visual PPTX export
```

### Content Depth Modes

- Quick Summary
- Standard Notes
- Detailed Explanation
- Research / Faculty Level

Each mode controls the number of sections, expected depth, page target and slide target.

### Visual Content Controls

- Text Focused
- Balanced
- Visual Rich
- Automatically planned concept maps, process diagrams, comparisons, timelines and tables
- Teacher-uploaded PNG/JPG diagrams, screenshots, charts and subject images
- Figure titles and captions

### Detailed PDF Report

The Phase 4 PDF contains:

- Designed cover page
- Document profile
- Executive summary
- Table of contents
- Learning outcomes
- Detailed section-wise explanations
- Key points
- Worked examples
- Applications
- Case studies
- Comparison tables
- Vector diagrams or teacher-uploaded images
- Common mistakes
- Speaker/teacher notes when enabled
- Bloom's Taxonomy questions with answer guidance
- Course Outcome mapping
- AI quality score
- Export-readiness validation
- Syllabus/source evidence and references
- Page numbers and branded footer

### Visual PowerPoint Generator

The editable PPTX can contain:

- Title slide
- Presentation roadmap
- Learning outcomes
- Concept slides
- Visual diagrams and uploaded images
- Worked-example slides
- Case-study slides
- Structured-comparison tables
- Bloom question slides
- Course Outcome alignment
- Quality and export validation
- References
- Summary and discussion slide
- Detailed PowerPoint speaker notes

### Live Motion UI

- Real generation job progress
- Staged animated pipeline
- Moving progress indicator
- Motion-based card entrance
- Live section reveal
- Animated visual nodes
- Hover depth and cursor glow
- Image upload selection animation
- Validation result animation
- Reduced-motion accessibility support

## Features from Earlier Phases

### Phase 1
- JWT authentication
- Teacher, student and admin roles
- MongoDB persistence
- Resource Hub and student sharing
- PDF, DOCX, TXT and LMS HTML exports
- Admin analytics

### Phase 2
- Syllabus PDF upload
- Selectable-text validation
- Semantic/lexical RAG
- Multi-source evidence
- Bloom's Taxonomy
- Course Outcome mapping
- AI quality scoring

### Phase 3
- Student quiz attempt interface
- Timer and attempt limits
- Automatic grading
- Performance analytics
- Weak-topic detection
- Lesson calendar
- Editable PowerPoint generation

## Technology Stack

### Frontend
- HTML5
- CSS3
- Vanilla JavaScript
- Motion One vendored locally

### Backend
- Node.js 18+
- Express.js
- MongoDB / Mongoose
- JWT / bcrypt
- Gemini, OpenAI or Anthropic provider abstraction
- pdf-lib
- PptxGenJS
- docx
- unpdf
- Multer image upload

## Project Structure

```text
AI_Teacher_Resource_Hub_Phase7_Phase8/
├── backend/
│   ├── export/
│   │   ├── detailedPdf.js
│   │   ├── pdf.js
│   │   └── docx.js
│   ├── models/
│   │   ├── MediaAsset.js
│   │   ├── Resource.js
│   │   └── ...
│   ├── routes/
│   │   ├── detailed.js
│   │   ├── media.js
│   │   ├── presentations.js
│   │   └── ...
│   ├── services/
│   │   ├── aiGateway.js
│   │   ├── contentPlanner.js
│   │   ├── sectionGenerator.js
│   │   ├── visualPlanner.js
│   │   ├── pedagogyGenerator.js
│   │   ├── reportValidator.js
│   │   ├── citationManager.js
│   │   ├── detailedGeneration.js
│   │   └── presentation.js
│   ├── tests/
│   │   ├── phase2-smoke.js
│   │   ├── phase3-smoke.js
│   │   └── phase4-smoke.js
│   ├── uploads/
│   ├── .env.example
│   ├── package.json
│   └── server.js
├── frontend/
│   ├── css/styles.css
│   ├── js/
│   │   ├── phase4-api.js
│   │   ├── media.js
│   │   ├── generator.js
│   │   ├── presentations.js
│   │   └── motion-ui.js
│   ├── vendor/motion-umd.js
│   └── index.html
└── docs/
    ├── PHASE4_GUIDE.md
    ├── PHASE4_TESTING_CHECKLIST.md
    └── PHASE4_VERIFICATION_REPORT.md
```

## Quick Start on Windows

From the extracted project root:

```powershell
.\START_PHASE8_WINDOWS.bat
```

To run the complete Phase 2–8 verification suite:

```powershell
.\TEST_PHASE8_WINDOWS.bat
```

## Installation

### 1. Requirements

- Node.js 18 or newer
- MongoDB Community Server or MongoDB Atlas
- A valid AI provider key for live generation

### 2. Extract and open backend

```powershell
cd "D:\AI_Teacher_Resource_Hub_Phase7_Phase8\backend"
```

### 3. Create `.env`

PowerShell:

```powershell
Copy-Item .env.example .env
notepad .env
```

Example:

```env
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/ai_teacher_resource_hub
JWT_SECRET=replace_with_a_long_random_secret

AI_PROVIDER=gemini
GEMINI_API_KEY=replace_with_your_real_gemini_api_key
GEMINI_MODEL=gemini-3.5-flash
GEMINI_FALLBACK_MODEL=gemini-3.1-flash-lite
GEMINI_EMBEDDING_MODEL=gemini-embedding-2

RAG_TOP_K=5
MAX_SYLLABUS_PDF_MB=10
DISABLE_RAG_EMBEDDINGS=false

PHASE4_SECTION_BATCH_SIZE=4
PHASE4_RAG_TOP_K=10
MAX_VISUAL_IMAGE_MB=8
```

Generate a JWT secret:

```powershell
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Never upload `.env` to GitHub.

### 4. Install dependencies

```powershell
npm install
```

If Windows reports locked `node_modules`, use:

```powershell
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Remove-Item .\node_modules -Recurse -Force -ErrorAction SilentlyContinue
npm config set registry "https://registry.npmjs.org/"
npm cache verify
npm install
```

### 5. Run tests

```powershell
npm run test:phase2
npm run test:phase3
npm run test:phase4
npm run test:secure
npm run test:phase5
npm run test:phase6
npm audit --omit=dev
```

From the extracted project root, Windows users can also run:

```powershell
.\TEST_PHASE6_WINDOWS.bat
```

### 6. Start

```powershell
npm start
```

Or from the extracted project root:

```powershell
.\START_PHASE6_WINDOWS.bat
```

Open:

```text
http://localhost:3000
```

## Phase 4 Teacher Workflow

1. Sign in as Teacher or Admin.
2. Upload one or more text-based syllabus/reference PDFs.
3. Open **Phase 4 AI Studio**.
4. Select course, subject, topic and resource type.
5. Select Content Depth and Visual Density.
6. Set target pages, target slides and examples per section.
7. Enable diagrams, images, case studies, references and speaker notes.
8. Optionally upload PNG/JPG visual assets.
9. Select multiple academic source PDFs.
10. Generate and watch the live progress pipeline.
11. Review the rich section cards.
12. Use **Edit Content** for teacher corrections.
13. Save to Resource Hub.
14. Download the detailed PDF or editable PowerPoint.

## Important Notes

- Image-only/scanned PDFs require OCR before syllabus indexing.
- Generated content is AI-assisted and must be reviewed by faculty.
- Detailed and Research modes make several AI calls and take longer than Quick mode.
- Phase 4 generation jobs are held in server memory; restarting the server clears unfinished jobs.
- Uploaded images are stored in `backend/private_uploads` and are served only through authenticated API routes.
- MongoDB persistence and live AI generation require a valid `.env`.

## Automated Verification

`npm run test:phase4` verifies:

- Phase 4 outline planner
- Rich section schema
- Visual planning
- Bloom questions and CO mapping
- Reference handling
- Content-depth validation
- Phase 4 MongoDB schema fields
- Detailed multi-page PDF generation
- Editable PPTX generation
- PowerPoint speaker-notes package structure
- Phase 4 UI controls
- Live generation API wiring
- Motion/CSS modules

See `docs/PHASE4_VERIFICATION_REPORT.md` for the full status.


## Security documentation

- `docs/PHASE5_SECURITY_HARDENING_GUIDE.md`
- `docs/PHASE6_ZERO_TRUST_GUIDE.md`
- `docs/SECURITY_TESTING_CHECKLIST.md`
- `PHASE5_6_CHANGELOG.txt`

### Privacy and operational limits

- Camera footage is not recorded or uploaded by this project; camera continuity checks execute in the browser.
- A normal website cannot enumerate or disable browser extensions. High-stakes exams require managed devices or a lockdown/kiosk browser in addition to this application.
- Integrity scores and camera/face signals may have false positives. Use teacher/admin review before disciplinary action.
- The built-in rate limiter is suitable for a single application instance. Use Redis or another shared store when horizontally scaling.
- Enable MongoDB authentication, HTTPS, secure cookies, exact CORS origins, backups and centralized logs before public deployment.


## Phase 9 + Phase 10

The platform now includes faculty workload tracking, department collaboration, comments, review/approval, version history, ratings, QR sharing, AI voice scripts and Gemini TTS audio, video scripts, SVG academic diagrams, assignment similarity/originality risk analysis, AI safety review, semantic smart search and an offline-capable PWA shell.

Run `START_PHASE10_WINDOWS.bat` or `cd backend && npm install && npm start`.

## Category-based sidebar UI

The navigation is grouped into collapsible categories so the growing Phase 1-10 toolset remains readable. It includes Dashboard, AI Resource Studio, Adaptive Notes, Question Paper Studio, Course Planner, Revision Planner, Coding Lab, Case Studies, Flashcards, Voice Studio, Diagram Studio, Collaboration, Department Hub, Smart Search, Analytics and the admin-only Security Center. On mobile the sidebar becomes an animated drawer. See `UI_NAVIGATION_GUIDE.md`.

---

## Verified Student Identity & Impersonation Prevention Upgrade

This build adds a privacy-aware identity lock on top of the existing strict 2-second face-presence proctoring.

### New capabilities

- Student face enrollment with explicit consent
- One enrollment selfie for teacher/admin review
- Encrypted face descriptor and encrypted selfie storage using AES-256-GCM
- Teacher/admin approval or rejection workflow
- Local face embedding, anti-spoof and liveness processing
- Server-side face similarity comparison before quiz start
- Short-lived signed identity proof bound to the student, quiz and device
- Random continuous identity re-authentication during the quiz
- Immediate recheck after a mismatch
- Severe or repeated mismatch cancellation with score 0 and audit/security alerts
- Existing 2-second face-absence, multiple-face, camera, fullscreen, tab-switch, heartbeat, autosave and server-grading controls remain enabled

### Optional dedicated encryption secret

The feature works without a new environment variable by falling back to `AUDIT_HASH_SECRET` / `JWT_SECRET`. For production, set this before the first face enrollment and keep it stable:

```env
FACE_IDENTITY_SECRET=generate_a_third_different_64_byte_random_secret
```

Generate one with:

```powershell
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Changing this secret after students have enrolled will make the previously encrypted templates unreadable and will require re-enrollment.

### Usage

1. Student opens **Quiz Center → Verified Student Identity → Enrol face identity**.
2. Student consents, faces the camera and completes the local blink/liveness challenge.
3. Teacher/admin opens Quiz Center and approves the pending identity enrollment.
4. Teacher creates an identity-locked quiz (enabled by default for newly generated secure quizzes).
5. Student's live face must match before the attempt starts and at random intervals during the attempt.

See `docs/IDENTITY_VERIFICATION_GUIDE.md` for privacy, test cases and limitations.


## Clean Motion UI Upgrade

This package includes a cleaner SaaS-style interface, realistic spring micro-interactions, a Ctrl/Cmd+K command palette, API progress feedback, page-transition feedback, dashboard shortcuts, and an updated offline cache. Run `npm run test:ui` from the backend folder to verify the UI integration.
