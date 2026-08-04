function words(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean);
}

function sectionText(section) {
  return [section.summary, ...(section.explanation || []), ...(section.keyPoints || []), ...(section.applications || []), ...(section.commonMistakes || []), ...(section.examples || []).map((x) => x.description), section.caseStudy?.description].filter(Boolean).join(' ');
}

function overlapScore(a, b) {
  const aa = new Set(words(a.toLowerCase()).filter((x) => x.length > 4));
  const bb = new Set(words(b.toLowerCase()).filter((x) => x.length > 4));
  if (!aa.size || !bb.size) return 0;
  let common = 0;
  aa.forEach((x) => { if (bb.has(x)) common += 1; });
  return common / Math.min(aa.size, bb.size);
}

function validateDetailedReport(draft, inputs = {}) {
  const sections = draft.reportSections || [];
  const totalWords = sections.reduce((sum, section) => sum + words(sectionText(section)).length, 0);
  const visualCount = sections.filter((s) => s.visual && s.visual.type && s.visual.type !== 'none').length;
  const exampleCount = sections.reduce((sum, s) => sum + (s.examples || []).length, 0);
  const citationCount = sections.reduce((sum, s) => sum + (s.citations || []).length, 0);
  const duplicatePairs = [];
  for (let i = 0; i < sections.length; i += 1) {
    for (let j = i + 1; j < sections.length; j += 1) {
      const score = overlapScore(sectionText(sections[i]), sectionText(sections[j]));
      if (score > 0.72) duplicatePairs.push([sections[i].heading, sections[j].heading]);
    }
  }

  const depth = String(inputs.contentDepth || draft.contentDepth || 'standard').toLowerCase();
  const minimumWords = { quick: 500, standard: 1100, detailed: 2600, research: 4200 }[depth] || 1100;
  const checks = [
    { id: 'sections', label: 'Required section structure', passed: sections.length >= ({ quick: 5, standard: 7, detailed: 10, research: 12 }[depth] || 7), detail: `${sections.length} sections generated` },
    { id: 'depth', label: 'Minimum content depth', passed: totalWords >= minimumWords, detail: `${totalWords} words; target at least ${minimumWords}` },
    { id: 'examples', label: 'Examples included', passed: exampleCount >= Math.max(2, Math.floor(sections.length / 3)), detail: `${exampleCount} examples` },
    { id: 'visuals', label: 'Visual coverage', passed: !inputs.includeDiagrams || visualCount >= Math.max(2, Math.floor(sections.length / 4)), detail: `${visualCount} visual blocks` },
    { id: 'citations', label: 'Source citation coverage', passed: !inputs.includeReferences || !draft.references?.length || citationCount > 0, detail: `${citationCount} section citations` },
    { id: 'duplicates', label: 'No excessive duplicate sections', passed: duplicatePairs.length === 0, detail: duplicatePairs.length ? `${duplicatePairs.length} similar section pairs` : 'No high-overlap pairs detected' },
    { id: 'bloom', label: "Bloom's taxonomy included", passed: (draft.bloomQuestions || []).length >= 4, detail: `${(draft.bloomQuestions || []).length} Bloom questions` },
    { id: 'outcomes', label: 'Course outcome mapping included', passed: (draft.coMapping || []).length >= 2, detail: `${(draft.coMapping || []).length} outcome mappings` }
  ];
  const passed = checks.filter((x) => x.passed).length;
  const score = Math.round((passed / checks.length) * 100);
  return {
    score,
    grade: score >= 90 ? 'Export Ready' : score >= 75 ? 'Strong Draft' : score >= 60 ? 'Teacher Review Needed' : 'Needs Improvement',
    checks,
    totals: { sections: sections.length, words: totalWords, visuals: visualCount, examples: exampleCount, citations: citationCount },
    duplicatePairs,
    teacherReviewRequired: true
  };
}

module.exports = { validateDetailedReport, sectionText, overlapScore };
