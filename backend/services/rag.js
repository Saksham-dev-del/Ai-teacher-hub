const DEFAULT_CHUNK_SIZE = 1200;
const DEFAULT_OVERLAP = 180;
const MAX_CHUNKS = 80;
const EMBEDDING_DIMENSIONS = 768;

const TOKEN_ALIASES = {
  normalization: ['normal', 'form'],
  normalisation: ['normal', 'form'],
  '1nf': ['first', 'normal', 'form'],
  '2nf': ['second', 'normal', 'form'],
  '3nf': ['third', 'normal', 'form'],
  bcnf: ['boyce', 'codd', 'normal', 'form']
};

const STOPWORDS = new Set([
  'a','an','and','are','as','at','be','by','for','from','has','have','in','is','it','of','on','or','that','the','this','to','was','were','will','with',
  'can','could','should','would','may','might','about','into','their','there','these','those','using','use','used','student','students','course','subject','topic'
]);

function normalizeWhitespace(text) {
  return String(text || '')
    .replace(/\u0000/g, ' ')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitLongParagraph(paragraph, size) {
  const sentences = paragraph.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length <= 1) {
    const pieces = [];
    for (let i = 0; i < paragraph.length; i += size) pieces.push(paragraph.slice(i, i + size));
    return pieces;
  }
  const pieces = [];
  let current = '';
  for (const sentence of sentences) {
    if (current && (current.length + sentence.length + 1) > size) {
      pieces.push(current.trim());
      current = sentence;
    } else {
      current += `${current ? ' ' : ''}${sentence}`;
    }
  }
  if (current.trim()) pieces.push(current.trim());
  return pieces;
}

function chunkText(rawText, options = {}) {
  const text = normalizeWhitespace(rawText);
  const size = Number(options.size || DEFAULT_CHUNK_SIZE);
  const overlap = Math.min(Number(options.overlap || DEFAULT_OVERLAP), Math.floor(size / 3));
  if (!text) return [];

  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const units = paragraphs.flatMap((p) => p.length > size ? splitLongParagraph(p, size) : [p]);
  const chunks = [];
  let current = '';

  function pushCurrent() {
    const cleaned = current.trim();
    if (!cleaned) return;
    chunks.push(cleaned);
    const tailStart = Math.max(0, cleaned.length - overlap);
    const boundary = cleaned.indexOf(' ', tailStart);
    const tail = cleaned.slice(boundary === -1 ? tailStart : boundary + 1).trim();
    current = tail;
  }

  for (const unit of units) {
    if (current && current.length + unit.length + 2 > size) pushCurrent();
    current += `${current ? '\n\n' : ''}${unit}`;
    if (chunks.length >= MAX_CHUNKS) break;
  }
  if (current.trim() && chunks.length < MAX_CHUNKS) chunks.push(current.trim());

  return chunks.map((chunk, index) => ({
    index,
    text: chunk,
    wordCount: chunk.split(/\s+/).filter(Boolean).length
  }));
}

