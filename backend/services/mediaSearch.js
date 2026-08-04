async function commonsSearch(query, extraTerms = '') {
  const q = `${String(query || '').trim()} ${extraTerms}`.trim();
  if (!q) throw new Error('Enter a topic to search.');

  const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(q)}&gsrlimit=8&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=500&format=json&origin=*`;
  const resp = await fetch(url, { headers: { 'User-Agent': 'AI-Teacher-Resource-Hub/1.0' } });
  if (!resp.ok) throw new Error(`Wikimedia Commons search failed (${resp.status}).`);
  const data = await resp.json();
  const pages = Object.values(data?.query?.pages || {});

  const results = pages
    .map((p) => {
      const info = p.imageinfo?.[0];
      if (!info) return null;
      const meta = info.extmetadata || {};
      return {
        title: String(p.title || '').replace(/^File:/, '').replace(/\.[a-z]+$/i, ''),
        thumbUrl: info.thumburl || info.url,
        fullUrl: info.url,
        pageUrl: info.descriptionurl,
        license: meta.LicenseShortName?.value || 'See source page',
        artist: (meta.Artist?.value || '').replace(/<[^>]+>/g, '').slice(0, 120) || 'Unknown',
        width: info.width,
        height: info.height
      };
    })
    .filter(Boolean)
    .filter((r) => /\.(jpg|jpeg|png|svg|webp)$/i.test(r.fullUrl || ''));

  return { results, source: 'Wikimedia Commons' };
}

// Phase 11.30: AI Image Finder — general topical images.
async function searchImages(topic) {
  return commonsSearch(topic);
}

// Phase 11.31: AI Illustration Finder — biases toward diagrams/illustrations
// rather than photographs, using Commons category/search terms.
async function searchIllustrations(topic) {
  return commonsSearch(topic, 'diagram OR illustration OR infographic');
}

module.exports = { searchImages, searchIllustrations };
