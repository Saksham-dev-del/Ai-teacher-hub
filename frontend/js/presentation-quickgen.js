// Phase 11.1: AI Presentation Generator
// Quick flow: Topic + Subject + Class + Semester + Presentation Type -> full slide deck.
// Reuses the existing Phase 4 detailed-generation job engine (apiStartDetailedJob /
// apiGetDetailedJob) and the existing PPTX/PDF export pipeline, so every slide already
// gets speaker notes, references, a conclusion and a Q&A slide "for free".

let qpgLastDraft = null;
let qpgGenerating = false;

function qpgDepthForSlideCount(count) {
  if (count <= 16) return 'quick';
  if (count <= 26) return 'standard';
  if (count <= 50) return 'detailed';
  return 'research';
}

function qpgReadInputs() {
  const topic = document.getElementById('qpg-topic').value.trim();
  const subject = document.getElementById('qpg-subject').value.trim();
  const className = document.getElementById('qpg-class').value.trim();
  const semester = document.getElementById('qpg-semester').value.trim();
  const presentationType = document.getElementById('qpg-type').value;
  const targetSlides = Number(document.getElementById('qpg-slides').value || 20);
  const theme = document.getElementById('qpg-theme').value;
  const course = [className, semester].filter(Boolean).join(' • ') || 'General Class';

  return {
    inputs: {
      course,
      subject: subject || 'General Subject',
      topic: topic || 'Untitled Topic',
      difficulty: 'Intermediate',
      duration: 'Full Session',
      type: 'Presentation',
      language: 'English',
      style: 'Concept-First',
      contentDepth: qpgDepthForSlideCount(targetSlides),
      visualDensity: 'balanced',
      targetPages: Math.max(4, Math.round(targetSlides / 2)),
      targetSlides,
      presentationType,
      examplesPerTopic: 2,
      includeDiagrams: true,
      includeImages: true,
      includeCaseStudies: true,
      includeReferences: true,
      includeSpeakerNotes: true,
      useRag: false
    },
    theme
  };
}

function qpgSetProgress(job) {
  const shell = document.getElementById('qpg-progress-shell');
  const fill = document.getElementById('qpg-progress-fill');
  const label = document.getElementById('qpg-progress-label');
  const message = document.getElementById('qpg-stage-message');
  if (shell) shell.style.display = 'block';
  const progress = Math.max(1, Math.min(100, Number(job.progress || 1)));
  if (fill) fill.style.width = `${progress}%`;
  if (label) label.textContent = `${progress}%`;
  if (message) message.textContent = job.message || 'Generating presentation...';
}

async function qpgPollJob(id) {
  for (let attempt = 0; attempt < 900; attempt += 1) {
    const job = await apiGetDetailedJob(id);
    qpgSetProgress(job);
    if (job.status === 'complete') return job.draft;
    if (job.status === 'failed') throw new Error(job.error || job.message || 'Presentation generation failed.');
    await new Promise((resolve) => setTimeout(resolve, 900));
  }
  throw new Error('Presentation generation timed out. Try again with fewer slides.');
}

