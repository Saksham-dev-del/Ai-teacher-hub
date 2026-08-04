let phase4MediaAssets = [];
let selectedPhase4MediaIds = new Set();

function renderPhase4MediaGrid() {
  const grid = document.getElementById('phase4-media-grid');
  if (!grid) return;
  if (!phase4MediaAssets.length) {
    grid.innerHTML = '<small>No uploaded visual assets yet.</small>';
    return;
  }
  grid.innerHTML = phase4MediaAssets.map((asset, index) => {
    const active = selectedPhase4MediaIds.has(String(asset._id));
    return `<article class="phase4-media-card ${active ? 'selected' : ''} motion-card" style="--delay:${index * 45}ms" data-media-id="${asset._id}">
      <button class="media-select" type="button" data-role="select-media" title="Use in report"><img src="${escapeHtml(asset.url)}" alt="${escapeHtml(asset.originalName)}"><span>${active ? 'Selected' : 'Select'}</span></button>
      <div><b>${escapeHtml(asset.originalName)}</b><button type="button" data-role="delete-media">×</button></div>
    </article>`;
  }).join('');
  grid.querySelectorAll('[data-role="select-media"]').forEach((button) => button.addEventListener('click', () => {
    const id = button.closest('[data-media-id]').dataset.mediaId;
    if (selectedPhase4MediaIds.has(id)) selectedPhase4MediaIds.delete(id); else selectedPhase4MediaIds.add(id);
    renderPhase4MediaGrid();
  }));
  grid.querySelectorAll('[data-role="delete-media"]').forEach((button) => button.addEventListener('click', async () => {
    const id = button.closest('[data-media-id]').dataset.mediaId;
    if (!confirm('Delete this visual asset?')) return;
    try {
      await apiDeleteMediaAsset(id);
      phase4MediaAssets = phase4MediaAssets.filter((x) => String(x._id) !== String(id));
      selectedPhase4MediaIds.delete(String(id));
      renderPhase4MediaGrid();
      showToast('Image removed', 'info');
    } catch (error) { showToast(error.message, 'error'); }
  }));
  if (window.runMotionEntrance) window.runMotionEntrance(grid);
}

async function loadPhase4MediaAssets() {
  try {
    phase4MediaAssets = await apiLoadMediaAssets();
    renderPhase4MediaGrid();
  } catch (error) {
    console.warn('Could not load Phase 4 media assets:', error.message);
  }
}

async function uploadPhase4Images() {
  const input = document.getElementById('f-visual-images');
  const button = document.getElementById('btn-upload-visuals');
  if (!input?.files?.length) return showToast('Select PNG or JPG images first.', 'error');
  button.disabled = true; button.textContent = 'Uploading visuals...';
  try {
    const added = await apiUploadMediaAssets(input.files);
    phase4MediaAssets = [...added, ...phase4MediaAssets.filter((old) => !added.some((item) => String(item._id) === String(old._id)))];
    added.forEach((item) => selectedPhase4MediaIds.add(String(item._id)));
    input.value = '';
    renderPhase4MediaGrid();
    showToast(`${added.length} visual asset(s) uploaded`, 'success');
  } catch (error) { showToast(error.message, 'error'); }
  finally { button.disabled = false; button.textContent = 'Upload selected images'; }
}

document.getElementById('btn-upload-visuals')?.addEventListener('click', uploadPhase4Images);
const phase4Drop = document.getElementById('phase4-image-drop');
const phase4Input = document.getElementById('f-visual-images');
if (phase4Drop && phase4Input) {
  ['dragenter', 'dragover'].forEach((name) => phase4Drop.addEventListener(name, (event) => { event.preventDefault(); phase4Drop.classList.add('dragging'); }));
  ['dragleave', 'drop'].forEach((name) => phase4Drop.addEventListener(name, (event) => { event.preventDefault(); phase4Drop.classList.remove('dragging'); }));
  phase4Drop.addEventListener('drop', (event) => {
    if (!event.dataTransfer.files?.length) return;
    const dt = new DataTransfer();
    [...event.dataTransfer.files].filter((f) => ['image/png', 'image/jpeg'].includes(f.type)).slice(0, 8).forEach((f) => dt.items.add(f));
    phase4Input.files = dt.files;
  });
}
