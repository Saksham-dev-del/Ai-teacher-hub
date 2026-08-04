const { callJson } = require('./aiGateway');
const { UNTRUSTED_REFERENCE_RULES } = require('./promptGuard');

const SUPPORTED_LANGUAGES = ['English', 'Hindi', 'Hinglish', 'French', 'German', 'Japanese'];

function cleanArr(v, max = 12) {
  return Array.isArray(v) ? v.map((x) => String(x || '').trim()).filter(Boolean).slice(0, max) : [];
}

function sectionPayload(s) {
  return {
    heading: s.heading,
    summary: s.summary,
    explanation: s.explanation,
    keyPoints: s.keyPoints,
    speakerNotes: s.speakerNotes,
    caseStudyTitle: s.caseStudy?.title || null,
    caseStudyDescription: s.caseStudy?.description || null,
    tableHeaders: s.table?.headers || null,
    examples: (s.examples || []).map((e) => ({ title: e.title, description: e.description }))
  };
}

async function translateBatch(targetLanguage, topic, sections) {
  const system = `You are a professional academic translator. Translate the given slide sections into ${targetLanguage} while keeping meaning, technical terms and structure intact. ${targetLanguage === 'Hinglish' ? 'Hinglish means Hindi content written in Roman/English script, mixed naturally with common English technical terms, the way Indian teachers actually speak.' : ''} ${UNTRUSTED_REFERENCE_RULES} Return JSON only.`;
  const prompt = `Target language: ${targetLanguage}\nTopic: ${topic}\nTranslate every text field below into ${targetLanguage}. Keep the same array lengths and structure (do not add or remove items). Leave "index" unchanged.\nSections:\n${JSON.stringify(sections.map((s, i) => ({ index: i, ...sectionPayload(s) })))}\nReturn {"sections":[{"index":0,"heading":"...","summary":"...","explanation":["..."],"keyPoints":["..."],"speakerNotes":"...","caseStudyTitle":"...","caseStudyDescription":"...","tableHeaders":["..."],"examples":[{"title":"...","description":"..."}]}]}`;
  const ai = await callJson(system, prompt);
  if (!Array.isArray(ai.sections)) throw new Error('Translation batch returned no sections.');
  return ai.sections;
}

async function translateDraft(draft, targetLanguage) {
  const language = SUPPORTED_LANGUAGES.includes(targetLanguage) ? targetLanguage : 'English';
  const sections = Array.isArray(draft.reportSections) ? draft.reportSections : [];
  if (!sections.length) throw new Error('This presentation has no sections yet — generate it first.');

  const batchSize = 5;
  const updated = sections.map((s) => ({ ...s, caseStudy: s.caseStudy ? { ...s.caseStudy } : null, table: s.table ? { ...s.table, headers: [...s.table.headers] } : null, examples: (s.examples || []).map((e) => ({ ...e })) }));
  const warnings = [];

  for (let i = 0; i < sections.length; i += batchSize) {
    const batch = sections.slice(i, i + batchSize);
    try {
      const translated = await translateBatch(language, draft.topic || '', batch);
      translated.forEach((r) => {
        const gi = i + Number(r.index || 0);
        if (!updated[gi]) return;
        if (r.heading) updated[gi].heading = String(r.heading).trim();
        if (r.summary) updated[gi].summary = String(r.summary).trim();
        if (Array.isArray(r.explanation) && r.explanation.length) updated[gi].explanation = cleanArr(r.explanation, 6);
        if (Array.isArray(r.keyPoints) && r.keyPoints.length) updated[gi].keyPoints = cleanArr(r.keyPoints, 10);
        if (r.speakerNotes) updated[gi].speakerNotes = String(r.speakerNotes).trim();
        if (updated[gi].caseStudy) {
          if (r.caseStudyTitle) updated[gi].caseStudy.title = String(r.caseStudyTitle).trim();
          if (r.caseStudyDescription) updated[gi].caseStudy.description = String(r.caseStudyDescription).trim();
        }
        if (updated[gi].table && Array.isArray(r.tableHeaders) && r.tableHeaders.length === updated[gi].table.headers.length) {
          updated[gi].table.headers = r.tableHeaders.map((h) => String(h).trim());
        }
        if (Array.isArray(r.examples) && r.examples.length === (updated[gi].examples || []).length) {
          updated[gi].examples = r.examples.map((e, ei) => ({ ...updated[gi].examples[ei], title: e.title || updated[gi].examples[ei].title, description: e.description || updated[gi].examples[ei].description }));
        }
      });
    } catch (error) {
      warnings.push(`Sections ${i + 1}-${Math.min(sections.length, i + batchSize)} could not be translated: ${error.message}`);
    }
  }

  return { draft: { ...draft, reportSections: updated, language, lastTranslatedTo: language }, warnings };
}

module.exports = { translateDraft, SUPPORTED_LANGUAGES };
