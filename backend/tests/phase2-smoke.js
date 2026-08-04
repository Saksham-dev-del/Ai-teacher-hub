const assert = require('assert');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const { chunkText, retrieveRelevantChunks, cosineSimilarity } = require('../services/rag');
const { buildQualityScore } = require('../services/quality');
const { exportPdf } = require('../export/pdf');
const { exportDocx } = require('../export/docx');

async function testPdfExtraction() {
  const document = await PDFDocument.create();
  const page = document.addPage([600, 800]);
  const font = await document.embedFont(StandardFonts.Helvetica);
  page.drawText(
    'B.Tech DBMS Syllabus. Unit 1: Functional dependencies and normalization. CO1: Explain database concepts. CO2: Apply 1NF, 2NF and 3NF.',
    { x: 45, y: 730, size: 12, font, maxWidth: 510, lineHeight: 18 }
  );
  const bytes = await document.save();
  const { extractText, getDocumentProxy } = await import('unpdf');
  const proxy = await getDocumentProxy(new Uint8Array(bytes));
  const parsed = await extractText(proxy, { mergePages: true });
  assert.strictEqual(parsed.totalPages, 1);
  assert.match(parsed.text, /normalization/i);
}

async function testRagAndQuality() {
  const raw = [
    'Unit 1. Database fundamentals, schemas and relational model.',
    'Unit 2. Functional dependencies, first normal form, second normal form and third normal form.',
    'Unit 3. Transactions, concurrency control and recovery.'
  ].join('\n\n');
  const chunks = chunkText(raw, { size: 90, overlap: 15 });
  assert.ok(chunks.length >= 2);

  const retrieval = await retrieveRelevantChunks(
    { chunks: chunks.map((chunk) => ({ ...chunk, embedding: undefined })) },
    'normalization 1NF 2NF 3NF',
    2
  );
  assert.strictEqual(retrieval.mode, 'lexical');
  assert.match(retrieval.chunks[0].text, /normal form/i);
  assert.strictEqual(cosineSimilarity([1, 0], [1, 0]), 1);

  const result = {
    sections: [
      { h: 'Learning Objective', b: 'Explain normalization and apply 1NF, 2NF and 3NF using a database schema [S1].' },
      { h: 'Worked Example', b: 'Students decompose a relation and explain every dependency clearly [S1].' },
      { h: 'Assessment', b: 'Use an application question followed by analysis and reflection.' }
    ],
    qa: [],
    bloomQuestions: [
      { level: 'Remember', question: 'Define 1NF.', answer: 'Atomic values.' },
      { level: 'Apply', question: 'Convert a relation to 2NF.', answer: 'Remove partial dependencies.' },
      { level: 'Analyze', question: 'Analyze anomalies.', answer: 'Identify update, insertion and deletion anomalies.' }
    ],
    courseOutcomes: [
      { code: 'CO1', text: 'Explain normalization.' },
      { code: 'CO2', text: 'Apply normalization.' }
    ],
    coMapping: [
      { courseOutcome: 'CO1', matchedSections: ['Learning Objective'], bloomLevels: ['Remember'], alignmentScore: 90 },
      { courseOutcome: 'CO2', matchedSections: ['Worked Example'], bloomLevels: ['Apply', 'Analyze'], alignmentScore: 92 }
    ],
    qualityReview: {
      accuracy: 88,
      clarity: 90,
      alignment: 91,
      pedagogicalValue: 89,
      strengths: ['Clear progression'],
      improvements: ['Add one more example']
    }
  };

  const score = buildQualityScore(
    result,
    { bloomLevels: ['Remember', 'Apply', 'Analyze'] },
    { chunks: retrieval.chunks, coverage: 80 }
  );
  assert.ok(score.overall >= 60 && score.overall <= 100);
  assert.strictEqual(score.teacherReviewRequired, true);

  const draft = {
    ...result,
    qualityScore: score,
    type: 'Lesson Plan',
    topic: 'Normalization',
    course: 'B.Tech',
    subject: 'DBMS',
    difficulty: 'Intermediate',
    duration: '45 minutes',
    syllabusName: 'dbms-syllabus.pdf',
    grounding: {
      mode: 'lexical',
      coverage: 80,
      embeddingModel: '',
      retrievedChunks: retrieval.chunks
    }
  };
  const pdf = await exportPdf(draft);
  const docx = await exportDocx(draft);
  assert.ok(pdf.length > 500);
  assert.ok(docx.length > 1000);
}

(async () => {
  await testPdfExtraction();
  await testRagAndQuality();
  console.log('Phase 2 smoke tests passed: PDF extraction, chunking, RAG fallback, quality scoring and exports.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
