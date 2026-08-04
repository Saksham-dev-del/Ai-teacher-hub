function renderPortal() {
  const portalGrid = document.getElementById('portal-grid');
  if (!portalGrid) return;
  if (sharedResources.length === 0) {
    portalGrid.innerHTML = '<div class="hub-empty" style="grid-column:1/-1;">No resources shared yet. Toggle "Share with students" on a saved resource in the Resource Hub to publish it here.</div>';
    return;
  }
  portalGrid.innerHTML = sharedResources.map((r) => `
    <div class="portal-card">
      <span class="hub-tag" style="background:${TYPE_COLORS[r.type] || '#2F5D50'}">${escapeHtml(r.type)}</span>
      <h4>${escapeHtml(r.topic)}</h4>
      <div class="hmeta">${escapeHtml(r.subject)} | ${escapeHtml(r.course)}</div>
      <button data-portal-view="${r._id}">Open resource</button>
    </div>`).join('');
  portalGrid.querySelectorAll('[data-portal-view]').forEach((b) => b.addEventListener('click', () => openModal(b.dataset.portalView, true)));
}
