const { callJson } = require('./aiGateway');
const { UNTRUSTED_REFERENCE_RULES } = require('./promptGuard');

// Curated theme lenses a student can pick, matching the doc's examples
// (Cup, Gaming, Cricket, Gift Box, WhatsApp) plus a few useful extras.
const THEME_LENSES = [
  { key: 'cup', label: 'Cup / Coffee', icon: '☕' },
  { key: 'gaming', label: 'Gaming', icon: '🎮' },
  { key: 'cricket', label: 'Cricket', icon: '🏏' },
  { key: 'giftbox', label: 'Gift Box', icon: '📦' },
  { key: 'whatsapp', label: 'WhatsApp', icon: '📱' },
  { key: 'kitchen', label: 'Kitchen / Cooking', icon: '🍳' },
  { key: 'school', label: 'School Life', icon: '🎒' }
];

function fallbackAnalogies(topic) {
  return {
    analogies: [
      { title: 'Photocopy', icon: '📄', description: `${topic} is like making a photocopy — you get a separate copy to work with, and changes to the copy don't affect the original.` },
      { title: 'Notebook', icon: '📓', description: `Think of ${topic} like writing in your own notebook after copying notes from a friend — your notebook is independent of theirs.` },
      { title: 'Gift Box', icon: '📦', description: `${topic} is like handing someone a wrapped gift box — what's inside can be a copy, and the original stays with you.` }
    ]
  };
}
async function generateAnalogies(topic, conceptType = '') {
  const fallback = fallbackAnalogies(topic);
  try {
    const system = `You create simple, memorable real-life analogies to explain academic/technical concepts to students. ${UNTRUSTED_REFERENCE_RULES} Return JSON only.`;
    const prompt = `Topic: "${topic}" (${conceptType})\nGenerate 4-5 distinct, everyday analogies that explain this concept. Each needs a short title (1-3 words), one emoji icon, and a 1-2 sentence explanation connecting the analogy to the actual concept.\nReturn {"analogies":[{"title":"...","icon":"emoji","description":"..."}]}`;
    const ai = await callJson(system, prompt);
    if (Array.isArray(ai.analogies) && ai.analogies.length) {
      return { analogies: ai.analogies.slice(0, 6).map((a) => ({ title: String(a.title || '').slice(0, 40), icon: String(a.icon || '💡').slice(0, 4), description: String(a.description || '').slice(0, 220) })), generationMode: 'ai' };
    }
  } catch (_) {}
  return { ...fallback, generationMode: 'fallback' };
}

function fallbackThemedExplanation(topic, themeLabel) {
  return `Think of ${topic} in terms of ${themeLabel.toLowerCase()}: picture the everyday actions and rules of ${themeLabel.toLowerCase()}, and map each part onto ${topic}'s behaviour step by step.`;
}
async function explainWithTheme(topic, themeKey, conceptType = '') {
  const theme = THEME_LENSES.find((t) => t.key === themeKey) || { label: themeKey, icon: '💡' };
  const fallback = fallbackThemedExplanation(topic, theme.label);
  try {
    const system = `You explain academic concepts entirely through a single requested everyday theme/analogy, in a fun but accurate way. ${UNTRUSTED_REFERENCE_RULES} Return JSON only.`;
    const prompt = `Topic: "${topic}" (${conceptType})\nExplain this concept ENTIRELY through the lens of "${theme.label}" — every sentence should relate to that theme. 3-5 sentences, concrete and specific to both the theme and the real concept (don't just say "it's like X" once — walk through the mapping).\nReturn {"explanation":"..."}`;
    const ai = await callJson(system, prompt);
    if (ai.explanation && ai.explanation.length > 30) return { explanation: ai.explanation.slice(0, 900), theme, generationMode: 'ai' };
  } catch (_) {}
  return { explanation: fallback, theme, generationMode: 'fallback' };
}

module.exports = { THEME_LENSES, generateAnalogies, explainWithTheme };
