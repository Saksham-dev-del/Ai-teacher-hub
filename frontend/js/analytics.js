function performanceBars(items, valueKey, suffix = '%', color = 'var(--phase3-violet)') {
  const values = (items || []).map((item) => Number(item[valueKey] || 0));
  const max = Math.max(...values, 1);
  return (items || []).map((item, index) => `
    <div class="performance-bar-row motion-card" style="--delay:${index * 45}ms">
      <div><span>${escapeHtml(item.label)}</span><b>${Math.round(Number(item[valueKey] || 0))}${suffix}</b></div>
      <div class="performance-track"><i style="--bar-width:${Math.max(2, Number(item[valueKey] || 0) / max * 100)}%;--bar-color:${color}"></i></div>
      ${item.attempts !== undefined ? `<small>${item.attempts} response${item.attempts === 1 ? '' : 's'}</small>` : ''}
    </div>`).join('');
}

function scoreDistributionHtml(items) {
  const max = Math.max(...(items || []).map((x) => Number(x.count || 0)), 1);
  return `<div class="score-histogram">${(items || []).map((item, index) => `<div class="histogram-column" style="--delay:${index * 70}ms"><b>${item.count}</b><i style="--hist-height:${Math.max(5, Number(item.count || 0) / max * 100)}%"></i><span>${escapeHtml(item.label)}</span></div>`).join('')}</div>`;
}

function recentAttemptRows(items, role) {
  if (!items || !items.length) return '<div class="phase3-empty compact"><b>No submitted attempts yet</b><p>Quiz results will appear here after submission.</p></div>';
  return `<div class="performance-attempt-list">${items.map((item, index) => `<div class="performance-attempt-row motion-card" style="--delay:${index * 40}ms"><div class="attempt-score-bubble ${item.passed ? 'passed' : 'failed'}">${Math.round(item.percentage)}%</div><div><b>${escapeHtml(item.quizTitle)}</b><span>${escapeHtml(item.subject || '')} · ${escapeHtml(item.topic || '')}</span>${role !== 'student' && item.student ? `<small>${escapeHtml(item.student.name)} · ${escapeHtml(item.student.email)}</small>` : `<small>${new Date(item.submittedAt).toLocaleString()}</small>`}</div><em>${formatDurationSeconds(item.durationSeconds)}</em></div>`).join('')}</div>`;
}

async function renderAnalytics() {
  const el = document.getElementById('analytics-body');
  if (!el) return;
  el.innerHTML = '<div class="phase3-loading"><i></i><span>Calculating performance intelligence...</span></div>';
  try {
    const data = await apiPerformance();
    const role = data.role;
    const summary = data.summary || {};
    const weak = data.weakAreas || [];
    const resourceAvg = resources.filter((r) => r.qualityScore?.overall).length
      ? Math.round(resources.filter((r) => r.qualityScore?.overall).reduce((sum, r) => sum + Number(r.qualityScore.overall), 0) / resources.filter((r) => r.qualityScore?.overall).length)
      : 0;

    el.innerHTML = `
      <div class="phase3-summary-row analytics-summary">
        ${[
          ['Quizzes', summary.totalQuizzes || 0, role === 'student' ? 'attempted library' : `${summary.publishedQuizzes || 0} published`],
          ['Attempts', summary.totalAttempts || 0, 'auto-graded submissions'],
          ['Average score', `${Math.round(summary.averageScore || 0)}%`, 'across submitted attempts'],
          ['Pass rate', `${Math.round(summary.passRate || 0)}%`, role === 'student' ? 'your outcomes' : `${summary.activeStudents || 0} active students`]
        ].map(([label, value, note], i) => `<div class="phase3-summary-card motion-card" style="--delay:${i * 55}ms"><span>${label}</span><strong>${value}</strong><em>${note}</em></div>`).join('')}
      </div>

      <div class="performance-grid top-grid">
        <section class="phase3-panel motion-card"><div class="phase3-section-title"><h3>Score distribution</h3><span>Percentage bands</span></div>${scoreDistributionHtml(data.scoreDistribution || [])}</section>
        <section class="phase3-panel motion-card"><div class="phase3-section-title"><h3>Learning alerts</h3><span>Lowest-performing areas</span></div>${weak.length ? `<div class="weak-area-list">${weak.map((item, i) => `<div class="weak-area-item" style="--delay:${i * 45}ms"><span>${escapeHtml(item.type)}</span><div><b>${escapeHtml(item.label)}</b><small>${item.attempts} response${item.attempts === 1 ? '' : 's'}</small></div><strong>${Math.round(item.score)}%</strong></div>`).join('')}</div>` : '<div class="phase3-empty compact"><b>No weak areas detected yet</b><p>More attempts are needed for reliable learning alerts.</p></div>'}</section>
      </div>

      <div class="performance-grid">
        <section class="phase3-panel motion-card"><div class="phase3-section-title"><h3>Topic performance</h3><span>Average score</span></div>${performanceBars((data.byTopic || []).slice(0, 10), 'averageScore', '%', 'var(--phase3-cyan)') || '<p class="empty-note">No topic data yet.</p>'}</section>
        <section class="phase3-panel motion-card"><div class="phase3-section-title"><h3>Bloom taxonomy mastery</h3><span>Marks achieved</span></div>${performanceBars(data.byBloom || [], 'marksPercentage', '%', 'var(--phase3-violet)') || '<p class="empty-note">No Bloom data yet.</p>'}</section>
      </div>

      <div class="performance-grid">
        <section class="phase3-panel motion-card"><div class="phase3-section-title"><h3>Course outcome mastery</h3><span>Outcome-level accuracy</span></div>${performanceBars(data.byCourseOutcome || [], 'marksPercentage', '%', 'var(--phase3-mint)') || '<p class="empty-note">No mapped outcomes yet.</p>'}</section>
        <section class="phase3-panel motion-card"><div class="phase3-section-title"><h3>${role === 'student' ? 'Your recent attempts' : 'Recent student attempts'}</h3><span>Latest submissions</span></div>${recentAttemptRows(data.recentAttempts || [], role)}</section>
      </div>

      ${role !== 'student' ? `<section class="phase3-panel motion-card resource-intelligence"><div class="phase3-section-title"><h3>Resource intelligence</h3><span>Phase 2 + Phase 3 combined</span></div><div class="resource-intelligence-grid"><div><span>Saved resources</span><strong>${resources.length}</strong></div><div><span>Average AI quality</span><strong>${resourceAvg || '--'}</strong><em>/100</em></div><div><span>RAG-grounded</span><strong>${resources.filter((r) => r.grounding?.retrievedChunks?.length).length}</strong></div><div><span>Bloom prompts</span><strong>${resources.reduce((sum, r) => sum + (r.bloomQuestions || []).length, 0)}</strong></div></div></section>` : ''}
    `;
    if (window.runMotionEntrance) window.runMotionEntrance(el);
  } catch (err) {
    el.innerHTML = `<div class="phase3-empty error"><b>Could not load performance analytics</b><p>${escapeHtml(err.message)}</p></div>`;
  }
}
