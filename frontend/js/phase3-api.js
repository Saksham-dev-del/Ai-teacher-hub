async function parseApiResponse(resp, fallbackMessage) {
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || fallbackMessage || `Server error (${resp.status})`);
  return data;
}

async function apiLoadQuizzes() {
  return parseApiResponse(await authFetch('/api/quizzes'), 'Could not load quizzes.');
}

async function apiGenerateQuiz(payload) {
  return parseApiResponse(await authFetch('/api/quizzes/generate', { method: 'POST', body: JSON.stringify(payload) }), 'Could not generate quiz.');
}

async function apiUpdateQuiz(id, payload) {
  return parseApiResponse(await authFetch(`/api/quizzes/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }), 'Could not update quiz.');
}

async function apiDeleteQuiz(id) {
  return parseApiResponse(await authFetch(`/api/quizzes/${id}`, { method: 'DELETE' }), 'Could not delete quiz.');
}

async function apiStartQuiz(id, security = {}) {
  return parseApiResponse(await authFetch(`/api/quizzes/${id}/start`, {
    method: 'POST', headers: { 'x-device-fingerprint': security?.clientContext?.deviceFingerprint || '' }, body: JSON.stringify(security)
  }), 'Could not start quiz.');
}

async function apiReportQuizIntegrity(id, attemptId, attemptToken, deviceFingerprint, event) {
  return parseApiResponse(await authFetch(`/api/quizzes/${id}/integrity`, {
    method: 'POST', keepalive: true,
    headers: { 'x-quiz-attempt-token': attemptToken, 'x-device-fingerprint': deviceFingerprint },
    body: JSON.stringify({ attemptId, deviceFingerprint, ...event })
  }), 'Could not record integrity event.');
}

async function apiQuizHeartbeat(id, attemptId, attemptToken, deviceFingerprint, payload) {
  return parseApiResponse(await authFetch(`/api/quizzes/${id}/heartbeat`, {
    method: 'POST',
    headers: { 'x-quiz-attempt-token': attemptToken, 'x-device-fingerprint': deviceFingerprint },
    body: JSON.stringify({ attemptId, deviceFingerprint, ...payload })
  }), 'Secure heartbeat failed.');
}

async function apiAutosaveQuiz(id, attemptId, attemptToken, deviceFingerprint, sequence, answers) {
  return parseApiResponse(await authFetch(`/api/quizzes/${id}/autosave`, {
    method: 'POST',
    headers: { 'x-quiz-attempt-token': attemptToken, 'x-device-fingerprint': deviceFingerprint },
    body: JSON.stringify({ attemptId, deviceFingerprint, sequence, answers })
  }), 'Could not securely autosave answers.');
}


async function apiSubmitQuiz(id, attemptId, attemptToken, submissionNonce, deviceFingerprint, answers) {
  return parseApiResponse(await authFetch(`/api/quizzes/${id}/submit`, {
    method: 'POST',
    headers: { 'x-quiz-attempt-token': attemptToken, 'x-quiz-submission-nonce': submissionNonce, 'x-device-fingerprint': deviceFingerprint },
    body: JSON.stringify({ attemptId, deviceFingerprint, answers })
  }), 'Could not submit quiz.');
}

async function apiQuizAttempts(id) {
  return parseApiResponse(await authFetch(`/api/quizzes/${id}/attempts`), 'Could not load attempts.');
}

async function apiPerformance() {
  return parseApiResponse(await authFetch('/api/performance'), 'Could not load performance analytics.');
}

async function apiDownloadPresentation(payload) {
  const resp = await authFetch('/api/presentations/export', { method: 'POST', body: JSON.stringify(payload) });
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    throw new Error(data.error || 'Could not generate PowerPoint.');
  }
  return resp.blob();
}

async function apiLoadCalendar(start, end) {
  const query = new URLSearchParams({ start: start.toISOString(), end: end.toISOString() });
  return parseApiResponse(await authFetch(`/api/calendar?${query}`), 'Could not load lesson calendar.');
}

async function apiCreateCalendarEvent(payload) {
  return parseApiResponse(await authFetch('/api/calendar', { method: 'POST', body: JSON.stringify(payload) }), 'Could not create lesson event.');
}

async function apiUpdateCalendarEvent(id, payload) {
  return parseApiResponse(await authFetch(`/api/calendar/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }), 'Could not update lesson event.');
}

async function apiDeleteCalendarEvent(id) {
  return parseApiResponse(await authFetch(`/api/calendar/${id}`, { method: 'DELETE' }), 'Could not delete lesson event.');
}
