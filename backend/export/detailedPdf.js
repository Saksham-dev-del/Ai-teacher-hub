const fs = require('fs');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const PAGE = [595.28, 841.89];
const COLORS = {
  ink: rgb(0.09, 0.13, 0.18), muted: rgb(0.36, 0.42, 0.48), line: rgb(0.82, 0.85, 0.88),
  paper: rgb(0.98, 0.985, 0.99), primary: rgb(0.19, 0.32, 0.69), secondary: rgb(0.02, 0.57, 0.58),
  accent: rgb(0.95, 0.58, 0.16), pale: rgb(0.93, 0.96, 1), green: rgb(0.09, 0.58, 0.39), red: rgb(0.76, 0.18, 0.20), white: rgb(1, 1, 1)
};

function safe(text) { return String(text || '').replace(/[^\x20-\x7E\n]/g, '?'); }
function cleanLines(text) { return safe(text).replace(/\r/g, '').split(/\n+/).map((x) => x.trim()).filter(Boolean); }
function hexColor(hex, fallback = COLORS.primary) {
  const h = String(hex || '').replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(h)) return fallback;
  return rgb(parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255);
}

class ReportWriter {
  constructor(pdfDoc, fonts, draft, theme) {
    this.pdfDoc = pdfDoc; this.fonts = fonts; this.draft = draft; this.theme = theme;
    this.margin = 50; this.page = null; this.y = 0; this.contentWidth = PAGE[0] - this.margin * 2;
  }
  addPage() {
    this.page = this.pdfDoc.addPage(PAGE);
    this.page.drawRectangle({ x: 0, y: 0, width: PAGE[0], height: PAGE[1], color: COLORS.paper });
    this.y = PAGE[1] - 60;
    return this.page;
  }
  ensure(height = 30) { if (!this.page || this.y - height < 58) this.addPage(); }
  wrap(text, font, size, width = this.contentWidth) {
    const result = [];
    for (const paragraph of cleanLines(text)) {
      const words = paragraph.split(/\s+/);
      let line = '';
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(test, size) > width && line) { result.push(line); line = word; } else line = test;
      }
      if (line) result.push(line);
      result.push('');
    }
    if (result[result.length - 1] === '') result.pop();
    return result.length ? result : [''];
  }
  text(text, options = {}) {
    const size = options.size || 10.2; const font = options.bold ? this.fonts.bold : options.italic ? this.fonts.italic : this.fonts.regular;
    const x = options.x ?? this.margin; const width = options.width || this.contentWidth; const lineHeight = options.lineHeight || size * 1.38;
    const lines = this.wrap(text, font, size, width);
    for (const line of lines) {
      this.ensure(lineHeight + 3);
      if (line) this.page.drawText(line, { x, y: this.y, size, font, color: options.color || COLORS.ink });
      this.y -= lineHeight;
    }
    this.y -= options.after ?? 5;
  }
  heading(text, level = 2) {
    const size = level === 1 ? 21 : level === 2 ? 15 : 11.5;
    this.ensure(size * 2.2);
    if (level <= 2) this.page.drawRectangle({ x: this.margin - 10, y: this.y - 5, width: 4, height: size + 7, color: level === 1 ? this.theme.primary : this.theme.secondary });
    this.text(text, { size, bold: true, color: level === 1 ? this.theme.primary : COLORS.ink, after: level === 1 ? 12 : 7 });
  }
  bullet(items, options = {}) {
    const list = (items || []).filter(Boolean);
    for (const item of list) {
      const size = options.size || 9.7;
      const lines = this.wrap(item, this.fonts.regular, size, this.contentWidth - 24);
      this.ensure(lines.length * size * 1.4 + 4);
      this.page.drawCircle({ x: this.margin + 4, y: this.y + 3, size: 2.1, color: options.color || this.theme.secondary });
      lines.forEach((line) => { if (line) this.page.drawText(line, { x: this.margin + 16, y: this.y, size, font: this.fonts.regular, color: COLORS.ink }); this.y -= size * 1.4; });
      this.y -= 3;
    }
    this.y -= 3;
  }
  callout(title, body, color = COLORS.pale) {
    const lines = this.wrap(body, this.fonts.regular, 9.4, this.contentWidth - 30);
    const h = 34 + lines.length * 13;
    this.ensure(h + 8);
    this.page.drawRectangle({ x: this.margin, y: this.y - h + 10, width: this.contentWidth, height: h, color, borderColor: this.theme.secondary, borderWidth: 0.7 });
    this.page.drawText(safe(title), { x: this.margin + 14, y: this.y - 10, size: 10.5, font: this.fonts.bold, color: this.theme.primary });
    let yy = this.y - 28;
    lines.forEach((line) => { if (line) this.page.drawText(line, { x: this.margin + 14, y: yy, size: 9.4, font: this.fonts.regular, color: COLORS.ink }); yy -= 13; });
    this.y -= h + 4;
  }
  table(table) {
    if (!table?.headers?.length || !table?.rows?.length) return;
    const cols = Math.min(table.headers.length, 5); const colW = this.contentWidth / cols; const size = 7.8;
    const rows = [table.headers.slice(0, cols), ...table.rows.slice(0, 8).map((r) => r.slice(0, cols))];
    for (let ri = 0; ri < rows.length; ri += 1) {
      const wrapped = rows[ri].map((cell) => this.wrap(cell, ri === 0 ? this.fonts.bold : this.fonts.regular, size, colW - 10));
      const rowH = Math.max(28, ...wrapped.map((x) => x.length * 10 + 10));
      this.ensure(rowH + 3);
      rows[ri].forEach((cell, ci) => {
        const x = this.margin + ci * colW;
        this.page.drawRectangle({ x, y: this.y - rowH + 8, width: colW, height: rowH, color: ri === 0 ? this.theme.primary : (ri % 2 ? COLORS.white : COLORS.pale), borderColor: COLORS.line, borderWidth: 0.5 });
        let yy = this.y - 8;
        wrapped[ci].forEach((line) => { if (line) this.page.drawText(line, { x: x + 5, y: yy, size, font: ri === 0 ? this.fonts.bold : this.fonts.regular, color: ri === 0 ? COLORS.white : COLORS.ink }); yy -= 10; });
      });
      this.y -= rowH;
    }
    this.y -= 10;
  }
  diagram(visual) {
    if (!visual || visual.type === 'none' || visual.type === 'image') return;
    const nodes = (visual.nodes || []).filter(Boolean).slice(0, 6);
    if (!nodes.length) return;
    const h = visual.type === 'comparison' ? 160 : 190;
    this.ensure(h + 28);
    this.page.drawRectangle({ x: this.margin, y: this.y - h + 4, width: this.contentWidth, height: h, color: COLORS.white, borderColor: COLORS.line, borderWidth: 0.8 });
    this.page.drawText(safe(visual.title || 'Concept Visual'), { x: this.margin + 14, y: this.y - 18, size: 10.5, font: this.fonts.bold, color: this.theme.primary });
    const top = this.y - 52;
    if (visual.type === 'comparison') {
      const half = (this.contentWidth - 42) / 2;
      nodes.slice(0, 2).forEach((node, i) => {
        const x = this.margin + 14 + i * (half + 14);
        this.page.drawRectangle({ x, y: top - 85, width: half, height: 78, color: i ? rgb(0.94, 0.98, 0.97) : COLORS.pale, borderColor: i ? this.theme.secondary : this.theme.primary, borderWidth: 1 });
        const lines = this.wrap(node, this.fonts.bold, 9.4, half - 16).slice(0, 5);
        let yy = top - 28; lines.forEach((line) => { this.page.drawText(line, { x: x + 8, y: yy, size: 9.4, font: this.fonts.bold, color: COLORS.ink }); yy -= 13; });
      });
    } else {
      const boxW = Math.min(115, (this.contentWidth - 20) / Math.min(nodes.length, 4));
      const boxH = 48; const gap = 12; const count = Math.min(nodes.length, 4); const total = count * boxW + (count - 1) * gap; let x = this.margin + (this.contentWidth - total) / 2;
      nodes.slice(0, 4).forEach((node, i) => {
        this.page.drawRectangle({ x, y: top - boxH, width: boxW, height: boxH, color: i % 2 ? rgb(0.92, 0.98, 0.97) : COLORS.pale, borderColor: i % 2 ? this.theme.secondary : this.theme.primary, borderWidth: 1 });
        const lines = this.wrap(node, this.fonts.bold, 8.2, boxW - 12).slice(0, 3); let yy = top - 18;
        lines.forEach((line) => { this.page.drawText(line, { x: x + 6, y: yy, size: 8.2, font: this.fonts.bold, color: COLORS.ink }); yy -= 10.5; });
        if (i < count - 1) { this.page.drawLine({ start: { x: x + boxW, y: top - boxH / 2 }, end: { x: x + boxW + gap - 2, y: top - boxH / 2 }, thickness: 1.4, color: this.theme.secondary }); }
        x += boxW + gap;
      });
      if (nodes.length > 4) {
        const lower = nodes.slice(4, 6); const lowerW = 150; let lx = this.margin + (this.contentWidth - lower.length * lowerW - (lower.length - 1) * 18) / 2;
        lower.forEach((node) => { this.page.drawRectangle({ x: lx, y: top - 118, width: lowerW, height: 42, color: rgb(0.99, 0.96, 0.88), borderColor: this.theme.accent, borderWidth: 1 }); this.page.drawText(safe(node).slice(0, 42), { x: lx + 7, y: top - 94, size: 8.1, font: this.fonts.bold, color: COLORS.ink }); lx += lowerW + 18; });
      }
    }
    this.y -= h + 10;
    if (visual.caption) this.text(visual.caption, { size: 8.2, italic: true, color: COLORS.muted, after: 10 });
  }
  async image(asset, visual) {
    if (!asset?.storagePath || !fs.existsSync(asset.storagePath)) return false;
    try {
      const data = fs.readFileSync(asset.storagePath);
      const image = asset.mimeType === 'image/png' ? await this.pdfDoc.embedPng(data) : await this.pdfDoc.embedJpg(data);
      const maxW = this.contentWidth; const maxH = 300; const scale = Math.min(maxW / image.width, maxH / image.height, 1);
      const w = image.width * scale; const h = image.height * scale;
      this.ensure(h + 40);
      this.page.drawImage(image, { x: this.margin + (this.contentWidth - w) / 2, y: this.y - h, width: w, height: h });
      this.y -= h + 8;
      this.text(visual?.caption || asset.caption || asset.originalName, { size: 8.2, italic: true, color: COLORS.muted, after: 12 });
      return true;
    } catch (error) {
      console.warn('[phase4/pdf] Image skipped:', error.message); return false;
    }
  }
}

