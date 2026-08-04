const hubGrid = document.getElementById('hub-grid');
const hubSearch = document.getElementById('hub-search');
const hubFilterCourse = document.getElementById('hub-filter-course');
const hubFilterType = document.getElementById('hub-filter-type');

function populateCourseFilter() {
  const courses = [...new Set(resources.map((r) => r.course))];
  const current = hubFilterCourse.value;
  hubFilterCourse.innerHTML = '<option value="">All courses</option>' +
    courses.map((c) => `<option ${c === current ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('');
}

function renderHub() {
  populateCourseFilter();
  const q = hubSearch.value.trim().toLowerCase();
  const courseF = hubFilterCourse.value;
  const typeF = hubFilterType.value;
  const filtered = resources.filter((r) => {
    const matchesQ = !q || r.topic.toLowerCase().includes(q) || r.subject.toLowerCase().includes(q) || String(r.syllabusName || '').toLowerCase().includes(q);
    const matchesCourse = !courseF || r.course === courseF;
    const matchesType = !typeF || r.type === typeF;
    return matchesQ && matchesCourse && matchesType;
  });
  document.getElementById('hub-count').textContent = `${filtered.length} of ${resources.length} resource${resources.length === 1 ? '' : 's'}`;

  if (resources.length === 0) {
    hubGrid.innerHTML = '<div class="hub-empty" style="grid-column:1/-1;">Nothing saved yet. Head to the <strong>AI Generator</strong> tab, create a Phase 2 draft, and save it here.</div>';
    return;
  }
  if (filtered.length === 0) {
    hubGrid.innerHTML = '<div class="hub-empty" style="grid-column:1/-1;">No resources match your search or filters.</div>';
    return;
  }

  hubGrid.innerHTML = filtered.map((r, index) => {
    const isGrounded = r.grounding && r.grounding.retrievedChunks && r.grounding.retrievedChunks.length;
    const quality = r.qualityScore && Number(r.qualityScore.overall || 0);
    return `
      <div class="hub-card phase2-hub-card reveal-section" style="--delay:${index * 55}ms">
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:6px;">
          <span class="hub-tag" style="background:${TYPE_COLORS[r.type] || '#2F5D50'}">${escapeHtml(r.type)}</span>
          <button class="share-toggle ${r.shared ? 'on' : ''}" data-share="${r._id}">${r.shared ? 'Shared' : 'Share'}</button>
        </div>
        <div class="hub-ai-badges">
          ${isGrounded ? '<span class="rag-mini"><i></i> RAG</span>' : '<span class="general-mini">General</span>'}
          ${quality ? `<span class="quality-mini">Quality ${quality}</span>` : ''}
        </div>
        <h4>${escapeHtml(r.topic)}</h4>
        <div class="hmeta">${escapeHtml(r.course)} | ${escapeHtml(r.subject)} | ${escapeHtml(r.difficulty)}</div>
        <div class="hmeta">${escapeHtml(r.style)} style${r.language && r.language !== 'English' ? ' | ' + escapeHtml(r.language) : ''} | ${new Date(r.createdAt).toLocaleDateString()}</div>
        ${r.syllabusName ? `<div class="syllabus-mini-line">Source: ${escapeHtml(r.syllabusName)}</div>` : ''}
        <div class="hub-card-actions">
          <button data-view="${r._id}">View</button>
          <button data-pdf="${r._id}">PDF</button>
          <button data-delete="${r._id}" class="danger">Delete</button>
        </div>
      </div>`;
  }).join('');

  hubGrid.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => openModal(b.dataset.view)));
  hubGrid.querySelectorAll('[data-pdf]').forEach((b) => b.addEventListener('click', () => {
    const r = resources.find((x) => x._id === b.dataset.pdf);
    if (r) downloadPDF(r);
  }));
  hubGrid.querySelectorAll('[data-share]').forEach((b) => b.addEventListener('click', async () => {
    const r = resources.find((x) => x._id === b.dataset.share);
    if (!r) return;
    const newShared = !r.shared;
    b.disabled = true;
    try {
      await apiSetShared(r._id, newShared);
      r.shared = newShared;
      showToast(r.shared ? 'Shared with students' : 'Unshared', 'success');
      renderHub();
      await loadSharedResources();
      renderPortal();
    } catch (err) {
      showToast(err.message || 'Could not update sharing.', 'error');
      b.disabled = false;
    }
  }));
  hubGrid.querySelectorAll('[data-delete]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('Delete this resource? This cannot be undone.')) return;
    b.disabled = true;
    try {
      await apiDeleteResource(b.dataset.delete);
      resources = resources.filter((x) => x._id !== b.dataset.delete);
      renderHub();
      renderDashboard();
      await loadSharedResources();
      renderPortal();
      showToast('Resource deleted', 'info');
    } catch (err) {
      showToast(err.message || 'Could not delete resource.', 'error');
      b.disabled = false;
    }
  }));
}

hubSearch.addEventListener('input', renderHub);
hubFilterCourse.addEventListener('change', renderHub);
hubFilterType.addEventListener('change', renderHub);
