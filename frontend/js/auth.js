const AUTH_TOKEN_KEY = 'trh:access-token';
const AUTH_USER_KEY = 'trh:user';
let refreshInFlight = null;

function getToken() {
  let token = sessionStorage.getItem(AUTH_TOKEN_KEY);
  const legacy = localStorage.getItem('trh:token');
  if (!token && legacy) {
    token = legacy;
    sessionStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.removeItem('trh:token');
  }
  return token;
}

function setSession(token, user) {
  if (token) sessionStorage.setItem(AUTH_TOKEN_KEY, token);
  if (user) localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

function clearSession() {
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem('trh:token');
  localStorage.removeItem(AUTH_USER_KEY);
}

function getCurrentUser() {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

function authHeaders(extra) {
  const token = getToken();
  return { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...extra };
}

async function apiRegister(name, email, password, role) {
  const resp = await fetch('/api/auth/register', {
    method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, email, password, role })
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || 'Could not create account.');
  return data;
}

async function apiLogin(email, password) {
  const resp = await fetch('/api/auth/login', {
    method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password })
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || 'Could not log in.');
  return data;
}

async function refreshAccessToken() {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const resp = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: '{}' });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.token) throw new Error(data.error || 'Session refresh failed.');
    setSession(data.token, data.user);
    return data;
  })().finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}

async function apiMe() {
  let token = getToken();
  if (!token) {
    try { token = (await refreshAccessToken()).token; } catch (_) { return null; }
  }
  let resp = await fetch('/api/auth/me', { credentials: 'same-origin', headers: authHeaders() });
  if (resp.status === 401) {
    try {
      await refreshAccessToken();
      resp = await fetch('/api/auth/me', { credentials: 'same-origin', headers: authHeaders() });
    } catch (_) { return null; }
  }
  if (!resp.ok) return null;
  const data = await resp.json();
  return data.user;
}

async function logout() {
  try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: '{}' }); } catch (_) {}
  clearSession();
  window.location.reload();
}

async function authFetch(url, opts = {}, retried = false) {
  const headers = { ...authHeaders(), ...(opts.headers || {}) };
  if (opts.body instanceof FormData) delete headers['content-type'];
  const resp = await fetch(url, { ...opts, credentials: 'same-origin', headers });
  if (resp.status === 401 && !retried && !String(url).startsWith('/api/auth/')) {
    try {
      await refreshAccessToken();
      return authFetch(url, opts, true);
    } catch (_) {
      clearSession();
      showAuthScreen();
      throw new Error('Your secure session expired. Please log in again.');
    }
  }
  return resp;
}
