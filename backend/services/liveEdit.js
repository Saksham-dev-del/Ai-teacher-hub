const { callJson } = require('./aiGateway');
const { UNTRUSTED_REFERENCE_RULES } = require('./promptGuard');

function cleanArr(v, max = 10) {
  return Array.isArray(v) ? v.map((x) => String(x || '').trim()).filter(Boolean).slice(0, max) : [];
}

async function reviseBatch(instruction, topic, sections) {
  const system = `You are a senior faculty editor. Revise presentation slide text per the teacher's instruction while preserving factual meaning, technical accuracy and the same number of sections. ${UNTRUSTED_REFERENCE_RULES} Return JSON only.`;
  const prompt = `Instruction: "${instruction}"
Topic: ${topic}
Revise the following slide sections to follow the instruction. Keep each section's heading and meaning intact, keep roughly the same explanation paragraph count and keyPoints count.
Sections:
${JSON.stringify(sections.map((s, i) => ({
  index: i,
  heading: s.heading,
  summary: s.summary,
  explanation: s.explanation,
  keyPoints: s.keyPoints,
  speakerNotes: s.speakerNotes,
  caseStudyDescription: s.caseStudy?.description || null
})))}
Return {"sections":[{"index":0,"summary":"...","explanation":["..."],"keyPoints":["..."],"speakerNotes":"...","caseStudyDescription":"..."}]}`;
  const ai = await callJson(system, prompt);
  if (!Array.isArray(ai.sections)) throw new Error('Live edit batch returned no sections.');
  return ai.sections;
}

async function liveEditDraft(draft, instruction) {
  const sections = Array.isArray(draft.reportSections) ? draft.reportSections : [];
  if (!sections.length) throw new Error('This presentation has no editable sections yet — generate it first.');
  if (!instruction || !instruction.trim()) throw new Error('Describe what you want changed (e.g. "make this more professional").');

  const batchSize = 6;
  const updated = sections.map((s) => ({ ...s }));
  const warnings = [];

  for (let i = 0; i < sections.length; i += batchSize) {
    const batch = sections.slice(i, i + batchSize);
    try {
      const revised = await reviseBatch(instruction, draft.topic || '', batch);
      revised.forEach((r) => {
        const globalIndex = i + Number(r.index || 0);
        if (!updated[globalIndex]) return;
        if (r.summary) updated[globalIndex].summary = String(r.summary).trim();
        if (Array.isArray(r.explanation) && r.explanation.length) updated[globalIndex].explanation = cleanArr(r.explanation, 6);
        if (Array.isArray(r.keyPoints) && r.keyPoints.length) updated[globalIndex].keyPoints = cleanArr(r.keyPoints, 10);
        if (r.speakerNotes) updated[globalIndex].speakerNotes = String(r.speakerNotes).trim();
        if (r.caseStudyDescription && updated[globalIndex].caseStudy) {
          updated[globalIndex].caseStudy = { ...updated[globalIndex].caseStudy, description: String(r.caseStudyDescription).trim() };
        }
      });
    } catch (error) {
      warnings.push(`Sections ${i + 1}-${Math.min(sections.length, i + batchSize)} could not be revised: ${error.message}`);
    }
  }

  return { draft: { ...draft, reportSections: updated, lastLiveEditInstruction: instruction.trim() }, warnings };
}

module.exports = { liveEditDraft };
