async function wikipediaSearch(topic) {
  const query = String(topic || '').trim();
  if (!query) throw new Error('Enter a topic to search.');

  const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=5&origin=*`;
  const searchResp = await fetch(searchUrl, { headers: { 'User-Agent': 'AI-Teacher-Resource-Hub/1.0' } });
  if (!searchResp.ok) throw new Error(`Wikipedia search failed (${searchResp.status}).`);
  const searchData = await searchResp.json();
  const hits = (searchData?.query?.search || []).slice(0, 5);
  if (!hits.length) return { results: [], source: 'Wikipedia' };

  const results = await Promise.all(hits.map(async (hit) => {
    try {
      const summaryResp = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.title)}`, { headers: { 'User-Agent': 'AI-Teacher-Resource-Hub/1.0' } });
      if (!summaryResp.ok) throw new Error('no summary');
      const summary = await summaryResp.json();
      return {
        title: hit.title,
        snippet: (summary.extract || hit.snippet.replace(/<[^>]+>/g, '')).slice(0, 500),
        url: summary.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.title.replace(/ /g, '_'))}`,
        source: 'Wikipedia'
      };
    } catch (_) {
      return {
        title: hit.title,
        snippet: hit.snippet.replace(/<[^>]+>/g, '').slice(0, 500),
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.title.replace(/ /g, '_'))}`,
        source: 'Wikipedia'
      };
    }
  }));

  return { results, source: 'Wikipedia' };
}

module.exports = { wikipediaSearch };
