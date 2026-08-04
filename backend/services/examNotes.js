const { callJson } = require('./aiGateway');
const { UNTRUSTED_REFERENCE_RULES } = require('./promptGuard');

function fallbackExamNotes(draft) {
  const sections = draft.reportSections || [];
  const notes = sections.slice(0, 12).map((s) => ({
    heading: s.heading,
    points: (s.keyPoints && s.keyPoints.length ? s.keyPoints : [s.summary]).filter(Boolean).slice(0, 4)
  }));
  const flashcards = [];
  sections.forEach((s) => {
    (s.keyPoints || []).slice(0, 2).forEach((kp) => {
      flashcards.push({ front: `${s.heading}: key point?`, back: kp });
    });
  });
  if (!flashcards.length) sections.forEach((s) => s.summary && flashcards.push({ front: s.heading, back: s.summary }));
  return {
    title: `${draft.topic} — Exam Notes`,
    oneLineSummary: draft.reportSections?.[0]?.summary || `Quick revision notes for ${draft.topic}.`,
    notes,
    flashcards: flashcards.slice(0, 20)
  };
}

async function generateExamNotes(draft) {
  const sections = draft.reportSections || [];
  if (!sections.length) throw new Error('This presentation has no sections yet — generate it first.');
  const fallback = fallbackExamNotes(draft);

  try {
    const system = `You create concise one-page exam revision notes and flashcards for students from lecture content. ${UNTRUSTED_REFERENCE_RULES} Return JSON only.`;
    const prompt = `Topic: ${draft.topic}\nCondense these slide sections into a ONE-PAGE exam revision sheet (short, high-yield, no fluff) plus flashcards.\nSections:\n${JSON.stringify(sections.slice(0, 16).map((s) => ({ heading: s.heading, summary: s.summary, keyPoints: s.keyPoints })))}\nReturn {"title":"...","oneLineSummary":"...","notes":[{"heading":"...","points":["..."]}],"flashcards":[{"front":"question or term","back":"concise answer"}]}. Maximum 12 note sections (2-4 points each), 20 flashcards.`;
    const ai = await callJson(system, prompt);
    if (Array.isArray(ai.notes) && ai.notes.length) {
      return {
        title: String(ai.title || fallback.title).slice(0, 150),
        oneLineSummary: String(ai.oneLineSummary || fallback.oneLineSummary).slice(0, 300),
        notes: ai.notes.slice(0, 12).map((n) => ({ heading: String(n.heading || '').slice(0, 90), points: (n.points || []).map((p) => String(p).slice(0, 160)).slice(0, 5) })),
        flashcards: (Array.isArray(ai.flashcards) ? ai.flashcards : fallback.flashcards).slice(0, 24).map((f) => ({ front: String(f.front || '').slice(0, 160), back: String(f.back || '').slice(0, 220) })),
        generationMode: 'ai'
      };
    }
  } catch (_) {}
  return { ...fallback, generationMode: 'fallback' };
}

module.exports = { generateExamNotes };
