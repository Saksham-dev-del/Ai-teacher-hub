let identityEnginePromise = null;
let identityPanelObjectUrls = [];

function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function identityApi(path, options = {}, fallback = 'Identity request failed.') {
  const response = await authFetch(path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || fallback);
    error.code = data.code || '';
    error.data = data;
    throw error;
  }
  return data;
}

async function apiIdentityMe() {
  return identityApi('/api/quizzes/identity/me', {}, 'Could not load student identity status.');
}

async function apiIdentityEnroll(payload) {
  return identityApi('/api/quizzes/identity/enroll', { method: 'POST', body: JSON.stringify(payload) }, 'Could not submit identity enrollment.');
}

async function apiIdentityList() {
  return identityApi('/api/quizzes/identity/pending', {}, 'Could not load identity enrollments.');
}

async function apiIdentityApprove(studentId) {
  return identityApi(`/api/quizzes/identity/student/${encodeURIComponent(studentId)}/approve`, { method: 'POST', body: '{}' }, 'Could not approve identity.');
}

async function apiIdentityReject(studentId, reason) {
  return identityApi(`/api/quizzes/identity/student/${encodeURIComponent(studentId)}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }, 'Could not reject identity.');
}

async function apiInitialIdentityCheck(quizId, payload) {
  return identityApi(`/api/quizzes/${encodeURIComponent(quizId)}/identity-check`, {
    method: 'POST', headers: { 'x-device-fingerprint': payload.deviceFingerprint || '' }, body: JSON.stringify(payload)
  }, 'Could not verify student identity.');
}

async function apiContinuousIdentityCheck(quizId, attemptId, attemptToken, deviceFingerprint, payload) {
  return identityApi(`/api/quizzes/${encodeURIComponent(quizId)}/identity-recheck`, {
    method: 'POST',
    headers: { 'x-quiz-attempt-token': attemptToken, 'x-device-fingerprint': deviceFingerprint },
    body: JSON.stringify({ attemptId, deviceFingerprint, ...payload })
  }, 'Continuous student identity verification failed.');
}

function identityEngineConfig() {
  return {
    backend: 'webgl',
    async: true,
    cacheSensitivity: 0.02,
    modelBasePath: '/models',
    filter: { enabled: true, equalization: true },
    face: {
      enabled: true,
      detector: { enabled: true, modelPath: 'blazeface.json', maxDetected: 3, rotation: true, minConfidence: 0.45 },
      mesh: { enabled: true, modelPath: 'facemesh.json' },
      iris: { enabled: true, modelPath: 'iris.json' },
      description: { enabled: true, modelPath: 'faceres.json' },
      emotion: { enabled: false },
      antispoof: { enabled: true, modelPath: 'antispoof.json' },
      liveness: { enabled: true, modelPath: 'liveness.json' }
    },
    body: { enabled: false },
    hand: { enabled: false },
    object: { enabled: false },
    gesture: { enabled: true },
    segmentation: { enabled: false }
  };
}

async function getSecureIdentityEngine() {
  if (identityEnginePromise) return identityEnginePromise;
  identityEnginePromise = (async () => {
    if (typeof window.Human !== 'object' || typeof window.Human.Human !== 'function') {
      throw new Error('The local identity model is unavailable. Reload in current Chrome or Edge.');
    }
    let human = null;
    let lastLoadError = null;
    // 'humangl' is Human's own isolated WebGL context and is more reliable than
    // plain 'webgl' (which can silently fail to detect anything if another
    // library already claimed the WebGL context). Fall back to plain webgl,
    // then cpu, instead of getting stuck if the preferred backend won't init.
    for (const backend of ['humangl', 'webgl', 'cpu']) {
      try {
        human = new window.Human.Human({ ...identityEngineConfig(), backend });
        await withTimeout(human.load(), 25000, 'Face-recognition models could not be downloaded (network too slow or blocked). Check your connection and try again.');
        await withTimeout(human.warmup(), 15000, 'warmup-timeout').catch(() => {});
        console.debug('[identity] engine ready on backend:', backend, human.tf?.getBackend?.());
        break;
      } catch (err) {
        lastLoadError = err;
        human = null;
        console.warn(`[identity] backend "${backend}" failed to initialise, trying next.`, err);
      }
    }
    if (!human) throw lastLoadError || new Error('Could not initialise the local face-recognition engine on this device/browser.');
    let consecutiveFrameFailures = 0;
    return {
      mode: 'human-identity',
      human,
      lastResult: null,
      async detectFrame(video, options = {}) {
        const full = options.full === true;
        human.config.face.mesh.enabled = full;
        human.config.face.iris.enabled = full;
        human.config.face.description.enabled = full;
        human.config.face.antispoof.enabled = full;
        human.config.face.liveness.enabled = full;
        human.config.gesture.enabled = full;
        try {
          // A single stuck/slow frame must never freeze the whole capture loop.
          const result = await withTimeout(human.detect(video), 4000, 'frame-detect-timeout');
          consecutiveFrameFailures = 0;
          this.lastResult = result || { face: [], gesture: [] };
        } catch (err) {
          consecutiveFrameFailures += 1;
          console.warn('[identity] frame detection skipped:', err.message || err, 'videoReady:', video.readyState, video.videoWidth, video.videoHeight);
          if (consecutiveFrameFailures >= 8) throw new Error('The local detection engine stopped responding on this device. Try a different browser (current Chrome/Edge) or reload the page.');
          this.lastResult = { face: [], gesture: [] };
        }
        return this.lastResult;
      }
    };
  })().catch((error) => {
    identityEnginePromise = null;
    throw error;
  });
  return identityEnginePromise;
}

function identityGestures(result) {
  return (result?.gesture || []).map((item) => String(item?.gesture || '').toLowerCase());
}

function faceMetric(face, key) {
  const value = Number(face?.[key]);
  return Number.isFinite(value) ? Math.max(0, Math.min(value, 1)) : 0;
}

function averageFaceDescriptors(descriptors) {
  const valid = (descriptors || []).filter((item) => Array.isArray(item) && item.length >= 64);
  if (!valid.length) throw new Error('Face descriptor could not be generated.');
  const length = valid[0].length;
  if (valid.some((item) => item.length !== length)) throw new Error('Face descriptor samples were inconsistent.');
  const out = new Array(length).fill(0);
  valid.forEach((descriptor) => descriptor.forEach((value, index) => { out[index] += Number(value || 0); }));
  return out.map((value) => Math.round((value / valid.length) * 1000000) / 1000000);
}

function captureIdentitySelfie(video) {
  const maxWidth = 360;
  const scale = Math.min(1, maxWidth / Math.max(1, video.videoWidth || 640));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(200, Math.round((video.videoWidth || 640) * scale));
  canvas.height = Math.max(150, Math.round((video.videoHeight || 480) * scale));
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.72);
}

async function collectIdentitySample(video, engine, { requireChallenge = false, statusElement = null, sampleCount = 4, timeoutMs = 22000 } = {}) {
  const startedAt = Date.now();
  const descriptors = [];
  const liveScores = [];
  const realScores = [];
  let challengePassed = !requireChallenge;
  let stableFrames = 0;
  let lastFace = null;
  let everSawAFace = false;
  let framesChecked = 0;
  while (Date.now() - startedAt < timeoutMs) {
    framesChecked += 1;
    const result = await engine.detectFrame(video, { full: true });
    const faces = result?.face || [];
    if (faces.length > 1) throw new Error('More than one face is visible. Only the registered student may remain in frame.');
    if (faces.length === 1) {
      everSawAFace = true;
      const face = faces[0];
      const embedding = face?.embedding;
      const live = faceMetric(face, 'live');
      const real = faceMetric(face, 'real');
      const gestures = identityGestures(result);
      if (gestures.some((gesture) => gesture.includes('blink'))) challengePassed = true;
      if (live >= 0.55 && real >= 0.55) stableFrames += 1;
      else stableFrames = 0;
      if (requireChallenge && stableFrames >= 5 && Date.now() - startedAt > 3500) challengePassed = true;
      if (Array.isArray(embedding) && embedding.length >= 64 && live >= 0.25 && real >= 0.25) {
        descriptors.push(embedding);
        liveScores.push(live);
        realScores.push(real);
        lastFace = face;
      }
      if (statusElement) {
        const challengeText = requireChallenge && !challengePassed ? ' · blink once naturally' : '';
        statusElement.textContent = `Single face detected · live ${Math.round(live * 100)}% · real ${Math.round(real * 100)}%${challengeText}`;
      }
      if (descriptors.length >= sampleCount && challengePassed) break;
    } else if (statusElement) {
      const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
      statusElement.textContent = everSawAFace
        ? 'Face lost — keep your full face centered and well lit.'
        : (elapsedSec > 6
          ? `Still no face detected after ${elapsedSec}s — check camera permission for this tab, improve lighting, and move closer.`
          : (requireChallenge ? 'Keep your full face visible and blink once.' : 'Keep your full face visible and look at the camera.'));
    }
    if (framesChecked % 6 === 0) console.debug('[identity] capture progress', { framesChecked, facesSeen: faces.length, everSawAFace, descriptorsCollected: descriptors.length, videoSize: `${video.videoWidth}x${video.videoHeight}` });
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  if (descriptors.length < Math.min(2, sampleCount)) {
    if (!everSawAFace) throw new Error('No face was ever detected. Check that your browser has camera permission for this exact site (padlock icon → Camera → Allow), then retry.');
    throw new Error('Could not capture enough stable face samples. Improve lighting and look directly at the camera.');
  }
  if (!challengePassed) throw new Error('The live blink/liveness challenge was not completed.');
  return {
    descriptor: averageFaceDescriptors(descriptors.slice(-sampleCount)),
    livenessScore: liveScores.reduce((a, b) => a + b, 0) / Math.max(1, liveScores.length),
    antiSpoofScore: realScores.reduce((a, b) => a + b, 0) / Math.max(1, realScores.length),
    challengePassed,
    face: lastFace
  };
}

function identityStatusBadge(identity) {
  const status = identity?.status || 'not_enrolled';
  const labels = { not_enrolled: 'Not enrolled', pending: 'Pending approval', verified: 'Verified identity', rejected: 'Rejected — re-enrol' };
  return `<span class="identity-status ${escapeHtml(status)}">${escapeHtml(labels[status] || status)}</span>`;
}

async function loadIdentitySelfie(img, studentId) {
  try {
    const response = await authFetch(`/api/quizzes/identity/student/${encodeURIComponent(studentId)}/selfie`);
    if (!response.ok) throw new Error('Image unavailable');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    identityPanelObjectUrls.push(url);
    img.src = url;
  } catch (_) {
    img.alt = 'Enrollment selfie unavailable';
    img.classList.add('unavailable');
  }
}

function ensureIdentityCenterContainer() {
  const summary = document.getElementById('quiz-summary-row');
  if (!summary?.parentElement) return null;
  let panel = document.getElementById('quiz-identity-center');
  if (!panel) {
    panel = document.createElement('section');
    panel.id = 'quiz-identity-center';
    panel.className = 'identity-center motion-card';
    summary.parentElement.insertBefore(panel, summary);
  }
  return panel;
}

async function renderIdentityCenter() {
  const panel = ensureIdentityCenterContainer();
  if (!panel) return;
  identityPanelObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  identityPanelObjectUrls = [];
  panel.innerHTML = '<div class="phase3-loading"><i></i><span>Loading identity verification…</span></div>';
  const role = getCurrentUser()?.role || 'student';
  try {
    if (role === 'student') {
      const { identity } = await apiIdentityMe();
      panel.innerHTML = `<div class="identity-center-head"><div><div class="panel-kicker">Impersonation Prevention</div><h3>Verified Student Identity</h3><p>A live face descriptor is matched before and during protected quizzes. Continuous video is never uploaded or recorded.</p></div>${identityStatusBadge(identity)}</div>
        <div class="identity-student-row"><div><b>${identity?.status === 'verified' ? 'Ready for identity-locked quizzes' : identity?.status === 'pending' ? 'Waiting for teacher/admin approval' : identity?.status === 'rejected' ? escapeHtml(identity.rejectionReason || 'Capture a clearer enrollment.') : 'Enroll your face identity before a protected quiz.'}</b><span>${identity?.enrolledAt ? `Enrolled ${new Date(identity.enrolledAt).toLocaleString()}` : 'One consented selfie and an encrypted descriptor will be stored.'}</span></div><button id="btn-identity-enrol" class="gen-btn">${identity?.enrolled ? 'Re-enrol identity' : 'Enrol face identity'}</button></div>`;
      document.getElementById('btn-identity-enrol')?.addEventListener('click', openIdentityEnrollmentModal);
    } else {
      const { identities } = await apiIdentityList();
      const pending = (identities || []).filter((item) => item.status === 'pending');
      panel.innerHTML = `<div class="identity-center-head"><div><div class="panel-kicker">Teacher / Admin Verification</div><h3>Student Identity Approval Queue</h3><p>Review the consented enrollment selfie before approving the encrypted face template.</p></div><span class="identity-queue-count">${pending.length} pending</span></div>
        <div class="identity-review-grid">${(identities || []).length ? identities.map((item) => `<article class="identity-review-card" data-identity-student="${escapeHtml(item.student?.id || item.student)}"><img alt="Enrollment selfie"><div><div>${identityStatusBadge(item)}</div><h4>${escapeHtml(item.student?.name || 'Student')}</h4><p>${escapeHtml(item.student?.email || '')}</p><small>Live ${Math.round(Number(item.livenessScore || 0) * 100)}% · Anti-spoof ${Math.round(Number(item.antiSpoofScore || 0) * 100)}% · v${Number(item.version || 1)}</small><div class="identity-review-actions"><button data-identity-approve="${escapeHtml(item.student?.id || item.student)}" ${item.status === 'verified' ? 'disabled' : ''}>Approve</button><button data-identity-reject="${escapeHtml(item.student?.id || item.student)}" class="reject">Reject</button></div></div></article>`).join('') : '<div class="phase3-empty"><b>No identity enrollments yet</b><p>Students can enrol from their Quiz Center.</p></div>'}</div>`;
      panel.querySelectorAll('[data-identity-student] img').forEach((img) => loadIdentitySelfie(img, img.closest('[data-identity-student]').dataset.identityStudent));
      panel.querySelectorAll('[data-identity-approve]').forEach((button) => button.addEventListener('click', async () => {
        button.disabled = true;
        try { await apiIdentityApprove(button.dataset.identityApprove); showToast('Student identity approved', 'success'); await renderIdentityCenter(); } catch (error) { showToast(error.message, 'error'); button.disabled = false; }
      }));
      panel.querySelectorAll('[data-identity-reject]').forEach((button) => button.addEventListener('click', async () => {
        const reason = prompt('Reason for rejection / re-capture instructions:', 'Please re-enrol in better lighting with your face centered.');
        if (reason === null) return;
        button.disabled = true;
        try { await apiIdentityReject(button.dataset.identityReject, reason); showToast('Identity enrollment rejected', 'info'); await renderIdentityCenter(); } catch (error) { showToast(error.message, 'error'); button.disabled = false; }
      }));
    }
    if (window.runMotionEntrance) window.runMotionEntrance(panel);
  } catch (error) {
    panel.innerHTML = `<div class="phase3-empty error"><b>Identity center unavailable</b><p>${escapeHtml(error.message)}</p></div>`;
  }
}

async function openIdentityEnrollmentModal() {
  modalBackdrop.classList.add('open');
  modalBox.innerHTML = `<button class="modal-close" data-role="modal-close">X</button><div class="identity-enrol-modal"><div class="panel-kicker">Biometric Identity Enrollment</div><h2>Register your live face identity</h2><p>Only one enrollment selfie and an encrypted numeric face descriptor are stored. Camera video is not recorded.</p><video id="identity-enrol-video" playsinline muted></video><div id="identity-enrol-status" class="phase3-status">Allow camera, center your face and blink once naturally.</div><label class="integrity-consent"><input id="identity-enrol-consent" type="checkbox"><span>I consent to encrypted face-template processing for quiz identity verification and understand I can re-enrol if rejected.</span></label><button id="btn-capture-identity" class="gen-btn">Start camera & capture live identity</button></div>`;
  let stream = null;
  const cleanup = () => { if (stream) stream.getTracks().forEach((track) => track.stop()); };
  modalBox.querySelector('[data-role="modal-close"]').addEventListener('click', () => { cleanup(); closeModal(); });
  document.getElementById('btn-capture-identity').addEventListener('click', async () => {
    const button = document.getElementById('btn-capture-identity');
    const status = document.getElementById('identity-enrol-status');
    if (!document.getElementById('identity-enrol-consent').checked) return showToast('Consent is required for face identity enrollment.', 'error');
    button.disabled = true;
    button.textContent = 'Loading secure local models…';
    status.textContent = 'Downloading face-recognition models (first time can take up to ~20s)…';
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      const video = document.getElementById('identity-enrol-video');
      video.srcObject = stream;
      await video.play();
      const engine = await getSecureIdentityEngine();
      status.textContent = 'Look directly at the camera and blink once.';
      button.textContent = 'Capturing live identity…';
      const sample = await collectIdentitySample(video, engine, { requireChallenge: true, statusElement: status, sampleCount: 5 });
      const data = await apiIdentityEnroll({
        consent: true,
        descriptor: sample.descriptor,
        livenessScore: sample.livenessScore,
        antiSpoofScore: sample.antiSpoofScore,
        challengeType: 'blink-or-liveness',
        challengePassed: sample.challengePassed,
        selfieDataUrl: captureIdentitySelfie(video)
      });
      status.textContent = data.message || 'Identity submitted for approval.';
      button.textContent = 'Enrollment submitted ✓';
      showToast('Identity enrollment submitted for verification', 'success');
      setTimeout(() => { cleanup(); closeModal(); renderIdentityCenter(); }, 1000);
    } catch (error) {
      status.textContent = error.message;
      button.disabled = false;
      button.textContent = 'Retry live identity capture';
    }
  });
  if (window.runMotionEntrance) window.runMotionEntrance(modalBox);
}

async function prepareQuizIdentityProof({ quiz, policy, video, engine, statusElement }) {
  if (!policy.requireIdentityVerification) return { identityProofToken: '', similarity: 0, livenessScore: 0, antiSpoofScore: 0 };
  const { identity } = await apiIdentityMe();
  if (!identity?.enrolled || identity.status !== 'verified') {
    const reason = identity?.status === 'pending' ? 'Your identity enrollment is still waiting for teacher/admin approval.' : identity?.status === 'rejected' ? `Identity enrollment was rejected: ${identity.rejectionReason || 're-enrol required'}` : 'Enroll and obtain teacher/admin approval before starting this identity-locked quiz.';
    throw new Error(reason);
  }
  if (!engine?.detectFrame) throw new Error('The full local face identity engine is required for this quiz.');
  if (statusElement) statusElement.textContent = 'Matching your live face with the approved student identity…';
  const sample = await collectIdentitySample(video, engine, { requireChallenge: false, statusElement, sampleCount: 4, timeoutMs: 15000 });
  const result = await apiInitialIdentityCheck(quiz.id, {
    descriptor: sample.descriptor,
    livenessScore: sample.livenessScore,
    antiSpoofScore: sample.antiSpoofScore,
    deviceFingerprint: secureDeviceFingerprint()
  });
  if (statusElement) statusElement.textContent = `Identity matched ${Math.round(Number(result.similarity || 0) * 100)}% · ready to start.`;
  return {
    identityProofToken: result.identityProofToken,
    similarity: Number(result.similarity || 0),
    livenessScore: sample.livenessScore,
    antiSpoofScore: sample.antiSpoofScore,
    identityVersion: result.identityVersion
  };
}

function randomIdentityDelay(policy) {
  const min = Math.max(8, Number(policy.identityRecheckMinSeconds || 15));
  const max = Math.max(min + 1, Number(policy.identityRecheckMaxSeconds || 35));
  return Math.round((min + Math.random() * (max - min)) * 1000);
}

async function performContinuousIdentityRecheck(video, engine) {
  if (!activeQuizAttempt || !proctoringSession) return null;
  const policy = defaultQuizPolicy(activeQuizAttempt.quiz);
  if (!policy.requireIdentityVerification || proctoringSession.identityCheckInFlight) return null;
  if (!video || !engine?.detectFrame) {
    await reportIntegrityEvent('identity_engine_unavailable', 'The local identity descriptor engine was unavailable during the secure attempt.', {}, 'severe');
    return null;
  }
  proctoringSession.identityCheckInFlight = true;
  activeQuizAttempt.identityCheckSequence = Number(activeQuizAttempt.identityCheckSequence || 0) + 1;
  try {
    const sample = await collectIdentitySample(video, engine, { requireChallenge: false, sampleCount: 2, timeoutMs: 8000 });
    const data = await apiContinuousIdentityCheck(
      activeQuizAttempt.quiz.id,
      activeQuizAttempt.attempt._id,
      activeQuizAttempt.attemptToken,
      activeQuizAttempt.deviceFingerprint,
      {
        sequence: activeQuizAttempt.identityCheckSequence,
        descriptor: sample.descriptor,
        livenessScore: sample.livenessScore,
        antiSpoofScore: sample.antiSpoofScore,
        clientTimestamp: new Date().toISOString()
      }
    );
    const state = document.getElementById('identity-live-state');
    if (state) {
      state.textContent = data.verified ? `Identity ${Math.round(Number(data.similarity || 0) * 100)}%` : `Identity recheck ${Math.round(Number(data.similarity || 0) * 100)}%`;
      state.classList.toggle('warning', !data.verified);
    }
    updateIntegrityIndicator(data);
    if (data.cancelled) renderIntegrityCancellation(data.cancellationReason || 'Student identity did not match.');
    proctoringSession.identityNextCheckAt = Date.now() + (data.recheckRequired ? 1200 : randomIdentityDelay(policy));
    return data;
  } catch (error) {
    const state = document.getElementById('identity-live-state');
    if (state) { state.textContent = 'Identity recheck failed'; state.classList.add('warning'); }
    if (/cancelled|identity|mismatch/i.test(error.message)) renderIntegrityCancellation(error.message);
    else proctoringSession.identityNextCheckAt = Date.now() + 5000;
    return null;
  } finally {
    proctoringSession.identityCheckInFlight = false;
  }
}

window.getSecureIdentityEngine = getSecureIdentityEngine;
window.collectIdentitySample = collectIdentitySample;
window.renderIdentityCenter = renderIdentityCenter;
window.prepareQuizIdentityProof = prepareQuizIdentityProof;
window.performContinuousIdentityRecheck = performContinuousIdentityRecheck;
window.randomIdentityDelay = randomIdentityDelay;
window.apiIdentityMe = apiIdentityMe;
