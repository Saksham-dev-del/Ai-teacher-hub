// Google Gemini API with JSON output, automatic retry and a stable fallback model.

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

async function generateWithModel({ model, apiKey, system, prompt }) {
  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.35,
              topP: 0.9,
              maxOutputTokens: 10000
            }
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        const parts = data.candidates?.[0]?.content?.parts || [];
        const generatedText = parts.map((part) => part.text || '').join('\n').trim();
        if (!generatedText) throw new Error(`Gemini returned an empty response using ${model}.`);
        return generatedText;
      }

      const errorText = await response.text();
      const shouldRetry = RETRYABLE_STATUS_CODES.has(response.status) && attempt < maxAttempts;
      if (!shouldRetry) {
        const error = new Error(`Gemini API error (${response.status}) using ${model}: ${errorText.slice(0, 500)}`);
        error.status = response.status;
        throw error;
      }

      const delay = Math.min(1000 * 2 ** (attempt - 1), 8000) + Math.floor(Math.random() * 500);
      console.warn(`Gemini ${model} unavailable (${response.status}). Retrying in ${delay}ms...`);
      await sleep(delay);
    } catch (error) {
      const isNetworkError = typeof error.status === 'undefined';
      if (!isNetworkError || attempt === maxAttempts) throw error;
      const delay = Math.min(1000 * 2 ** (attempt - 1), 8000) + Math.floor(Math.random() * 500);
      console.warn(`Gemini network error. Retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
  throw new Error(`Gemini request failed using ${model}.`);
}

async function call(system, prompt) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || /replace_with|your[_ -]?key|apni_/i.test(apiKey)) throw new Error('GEMINI_API_KEY is missing or still contains a placeholder. Add a real Google AI Studio key to backend/.env and restart the server.');

  const primaryModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
  const fallbackModel = process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.1-flash-lite';
  const models = [...new Set([primaryModel, fallbackModel])];
  let lastError;

  for (const model of models) {
    try {
      console.log(`Trying Gemini model: ${model}`);
      return await generateWithModel({ model, apiKey, system, prompt });
    } catch (error) {
      lastError = error;
      console.error(`Gemini model ${model} failed:`, error.message);
      const detail = String(error.message || '');
      if (/API_KEY_INVALID|API key not valid/i.test(detail)) {
        throw new Error('Invalid Gemini API key. Create/copy a valid key from Google AI Studio, update backend/.env, and restart npm start.');
      }
      if (error.status === 403 || /PERMISSION_DENIED/i.test(detail)) {
        throw new Error('Gemini API access was denied. Check the Google Cloud/AI Studio project, key restrictions, billing or regional access.');
      }
    }
  }

  throw new Error(`Gemini generation failed for the configured primary and fallback models. Check model availability with the Gemini models endpoint or change GEMINI_MODEL in backend/.env. Details: ${lastError?.message || 'Unknown error'}`);
}

module.exports = { call };
