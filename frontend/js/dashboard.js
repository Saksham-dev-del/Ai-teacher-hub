function animateStat(element, target) {
  if (!element) return;
  const end = Number(target || 0);
  const start = Number(element.textContent || 0);
  const started = performance.now();
  const duration = 520;
  function frame(now) {
    const progress = Math.min(1, (now - started) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = Math.round(start + (end - start) * eased);
    if (progress < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function renderDashboard() {
  const courses = new Set(resources.map((r) => r.course));
  const types = new Set(resources.map((r) => r.type));
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weekCount = resources.filter((r) => new Date(r.createdAt).getTime() >= weekAgo).length;

  animateStat(document.getElementById('stat-total'), resources.length);
  animateStat(document.getElementById('stat-courses'), courses.size);
  animateStat(document.getElementById('stat-types'), types.size);
  animateStat(document.getElementById('stat-week'), weekCount);

  const ribbonText = document.querySelector('.phase2-ribbon span');
  if (ribbonText) {
    const groundedCount = resources.filter((r) => r.grounding && r.grounding.retrievedChunks && r.grounding.retrievedChunks.length).length;
    const averageQuality = resources.filter((r) => r.qualityScore && Number.isFinite(Number(r.qualityScore.overall)))
      .reduce((acc, item, _, arr) => acc + Number(item.qualityScore.overall) / arr.length, 0);
    ribbonText.textContent = `Phase 9 collaboration + Phase 10 intelligence · ${syllabi.length} indexed syllabi · ${groundedCount} RAG-grounded resources${averageQuality ? ` · ${Math.round(averageQuality)}/100 average quality` : ''}`;
  }

  const recentList = document.getElementById('recent-list');
  if (resources.length === 0) {
    recentList.innerHTML = '<p class="empty-note">Nothing saved yet - generate your first resource to see it here.</p>';
  } else {
    recentList.innerHTML = resources.slice(0, 6).map((r, index) => `
      <div class="recent-item reveal-section" style="--delay:${index * 60}ms">
        <span class="dot" style="background:${TYPE_COLORS[r.type] || '#2F5D50'}"></span>
        <div style="flex:1;">
          <div><strong>${escapeHtml(r.topic)}</strong> <span class="recent-meta">- ${escapeHtml(r.type)}</span></div>
          <div class="recent-meta">${escapeHtml(r.course)} | ${escapeHtml(r.subject)} | ${escapeHtml(r.style)} style</div>
        </div>
        ${r.qualityScore ? `<span class="mini-quality">${Number(r.qualityScore.overall || 0)}</span>` : ''}
      </div>`).join('');
  }

  const chipWrap = document.getElementById('course-chips');
  if (courses.size === 0) {
    chipWrap.innerHTML = '<span class="empty-note">Your course list will appear once you save a resource.</span>';
  } else {
    chipWrap.innerHTML = [...courses].map((c, index) => `<span class="course-chip reveal-section" style="--delay:${index * 55}ms">${escapeHtml(c)}</span>`).join('');
  }
}
