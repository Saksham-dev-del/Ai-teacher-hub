const { callJson } = require('./aiGateway');
const { UNTRUSTED_REFERENCE_RULES } = require('./promptGuard');

function fallbackRelatedTopics(topic) {
  return {
    topics: [
      { name: `${topic} — Advanced`, relation: 'next' },
      { name: `${topic} — Real-World Applications`, relation: 'related' },
      { name: `Prerequisites for ${topic}`, relation: 'prerequisite' },
      { name: `Common Interview Questions on ${topic}`, relation: 'related' }
    ]
  };
}

async function suggestRelatedTopics(topic, conceptType = '') {
  const fallback = fallbackRelatedTopics(topic);
  try {
    const system = `You suggest a short learning roadmap of related topics after a student finishes understanding one concept, like a curriculum knowledge graph. ${UNTRUSTED_REFERENCE_RULES} Return JSON only.`;
    const prompt = `Topic just learned: "${topic}" (${conceptType})\nSuggest 4-6 directly related topics a student should look at next, each labeled with its relation: "prerequisite" (should have known before this), "next" (natural next step), or "related" (parallel/adjacent concept). Be specific to this exact topic's curriculum area (e.g. after "Pointers" suggest "Dynamic Memory Allocation", "Linked Lists", not generic CS topics).\nReturn {"topics":[{"name":"...","relation":"prerequisite|next|related"}]}`;
    const ai = await callJson(system, prompt);
    if (Array.isArray(ai.topics) && ai.topics.length) {
      return { topics: ai.topics.slice(0, 8).map((t) => ({ name: String(t.name || '').slice(0, 60), relation: ['prerequisite', 'next', 'related'].includes(t.relation) ? t.relation : 'related' })), generationMode: 'ai' };
    }
  } catch (_) {}
  return { ...fallback, generationMode: 'fallback' };
}

module.exports = { suggestRelatedTopics };
