let phase3Quizzes = [];
let activeQuizAttempt = null;
let quizTimerHandle = null;
let quizHeartbeatHandle = null;
let quizAutosaveHandle = null;
let proctoringSession = null;
let integrityEventLock = false;
const integrityDebounce = new Map();

function phase3Role() {
  return getCurrentUser()?.role || 'student';
}


function defaultQuizPolicy(quiz) {
  return {
    enabled: true, requireCamera: true, requireFullscreen: true, autoCancel: true,
    maxTabSwitches: 0, maxFullscreenExits: 0, maxCameraInterruptions: 1,
    blockClipboard: true, blockContextMenu: true, blockKeyboardShortcuts: true,
    detectCameraObstruction: true, detectFacePresence: true, requireSecureBrowser: true,
    cameraGraceSeconds: 15, cancelOnFaceMissing: true, faceAbsenceGraceSeconds: 2, requireFaceDetector: true,
    requireIdentityVerification: false, requireLivenessCheck: true, autoCancelOnIdentityMismatch: true,
    identityMatchThreshold: 0.55, identityMismatchLimit: 2, identityRecheckMinSeconds: 15, identityRecheckMaxSeconds: 35, livenessThreshold: 0.4, ...(quiz?.integrityPolicy || {})
  };
}

function readQuizIntegrityPolicy() {
  const enabled = document.getElementById('quiz-secure-enabled')?.checked !== false;
  return {
    enabled,
    requireCamera: enabled && Boolean(document.getElementById('quiz-require-camera')?.checked),
    requireFullscreen: enabled && Boolean(document.getElementById('quiz-require-fullscreen')?.checked),
    autoCancel: enabled && Boolean(document.getElementById('quiz-auto-cancel')?.checked),
    maxTabSwitches: Number(document.getElementById('quiz-max-tabs')?.value || 0),
    maxFullscreenExits: Number(document.getElementById('quiz-max-fullscreen')?.value || 0),
    maxCameraInterruptions: Number(document.getElementById('quiz-max-camera')?.value || 1),
    blockClipboard: enabled && Boolean(document.getElementById('quiz-block-clipboard')?.checked),
    blockContextMenu: enabled && Boolean(document.getElementById('quiz-block-context')?.checked),
    blockKeyboardShortcuts: enabled && Boolean(document.getElementById('quiz-block-shortcuts')?.checked),
    detectCameraObstruction: enabled && Boolean(document.getElementById('quiz-detect-obstruction')?.checked),
    detectFacePresence: enabled && Boolean(document.getElementById('quiz-detect-face')?.checked),
    requireSecureBrowser: enabled && Boolean(document.getElementById('quiz-secure-browser')?.checked),
    cameraGraceSeconds: 15,
    cancelOnFaceMissing: enabled && Boolean(document.getElementById('quiz-cancel-face-missing')?.checked),
    faceAbsenceGraceSeconds: Number(document.getElementById('quiz-face-grace')?.value || 2),
    requireFaceDetector: enabled && Boolean(document.getElementById('quiz-detect-face')?.checked),
    requireIdentityVerification: enabled && Boolean(document.getElementById('quiz-require-identity')?.checked),
    requireLivenessCheck: enabled && Boolean(document.getElementById('quiz-require-liveness')?.checked),
    autoCancelOnIdentityMismatch: enabled && Boolean(document.getElementById('quiz-cancel-identity-mismatch')?.checked),
    identityMatchThreshold: Number(document.getElementById('quiz-identity-threshold')?.value || 0.55),
    identityMismatchLimit: Number(document.getElementById('quiz-identity-mismatch-limit')?.value || 2),
    identityRecheckMinSeconds: Number(document.getElementById('quiz-identity-recheck-min')?.value || 15),
    identityRecheckMaxSeconds: Number(document.getElementById('quiz-identity-recheck-max')?.value || 35),
    livenessThreshold: 0.4
  };
}

function stopProctoringSession({ exitFullscreen = true } = {}) {
  clearInterval(quizHeartbeatHandle);
  clearTimeout(quizAutosaveHandle);
  quizHeartbeatHandle = null;
  quizAutosaveHandle = null;
  if (!proctoringSession) {
    if (exitFullscreen && document.fullscreenElement) document.exitFullscreen().catch(() => {});
    return;
  }
  (proctoringSession.cleanup || []).forEach((fn) => { try { fn(); } catch (_) {} });
  clearInterval(proctoringSession.cameraHealthTimer);
  clearInterval(proctoringSession.faceTimer);
  clearInterval(proctoringSession.faceCountdownTimer);
  clearTimeout(proctoringSession.identityTimer);
  if (proctoringSession.stream) proctoringSession.stream.getTracks().forEach((track) => track.stop());
  proctoringSession = null;
  integrityDebounce.clear();
  if (exitFullscreen && document.fullscreenElement) document.exitFullscreen().catch(() => {});
}

function secureDeviceId() {
  const key = 'trh:secure-device-id';
  let value = localStorage.getItem(key);
  if (!value) {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    value = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(key, value);
  }
  return value;
}

function secureDeviceFingerprint() {
  return [secureDeviceId(), navigator.userAgent, navigator.platform || '', screen.width, screen.height, Intl.DateTimeFormat().resolvedOptions().timeZone || ''].join('|');
}

function clientSecurityContext() {
  return {
    deviceFingerprint: secureDeviceFingerprint(),
    userAgent: navigator.userAgent.slice(0, 500),
    platform: navigator.platform || '',
    language: navigator.language || '',
    screen: `${screen.width}x${screen.height}`,
    viewport: `${innerWidth}x${innerHeight}`,
    secureContext: window.isSecureContext,
    topLevel: window.top === window.self,
    webdriver: Boolean(navigator.webdriver)
  };
}

