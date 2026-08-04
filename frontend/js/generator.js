const outputArea = document.getElementById('output-area');
const btnGenerate = document.getElementById('btn-generate');
let currentDraft = null;
let isGenerating = false;
let pipelineTimer = null;

function selectedBloomLevels() {
  return [...document.querySelectorAll('#bloom-selector input[type="checkbox"]:checked')].map((input) => input.value);
}

function readInputs() {
  const bloomLevels = selectedBloomLevels();
  const primarySyllabus = document.getElementById('f-syllabus').value || null;
  const referenceIds = [...(document.getElementById('f-reference-syllabi')?.selectedOptions || [])].map((option) => option.value);
  if (primarySyllabus && !referenceIds.includes(primarySyllabus)) referenceIds.unshift(primarySyllabus);
  return {
    course: document.getElementById('f-course').value,
    subject: document.getElementById('f-subject').value.trim() || 'General Subject',
    topic: document.getElementById('f-topic').value.trim() || 'This Topic',
    difficulty: document.getElementById('f-difficulty').value,
    duration: document.getElementById('f-duration').value,
    type: document.getElementById('f-type').value,
    language: document.getElementById('f-language').value,
    syllabusId: primarySyllabus,
    referenceIds,
    useRag: Boolean(document.getElementById('f-use-rag').checked && referenceIds.length),
    contentDepth: document.getElementById('f-content-depth')?.value || 'detailed',
    visualDensity: document.getElementById('f-visual-density')?.value || 'balanced',
    targetPages: Number(document.getElementById('f-target-pages')?.value || 20),
    targetSlides: Number(document.getElementById('f-target-slides')?.value || 26),
    examplesPerTopic: Number(document.getElementById('f-examples')?.value || 2),
    includeDiagrams: Boolean(document.getElementById('f-include-diagrams')?.checked),
    includeImages: Boolean(document.getElementById('f-include-images')?.checked),
    includeCaseStudies: Boolean(document.getElementById('f-include-cases')?.checked),
    includeReferences: Boolean(document.getElementById('f-include-references')?.checked),
    includeSpeakerNotes: Boolean(document.getElementById('f-include-notes')?.checked),
    mediaAssetIds: [...selectedPhase4MediaIds],
    bloomLevels: bloomLevels.length ? bloomLevels : ['Understand', 'Apply'],
    bloomQuestionCount: Number(document.getElementById('f-bloom-count').value || 8),
    courseOutcomes: document.getElementById('f-course-outcomes').value
      .split('\n').map((line) => line.replace(/^CO\d+\s*[:.-]?\s*/i, '').trim()).filter(Boolean).slice(0, 8)
  };
}

function loadingHtml(inputs) {
  const stages = [
    ['brief', 'Analyse teaching brief', 'Course, topic, depth and audience'],
    ['sources', 'Retrieve academic evidence', inputs.useRag ? 'Multi-source hybrid RAG' : 'General academic context'],
    ['planning', 'Plan detailed structure', 'Outline, depth and section architecture'],
    ['expanding', 'Expand section content', 'Examples, applications and case studies'],
    ['visuals', 'Plan visuals', 'Diagrams, images, tables and captions'],
    ['pedagogy', 'Align pedagogy', 'Bloom taxonomy and course outcomes'],
    ['validation', 'Validate exports', 'Depth, citations, duplication and readability']
  ];
  return `<div class="index-card loading-card phase4-loading-card">
    <div class="phase4-live-header"><div class="neural-loader"><i></i><i></i><i></i><i></i><b>AI</b></div><div><strong>Building “${escapeHtml(inputs.topic)}”</strong><span>${escapeHtml(inputs.contentDepth)} mode · ${inputs.targetPages} page target · ${inputs.targetSlides} slide target</span></div></div>
    <div class="phase4-progress-shell"><div class="phase4-progress-meta"><b id="phase4-progress-label">1%</b><span id="phase4-stage-message">Preparing detailed generation job...</span></div><div class="phase4-progress-track"><i id="phase4-progress-fill" style="width:1%"></i></div></div>
    <div class="generation-pipeline phase4-pipeline" id="generation-pipeline">${stages.map(([id,title,desc], index) => `<div class="pipeline-node ${index === 0 ? 'active' : ''}" data-stage="${id}"><i>${index + 1}</i><div><b>${title}</b><span>${escapeHtml(desc)}</span></div></div>`).join('')}</div>
    <div class="live-thinking"><span></span> Multi-stage generation is running. Keep this tab open...</div>
  </div>`;
}

