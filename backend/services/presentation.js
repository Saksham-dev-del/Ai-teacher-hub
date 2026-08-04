const pptxgen = require('pptxgenjs');
const { formatReferenceList } = require('./citationFormatter');

const THEMES = {
  // Existing themes (kept for backward compatibility with already-generated links/settings)
  academic: { bg: 'F7F2E6', primary: '2F5D50', secondary: 'E0A93A', text: '1E2A28', muted: '52605C', card: 'FFFEFA' },
  midnight: { bg: '111827', primary: '7C3AED', secondary: '22D3EE', text: 'F8FAFC', muted: 'CBD5E1', card: '1F2937' },
  ocean: { bg: 'EFF8FF', primary: '075985', secondary: '06B6D4', text: '0F172A', muted: '475569', card: 'FFFFFF' },
  sunrise: { bg: 'FFF7ED', primary: '9A3412', secondary: 'F59E0B', text: '431407', muted: '7C2D12', card: 'FFFBEB' },

  // Phase 11.2: expanded theme gallery
  modern: { bg: 'F4F5F7', primary: '4F46E5', secondary: 'EC4899', text: '111827', muted: '6B7280', card: 'FFFFFF' },
  corporate: { bg: 'FFFFFF', primary: '1D4ED8', secondary: '0EA5E9', text: '0F172A', muted: '475569', card: 'F1F5F9' },
  startup: { bg: '0B1220', primary: '22C55E', secondary: 'A78BFA', text: 'F8FAFC', muted: '94A3B8', card: '111827' },
  glass: { bg: 'E8ECF3', primary: '6366F1', secondary: '38BDF8', text: '1E293B', muted: '64748B', card: 'FFFFFF' },
  darkmode: { bg: '0F1115', primary: '8B5CF6', secondary: '34D399', text: 'F1F5F9', muted: 'A1A1AA', card: '1A1D23' },
  apple: { bg: 'FFFFFF', primary: '1D1D1F', secondary: '0071E3', text: '1D1D1F', muted: '6E6E73', card: 'F5F5F7' },
  material: { bg: 'FAFAFA', primary: '6200EE', secondary: '03DAC6', text: '1C1B1F', muted: '49454F', card: 'FFFFFF' },
  minimal: { bg: 'FFFFFF', primary: '111111', secondary: '999999', text: '111111', muted: '777777', card: 'FAFAFA' },
  gradient: { bg: '6D28D9', primary: 'FDE047', secondary: 'F472B6', text: 'FFFFFF', muted: 'E9D5FF', card: '7C3AED' }
};

function text(value, max = 4000) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function addBrand(slide, theme, index) {
  slide.addShape('line', { x: 0.55, y: 7.12, w: 12.25, h: 0, line: { color: theme.secondary, width: 1.2 } });
  slide.addText('AI Teacher Resource Hub', { x: 0.65, y: 7.18, w: 3.7, h: 0.22, fontFace: 'Aptos', fontSize: 9, color: theme.muted, margin: 0 });
  slide.addText(String(index), { x: 12.25, y: 7.17, w: 0.45, h: 0.22, fontFace: 'Aptos', fontSize: 9, color: theme.muted, align: 'right', margin: 0 });
}

// Phase 11.15: AI Icons — automatically pick a relevant icon glyph for a slide
// heading based on keyword matching, so every content slide gets a small visual
// cue without needing an external icon library/API.
const ICON_KEYWORDS = [
  [/\b(intro|overview|foundation|basics)/i, '📘'],
  [/\b(definition|terminology|glossary|meaning)/i, '📖'],
  [/\b(problem|motivation|challenge|issue)/i, '❗'],
  [/\b(example|worked|illustration|demo)/i, '✏️'],
  [/\b(case study|real.?world|application)/i, '🧩'],
  [/\b(compar|versus|vs\.?|trade.?off)/i, '⚖️'],
  [/\b(advantage|benefit|pro)/i, '✅'],
  [/\b(limitation|disadvantage|con|risk)/i, '⚠️'],
  [/\b(trend|future|emerging|scope)/i, '🚀'],
  [/\b(best practice|guideline|standard)/i, '⭐'],
  [/\b(process|workflow|step|procedure)/i, '🔄'],
  [/\b(architecture|system|design|structure)/i, '🏗️'],
  [/\b(data|database|storage)/i, '🗄️'],
  [/\b(security|privacy|safety)/i, '🔒'],
  [/\b(network|connect|communication)/i, '🌐'],
  [/\b(algorithm|logic|code|program)/i, '💻'],
  [/\b(test|assessment|evaluat|quiz|exam)/i, '📝'],
  [/\b(summary|conclusion|takeaway|recap)/i, '🎯'],
  [/\b(reference|citation|source|bibliograph)/i, '🔖'],
  [/\b(question|q&a|discuss)/i, '❓'],
  [/\b(table|comparison chart|matrix)/i, '📊']
];
function iconForHeading(heading) {
  const h = String(heading || '');
  for (const [pattern, icon] of ICON_KEYWORDS) if (pattern.test(h)) return icon;
  return '📌';
}

