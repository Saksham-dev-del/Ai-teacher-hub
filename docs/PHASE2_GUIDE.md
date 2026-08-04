# Phase 2 Technical Guide

## 1. Syllabus ingestion pipeline

```text
Teacher PDF
   ↓
Multer memory upload
   ↓
unpdf text extraction
   ↓
Text validation and normalization
   ↓
Paragraph/sentence-aware chunking with overlap
   ↓
Gemini embeddings (optional)
   ↓
MongoDB Syllabus document
```

The original PDF file is not permanently stored. The system stores normalized text chunks and their optional embeddings. A SHA-256 hash prevents duplicate indexing for the same user.

## 2. Retrieval pipeline

```text
Course + Subject + Topic + Resource Type + Bloom Levels
   ↓
Query embedding
   ↓
Cosine similarity against syllabus chunk embeddings
   +
Lexical term relevance
   ↓
Hybrid ranking
   ↓
Top syllabus chunks [S1]...[S5]
   ↓
Gemini generation prompt
```

Semantic retrieval is weighted more strongly than lexical retrieval. When embeddings are unavailable, the same endpoint automatically switches to lexical retrieval.

## 3. Grounded generation

The prompt instructs Gemini to:
- prioritize supplied syllabus evidence;
- use source tags such as `[S1]`;
- avoid inventing syllabus units, marks or prerequisites;
- distinguish generic knowledge from syllabus-attributed claims;
- return strict JSON for reliable UI rendering.

## 4. Bloom's Taxonomy

The UI allows six cognitive levels. The backend validates the selected levels, limits the requested count and asks Gemini to cover every selected level at least once.

Each generated Bloom item contains:
- level;
- question;
- suggested answer;
- rationale explaining the cognitive demand.

## 5. Course Outcome mapping

Faculty-provided outcomes are used exactly as mapping targets. If no outcomes are supplied, Gemini proposes concise measurable outcomes.

Each mapping contains:
- CO code;
- matched sections/question sets;
- related Bloom levels;
- justification;
- alignment percentage.

## 6. Quality scoring

The deterministic quality engine computes:
- completeness from section/question coverage and content length;
- clarity from sentence length;
- Bloom alignment from requested vs generated levels;
- CO alignment from mapped outcomes;
- syllabus grounding from retrieval coverage and source tags.

The final score blends deterministic checks with Gemini's structured self-review. It always returns `teacherReviewRequired: true`.

## 7. Data model additions

### Syllabus
- owner
- file hash
- course/subject
- page/word/chunk counts
- embedding mode/model
- chunks and optional vectors

### Resource
- Bloom questions
- Course Outcomes
- CO mappings
- quality score
- syllabus reference/name
- grounding metadata and retrieved evidence

## 8. Main Phase 2 endpoints

```text
GET    /api/syllabus
POST   /api/syllabus/upload
GET    /api/syllabus/:id/preview
DELETE /api/syllabus/:id
POST   /api/generate
POST   /api/resources
POST   /api/export/pdf
POST   /api/export/docx
```

## 9. Efficient operation

- PDFs are processed in memory and not written to disk.
- Duplicate files are detected before extraction/indexing.
- Embeddings are requested in batches.
- Retrieval returns a small configurable top-K evidence set.
- Lexical fallback prevents a temporary embedding failure from blocking syllabus use.
- Source previews, not complete syllabus text, are returned to the browser.
