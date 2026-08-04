function buildReferences(ragContext = {}, syllabi = []) {
  const nameBySource = new Map();
  (syllabi || []).forEach((item, index) => {
    nameBySource.set(`DOC${index + 1}`, item.originalName || `Reference Document ${index + 1}`);
  });
  return (ragContext.chunks || []).map((chunk, index) => ({
    id: chunk.sourceId || `S${index + 1}`,
    title: chunk.documentName || chunk.syllabusName || syllabi[0]?.originalName || 'Uploaded academic source',
    location: Number.isFinite(Number(chunk.chunkIndex)) ? `Chunk ${Number(chunk.chunkIndex) + 1}` : 'Retrieved passage',
    preview: String(chunk.preview || chunk.text || '').slice(0, 420),
    relevance: Math.round(Number(chunk.score || 0) * 100)
  }));
}

function collectCitationUsage(sections = []) {
  const usage = new Map();
  sections.forEach((section) => {
    (section.citations || []).forEach((id) => {
      if (!usage.has(id)) usage.set(id, []);
      usage.get(id).push(section.heading);
    });
  });
  return [...usage.entries()].map(([id, sectionsUsed]) => ({ id, sectionsUsed: [...new Set(sectionsUsed)] }));
}

module.exports = { buildReferences, collectCitationUsage };
