// Phase 11.33: AI Whiteboard
let qwbNodes = [];
let qwbNextId = 1;
let qwbCurrentBoardId = null;
let qwbDrag = null;

function qwbCreateNodeEl(node) {
  const el = document.createElement('div');
  el.className = `qwb-node qwb-${node.type}`;
  el.dataset.id = node.id;
  el.style.left = `${node.x}px`;
  el.style.top = `${node.y}px`;
  el.style.width = `${node.w}px`;
  el.style.height = `${node.h}px`;
  el.style.background = node.color;
  el.innerHTML = `<div class="qwb-text" contenteditable="true" spellcheck="false">${escapeHtml(node.text || '')}</div><button class="qwb-del" title="Delete">×</button>`;

  el.querySelector('.qwb-text').addEventListener('input', (e) => { node.text = e.target.innerText; });
  el.querySelector('.qwb-del').addEventListener('click', () => {
    qwbNodes = qwbNodes.filter((n) => n.id !== node.id);
    el.remove();
  });

  el.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('qwb-text') || e.target.classList.contains('qwb-del')) return;
    const canvasRect = document.getElementById('qwb-canvas').getBoundingClientRect();
    qwbDrag = { node, el, offsetX: e.clientX - canvasRect.left - node.x, offsetY: e.clientY - canvasRect.top - node.y };
    e.preventDefault();
  });

  return el;
}

function qwbRenderAll() {
  const canvas = document.getElementById('qwb-canvas');
  canvas.innerHTML = '';
  qwbNodes.forEach((n) => canvas.appendChild(qwbCreateNodeEl(n)));
}

function qwbAddNode(type) {
  const canvas = document.getElementById('qwb-canvas');
  const color = document.getElementById('qwb-color').value;
  const node = {
    id: qwbNextId++,
    type,
    x: 40 + Math.random() * 200,
    y: 40 + Math.random() * 160,
    w: type === 'note' ? 170 : 130,
    h: type === 'note' ? 130 : 90,
    color,
    text: type === 'note' ? 'New note' : ''
  };
  qwbNodes.push(node);
  canvas.appendChild(qwbCreateNodeEl(node));
}

document.getElementById('qwb-canvas')?.addEventListener('mousemove', (e) => {
  if (!qwbDrag) return;
  const canvasRect = document.getElementById('qwb-canvas').getBoundingClientRect();
  const x = Math.max(0, e.clientX - canvasRect.left - qwbDrag.offsetX);
  const y = Math.max(0, e.clientY - canvasRect.top - qwbDrag.offsetY);
  qwbDrag.node.x = x; qwbDrag.node.y = y;
  qwbDrag.el.style.left = `${x}px`; qwbDrag.el.style.top = `${y}px`;
});
window.addEventListener('mouseup', () => { qwbDrag = null; });

document.getElementById('btn-p10-whiteboard')?.addEventListener('click', async () => {
  document.getElementById('qwb-panel').style.display = 'block';
  document.getElementById('qwb-panel').scrollIntoView({ behavior: 'smooth' });
  try {
    const { boards } = await p10json('/api/intelligence/whiteboard/list');
    const select = document.getElementById('qwb-load');
    select.innerHTML = '<option value="">Load saved board…</option>' + boards.map((b) => `<option value="${b._id}">${escapeHtml(b.title)}</option>`).join('');
  } catch (_) { /* listing is best-effort */ }
});
document.getElementById('btn-qwb-close')?.addEventListener('click', () => { document.getElementById('qwb-panel').style.display = 'none'; });
document.getElementById('btn-qwb-note')?.addEventListener('click', () => qwbAddNode('note'));
document.getElementById('btn-qwb-shape')?.addEventListener('click', () => qwbAddNode('shape'));
document.getElementById('btn-qwb-clear')?.addEventListener('click', () => { qwbNodes = []; qwbCurrentBoardId = null; qwbRenderAll(); });

document.getElementById('btn-qwb-save')?.addEventListener('click', async () => {
  try {
    const title = document.getElementById('qwb-title').value.trim() || 'Untitled board';
    const payload = { title, nodes: qwbNodes };
    if (qwbCurrentBoardId) payload.id = qwbCurrentBoardId;
    const { board } = await p10json('/api/intelligence/whiteboard/save', { method: 'POST', body: JSON.stringify(payload) });
    qwbCurrentBoardId = board._id;
    showToast('Board saved', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
});

document.getElementById('qwb-load')?.addEventListener('change', async (e) => {
  const id = e.target.value;
  if (!id) return;
  try {
    const { board } = await p10json(`/api/intelligence/whiteboard/${id}`);
    qwbCurrentBoardId = board._id;
    document.getElementById('qwb-title').value = board.title;
    qwbNodes = (board.output?.nodes || []).map((n) => ({ ...n }));
    qwbNextId = Math.max(1, ...qwbNodes.map((n) => n.id + 1), 1);
    qwbRenderAll();
    showToast('Board loaded', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
});
