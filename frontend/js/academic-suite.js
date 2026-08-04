let p8Loaded = false;
let p8Students = [];

function p8TodayPlus(days) {
  const d = new Date(Date.now() + days * 86400000);
  return d.toISOString().slice(0, 10);
}

function p8BlueprintRows() {
  return [...document.querySelectorAll('#p8-blueprint .blueprint-row')].map((row) => ({
    unit: row.querySelector('[data-bp="unit"]').value.trim(),
    marks: Number(row.querySelector('[data-bp="marks"]').value || 0),
    difficulty: row.querySelector('[data-bp="difficulty"]').value,
    topic: row.querySelector('[data-bp="topic"]').value.trim()
  })).filter((x) => x.unit && x.marks > 0);
}

function addP8BlueprintRow(data = {}) {
  const wrap = document.getElementById('p8-blueprint');
  if (!wrap) return;
  const row = document.createElement('div');
  row.className = 'blueprint-row motion-card';
  row.innerHTML = `
    <input data-bp="unit" value="${escapeHtml(data.unit || `Unit ${wrap.children.length + 1}`)}" placeholder="Unit">
    <input data-bp="topic" value="${escapeHtml(data.topic || '')}" placeholder="Unit topic">
    <input data-bp="marks" type="number" min="1" max="100" value="${Number(data.marks || 10)}">
    <select data-bp="difficulty"><option${data.difficulty === 'Easy' ? ' selected' : ''}>Easy</option><option${!data.difficulty || data.difficulty === 'Medium' ? ' selected' : ''}>Medium</option><option${data.difficulty === 'Advanced' ? ' selected' : ''}>Advanced</option></select>
    <button type="button" class="mini-danger" data-remove-blueprint>Remove</button>`;
  row.querySelector('[data-remove-blueprint]').addEventListener('click', () => { row.remove(); validateP8Blueprint(); });
  row.querySelectorAll('input,select').forEach((el) => el.addEventListener('input', validateP8Blueprint));
  wrap.appendChild(row);
  if (window.runMotionEntrance) window.runMotionEntrance(row);
}

async function validateP8Blueprint() {
  const status = document.getElementById('p8-blueprint-status');
  if (!status) return null;
  const totalMarks = Number(document.getElementById('p8-total-marks').value || 50);
  const blueprint = p8BlueprintRows();
  const allocated = blueprint.reduce((s, x) => s + x.marks, 0);
  status.classList.toggle('error', allocated !== totalMarks);
  status.textContent = allocated === totalMarks
    ? `✓ Blueprint valid: ${allocated}/${totalMarks} marks allocated.`
    : `Blueprint mismatch: ${allocated}/${totalMarks} marks allocated. Difference: ${totalMarks - allocated}.`;
  return { valid: allocated === totalMarks, totalMarks, allocatedMarks: allocated, rows: blueprint };
}

function p8SelectedQuestionTypes() {
  return [...document.querySelectorAll('#p8-question-types input:checked')].map((x) => x.value);
}

function p8List(items, formatter) {
  if (!Array.isArray(items) || !items.length) return '';
  return `<ul>${items.map((x, i) => `<li>${formatter ? formatter(x, i) : escapeHtml(String(x))}</li>`).join('')}</ul>`;
}