function formatDurationSeconds(seconds) {
  const total = Math.max(0, Number(seconds || 0));
  const mins = Math.floor(total / 60);
  const secs = Math.floor(total % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function populateQuizResourceSelect() {
  const select = document.getElementById('quiz-resource-select');
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">Select a saved resource</option>' + resources.map((r) =>
    `<option value="${r._id}">${escapeHtml(r.course || '')} · ${escapeHtml(r.subject || '')} · ${escapeHtml(r.topic || '')} (${escapeHtml(r.type || '')})</option>`
  ).join('');
  if ([...select.options].some((o) => o.value === current)) select.value = current;
}

function quizSummaryHtml(quizzes) {
  const role = phase3Role();
  const total = quizzes.length;
  const published = quizzes.filter((q) => q.published).length;
  const attempts = quizzes.reduce((sum, q) => sum + Number(role === 'student' ? q.attemptSummary?.attempts || 0 : q.stats?.attempts || 0), 0);
  const bestOrAverage = role === 'student'
    ? quizzes.map((q) => q.attemptSummary?.bestPercentage).filter((x) => Number.isFinite(Number(x)))
    : quizzes.map((q) => q.stats?.averageScore).filter((x) => Number.isFinite(Number(x)));
  const metric = bestOrAverage.length ? Math.round(bestOrAverage.reduce((a, b) => a + Number(b), 0) / bestOrAverage.length) : 0;
  return [
    ['Quizzes', total, 'assessment sets'],
    [role === 'student' ? 'Available' : 'Published', published, 'live for students'],
    ['Attempts', attempts, role === 'student' ? 'your submissions' : 'student submissions'],
    [role === 'student' ? 'Average best' : 'Average score', `${metric}%`, 'performance']
  ].map(([label, value, note], index) => `
    <div class="phase3-summary-card motion-card" style="--delay:${index * 60}ms"><span>${label}</span><strong>${value}</strong><em>${note}</em></div>`).join('');
}

function teacherQuizCard(quiz, index) {
  const stats = quiz.stats || {};
  return `
    <article class="quiz-card motion-card" data-quiz-card="${quiz.id}" style="--delay:${index * 55}ms">
      <div class="quiz-card-top">
        <div><span class="quiz-status ${quiz.published ? 'published' : 'draft'}">${quiz.published ? 'Published' : 'Draft'}</span><span class="quiz-difficulty">${escapeHtml(quiz.difficulty)}</span>${quiz.integrityPolicy?.enabled !== false ? '<span class="quiz-secure-badge">Camera secure</span>' : ''}${quiz.integrityPolicy?.requireIdentityVerification ? '<span class="quiz-identity-badge">Identity locked</span>' : ''}</div>
        <strong>${quiz.questionCount} Q · ${quiz.totalMarks} marks</strong>
      </div>
      <h3>${escapeHtml(quiz.title)}</h3>
      <p>${escapeHtml(quiz.course)} · ${escapeHtml(quiz.subject)} · ${escapeHtml(quiz.topic)}</p>
      <div class="quiz-mini-stats"><span><b>${Number(stats.attempts || 0)}</b> attempts</span><span><b>${Number(stats.uniqueStudents || 0)}</b> students</span><span><b>${Math.round(Number(stats.averageScore || 0))}%</b> average</span></div>
      <div class="quiz-card-actions">
        <button data-quiz-publish="${quiz.id}" class="act-btn ${quiz.published ? 'saved' : 'primary'}">${quiz.published ? 'Unpublish' : 'Publish'}</button>
        <button data-quiz-attempts="${quiz.id}" class="act-btn">View attempts</button>
        <button data-quiz-delete="${quiz.id}" class="mini-danger">Delete</button>
      </div>
    </article>`;
}

function studentQuizCard(quiz, index) {
  const summary = quiz.attemptSummary || {};
  const attempts = Number(summary.attempts || 0);
  const maxed = attempts >= Number(quiz.maxAttempts || 3);
  return `
    <article class="quiz-card student-quiz-card motion-card" data-quiz-card="${quiz.id}" style="--delay:${index * 55}ms">
      <div class="quiz-card-top"><div><span class="quiz-status published">Available</span><span class="quiz-difficulty">${escapeHtml(quiz.difficulty)}</span>${quiz.integrityPolicy?.enabled !== false ? '<span class="quiz-secure-badge">Proctored</span>' : ''}${quiz.integrityPolicy?.requireIdentityVerification ? '<span class="quiz-identity-badge">Identity match</span>' : ''}</div><strong>${quiz.durationMinutes} min</strong></div>
      <h3>${escapeHtml(quiz.title)}</h3>
      <p>${escapeHtml(quiz.course)} · ${escapeHtml(quiz.subject)} · ${escapeHtml(quiz.topic)}</p>
      <div class="quiz-mini-stats"><span><b>${quiz.questionCount}</b> questions</span><span><b>${quiz.totalMarks}</b> marks</span><span><b>${quiz.passPercentage}%</b> pass</span></div>
      <div class="student-attempt-meta"><span>Attempts ${attempts}/${quiz.maxAttempts}</span>${summary.bestPercentage !== null && summary.bestPercentage !== undefined ? `<span>Best ${Math.round(summary.bestPercentage)}%</span>` : '<span>Not attempted</span>'}</div>
      <button data-quiz-start="${quiz.id}" class="gen-btn quiz-start-btn" ${maxed ? 'disabled' : ''}>${maxed ? 'Attempt limit reached' : attempts ? 'Attempt again' : 'Start quiz'}</button>
    </article>`;
}

function wireQuizCards() {
  document.querySelectorAll('[data-quiz-publish]').forEach((button) => button.addEventListener('click', async () => {
    const quiz = phase3Quizzes.find((q) => q.id === button.dataset.quizPublish);
    if (!quiz) return;
    button.disabled = true;
    try {
      const data = await apiUpdateQuiz(quiz.id, { published: !quiz.published });
      Object.assign(quiz, data.quiz);
      showToast(quiz.published ? 'Quiz published for students' : 'Quiz unpublished', 'success');
      renderQuizList();
    } catch (err) { showToast(err.message, 'error'); } finally { button.disabled = false; }
  }));

  document.querySelectorAll('[data-quiz-delete]').forEach((button) => button.addEventListener('click', async () => {
    if (!confirm('Delete this quiz and all its attempts?')) return;
    try {
      await apiDeleteQuiz(button.dataset.quizDelete);
      phase3Quizzes = phase3Quizzes.filter((q) => q.id !== button.dataset.quizDelete);
      showToast('Quiz deleted', 'success');
      renderQuizList();
    } catch (err) { showToast(err.message, 'error'); }
  }));

  document.querySelectorAll('[data-quiz-attempts]').forEach((button) => button.addEventListener('click', () => showQuizAttempts(button.dataset.quizAttempts)));
  document.querySelectorAll('[data-quiz-start]').forEach((button) => button.addEventListener('click', () => startStudentQuiz(button.dataset.quizStart)));
}

function renderQuizList() {
  const list = document.getElementById('quiz-list');
  const summary = document.getElementById('quiz-summary-row');
  if (!list || !summary) return;
  summary.innerHTML = quizSummaryHtml(phase3Quizzes);
  const role = phase3Role();
  if (!phase3Quizzes.length) {
    list.innerHTML = `<div class="phase3-empty"><span>?</span><b>${role === 'student' ? 'No published quizzes yet' : 'No quizzes created yet'}</b><p>${role === 'student' ? 'Your teacher will publish assessments here.' : 'Generate a quiz from a saved resource above.'}</p></div>`;
    return;
  }
  list.innerHTML = phase3Quizzes.map((q, i) => role === 'student' ? studentQuizCard(q, i) : teacherQuizCard(q, i)).join('');
  wireQuizCards();
  if (window.runMotionEntrance) window.runMotionEntrance(list);
}

async function renderQuizzes() {
  const role = phase3Role();
  const teacherPanel = document.getElementById('quiz-teacher-panel');
  if (teacherPanel) teacherPanel.style.display = role === 'student' ? 'none' : '';
  document.getElementById('quiz-view-title').textContent = role === 'student' ? 'Student Quiz Center' : 'Quiz Studio';
  document.getElementById('quiz-view-subtitle').textContent = role === 'student'
    ? 'Attempt published quizzes, receive instant grading and track your progress.'
    : 'Generate, publish and analyze outcome-aligned assessments.';
  document.getElementById('quiz-list-heading').textContent = role === 'student' ? 'Published quizzes' : 'Your quizzes';
  populateQuizResourceSelect();
  const list = document.getElementById('quiz-list');
  if (list) list.innerHTML = '<div class="phase3-loading"><i></i><span>Loading quizzes...</span></div>';
  try {
    const data = await apiLoadQuizzes();
    phase3Quizzes = data.quizzes || [];
    renderQuizList();
    if (window.renderIdentityCenter) window.renderIdentityCenter();
  } catch (err) {
    if (list) list.innerHTML = `<div class="phase3-empty error"><b>Could not load quizzes</b><p>${escapeHtml(err.message)}</p></div>`;
  }
}

async function generateQuizFromResource() {
  const button = document.getElementById('btn-generate-quiz');
  const status = document.getElementById('quiz-generation-status');
  const resourceId = document.getElementById('quiz-resource-select').value;
  if (!resourceId) return showToast('Select a saved resource first.', 'error');
  button.disabled = true;
  button.classList.add('generating');
  status.innerHTML = '<span class="status-pulse"></span> Designing questions, distractors, answer keys and Bloom mappings...';
  try {
    const data = await apiGenerateQuiz({
      resourceId,
      title: document.getElementById('quiz-title-input').value.trim(),
      questionCount: Number(document.getElementById('quiz-question-count').value),
      durationMinutes: Number(document.getElementById('quiz-duration').value),
      difficulty: document.getElementById('quiz-difficulty').value,
      published: document.getElementById('quiz-publish-now').checked,
      integrityPolicy: readQuizIntegrityPolicy()
    });
    phase3Quizzes.unshift(data.quiz);
    status.textContent = data.generationMode === 'fallback' ? 'Quiz created using reliable resource-based fallback.' : 'AI quiz generated successfully.';
    if (data.warning) showToast(data.warning, 'info');
    else showToast('Auto-graded quiz created', 'success');
    renderQuizList();
    if (window.renderIdentityCenter) window.renderIdentityCenter();
  } catch (err) {
    status.textContent = err.message;
    showToast(err.message, 'error');
  } finally {
    button.disabled = false;
    button.classList.remove('generating');
  }
}

async function showQuizAttempts(quizId) {
  const quiz = phase3Quizzes.find((q) => q.id === quizId);
  modalBackdrop.classList.add('open');
  modalBox.innerHTML = '<button class="modal-close" data-role="modal-close">X</button><div class="phase3-loading"><i></i><span>Loading attempts...</span></div>';
  modalBox.querySelector('[data-role="modal-close"]').addEventListener('click', closeModal);
  try {
    const data = await apiQuizAttempts(quizId);
    const attempts = data.attempts || [];
    modalBox.innerHTML = `<button class="modal-close" data-role="modal-close">X</button>
      <div class="attempt-modal"><div class="panel-kicker">Quiz Attempts</div><h2>${escapeHtml(quiz?.title || 'Quiz')}</h2>
      ${attempts.length ? `<div class="attempt-table"><div class="attempt-table-head secure-attempt-head"><span>Student</span><span>Attempt</span><span>Score</span><span>Time</span><span>Status</span><span>Integrity</span></div>${attempts.map((a) => `<div class="attempt-table-row secure-attempt-row"><span><b>${escapeHtml(a.student?.name || 'Student')}</b><small>${escapeHtml(a.student?.email || '')}</small></span><span>#${a.attemptNumber}</span><span>${Math.round(a.percentage || 0)}%</span><span>${formatDurationSeconds(a.durationSeconds)}</span><span class="${a.status === 'cancelled' ? 'cancelled' : a.passed ? 'passed' : 'failed'}">${a.status === 'cancelled' ? 'Cancelled' : a.passed ? 'Passed' : 'Needs support'}</span><span class="integrity-cell ${escapeHtml(a.integrityStatus || 'clear')}"><b>${escapeHtml(a.integrityStatus || 'clear')}</b><small>Risk ${Number(a.integrityRiskScore || 0)} · Tabs ${Number(a.integrityCounters?.tabSwitches || 0)} · Camera ${Number(a.integrityCounters?.cameraInterruptions || 0)} · ID ${Number(a.integrityCounters?.identityMismatches || 0)}${a.identityVerified ? ` · Match ${Math.round(Number(a.lastIdentityScore || a.initialIdentityScore || 0) * 100)}%` : ''}</small>${a.cancellationReason ? `<em>${escapeHtml(a.cancellationReason)}</em>` : ''}</span></div>`).join('')}</div>` : '<div class="phase3-empty"><b>No attempts yet</b><p>Publish the quiz and wait for student submissions.</p></div>'}
      </div>`;
    modalBox.querySelector('[data-role="modal-close"]').addEventListener('click', closeModal);
    if (window.runMotionEntrance) window.runMotionEntrance(modalBox);
  } catch (err) {
    modalBox.innerHTML = `<button class="modal-close" data-role="modal-close">X</button><div class="phase3-empty error"><b>Could not load attempts</b><p>${escapeHtml(err.message)}</p></div>`;
    modalBox.querySelector('[data-role="modal-close"]').addEventListener('click', closeModal);
  }
}

function quizQuestionHtml(question, index) {
  const name = `quiz-q-${question.id}`;
  let input = '';
  if (question.type === 'short') {
    input = `<textarea data-quiz-answer="${question.id}" rows="3" placeholder="Write a concise answer"></textarea>`;
  } else {
    input = (question.options || []).map((option, optionIndex) => `<label class="quiz-option"><input type="radio" name="${name}" value="${escapeHtml(option)}" data-quiz-answer="${question.id}"><span>${String.fromCharCode(65 + optionIndex)}</span><b>${escapeHtml(option)}</b></label>`).join('');
  }
  return `<article class="attempt-question motion-card" data-question-id="${question.id}" style="--delay:${index * 45}ms"><div class="question-number">${index + 1}</div><div class="question-content"><div class="question-tags"><span>${escapeHtml(question.bloomLevel || 'Bloom')}</span>${question.courseOutcome ? `<span>${escapeHtml(question.courseOutcome)}</span>` : ''}<em>${question.marks} mark${question.marks === 1 ? '' : 's'}</em></div><h3>${escapeHtml(question.prompt)}</h3><div class="quiz-answer-area">${input}</div></div></article>`;
}

async function startStudentQuiz(quizId) {
  const quiz = phase3Quizzes.find((item) => item.id === quizId);
  const stage = document.getElementById('quiz-attempt-stage');
  if (!quiz) return;
  stopProctoringSession();
  const policy = defaultQuizPolicy(quiz);
  stage.innerHTML = secureSetupHtml(quiz, policy);
  stage.scrollIntoView({ behavior: 'smooth', block: 'start' });
  wireSecureSetup(quiz, policy);
  if (window.runMotionEntrance) window.runMotionEntrance(stage);
}

function secureSetupHtml(quiz, policy) {
  const checks = [
    [policy.requireCamera, 'Camera remains active during the attempt'],
    [policy.requireFullscreen, 'Quiz remains in fullscreen secure mode'],
    [policy.maxTabSwitches === 0, 'Leaving this tab can cancel the attempt'],
    [policy.blockClipboard, 'Copy, cut and paste are blocked'],
    [policy.detectCameraObstruction, 'Covered or unusually dark camera feed is flagged'],
    [policy.detectFacePresence, `Face must remain visible; absence beyond ${Number(policy.faceAbsenceGraceSeconds || 2)} seconds cancels the attempt`],
    [policy.requireIdentityVerification, 'Live face must match the teacher-approved student identity before and during the quiz'],
    [policy.requireLivenessCheck && policy.requireIdentityVerification, 'Local anti-spoof and liveness checks must pass']
  ].filter(([enabled]) => enabled).map(([, text]) => `<li><i>✓</i>${text}</li>`).join('');
  return `<div class="secure-setup-shell motion-card">
    <div class="secure-setup-head"><div><span class="secure-lock">PROCTORED</span><h2>${escapeHtml(quiz.title)}</h2><p>${escapeHtml(quiz.subject)} · ${quiz.durationMinutes} min · ${quiz.questionCount} questions</p></div><div class="secure-shield"><i></i><b>Secure</b></div></div>
    <div class="secure-setup-grid">
      <div class="camera-setup-card"><video id="secure-camera-preview" playsinline muted></video><div id="secure-camera-placeholder"><span>CAM</span><b>Camera not enabled</b><small>No video is uploaded or recorded.</small></div><div id="camera-health-pill" class="camera-health-pill">Waiting for permission</div></div>
      <div class="secure-policy-card"><h3>Before you begin</h3><ul>${checks}</ul><div class="browser-limit-note"><b>Browser extension limitation</b><span>A normal website cannot list or disable installed extensions. This secure mode instead blocks clipboard/shortcuts, prevents embedding, monitors focus/fullscreen and records integrity events. Use a managed kiosk browser for high-stakes exams.</span></div></div>
    </div>
    <label class="integrity-consent"><input id="integrity-consent" type="checkbox"><span>I consent to local camera-based continuity checks and integrity event logging for this quiz. I understand that severe policy violations may automatically cancel the attempt.</span></label>
    <div class="secure-setup-actions"><button id="btn-enable-camera" class="act-btn">${policy.requireCamera ? '1. Enable camera' : 'Camera not required'}</button><button id="btn-begin-secure-quiz" class="gen-btn" disabled>2. Enter secure mode &amp; start</button></div>
    <div id="identity-setup-state" class="identity-setup-state">${policy.requireIdentityVerification ? 'Checking verified identity enrollment…' : 'Identity lock not required for this quiz'}</div><div id="secure-setup-status" class="phase3-status">Complete the required checks to start.</div>
  </div>`;
}


let strictFaceEnginePromise = null;

async function loadStrictFaceEngine() {
  if (strictFaceEnginePromise) return strictFaceEnginePromise;
  strictFaceEnginePromise = (async () => {
    if (window.getSecureIdentityEngine) return window.getSecureIdentityEngine();
    throw new Error('The local face identity engine is unavailable. Reload the page.');
  })().catch((error) => { strictFaceEnginePromise = null; throw error; });
  return strictFaceEnginePromise;
}

async function detectFacesLocal(engine, video) {
  if (!engine) return [];
  if (typeof engine.detectFrame === 'function') {
    const result = await engine.detectFrame(video, { full: false });
    engine.lastResult = result;
    return result?.face || [];
  }
  if (typeof engine.detect === 'function') return engine.detect(video);
  return [];
}

async function verifyInitialFace(video, status, policy) {
  if (!policy.detectFacePresence && !policy.requireIdentityVerification) return null;
  status.textContent = policy.requireIdentityVerification ? 'Loading local face recognition and liveness models…' : 'Loading local face detector…';
  const engine = await loadStrictFaceEngine();
  let lastCount = 0;
  for (let attempt = 0; attempt < 7; attempt += 1) {
    const result = policy.requireIdentityVerification && typeof engine.detectFrame === 'function'
      ? await engine.detectFrame(video, { full: true })
      : null;
    const faces = result ? (result.face || []) : await detectFacesLocal(engine, video);
    lastCount = faces.length;
    if (lastCount === 1) {
      if (policy.requireIdentityVerification && (!Array.isArray(faces[0]?.embedding) || faces[0].embedding.length < 64)) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        continue;
      }
      status.textContent = policy.requireIdentityVerification ? 'Camera, single face and identity models are ready.' : 'Camera and single-face verification passed.';
      return engine;
    }
    if (lastCount > 1) throw new Error('More than one face is visible. Only the registered student may remain in frame.');
    await new Promise((resolve) => setTimeout(resolve, 650));
  }
  throw new Error('No stable face detected. Sit clearly in front of the camera before starting the quiz.');
}

