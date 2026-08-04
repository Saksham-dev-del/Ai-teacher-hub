# Phase 4 Technical Guide

## 1. Objective

Phase 4 upgrades short academic generation into a detailed visual content studio. It creates teacher-reviewable long-form reports and editable lecture presentations rather than placing one short AI response directly into a PDF or PPT.

## 2. Multi-Stage Generation Architecture

```text
Frontend form
   ↓
POST /api/detailed/jobs
   ↓
Academic source loading
   ↓
Multi-source RAG retrieval
   ↓
Content planner
   ↓
Batched section generator
   ↓
Visual planner
   ↓
Pedagogy generator
   ↓
Reference manager
   ↓
Quality + export validation
   ↓
GET /api/detailed/jobs/:id polling
   ↓
Teacher preview / edit / save / export
```

### Why generation is staged

A single prompt often returns short, repetitive or incomplete material. Phase 4 first creates a logical outline and then expands groups of sections. This improves structure, makes progress visible and allows individual failed batches to use deterministic fallback content.

## 3. Content Planner

`services/contentPlanner.js` controls four modes:

| Mode | Sections | Approx. words/section | Default pages | Default slides |
|---|---:|---:|---:|---:|
| Quick | 6 | 120 | 6 | 10 |
| Standard | 8 | 210 | 10 | 16 |
| Detailed | 12 | 340 | 20 | 26 |
| Research | 15 | 480 | 32 | 36 |

The planner returns a title, executive summary and ordered outline with a visual hint per section.

## 4. Section Generator

`services/sectionGenerator.js` generates sections in batches. Each section supports:

```json
{
  "heading": "string",
  "summary": "string",
  "explanation": ["paragraph"],
  "keyPoints": ["string"],
  "examples": [{"title":"string","description":"string"}],
  "applications": ["string"],
  "commonMistakes": ["string"],
  "caseStudy": {"title":"string","description":"string"},
  "table": {"headers":["string"],"rows":[["string"]]},
  "visual": {"type":"flowchart","title":"string","nodes":["string"],"caption":"string"},
  "speakerNotes": "string",
  "citations": ["S1"]
}
```

If an AI batch fails, the system preserves the full report structure by creating deterministic teacher-reviewable fallback sections.

## 5. Multi-Source RAG

The teacher can select several indexed syllabus/reference PDFs. The backend retrieves relevant chunks and preserves source identifiers in the generated report.

RAG output includes:

- retrieval mode;
- coverage;
- embedding model;
- source ID;
- document name;
- chunk index;
- relevance score;
- evidence preview.

## 6. Visual Planner

`services/visualPlanner.js` assigns a visual to sections according to Visual Density.

- Text Focused: approximately one visual per four sections
- Balanced: approximately one visual per two sections
- Visual Rich: visual planning for every major section

Supported automatic visual forms:

- process;
- flowchart;
- concept map;
- comparison;
- timeline;
- table;
- uploaded image.

## 7. Teacher Image Library

`routes/media.js` allows Teacher/Admin accounts to upload PNG or JPG assets. Files are stored in `backend/uploads/<userId>` and their metadata is stored in MongoDB.

Images can be selected from the generator and embedded in detailed PDF and PPTX exports.

## 8. Pedagogy Metadata

`services/pedagogyGenerator.js` creates:

- Bloom-level questions;
- answer guidance;
- pedagogical rationale;
- measurable Course Outcomes;
- CO-to-section mapping;
- Bloom alignment;
- alignment score.

## 9. Export Validation

`services/reportValidator.js` checks:

- required section count;
- minimum word depth;
- number of examples;
- visual coverage;
- citation coverage;
- duplicate-section similarity;
- Bloom question coverage;
- Course Outcome mapping.

It returns an Export Ready / Strong Draft / Teacher Review Needed / Needs Improvement grade. It never removes the requirement for faculty verification.

## 10. Detailed PDF Export

`export/detailedPdf.js` builds a multi-page A4 report with:

- cover;
- profile and table of contents;
- outcomes;
- rich section layout;
- examples and case studies;
- tables;
- vector diagrams or images;
- speaker notes;
- Bloom questions;
- CO mapping;
- quality and validation;
- references;
- page numbers.

## 11. Detailed PowerPoint Export

`services/presentation.js` creates an editable wide-screen deck. It uses separate layouts for concept, example, case study, comparison, questions, outcome mapping, validation and references.

Speaker notes are written to native PowerPoint note slides when enabled.

## 12. Live Progress

The server stores short-lived generation jobs in memory. The browser polls job progress and displays real stages rather than a fake timer.

Stages:

1. Source loading
2. Planning
3. Outline ready
4. Section expansion
5. Visual planning
6. Pedagogy mapping
7. Validation
8. Complete

## 13. Security

- AI keys remain in `backend/.env`.
- Uploaded images are scoped to the authenticated owner.
- Saved resources are scoped to their owner.
- Admin access is explicitly checked.
- `.env` and uploaded local files are excluded from source-control packaging.