function addSlideTitle(slide, title, subtitle, theme) {
  slide.background = { color: theme.bg };
  slide.addShape('rect', { x: 0, y: 0, w: 0.16, h: 7.5, line: { color: theme.primary, transparency: 100 }, fill: { color: theme.primary } });
  slide.addText(text(title, 180), { x: 0.7, y: 0.42, w: 11.9, h: 0.55, fontFace: 'Aptos Display', fontSize: 25, bold: true, color: theme.primary, margin: 0, breakLine: false, fit: 'shrink' });
  if (subtitle) slide.addText(text(subtitle, 260), { x: 0.72, y: 1.02, w: 11.5, h: 0.35, fontFace: 'Aptos', fontSize: 11, color: theme.muted, margin: 0, fit: 'shrink' });
}

function addBulletList(slide, items, x, y, w, h, theme, fontSize = 18) {
  const runs = [];
  items.filter(Boolean).forEach((item) => {
    runs.push({ text: text(item, 700), options: { bullet: { indent: fontSize * 1.1 }, hanging: fontSize * 0.25, breakLine: true } });
  });
  slide.addText(runs.length ? runs : [{ text: 'Content will be added after teacher review.' }], {
    x, y, w, h, fontFace: 'Aptos', fontSize, color: theme.text, valign: 'top', margin: 0.1,
    breakLine: false, fit: 'shrink', paraSpaceAfterPt: 10
  });
}

function splitIntoBullets(body) {
  const source = String(body || '').replace(/\r/g, '').trim();
  const parts = source.split(/\n+|(?<=[.!?])\s+(?=[A-Z0-9])/).map((v) => v.trim()).filter(Boolean);
  return parts.length ? parts.slice(0, 8) : [source];
}

function addTitleSlide(pptx, draft, theme) {
  const slide = pptx.addSlide();
  slide.background = { color: theme.bg };
  slide.addShape('rect', { x: 0, y: 0, w: 13.333, h: 7.5, line: { color: theme.bg, transparency: 100 }, fill: { color: theme.bg } });
  slide.addShape('arc', { x: 9.6, y: -1.4, w: 5.1, h: 5.1, adjustPoint: 0.35, rotate: 15, line: { color: theme.secondary, transparency: 100 }, fill: { color: theme.secondary, transparency: 20 } });
  slide.addShape('ellipse', { x: 10.25, y: 4.55, w: 2.4, h: 2.4, line: { color: theme.primary, transparency: 100 }, fill: { color: theme.primary, transparency: 8 } });
  // Phase 11.27: AI Brand Kit — institution logo, if provided
  if (draft.customBrand?.logoDataUrl) {
    try { slide.addImage({ data: draft.customBrand.logoDataUrl, x: 11.15, y: 0.55, w: 1.3, h: 1.3, sizing: { type: 'contain', w: 1.3, h: 1.3 } }); } catch (_) { /* ignore malformed logo data */ }
  }
  slide.addText(text(draft.presentationType || draft.type || 'Academic Presentation', 80).toUpperCase(), { x: 0.85, y: 0.75, w: 4.4, h: 0.35, fontFace: 'Aptos', fontSize: 12, bold: true, color: theme.secondary, charSpacing: 2, margin: 0 });
  slide.addText(text(draft.topic || 'Untitled Topic', 220), { x: 0.82, y: 1.35, w: 8.6, h: 1.65, fontFace: 'Aptos Display', fontSize: 36, bold: true, color: theme.primary, margin: 0, fit: 'shrink', valign: 'mid' });
  slide.addText(`${text(draft.course, 80)}  •  ${text(draft.subject, 120)}  •  ${text(draft.difficulty || 'Intermediate', 40)}`, { x: 0.86, y: 3.35, w: 8.6, h: 0.38, fontFace: 'Aptos', fontSize: 15, color: theme.muted, margin: 0 });
  slide.addShape('roundRect', { x: 0.84, y: 4.18, w: 4.8, h: 0.62, rectRadius: 0.08, line: { color: theme.primary, transparency: 85 }, fill: { color: theme.card, transparency: 4 } });
  slide.addText('Teacher-reviewed AI-assisted deck', { x: 1.05, y: 4.34, w: 4.35, h: 0.25, fontFace: 'Aptos', fontSize: 12, bold: true, color: theme.text, margin: 0 });
  slide.addText('Generated with AI Teacher Resource Hub', { x: 0.86, y: 6.73, w: 5, h: 0.25, fontFace: 'Aptos', fontSize: 10, color: theme.muted, margin: 0 });
  return slide;
}



