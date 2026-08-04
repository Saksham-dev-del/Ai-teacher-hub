const { callJson } = require('./aiGateway');
const { UNTRUSTED_REFERENCE_RULES } = require('./promptGuard');

function esc(s) {
  return String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// ---------- 11.21: AI Resume Generator ----------
// Deterministic — turns key points into action-oriented resume bullets. No AI
// call needed (and none should be trusted to invent resume claims anyway).
function buildResumeText(draft) {
  const sections = draft.reportSections || [];
  const bullets = [];
  sections.forEach((s) => {
    (s.keyPoints || []).slice(0, 3).forEach((kp) => {
      const clean = String(kp).replace(/\.$/, '');
      bullets.push(`${clean}${/\.$/.test(kp) ? '' : ''} (${s.heading})`);
    });
  });
  const skills = [...new Set(sections.map((s) => s.heading))].slice(0, 10);
  const lines = [
    `PROJECT / COURSEWORK: ${draft.topic}`,
    draft.subject ? `Subject: ${draft.subject}${draft.course ? ' · ' + draft.course : ''}` : '',
    '',
    'SUMMARY',
    sections[0]?.summary || `Worked on ${draft.topic}, covering ${skills.slice(0, 3).join(', ')}.`,
    '',
    'KEY CONTRIBUTIONS / HIGHLIGHTS',
    ...bullets.slice(0, 12).map((b) => `- ${b}`),
    '',
    'RELATED TOPICS / SKILLS',
    skills.join(' · ')
  ].filter((l) => l !== undefined);
  return lines.join('\n');
}

// ---------- 11.22: AI Portfolio Generator ----------
// Deterministic — self-contained HTML, project-card styled (distinct from
// the Phase 11.20 Website Generator's document-style layout).
function buildPortfolioHtml(draft) {
  const sections = draft.reportSections || [];
  const cards = sections.map((s) => `
    <article class="card">
      <h3>${esc(s.heading)}</h3>
      <p>${esc(s.summary || '')}</p>
      ${(s.keyPoints || []).length ? `<ul>${s.keyPoints.slice(0, 4).map((k) => `<li>${esc(k)}</li>`).join('')}</ul>` : ''}
    </article>`).join('');

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(draft.topic)} — Portfolio</title>
<style>
  :root { --ink:#0f172a; --muted:#64748b; --accent:#4f46e5; --bg:#f8fafc; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:'Segoe UI',Arial,sans-serif; background:var(--bg); color:var(--ink); }
  header { padding:70px 24px 50px; text-align:center; background:linear-gradient(135deg,var(--accent),#0f172a); color:#fff; }
  header h1 { margin:0 0 10px; font-size:clamp(28px,4vw,46px); }
  header p { opacity:.85; margin:0; }
  .grid { max-width:1000px; margin:-30px auto 60px; padding:0 20px; display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:18px; }
  .card { background:#fff; border-radius:16px; padding:22px; box-shadow:0 14px 30px rgba(15,23,42,.08); }
  .card h3 { margin:0 0 8px; color:var(--accent); font-size:17px; }
  .card p { color:var(--muted); font-size:13.5px; margin:0 0 10px; }
  .card ul { padding-left:18px; margin:0; font-size:12.5px; color:var(--ink); }
  .card li { margin-bottom:4px; }
  footer { text-align:center; padding:30px; color:var(--muted); font-size:12px; }
</style></head>
<body>
<header><h1>${esc(draft.topic)}</h1><p>${esc(draft.subject || '')}${draft.course ? ' · ' + esc(draft.course) : ''}</p></header>
<div class="grid">${cards}</div>
<footer>Portfolio generated from an AI Teacher Resource Hub presentation.</footer>
</body></html>`;
}

// ---------- 11.23: AI Blog Generator ----------
function fallbackBlog(draft) {
  const sections = draft.reportSections || [];
  const body = sections.map((s) => `## ${s.heading}\n\n${s.summary || ''}\n\n${(s.keyPoints || []).map((k) => `- ${k}`).join('\n')}`).join('\n\n');
  return `# ${draft.topic}\n\n${sections[0]?.summary || ''}\n\n${body}`;
}
async function buildBlogPost(draft) {
  const fallback = fallbackBlog(draft);
  try {
    const system = `You are a technical blog writer. Turn lecture-slide content into a flowing, engaging blog post in Markdown — narrative prose, not bullet-dump. ${UNTRUSTED_REFERENCE_RULES} Return JSON only.`;
    const prompt = `Topic: ${draft.topic}\nSections:\n${JSON.stringify((draft.reportSections || []).slice(0, 12).map((s) => ({ heading: s.heading, summary: s.summary, keyPoints: s.keyPoints })))}\nWrite a blog post: catchy title, short intro hook, 3-6 flowing sections (H2 headings) in Markdown, and a short conclusion. Return {"markdown":"# Title\\n\\n..."}`;
    const ai = await callJson(system, prompt);
    if (ai.markdown && ai.markdown.length > 100) return { markdown: ai.markdown, generationMode: 'ai' };
  } catch (_) {}
  return { markdown: fallback, generationMode: 'fallback' };
}

// ---------- 11.24: AI LinkedIn Post Generator ----------
function fallbackLinkedIn(draft) {
  const first = draft.reportSections?.[0];
  const points = (first?.keyPoints || []).slice(0, 3).map((k) => `→ ${k}`).join('\n');
  return [{
    label: 'Insight post',
    text: `${draft.topic}: a quick breakdown.\n\n${points}\n\n#${String(draft.subject || 'Learning').replace(/\s+/g, '')} #Education`
  }];
}
async function buildLinkedInPosts(draft) {
  const fallback = fallbackLinkedIn(draft);
  try {
    const system = `You write engaging, professional LinkedIn posts summarising academic/technical content. No emojis spam, no clickbait, 2-4 short paragraphs plus hashtags. ${UNTRUSTED_REFERENCE_RULES} Return JSON only.`;
    const prompt = `Topic: ${draft.topic}\nKey sections: ${JSON.stringify((draft.reportSections || []).slice(0, 6).map((s) => ({ heading: s.heading, summary: s.summary })))}\nWrite 3 distinct LinkedIn post variants (different angles/hooks) summarising this content for a professional audience.\nReturn {"posts":[{"label":"...","text":"..."}]}`;
    const ai = await callJson(system, prompt);
    if (Array.isArray(ai.posts) && ai.posts.length) return { posts: ai.posts.slice(0, 4).map((p) => ({ label: String(p.label || 'Post').slice(0, 40), text: String(p.text || '').slice(0, 1400) })), generationMode: 'ai' };
  } catch (_) {}
  return { posts: fallback, generationMode: 'fallback' };
}

// ---------- 11.25: AI YouTube/Reel/Podcast Script Generator ----------
// Reuses the existing Phase 10 video-script engine (fallbackVideoScript/videoScript),
// grounded in the deck's actual sections instead of just a bare topic.
async function buildYouTubeScript(draft, format, videoScript) {
  const context = (draft.reportSections || []).slice(0, 10).map((s) => `${s.heading}: ${s.summary}`).join('\n');
  return videoScript({ topic: draft.topic, subject: draft.subject, language: draft.language || 'English', format, context });
}

module.exports = { buildResumeText, buildPortfolioHtml, buildBlogPost, buildLinkedInPosts, buildYouTubeScript };