const phase4StageOrder = ['queued','brief','sources','planning','outline-ready','expanding','visuals','pedagogy','validation','complete'];
function updateDetailedPipeline(job) {
  const progress = Math.max(1, Math.min(100, Number(job.progress || 1)));
  const fill = document.getElementById('phase4-progress-fill');
  const label = document.getElementById('phase4-progress-label');
  const message = document.getElementById('phase4-stage-message');
  if (fill) fill.style.width = `${progress}%`;
  if (label) label.textContent = `${progress}%`;
  if (message) message.textContent = job.message || 'Generating detailed academic resource...';
  const current = phase4StageOrder.indexOf(job.stage);
  document.querySelectorAll('#generation-pipeline .pipeline-node').forEach((node) => {
    const idx = phase4StageOrder.indexOf(node.dataset.stage);
    node.classList.toggle('done', idx >= 0 && idx < current);
    node.classList.toggle('active', node.dataset.stage === job.stage || (job.stage === 'outline-ready' && node.dataset.stage === 'planning'));
  });
  if (window.Motion?.animate && fill) window.Motion.animate(fill, { width: `${progress}%` }, { duration: 0.45, easing: 'ease-out' });
}

async function pollDetailedJob(id) {
  for (let attempt = 0; attempt < 900; attempt += 1) {
    const job = await apiGetDetailedJob(id);
    updateDetailedPipeline(job);
    if (job.status === 'complete') return job.draft;
    if (job.status === 'failed') throw new Error(job.error || job.message || 'Detailed generation failed.');
    await new Promise((resolve) => setTimeout(resolve, 900));
  }
  throw new Error('Detailed generation timed out. Try again with fewer sections or a smaller depth setting.');
}

function stopPipelineAnimation() { clearInterval(pipelineTimer); pipelineTimer = null; }
function errorHtml(message) {
  return `<div class="index-card generation-error"><div class="error-orbit">!</div><div class="card-title" style="color:var(--rust);">Generation failed</div><p>${escapeHtml(message)}</p><div class="card-actions"><button class="act-btn primary" data-role="retry">Try again</button></div></div>`;
}

async function generateAndRender(inputs) {
  if (isGenerating) return;
  isGenerating = true; btnGenerate.disabled = true; btnGenerate.classList.add('generating');
  outputArea.innerHTML = loadingHtml(inputs);
  try {
    const queued = await apiStartDetailedJob(inputs);
    const draft = await pollDetailedJob(queued.id);
    currentDraft = { ...inputs, ...draft, createdAt: Date.now() };
    renderDraft(currentDraft);
    showToast('Phase 4 detailed visual resource generated', 'success');
  } catch (err) {
    console.error(err); outputArea.innerHTML = errorHtml(err.message || 'Something went wrong during detailed generation.');
    outputArea.querySelector('[data-role="retry"]')?.addEventListener('click', () => generateAndRender(inputs));
  } finally {
    stopPipelineAnimation(); isGenerating = false; btnGenerate.disabled = false; btnGenerate.classList.remove('generating');
  }
}

btnGenerate.addEventListener('click', () => generateAndRender(readInputs()));