// Phase 11.27: AI Brand Kit — merge custom institution colors over the chosen preset theme.
function resolveTheme(options, draft) {
  const base = THEMES[options.theme] || THEMES.academic;
  const custom = draft?.customBrand?.colors;
  if (!custom) return base;
  const merged = { ...base };
  ['bg', 'primary', 'secondary', 'text', 'muted', 'card'].forEach((k) => {
    if (custom[k] && /^[0-9A-Fa-f]{6}$/.test(custom[k])) merged[k] = custom[k];
  });
  return merged;
}

function addSpeakerNotes(slide, notes, enabled = true) {
  if (enabled && notes && typeof slide.addNotes === 'function') slide.addNotes(text(notes, 8000));
}

function addVisualDiagram(slide, visual, theme, x = 7.55, y = 1.65, w = 5.0, h = 4.65) {
  const nodes = (visual?.nodes || []).filter(Boolean).slice(0, 6);
  slide.addShape('roundRect', { x, y, w, h, rectRadius: 0.05, line: { color: theme.secondary, transparency: 45, width: 1.1 }, fill: { color: theme.card } });
  slide.addText(text(visual?.title || 'Concept Visual', 100), { x: x + 0.25, y: y + 0.18, w: w - 0.5, h: 0.35, fontFace: 'Aptos', fontSize: 12, bold: true, color: theme.primary, margin: 0, align: 'center' });
  if (!nodes.length) {
    slide.addText(text(visual?.description || 'Teacher-selected visual', 280), { x: x + 0.5, y: y + 1.4, w: w - 1, h: 1.5, fontFace: 'Aptos', fontSize: 15, color: theme.muted, align: 'center', valign: 'mid', margin: 0.05, fit: 'shrink' });
    return;
  }
  if (visual?.type === 'smart-cards') {
    const cards = nodes.slice(0, 4);
    const cols = cards.length > 2 ? 2 : 1;
    const rows = Math.ceil(cards.length / cols);
    const cardW = (w - 0.5 - (cols - 1) * 0.25) / cols;
    const cardH = Math.min(1.35, (h - 1.15 - (rows - 1) * 0.2) / rows);
    cards.forEach((node, i) => {
      const col = i % cols; const row = Math.floor(i / cols);
      const cx = x + 0.25 + col * (cardW + 0.25);
      const cy = y + 1.1 + row * (cardH + 0.2);
      slide.addShape('roundRect', { x: cx, y: cy, w: cardW, h: cardH, rectRadius: 0.06, line: { color: theme.secondary, transparency: 55, width: 1 }, fill: { color: theme.card } });
      slide.addShape('ellipse', { x: cx + 0.15, y: cy + 0.15, w: 0.42, h: 0.42, line: { color: theme.primary, transparency: 100 }, fill: { color: theme.primary } });
      slide.addText(text(iconForHeading(node), 8), { x: cx + 0.15, y: cy + 0.15, w: 0.42, h: 0.42, fontFace: 'Aptos', fontSize: 16, align: 'center', valign: 'mid', margin: 0, color: 'FFFFFF' });
      slide.addText(text(node, 130), { x: cx + 0.68, y: cy + 0.12, w: cardW - 0.82, h: cardH - 0.24, fontFace: 'Aptos', fontSize: 12.5, bold: true, color: theme.text, valign: 'mid', margin: 0, fit: 'shrink' });
    });
    return;
  }
  if (visual?.type === 'comparison') {
    const half = (w - 0.8) / 2;
    nodes.slice(0, 2).forEach((node, i) => {
      slide.addShape('roundRect', { x: x + 0.25 + i * (half + 0.3), y: y + 1.05, w: half, h: 2.65, rectRadius: 0.04, line: { color: i ? theme.secondary : theme.primary, width: 1.2 }, fill: { color: theme.bg } });
      slide.addText(text(node, 260), { x: x + 0.4 + i * (half + 0.3), y: y + 1.3, w: half - 0.3, h: 2.15, fontFace: 'Aptos', fontSize: 15, bold: true, color: theme.text, margin: 0.08, align: 'center', valign: 'mid', fit: 'shrink' });
    });
    return;
  }
  const count = Math.min(nodes.length, 4);
  const boxW = Math.min(1.03, (w - 0.65) / count);
  const gap = 0.16;
  const total = count * boxW + (count - 1) * gap;
  let bx = x + (w - total) / 2;
  nodes.slice(0, count).forEach((node, i) => {
    slide.addShape('roundRect', { x: bx, y: y + 1.3, w: boxW, h: 1.25, rectRadius: 0.04, line: { color: i % 2 ? theme.secondary : theme.primary, width: 1 }, fill: { color: theme.bg } });
    slide.addText(text(node, 120), { x: bx + 0.06, y: y + 1.52, w: boxW - 0.12, h: 0.78, fontFace: 'Aptos', fontSize: 11, bold: true, color: theme.text, align: 'center', valign: 'mid', margin: 0.02, fit: 'shrink' });
    if (i < count - 1) slide.addShape('chevron', { x: bx + boxW + 0.025, y: y + 1.72, w: gap - 0.03, h: 0.35, line: { color: theme.secondary, transparency: 100 }, fill: { color: theme.secondary } });
    bx += boxW + gap;
  });
  if (nodes.length > 4) {
    slide.addText(nodes.slice(4, 6).map((n) => text(n, 90)).join('  •  '), { x: x + 0.55, y: y + 3.15, w: w - 1.1, h: 0.65, fontFace: 'Aptos', fontSize: 12, color: theme.muted, align: 'center', margin: 0.05, fit: 'shrink' });
  }
  if (visual?.caption) slide.addText(text(visual.caption, 160), { x: x + 0.35, y: y + h - 0.48, w: w - 0.7, h: 0.22, fontFace: 'Aptos', fontSize: 8.5, italic: true, color: theme.muted, align: 'center', margin: 0 });
}