function wireSecureSetup(quiz, policy) {
  const cameraButton = document.getElementById('btn-enable-camera');
  const beginButton = document.getElementById('btn-begin-secure-quiz');
  const consent = document.getElementById('integrity-consent');
  const status = document.getElementById('secure-setup-status');
  let cameraReady = !policy.requireCamera;
  let identityReady = !policy.requireIdentityVerification;
  let identityProof = null;
  let stream = null;
  let faceEngine = null;
  const identityState = document.getElementById('identity-setup-state');
  const refresh = () => { beginButton.disabled = !consent.checked || !cameraReady || !identityReady; };
  if (policy.requireIdentityVerification && window.apiIdentityMe) {
    window.apiIdentityMe().then(({ identity }) => {
      identityReady = Boolean(identity?.enrolled && identity.status === 'verified');
      if (identityState) { identityState.textContent = identityReady ? 'Verified identity enrollment found · live match required at start' : identity?.status === 'pending' ? 'Identity enrollment is pending teacher/admin approval' : identity?.status === 'rejected' ? `Identity rejected: ${identity.rejectionReason || 're-enrol required'}` : 'No verified identity enrollment found — use the Identity panel above'; identityState.classList.toggle('warning', !identityReady); }
      refresh();
    }).catch((error) => { if (identityState) { identityState.textContent = error.message; identityState.classList.add('warning'); } });
  }
  consent.addEventListener('change', refresh);
  if (!policy.requireCamera) { cameraButton.disabled = true; cameraButton.textContent = 'Camera not required'; refresh(); }

  cameraButton.addEventListener('click', async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      status.textContent = 'This browser does not support camera access. Use current Chrome or Edge on localhost/HTTPS.';
      return;
    }
    cameraButton.disabled = true;
    cameraButton.textContent = 'Requesting camera…';
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      const video = document.getElementById('secure-camera-preview');
      video.srcObject = stream;
      await video.play();
      document.getElementById('secure-camera-placeholder').style.display = 'none';
      document.getElementById('camera-health-pill').textContent = 'Camera active · checking face';
      document.getElementById('camera-health-pill').classList.add('active');
      faceEngine = await verifyInitialFace(video, status, policy);
      cameraReady = true;
      cameraButton.textContent = 'Camera + face ready ✓';
      document.getElementById('camera-health-pill').textContent = policy.requireIdentityVerification ? 'Face recognition ready · local inference' : policy.detectFacePresence ? 'Single face verified · local only' : 'Camera active · local only';
      status.textContent = 'Camera and face checks passed. Tick consent, then start secure mode.';
    } catch (error) {
      cameraReady = false;
      cameraButton.disabled = false;
      cameraButton.textContent = 'Retry camera permission';
      status.textContent = `Camera permission failed: ${error.message}`;
    }
    refresh();
  });

  beginButton.addEventListener('click', async () => {
    if (policy.requireSecureBrowser && (window.top !== window.self || navigator.webdriver)) {
      status.textContent = 'Secure browser check failed. Open the app directly in a normal top-level browser tab.';
      return;
    }
    beginButton.disabled = true;
    beginButton.textContent = 'Starting secure attempt…';
    try {
      if (policy.requireIdentityVerification) {
        identityProof = await window.prepareQuizIdentityProof({ quiz, policy, video: document.getElementById('secure-camera-preview'), engine: faceEngine, statusElement: status });
      }
      if (policy.requireFullscreen && !document.fullscreenElement) await document.documentElement.requestFullscreen();
      const fullscreenReady = !policy.requireFullscreen || Boolean(document.fullscreenElement);
      if (!fullscreenReady) throw new Error('Fullscreen permission is required.');
      const data = await apiStartQuiz(quiz.id, {
        proctoringConsent: consent.checked,
        cameraReady,
        fullscreenReady,
        identityProofToken: identityProof?.identityProofToken || '',
        identityLivenessScore: identityProof?.livenessScore || 0,
        identityAntiSpoofScore: identityProof?.antiSpoofScore || 0,
        clientContext: clientSecurityContext()
      });
      activeQuizAttempt = {
        quiz: data.quiz, attempt: data.attempt, attemptToken: data.attemptToken, submissionNonce: data.submissionNonce,
        deviceFingerprint: secureDeviceFingerprint(), serverDeadline: data.serverDeadline, heartbeatSequence: 0, eventSequence: 0, autosaveSequence: 0, identityCheckSequence: 0, heartbeatFailures: 0,
        identityRecheckMinSeconds: Number(data.identityRecheckMinSeconds || policy.identityRecheckMinSeconds || 15), identityRecheckMaxSeconds: Number(data.identityRecheckMaxSeconds || policy.identityRecheckMaxSeconds || 35)
      };
      proctoringSession = { stream, faceEngine, cleanup: [], cameraHealthTimer: null, faceTimer: null, faceCountdownTimer: null, identityTimer: null, identityCheckInFlight: false, identityNextCheckAt: Date.now() + (window.randomIdentityDelay ? window.randomIdentityDelay(policy) : 15000), darkFrames: 0, missingFaceFrames: 0, faceMissingSince: 0, faceTimeoutReported: false, lastFaceCount: 1 };
      renderActiveAttempt();
      attachProctoringMonitors();
      startSecureServerChannel(Number(data.heartbeatIntervalSeconds || 12));
    } catch (error) {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      beginButton.disabled = false;
      beginButton.textContent = '2. Enter secure mode & start';
      status.textContent = error.message;
    }
  });
}

