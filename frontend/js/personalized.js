let p7Loaded = false;
let p7Students = [];

function p7CurrentUser() { return getCurrentUser() || {}; }

function p7ResourceOptions() {
  const select = document.getElementById('p7-resource');
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">Use topic only</option>' + resources.map((r) => `<option value="${escapeHtml(r._id || r.id)}">${escapeHtml(r.type)} · ${escapeHtml(r.subject)} · ${escapeHtml(r.topic)}</option>`).join('');
  if ([...select.options].some((o) => o.value === current)) select.value = current;
}

function p7ActionLabel(action) {
  return ({
    'lesson-personalization': 'AI Lesson Plan Personalization', 'adaptive-notes': 'Adaptive Notes Generator',
    feedback: 'AI Feedback on Generated Content', 'difficulty-converter': 'Difficulty Converter',
    eli5: 'Explain Like I’m 5 Mode', 'exam-booster': 'Exam Booster Mode', summary: 'AI Auto Summary', flashcards: 'Flashcard Generator'
  })[action] || action;
}

function p7Metric(label, value, suffix = '') {
  return `<div class="phase78-metric"><span>${escapeHtml(label)}</span><b>${escapeHtml(String(value))}${suffix}</b></div>`;
}

function renderP7Profile(data) {
  const box = document.getElementById('p7-profile-output');
  const p = data?.profile;
  if (!box || !p) return;
  const weakTopics = (p.weakTopics || []).map((x) => `<li><b>${escapeHtml(x.label)}</b><span>${Number(x.score || 0)}%</span></li>`).join('') || '<li>No weak topic identified yet.</li>';
  const recs = (p.recommendations || []).map((x) => `<li>${escapeHtml(x)}</li>`).join('');
  box.innerHTML = `
    <div class="learning-level-orbit level-${String(p.level).toLowerCase().replaceAll(' ', '-')}"><span>${escapeHtml(p.level)}</span><small>Detected level</small></div>
    <div class="phase78-metric-row">${p7Metric('Average', p.averageScore, '%')}${p7Metric('Recent', p.recentAverage, '%')}${p7Metric('Attempts', p.totalAttempts)}${p7Metric('Pass rate', p.passRate, '%')}</div>
    <div class="phase78-mini-grid"><div><h4>Weak topics</h4><ul class="rank-list">${weakTopics}</ul></div><div><h4>Recommended mode</h4><p>${escapeHtml(p.recommendedNotesMode || '')}</p><ul>${recs}</ul></div></div>`;
  if (window.runMotionEntrance) window.runMotionEntrance(box);
}

function renderP7Output(result) {
  const box = document.getElementById('p7-output');
  const output = result?.output || result;
  if (!box || !output) return;
  const sections = (output.sections || []).map((s, i) => `<article class="phase78-section motion-card" style="--delay:${i * 55}ms"><span>${String(i + 1).padStart(2, '0')}</span><div><h3>${escapeHtml(s.heading || s.title || 'Section')}</h3><p>${escapeHtml(s.body || s.description || '')}</p></div></article>`).join('');
  const cards = (output.flashcards || []).map((c, i) => `<button class="flashcard motion-card" data-flash="${i}"><span class="flash-front"><small>Front</small>${escapeHtml(c.front)}</span><span class="flash-back"><small>Back</small>${escapeHtml(c.back)}</span></button>`).join('');
  const suggestions = (output.suggestions || []).map((x) => `<li>${escapeHtml(x)}</li>`).join('');
  const quality = output.quality ? `<div class="phase78-metric-row">${Object.entries(output.quality).map(([k, v]) => p7Metric(k.replace(/([A-Z])/g, ' $1'), v, '%')).join('')}</div>` : '';
  box.innerHTML = `<div class="phase78-output-head"><div><div class="panel-kicker">${escapeHtml(p7ActionLabel(output.action || ''))}</div><h2>${escapeHtml(output.title || 'Personalized output')}</h2><p>${escapeHtml(output.summary || '')}</p></div><span class="generation-chip">${escapeHtml(result.generationMode || 'generated')}</span></div>${result.warning ? `<div class="phase78-warning">${escapeHtml(result.warning)}</div>` : ''}${quality}<div class="phase78-section-stack">${sections}</div>${cards ? `<div class="phase78-flash-grid">${cards}</div>` : ''}${suggestions ? `<div class="phase78-suggestions"><h3>Teacher suggestions</h3><ul>${suggestions}</ul></div>` : ''}`;
  box.querySelectorAll('.flashcard').forEach((card) => card.addEventListener('click', () => card.classList.toggle('flipped')));
  if (window.runMotionEntrance) window.runMotionEntrance(box);
}

