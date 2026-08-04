const STYLES = ['Plain', 'APA', 'IEEE', 'MLA', 'Chicago'];

function formatCitation(ref, style, index) {
  const title = String(ref.title || 'Untitled source').trim();
  const location = String(ref.location || 'Course material').trim();
  const n = index + 1;
  switch (style) {
    case 'APA':
      return `${title}. (n.d.). ${location}.`;
    case 'IEEE':
      return `[${n}] "${title}," ${location}.`;
    case 'MLA':
      return `"${title}." ${location}, n.d.`;
    case 'Chicago':
      return `${title}. ${location}. Accessed n.d.`;
    default:
      return `[${ref.id || n}] ${title} — ${location}`;
  }
}

function formatReferenceList(references = [], style = 'Plain') {
  const usedStyle = STYLES.includes(style) ? style : 'Plain';
  return references.map((ref, i) => formatCitation(ref, usedStyle, i));
}

module.exports = { formatCitation, formatReferenceList, STYLES };