function renderActiveAttempt() {
  clearInterval(quizTimerHandle);
  const { quiz, attempt } = activeQuizAttempt;
  const stage = document.getElementById('quiz-attempt-stage');
  const questions = [...quiz.questions]; // Server already provides a per-attempt randomized order.
  stage.innerHTML = `<div class="attempt-shell">
    <div class="attempt-sticky-head secure-attempt-header"><div><span>Attempt #${attempt.attemptNumber}</span><h2>${escapeHtml(quiz.title)}</h2><p>${escapeHtml(quiz.subject)} · ${escapeHtml(quiz.topic)}</p></div><div class="secure-live-cluster"><div class="proctor-camera-mini"><video id="attempt-camera-preview" playsinline muted></video><span id="proctor-camera-state"><i></i> Camera live</span></div><div class="integrity-live"><small>Integrity</small><strong id="integrity-risk-value">0</strong><span id="integrity-event-count">No events</span><span id="secure-server-state">Server verifying</span><span id="secure-autosave-state">Not saved yet</span>${defaultQuizPolicy(quiz).requireIdentityVerification ? '<span id="identity-live-state" class="identity-live-state">Identity locked</span>' : ''}</div><div class="quiz-timer"><small>Time remaining</small><strong id="quiz-timer-value">${formatDurationSeconds(quiz.durationMinutes * 60)}</strong></div></div></div>
    <div class="attempt-progress"><i id="attempt-progress-bar"></i><span id="attempt-progress-label">0/${questions.length} answered</span></div>
    <form id="quiz-attempt-form">${questions.map(quizQuestionHtml).join('')}<button type="submit" class="gen-btn submit-quiz-btn">Submit for auto-grading</button></form>
  </div>`;
  const form = document.getElementById('quiz-attempt-form');
  form.addEventListener('change', updateAttemptProgress);
  form.addEventListener('input', updateAttemptProgress);
  form.addEventListener('submit', (event) => { event.preventDefault(); submitActiveQuiz(); });
  updateAttemptProgress();
  const attemptVideo = document.getElementById('attempt-camera-preview');
  if (attemptVideo && proctoringSession?.stream) { attemptVideo.srcObject = proctoringSession.stream; attemptVideo.play().catch(() => {}); }

  restoreSavedAnswers(attempt.savedAnswers || []);
  const deadline = new Date(activeQuizAttempt.serverDeadline || attempt.expiresAt).getTime();
  const tick = () => {
    const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    const value = document.getElementById('quiz-timer-value');
    if (value) {
      value.textContent = formatDurationSeconds(remaining);
      value.classList.toggle('urgent', remaining <= 60);
    }
    if (remaining <= 0) {
      clearInterval(quizTimerHandle);
      submitActiveQuiz(true);
    }
  };
  tick();
  quizTimerHandle = setInterval(tick, 1000);
  if (window.runMotionEntrance) window.runMotionEntrance(stage);
}