async function qpgGenerate() {
  if (qpgGenerating) return;
  const { inputs, theme } = qpgReadInputs();
  if (!inputs.topic || inputs.topic === 'Untitled Topic') {
    showToast('Topic is required.', 'error');
    return;
  }

  const button = document.getElementById('btn-qpg-generate');
  const status = document.getElementById('qpg-status');
  const pdfButton = document.getElementById('btn-qpg-pdf');
  qpgGenerating = true;
  button.disabled = true;
  button.classList.add('generating');
  pdfButton.style.display = 'none';
  status.innerHTML = '<span class="status-pulse"></span> Building slide outline, content, visuals, references and speaker notes...';

  try {
    const queued = await apiStartDetailedJob(inputs);
    const draft = await qpgPollJob(queued.id);

    // The draft isn't a saved DB resource, so give it a local id the existing
    // PPT Studio dropdown/preview/export flow can reference.
    draft._id = `quickgen-${Date.now().toString(36)}`;
    draft.type = draft.presentationType || 'Presentation';

    resources.unshift(draft);
    qpgLastDraft = draft;

    populatePresentationResourceSelect();
    const select = document.getElementById('ppt-resource-select');
    if (select) select.value = draft._id;
    const themeSelect = document.getElementById('ppt-theme');
    if (themeSelect) themeSelect.value = theme;
    const slideLimit = document.getElementById('ppt-slide-limit');
    if (slideLimit) {
      const wanted = String(inputs.targetSlides);
      if ([...slideLimit.options].some((o) => o.value === wanted)) slideLimit.value = wanted;
    }
    renderPresentationPreview();

    status.textContent = `"${draft.topic}" is ready (${(draft.reportSections || []).length} sections planned). Use "Generate & download PowerPoint" below, or download PDF here.`;
    pdfButton.style.display = 'inline-block';
    showToast('AI presentation generated', 'success');

    document.getElementById('ppt-preview')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (err) {
    console.error(err);
    status.textContent = err.message;
    showToast(err.message, 'error');
  } finally {
    qpgGenerating = false;
    button.disabled = false;
    button.classList.remove('generating');
  }
}

// Phase 11.34: AI Templates Marketplace — curated starter templates (doc asked
// for an upload/browse/buy marketplace; without payments/moderation infra this
// is a curated "pick a starting point" gallery instead, which is the genuinely
// useful part of that idea).
const QTM_TEMPLATES = [
  { label: 'Engineering', topic: 'Digital Signal Processing Basics', subject: 'Electronics', className: 'B.Tech ECE', semester: 'Semester 5', type: 'Lecture', theme: 'corporate' },
  { label: 'B.Tech CSE', topic: 'Operating Systems: Process Scheduling', subject: 'Computer Science', className: 'B.Tech CSE', semester: 'Semester 4', type: 'Lecture', theme: 'modern' },
  { label: 'BCA', topic: 'Database Management Systems: Normalization', subject: 'DBMS', className: 'BCA', semester: 'Semester 3', type: 'Seminar', theme: 'academic' },
  { label: 'BBA', topic: 'Principles of Marketing', subject: 'Marketing', className: 'BBA', semester: 'Semester 2', type: 'Seminar', theme: 'corporate' },
  { label: 'MBA', topic: 'Strategic Management Frameworks', subject: 'Strategy', className: 'MBA', semester: 'Semester 1', type: 'Conference Talk', theme: 'minimal' },
  { label: 'Commerce', topic: 'Financial Accounting Basics', subject: 'Accounting', className: 'B.Com', semester: 'Semester 2', type: 'Lecture', theme: 'academic' },
  { label: 'School', topic: 'The Water Cycle', subject: 'Environmental Science', className: 'Class 7', semester: '', type: 'Lecture', theme: 'gradient' },
  { label: 'Medical', topic: 'Human Circulatory System', subject: 'Anatomy', className: 'MBBS', semester: 'Semester 2', type: 'Lecture', theme: 'corporate' },
  { label: 'Law', topic: 'Introduction to Constitutional Law', subject: 'Law', className: 'LLB', semester: 'Semester 1', type: 'Seminar', theme: 'minimal' }
];
function qtmRender() {
  const gallery = document.getElementById('qtm-gallery');
  gallery.innerHTML = QTM_TEMPLATES.map((t, i) => `<button type="button" class="qtm-card" data-idx="${i}"><b>${t.label}</b><span>${escapeHtml(t.topic)}</span></button>`).join('');
  gallery.querySelectorAll('.qtm-card').forEach((btn) => btn.addEventListener('click', () => {
    const t = QTM_TEMPLATES[Number(btn.dataset.idx)];
    document.getElementById('qpg-topic').value = t.topic;
    document.getElementById('qpg-subject').value = t.subject;
    document.getElementById('qpg-class').value = t.className;
    document.getElementById('qpg-semester').value = t.semester;
    document.getElementById('qpg-type').value = t.type;
    const themeSelect = document.getElementById('qpg-theme');
    themeSelect.value = t.theme;
    themeSelect.dispatchEvent(new Event('change'));
    showToast(`Loaded "${t.label}" template — review and generate`, 'success');
  }));
}
document.getElementById('btn-qtm-toggle')?.addEventListener('click', () => {
  const gallery = document.getElementById('qtm-gallery');
  const show = gallery.style.display === 'none';
  gallery.style.display = show ? 'grid' : 'none';
  if (show && !gallery.children.length) qtmRender();
});

document.getElementById('btn-qpg-generate')?.addEventListener('click', qpgGenerate);
document.getElementById('btn-qpg-pdf')?.addEventListener('click', () => {
  if (!qpgLastDraft) return;
  downloadPDF(qpgLastDraft);
});

// Phase 11.6: AI Live Edit — rewrite every slide's text per a free-text instruction,
// e.g. "make this more professional" or "simplify for first-year students".
async function qleApply() {
  const select = document.getElementById('ppt-resource-select');
  const instruction = document.getElementById('qle-instruction').value.trim();
  const status = document.getElementById('qle-status');
  const button = document.getElementById('btn-qle-apply');
  const resourceId = select?.value;

  if (!resourceId) { showToast('Select a resource first.', 'error'); return; }
  if (!instruction) { showToast('Describe the change you want (e.g. "make this more professional").', 'error'); return; }

  const isLocalDraft = resourceId.startsWith('quickgen-');
  const resource = resources.find((r) => String(r._id) === String(resourceId));
  if (!resource) { showToast('Resource not found.', 'error'); return; }

  button.disabled = true;
  button.classList.add('generating');
  status.innerHTML = '<span class="status-pulse"></span> Rewriting every slide\'s text to match your instruction...';

  try {
    const payload = isLocalDraft ? { draft: resource, instruction } : { resourceId, instruction };
    const { draft: revised, warnings } = await apiLiveEditPresentation(payload);

    // Preserve the local id/type so the export flow keeps treating it the same way.
    revised._id = resource._id;
    if (!isLocalDraft) revised._id = `quickgen-${Date.now().toString(36)}`; // saved resource -> now an edited local copy
    const idx = resources.findIndex((r) => String(r._id) === String(resourceId));
    if (idx >= 0) resources[idx] = revised; else resources.unshift(revised);

    populatePresentationResourceSelect();
    if (select) select.value = revised._id;
    renderPresentationPreview();

    status.textContent = warnings?.length
      ? `Updated, but ${warnings.length} section batch(es) kept original text (AI limit/error). Re-download when ready.`
      : 'All slides updated. Use "Generate & download PowerPoint" above to get the revised deck.';
    showToast('AI Live Edit applied', 'success');
  } catch (err) {
    console.error(err);
    status.textContent = err.message;
    showToast(err.message, 'error');
  } finally {
    button.disabled = false;
    button.classList.remove('generating');
  }
}

document.getElementById('btn-qle-apply')?.addEventListener('click', qleApply);

// Phase 11.7: AI Language Converter — one click switches the whole deck's language.
async function qlcApply() {
  const select = document.getElementById('ppt-resource-select');
  const targetLanguage = document.getElementById('qlc-language').value;
  const status = document.getElementById('qlc-status');
  const button = document.getElementById('btn-qlc-apply');
  const resourceId = select?.value;

  if (!resourceId) { showToast('Select a resource first.', 'error'); return; }

  const isLocalDraft = resourceId.startsWith('quickgen-');
  const resource = resources.find((r) => String(r._id) === String(resourceId));
  if (!resource) { showToast('Resource not found.', 'error'); return; }

  button.disabled = true;
  button.classList.add('generating');
  status.innerHTML = `<span class="status-pulse"></span> Translating every slide to ${targetLanguage}...`;

  try {
    const payload = isLocalDraft ? { draft: resource, targetLanguage } : { resourceId, targetLanguage };
    const { draft: translated, warnings } = await apiTranslatePresentation(payload);

    translated._id = isLocalDraft ? resource._id : `quickgen-${Date.now().toString(36)}`;
    const idx = resources.findIndex((r) => String(r._id) === String(resourceId));
    if (idx >= 0) resources[idx] = translated; else resources.unshift(translated);

    populatePresentationResourceSelect();
    if (select) select.value = translated._id;
    renderPresentationPreview();

    status.textContent = warnings?.length
      ? `Translated to ${targetLanguage}, but ${warnings.length} section batch(es) kept original text (AI limit/error).`
      : `Deck translated to ${targetLanguage}. Use "Generate & download PowerPoint" above.`;
    showToast(`Translated to ${targetLanguage}`, 'success');
  } catch (err) {
    console.error(err);
    status.textContent = err.message;
    showToast(err.message, 'error');
  } finally {
    button.disabled = false;
    button.classList.remove('generating');
  }
}
document.getElementById('btn-qlc-apply')?.addEventListener('click', qlcApply);

// Phase 11.8: AI PPT Reviewer — grammar, text density, missing visuals, real contrast math, professional score.
function qprRenderReport(report) {
  const box = document.getElementById('qpr-report');
  const scoreColor = report.professionalScore >= 85 ? '#10b981' : report.professionalScore >= 70 ? '#0ea5e9' : report.professionalScore >= 50 ? '#f59e0b' : '#ef4444';
  const list = (items) => items.length ? `<ul>${items.map((r) => `<li>${r}</li>`).join('')}</ul>` : '<p>—</p>';
  box.innerHTML = `
    <div class="qpr-score-card" style="border-color:${scoreColor}">
      <div class="qpr-score" style="color:${scoreColor}">${report.professionalScore}<span>/100</span></div>
      <div><b>${report.grade}</b><p>${report.totalSlides} slides · contrast ${report.contrast.bodyTextContrast}:1 (${report.contrast.bodyTextPass ? 'passes' : 'fails'} WCAG AA)</p></div>
    </div>
    <div class="qpr-checks">
      <span>Grammar (${report.checks.grammarMode}): ${report.checks.grammarIssues} issue(s)</span>
      <span>Text density: ${report.checks.textDensityIssues} slide(s) too dense</span>
      <span>Missing visuals: ${report.checks.missingVisualSlides} slide(s)</span>
      <span>${report.checks.fontConsistency}</span>
      <span>${report.checks.alignment}</span>
    </div>
    <b>Recommendations</b>
    ${list(report.recommendations)}`;
}
async function qprReview() {
  const select = document.getElementById('ppt-resource-select');
  const status = document.getElementById('qpr-status');
  const button = document.getElementById('btn-qpr-review');
  const resourceId = select?.value;
  if (!resourceId) { showToast('Select a resource first.', 'error'); return; }

  const isLocalDraft = resourceId.startsWith('quickgen-');
  const resource = resources.find((r) => String(r._id) === String(resourceId));
  if (!resource) { showToast('Resource not found.', 'error'); return; }

  button.disabled = true;
  button.classList.add('generating');
  status.innerHTML = '<span class="status-pulse"></span> Reviewing grammar, density, visuals and contrast...';
  document.getElementById('qpr-report').innerHTML = '';

  try {
    const theme = document.getElementById('ppt-theme').value;
    const payload = isLocalDraft ? { draft: resource, theme } : { resourceId, theme };
    const { report } = await apiReviewPresentation(payload);
    qprRenderReport(report);
    status.textContent = 'Review complete.';
  } catch (err) {
    console.error(err);
    status.textContent = err.message;
    showToast(err.message, 'error');
  } finally {
    button.disabled = false;
    button.classList.remove('generating');
  }
}
document.getElementById('btn-qpr-review')?.addEventListener('click', qprReview);

// Shared helper: resolve the currently selected PPT Studio resource.
function qpsSelectedResource() {
  const select = document.getElementById('ppt-resource-select');
  const resourceId = select?.value;
  if (!resourceId) return null;
  const resource = resources.find((r) => String(r._id) === String(resourceId));
  if (!resource) return null;
  return { select, resourceId, resource, isLocalDraft: resourceId.startsWith('quickgen-') };
}

// Phase 11.9: AI Quiz Generator — turn the selected deck into an auto-graded quiz.
// Quick-generated (unsaved) drafts are saved to the Resource Hub first, since the
// existing quiz engine (with full proctoring options) works off a saved resource.
async function qqzGenerate() {
  const sel = qpsSelectedResource();
  const status = document.getElementById('qqz-status');
  const button = document.getElementById('btn-qqz-generate');
  if (!sel) { showToast('Select a resource first.', 'error'); return; }

  button.disabled = true;
  button.classList.add('generating');
  status.innerHTML = '<span class="status-pulse"></span> Preparing deck and generating quiz questions...';

  try {
    let resourceId = sel.resourceId;
    if (sel.isLocalDraft) {
      status.innerHTML = '<span class="status-pulse"></span> Saving deck to Resource Hub first...';
      const saved = await apiCreateResource(sel.resource);
      const idx = resources.findIndex((r) => String(r._id) === String(sel.resourceId));
      if (idx >= 0) resources[idx] = saved; else resources.unshift(saved);
      resourceId = saved._id;
      populatePresentationResourceSelect();
      if (sel.select) sel.select.value = resourceId;
      status.innerHTML = '<span class="status-pulse"></span> Generating quiz questions...';
    }

    const data = await apiGenerateQuiz({ resourceId, questionCount: 10, difficulty: 'Intermediate' });
    status.textContent = `Quiz "${data.quiz.title}" created (${data.quiz.questions?.length || 10} questions). Opening Quizzes...`;
    showToast('Quiz generated from deck', 'success');
    window.setTimeout(() => showTab('quizzes'), 600);
  } catch (err) {
    console.error(err);
    status.textContent = err.message;
    showToast(err.message, 'error');
  } finally {
    button.disabled = false;
    button.classList.remove('generating');
  }
}
// Phase 11.12: AI Audience Mode — reuses the Live Edit engine with a preset
// instruction tuned per audience (students/teachers/managers/clients/etc.).
const AUDIENCE_PRESETS = {
  Students: 'Rewrite for students: simple, encouraging language, relatable everyday examples, avoid unexplained jargon.',
  Teachers: 'Rewrite for a teacher/faculty audience: precise academic and pedagogical language, include teaching tips where relevant.',
  Managers: 'Rewrite for managers/executives: focus on business impact, outcomes and ROI, be concise, avoid deep technical jargon.',
  Clients: 'Rewrite for a client-facing audience: persuasive, benefit-focused language, avoid internal/technical jargon.',
  Interview: 'Rewrite for an interview panel: confident, concise, impact- and skills-focused phrasing.',
  Seminar: 'Rewrite for a seminar audience: engaging, moderately formal academic tone with broader context.',
  Conference: 'Rewrite for a conference talk: engaging, formal academic tone, emphasise significance and novelty.'
};
async function qamApply() {
  const sel = qpsSelectedResource();
  const audience = document.getElementById('qam-audience').value;
  const status = document.getElementById('qam-status');
  const button = document.getElementById('btn-qam-apply');
  if (!sel) { showToast('Select a resource first.', 'error'); return; }

  button.disabled = true;
  button.classList.add('generating');
  status.innerHTML = `<span class="status-pulse"></span> Adapting deck for ${audience}...`;

  try {
    const instruction = AUDIENCE_PRESETS[audience] || `Rewrite for a ${audience} audience.`;
    const payload = sel.isLocalDraft ? { draft: sel.resource, instruction } : { resourceId: sel.resourceId, instruction };
    const { draft: revised, warnings } = await apiLiveEditPresentation(payload);
    revised._id = sel.isLocalDraft ? sel.resource._id : `quickgen-${Date.now().toString(36)}`;
    const idx = resources.findIndex((r) => String(r._id) === String(sel.resourceId));
    if (idx >= 0) resources[idx] = revised; else resources.unshift(revised);
    populatePresentationResourceSelect();
    if (sel.select) sel.select.value = revised._id;
    renderPresentationPreview();
    status.textContent = warnings?.length ? `Adapted for ${audience}, but some sections kept original text.` : `Deck adapted for ${audience}. Ready to download.`;
    showToast(`Adapted for ${audience}`, 'success');
  } catch (err) {
    console.error(err);
    status.textContent = err.message;
    showToast(err.message, 'error');
  } finally {
    button.disabled = false;
    button.classList.remove('generating');
  }
}
document.getElementById('btn-qam-apply')?.addEventListener('click', qamApply);

// Phase 11.13: AI Layout Optimizer — auto-split text-heavy slides.
async function qloApply() {
  const sel = qpsSelectedResource();
  const status = document.getElementById('qlo-status');
  const button = document.getElementById('btn-qlo-apply');
  if (!sel) { showToast('Select a resource first.', 'error'); return; }

  button.disabled = true;
  button.classList.add('generating');
  status.innerHTML = '<span class="status-pulse"></span> Scanning for text-heavy slides and rebalancing...';

  try {
    const payload = sel.isLocalDraft ? { draft: sel.resource } : { resourceId: sel.resourceId };
    const { draft: optimized, splitCount, warnings } = await apiOptimizeLayout(payload);
    optimized._id = sel.isLocalDraft ? sel.resource._id : `quickgen-${Date.now().toString(36)}`;
    const idx = resources.findIndex((r) => String(r._id) === String(sel.resourceId));
    if (idx >= 0) resources[idx] = optimized; else resources.unshift(optimized);
    populatePresentationResourceSelect();
    if (sel.select) sel.select.value = optimized._id;
    renderPresentationPreview();
    status.textContent = splitCount
      ? `${splitCount} dense slide(s) split into lighter pairs.${warnings?.length ? ' Some used a simple even split (AI limit).' : ''}`
      : 'No text-heavy slides found — layout already looks good.';
    showToast(splitCount ? 'Layout optimized' : 'No dense slides found', 'success');
  } catch (err) {
    console.error(err);
    status.textContent = err.message;
    showToast(err.message, 'error');
  } finally {
    button.disabled = false;
    button.classList.remove('generating');
  }
}
document.getElementById('btn-qlo-apply')?.addEventListener('click', qloApply);

// Phase 11.14: AI Content Beautifier — paste rough notes, get polished slides
// appended to the currently selected deck.
async function qcbApply() {
  const sel = qpsSelectedResource();
  const rawText = document.getElementById('qcb-text').value;
  const status = document.getElementById('qcb-status');
  const button = document.getElementById('btn-qcb-apply');
  if (!sel) { showToast('Select a resource first.', 'error'); return; }
  if (!rawText.trim()) { showToast('Paste some notes first.', 'error'); return; }

  button.disabled = true;
  button.classList.add('generating');
  status.innerHTML = '<span class="status-pulse"></span> Beautifying notes into slide-ready sections...';

  try {
    const { sections, generationMode } = await apiBeautifyContent({ rawText, topic: sel.resource.topic });
    const newSections = sections.map((s) => ({
      heading: s.heading,
      summary: s.summary,
      explanation: [s.summary],
      keyPoints: s.keyPoints,
      examples: [],
      applications: [],
      commonMistakes: [],
      table: null,
      caseStudy: null,
      visual: { type: 'none' },
      speakerNotes: s.summary,
      citations: []
    }));
    const updated = { ...sel.resource, reportSections: [...(sel.resource.reportSections || []), ...newSections] };
    updated._id = sel.isLocalDraft ? sel.resource._id : `quickgen-${Date.now().toString(36)}`;
    const idx = resources.findIndex((r) => String(r._id) === String(sel.resourceId));
    if (idx >= 0) resources[idx] = updated; else resources.unshift(updated);
    populatePresentationResourceSelect();
    if (sel.select) sel.select.value = updated._id;
    renderPresentationPreview();
    document.getElementById('qcb-text').value = '';
    status.textContent = `${newSections.length} new slide(s) added (${generationMode}). Ready to download.`;
    showToast('Notes beautified into slides', 'success');
  } catch (err) {
    console.error(err);
    status.textContent = err.message;
    showToast(err.message, 'error');
  } finally {
    button.disabled = false;
    button.classList.remove('generating');
  }
}
// Phase 11.16: AI Citation Generator — deterministic style formatting, applied
// directly on the resource object so the next PPTX/PDF export uses it.
function qcgApply() {
  const sel = qpsSelectedResource();
  const style = document.getElementById('qcg-style').value;
  const status = document.getElementById('qcg-status');
  if (!sel) { showToast('Select a resource first.', 'error'); return; }
  if (!(sel.resource.references || []).length) { status.textContent = 'This deck has no references to format yet.'; return; }
  sel.resource.citationStyle = style;
  status.textContent = `References will render in ${style} style on the next export.`;
  showToast(`Citation style set to ${style}`, 'success');
}
document.getElementById('btn-qcg-apply')?.addEventListener('click', qcgApply);

// Phase 11.17: AI Animation Generator — suggested transition/entrance plan
// (real PowerPoint animation XML isn't writable by the pptx library, so this
// gives a ready-to-apply checklist instead of faking it).
async function qapSuggest() {
  const sel = qpsSelectedResource();
  const status = document.getElementById('qap-status');
  const button = document.getElementById('btn-qap-suggest');
  const output = document.getElementById('qap-output');
  if (!sel) { showToast('Select a resource first.', 'error'); return; }

  button.disabled = true;
  button.classList.add('generating');
  status.innerHTML = '<span class="status-pulse"></span> Building a transition/animation plan...';
  output.innerHTML = '';

  try {
    const payload = sel.isLocalDraft ? { draft: sel.resource } : { resourceId: sel.resourceId };
    const { plan, note } = await apiAnimationPlan(payload);
    output.innerHTML = `<div class="qap-note">${escapeHtml(note)}</div><div class="qap-list">${plan.map((p, i) => `<div class="qap-row"><b>${i + 1}. ${escapeHtml(p.heading)}</b><span>${escapeHtml(p.transition)} transition · ${escapeHtml(p.entrance)}</span><em>${escapeHtml(p.reason)}</em></div>`).join('')}</div>`;
    status.textContent = 'Plan ready — apply each row in PowerPoint.';
  } catch (err) {
    console.error(err);
    status.textContent = err.message;
    showToast(err.message, 'error');
  } finally {
    button.disabled = false;
    button.classList.remove('generating');
  }
}
document.getElementById('btn-qap-suggest')?.addEventListener('click', qapSuggest);

// Phase 11.18: AI Research Engine — chain Exam Notes + Quiz Generator on the
// currently selected (already-generated) deck, one click.
async function qreRunPipeline() {
  const sel = qpsSelectedResource();
  const status = document.getElementById('qre-status');
  const button = document.getElementById('btn-qre-run');
  if (!sel) { showToast('Generate or select a presentation first.', 'error'); return; }

  button.disabled = true;
  button.classList.add('generating');
  try {
    status.innerHTML = '<span class="status-pulse"></span> Step 1/2 — generating exam notes & flashcards...';
    await qenGenerate();
    status.innerHTML = '<span class="status-pulse"></span> Step 2/2 — generating quiz...';
    await qqzGenerate();
    status.textContent = 'Research pipeline complete: presentation, exam notes, flashcards, and quiz are all ready.';
    showToast('Research pipeline complete', 'success');
  } catch (err) {
    console.error(err);
    status.textContent = err.message;
    showToast(err.message, 'error');
  } finally {
    button.disabled = false;
    button.classList.remove('generating');
  }
}
document.getElementById('btn-qre-run')?.addEventListener('click', qreRunPipeline);

// Phase 11.20: AI Website Generator — deterministic HTML export from the deck.
async function qwgGenerate() {
  const sel = qpsSelectedResource();
  const status = document.getElementById('qwg-status');
  const button = document.getElementById('btn-qwg-generate');
  if (!sel) { showToast('Select a resource first.', 'error'); return; }

  button.disabled = true;
  button.classList.add('generating');
  status.innerHTML = '<span class="status-pulse"></span> Building website...';

  try {
    const payload = sel.isLocalDraft ? { draft: sel.resource } : { resourceId: sel.resourceId };
    const { html } = await apiGenerateWebsite(payload);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(sel.resource.topic || 'presentation').replace(/[^a-z0-9]+/gi, '-')}-website.html`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    status.textContent = 'Website downloaded — open the .html file in any browser or host it anywhere.';
    showToast('Website exported', 'success');
  } catch (err) {
    console.error(err);
    status.textContent = err.message;
    showToast(err.message, 'error');
  } finally {
    button.disabled = false;
    button.classList.remove('generating');
  }
}
// Shared: download a text/html blob as a file.
function qDownloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

async function qRepurposeRun(format, statusId, buttonId, onResult, extra = {}) {
  const sel = qpsSelectedResource();
  const status = document.getElementById(statusId);
  const button = document.getElementById(buttonId);
  if (!sel) { showToast('Select a resource first.', 'error'); return; }

  button.disabled = true;
  button.classList.add('generating');
  status.innerHTML = '<span class="status-pulse"></span> Working...';
  try {
    const payload = { ...(sel.isLocalDraft ? { draft: sel.resource } : { resourceId: sel.resourceId }), format, ...extra };
    const data = await apiRepurposeContent(payload);
    onResult(data, sel);
    status.textContent = 'Ready.';
  } catch (err) {
    console.error(err);
    status.textContent = err.message;
    showToast(err.message, 'error');
  } finally {
    button.disabled = false;
    button.classList.remove('generating');
  }
}

// Phase 11.21: AI Resume Generator
document.getElementById('btn-qres-generate')?.addEventListener('click', () => qRepurposeRun('resume', 'qres-status', 'btn-qres-generate', (data, sel) => {
  qDownloadBlob(data.text, `${(sel.resource.topic || 'resume').replace(/[^a-z0-9]+/gi, '-')}-resume.txt`, 'text/plain');
}));

// Phase 11.22: AI Portfolio Generator
document.getElementById('btn-qport-generate')?.addEventListener('click', () => qRepurposeRun('portfolio', 'qport-status', 'btn-qport-generate', (data, sel) => {
  qDownloadBlob(data.html, `${(sel.resource.topic || 'portfolio').replace(/[^a-z0-9]+/gi, '-')}-portfolio.html`, 'text/html');
}));

// Phase 11.23: AI Blog Generator
document.getElementById('btn-qblog-generate')?.addEventListener('click', () => qRepurposeRun('blog', 'qblog-status', 'btn-qblog-generate', (data, sel) => {
  qDownloadBlob(data.markdown, `${(sel.resource.topic || 'blog').replace(/[^a-z0-9]+/gi, '-')}-blog.md`, 'text/markdown');
}));

// Phase 11.24: AI LinkedIn Post Generator
document.getElementById('btn-qli-generate')?.addEventListener('click', () => qRepurposeRun('linkedin', 'qli-status', 'btn-qli-generate', (data) => {
  const out = document.getElementById('qli-output');
  out.innerHTML = data.posts.map((p) => `<div class="qli-post"><b>${escapeHtml(p.label)}</b><p>${escapeHtml(p.text)}</p><button class="gen-btn phase3-action qle-btn" data-copy>Copy</button></div>`).join('');
  out.querySelectorAll('[data-copy]').forEach((btn, i) => btn.addEventListener('click', () => { navigator.clipboard?.writeText(data.posts[i].text); showToast('Copied', 'success'); }));
}));

// Phase 11.25: AI YouTube/Reel/Podcast Script Generator
document.getElementById('btn-qyt-generate')?.addEventListener('click', () => {
  const videoFormat = document.getElementById('qyt-format').value;
  qRepurposeRun('youtube', 'qyt-status', 'btn-qyt-generate', (data) => {
    const s = data.script;
    const out = document.getElementById('qyt-output');
    out.innerHTML = `<div class="qyt-script"><b>${escapeHtml(s.title)}</b><p class="qyt-hook">${escapeHtml(s.hook)}</p>${(s.scenes || []).map((sc) => `<div class="qyt-scene"><span>Scene ${sc.scene} · ${sc.durationSeconds}s</span><b>${escapeHtml(sc.visual)}</b><p>${escapeHtml(sc.narration)}</p></div>`).join('')}<div class="qyt-cta">${escapeHtml(s.cta || '')}</div></div>`;
  }, { videoFormat });
});

// Phase 11.26: AI Presentation Narration
async function qnarRun(withAudio) {
  const sel = qpsSelectedResource();
  const status = document.getElementById('qnar-status');
  const button = document.getElementById(withAudio ? 'btn-qnar-audio' : 'btn-qnar-script');
  if (!sel) { showToast('Select a resource first.', 'error'); return; }

  button.disabled = true;
  button.classList.add('generating');
  status.innerHTML = withAudio ? '<span class="status-pulse"></span> Generating narration audio (this can take a moment)...' : '<span class="status-pulse"></span> Building narration script...';

  try {
    const payload = sel.isLocalDraft ? { draft: sel.resource } : { resourceId: sel.resourceId };
    if (withAudio) {
      const resp = await authFetch('/api/presentations/narration', { method: 'POST', body: JSON.stringify({ ...payload, audio: true }) });
      const ctype = resp.headers.get('content-type') || '';
      if (ctype.includes('audio')) {
        const blob = await resp.blob();
        qDownloadBlob(blob, `${(sel.resource.topic || 'narration').replace(/[^a-z0-9]+/gi, '-')}-narration.wav`, 'audio/wav');
        status.textContent = 'Narration audio downloaded.';
      } else {
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || 'Narration failed.');
        status.textContent = data.audioError ? `Script ready, but audio failed: ${data.audioError}` : 'Script ready.';
        document.getElementById('qnar-output').innerHTML = `<pre class="qnar-script">${escapeHtml(data.fullScript)}</pre>`;
      }
    } else {
      const data = await apiGenerateNarration(payload);
      document.getElementById('qnar-output').innerHTML = `<div class="qnar-meta">~${Math.round(data.estimatedSeconds / 60)} min read</div><pre class="qnar-script">${escapeHtml(data.fullScript)}</pre>`;
      status.textContent = 'Narration script ready.';
    }
  } catch (err) {
    console.error(err);
    status.textContent = err.message;
    showToast(err.message, 'error');
  } finally {
    button.disabled = false;
    button.classList.remove('generating');
  }
}
document.getElementById('btn-qnar-script')?.addEventListener('click', () => qnarRun(false));
document.getElementById('btn-qnar-audio')?.addEventListener('click', () => qnarRun(true));

// Phase 11.27: AI Brand Kit — custom colors + logo, applied on the next export.
document.getElementById('qbrand-logo')?.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { qBrandLogoDataUrl = reader.result; };
  reader.readAsDataURL(file);
});
let qBrandLogoDataUrl = null;
document.getElementById('btn-qbrand-apply')?.addEventListener('click', () => {
  const sel = qpsSelectedResource();
  const status = document.getElementById('qbrand-status');
  if (!sel) { showToast('Select a resource first.', 'error'); return; }
  const hex = (id) => document.getElementById(id).value.replace('#', '').toUpperCase();
  sel.resource.customBrand = {
    colors: { primary: hex('qbrand-primary'), secondary: hex('qbrand-secondary') },
    logoDataUrl: qBrandLogoDataUrl || sel.resource.customBrand?.logoDataUrl || null
  };
  status.textContent = 'Brand applied — will show on the next PowerPoint export.';
  showToast('Brand kit applied', 'success');
});

// Phase 11.28: Team Collaboration — surface the existing comments/versions/
// sharing system (built for all resources) for the selected deck.
async function qcoOpen() {
  const sel = qpsSelectedResource();
  const status = document.getElementById('qco-status');
  const button = document.getElementById('btn-qco-open');
  if (!sel) { showToast('Select a resource first.', 'error'); return; }

  button.disabled = true;
  button.classList.add('generating');
  try {
    let resourceId = sel.resourceId;
    if (sel.isLocalDraft) {
      status.innerHTML = '<span class="status-pulse"></span> Saving deck to Resource Hub first...';
      const saved = await apiCreateResource(sel.resource);
      const idx = resources.findIndex((r) => String(r._id) === String(sel.resourceId));
      if (idx >= 0) resources[idx] = saved; else resources.unshift(saved);
      resourceId = saved._id;
      populatePresentationResourceSelect();
      if (sel.select) sel.select.value = resourceId;
    }
    showTab('collaboration', 'resource-collaboration');
    window.setTimeout(() => {
      const p9select = document.getElementById('p9-resource');
      if (p9select) { p9select.value = resourceId; p9select.dispatchEvent(new Event('change')); }
    }, 250);
    status.textContent = 'Opening comments, versions and sharing for this deck...';
  } catch (err) {
    console.error(err);
    status.textContent = err.message;
    showToast(err.message, 'error');
  } finally {
    button.disabled = false;
    button.classList.remove('generating');
  }
}
document.getElementById('btn-qco-open')?.addEventListener('click', qcoOpen);

// Phase 11.36: AI Video Presentation — honest-scope "assembly package" download.
document.getElementById('btn-qvid-package')?.addEventListener('click', async () => {
  const sel = qpsSelectedResource();
  const status = document.getElementById('qvid-status');
  const button = document.getElementById('btn-qvid-package');
  if (!sel) { showToast('Select a resource first.', 'error'); return; }

  button.disabled = true;
  button.classList.add('generating');
  const originalNote = status.textContent;
  status.innerHTML = '<span class="status-pulse"></span> Building deck, narration script and audio, zipping...';

  try {
    const payload = sel.isLocalDraft ? { draft: sel.resource } : { resourceId: sel.resourceId };
    const resp = await authFetch('/api/presentations/video-package', { method: 'POST', body: JSON.stringify(payload) });
    if (!resp.ok) { const err = await resp.json().catch(() => ({})); throw new Error(err.error || 'Package generation failed.'); }
    const blob = await resp.blob();
    qDownloadBlob(blob, `${(sel.resource.topic || 'presentation').replace(/[^a-z0-9]+/gi, '-')}-video-package.zip`, 'application/zip');
    status.textContent = 'Downloaded. See READ-ME.txt inside for how to turn it into a video.';
  } catch (err) {
    console.error(err);
    status.textContent = err.message;
    showToast(err.message, 'error');
  } finally {
    button.disabled = false;
    button.classList.remove('generating');
    window.setTimeout(() => { status.textContent = originalNote; }, 6000);
  }
});

document.getElementById('btn-qwg-generate')?.addEventListener('click', qwgGenerate);

document.getElementById('btn-qcb-apply')?.addEventListener('click', qcbApply);

document.getElementById('btn-qqz-generate')?.addEventListener('click', qqzGenerate);

// Phase 11.10: AI DOCX Generator — export the selected deck as a Word document.
// (Reuses the existing /api/export/docx pipeline already used elsewhere in the app.)
document.getElementById('btn-qdocx-download')?.addEventListener('click', () => {
  const sel = qpsSelectedResource();
  if (!sel) { showToast('Select a resource first.', 'error'); return; }
  downloadDOCX(sel.resource);
});

// Phase 11.11: AI Exam Notes — one-page revision summary + flip-card flashcards.
function qenRenderFlashcard(card, index) {
  return `<div class="qen-flashcard" data-flip="0" tabindex="0" role="button" aria-label="Flashcard, tap to flip">
    <div class="qen-flashcard-inner">
      <div class="qen-flashcard-face qen-front"><span>Q${index + 1}</span>${escapeHtml(card.front)}</div>
      <div class="qen-flashcard-face qen-back">${escapeHtml(card.back)}</div>
    </div>
  </div>`;
}
function qenWireFlashcards(container) {
  container.querySelectorAll('.qen-flashcard').forEach((card) => {
    card.addEventListener('click', () => card.classList.toggle('flipped'));
  });
}
async function qenGenerate() {
  const sel = qpsSelectedResource();
  const status = document.getElementById('qen-status');
  const button = document.getElementById('btn-qen-generate');
  const output = document.getElementById('qen-output');
  if (!sel) { showToast('Select a resource first.', 'error'); return; }

  button.disabled = true;
  button.classList.add('generating');
  status.innerHTML = '<span class="status-pulse"></span> Condensing deck into one-page notes and flashcards...';
  output.innerHTML = '';

  try {
    const payload = sel.isLocalDraft ? { draft: sel.resource } : { resourceId: sel.resourceId };
    const { notes } = await apiGenerateExamNotes(payload);

    const notesHtml = notes.notes.map((n) => `<div class="qen-note-block"><b>${escapeHtml(n.heading)}</b><ul>${n.points.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ul></div>`).join('');
    const cardsHtml = notes.flashcards.map((c, i) => qenRenderFlashcard(c, i)).join('');

    output.innerHTML = `
      <div class="qen-summary"><b>${escapeHtml(notes.title)}</b><p>${escapeHtml(notes.oneLineSummary)}</p></div>
      <div class="qen-notes">${notesHtml}</div>
      <div class="qen-flash-label">Flashcards — tap to flip (${notes.flashcards.length})</div>
      <div class="qen-flashcard-grid">${cardsHtml}</div>`;
    qenWireFlashcards(output);

    status.textContent = 'Exam notes and flashcards ready.';
    showToast('Exam notes generated', 'success');
  } catch (err) {
    console.error(err);
    status.textContent = err.message;
    showToast(err.message, 'error');
  } finally {
    button.disabled = false;
    button.classList.remove('generating');
  }
}
document.getElementById('btn-qen-generate')?.addEventListener('click', qenGenerate);
