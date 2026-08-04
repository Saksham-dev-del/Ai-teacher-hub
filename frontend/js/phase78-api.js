async function phase78Json(url, options = {}, fallback = 'Request failed.') {
  const resp = await authFetch(url, options);
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const error = new Error(data.error || fallback);
    error.data = data;
    throw error;
  }
  return data;
}

async function apiP7Students() { return phase78Json('/api/personalized/students', {}, 'Could not load students.'); }
async function apiP7Profile(studentId = '') {
  const query = studentId ? `?studentId=${encodeURIComponent(studentId)}` : '';
  return phase78Json(`/api/personalized/profile${query}`, {}, 'Could not load learning profile.');
}
async function apiP7RefreshProfile(studentId = '') {
  return phase78Json('/api/personalized/profile/refresh', { method: 'POST', body: JSON.stringify({ studentId: studentId || undefined }) }, 'Could not refresh learning profile.');
}
async function apiP7Generate(payload) {
  return phase78Json('/api/personalized/generate', { method: 'POST', body: JSON.stringify(payload) }, 'Could not generate personalized content.');
}

async function apiP8Students() { return phase78Json('/api/academic-suite/students', {}, 'Could not load students.'); }
async function apiP8ValidateBlueprint(payload) {
  return phase78Json('/api/academic-suite/blueprint/validate', { method: 'POST', body: JSON.stringify(payload) }, 'Could not validate blueprint.');
}
async function apiP8Generate(payload) {
  return phase78Json('/api/academic-suite/generate', { method: 'POST', body: JSON.stringify(payload) }, 'Could not generate academic output.');
}
async function apiP8Attendance(payload) {
  return phase78Json('/api/academic-suite/attendance', { method: 'POST', body: JSON.stringify(payload) }, 'Could not record attendance.');
}
async function apiP8AttendanceList() { return phase78Json('/api/academic-suite/attendance', {}, 'Could not load attendance reminders.'); }
async function apiP8ReminderStatus(id, sent) {
  return phase78Json(`/api/academic-suite/attendance/${encodeURIComponent(id)}/reminder`, { method: 'PATCH', body: JSON.stringify({ sent }) }, 'Could not update reminder status.');
}