async function loadP7Students() {
  if (p7CurrentUser().role === 'student') return;
  try {
    const data = await apiP7Students();
    p7Students = data.students || [];
    const selects = [document.getElementById('p7-student-select')].filter(Boolean);
    selects.forEach((select) => { select.innerHTML = '<option value="">Select a student with quiz attempts</option>' + p7Students.map((s) => `<option value="${escapeHtml(s._id || s.id)}">${escapeHtml(s.name)} · ${escapeHtml(s.email)}</option>`).join(''); });
  } catch (error) {
    document.getElementById('p7-profile-output').innerHTML = `<p class="empty-note">${escapeHtml(error.message)}</p>`;
  }
}

async function refreshP7Profile() {
  const user = p7CurrentUser();
  const studentId = user.role === 'student' ? '' : document.getElementById('p7-student-select')?.value;
  if (user.role !== 'student' && !studentId) {
    document.getElementById('p7-profile-output').innerHTML = '<p class="empty-note">Select a student first.</p>';
    return;
  }
  const button = document.getElementById('btn-p7-profile');
  button.disabled = true; button.textContent = 'Analysing quiz performance...';
  try { renderP7Profile(await apiP7RefreshProfile(studentId)); }
  catch (error) { document.getElementById('p7-profile-output').innerHTML = `<p class="empty-note">${escapeHtml(error.message)}</p>`; }
  finally { button.disabled = false; button.textContent = 'Refresh learning profile'; }
}

async function generateP7() {
  const button = document.getElementById('btn-p7-generate');
  const status = document.getElementById('p7-status');
  const user = p7CurrentUser();
  const payload = {
    action: document.getElementById('p7-action').value,
    resourceId: document.getElementById('p7-resource').value || undefined,
    studentId: user.role === 'student' ? undefined : document.getElementById('p7-student-select')?.value || undefined,
    course: document.getElementById('p7-course').value,
    subject: document.getElementById('p7-subject').value,
    topic: document.getElementById('p7-topic').value,
    classPerformance: document.getElementById('p7-performance').value,
    teachingStyle: document.getElementById('p7-style').value,
    language: document.getElementById('p7-language').value,
    notesMode: document.getElementById('p7-notes-mode').value,
    targetMode: document.getElementById('p7-target-mode').value
  };
  button.disabled = true; status.textContent = 'Personalizing content using learning context and teacher preferences...';
  document.getElementById('p7-output').innerHTML = '<div class="phase78-loading"><i></i><i></i><i></i><span>Building adaptive output</span></div>';
  try {
    const result = await apiP7Generate(payload);
    renderP7Output(result);
    status.textContent = `${result.generationMode === 'ai' ? 'AI' : 'Fallback'} output ready. Teacher review required.`;
  } catch (error) {
    status.textContent = error.message;
    document.getElementById('p7-output').innerHTML = `<div class="phase78-warning">${escapeHtml(error.message)}</div>`;
  } finally { button.disabled = false; }
}

function p7SyncResource() {
  const id = document.getElementById('p7-resource').value;
  const resource = resources.find((r) => String(r._id || r.id) === String(id));
  if (!resource) return;
  document.getElementById('p7-course').value = resource.course || '';
  document.getElementById('p7-subject').value = resource.subject || '';
  document.getElementById('p7-topic').value = resource.topic || '';
}

async function renderPersonalized() {
  const user = p7CurrentUser();
  document.querySelectorAll('.phase78-teacher-only').forEach((el) => { el.style.display = user.role === 'student' ? 'none' : ''; });
  const genPanel = document.getElementById('btn-p7-generate')?.closest('.phase78-panel');
  if (genPanel) genPanel.style.display = user.role === 'student' ? 'none' : '';
  p7ResourceOptions();
  if (!p7Loaded) {
    p7Loaded = true;
    document.getElementById('btn-p7-profile')?.addEventListener('click', refreshP7Profile);
    document.getElementById('btn-p7-generate')?.addEventListener('click', generateP7);
    document.getElementById('p7-resource')?.addEventListener('change', p7SyncResource);
    await loadP7Students();
    if (user.role === 'student') refreshP7Profile();
  }
}
