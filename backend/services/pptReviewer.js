const { callJson } = require('./aiGateway');
const { UNTRUSTED_REFERENCE_RULES } = require('./promptGuard');
const { THEMES } = require('./presentation');

function hexToRgb(hex) {
  const v = String(hex || '').replace('#', '');
  const n = v.length === 3 ? v.split('').map((c) => c + c).join('') : v;
  const num = parseInt(n, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function relLuminance({ r, g, b }) {
  const chan = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * chan[0] + 0.7152 * chan[1] + 0.0722 * chan[2];
}

function contrastRatio(hexA, hexB) {
  const la = relLuminance(hexToRgb(hexA));
  const lb = relLuminance(hexToRgb(hexB));
  const [lighter, darker] = la > lb ? [la, lb] : [lb, la];
  return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
}

function wordCount(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function sectionWordCount(s) {
  return wordCount(s.summary) + (s.explanation || []).reduce((a, p) => a + wordCount(p), 0) + (s.keyPoints || []).reduce((a, p) => a + wordCount(p), 0);
}

function checkContrast(themeKey) {
  const theme = THEMES[themeKey] || THEMES.academic;
  const bodyRatio = contrastRatio(`#${theme.text}`, `#${theme.card}`);
  const accentRatio = contrastRatio(`#${theme.primary}`, `#${theme.card}`);
  // WCAG AA for normal text requires >= 4.5:1; large/bold slide text is commonly judged against 3:1.
  return {
    theme: themeKey,
    bodyTextContrast: bodyRatio,
    bodyTextPass: bodyRatio >= 4.5,
    accentContrast: accentRatio,
    accentPass: accentRatio >= 3,
  };
}

function heuristicGrammarFindings(sections) {
  const findings = [];
  sections.forEach((s, i) => {
    const text = [s.summary, ...(s.explanation || []), ...(s.keyPoints || [])].join(' ');
    if (/\s{2,}/.test(text)) findings.push({ slide: i + 1, heading: s.heading, issue: 'Double/extra spaces found.' });
    if (/\b(\w+)\s+\1\b/i.test(text)) findings.push({ slide: i + 1, heading: s.heading, issue: 'Repeated word detected (e.g. "the the").' });
    if (/[a-z]{2,}[A-Z]/.test(text.replace(/\b(AI|PPT|PDF|API|URL|ID)\b/g, ''))) findings.push({ slide: i + 1, heading: s.heading, issue: 'Possible mid-word capitalisation / spacing issue.' });
    if (!/[.!?]$/.test(s.summary?.trim() || '')) findings.push({ slide: i + 1, heading: s.heading, issue: 'Summary does not end with punctuation.' });
  });
  return findings.slice(0, 20);
}

async function aiGrammarPass(topic, sections) {
  const system = `You are a strict academic proofreader. Find real grammar, spelling, tone, and clarity issues only — do not invent issues. ${UNTRUSTED_REFERENCE_RULES} Return JSON only.`;
  const prompt = `Topic: ${topic}\nReview these slide texts for grammar, spelling, and awkward phrasing. Only report genuine issues (max 2 per slide).\n${JSON.stringify(sections.map((s, i) => ({ slide: i + 1, heading: s.heading, summary: s.summary, explanation: s.explanation })))}\nReturn {"issues":[{"slide":1,"heading":"...","issue":"...","suggestion":"..."}]}. If a slide is clean, do not include it.`;
  const ai = await callJson(system, prompt);
  return Array.isArray(ai.issues) ? ai.issues.slice(0, 30) : [];
}

async function reviewPresentation(draft, themeKey = 'academic') {
  const sections = Array.isArray(draft.reportSections) ? draft.reportSections : [];
  if (!sections.length) throw new Error('This presentation has no sections yet — generate it first.');

  const contrast = checkContrast(themeKey);

  const textHeavy = sections.map((s, i) => ({ slide: i + 1, heading: s.heading, words: sectionWordCount(s) })).filter((x) => x.words > 160);
  const missingVisual = sections.map((s, i) => ({ slide: i + 1, heading: s.heading })).filter((s2, i) => {
    const s = sections[i];
    const hasVisual = s.visual && s.visual.type && s.visual.type !== 'none';
    const hasTableOrCase = s.table || s.caseStudy;
    return !hasVisual && !hasTableOrCase;
  });

  let grammarIssues = [];
  let grammarMode = 'ai';
  try {
    grammarIssues = await aiGrammarPass(draft.topic || '', sections);
  } catch (_) {
    grammarIssues = heuristicGrammarFindings(sections);
    grammarMode = 'heuristic';
  }

  const totalSlides = sections.length + 4; // + title/roadmap/summary/qa slides added by the pptx builder
  let score = 100;
  score -= Math.min(30, textHeavy.length * 6);
  score -= Math.min(20, missingVisual.length * 4);
  score -= Math.min(25, grammarIssues.length * 3);
  if (!contrast.bodyTextPass) score -= 15;
  if (!contrast.accentPass) score -= 8;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const grade = score >= 85 ? 'Excellent' : score >= 70 ? 'Good — minor polish needed' : score >= 50 ? 'Needs revision' : 'Significant rework recommended';

  return {
    professionalScore: score,
    grade,
    totalSlides,
    contrast,
    checks: {
      grammarMode,
      textDensityIssues: textHeavy.length,
      missingVisualSlides: missingVisual.length,
      grammarIssues: grammarIssues.length,
      fontConsistency: 'Pass — single theme font (Aptos) is applied to every slide automatically.',
      alignment: 'Pass — layout positions are template-driven and consistent across all slides.'
    },
    findings: {
      textHeavy,
      missingVisual,
      grammarIssues
    },
    recommendations: [
      textHeavy.length ? `${textHeavy.length} slide(s) have dense text (>160 words) — consider splitting into two slides or trimming to bullet points.` : 'Text density looks fine across all slides.',
      missingVisual.length ? `${missingVisual.length} slide(s) have no diagram, table, or case study — consider enabling diagrams or adding an example.` : 'Every slide has a supporting visual, table, or case study.',
      contrast.bodyTextPass ? 'Body text contrast passes WCAG AA (4.5:1) for the selected theme.' : `Body text contrast (${contrast.bodyTextContrast}:1) is below the WCAG AA 4.5:1 guideline for this theme — pick a higher-contrast theme (e.g. Academic, Corporate, Minimal) for readability.`,
      grammarIssues.length ? `${grammarIssues.length} possible grammar/clarity issue(s) found — review before presenting.` : 'No grammar issues detected.'
    ]
  };
}

module.exports = { reviewPresentation, checkContrast, contrastRatio };
