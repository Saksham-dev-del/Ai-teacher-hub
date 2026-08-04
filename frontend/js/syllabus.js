let syllabi = [];

const syllabusFileInput = document.getElementById('f-syllabus-file');
const syllabusSelect = document.getElementById('f-syllabus');
const referenceSyllabusSelect = document.getElementById('f-reference-syllabi');
const syllabusStatus = document.getElementById('syllabus-status');
const uploadProgress = document.getElementById('upload-progress');
const uploadButton = document.getElementById('btn-upload-syllabus');
const deleteSyllabusButton = document.getElementById('btn-delete-syllabus');
const dropZone = document.getElementById('pdf-drop-zone');

function syllabusOptionLabel(item) {
  const mode = item.embeddingStatus === 'semantic' ? 'Semantic RAG' : 'Lexical RAG';
  return `${item.originalName} · ${item.chunkCount} chunks · ${mode}`;
}

function renderSyllabusOptions(selectedId) {
  if (!syllabusSelect) return;
  const current = selectedId || syllabusSelect.value;
  syllabusSelect.innerHTML = '<option value="">No syllabus selected</option>' + syllabi.map((item) =>
    `<option value="${item._id}" ${String(item._id) === String(current) ? 'selected' : ''}>${escapeHtml(syllabusOptionLabel(item))}</option>`
  ).join('');
  if (referenceSyllabusSelect) {
    const selected = new Set([...referenceSyllabusSelect.selectedOptions].map((option) => option.value));
    referenceSyllabusSelect.innerHTML = syllabi.map((item) => `<option value="${item._id}" ${selected.has(String(item._id)) || String(item._id) === String(current) ? 'selected' : ''}>${escapeHtml(syllabusOptionLabel(item))}</option>`).join('');
  }
  updateSelectedSyllabusStatus();
}

function updateSelectedSyllabusStatus() {
  if (!syllabusStatus || !syllabusSelect) return;
  const selected = syllabi.find((item) => String(item._id) === String(syllabusSelect.value));
  if (!selected) {
    syllabusStatus.textContent = syllabusFileInput?.files?.[0]
      ? `${syllabusFileInput.files[0].name} ready to upload.`
      : 'No indexed syllabus selected.';
    syllabusStatus.className = 'syllabus-status';
    return;
  }
  const mode = selected.embeddingStatus === 'semantic' ? 'Semantic hybrid RAG' : 'Fast lexical RAG';
  syllabusStatus.textContent = `${selected.originalName} · ${selected.pageCount || '?'} pages · ${selected.wordCount || 0} words · ${mode}`;
  syllabusStatus.className = 'syllabus-status ready';
}

async function loadSyllabi() {
  try {
    const response = await authFetch('/api/syllabus');
    if (!response.ok) {
      syllabi = [];
      return;
    }
    const data = await response.json();
    syllabi = data.syllabi || [];
    renderSyllabusOptions();
  } catch (error) {
    console.error('Could not load syllabi:', error);
    syllabi = [];
  }
}

function setUploadProgress(percent, active) {
  if (!uploadProgress) return;
  uploadProgress.classList.toggle('active', Boolean(active));
  const bar = uploadProgress.querySelector('span');
  if (bar) bar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
}

async function uploadSelectedSyllabus() {
  const file = syllabusFileInput && syllabusFileInput.files && syllabusFileInput.files[0];
  if (!file) {
    showToast('Select a syllabus PDF first.', 'error');
    return;
  }
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    showToast('Only PDF files are supported.', 'error');
    return;
  }

  uploadButton.disabled = true;
  uploadButton.textContent = 'Extracting and indexing PDF...';
  syllabusStatus.textContent = 'Reading PDF text and building the RAG index...';
  syllabusStatus.className = 'syllabus-status processing';
  setUploadProgress(12, true);
  const fakeProgress = setInterval(() => {
    const bar = uploadProgress.querySelector('span');
    const current = Number(String(bar.style.width || '12').replace('%', ''));
    setUploadProgress(Math.min(88, current + Math.ceil(Math.random() * 9)), true);
  }, 500);

  try {
    const formData = new FormData();
    formData.append('syllabus', file);
    formData.append('course', document.getElementById('syllabus-course').value.trim() || document.getElementById('f-course').value);
    formData.append('subject', document.getElementById('syllabus-subject').value.trim() || document.getElementById('f-subject').value.trim());

    const response = await fetch('/api/syllabus/upload', {
      method: 'POST',
      headers: { authorization: `Bearer ${getToken()}` },
      body: formData
    });
    if (response.status === 401) {
      logout();
      throw new Error('Your session expired. Please log in again.');
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Could not upload syllabus.');

    const item = data.syllabus;
    syllabi = [item, ...syllabi.filter((x) => String(x._id) !== String(item._id))];
    renderSyllabusOptions(item._id);
    document.getElementById('f-use-rag').checked = true;
    setUploadProgress(100, true);
    showToast(data.duplicate ? 'This syllabus was already indexed.' : 'Syllabus indexed successfully.', 'success');
    setTimeout(() => setUploadProgress(0, false), 900);
  } catch (error) {
    setUploadProgress(0, false);
    syllabusStatus.textContent = error.message || 'Upload failed.';
    syllabusStatus.className = 'syllabus-status error';
    showToast(error.message || 'Could not process syllabus.', 'error');
  } finally {
    clearInterval(fakeProgress);
    uploadButton.disabled = false;
    uploadButton.textContent = 'Upload & build RAG index';
  }
}

async function deleteSelectedSyllabus() {
  const id = syllabusSelect && syllabusSelect.value;
  if (!id) {
    showToast('Select an indexed syllabus first.', 'info');
    return;
  }
  const selected = syllabi.find((item) => String(item._id) === String(id));
  if (!confirm(`Delete ${selected ? selected.originalName : 'this syllabus'} from the knowledge base?`)) return;
  deleteSyllabusButton.disabled = true;
  try {
    const response = await authFetch(`/api/syllabus/${id}`, { method: 'DELETE' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Could not delete syllabus.');
    syllabi = syllabi.filter((item) => String(item._id) !== String(id));
    renderSyllabusOptions('');
    showToast('Syllabus removed from the RAG library.', 'info');
  } catch (error) {
    showToast(error.message || 'Could not delete syllabus.', 'error');
  } finally {
    deleteSyllabusButton.disabled = false;
  }
}

if (syllabusFileInput) {
  syllabusFileInput.addEventListener('change', () => {
    const file = syllabusFileInput.files && syllabusFileInput.files[0];
    if (file) {
      syllabusStatus.textContent = `${file.name} ready to upload.`;
      syllabusStatus.className = 'syllabus-status ready';
      dropZone.classList.add('has-file');
    }
  });
}
if (syllabusSelect) syllabusSelect.addEventListener('change', updateSelectedSyllabusStatus);
if (uploadButton) uploadButton.addEventListener('click', uploadSelectedSyllabus);
if (deleteSyllabusButton) deleteSyllabusButton.addEventListener('click', deleteSelectedSyllabus);

if (dropZone) {
  ['dragenter', 'dragover'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add('dragging');
  }));
  ['dragleave', 'drop'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove('dragging');
  }));
  dropZone.addEventListener('drop', (event) => {
    const file = event.dataTransfer.files && event.dataTransfer.files[0];
    if (!file) return;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    syllabusFileInput.files = transfer.files;
    syllabusFileInput.dispatchEvent(new Event('change'));
  });
}
