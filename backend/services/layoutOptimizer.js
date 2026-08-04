const { callJson } = require('./aiGateway');
const { UNTRUSTED_REFERENCE_RULES } = require('./promptGuard');

const DENSITY_THRESHOLD = 160;

function wordCount(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function sectionWordCount(s) {
  return wordCount(s.summary) + (s.explanation || []).reduce((a, p) => a + wordCount(p), 0) + (s.keyPoints || []).reduce((a, p) => a + wordCount(p), 0);
}

function naiveSplit(section) {
  const explanation = section.explanation || [];
  const keyPoints = section.keyPoints || [];
  const midE = Math.ceil(explanation.length / 2) || 0;
  const midK = Math.ceil(keyPoints.length / 2) || 0;
  const partA = { ...section, heading: `${section.heading} (Part 1)`, explanation: explanation.slice(0, midE), keyPoints: keyPoints.slice(0, midK) };
  const partB = { ...section, heading: `${section.heading} (Part 2)`, explanation: explanation.slice(midE), keyPoints: keyPoints.slice(midK), visual: { type: 'none' }, table: null, caseStudy: null };
  return [partA, partB];
}

async function aiSplit(topic, section) {
  const system = `You reorganise a dense slide into two lighter, well-balanced slides without losing information. ${UNTRUSTED_REFERENCE_RULES} Return JSON only.`;
  const prompt = `Topic: ${topic}\nThis slide is too text-heavy for a presentation. Split it into two slides that together cover the same content, each with a clear heading, a short summary (1-2 sentences), 2-4 explanation paragraphs total between them, and 3-5 key points each.\nOriginal slide:\n${JSON.stringify({ heading: section.heading, summary: section.summary, explanation: section.explanation, keyPoints: section.keyPoints })}\nReturn {"parts":[{"heading":"...","summary":"...","explanation":["..."],"keyPoints":["..."]},{"heading":"...","summary":"...","explanation":["..."],"keyPoints":["..."]}]}`;
  const ai = await callJson(system, prompt);
  if (!Array.isArray(ai.parts) || ai.parts.length !== 2) throw new Error('Split did not return two parts.');
  return ai.parts.map((p, i) => ({
    ...section,
    heading: String(p.heading || `${section.heading} (Part ${i + 1})`).slice(0, 120),
    summary: String(p.summary || '').slice(0, 300),
    explanation: (p.explanation || []).map((x) => String(x).slice(0, 400)).slice(0, 4),
    keyPoints: (p.keyPoints || []).map((x) => String(x).slice(0, 160)).slice(0, 6),
    ...(i === 1 ? { visual: { type: 'none' }, table: null, caseStudy: null } : {})
  }));
}

async function optimizeLayout(draft) {
  const sections = Array.isArray(draft.reportSections) ? draft.reportSections : [];
  if (!sections.length) throw new Error('This presentation has no sections yet — generate it first.');

  const updated = [];
  const warnings = [];
  let splitCount = 0;

  for (const section of sections) {
    if (sectionWordCount(section) <= DENSITY_THRESHOLD) { updated.push(section); continue; }
    try {
      const parts = await aiSplit(draft.topic || '', section);
      updated.push(...parts);
      splitCount += 1;
    } catch (error) {
      warnings.push(`"${section.heading}" could not be AI-split (${error.message}); used a simple even split instead.`);
      updated.push(...naiveSplit(section));
      splitCount += 1;
    }
  }

  return { draft: { ...draft, reportSections: updated }, splitCount, warnings };
}

module.exports = { optimizeLayout, sectionWordCount, DENSITY_THRESHOLD };