function createDetailedPptx(draft, options) {
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = options.author || 'AI Teacher Resource Hub';
  pptx.company = options.institution || 'Academic Institution';
  pptx.subject = text(draft.subject || draft.topic, 200);
  pptx.title = text(draft.topic || 'Detailed Academic Presentation', 200);
  pptx.lang = draft.language || 'en-US';
  pptx.theme = { headFontFace: 'Aptos Display', bodyFontFace: 'Aptos', lang: 'en-US' };
  return pptx;
}

async function buildDetailedPresentation(draft, options = {}) {
  const pptx = createDetailedPptx(draft, options);
  const theme = resolveTheme(options, draft);
  const target = Math.max(12, Math.min(Number(options.maxContentSlides || draft.targetSlides || 26), 100));
  const assets = new Map((options.assets || []).map((x) => [String(x._id), x]));
  let slideNo = 1;
  const notesEnabled = options.includeSpeakerNotes !== false && draft.includeSpeakerNotes !== false;
  const first = addTitleSlide(pptx, draft, theme);
  addSpeakerNotes(first, `Introduce the topic, course context and expected learning outcomes. ${draft.executiveSummary || ''}`, notesEnabled);
  slideNo += 1;

  let slide = pptx.addSlide();
  addSlideTitle(slide, 'Presentation Roadmap', `${draft.contentDepth || 'Detailed'} visual lecture deck`, theme);
  addBulletList(slide, (draft.reportSections || []).slice(0, 12).map((s, i) => `${i + 1}. ${s.heading}`), 0.95, 1.5, 11.4, 5.2, theme, 16);
  addBrand(slide, theme, slideNo++);
  addSpeakerNotes(slide, 'Walk learners through the structure and explain how the sections connect.', notesEnabled);

  if ((draft.courseOutcomes || []).length) {
    slide = pptx.addSlide();
    addSlideTitle(slide, 'Learning Outcomes', 'Measurable outcomes aligned with teaching and assessment', theme);
    addBulletList(slide, draft.courseOutcomes.map((co) => `${co.code}: ${co.text}`), 0.95, 1.55, 11.4, 5.0, theme, 19);
    addBrand(slide, theme, slideNo++); addSpeakerNotes(slide, 'Read each outcome and connect it with the assessment activities in the deck.', notesEnabled);
  }

  for (const section of draft.reportSections || []) {
    if (slideNo > target - 5) break;
    slide = pptx.addSlide();
    addSlideTitle(slide, `${iconForHeading(section.heading)}  ${section.heading}`, section.summary || `${draft.subject} · ${draft.topic}`, theme);
    const bullets = [...(section.keyPoints || []), ...(section.applications || []).slice(0, 2).map((x) => `Application: ${x}`)].slice(0, 7);
    const asset = section.visual?.assetId ? assets.get(String(section.visual.assetId)) : null;
    if (asset?.storagePath) {
      slide.addShape('roundRect', { x: 0.75, y: 1.5, w: 5.95, h: 4.95, rectRadius: 0.05, line: { color: theme.secondary, transparency: 55 }, fill: { color: theme.card } });
      addBulletList(slide, bullets.length ? bullets : splitIntoBullets((section.explanation || []).join(' ')), 1.0, 1.78, 5.45, 4.4, theme, 15.5);
      try { slide.addImage({ path: asset.storagePath, x: 7.15, y: 1.65, w: 5.2, h: 4.45, sizing: 'contain' }); } catch (_) { addVisualDiagram(slide, section.visual, theme, 7.15, 1.65, 5.2, 4.45); }
      slide.addText(text(section.visual?.caption || asset.caption || asset.originalName, 160), { x: 7.3, y: 6.15, w: 4.9, h: 0.24, fontFace: 'Aptos', fontSize: 8.5, italic: true, color: theme.muted, align: 'center', margin: 0 });
    } else {
      addBulletList(slide, bullets.length ? bullets : splitIntoBullets((section.explanation || []).join(' ')), 0.95, 1.62, 6.1, 4.8, theme, 15.5);
      addVisualDiagram(slide, section.visual, theme, 7.35, 1.55, 5.25, 4.9);
    }
    addBrand(slide, theme, slideNo++);
    addSpeakerNotes(slide, section.speakerNotes || (section.explanation || []).join('\n\n'), notesEnabled);

    if ((section.examples || []).length && slideNo <= target - 5) {
      slide = pptx.addSlide();
      addSlideTitle(slide, `${section.heading}: Worked Examples`, 'Use examples to move from explanation to application', theme);
      const exampleItems = section.examples.slice(0, 3).map((e) => `${e.title}: ${e.description}`);
      addBulletList(slide, exampleItems, 0.9, 1.55, 11.55, 4.85, theme, 15.5);
      addBrand(slide, theme, slideNo++); addSpeakerNotes(slide, `Work through the examples step by step. ${exampleItems.join('\n')}`, notesEnabled);
    }

    if (section.caseStudy && slideNo <= target - 5) {
      slide = pptx.addSlide();
      addSlideTitle(slide, `Case Study: ${section.caseStudy.title}`, 'Connect the topic to a realistic academic or professional situation', theme);
      slide.addShape('roundRect', { x: 0.9, y: 1.55, w: 11.55, h: 4.8, rectRadius: 0.06, line: { color: theme.secondary, width: 1.2 }, fill: { color: theme.card } });
      slide.addText(text(section.caseStudy.description, 1600), { x: 1.25, y: 1.95, w: 10.85, h: 3.25, fontFace: 'Aptos', fontSize: 18, color: theme.text, margin: 0.12, valign: 'mid', fit: 'shrink' });
      slide.addText('Discuss → Analyze → Justify', { x: 3.9, y: 5.55, w: 5.5, h: 0.35, fontFace: 'Aptos', fontSize: 13, bold: true, color: theme.primary, align: 'center', margin: 0 });
      addBrand(slide, theme, slideNo++); addSpeakerNotes(slide, section.caseStudy.description, notesEnabled);
    }

    if (section.table && slideNo <= target - 5) {
      slide = pptx.addSlide();
      addSlideTitle(slide, `${section.heading}: Structured Comparison`, 'Use the table to identify patterns, similarities and differences', theme);
      const rows = [section.table.headers, ...section.table.rows].map((row) => row.map((cell) => text(cell, 220)));
      slide.addTable(rows, { x: 0.65, y: 1.5, w: 12.0, h: 5.2, border: { type: 'solid', color: theme.secondary, pt: 0.7 }, fill: theme.card, color: theme.text, fontFace: 'Aptos', fontSize: 12, margin: 0.06, autoFit: false });
      addBrand(slide, theme, slideNo++); addSpeakerNotes(slide, 'Explain the table row by row and ask learners to add one additional comparison point.', notesEnabled);
    }
  }

  if ((draft.bloomQuestions || []).length && slideNo <= target - 3) {
    const chunks = [];
    for (let i = 0; i < draft.bloomQuestions.length; i += 5) chunks.push(draft.bloomQuestions.slice(i, i + 5));
    for (const chunk of chunks.slice(0, 2)) {
      slide = pptx.addSlide();
      addSlideTitle(slide, "Bloom's Taxonomy Questions", 'Assessment prompts from foundational recall to higher-order thinking', theme);
      addBulletList(slide, chunk.map((q) => `[${q.level}] ${q.question}`), 0.9, 1.5, 11.6, 5.15, theme, 15.5);
      addBrand(slide, theme, slideNo++); addSpeakerNotes(slide, chunk.map((q) => `${q.question}\nSuggested answer: ${q.answer}`).join('\n\n'), notesEnabled);
    }
  }

  if ((draft.coMapping || []).length && slideNo <= target - 2) {
    slide = pptx.addSlide(); addSlideTitle(slide, 'Course Outcome Alignment', 'Evidence of outcome-based teaching and assessment design', theme);
    const rows = [['CO', 'Sections', 'Bloom', 'Score'], ...draft.coMapping.slice(0, 7).map((m) => [m.courseOutcome, (m.matchedSections || []).join(', '), (m.bloomLevels || []).join(', '), `${m.alignmentScore || 0}%`])];
    slide.addTable(rows, { x: 0.7, y: 1.5, w: 11.9, h: 5.1, border: { type: 'solid', color: theme.secondary, pt: 0.7 }, fill: theme.card, color: theme.text, fontFace: 'Aptos', fontSize: 11.5, margin: 0.06, colW: [1.0, 5.5, 3.2, 1.2] });
    addBrand(slide, theme, slideNo++); addSpeakerNotes(slide, draft.coMapping.map((m) => `${m.courseOutcome}: ${m.justification}`).join('\n'), notesEnabled);
  }

  if ((draft.qualityScore || draft.validationReport) && slideNo <= target - 1) {
    slide = pptx.addSlide();
    addSlideTitle(slide, 'AI Quality & Export Validation', 'Automated checks support teacher review - they do not replace academic verification', theme);
    const quality = draft.qualityScore || {};
    const validation = draft.validationReport || {};
    slide.addShape('ellipse', { x: 0.9, y: 1.65, w: 2.25, h: 2.25, line: { color: theme.secondary, width: 4 }, fill: { color: theme.card } });
    slide.addText(String(Number(quality.overall || validation.score || 0)), { x: 1.25, y: 2.15, w: 1.55, h: 0.72, fontFace: 'Aptos Display', fontSize: 34, bold: true, color: theme.primary, align: 'center', margin: 0 });
    slide.addText('/100', { x: 1.45, y: 2.88, w: 1.2, h: 0.25, fontFace: 'Aptos', fontSize: 10, color: theme.muted, align: 'center', margin: 0 });
    const checkItems = (validation.checks || []).slice(0, 7).map((item) => `${item.passed ? 'PASS' : 'REVIEW'} - ${item.label}: ${item.detail}`);
    const qualityItems = [...(quality.strengths || []).slice(0, 2).map((x) => `Strength: ${x}`), ...(quality.improvements || []).slice(0, 2).map((x) => `Improve: ${x}`)];
    addBulletList(slide, [...checkItems, ...qualityItems].slice(0, 8), 3.55, 1.55, 8.65, 5.0, theme, 14.5);
    addBrand(slide, theme, slideNo++);
    addSpeakerNotes(slide, 'Explain which automated checks passed and which areas still require teacher verification before classroom or institutional use.', notesEnabled);
  }

  if ((draft.references || []).length && slideNo <= target - 1) {
    slide = pptx.addSlide(); addSlideTitle(slide, 'References and Syllabus Evidence', 'Retrieved material used to ground the academic draft', theme);
    addBulletList(slide, formatReferenceList(draft.references, draft.citationStyle || 'Plain').slice(0, 8), 0.9, 1.5, 11.6, 5.1, theme, 14.5);
    addBrand(slide, theme, slideNo++); addSpeakerNotes(slide, 'These references were retrieved from teacher-uploaded academic documents. Verify citations before formal publication.', notesEnabled);
  }

  slide = pptx.addSlide();
  slide.background = { color: theme.primary };
  slide.addText('Summary, Reflection & Questions', { x: 0.8, y: 2.25, w: 11.75, h: 0.75, fontFace: 'Aptos Display', fontSize: 33, bold: true, color: 'FFFFFF', align: 'center', margin: 0 });
  slide.addText(text(draft.executiveSummary || draft.topic, 400), { x: 2.0, y: 3.25, w: 9.35, h: 1.3, fontFace: 'Aptos', fontSize: 17, color: theme.secondary, align: 'center', valign: 'mid', margin: 0.08, fit: 'shrink' });
  slide.addText('Review • Reflect • Apply', { x: 4.1, y: 5.15, w: 5.15, h: 0.35, fontFace: 'Aptos', fontSize: 13, bold: true, color: 'FFFFFF', align: 'center', charSpacing: 2, margin: 0 });
  addSpeakerNotes(slide, 'Summarise the topic, revisit the learning outcomes and invite learner questions.', notesEnabled);
  return pptx.write({ outputType: 'nodebuffer' });
}

