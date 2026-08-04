const { callJson } = require('./aiGateway');
const { UNTRUSTED_REFERENCE_RULES } = require('./promptGuard');

function fallbackBeautify(rawText, topic) {
  const paras = String(rawText || '').split(/\n{2,}|\r\n\r\n/).map((p) => p.trim()).filter(Boolean);
  const sections = (paras.length ? paras : [rawText]).slice(0, 8).map((p, i) => {
    const sentences = p.split(/(?<=[.!?])\s+/).filter(Boolean);
    return {
      heading: sentences[0]?.slice(0, 70) || `${topic || 'Notes'} — Point ${i + 1}`,
      summary: sentences[0] || p.slice(0, 160),
      keyPoints: sentences.slice(1, 6).map((s) => s.trim()).filter(Boolean)
    };
  });
  return sections;
}

async function beautifyContent(rawText, topic = '') {
  const fallback = fallbackBeautify(rawText, topic);
  try {
    const system = `You turn a teacher's rough notes into clean, professional presentation slide content — clear headings, concise summaries, and punchy bullet points. Do not invent facts not present or clearly implied in the notes. ${UNTRUSTED_REFERENCE_RULES} Return JSON only.`;
    const prompt = `Topic: ${topic || '(not specified)'}\nRough notes:\n${String(rawText || '').slice(0, 6000)}\nRestructure this into 2-8 presentation-ready slide sections. Each needs a short clear heading, a 1-2 sentence summary, and 3-6 punchy key points (short phrases, not full paragraphs).\nReturn {"sections":[{"heading":"...","summary":"...","keyPoints":["..."]}]}`;
    const ai = await callJson(system, prompt);
    if (Array.isArray(ai.sections) && ai.sections.length) {
      return {
        sections: ai.sections.slice(0, 10).map((s) => ({
          heading: String(s.heading || '').slice(0, 90) || 'Untitled',
          summary: String(s.summary || '').slice(0, 260),
          keyPoints: (s.keyPoints || []).map((k) => String(k).slice(0, 140)).slice(0, 7)
        })),
        generationMode: 'ai'
      };
    }
  } catch (_) {}
  return { sections: fallback, generationMode: 'fallback' };
}

module.exports = { beautifyContent };