function collectQuizAnswers() {
  const { quiz } = activeQuizAttempt;
  return quiz.questions.map((question) => {
    let answer = '';
    if (question.type === 'short') answer = document.querySelector(`textarea[data-quiz-answer="${question.id}"]`)?.value.trim() || '';
    else answer = document.querySelector(`input[data-quiz-answer="${question.id}"]:checked`)?.value || '';
    return { questionId: question.id, answer };
  });
}

function updateAttemptProgress() {
  if (!activeQuizAttempt) return;
  const answers = collectQuizAnswers();
  const answered = answers.filter((item) => String(item.answer || '').trim()).length;
  const total = answers.length;
  const bar = document.getElementById('attempt-progress-bar');
  const label = document.getElementById('attempt-progress-label');
  if (bar) bar.style.width = `${total ? answered / total * 100 : 0}%`;
  if (label) label.textContent = `${answered}/${total} answered`;
  scheduleSecureAutosave();
}

async function submitActiveQuiz(auto = false) {
  if (!activeQuizAttempt) return;
  const answers = collectQuizAnswers();
  const unanswered = answers.filter((item) => !String(item.answer || '').trim()).length;
  if (!auto && unanswered && !confirm(`${unanswered} question(s) are unanswered. Submit anyway?`)) return;
  const button = document.querySelector('.submit-quiz-btn');
  if (button) { button.disabled = true; button.textContent = 'Auto-grading...'; }
  clearInterval(quizTimerHandle);
  try {
    await secureAutosave(true).catch(() => {});
    const data = await apiSubmitQuiz(
      activeQuizAttempt.quiz.id, activeQuizAttempt.attempt._id, activeQuizAttempt.attemptToken,
      activeQuizAttempt.submissionNonce, activeQuizAttempt.deviceFingerprint, answers
    );
    const completedQuiz = activeQuizAttempt.quiz;
    stopProctoringSession();
    renderQuizResult(completedQuiz, data.result, auto);
    activeQuizAttempt = null;
    await renderQuizzes();
  } catch (err) {
    showToast(err.message, 'error');
    if (button) { button.disabled = false; button.textContent = 'Submit for auto-grading'; }
  }
}

