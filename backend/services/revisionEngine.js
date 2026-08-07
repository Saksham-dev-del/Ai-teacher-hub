const { callJson } = require('./aiGateway');
const { UNTRUSTED_REFERENCE_RULES } = require('./promptGuard');

function fallbackRevisionPack(topic) {
  return {
    notes: [`${topic}: review the definition, one worked example, and common mistakes.`],
    flashcards: [{ front: `What is ${topic}?`, back: 'Review the concept explanation above.' }],
    mindmap: { nodes: [topic, 'Definition', 'Example', 'Use Case', 'Related Topic'], edges: [[0, 1], [0, 2], [0, 3], [0, 4]] },
    cheatsheet: [`Key point about ${topic}`, 'Common pitfall to avoid', 'One example to remember'],
    interviewQuestions: [`Can you explain ${topic} in your own words?`],
    mcqs: [{ question: `Which best describes ${topic}?`, options: ['A relevant concept', 'Unrelated', 'A syntax error', 'A hardware term'], correctIndex: 0 }],
    codingProblems: [{ title: `Practice: ${topic}`, prompt: `Write a short program or pseudocode that demonstrates ${topic}.` }]
  };
}

async function generateRevisionPack(topic, conceptType = '') {
  const fallback = fallbackRevisionPack(topic);
  try {
    const system = `You are an exam-revision content generator for a specific CS/academic topic. Be concise and high-yield, not verbose. ${UNTRUSTED_REFERENCE_RULES} Return JSON only.`;
    const prompt = `Topic: "${topic}" (${conceptType})\nGenerate a complete revision pack:\n- notes: 4-6 short high-yield bullet notes\n- flashcards: 5-8 {front,back} pairs\n- mindmap: {nodes:["${topic}", ...4-6 related sub-ideas], edges:[[0,1],[0,2],...]} (index-based, node 0 is the topic itself)\n- cheatsheet: 4-6 ultra-short one-liners\n- interviewQuestions: 3-5 questions an interviewer might ask about this\n- mcqs: 4 {question, options:[4], correctIndex}\n- codingProblems: 2 {title, prompt} short coding/practice problems (skip if the topic isn't code-related — return an empty array then)\nReturn {"notes":[...],"flashcards":[...],"mindmap":{...},"cheatsheet":[...],"interviewQuestions":[...],"mcqs":[...],"codingProblems":[...]}`;
    const ai = await callJson(system, prompt);
    if (Array.isArray(ai.notes) && ai.notes.length) {
      return {
        notes: ai.notes.slice(0, 8).map((n) => String(n).slice(0, 200)),
        flashcards: (ai.flashcards || []).slice(0, 10).map((f) => ({ front: String(f.front || '').slice(0, 160), back: String(f.back || '').slice(0, 220) })),
        mindmap: (ai.mindmap && Array.isArray(ai.mindmap.nodes)) ? { nodes: ai.mindmap.nodes.slice(0, 8).map((n) => String(n).slice(0, 40)), edges: Array.isArray(ai.mindmap.edges) ? ai.mindmap.edges.slice(0, 12) : fallback.mindmap.edges } : fallback.mindmap,
        cheatsheet: (ai.cheatsheet || []).slice(0, 8).map((c) => String(c).slice(0, 120)),
        interviewQuestions: (ai.interviewQuestions || []).slice(0, 6).map((q) => String(q).slice(0, 200)),
        mcqs: (ai.mcqs || []).slice(0, 6).map((q) => ({ question: String(q.question || '').slice(0, 200), options: (q.options || []).map((o) => String(o).slice(0, 100)).slice(0, 4), correctIndex: Math.min(3, Math.max(0, Number(q.correctIndex) || 0)) })),
        codingProblems: (ai.codingProblems || []).slice(0, 4).map((p) => ({ title: String(p.title || '').slice(0, 80), prompt: String(p.prompt || '').slice(0, 300) })),
        generationMode: 'ai'
      };
    }
  } catch (_) {}
  return { ...fallback, generationMode: 'fallback' };
}

module.exports = { generateRevisionPack };