function qualityScoreHtml(quality) {
  if (!quality) return '';
  const metrics = quality.metrics || {};
  const metricRows = Object.entries({
    Completeness: metrics.completeness,
    Clarity: metrics.clarity,
    'Bloom alignment': metrics.bloomAlignment,
    'CO alignment': metrics.outcomeAlignment,
    'Syllabus grounding': metrics.syllabusGrounding
  }).map(([label, value]) => `
    <div class="quality-metric">
      <div><span>${escapeHtml(label)}</span><b>${Number(value || 0)}%</b></div>
      <div class="quality-track"><i style="--metric:${Number(value || 0)}%"></i></div>
    </div>`).join('');

  const strengths = (quality.strengths || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  const improvements = (quality.improvements || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('');

  return `
    <section class="phase2-output quality-output">
      <div class="phase2-output-title"><span>AI Quality Score</span><small>Teacher review still required</small></div>
      <div class="quality-grid">
        <div class="quality-ring" style="--score:${Number(quality.overall || 0)}">
          <div><strong>${Number(quality.overall || 0)}</strong><span>/100</span><em>${escapeHtml(quality.grade || '')}</em></div>
        </div>
        <div class="quality-metrics">${metricRows}</div>
      </div>
      <div class="quality-notes">
        <div><b>Strengths</b><ul>${strengths || '<li>Structured academic draft</li>'}</ul></div>
        <div><b>Improve before class</b><ul>${improvements || '<li>Verify facts and examples.</li>'}</ul></div>
      </div>
    </section>`;
}

function groundingHtml(draft) {
  const grounding = draft.grounding;
  if (!grounding || !grounding.retrievedChunks || !grounding.retrievedChunks.length) {
    return `
      <section class="phase2-output grounding-output general-mode">
        <div class="phase2-output-title"><span>Knowledge grounding</span><small>General AI mode</small></div>
        <p>No syllabus was used for this draft. Upload and select a syllabus PDF to enable source-grounded RAG generation.</p>
      </section>`;
  }

  const sources = grounding.retrievedChunks.map((source, index) => `
    <div class="source-card" style="--delay:${index * 70}ms">
      <span>${escapeHtml(source.sourceId || `S${index + 1}`)}</span>
      <div><b>Chunk ${Number(source.chunkIndex) + 1}</b><p>${escapeHtml(source.preview || '')}</p></div>
      <em>${Math.round(Number(source.score || 0) * 100)}%</em>
    </div>`).join('');

  return `
    <section class="phase2-output grounding-output">
      <div class="phase2-output-title">
        <span>Syllabus RAG Evidence</span>
        <small>${escapeHtml(draft.syllabusName || 'Indexed PDF')} · ${escapeHtml(grounding.mode || 'RAG')}</small>
      </div>
      <div class="grounding-summary"><b>${Number(grounding.coverage || 0)}%</b><span>retrieval relevance</span><i>${escapeHtml(grounding.embeddingModel || 'lexical index')}</i></div>
      <div class="source-list">${sources}</div>
    </section>`;
}

function bloomHtml(items) {
  if (!items || !items.length) return '';
  return `
    <section class="phase2-output bloom-output">
      <div class="phase2-output-title"><span>Bloom's Taxonomy Questions</span><small>${items.length} cognitive prompts</small></div>
      <div class="bloom-question-grid">
        ${items.map((item, index) => `
          <article class="bloom-question-card level-${escapeHtml(String(item.level || '').toLowerCase())}" style="--delay:${index * 65}ms">
            <div class="bloom-level">${escapeHtml(item.level || 'Bloom')}</div>
            <h5>${escapeHtml(item.question || '')}</h5>
            <details><summary>View suggested answer</summary><p>${escapeHtml(item.answer || '')}</p></details>
            ${item.rationale ? `<small>${escapeHtml(item.rationale)}</small>` : ''}
          </article>`).join('')}
      </div>
    </section>`;
}

function outcomesHtml(outcomes, mappings) {
  if ((!outcomes || !outcomes.length) && (!mappings || !mappings.length)) return '';
  const outcomeMap = new Map((outcomes || []).map((item) => [item.code, item.text]));
  const rows = (mappings || []).map((item, index) => `
    <div class="co-map-row" style="--delay:${index * 70}ms">
      <div class="co-code">${escapeHtml(item.courseOutcome || `CO${index + 1}`)}</div>
      <div class="co-content">
        <b>${escapeHtml(outcomeMap.get(item.courseOutcome) || item.justification || '')}</b>
        <p>${escapeHtml(item.justification || '')}</p>
        <div class="co-tags">
          ${(item.matchedSections || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}
          ${(item.bloomLevels || []).map((tag) => `<span class="bloom-map">${escapeHtml(tag)}</span>`).join('')}
        </div>
      </div>
      <div class="co-score"><strong>${Number(item.alignmentScore || 0)}</strong><span>%</span></div>
    </div>`).join('');

  const unmapped = (outcomes || []).filter((item) => !(mappings || []).some((map) => map.courseOutcome === item.code));
  const extra = unmapped.map((item) => `<div class="co-map-row"><div class="co-code">${escapeHtml(item.code)}</div><div class="co-content"><b>${escapeHtml(item.text)}</b></div></div>`).join('');

  return `
    <section class="phase2-output co-output">
      <div class="phase2-output-title"><span>Course Outcome Mapping</span><small>Outcome-to-content alignment</small></div>
      <div class="co-map-list">${rows}${extra}</div>
    </section>`;
}


function phase4VisualHtml(section) {
  const visual = section.visual || {};
  if (!visual.type || visual.type === 'none') return '';
  if (visual.type === 'image' && visual.assetUrl) return `<figure class="phase4-section-image"><img src="${escapeHtml(visual.assetUrl)}" alt="${escapeHtml(visual.title || section.heading)}"><figcaption>${escapeHtml(visual.caption || visual.assetName || visual.title || '')}</figcaption></figure>`;
  const nodes = (visual.nodes || []).slice(0, 6);
  return `<figure class="phase4-diagram type-${escapeHtml(visual.type)}"><div class="phase4-diagram-title">${escapeHtml(visual.title || 'Concept Visual')}</div><div class="phase4-diagram-nodes">${nodes.map((node, index) => `<span style="--node:${index}">${escapeHtml(node)}</span>`).join('<i>→</i>')}</div>${visual.caption ? `<figcaption>${escapeHtml(visual.caption)}</figcaption>` : ''}</figure>`;
}

function phase4TableHtml(table) {
  if (!table?.headers?.length || !table?.rows?.length) return '';
  return `<div class="phase4-table-wrap"><table><thead><tr>${table.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${table.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function detailedSectionsHtml(draft) {
  if (!draft.reportSections?.length) return '';
  return `<div class="phase4-report-sections">${draft.reportSections.map((section, index) => `<article class="phase4-rich-section reveal-section" data-section-index="${index}" style="--delay:${index * 55}ms">
    <div class="phase4-section-number">${String(index + 1).padStart(2, '0')}</div>
    <div class="phase4-rich-head"><h3>${escapeHtml(section.heading)}</h3><span>${(section.citations || []).map((x) => `[${escapeHtml(x)}]`).join(' ')}</span></div>
    ${section.summary ? `<p class="phase4-summary phase4-editable" data-field="summary">${escapeHtml(section.summary)}</p>` : ''}
    <div class="phase4-explanation">${(section.explanation || []).map((p, pi) => `<p class="phase4-editable" data-field="explanation" data-item-index="${pi}">${escapeHtml(p)}</p>`).join('')}</div>
    ${(section.keyPoints || []).length ? `<div class="phase4-content-block"><b>Key Points</b><ul>${section.keyPoints.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul></div>` : ''}
    ${(section.examples || []).length ? `<div class="phase4-example-grid">${section.examples.map((example) => `<div><b>${escapeHtml(example.title)}</b><p>${escapeHtml(example.description)}</p></div>`).join('')}</div>` : ''}
    ${section.caseStudy ? `<div class="phase4-case-study"><span>CASE STUDY</span><b>${escapeHtml(section.caseStudy.title)}</b><p>${escapeHtml(section.caseStudy.description)}</p></div>` : ''}
    ${phase4TableHtml(section.table)}
    ${phase4VisualHtml(section)}
    ${(section.applications || []).length ? `<div class="phase4-content-block applications"><b>Applications</b><ul>${section.applications.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul></div>` : ''}
    ${(section.commonMistakes || []).length ? `<div class="phase4-content-block mistakes"><b>Common Mistakes</b><ul>${section.commonMistakes.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul></div>` : ''}
    ${section.speakerNotes ? `<details class="phase4-speaker-notes"><summary>Teacher / speaker notes</summary><p>${escapeHtml(section.speakerNotes)}</p></details>` : ''}
  </article>`).join('')}</div>`;
}

function validationHtml(report) {
  if (!report) return '';
  return `<section class="phase2-output phase4-validation"><div class="phase2-output-title"><span>Export Validation</span><small>${escapeHtml(report.grade || '')}</small></div><div class="phase4-validation-score"><strong>${Number(report.score || 0)}</strong><span>/100</span><p>${Number(report.totals?.words || 0).toLocaleString()} words · ${Number(report.totals?.visuals || 0)} visuals · ${Number(report.totals?.examples || 0)} examples</p></div><div class="phase4-check-grid">${(report.checks || []).map((check) => `<div class="${check.passed ? 'pass' : 'review'}"><i>${check.passed ? '✓' : '!'}</i><b>${escapeHtml(check.label)}</b><span>${escapeHtml(check.detail)}</span></div>`).join('')}</div></section>`;
}

function syncDraftFromEditor(container, draft) {
  container.querySelectorAll('.phase4-rich-section').forEach((card) => {
    const section = draft.reportSections?.[Number(card.dataset.sectionIndex)];
    if (!section) return;
    const summary = card.querySelector('[data-field="summary"]');
    if (summary) section.summary = summary.textContent.trim();
    card.querySelectorAll('[data-field="explanation"]').forEach((node) => { section.explanation[Number(node.dataset.itemIndex)] = node.textContent.trim(); });
  });
  draft.sections = (draft.reportSections || []).map((section) => ({ h: section.heading, b: [section.summary, ...(section.explanation || [])].filter(Boolean).join('\n\n') }));
}

function draftToHtml(draft, forSave) {
  const color = TYPE_COLORS[draft.type] || '#2F5D50';
  let body = '';
  if (draft.reportSections && draft.reportSections.length) {
    body = `${draft.executiveSummary ? `<div class="phase4-executive-summary"><span>EXECUTIVE SUMMARY</span><p>${escapeHtml(draft.executiveSummary)}</p></div>` : ''}${detailedSectionsHtml(draft)}`;
  } else if (draft.sections && draft.sections.length) {
    body = draft.sections.map((section, index) => `<div class="card-section reveal-section" style="--delay:${index * 60}ms"><h4>${escapeHtml(section.h)}</h4><p>${escapeHtml(section.b)}</p></div>`).join('');
  } else if (draft.qa && draft.qa.length) {
    body = '<div class="card-section"><h4>Questions</h4>' + draft.qa.map((item, index) => `
      <div class="qa-item reveal-section" style="--delay:${index * 60}ms">
        <div class="qa-q">${escapeHtml(item.q)}</div>
        <div class="qa-a">${escapeHtml(item.a)}</div>
      </div>`).join('') + '</div>';
  }

  const savedBtnClass = forSave ? 'act-btn saved' : 'act-btn primary';
  const savedBtnLabel = forSave ? 'Saved to Hub' : 'Save to Resource Hub';
  const langMeta = draft.language && draft.language !== 'English' ? `<span>${escapeHtml(draft.language)}</span>` : '';
  const shareBtn = forSave
    ? `<button class="act-btn ${draft.shared ? 'saved' : ''}" data-role="share">${draft.shared ? 'Shared with students' : 'Share with students'}</button>`
    : '';
  const ragBadge = draft.grounding && draft.grounding.retrievedChunks && draft.grounding.retrievedChunks.length
    ? '<span class="rag-live-badge"><i></i> RAG grounded</span>'
    : '<span class="general-ai-badge">General AI</span>';

  return `
    <div class="index-card phase2-draft-card live-surface">
      <div class="card-tab" style="background:${color}">${escapeHtml(draft.type)}</div>
      <div class="card-top">
        <div>
          <div class="card-title">${escapeHtml(draft.topic)}</div>
          <div class="card-meta">
            <span>${escapeHtml(draft.course)}</span>|<span>${escapeHtml(draft.subject)}</span>|<span>${escapeHtml(draft.difficulty)}</span>|<span>${escapeHtml(draft.duration)}</span>${langMeta ? '|' + langMeta : ''}
          </div>
        </div>
        <div class="draft-badges"><span class="style-badge">${escapeHtml(draft.style)}</span>${draft.phase === 4 ? `<span class="phase4-draft-badge">Phase 4 · ${escapeHtml(draft.contentDepth || 'detailed')}</span>` : ''}${ragBadge}</div>
      </div>
      <div class="card-body">${body}</div>
      ${qualityScoreHtml(draft.qualityScore)}
      ${groundingHtml(draft)}
      ${bloomHtml(draft.bloomQuestions || [])}
      ${outcomesHtml(draft.courseOutcomes || [], draft.coMapping || [])}
      ${validationHtml(draft.validationReport)}
      <div class="card-actions sticky-actions">
        <button class="act-btn primary" data-role="regenerate">Regenerate detailed resource</button>
        ${draft.reportSections?.length ? `<button class="act-btn" data-role="edit">Edit content</button>` : ''}
        <button class="${savedBtnClass}" data-role="save" ${forSave ? 'disabled' : ''}>${savedBtnLabel}</button>
        <button class="act-btn" data-role="ppt">PowerPoint</button>
        <div class="dl-wrap">
          <button class="act-btn" data-role="download-toggle">Download</button>
          <div class="dl-menu" data-role="dl-menu">
            <button data-role="dl-pdf">PDF (.pdf)</button>
            <button data-role="dl-docx">Word (.docx)</button>
            <button data-role="dl-text">Plain text (.txt)</button>
            <button data-role="dl-lms">LMS-ready HTML</button>
            <div class="dl-hint">Detailed exports include visuals, examples, case studies, citations, speaker notes, Bloom questions and CO mapping.</div>
          </div>
        </div>
        ${shareBtn}
      </div>
      <div class="shuffle-note">Teacher review required: verify facts, examples, marks and institutional outcome wording before classroom use.</div>
    </div>`;
}

function closeAllMenus() {
  document.querySelectorAll('.dl-menu.open').forEach((menu) => menu.classList.remove('open'));
}
document.addEventListener('click', (event) => {
  if (!event.target.closest('.dl-wrap')) closeAllMenus();
});

function wireDraftCard(container, draft) {
  const regenBtn = container.querySelector('[data-role="regenerate"]');
  if (regenBtn) {
    regenBtn.addEventListener('click', () => {
      const inputs = {
        course: draft.course,
        subject: draft.subject,
        topic: draft.topic,
        difficulty: draft.difficulty,
        duration: draft.duration,
        type: draft.type,
        language: draft.language || 'English',
        syllabusId: draft.syllabusId || draft.syllabus || null,
        useRag: Boolean(draft.syllabusId || draft.syllabus),
        bloomLevels: draft.bloomLevels || [...new Set((draft.bloomQuestions || []).map((q) => q.level).filter(Boolean))],
        bloomQuestionCount: (draft.bloomQuestions || []).length || 6,
        courseOutcomes: (draft.courseOutcomes || []).map((item) => item.text || item),
        referenceIds: draft.referenceIds || [], contentDepth: draft.contentDepth || 'detailed', visualDensity: draft.visualDensity || 'balanced',
        targetPages: draft.targetPages || 20, targetSlides: draft.targetSlides || 26, examplesPerTopic: draft.examplesPerTopic || 2,
        includeDiagrams: draft.includeDiagrams !== false, includeImages: draft.includeImages !== false, includeCaseStudies: draft.includeCaseStudies !== false,
        includeReferences: draft.includeReferences !== false, includeSpeakerNotes: draft.includeSpeakerNotes !== false,
        mediaAssetIds: (draft.visualAssets || []).map((x) => x._id || x.id).filter(Boolean)
      };
      generateAndRender(inputs);
    });
  }

  const editBtn = container.querySelector('[data-role="edit"]');
  if (editBtn) editBtn.addEventListener('click', () => {
    const editing = editBtn.classList.toggle('saved');
    container.querySelectorAll('.phase4-editable').forEach((node) => { node.contentEditable = editing ? 'true' : 'false'; node.classList.toggle('editing', editing); });
    if (!editing) syncDraftFromEditor(container, draft);
    editBtn.textContent = editing ? 'Finish editing' : 'Edit content';
    showToast(editing ? 'Editing enabled. Click text to revise.' : 'Edits applied to exports.', 'info');
  });

  const saveBtn = container.querySelector('[data-role="save"]');
  if (saveBtn && !saveBtn.disabled) saveBtn.addEventListener('click', () => saveCurrentDraft(saveBtn));

  const toggleBtn = container.querySelector('[data-role="download-toggle"]');
  const menu = container.querySelector('[data-role="dl-menu"]');
  if (toggleBtn && menu) {
    toggleBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      const isOpen = menu.classList.contains('open');
      closeAllMenus();
      menu.classList.toggle('open', !isOpen);
    });
  }

  const pptBtn = container.querySelector('[data-role="ppt"]');
  if (pptBtn) {
    pptBtn.addEventListener('click', async () => {
      pptBtn.disabled = true;
      const original = pptBtn.textContent;
      pptBtn.textContent = 'Building PPT...';
      try {
        syncDraftFromEditor(container, draft);
        const payload = draft._id ? { resourceId: draft._id, theme: 'academic', maxContentSlides: draft.targetSlides || 26, includeSpeakerNotes: draft.includeSpeakerNotes !== false } : { draft, theme: 'academic', maxContentSlides: draft.targetSlides || 26, includeSpeakerNotes: draft.includeSpeakerNotes !== false };
        const blob = await apiDownloadPresentation(payload);
        triggerDownload(blob, `${safeFileName(draft)}_presentation.pptx`);
        showToast('Editable PowerPoint downloaded', 'success');
      } catch (err) {
        showToast(err.message || 'Could not generate PowerPoint.', 'error');
      } finally {
        pptBtn.disabled = false;
        pptBtn.textContent = original;
      }
    });
  }

  const pdfBtn = container.querySelector('[data-role="dl-pdf"]');
  if (pdfBtn) pdfBtn.addEventListener('click', () => { syncDraftFromEditor(container, draft); closeAllMenus(); downloadPDF(draft); });
  const docxBtn = container.querySelector('[data-role="dl-docx"]');
  if (docxBtn) docxBtn.addEventListener('click', () => { syncDraftFromEditor(container, draft); closeAllMenus(); downloadDOCX(draft); });
  const textBtn = container.querySelector('[data-role="dl-text"]');
  if (textBtn) textBtn.addEventListener('click', () => { syncDraftFromEditor(container, draft); closeAllMenus(); downloadText(draft); });
  const lmsBtn = container.querySelector('[data-role="dl-lms"]');
  if (lmsBtn) lmsBtn.addEventListener('click', () => { syncDraftFromEditor(container, draft); closeAllMenus(); downloadLMS(draft); });

  const shareToggle = container.querySelector('[data-role="share"]');
  if (shareToggle) {
    shareToggle.addEventListener('click', async () => {
      const resource = resources.find((item) => item._id === draft._id);
      if (!resource) return;
      const newShared = !resource.shared;
      shareToggle.disabled = true;
      try {
        await apiSetShared(resource._id, newShared);
        resource.shared = newShared;
        draft.shared = newShared;
        shareToggle.classList.toggle('saved', resource.shared);
        shareToggle.textContent = resource.shared ? 'Shared with students' : 'Share with students';
        showToast(resource.shared ? 'Shared with students' : 'Unshared', 'success');
        await loadSharedResources();
        renderPortal();
      } catch (err) {
        showToast(err.message || 'Could not update sharing.', 'error');
      } finally {
        shareToggle.disabled = false;
      }
    });
  }
}

function renderDraft(draft) {
  outputArea.innerHTML = draftToHtml(draft, false);
  wireDraftCard(outputArea, draft);
  requestAnimationFrame(() => outputArea.querySelector('.phase2-draft-card')?.classList.add('rendered'));
}

async function saveCurrentDraft(saveBtn) {
  if (!currentDraft) return;
  syncDraftFromEditor(outputArea, currentDraft);
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
  }
  try {
    const payload = {
      type: currentDraft.type,
      topic: currentDraft.topic,
      course: currentDraft.course,
      subject: currentDraft.subject,
      difficulty: currentDraft.difficulty,
      duration: currentDraft.duration,
      language: currentDraft.language,
      style: currentDraft.style,
      sections: currentDraft.sections,
      qa: currentDraft.qa,
      bloomQuestions: currentDraft.bloomQuestions,
      courseOutcomes: currentDraft.courseOutcomes,
      coMapping: currentDraft.coMapping,
      qualityScore: currentDraft.qualityScore,
      syllabusId: currentDraft.syllabusId,
      syllabusName: currentDraft.syllabusName,
      grounding: currentDraft.grounding,
      phase: currentDraft.phase || 4, contentDepth: currentDraft.contentDepth, visualDensity: currentDraft.visualDensity, targetPages: currentDraft.targetPages, targetSlides: currentDraft.targetSlides,
      examplesPerTopic: currentDraft.examplesPerTopic, includeDiagrams: currentDraft.includeDiagrams, includeImages: currentDraft.includeImages, includeCaseStudies: currentDraft.includeCaseStudies,
      includeReferences: currentDraft.includeReferences, includeSpeakerNotes: currentDraft.includeSpeakerNotes, executiveSummary: currentDraft.executiveSummary, reportSections: currentDraft.reportSections,
      references: currentDraft.references, citationUsage: currentDraft.citationUsage, visualAssets: currentDraft.visualAssets, validationReport: currentDraft.validationReport, generationWarnings: currentDraft.generationWarnings
    };
    const saved = await apiCreateResource(payload);
    resources.unshift(saved);
    renderDashboard();
    outputArea.innerHTML = draftToHtml(saved, true);
    wireDraftCard(outputArea, saved);
    showToast('Saved to Resource Hub', 'success');
  } catch (err) {
    showToast(err.message || 'Could not save resource.', 'error');
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save to Resource Hub';
    }
  }
}