function renderQuizResult(quiz, result, auto) {
  const stage = document.getElementById('quiz-attempt-stage');
  const reviewById = new Map((result.review || []).map((item) => [String(item.questionId), item]));
  stage.innerHTML = `<div class="quiz-result-shell ${result.passed ? 'passed' : 'failed'}">
    <div class="result-hero motion-card"><div class="result-ring" style="--result-score:${Math.round(result.percentage)}"><strong>${Math.round(result.percentage)}%</strong><span>${result.passed ? 'PASS' : 'REVIEW'}</span></div><div><div class="panel-kicker">Instant Auto-Grading</div><h2>${result.passed ? 'Great work — outcome achieved' : 'Keep learning — review weak areas'}</h2><p>${result.score}/${result.totalMarks} marks · ${formatDurationSeconds(result.durationSeconds)} · Pass requirement ${result.passPercentage}%${auto ? ' · Auto-submitted when timer ended' : ''}</p><small>${escapeHtml(result.answerRevealMessage || '')}</small></div></div>
    <div class="result-review-list">${quiz.questions.map((question, index) => { const review = reviewById.get(String(question.id)) || {}; return `<article class="result-review-card ${review.isCorrect ? 'correct' : 'incorrect'} motion-card" style="--delay:${index * 45}ms"><div class="result-icon">${review.isCorrect ? '✓' : '×'}</div><div><div class="question-tags"><span>${escapeHtml(question.bloomLevel || 'Bloom')}</span>${question.courseOutcome ? `<span>${escapeHtml(question.courseOutcome)}</span>` : ''}<em>${review.awardedMarks || 0}/${review.maxMarks || question.marks}</em></div><h3>${escapeHtml(question.prompt)}</h3><p><b>Your answer:</b> ${escapeHtml(Array.isArray(review.answer) ? review.answer.join(', ') : review.answer || 'No answer')}</p>${review.correctAnswer !== undefined ? `<p><b>Correct answer:</b> ${escapeHtml(Array.isArray(review.correctAnswer) ? review.correctAnswer.join(', ') : review.correctAnswer)}</p>` : ''}${review.explanation ? `<small>${escapeHtml(review.explanation)}</small>` : `<small>${escapeHtml(review.feedback || '')}</small>`}</div></article>`; }).join('')}</div>
    <button class="act-btn primary" id="btn-close-result">Back to Quiz Center</button>
  </div>`;
  document.getElementById('btn-close-result').addEventListener('click', () => { stage.innerHTML = ''; window.scrollTo({ top: document.getElementById('view-quizzes').offsetTop, behavior: 'smooth' }); });
  if (window.runMotionEntrance) window.runMotionEntrance(stage);
}


function restoreSavedAnswers(savedAnswers) {
  (savedAnswers || []).forEach((item) => {
    const id = String(item.questionId || '');
    const value = item.answer;
    const textarea = document.querySelector(`textarea[data-quiz-answer="${CSS.escape(id)}"]`);
    if (textarea) textarea.value = value || '';
    else {
      const options = [...document.querySelectorAll(`input[data-quiz-answer="${CSS.escape(id)}"]`)];
      const match = options.find((input) => String(input.value) === String(value));
      if (match) match.checked = true;
    }
  });
  updateAttemptProgressWithoutAutosave();
}

function updateAttemptProgressWithoutAutosave() {
  if (!activeQuizAttempt) return;
  const answers = collectQuizAnswers();
  const answered = answers.filter((item) => String(item.answer || '').trim()).length;
  const total = answers.length;
  const bar = document.getElementById('attempt-progress-bar');
  const label = document.getElementById('attempt-progress-label');
  if (bar) bar.style.width = `${total ? answered / total * 100 : 0}%`;
  if (label) label.textContent = `${answered}/${total} answered`;
}

function scheduleSecureAutosave() {
  if (!activeQuizAttempt) return;
  clearTimeout(quizAutosaveHandle);
  quizAutosaveHandle = setTimeout(() => secureAutosave(false).catch(() => {}), 1200);
}

