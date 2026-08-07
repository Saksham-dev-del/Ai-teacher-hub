const modalBackdrop = document.getElementById('modal-backdrop');
const modalBox = document.getElementById('modal-box');

function normalizeResourceForView(resource) {
  const r = resource && typeof resource === 'object' ? { ...resource } : {};
  r.type = r.type || 'Study Material';
  r.topic = r.topic || 'Untitled Resource';
  r.course = r.course || 'General';
  r.subject = r.subject || 'General Subject';
  r.difficulty = r.difficulty || 'Intermediate';
  r.duration = r.duration || 'Not specified';
  r.language = r.language || 'English';
  r.style = r.style || 'Academic';
  r.sections = Array.isArray(r.sections) ? r.sections : [];
  r.qa = Array.isArray(r.qa) ? r.qa : [];
  r.reportSections = Array.isArray(r.reportSections) ? r.reportSections : [];
  r.bloomQuestions = Array.isArray(r.bloomQuestions) ? r.bloomQuestions : [];
  r.courseOutcomes = Array.isArray(r.courseOutcomes) ? r.courseOutcomes : [];
  r.coMapping = Array.isArray(r.coMapping) ? r.coMapping : [];
  r.references = Array.isArray(r.references) ? r.references : [];
  return r;
}

async function openModal(id) {
  modalBackdrop.classList.add('open');
  document.body.classList.add('modal-open');
  modalBox.innerHTML = '<button class="modal-close" data-role="modal-close" aria-label="Close">×</button><div class="resource-view-loading"><i></i><b>Loading the complete saved resource…</b><span>Fetching all sections, visuals, outcomes and export controls.</span></div>';
  modalBox.querySelector('[data-role="modal-close"]').addEventListener('click', closeModal);
  try {
    let r = resources.find((x) => String(x._id) === String(id)) || sharedResources.find((x) => String(x._id) === String(id));
    try {
      r = await apiGetResource(id);
      const ownIndex = resources.findIndex((x) => String(x._id) === String(id));
      if (ownIndex >= 0) resources[ownIndex] = r;
      const sharedIndex = sharedResources.findIndex((x) => String(x._id) === String(id));
      if (sharedIndex >= 0) sharedResources[sharedIndex] = r;
    } catch (fetchError) {
      if (!r) throw fetchError;
      console.warn('Full resource fetch failed; using cached resource.', fetchError);
    }
    r = normalizeResourceForView(r);
    const hasRenderableContent = r.reportSections.length || r.sections.length || r.qa.length || r.executiveSummary;
    if (!hasRenderableContent) {
      modalBox.innerHTML = '<button class="modal-close" data-role="modal-close" aria-label="Close">×</button><div class="resource-view-error"><b>This saved item has no renderable content.</b><p>The metadata is present, but its content fields are empty. Regenerate the resource and save it again.</p></div>';
      modalBox.querySelector('[data-role="modal-close"]').addEventListener('click', closeModal);
      return;
    }
    modalBox.innerHTML = '<button class="modal-close" data-role="modal-close" aria-label="Close">×</button>' + draftToHtml(r, true);
    modalBox.querySelector('[data-role="modal-close"]').addEventListener('click', closeModal);
    const rg = modalBox.querySelector('[data-role="regenerate"]');
    if (rg) rg.remove();
    const isOwn = resources.some((x) => String(x._id) === String(id));
    if (!isOwn) {
      ['share', 'save', 'ppt', 'edit'].forEach((role) => modalBox.querySelector(`[data-role="${role}"]`)?.remove());
    }
    wireDraftCard(modalBox, r);
    modalBox.scrollTop = 0;
    if (window.runMotionEntrance) window.runMotionEntrance(modalBox);
  } catch (error) {
    console.error('Resource view failed:', error);
    modalBox.innerHTML = `<button class="modal-close" data-role="modal-close" aria-label="Close">×</button><div class="resource-view-error"><b>Could not open this resource.</b><p>${escapeHtml(error.message || 'Unknown resource view error.')}</p><button class="act-btn primary" data-role="retry-view">Retry</button></div>`;
    modalBox.querySelector('[data-role="modal-close"]').addEventListener('click', closeModal);
    modalBox.querySelector('[data-role="retry-view"]')?.addEventListener('click', () => openModal(id));
  }
}


function showGenericModal(html) {
  modalBackdrop.classList.add('open');
  document.body.classList.add('modal-open');
  modalBox.innerHTML = '<button class="modal-close" data-role="modal-close" aria-label="Close">×</button>' + String(html || '');
  modalBox.querySelector('[data-role="modal-close"]')?.addEventListener('click', closeModal);
  modalBox.scrollTop = 0;
  if (window.runMotionEntrance) window.runMotionEntrance(modalBox);
}

function closeModal() {
  modalBackdrop.classList.remove('open');
  document.body.classList.remove('modal-open');
  modalBox.innerHTML = '';
}

modalBackdrop.addEventListener('click', (e) => {
  if (e.target === modalBackdrop) closeModal();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && modalBackdrop.classList.contains('open') && !activeQuizAttempt) closeModal();
});