async function buildPresentation(draft, options = {}) {
  if (Array.isArray(draft.reportSections) && draft.reportSections.length) return buildDetailedPresentation(draft, options);
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = options.author || 'AI Teacher Resource Hub';
  pptx.company = options.institution || 'Academic Institution';
  pptx.subject = text(draft.subject || draft.topic, 200);
  pptx.title = text(draft.topic || 'Academic Presentation', 200);
  pptx.lang = draft.language || 'en-US';
  pptx.theme = {
    headFontFace: 'Aptos Display',
    bodyFontFace: 'Aptos',
    lang: 'en-US'
  };
  pptx.defineSlideMaster({
    title: 'PHASE3_MASTER',
    background: { color: 'FFFFFF' },
    objects: []
  });

  const theme = resolveTheme(options, draft);
  addTitleSlide(pptx, draft, theme);
  let slideNo = 2;

  const objectives = (draft.courseOutcomes || []).map((co) => `${co.code || ''} ${co.text || co}`.trim());
  if (objectives.length) {
    const slide = pptx.addSlide();
    addSlideTitle(slide, 'Learning Outcomes', 'What learners should be able to do after this session', theme);
    addBulletList(slide, objectives.slice(0, 7), 1.0, 1.65, 11.3, 4.9, theme, 20);
    addBrand(slide, theme, slideNo++);
  }

  const sections = (draft.sections || []).slice(0, Math.max(3, Math.min(Number(options.maxContentSlides || 8), 12)));
  sections.forEach((section) => {
    const slide = pptx.addSlide();
    addSlideTitle(slide, section.h || 'Core Concept', `${draft.subject || ''} · ${draft.topic || ''}`, theme);
    slide.addShape('roundRect', { x: 0.85, y: 1.48, w: 11.65, h: 5.25, rectRadius: 0.06, line: { color: theme.secondary, transparency: 60, width: 1.2 }, fill: { color: theme.card } });
    addBulletList(slide, splitIntoBullets(section.b), 1.15, 1.78, 11.0, 4.65, theme, 17);
    addBrand(slide, theme, slideNo++);
  });

  if (!sections.length && (draft.qa || []).length) {
    const qaChunks = [];
    for (let i = 0; i < draft.qa.length; i += 4) qaChunks.push(draft.qa.slice(i, i + 4));
    qaChunks.slice(0, 4).forEach((chunk, chunkIndex) => {
      const slide = pptx.addSlide();
      addSlideTitle(slide, chunkIndex ? 'Knowledge Check — Continued' : 'Knowledge Check', 'Questions with concise teacher answer keys', theme);
      const items = chunk.map((item, index) => `${chunkIndex * 4 + index + 1}. ${item.q}\nAnswer: ${item.a}`);
      addBulletList(slide, items, 0.95, 1.5, 11.5, 5.2, theme, 15);
      addBrand(slide, theme, slideNo++);
    });
  }

  const bloom = (draft.bloomQuestions || []).slice(0, 8);
  if (bloom.length) {
    const slide = pptx.addSlide();
    addSlideTitle(slide, "Bloom's Taxonomy Questions", 'Use these prompts for discussion, assessment or reflection', theme);
    const items = bloom.map((q) => `[${q.level || 'Bloom'}] ${q.question}`);
    addBulletList(slide, items, 0.95, 1.5, 11.5, 5.35, theme, 15.5);
    addBrand(slide, theme, slideNo++);
  }

  const mappings = (draft.coMapping || []).slice(0, 6);
  if (mappings.length) {
    const slide = pptx.addSlide();
    addSlideTitle(slide, 'Course Outcome Alignment', 'How the learning content supports measurable outcomes', theme);
    const rows = [['Outcome', 'Bloom Levels', 'Alignment', 'Justification']].concat(mappings.map((m) => [
      text(m.courseOutcome, 20),
      text((m.bloomLevels || []).join(', '), 80),
      `${Number(m.alignmentScore || 0)}%`,
      text(m.justification, 180)
    ]));
    slide.addTable(rows, {
      x: 0.75, y: 1.55, w: 11.85, h: 4.95,
      border: { type: 'solid', color: theme.secondary, pt: 0.8 },
      fill: theme.card, color: theme.text, fontFace: 'Aptos', fontSize: 12,
      rowH: 0.56, margin: 0.08,
      bold: false,
      autoFit: false,
      colW: [1.25, 2.2, 1.1, 7.3]
    });
    addBrand(slide, theme, slideNo++);
  }

  const quality = draft.qualityScore;
  if (quality) {
    const slide = pptx.addSlide();
    addSlideTitle(slide, 'AI Quality Review', 'A teacher should still verify facts, examples and institutional wording', theme);
    slide.addShape('ellipse', { x: 0.95, y: 1.7, w: 2.4, h: 2.4, line: { color: theme.secondary, width: 4 }, fill: { color: theme.card } });
    slide.addText(String(Number(quality.overall || 0)), { x: 1.3, y: 2.22, w: 1.7, h: 0.75, fontFace: 'Aptos Display', fontSize: 36, bold: true, color: theme.primary, align: 'center', margin: 0 });
    slide.addText('/100', { x: 1.45, y: 3.0, w: 1.4, h: 0.3, fontFace: 'Aptos', fontSize: 11, color: theme.muted, align: 'center', margin: 0 });
    addBulletList(slide, [
      ...(quality.strengths || []).map((x) => `Strength: ${x}`),
      ...(quality.improvements || []).map((x) => `Improve: ${x}`)
    ], 3.85, 1.6, 8.3, 4.85, theme, 17);
    addBrand(slide, theme, slideNo++);
  }

  const finalSlide = pptx.addSlide();
  finalSlide.background = { color: theme.primary };
  finalSlide.addText('Discussion & Questions', { x: 1.0, y: 2.35, w: 11.3, h: 0.8, fontFace: 'Aptos Display', fontSize: 34, bold: true, color: 'FFFFFF', align: 'center', margin: 0 });
  finalSlide.addText(text(draft.topic, 160), { x: 1.5, y: 3.28, w: 10.3, h: 0.5, fontFace: 'Aptos', fontSize: 17, color: theme.secondary, align: 'center', margin: 0 });
  finalSlide.addText('Review • Reflect • Apply', { x: 3.8, y: 4.42, w: 5.8, h: 0.35, fontFace: 'Aptos', fontSize: 13, bold: true, color: 'FFFFFF', align: 'center', charSpacing: 2, margin: 0 });

  return pptx.write({ outputType: 'nodebuffer' });
}

module.exports = { buildPresentation, buildDetailedPresentation, THEMES, iconForHeading, resolveTheme };
