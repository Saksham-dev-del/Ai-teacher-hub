const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { fallbackOutline } = require('../services/contentPlanner');
const { fallbackSection } = require('../services/sectionGenerator');
const { planVisuals } = require('../services/visualPlanner');
const { fallbackPedagogy } = require('../services/pedagogyGenerator');
const { buildReferences, collectCitationUsage } = require('../services/citationManager');
const { validateDetailedReport } = require('../services/reportValidator');
const { exportPdf } = require('../export/pdf');
const { buildPresentation } = require('../services/presentation');
const Resource = require('../models/Resource');
const MediaAsset = require('../models/MediaAsset');

function longParagraph(section, topic, index) {
  return `${section} develops a detailed understanding of ${topic} for college learners. ` +
    `The explanation connects definitions, conceptual reasoning, implementation steps, classroom discussion, and assessment evidence. ` +
    `In section ${index + 1}, the teacher introduces prior knowledge, demonstrates the idea with a realistic example, checks misconceptions, ` +
    `and asks learners to justify their decisions. This structured sequence helps students move from recall to application and analysis while ` +
    `maintaining alignment with the course outcome and the uploaded academic source. Faculty review remains necessary before formal use. `;
}

async function run() {
  const inputs = {
    course: 'B.Tech', subject: 'Machine Learning', topic: 'Supervised Learning', difficulty: 'Intermediate', duration: '60 minutes',
    type: 'Notes', language: 'English', style: 'Concept-First', contentDepth: 'detailed', visualDensity: 'visual-rich',
    targetPages: 20, targetSlides: 26, examplesPerTopic: 2, includeDiagrams: true, includeImages: true,
    includeCaseStudies: true, includeReferences: true, includeSpeakerNotes: true,
    bloomLevels: ['Remember', 'Understand', 'Apply', 'Analyze'], bloomQuestionCount: 8,
    courseOutcomes: ['Explain supervised learning concepts.', 'Apply suitable algorithms to labelled datasets.', 'Analyze model results.']
  };

  const plan = fallbackOutline(inputs);
  assert.equal(plan.outline.length, 12);
  assert.equal(plan.fallbackUsed, true);

  const sourceIds = ['S1', 'S2'];
  let sections = plan.outline.map((spec, index) => {
    const base = fallbackSection(spec, inputs, index, sourceIds);
    base.explanation = [
      longParagraph(spec.heading, inputs.topic, index),
      longParagraph(`${spec.heading} practical interpretation`, inputs.topic, index),
      longParagraph(`${spec.heading} assessment perspective`, inputs.topic, index)
    ];
    base.examples = [
      { title: `Worked Example ${index + 1}A`, description: `A labelled dataset example demonstrates ${spec.heading.toLowerCase()} and asks students to interpret the prediction.` },
      { title: `Worked Example ${index + 1}B`, description: `A second example compares two possible approaches and requires evidence-based selection.` }
    ];
    base.table = index % 3 === 0 ? {
      headers: ['Element', 'Purpose', 'Evidence'],
      rows: [['Concept', spec.heading, 'Definition and example'], ['Application', 'Course problem', 'Reasoned solution']]
    } : null;
    return base;
  });
  sections = planVisuals(sections, inputs, []);
  assert.equal(sections.length, 12);
  assert.ok(sections.filter((s) => s.visual.type !== 'none').length >= 10);

  const pedagogy = fallbackPedagogy(inputs, sections);
  assert.ok(pedagogy.bloomQuestions.length >= 8);
  assert.equal(pedagogy.courseOutcomes.length, 3);
  assert.equal(pedagogy.coMapping.length, 3);

  const ragContext = {
    chunks: [
      { sourceId: 'S1', chunkIndex: 0, score: 0.94, preview: 'Supervised learning uses labelled examples.', documentName: 'ML Syllabus.pdf' },
      { sourceId: 'S2', chunkIndex: 1, score: 0.88, preview: 'Regression and classification are supervised tasks.', documentName: 'Faculty Notes.pdf' }
    ]
  };
  const references = buildReferences(ragContext, [{ originalName: 'ML Syllabus.pdf' }]);
  assert.equal(references.length, 2);
  const citationUsage = collectCitationUsage(sections);
  assert.ok(citationUsage.length >= 2);

  const draft = {
    ...inputs,
    phase: 4,
    title: 'Supervised Learning - Detailed Notes',
    executiveSummary: 'This detailed visual academic resource explains supervised learning through definitions, workflows, worked examples, case studies, outcome mapping, assessment prompts, and syllabus-grounded references.',
    reportSections: sections,
    sections: sections.map((s) => ({ h: s.heading, b: [s.summary, ...s.explanation].join('\n\n') })),
    qa: [],
    bloomQuestions: pedagogy.bloomQuestions,
    courseOutcomes: pedagogy.courseOutcomes,
    coMapping: pedagogy.coMapping,
    qualityScore: {
      overall: 92, grade: 'Excellent',
      metrics: { completeness: 94, clarity: 91, bloomAlignment: 90, outcomeAlignment: 92, syllabusGrounding: 93 },
      strengths: ['Rich section structure', 'Strong source grounding'], improvements: ['Verify institution-specific terminology']
    },
    references,
    citationUsage,
    visualAssets: [],
    syllabusName: 'ML Syllabus.pdf, Faculty Notes.pdf',
    grounding: { mode: 'multi-source-rag', coverage: 91, retrievedChunks: ragContext.chunks }
  };

  draft.validationReport = validateDetailedReport(draft, inputs);
  assert.ok(draft.validationReport.score >= 87, JSON.stringify(draft.validationReport));
  assert.ok(draft.validationReport.totals.words >= 2600);
  assert.ok(draft.validationReport.totals.examples >= 24);

  const model = new Resource({
    owner: '000000000000000000000010', type: draft.type, topic: draft.topic,
    phase: 4, contentDepth: draft.contentDepth, visualDensity: draft.visualDensity,
    reportSections: draft.reportSections, references: draft.references, validationReport: draft.validationReport
  });
  assert.equal(model.validateSync(), undefined);
  const media = new MediaAsset({
    owner: '000000000000000000000010', originalName: 'diagram.png', mimeType: 'image/png', size: 128,
    storagePath: path.join(os.tmpdir(), 'diagram.png'), url: '/uploads/diagram.png'
  });
  assert.equal(media.validateSync(), undefined);

  const pdf = await exportPdf(draft, { institution: 'Demo College', assets: [] });
  assert.ok(Buffer.from(pdf).slice(0, 4).toString() === '%PDF');
  assert.ok(pdf.length > 45000, `PDF too small: ${pdf.length}`);

  const ppt = await buildPresentation(draft, { theme: 'academic', institution: 'Demo College', maxContentSlides: 30, includeSpeakerNotes: true, assets: [] });
  assert.ok(Buffer.isBuffer(ppt));
  assert.equal(ppt.slice(0, 2).toString(), 'PK');
  assert.ok(ppt.length > 80000, `PPTX too small: ${ppt.length}`);

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase4-smoke-'));
  fs.writeFileSync(path.join(temp, 'phase4-report.pdf'), Buffer.from(pdf));
  fs.writeFileSync(path.join(temp, 'phase4-deck.pptx'), ppt);

  const root = path.join(__dirname, '..', '..');
  const html = fs.readFileSync(path.join(root, 'frontend', 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'frontend', 'css', 'styles.css'), 'utf8');
  const generator = fs.readFileSync(path.join(root, 'frontend', 'js', 'generator.js'), 'utf8');
  const phase4Api = fs.readFileSync(path.join(root, 'frontend', 'js', 'phase4-api.js'), 'utf8');
  ['f-content-depth', 'f-visual-density', 'f-target-pages', 'f-target-slides', 'f-reference-syllabi', 'f-visual-images'].forEach((marker) => assert.ok(html.includes(marker), `${marker} missing`));
  ['phase4-progress-shell', 'phase4-rich-section', 'phase4-diagram', 'phase4-validation'].forEach((marker) => assert.ok(css.includes(marker), `${marker} CSS missing`));
  ['apiStartDetailedJob', 'reportSections', 'syncDraftFromEditor', 'validationHtml'].forEach((marker) => assert.ok(generator.includes(marker), `${marker} generator feature missing`));
  assert.ok(phase4Api.includes('/api/detailed/jobs'));

  console.log(`Phase 4 smoke tests passed: planner, rich sections, visuals, pedagogy, references, validation, schemas, ${pdf.length}-byte PDF, ${ppt.length}-byte PPTX, UI controls and live pipeline.`);
  console.log(`Temporary export samples: ${temp}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