function tokenize(text) {
  const raw = String(text || '').toLowerCase().match(/[a-z0-9][a-z0-9+#.-]{1,}/g) || [];
  const expanded = [];
  for (const token of raw) {
    if (STOPWORDS.has(token)) continue;
    expanded.push(token);
    if (token.length > 4 && token.endsWith('ies')) expanded.push(`${token.slice(0, -3)}y`);
    else if (token.length > 4 && token.endsWith('s')) expanded.push(token.slice(0, -1));
    if (TOKEN_ALIASES[token]) expanded.push(...TOKEN_ALIASES[token]);
  }
  return expanded.filter((token) => !STOPWORDS.has(token));
}

function termFrequency(tokens) {
  const map = new Map();
  for (const token of tokens) map.set(token, (map.get(token) || 0) + 1);
  return map;
}

function lexicalScore(query, document) {
  const qTokens = [...new Set(tokenize(query))];
  const dTokens = tokenize(document);
  if (!qTokens.length || !dTokens.length) return 0;
  const frequencies = termFrequency(dTokens);
  let score = 0;
  for (const token of qTokens) {
    const tf = frequencies.get(token) || 0;
    if (tf) score += 1 + Math.log(tf);
  }
  const phrase = String(query || '').trim().toLowerCase();
  if (phrase.length > 4 && String(document || '').toLowerCase().includes(phrase)) score += 5;
  return score / Math.sqrt(dTokens.length);
}

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || !a.length || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function geminiEmbeddingRequest(model, body) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is unavailable for semantic embeddings.');
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${body.requests ? 'batchEmbedContents' : 'embedContent'}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gemini embedding error (${response.status}): ${detail.slice(0, 300)}`);
  }
  return response.json();
}

async function embedDocuments(chunks, title) {
  if (!process.env.GEMINI_API_KEY || process.env.DISABLE_RAG_EMBEDDINGS === 'true') return null;
  const model = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-2';
  const batchSize = 16;
  const vectors = [];

  for (let start = 0; start < chunks.length; start += batchSize) {
    const batch = chunks.slice(start, start + batchSize);
    const data = await geminiEmbeddingRequest(model, {
      requests: batch.map((chunk) => ({
        model: `models/${model}`,
        content: { parts: [{ text: `title: ${title || 'syllabus'} | text: ${chunk.text}` }] },
        output_dimensionality: EMBEDDING_DIMENSIONS
      }))
    });
    const batchVectors = (data.embeddings || []).map((item) => item.values || []);
    if (batchVectors.length !== batch.length || batchVectors.some((vector) => !vector.length)) {
      throw new Error('Gemini returned an incomplete embedding batch.');
    }
    vectors.push(...batchVectors);
  }
  return { model, vectors };
}

async function embedQuery(query) {
  if (!process.env.GEMINI_API_KEY || process.env.DISABLE_RAG_EMBEDDINGS === 'true') return null;
  const model = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-2';
  const data = await geminiEmbeddingRequest(model, {
    content: { parts: [{ text: `task: search result | query: ${query}` }] },
    output_dimensionality: EMBEDDING_DIMENSIONS
  });
  const vector = data.embedding && data.embedding.values;
  return vector && vector.length ? { model, vector } : null;
}

async function retrieveRelevantChunks(syllabus, query, topK = 5) {
  const chunks = syllabus && Array.isArray(syllabus.chunks) ? syllabus.chunks : [];
  if (!chunks.length) return { mode: 'none', chunks: [], coverage: 0 };

  let queryEmbedding = null;
  const hasStoredEmbeddings = chunks.some((chunk) => Array.isArray(chunk.embedding) && chunk.embedding.length);
  if (hasStoredEmbeddings) {
    try {
      queryEmbedding = await embedQuery(query);
    } catch (error) {
      console.warn('[rag] Semantic query embedding failed, falling back to lexical retrieval:', error.message);
    }
  }

  const lexicalRaw = chunks.map((chunk) => lexicalScore(query, chunk.text));
  const maxLexical = Math.max(...lexicalRaw, 0.0001);
  const ranked = chunks.map((chunk, i) => {
    const lexical = lexicalRaw[i] / maxLexical;
    const semantic = queryEmbedding && chunk.embedding && chunk.embedding.length
      ? Math.max(0, cosineSimilarity(queryEmbedding.vector, chunk.embedding))
      : 0;
    const hybrid = queryEmbedding ? (semantic * 0.78 + lexical * 0.22) : lexical;
    return { chunk, lexical, semantic, score: hybrid };
  }).sort((a, b) => b.score - a.score);

  const selected = ranked.slice(0, Math.max(1, Math.min(Number(topK) || 5, 8)));
  const average = selected.reduce((sum, item) => sum + item.score, 0) / selected.length;
  return {
    mode: queryEmbedding ? 'semantic-hybrid' : 'lexical',
    embeddingModel: queryEmbedding ? queryEmbedding.model : '',
    coverage: Math.round(Math.min(1, average) * 100),
    chunks: selected.map((item, index) => ({
      sourceId: `S${index + 1}`,
      chunkIndex: item.chunk.index,
      score: Number(item.score.toFixed(4)),
      preview: item.chunk.text.slice(0, 220),
      text: item.chunk.text
    }))
  };
}

module.exports = {
  normalizeWhitespace,
  chunkText,
  embedDocuments,
  retrieveRelevantChunks,
  lexicalScore,
  cosineSimilarity,
  embedQuery
};
