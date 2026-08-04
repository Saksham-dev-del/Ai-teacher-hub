function populatePresentationResourceSelect() {
  const select = document.getElementById('ppt-resource-select');
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">Select a resource</option>' + resources.map((r) =>
    `<option value="${r._id}">${escapeHtml(r.course || '')} · ${escapeHtml(r.subject || '')} · ${escapeHtml(r.topic || '')}</option>`
  ).join('');
  if ([...select.options].some((o) => o.value === current)) select.value = current;
}

function presentationSlidePlan(resource, limit) {
  const target = Math.max(8, Number(limit || resource.targetSlides || 18));
  const slides = [
    { type: 'title', title: resource.topic, body: `${resource.course || ''} · ${resource.subject || ''}` },
    { type: 'roadmap', title: 'Presentation Roadmap', body: (resource.reportSections || resource.sections || []).slice(0, 10).map((s) => s.heading || s.h).join(' • ') }
  ];
  if ((resource.courseOutcomes || []).length) slides.push({ type: 'outcomes', title: 'Learning Outcomes', body: resource.courseOutcomes.map((o) => `${o.code}: ${o.text}`).join(' • ') });

  if ((resource.reportSections || []).length) {
    for (const section of resource.reportSections) {
      if (slides.length >= target - 4) break;
      slides.push({ type: 'content', title: section.heading, body: [...(section.keyPoints || []), ...(section.applications || []).slice(0, 2)].join(' • ') || section.summary });
      if ((section.examples || []).length && slides.length < target - 4) slides.push({ type: 'examples', title: `${section.heading}: Worked Examples`, body: section.examples.map((x) => `${x.title}: ${x.description}`).join(' • ') });
      if (section.caseStudy && slides.length < target - 4) slides.push({ type: 'case', title: `Case Study: ${section.caseStudy.title}`, body: section.caseStudy.description });
      if (section.table && slides.length < target - 4) slides.push({ type: 'table', title: `${section.heading}: Comparison`, body: (section.table.headers || []).join(' | ') });
    }
  } else {
    (resource.sections || []).slice(0, target - 4).forEach((section) => slides.push({ type: 'content', title: section.h, body: section.b }));
  }

  if (!(resource.sections || []).length && !(resource.reportSections || []).length && (resource.qa || []).length) slides.push({ type: 'content', title: 'Knowledge Check', body: resource.qa.slice(0, 5).map((q) => q.q).join(' • ') });
  if ((resource.bloomQuestions || []).length && slides.length < target - 2) slides.push({ type: 'questions', title: "Bloom's Taxonomy Questions", body: resource.bloomQuestions.slice(0, 6).map((q) => `[${q.level}] ${q.question}`).join(' • ') });
  if ((resource.coMapping || []).length && slides.length < target - 1) slides.push({ type: 'mapping', title: 'Course Outcome Alignment', body: resource.coMapping.slice(0, 5).map((m) => `${m.courseOutcome}: ${m.alignmentScore}%`).join(' • ') });
  if ((resource.references || []).length && slides.length < target) slides.push({ type: 'references', title: 'References & Evidence', body: resource.references.slice(0, 6).map((r) => `[${r.id}] ${r.title}`).join(' • ') });
  slides.push({ type: 'end', title: 'Summary, Reflection & Questions', body: resource.executiveSummary || resource.topic });
  return slides.slice(0, target);
}
function renderPresentationPreview() {
  const select = document.getElementById('ppt-resource-select');
  const shell = document.getElementById('ppt-preview');
  if (!select || !shell) return;
  const resource = resources.find((r) => r._id === select.value);
  if (!resource) {
    shell.innerHTML = '<div class="ppt-preview-empty"><span>PPTX</span><b>Select a saved resource</b><p>A visual slide plan will appear here before download.</p></div>';
    return;
  }
  const limit = Number(document.getElementById('ppt-slide-limit').value || 8);
  const theme = document.getElementById('ppt-theme').value;
  const slides = presentationSlidePlan(resource, limit);
  shell.dataset.theme = theme;
  shell.innerHTML = `<div class="ppt-preview-head"><div><span>Slide architecture</span><strong>${slides.length} slides</strong></div><em>${escapeHtml(theme)} theme</em></div><div class="ppt-slide-stack">${slides.map((slide, index) => `
    <article class="ppt-mini-slide motion-card slide-${slide.type}" style="--slide-index:${index};--delay:${index * 35}ms"><span>${index + 1}</span><div><b>${slide.type === 'content' && window.iconForSlideHeading ? window.iconForSlideHeading(slide.title) + ' ' : ''}${escapeHtml(slide.title || '')}</b><p>${escapeHtml(String(slide.body || '').slice(0, 180))}</p></div></article>`).join('')}</div>`;
  if (window.runMotionEntrance) window.runMotionEntrance(shell);
  if (window.applyThemePreviewColors) window.applyThemePreviewColors(shell, theme);
}

function renderPresentations() {
  populatePresentationResourceSelect();
  renderPresentationPreview();
}

async function generatePresentation() {
  const resourceId = document.getElementById('ppt-resource-select').value;
  const button = document.getElementById('btn-generate-ppt');
  const status = document.getElementById('ppt-status');
  if (!resourceId) return showToast('Select a saved resource first.', 'error');
  const resource = resources.find((r) => r._id === resourceId);
  button.disabled = true;
  button.classList.add('generating');
  status.innerHTML = '<span class="status-pulse"></span> Building editable slides, layout, outcomes and assessment prompts...';
  try {
    const isLocalDraft = resourceId.startsWith('quickgen-');
    const blob = await apiDownloadPresentation({
      ...(isLocalDraft ? { draft: resource } : { resourceId }),
      theme: document.getElementById('ppt-theme').value,
      maxContentSlides: Number(document.getElementById('ppt-slide-limit').value || resource?.targetSlides || 18),
      institution: document.getElementById('ppt-institution').value.trim(),
      includeSpeakerNotes: document.getElementById('ppt-speaker-notes')?.checked !== false
    });
    triggerDownload(blob, `${String(resource?.topic || 'academic_presentation').replace(/[^a-z0-9]+/gi, '_').toLowerCase()}_presentation.pptx`);
    status.textContent = 'PowerPoint generated successfully. Open it in PowerPoint or Google Slides and apply final teacher edits.';
    showToast('Editable PowerPoint downloaded', 'success');
  } catch (err) {
    status.textContent = err.message;
    showToast(err.message, 'error');
  } finally {
    button.disabled = false;
    button.classList.remove('generating');
  }
}

document.getElementById('ppt-resource-select')?.addEventListener('change', renderPresentationPreview);
document.getElementById('ppt-theme')?.addEventListener('change', renderPresentationPreview);
document.getElementById('ppt-slide-limit')?.addEventListener('change', renderPresentationPreview);
document.getElementById('btn-generate-ppt')?.addEventListener('click', generatePresentation);
