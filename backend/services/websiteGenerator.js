function esc(s) {
  return String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function buildWebsiteHtml(draft) {
  const sections = Array.isArray(draft.reportSections) ? draft.reportSections : [];
  const nav = sections.map((s, i) => `<a href="#s${i}">${esc(s.heading)}</a>`).join('');
  const body = sections.map((s, i) => `
    <section id="s${i}" class="block">
      <h2>${esc(s.heading)}</h2>
      ${s.summary ? `<p class="lead">${esc(s.summary)}</p>` : ''}
      ${(s.explanation || []).map((p) => `<p>${esc(p)}</p>`).join('')}
      ${(s.keyPoints || []).length ? `<ul>${s.keyPoints.map((k) => `<li>${esc(k)}</li>`).join('')}</ul>` : ''}
      ${s.caseStudy ? `<div class="case"><b>${esc(s.caseStudy.title || 'Case Study')}</b><p>${esc(s.caseStudy.description || '')}</p></div>` : ''}
      ${s.table && s.table.headers ? `<table><thead><tr>${s.table.headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${(s.table.rows || []).map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : ''}
    </section>`).join('');

  const refs = (draft.references || []).length
    ? `<section class="block"><h2>References</h2><ul>${draft.references.map((r) => `<li>${esc(r.title)} — ${esc(r.location)}</li>`).join('')}</ul></section>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(draft.topic)} — ${esc(draft.subject || 'Course Website')}</title>
<style>
  :root { --ink:#1e2a28; --muted:#52605c; --accent:#2f5d50; --bg:#f7f2e6; --card:#fffefa; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:'Segoe UI',Arial,sans-serif; color:var(--ink); background:var(--bg); line-height:1.6; }
  header { background:linear-gradient(135deg,var(--accent),#1e2a28); color:#fff; padding:64px 24px 48px; text-align:center; }
  header h1 { margin:0 0 8px; font-size:clamp(28px,4vw,44px); }
  header p { margin:0; opacity:.85; font-size:15px; }
  nav { position:sticky; top:0; background:var(--card); border-bottom:1px solid #e5ddc8; padding:10px 18px; display:flex; gap:14px; overflow-x:auto; z-index:10; }
  nav a { color:var(--accent); text-decoration:none; font-size:13px; font-weight:700; white-space:nowrap; }
  main { max-width:820px; margin:0 auto; padding:36px 20px 80px; }
  .block { background:var(--card); border:1px solid #eee3c8; border-radius:16px; padding:26px 28px; margin-bottom:22px; box-shadow:0 10px 26px rgba(30,42,40,.06); }
  h2 { margin-top:0; color:var(--accent); font-size:22px; }
  .lead { font-weight:600; color:var(--ink); }
  p { color:var(--muted); font-size:14.5px; }
  ul { padding-left:20px; }
  li { margin-bottom:6px; font-size:14px; }
  .case { margin-top:14px; padding:14px 16px; border-left:4px solid var(--accent); background:#f7f2e6; border-radius:8px; }
  table { width:100%; border-collapse:collapse; margin-top:14px; font-size:13px; }
  th, td { border:1px solid #e5ddc8; padding:8px 10px; text-align:left; }
  th { background:var(--accent); color:#fff; }
  footer { text-align:center; padding:24px; font-size:12px; color:var(--muted); }
</style>
</head>
<body>
<header>
  <h1>${esc(draft.topic)}</h1>
  <p>${esc(draft.subject || '')}${draft.course ? ' · ' + esc(draft.course) : ''}</p>
</header>
<nav>${nav}</nav>
<main>
${body}
${refs}
</main>
<footer>Generated from an AI Teacher Resource Hub presentation — Phase 11.20 AI Website Generator.</footer>
</body>
</html>`;
}

module.exports = { buildWebsiteHtml };
