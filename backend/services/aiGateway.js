const anthropic = require('../providers/anthropic');
const openai = require('../providers/openai');
const gemini = require('../providers/gemini');

function extractJson(text) {
  const cleaned = String(text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Could not find JSON in the AI response.');
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function callRaw(system, prompt) {
  const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
  if (provider === 'openai') return openai.call(system, prompt);
  if (provider === 'anthropic') return anthropic.call(system, prompt);
  return gemini.call(system, prompt);
}

async function callJson(system, prompt) {
  return extractJson(await callRaw(system, prompt));
}

module.exports = { callRaw, callJson, extractJson };