function p8Table(headers, rows) {
  return `<div class="phase78-table-wrap"><table class="phase78-table"><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function renderP8QuestionPaper(out) {
  const blueprint = p8Table(['Unit', 'Topic', 'Marks', 'Difficulty'], (out.blueprint || []).map((x) => [escapeHtml(x.unit), escapeHtml(x.topic || ''), Number(x.marks), escapeHtml(x.difficulty)]));
  const questions = p8Table(['Q.', 'Unit', 'Type', 'Marks', 'Difficulty', 'Question'], (out.questions || []).map((q) => [Number(q.number), escapeHtml(q.unit), escapeHtml(q.type), Number(q.marks), escapeHtml(q.difficulty), escapeHtml(q.prompt)]));
  const answers = (out.answerKey || []).map((a) => `<details><summary>Q${Number(a.number)} · ${Number(a.marks)} marks</summary><p>${escapeHtml(a.answer)}</p></details>`).join('');
  return `<div class="paper-header"><h2>${escapeHtml(out.title)}</h2><div>${escapeHtml(out.course || '')} · ${escapeHtml(out.subject || '')} · ${Number(out.durationMinutes)} minutes · ${Number(out.totalMarks)} marks</div></div><h3>Instructions</h3>${p8List(out.instructions)}<h3>Blueprint</h3>${blueprint}<h3>Question Paper</h3>${questions}<h3>Answer Key</h3><div class="answer-key-stack">${answers}</div>`;
}

function renderP8CoursePlanner(out) {
  const units = (out.units || []).map((u, i) => `<article class="phase78-section motion-card"><span>${String(i + 1).padStart(2, '0')}</span><div><h3>${escapeHtml(u.unit)}</h3><h4>Notes plan</h4>${p8List(u.notesPlan)}<h4>Assignment</h4><p>${escapeHtml(u.assignment || '')}</p><h4>Quiz</h4>${p8List(u.quiz)}<h4>Weekly sessions</h4>${p8Table(['Session', 'Focus', 'Activity'], (u.weeklyPlan || []).map((x) => [escapeHtml(String(x.session)), escapeHtml(x.focus), escapeHtml(x.activity)]))}<h4>Revision</h4><p>${escapeHtml(u.revisionPlan || '')}</p></div></article>`).join('');
  return `<h2>${escapeHtml(out.title)}</h2><div class="phase78-section-stack">${units}</div><h3>Semester Plan</h3>${p8Table(['Week', 'Unit', 'Focus'], (out.semesterPlan || []).map((x) => [Number(x.week), escapeHtml(x.unit), escapeHtml(x.focus)]))}<h3>Final Revision</h3>${p8List(out.finalRevision)}`;
}

function renderP8Rubric(out) {
  const rows = (out.criteria || []).map((c) => [escapeHtml(c.criterion), Number(c.marks), escapeHtml(c.levels?.excellent || ''), escapeHtml(c.levels?.good || ''), escapeHtml(c.levels?.developing || ''), escapeHtml(c.levels?.needsImprovement || '')]);
  return `<h2>${escapeHtml(out.title)}</h2><p class="paper-total">Total: ${Number(out.totalMarks)} marks</p>${p8Table(['Criterion', 'Marks', 'Excellent', 'Good', 'Developing', 'Needs Improvement'], rows)}<h3>Teacher Checklist</h3>${p8List(out.teacherChecklist)}`;
}

function renderP8Revision(out) {
  return `<h2>${escapeHtml(out.title)}</h2><p>Exam date: <b>${escapeHtml(out.examDate)}</b> · ${Number(out.daysAvailable)} days available</p>${p8Table(['Day', 'Date', 'Unit', 'Focus', 'Minutes', 'Tasks'], (out.schedule || []).map((x) => [Number(x.day), escapeHtml(x.date), escapeHtml(x.unit), escapeHtml(x.focus), Number(x.duration), p8List(x.tasks)]))}<h3>Exam Booster</h3>${p8List(out.examBooster)}`;
}

function renderP8CaseStudy(out) {
  return `<h2>${escapeHtml(out.title)}</h2><h3>Context</h3><p>${escapeHtml(out.context || '')}</p><h3>Scenario</h3><p>${escapeHtml(out.scenario || '')}</p><h3>Case Facts</h3>${p8List(out.facts)}<h3>Questions</h3>${p8Table(['Question', 'Marks'], (out.questions || []).map((x) => [escapeHtml(x.q), Number(x.marks)]))}<h3>Model Answer Guide</h3><p>${escapeHtml(out.modelAnswer || '')}</p><h3>Teacher Guide</h3>${p8List(out.teacherGuide)}`;
}

function renderP8Coding(out) {
  const labs = (out.labs || []).map((lab) => `<article class="coding-lab-card motion-card"><div class="lab-number">${Number(lab.number)}</div><h3>${escapeHtml(lab.title)}</h3><p>${escapeHtml(lab.problem)}</p><h4>Objectives</h4>${p8List(lab.objectives)}<h4>Algorithm</h4>${p8List(lab.algorithm)}<pre>${escapeHtml(lab.starterCode || '')}</pre><h4>Submission evidence</h4>${p8List(lab.expectedEvidence)}<h4>Viva</h4>${p8List(lab.viva)}</article>`).join('');
  return `<h2>${escapeHtml(out.title)}</h2><p>Language: <b>${escapeHtml(out.language)}</b> · Topic: <b>${escapeHtml(out.topic)}</b></p><div class="coding-lab-grid">${labs}</div><h3>Practical File Format</h3>${p8List(out.practicalFileFormat)}`;
}

function renderP8Output(result) {
  const box = document.getElementById('p8-output');
  const out = result?.output || result;
  if (!box || !out) return;
  let body = '';
  if (out.questions && out.blueprint) body = renderP8QuestionPaper(out);
  else if (out.units && out.semesterPlan) body = renderP8CoursePlanner(out);
  else if (out.criteria) body = renderP8Rubric(out);
  else if (out.schedule && out.examDate) body = renderP8Revision(out);
  else if (out.scenario) body = renderP8CaseStudy(out);
  else if (out.labs) body = renderP8Coding(out);
  else body = `<pre class="phase78-json">${escapeHtml(JSON.stringify(out, null, 2))}</pre>`;
  box.innerHTML = `<div class="phase78-output-head"><div><div class="panel-kicker">Phase 8 Output</div>${body}</div><span class="generation-chip">${escapeHtml(result.generationMode || 'generated')}</span></div>${result.warning ? `<div class="phase78-warning">${escapeHtml(result.warning)}</div>` : ''}`;
  if (window.runMotionEntrance) window.runMotionEntrance(box);
}

function p8Payload() {
  return {
    action: document.getElementById('p8-action').value,
    course: document.getElementById('p8-course').value,
    subject: document.getElementById('p8-subject').value,
    topic: document.getElementById('p8-topic').value,
    units: document.getElementById('p8-units').value,
    examType: document.getElementById('p8-exam-type').value,
    totalMarks: Number(document.getElementById('p8-total-marks').value || 50),
    durationMinutes: Number(document.getElementById('p8-duration').value || 90),
    questionTypes: p8SelectedQuestionTypes(),
    blueprint: p8BlueprintRows(),
    assignmentTitle: document.getElementById('p8-assignment-title').value,
    examDate: document.getElementById('p8-exam-date').value,
    dailyMinutes: Number(document.getElementById('p8-daily-minutes').value || 60),
    context: document.getElementById('p8-context').value,
    programmingLanguage: document.getElementById('p8-language').value,
    programCount: Number(document.getElementById('p8-program-count').value || 10)
  };
}

async function generateP8() {
  const payload = p8Payload();
  const button = document.getElementById('btn-p8-generate');
  const status = document.getElementById('p8-status');
  if (payload.action === 'question-paper') {
    const validation = await validateP8Blueprint();
    if (!validation.valid) { status.textContent = 'Fix the blueprint mark total before generating.'; return; }
  }
  button.disabled = true; status.textContent = 'Building constraint-checked academic output...';
  document.getElementById('p8-output').innerHTML = '<div class="phase78-loading"><i></i><i></i><i></i><span>Generating faculty-ready output</span></div>';
  try {
    const result = await apiP8Generate(payload);
    renderP8Output(result);
    status.textContent = `${result.generationMode} output ready. Verify questions, marks and institutional requirements.`;
  } catch (error) {
    status.textContent = error.message;
    if (error.data?.validation) document.getElementById('p8-blueprint-status').textContent = error.data.validation.message;
    document.getElementById('p8-output').innerHTML = `<div class="phase78-warning">${escapeHtml(error.message)}</div>`;
  } finally { button.disabled = false; }
}

function syncP8Fields() {
  const action = document.getElementById('p8-action').value;
  document.getElementById('p8-question-fields').style.display = action === 'question-paper' ? '' : 'none';
  document.getElementById('p8-assignment-title').closest('.field').style.opacity = action === 'rubric' ? '1' : '.55';
  document.getElementById('p8-exam-date').closest('.field').style.opacity = action === 'revision-plan' ? '1' : '.55';
  document.getElementById('p8-language').closest('.field').style.opacity = action === 'coding-lab' ? '1' : '.55';
  document.getElementById('p8-program-count').closest('.field').style.opacity = action === 'coding-lab' ? '1' : '.55';
}

async function loadP8Students() {
  try {
    const data = await apiP8Students();
    p8Students = data.students || [];
    const select = document.getElementById('p8-att-student');
    select.innerHTML = '<option value="">Select student</option>' + p8Students.map((s) => `<option value="${escapeHtml(s._id || s.id)}">${escapeHtml(s.name)} · ${escapeHtml(s.email)}</option>`).join('');
    const status = document.getElementById('p8-att-status-text');
    if (!p8Students.length) {
      status.textContent = 'No active student accounts found. Register an account with role Student and keep it active.';
    } else if (status.textContent.includes('No active student')) {
      status.textContent = '';
    }
  } catch (error) { document.getElementById('p8-att-status-text').textContent = error.message; }
}

function renderAttendance(records) {
  const box = document.getElementById('p8-attendance-list');
  if (!box) return;
  if (!records.length) { box.innerHTML = '<p class="empty-note">No attendance records yet.</p>'; return; }
  box.innerHTML = records.slice(0, 12).map((r) => `<article class="attendance-item ${escapeHtml(r.status)}"><div><b>${escapeHtml(r.student?.name || 'Student')}</b><span>${escapeHtml(r.topic || r.subject || 'Lesson')} · ${new Date(r.lessonDate).toLocaleDateString()}</span></div><strong>${escapeHtml(r.status)}</strong>${r.reminder?.message ? `<p>${escapeHtml(r.reminder.message)}</p>${p8List(r.reminder.suggestedActions)}` : ''}</article>`).join('');
}

async function loadAttendance() {
  try { renderAttendance((await apiP8AttendanceList()).records || []); }
  catch (error) { document.getElementById('p8-attendance-list').innerHTML = `<p class="empty-note">${escapeHtml(error.message)}</p>`; }
}

async function recordAttendance() {
  const status = document.getElementById('p8-att-status-text');
  const studentId = document.getElementById('p8-att-student').value;
  if (!studentId) { status.textContent = 'Select a student first.'; return; }
  const payload = {
    studentId,
    course: document.getElementById('p8-course').value,
    subject: document.getElementById('p8-subject').value,
    topic: document.getElementById('p8-att-topic').value,
    lessonDate: document.getElementById('p8-att-date').value,
    status: document.getElementById('p8-att-status').value,
    notes: document.getElementById('p8-att-notes').value
  };
  status.textContent = 'Recording attendance and building reminder...';
  try {
    const data = await apiP8Attendance(payload);
    status.textContent = data.record.status === 'absent' ? 'Absent record saved. Catch-up reminder generated.' : 'Attendance record saved.';
    await loadAttendance();
  } catch (error) { status.textContent = error.message; }
}

async function renderAcademic() {
  if (!p8Loaded) {
    p8Loaded = true;
    document.getElementById('p8-exam-date').value = p8TodayPlus(21);
    document.getElementById('p8-att-date').value = p8TodayPlus(0);
    addP8BlueprintRow({ unit: 'Unit 1', topic: 'Statistical Concepts and ML Introduction', marks: 20, difficulty: 'Easy' });
    addP8BlueprintRow({ unit: 'Unit 2', topic: 'Exploratory Data Analysis', marks: 15, difficulty: 'Medium' });
    addP8BlueprintRow({ unit: 'Unit 3', topic: 'Supervised Learning', marks: 15, difficulty: 'Advanced' });
    document.getElementById('btn-p8-add-unit').addEventListener('click', () => addP8BlueprintRow());
    document.getElementById('p8-total-marks').addEventListener('input', validateP8Blueprint);
    document.getElementById('p8-action').addEventListener('change', syncP8Fields);
    document.getElementById('btn-p8-generate').addEventListener('click', generateP8);
    document.getElementById('btn-p8-attendance').addEventListener('click', recordAttendance);
    await Promise.all([loadP8Students(), loadAttendance()]);
    syncP8Fields();
    validateP8Blueprint();
  }
}
