async function apiSecurityOverview() {
  const resp = await authFetch('/api/security/overview');
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || 'Could not load security overview.');
  return data;
}

async function updateSecurityAlert(id, status) {
  const resp = await authFetch(`/api/security/alerts/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || 'Could not update alert.');
  return data.alert;
}

function securityMetricCard(label, value, note, tone = '') {
  return `<article class="security-metric motion-card ${tone}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value ?? 0))}</strong><small>${escapeHtml(note)}</small></article>`;
}

function securityAlertHtml(alert) {
  const actor = alert.actor?.name || alert.actor?.email || 'System / unknown actor';
  return `<article class="security-alert-row ${escapeHtml(alert.severity || 'medium')}" data-alert-id="${alert._id}">
    <div class="security-alert-icon">${alert.severity === 'critical' ? '!' : alert.severity === 'high' ? '▲' : '•'}</div>
    <div class="security-alert-copy"><div><b>${escapeHtml(alert.title)}</b><span>${escapeHtml(alert.severity)} · ${escapeHtml(alert.status)}</span></div><p>${escapeHtml(alert.description || '')}</p><small>${escapeHtml(actor)} · ${new Date(alert.createdAt).toLocaleString()}</small></div>
    ${alert.status === 'open' ? `<div class="security-alert-actions"><button data-alert-action="acknowledged" data-alert="${alert._id}" class="act-btn">Acknowledge</button><button data-alert-action="resolved" data-alert="${alert._id}" class="act-btn primary">Resolve</button></div>` : ''}
  </article>`;
}

function auditLogHtml(log) {
  const actor = log.actor?.name || log.actor?.email || 'System';
  return `<div class="audit-log-row"><span class="audit-outcome ${escapeHtml(log.outcome)}">${escapeHtml(log.outcome)}</span><div><b>${escapeHtml(log.action)}</b><small>${escapeHtml(actor)} · ${new Date(log.createdAt).toLocaleString()}</small></div><em>${escapeHtml(log.severity)}</em></div>`;
}

async function renderAdmin() {
  const el = document.getElementById('admin-body');
  if (!el) return;
  el.innerHTML = '<div class="an-empty">Loading platform and zero-trust security intelligence...</div>';
  try {
    const [statsResp, security] = await Promise.all([
      authFetch('/api/admin/stats').then(async (resp) => { const data = await resp.json(); if (!resp.ok) throw new Error(data.error || 'Could not load admin stats.'); return data; }),
      apiSecurityOverview()
    ]);
    const data = statsResp;

    function barsHtml(pairs, color) {
      if (!pairs.length) return '<p class="empty-note">No data yet.</p>';
      const max = Math.max(...pairs.map((p) => p.count), 1);
      return pairs.map((p) => `<div class="bar-row"><div class="bl"><span class="lbl">${escapeHtml(p.label)}</span><span class="cnt">${p.count}</span></div><div class="bar-track"><div class="bar-fill" style="width:${Math.round((p.count / max) * 100)}%; background:${color}"></div></div></div>`).join('');
    }

    const m = security.metrics || {};
    el.innerHTML = `
      <section class="security-command-center motion-card">
        <div class="security-command-head"><div><span class="phase-label"><i></i> Phase 6 Zero-Trust Command Center</span><h2>Security posture and incident monitoring</h2><p>Server-side verification, session rotation, audit logs, secure uploads, prompt-injection filtering and quiz anti-tamper signals.</p></div><div class="security-live-pill"><i></i> Live protection</div></div>
        <div class="security-metric-grid">
          ${securityMetricCard('Open alerts', m.openAlerts, 'requires admin review', m.openAlerts ? 'warning' : 'safe')}
          ${securityMetricCard('High / critical', m.criticalAlerts, 'priority incidents', m.criticalAlerts ? 'critical' : 'safe')}
          ${securityMetricCard('Blocked in 24h', m.blocked24h, 'rate/origin/token attacks')}
          ${securityMetricCard('Failed logins', m.failedLogins24h, 'last 24 hours')}
          ${securityMetricCard('Active sessions', m.activeSessions, 'rotating refresh sessions')}
          ${securityMetricCard('Flagged attempts', m.flaggedAttempts, 'teacher review queue')}
          ${securityMetricCard('Cancelled attempts', m.cancelledAttempts, 'integrity policy')}
          ${securityMetricCard('Flagged documents', m.flaggedDocuments, 'prompt injection neutralized')}
        </div>
      </section>

      <div class="security-admin-grid">
        <section class="panel security-alert-panel"><div class="phase3-section-title"><h3>Recent security alerts</h3><button id="refresh-security-admin" class="mini-refresh">Refresh</button></div><div id="security-alert-list">${(security.recentAlerts || []).length ? security.recentAlerts.map(securityAlertHtml).join('') : '<div class="an-empty">No security alerts. Protection systems are clear.</div>'}</div></section>
        <section class="panel audit-panel"><h3>Immutable-style audit trail</h3><div class="audit-log-list">${(security.recentLogs || []).length ? security.recentLogs.map(auditLogHtml).join('') : '<div class="an-empty">No audit events yet.</div>'}</div></section>
      </div>

      <div class="stat-row" style="margin-top:22px;">
        <div class="stat-card"><div class="pin"></div><div class="stat-num">${data.totalTeachers}</div><div class="stat-label">Teachers</div></div>
        <div class="stat-card"><div class="pin"></div><div class="stat-num">${data.totalStudents}</div><div class="stat-label">Students</div></div>
        <div class="stat-card"><div class="pin"></div><div class="stat-num">${data.totalAdmins}</div><div class="stat-label">Admins</div></div>
        <div class="stat-card"><div class="pin"></div><div class="stat-num">${data.totalResources}</div><div class="stat-label">Total resources</div></div>
      </div>
      <div class="phase3-summary-row" style="margin-top:16px;">
        <div class="phase3-summary-card motion-card"><span>Quizzes</span><strong>${data.totalQuizzes || 0}</strong><em>assessment sets</em></div>
        <div class="phase3-summary-card motion-card"><span>Attempts</span><strong>${data.totalAttempts || 0}</strong><em>auto-graded</em></div>
        <div class="phase3-summary-card motion-card"><span>Calendar events</span><strong>${data.totalLessonEvents || 0}</strong><em>teaching schedule</em></div>
        <div class="phase3-summary-card motion-card"><span>Platform resources</span><strong>${data.totalResources || 0}</strong><em>teacher content</em></div>
      </div>
      <div class="an-grid" style="margin-top:22px;"><div class="panel"><h3>By course</h3>${barsHtml(data.byCourse, 'var(--green)')}</div><div class="panel"><h3>By resource type</h3>${barsHtml(data.byType, 'var(--blue)')}</div></div>
      <div class="panel" style="margin-top:20px;"><h3>Most-generated topics (platform-wide)</h3>${barsHtml(data.topTopics, 'var(--gold-d)')}</div>`;

    document.getElementById('refresh-security-admin')?.addEventListener('click', renderAdmin);
    document.querySelectorAll('[data-alert-action]').forEach((button) => button.addEventListener('click', async () => {
      button.disabled = true;
      try { await updateSecurityAlert(button.dataset.alert, button.dataset.alertAction); showToast(`Alert ${button.dataset.alertAction}`, 'success'); await renderAdmin(); }
      catch (error) { showToast(error.message, 'error'); button.disabled = false; }
    }));
    if (window.runMotionEntrance) window.runMotionEntrance(el);
  } catch (err) {
    el.innerHTML = `<div class="an-empty">${escapeHtml(err.message || 'Could not load admin stats.')}</div>`;
  }
}
