# Phase 2 Testing Checklist

## Environment
- [ ] Node.js 18+
- [ ] MongoDB running/Atlas reachable
- [ ] `backend/.env` configured
- [ ] Gemini API key valid
- [ ] `npm install` completed
- [ ] `npm run test:phase2` passes

## Syllabus upload
- [ ] Valid text PDF uploads successfully
- [ ] Duplicate PDF returns existing indexed syllabus
- [ ] Non-PDF upload is rejected
- [ ] Oversized PDF is rejected
- [ ] Image-only PDF shows OCR/selectable-text warning
- [ ] Uploaded syllabus appears in selector
- [ ] Delete removes only the signed-in user's syllabus

## RAG generation
- [ ] Selected syllabus is used only when RAG toggle is enabled
- [ ] Generated output displays RAG badge
- [ ] Source cards show `[S1]` style evidence previews
- [ ] Retrieval mode shows semantic-hybrid when embeddings exist
- [ ] Lexical fallback works with `DISABLE_RAG_EMBEDDINGS=true`
- [ ] No syllabus selected results in General AI mode

## Bloom taxonomy
- [ ] All six level chips can be selected/deselected
- [ ] At least one selected level is enforced
- [ ] Requested count is between 4 and 12
- [ ] Generated Bloom cards include level, question, answer and rationale

## Course Outcomes
- [ ] One outcome per line is accepted
- [ ] Blank field produces AI-suggested outcomes
- [ ] CO mapping includes sections, Bloom levels and alignment score
- [ ] CO mapping persists after saving

## Quality score
- [ ] Overall score and grade render
- [ ] All five metric bars animate
- [ ] Strengths and improvements render
- [ ] Teacher-review warning remains visible

## Persistence and export
- [ ] Phase 2 resource saves to MongoDB
- [ ] Hub shows RAG and quality badges
- [ ] PDF export contains quality, Bloom and CO sections
- [ ] DOCX export contains quality, Bloom and CO sections
- [ ] Shared resource appears in Student Portal

## UI/UX
- [ ] Drag/drop works
- [ ] Upload progress animation works
- [ ] AI pipeline animation progresses through stages
- [ ] Cursor glow/ripple/reveal animations work
- [ ] UI remains usable on mobile width
- [ ] Reduced-motion operating-system preference is respected where supported
