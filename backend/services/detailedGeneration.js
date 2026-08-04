const { planDetailedContent } = require('./contentPlanner');
const { generateDetailedSections } = require('./sectionGenerator');
const { planVisuals } = require('./visualPlanner');
const { buildReferences, collectCitationUsage } = require('./citationManager');
const { validateDetailedReport } = require('./reportValidator');
const { generatePedagogyMetadata } = require('./pedagogyGenerator');
const { buildQualityScore } = require('./quality');

function flattenSections(reportSections = []) {
  return reportSections.map((section) => ({
    h: section.heading,
    b: [section.summary, ...(section.explanation || []), ...(section.keyPoints || []).map((x) => `• ${x}`), ...(section.examples || []).map((x) => `${x.title}: ${x.description}`)].filter(Boolean).join('\n\n')
  }));
}

async function runDetailedGeneration({ inputs, ragContext, syllabi, mediaAssets, onProgress }) {
  const warnings = [];
  onProgress?.({ stage: 'planning', progress: 8, message: 'Analysing course brief and building the report architecture' });
  const plan = await planDetailedContent(inputs, ragContext);
  if (plan.plannerWarning) warnings.push(plan.plannerWarning);

  onProgress?.({ stage: 'outline-ready', progress: 20, message: `Outline ready with ${plan.outline.length} academic sections` });
  const generated = await generateDetailedSections({ inputs, plan, ragContext, onProgress });
  warnings.push(...generated.warnings);

  onProgress?.({ stage: 'visuals', progress: 70, message: 'Planning diagrams, tables, case studies and image placement' });
  const reportSections = planVisuals(generated.sections, inputs, mediaAssets);

  onProgress?.({ stage: 'pedagogy', progress: 78, message: "Generating Bloom questions and course-outcome mapping" });
  const pedagogy = await generatePedagogyMetadata(inputs, reportSections);
  warnings.push(...(pedagogy.warnings || []));

  const references = inputs.includeReferences ? buildReferences(ragContext, syllabi) : [];
  const sections = flattenSections(reportSections);
  const qualityInput = { ...inputs, sections, qa: [], bloomQuestions: pedagogy.bloomQuestions, courseOutcomes: pedagogy.courseOutcomes, coMapping: pedagogy.coMapping, qualityReview: pedagogy.qualityReview };
  const qualityScore = buildQualityScore(qualityInput, inputs, ragContext);

  const draft = {
    ...inputs,
    title: plan.title,
    executiveSummary: plan.executiveSummary,
    style: inputs.style || 'Concept-First',
    reportSections,
    sections,
    qa: [],
    bloomQuestions: pedagogy.bloomQuestions,
    courseOutcomes: pedagogy.courseOutcomes,
    coMapping: pedagogy.coMapping,
    qualityScore,
    references,
    citationUsage: collectCitationUsage(reportSections),
    visualAssets: mediaAssets.map((asset) => ({ _id: asset._id, originalName: asset.originalName, url: asset.url, caption: asset.caption || '' })),
    generationWarnings: warnings,
    phase: 4,
    generatedAt: new Date().toISOString()
  };

  onProgress?.({ stage: 'validation', progress: 91, message: 'Running content-depth, visual and citation quality checks' });
  draft.validationReport = validateDetailedReport(draft, inputs);

  onProgress?.({ stage: 'complete', progress: 100, message: 'Detailed visual resource is ready for teacher review and export' });
  return draft;
}

module.exports = { runDetailedGeneration, flattenSections };
