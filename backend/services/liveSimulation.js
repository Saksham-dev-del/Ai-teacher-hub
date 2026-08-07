const { callJson } = require('./aiGateway');
const { UNTRUSTED_REFERENCE_RULES } = require('./promptGuard');

function fallbackSimulation(topic) {
  return {
    title: `${topic} — live simulation`,
    states: [
      { stepLabel: 'Initial state', snapshot: { status: 'Ready', value: '—' }, description: `Before anything happens for ${topic}.` },
      { stepLabel: 'Operation runs', snapshot: { status: 'Running', value: 'changing...' }, description: 'The core operation executes.' },
      { stepLabel: 'State updates', snapshot: { status: 'Updated', value: 'new value' }, description: 'The state reflects the result of the operation.' },
      { stepLabel: 'Final state', snapshot: { status: 'Done', value: 'final value' }, description: 'The simulation reaches its final state.' }
    ]
  };
}

async function generateSimulation(topic, conceptType = '') {
  const fallback = fallbackSimulation(topic);
  try {
    const system = `You simulate the internal state changes of a CS concept step by step, like a debugger watch window or a memory/stack/queue tracer. Each step is a snapshot of named variables/state at that instant. Be concrete and specific to the actual topic (real variable names, real values, real node labels — not generic placeholders). ${UNTRUSTED_REFERENCE_RULES} Return JSON only.`;
    const prompt = `Topic: "${topic}" (${conceptType})\nSimulate this concept as 4-8 sequential state snapshots (e.g. for a memory/variable topic: {a: 10, b: undefined}; for a tree: {inserted: [5,3,8], root: 5}; for OS scheduling: {readyQueue: [P1,P2], running: P1}; for a network topic: {packet: 'seq=1', hop: 'Router A'}). Each step needs a short label, a snapshot object of 2-5 key:value pairs representing the state at that moment, and a one-sentence description of what just happened.\nReturn {"title":"...","states":[{"stepLabel":"...","snapshot":{"key":"value"},"description":"..."}]}`;
    const ai = await callJson(system, prompt);
    if (Array.isArray(ai.states) && ai.states.length >= 3) {
      return {
        title: String(ai.title || fallback.title).slice(0, 120),
        states: ai.states.slice(0, 10).map((s) => ({
          stepLabel: String(s.stepLabel || '').slice(0, 40),
          snapshot: typeof s.snapshot === 'object' && s.snapshot ? Object.fromEntries(Object.entries(s.snapshot).slice(0, 6).map(([k, v]) => [String(k).slice(0, 24), String(v).slice(0, 60)])) : {},
          description: String(s.description || '').slice(0, 180)
        })),
        generationMode: 'ai'
      };
    }
  } catch (_) {}
  return { ...fallback, generationMode: 'fallback' };
}

module.exports = { generateSimulation };
