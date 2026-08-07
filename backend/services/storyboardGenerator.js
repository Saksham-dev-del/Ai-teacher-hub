const { callJson } = require('./aiGateway');
const { UNTRUSTED_REFERENCE_RULES } = require('./promptGuard');

function fallbackStoryboard(topic) {
  return {
    title: `${topic} — storyboard`,
    scenes: [
      { sceneNumber: 1, title: 'Setup', description: `We start with the initial situation for ${topic}.`, narration: `Let's imagine the starting point for ${topic}.` },
      { sceneNumber: 2, title: 'Action', description: 'The key action or process happens.', narration: 'Now watch what happens when the main action takes place.' },
      { sceneNumber: 3, title: 'Change', description: 'Something changes as a result.', narration: 'Notice how things have changed.' },
      { sceneNumber: 4, title: 'Outcome', description: 'We compare the before and after to understand the concept.', narration: 'Comparing before and after gives us the full picture.' }
    ]
  };
}

async function generateStoryboard(topic, conceptType = '') {
  const fallback = fallbackStoryboard(topic);
  try {
    const system = `You are a storyboard writer for short educational explainer videos — concrete, visual, scene-by-scene, specific to the topic (use real values/names, not generic placeholders). ${UNTRUSTED_REFERENCE_RULES} Return JSON only.`;
    const prompt = `Topic: "${topic}" (${conceptType})\nWrite a 4-6 scene storyboard that visually explains this concept, the way an explainer video would. For each scene give: a short title (2-4 words), a one-sentence visual description (what the viewer SEES), and a one-sentence narration line (what the voiceover SAYS — natural, conversational).\nReturn {"title":"...","scenes":[{"sceneNumber":1,"title":"...","description":"...","narration":"..."}]}`;
    const ai = await callJson(system, prompt);
    if (Array.isArray(ai.scenes) && ai.scenes.length >= 3) {
      return {
        title: String(ai.title || fallback.title).slice(0, 120),
        scenes: ai.scenes.slice(0, 8).map((s, i) => ({
          sceneNumber: Number(s.sceneNumber) || i + 1,
          title: String(s.title || `Scene ${i + 1}`).slice(0, 40),
          description: String(s.description || '').slice(0, 200),
          narration: String(s.narration || s.description || '').slice(0, 200)
        })),
        generationMode: 'ai'
      };
    }
  } catch (_) {}
  return { ...fallback, generationMode: 'fallback' };
}

module.exports = { generateStoryboard };