async function secureAutosave(force = false) {
  if (!activeQuizAttempt) return null;
  activeQuizAttempt.autosaveSequence += 1;
  const data = await apiAutosaveQuiz(
    activeQuizAttempt.quiz.id, activeQuizAttempt.attempt._id, activeQuizAttempt.attemptToken,
    activeQuizAttempt.deviceFingerprint, activeQuizAttempt.autosaveSequence, collectQuizAnswers()
  );
  const indicator = document.getElementById('secure-autosave-state');
  if (indicator) indicator.textContent = `Saved ${new Date(data.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  return data;
}

function startSecureServerChannel(intervalSeconds = 12) {
  clearInterval(quizHeartbeatHandle);
  const sendHeartbeat = async () => {
    if (!activeQuizAttempt) return;
    activeQuizAttempt.heartbeatSequence += 1;
    try {
      const track = proctoringSession?.stream?.getVideoTracks?.()[0];
      const data = await apiQuizHeartbeat(
        activeQuizAttempt.quiz.id, activeQuizAttempt.attempt._id, activeQuizAttempt.attemptToken, activeQuizAttempt.deviceFingerprint,
        {
          sequence: activeQuizAttempt.heartbeatSequence,
          fullscreen: !defaultQuizPolicy(activeQuizAttempt.quiz).requireFullscreen || Boolean(document.fullscreenElement),
          cameraActive: !defaultQuizPolicy(activeQuizAttempt.quiz).requireCamera || Boolean(track && track.readyState === 'live' && !track.muted),
          answeredCount: collectQuizAnswers().filter((x) => String(x.answer || '').trim()).length,
          clientTime: new Date().toISOString()
        }
      );
      activeQuizAttempt.heartbeatFailures = 0;
      if (data.serverDeadline) activeQuizAttempt.serverDeadline = data.serverDeadline;
      updateIntegrityIndicator(data);
      if (data.identityRecheckDue && proctoringSession) proctoringSession.identityNextCheckAt = Date.now();
      const pill = document.getElementById('secure-server-state');
      if (pill) { pill.textContent = 'Server verified'; pill.classList.remove('warning'); }
      if (data.cancelled) renderIntegrityCancellation(data.cancellationReason || 'Secure server heartbeat policy failed.');
    } catch (error) {
      if (!activeQuizAttempt) return;
      activeQuizAttempt.heartbeatFailures += 1;
      const pill = document.getElementById('secure-server-state');
      if (pill) { pill.textContent = `Heartbeat retry ${activeQuizAttempt.heartbeatFailures}`; pill.classList.add('warning'); }
      if (activeQuizAttempt.heartbeatFailures === 2) reportIntegrityEvent('heartbeat_failed', 'Two consecutive secure server heartbeats failed.');
      if (/expired|cancelled|device|token/i.test(error.message)) renderIntegrityCancellation(error.message);
    }
  };
  sendHeartbeat();
  quizHeartbeatHandle = setInterval(sendHeartbeat, Math.max(8, intervalSeconds) * 1000);
}


async function reportIntegrityEvent(type, message, meta = {}, severity) {
  if (!activeQuizAttempt || integrityEventLock) return null;
  const now = Date.now();
  if (now - Number(integrityDebounce.get(type) || 0) < 1400) return null;
  integrityDebounce.set(type, now);
  try {
    integrityEventLock = true;
    activeQuizAttempt.eventSequence += 1;
    const data = await apiReportQuizIntegrity(
      activeQuizAttempt.quiz.id, activeQuizAttempt.attempt._id, activeQuizAttempt.attemptToken, activeQuizAttempt.deviceFingerprint,
      { type, message, meta, severity, sequence: activeQuizAttempt.eventSequence, clientTimestamp: new Date().toISOString() }
    );
    updateIntegrityIndicator(data);
    if (data.cancelled) renderIntegrityCancellation(data.cancellationReason || data.message);
    return data;
  } catch (error) {
    console.warn('Integrity event could not be reported:', error.message);
    return null;
  } finally {
    integrityEventLock = false;
  }
}

function updateIntegrityIndicator(data) {
  const risk = document.getElementById('integrity-risk-value');
  const count = document.getElementById('integrity-event-count');
  if (risk) {
    risk.textContent = Number(data.riskScore || 0);
    risk.classList.toggle('warning', Number(data.riskScore || 0) >= 50);
    if (window.Motion?.animate) window.Motion.animate(risk, { scale: [0.72, 1.16, 1], opacity: [0.5, 1] }, { duration: 0.42, easing: 'ease-out' });
  }
  if (count) {
    const c = data.counters || {};
    count.textContent = `Tabs ${Number(c.tabSwitches || 0)} · Fullscreen ${Number(c.fullscreenExits || 0)} · Camera ${Number(c.cameraInterruptions || 0)} · ID ${Number(c.identityMismatches || 0)}`;
  }
}

function renderIntegrityCancellation(reason) {
  const stage = document.getElementById('quiz-attempt-stage');
  clearInterval(quizTimerHandle);
  stopProctoringSession();
  activeQuizAttempt = null;
  stage.innerHTML = `<div class="integrity-cancelled-shell motion-card"><div class="cancelled-shield">!</div><div class="panel-kicker">Attempt Automatically Cancelled</div><h2>Academic integrity policy was triggered</h2><p>${escapeHtml(reason || 'A severe integrity violation was detected.')}</p><div class="integrity-cancel-note">The attempt has been recorded with a score of 0 and is available to the teacher for review. Camera footage was not recorded or uploaded.</div><button class="act-btn primary" id="btn-return-after-cancel">Return to Quiz Center</button></div>`;
  document.getElementById('btn-return-after-cancel')?.addEventListener('click', async () => { stage.innerHTML = ''; await renderQuizzes(); });
  if (window.runMotionEntrance) window.runMotionEntrance(stage);
}

function attachProctoringMonitors() {
  if (!activeQuizAttempt || !proctoringSession) return;
  const policy = defaultQuizPolicy(activeQuizAttempt.quiz);
  if (!policy.enabled) return;
  const cleanup = proctoringSession.cleanup;
  const on = (target, event, handler, options) => { target.addEventListener(event, handler, options); cleanup.push(() => target.removeEventListener(event, handler, options)); };

  let hiddenReported = false;
  on(document, 'visibilitychange', () => {
    if (document.hidden && !hiddenReported) { hiddenReported = true; reportIntegrityEvent('tab_hidden', 'Quiz tab became hidden or the student switched away.'); }
    if (!document.hidden) hiddenReported = false;
  });
  on(window, 'blur', () => { if (!document.hidden) reportIntegrityEvent('window_blur', 'Quiz window lost focus.', {}, 'info'); });
  on(window, 'offline', () => reportIntegrityEvent('network_offline', 'Network connection was lost during the secure attempt.'));
  on(window, 'online', () => reportIntegrityEvent('network_online', 'Network connection was restored.', {}, 'info'));
  on(document, 'fullscreenchange', () => {
    if (policy.requireFullscreen && !document.fullscreenElement && activeQuizAttempt) reportIntegrityEvent('fullscreen_exit', 'Student exited required fullscreen mode.');
  });

  const blocked = (type, message) => (event) => {
    event.preventDefault();
    reportIntegrityEvent(type, message);
    showToast('This action is blocked in secure quiz mode.', 'error');
  };
  if (policy.blockClipboard) {
    on(document, 'copy', blocked('copy_attempt', 'Copy command was attempted.'));
    on(document, 'cut', blocked('cut_attempt', 'Cut command was attempted.'));
    on(document, 'paste', blocked('paste_attempt', 'Paste command was attempted.'));
  }
  if (policy.blockContextMenu) on(document, 'contextmenu', blocked('context_menu', 'Right-click context menu was attempted.'));
  if (policy.blockKeyboardShortcuts) on(document, 'keydown', (event) => {
    const key = String(event.key || '').toLowerCase();
    const restricted = event.key === 'F12' || ((event.ctrlKey || event.metaKey) && ['c','v','x','p','s','u'].includes(key)) || ((event.ctrlKey || event.metaKey) && event.shiftKey && ['i','j','c'].includes(key));
    if (restricted) { event.preventDefault(); reportIntegrityEvent('restricted_shortcut', `Restricted keyboard shortcut attempted: ${event.key}`); }
  }, true);
  on(window, 'beforeunload', (event) => { event.preventDefault(); event.returnValue = 'Your secure quiz attempt is still active.'; });

  if (policy.requireSecureBrowser && window.top !== window.self) reportIntegrityEvent('embedded_window', 'Quiz was opened inside an embedded frame.', {}, 'severe');
  if (policy.requireSecureBrowser && navigator.webdriver) reportIntegrityEvent('automation_detected', 'Browser automation flag was detected.', {}, 'severe');

  const stream = proctoringSession.stream;
  if (stream) {
    const track = stream.getVideoTracks()[0];
    if (track) {
      const ended = () => reportIntegrityEvent('camera_stopped', 'Required camera track ended.', {}, 'severe');
      const muted = () => reportIntegrityEvent('camera_muted', 'Camera feed was interrupted or muted.');
      track.addEventListener('ended', ended); track.addEventListener('mute', muted);
      cleanup.push(() => { track.removeEventListener('ended', ended); track.removeEventListener('mute', muted); });
    }
    if (policy.detectCameraObstruction) startCameraHealthMonitor();
    if (policy.detectFacePresence) startLocalFaceMonitor();
  }
}

function startCameraHealthMonitor() {
  const video = document.getElementById('attempt-camera-preview');
  if (!video || !proctoringSession) return;
  const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 48;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  proctoringSession.cameraHealthTimer = setInterval(() => {
    if (!activeQuizAttempt || video.readyState < 2) return;
    try {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let sum = 0, sumSq = 0, n = 0;
      for (let i = 0; i < pixels.length; i += 16) { const y = 0.2126*pixels[i] + 0.7152*pixels[i+1] + 0.0722*pixels[i+2]; sum += y; sumSq += y*y; n += 1; }
      const mean = sum / Math.max(1,n); const variance = sumSq / Math.max(1,n) - mean*mean;
      const obstructed = mean < 10 || variance < 5;
      proctoringSession.darkFrames = obstructed ? proctoringSession.darkFrames + 1 : 0;
      const state = document.getElementById('proctor-camera-state');
      if (state) { state.classList.toggle('warning', obstructed); state.innerHTML = `<i></i> ${obstructed ? 'Camera visibility low' : 'Camera live'}`; }
      if (proctoringSession.darkFrames === 3) reportIntegrityEvent('camera_obstructed', 'Camera feed appeared covered, completely dark or visually static for multiple checks.', { mean: Math.round(mean), variance: Math.round(variance) });
    } catch (_) {}
  }, 4000);
}

function startLocalFaceMonitor() {
  const video = document.getElementById('attempt-camera-preview');
  if (!video || !proctoringSession) return;
  const policy = defaultQuizPolicy(activeQuizAttempt?.quiz);
  const graceSeconds = Math.max(2, Number(policy.faceAbsenceGraceSeconds || 2));
  let checking = false;

  const setState = (message, warning = false) => {
    const state = document.getElementById('proctor-camera-state');
    if (state) { state.classList.toggle('warning', warning); state.innerHTML = `<i></i> ${escapeHtml(message)}`; }
  };

  if (!proctoringSession.faceEngine) {
    if (policy.requireFaceDetector) reportIntegrityEvent('face_detector_unavailable', 'Required local face-detection engine was unavailable.', {}, 'severe');
    return;
  }

  proctoringSession.faceTimer = setInterval(async () => {
    if (checking || !activeQuizAttempt || video.readyState < 2) return;
    checking = true;
    try {
      const faces = await detectFacesLocal(proctoringSession.faceEngine, video);
      const count = Number(faces?.length || 0);
      proctoringSession.lastFaceCount = count;
      if (count > 1) {
        setState('Multiple faces detected', true);
        await reportIntegrityEvent('multiple_faces', 'More than one face was detected by the local proctoring engine.', { count }, 'severe');
        return;
      }
      if (count === 1) {
        const wasMissing = Boolean(proctoringSession.faceMissingSince);
        proctoringSession.faceMissingSince = 0;
        proctoringSession.missingFaceFrames = 0;
        proctoringSession.faceTimeoutReported = false;
        setState('Face verified · camera live', false);
        if (wasMissing) reportIntegrityEvent('face_returned', 'Student face returned before the cancellation grace period.', {}, 'info');
        if (policy.requireIdentityVerification && Date.now() >= Number(proctoringSession.identityNextCheckAt || 0) && window.performContinuousIdentityRecheck) {
          await window.performContinuousIdentityRecheck(video, proctoringSession.faceEngine);
        }
        return;
      }

      const now = Date.now();
      if (!proctoringSession.faceMissingSince) {
        proctoringSession.faceMissingSince = now;
        proctoringSession.missingFaceFrames += 1;
        reportIntegrityEvent('face_missing', 'Student face left the camera frame. Cancellation countdown started.', { graceSeconds });
      }
      const elapsed = (now - proctoringSession.faceMissingSince) / 1000;
      const remaining = Math.max(0, Math.ceil(graceSeconds - elapsed));
      setState(`Face missing · cancelling in ${remaining}s`, true);
      if (policy.cancelOnFaceMissing && elapsed >= graceSeconds && !proctoringSession.faceTimeoutReported) {
        proctoringSession.faceTimeoutReported = true;
        await reportIntegrityEvent('face_missing_timeout', `No face was detected continuously for ${graceSeconds} seconds.`, { graceSeconds, elapsedSeconds: Math.round(elapsed) }, 'severe');
      }
    } catch (error) {
      console.warn('Local face detection failed:', error.message);
      if (policy.requireFaceDetector) await reportIntegrityEvent('face_detector_unavailable', `Local face detector failed: ${error.message}`, {}, 'severe');
    } finally { checking = false; }
  }, 500);
}

document.getElementById('btn-generate-quiz')?.addEventListener('click', generateQuizFromResource);
document.getElementById('btn-refresh-quizzes')?.addEventListener('click', renderQuizzes);
