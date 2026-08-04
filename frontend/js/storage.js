// Resources now live in MongoDB via the backend. This module keeps a local
// in-memory cache (`resources`) synced with the API so the UI code that
// reads/renders `resources` doesn't need to change everywhere.

let resources = [];
let sharedResources = [];

async function loadResources() {
  try {
    const resp = await authFetch('/api/resources');
    if (!resp.ok) { resources = []; return; }
    const data = await resp.json();
    resources = data.resources || [];
    try { localStorage.setItem('offlineResources', JSON.stringify(resources.slice(0, 120))); } catch (_) {}
  } catch (e) {
    console.error('Could not load resources:', e);
    try { resources = JSON.parse(localStorage.getItem('offlineResources') || '[]'); } catch (_) { resources = []; }
  }
}

async function loadSharedResources() {
  try {
    const resp = await authFetch('/api/resources/shared/all');
    if (!resp.ok) { sharedResources = []; return; }
    const data = await resp.json();
    sharedResources = data.resources || [];
    try { localStorage.setItem('offlineSharedResources', JSON.stringify(sharedResources.slice(0, 120))); } catch (_) {}
  } catch (e) {
    console.error('Could not load shared resources:', e);
    try { sharedResources = JSON.parse(localStorage.getItem('offlineSharedResources') || '[]'); } catch (_) { sharedResources = []; }
  }
}

async function apiCreateResource(payload) {
  const resp = await authFetch('/api/resources', { method: 'POST', body: JSON.stringify(payload) });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || 'Could not save resource.');
  return data.resource;
}

async function apiSetShared(id, shared) {
  const resp = await authFetch(`/api/resources/${id}`, { method: 'PATCH', body: JSON.stringify({ shared }) });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || 'Could not update resource.');
  return data.resource;
}

async function apiDeleteResource(id) {
  const resp = await authFetch(`/api/resources/${id}`, { method: 'DELETE' });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || 'Could not delete resource.');
  return true;
}


async function apiGetResource(id) {
  const resp = await authFetch(`/api/resources/${encodeURIComponent(id)}`);
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || 'Could not load the resource.');
  return data.resource;
}
