async function apiStartDetailedJob(payload) {
  const resp = await authFetch('/api/detailed/jobs', { method: 'POST', body: JSON.stringify(payload) });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || 'Could not start detailed generation.');
  return data.job;
}

async function apiGetDetailedJob(id) {
  const resp = await authFetch(`/api/detailed/jobs/${id}`);
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || 'Could not read detailed generation progress.');
  return data.job;
}

async function apiLoadMediaAssets() {
  const resp = await authFetch('/api/media');
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || 'Could not load image library.');
  return data.assets || [];
}

async function apiUploadMediaAssets(files) {
  const form = new FormData();
  [...files].forEach((file) => form.append('images', file));
  const resp = await fetch('/api/media/upload', { method: 'POST', headers: { authorization: `Bearer ${getToken()}` }, body: form });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || 'Could not upload images.');
  return data.assets || [];
}

async function apiDeleteMediaAsset(id) {
  const resp = await authFetch(`/api/media/${id}`, { method: 'DELETE' });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || 'Could not delete image.');
  return true;
}