async function exportDetailedPdf(draft, options = {}) {
  const pdfDoc = await PDFDocument.create();
  const fonts = {
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    italic: await pdfDoc.embedFont(StandardFonts.HelveticaOblique)
  };
  const theme = { primary: hexColor(options.primaryColor || '3152B0'), secondary: hexColor(options.secondaryColor || '079395'), accent: hexColor(options.accentColor || 'F29429') };
  const writer = new ReportWriter(pdfDoc, fonts, draft, theme);
  const assets = options.assets || [];
  const assetMap = new Map(assets.map((x) => [String(x._id), x]));

  // Cover
  let page = writer.addPage();
  page.drawRectangle({ x: 0, y: 0, width: PAGE[0], height: PAGE[1], color: theme.primary });
  page.drawCircle({ x: 490, y: 720, size: 150, color: theme.secondary, opacity: 0.28 });
  page.drawCircle({ x: 90, y: 90, size: 120, color: theme.accent, opacity: 0.22 });
  page.drawText('AI-ASSISTED ACADEMIC REPORT', { x: 54, y: 710, size: 11, font: fonts.bold, color: theme.accent });
  const titleLines = writer.wrap(draft.topic || draft.title || 'Academic Resource', fonts.bold, 31, 470).slice(0, 4);
  let ty = 640; titleLines.forEach((line) => { page.drawText(line, { x: 54, y: ty, size: 31, font: fonts.bold, color: COLORS.white }); ty -= 40; });
  page.drawText(safe(`${draft.type || 'Resource'} · ${draft.contentDepth || 'Detailed'} mode`).toUpperCase(), { x: 54, y: ty - 12, size: 13, font: fonts.bold, color: rgb(0.84, 0.92, 1) });
  page.drawText(safe(`${draft.course || ''} | ${draft.subject || ''} | ${draft.difficulty || ''}`), { x: 54, y: 180, size: 12, font: fonts.regular, color: COLORS.white });
  page.drawText(safe(options.institution || 'Academic Institution'), { x: 54, y: 145, size: 11, font: fonts.bold, color: theme.accent });
  page.drawText('Faculty review required before classroom use', { x: 54, y: 95, size: 9, font: fonts.italic, color: rgb(0.82, 0.88, 0.98) });

  // Document profile + TOC
  writer.addPage();
  writer.heading('Document Profile', 1);
  writer.callout('Executive Summary', draft.executiveSummary || `Detailed academic resource for ${draft.topic}.`);
  writer.table({ headers: ['Field', 'Value'], rows: [
    ['Course', draft.course || ''], ['Subject', draft.subject || ''], ['Resource Type', draft.type || ''], ['Difficulty', draft.difficulty || ''],
    ['Content Depth', draft.contentDepth || 'detailed'], ['Visual Density', draft.visualDensity || 'balanced'], ['Target Pages', String(draft.targetPages || '')], ['Target Slides', String(draft.targetSlides || '')]
  ]});
  writer.heading('Table of Contents', 1);
  (draft.reportSections || []).forEach((section, index) => writer.text(`${index + 1}. ${section.heading}`, { size: 10.2, color: index % 2 ? theme.secondary : theme.primary, after: 2 }));
  writer.text(`${(draft.reportSections || []).length + 1}. Bloom's Taxonomy Questions`, { size: 10.2, after: 2 });
  writer.text(`${(draft.reportSections || []).length + 2}. Course Outcome Mapping`, { size: 10.2, after: 2 });
  writer.text(`${(draft.reportSections || []).length + 3}. Quality and Validation Review`, { size: 10.2, after: 2 });
  writer.text(`${(draft.reportSections || []).length + 4}. References`, { size: 10.2, after: 2 });

  // Learning outcomes
  if ((draft.courseOutcomes || []).length) {
    writer.addPage(); writer.heading('Learning Outcomes', 1);
    writer.bullet(draft.courseOutcomes.map((x) => `${x.code}: ${x.text}`), { size: 10.4 });
  }

  // Main sections
  for (let index = 0; index < (draft.reportSections || []).length; index += 1) {
    const section = draft.reportSections[index];
    writer.addPage();
    writer.text(`SECTION ${index + 1}`, { size: 9, bold: true, color: theme.secondary, after: 4 });
    writer.heading(section.heading, 1);
    if (section.summary) writer.callout('Section Overview', section.summary, COLORS.pale);
    (section.explanation || []).forEach((paragraph) => writer.text(paragraph, { size: 10.3, lineHeight: 14.4, after: 9 }));
    if ((section.keyPoints || []).length) { writer.heading('Key Points', 3); writer.bullet(section.keyPoints); }
    if ((section.examples || []).length) {
      writer.heading('Worked Examples', 3);
      section.examples.forEach((example, i) => writer.callout(`Example ${i + 1}: ${example.title}`, example.description, i % 2 ? rgb(0.94, 0.98, 0.97) : rgb(0.99, 0.97, 0.91)));
    }
    if ((section.applications || []).length) { writer.heading('Applications', 3); writer.bullet(section.applications, { color: COLORS.green }); }
    if (section.caseStudy) writer.callout(`Case Study: ${section.caseStudy.title}`, section.caseStudy.description, rgb(0.97, 0.94, 1));
    if (section.table) { writer.heading('Structured Comparison', 3); writer.table(section.table); }
    const asset = section.visual?.assetId ? assetMap.get(String(section.visual.assetId)) : null;
    const renderedImage = asset ? await writer.image(asset, section.visual) : false;
    if (!renderedImage) writer.diagram(section.visual);
    if ((section.commonMistakes || []).length) { writer.heading('Common Mistakes', 3); writer.bullet(section.commonMistakes, { color: COLORS.red }); }
    if (section.speakerNotes && draft.includeSpeakerNotes) writer.callout('Teacher / Speaker Notes', section.speakerNotes, rgb(0.95, 0.95, 0.95));
    if ((section.citations || []).length) writer.text(`Sources used: ${section.citations.map((x) => `[${x}]`).join(', ')}`, { size: 8.2, italic: true, color: COLORS.muted });
  }

  if ((draft.bloomQuestions || []).length) {
    writer.addPage(); writer.heading("Bloom's Taxonomy Questions", 1);
    draft.bloomQuestions.forEach((item, index) => {
      writer.heading(`${index + 1}. [${item.level}] ${item.question}`, 3);
      writer.callout('Suggested Answer', item.answer || 'Teacher to review and complete.', rgb(0.94, 0.98, 0.97));
      if (item.rationale) writer.text(`Pedagogical rationale: ${item.rationale}`, { size: 8.8, italic: true, color: COLORS.muted });
    });
  }

  if ((draft.coMapping || []).length) {
    writer.addPage(); writer.heading('Course Outcome Mapping', 1);
    writer.table({ headers: ['CO', 'Matched Sections', 'Bloom', 'Alignment'], rows: draft.coMapping.map((m) => [m.courseOutcome, (m.matchedSections || []).join(', '), (m.bloomLevels || []).join(', '), `${m.alignmentScore || 0}%`]) });
    draft.coMapping.forEach((m) => writer.text(`${m.courseOutcome}: ${m.justification || ''}`, { size: 9.3 }));
  }

  writer.addPage(); writer.heading('Quality and Validation Review', 1);
  if (draft.qualityScore) {
    writer.callout('AI Quality Score', `${draft.qualityScore.overall || 0}/100 - ${draft.qualityScore.grade || ''}. Teacher review is mandatory.`, rgb(0.92, 0.98, 0.94));
    writer.table({ headers: ['Metric', 'Score'], rows: Object.entries(draft.qualityScore.metrics || {}).map(([k, v]) => [k, `${v}%`]) });
  }
  if (draft.validationReport) {
    writer.callout('Export Readiness', `${draft.validationReport.score || 0}/100 - ${draft.validationReport.grade || ''}`, COLORS.pale);
    (draft.validationReport.checks || []).forEach((check) => writer.text(`${check.passed ? '[PASS]' : '[REVIEW]'} ${check.label}: ${check.detail}`, { size: 9.2, color: check.passed ? COLORS.green : COLORS.red, after: 4 }));
  }
  if ((draft.generationWarnings || []).length) { writer.heading('Generation Warnings', 3); writer.bullet(draft.generationWarnings); }

  if ((draft.references || []).length) {
    writer.addPage(); writer.heading('References and Retrieved Evidence', 1);
    draft.references.forEach((ref, index) => {
      writer.heading(`[${ref.id || `S${index + 1}`}] ${ref.title || 'Academic Source'}`, 3);
      writer.text(`${ref.location || ''}${ref.relevance ? ` · Relevance ${ref.relevance}%` : ''}`, { size: 8.5, bold: true, color: theme.secondary });
      writer.text(ref.preview || '', { size: 9.2 });
    });
  }

  // Footer/page numbers
  const pages = pdfDoc.getPages();
  pages.forEach((p, index) => {
    if (index > 0) {
      p.drawLine({ start: { x: 48, y: 36 }, end: { x: PAGE[0] - 48, y: 36 }, thickness: 0.5, color: COLORS.line });
      p.drawText('AI Teacher Resource Hub · Phase 4 Detailed Visual Report', { x: 48, y: 22, size: 7.5, font: fonts.regular, color: COLORS.muted });
      p.drawText(`${index + 1} / ${pages.length}`, { x: PAGE[0] - 85, y: 22, size: 7.5, font: fonts.bold, color: COLORS.muted });
    }
  });
  return pdfDoc.save();
}

module.exports = { exportDetailedPdf };
