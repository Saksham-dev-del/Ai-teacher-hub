// Phase 11.37 (replacement): AI Presenter Avatar (Lite)
// Uses window.speechSynthesis (built into every modern browser, zero cost, no
// API key) to read the deck's narration aloud, with a simple animated SVG
// avatar synced to speaking state. This is NOT a photorealistic talking-head
// video (that genuinely needs a paid service like D-ID/HeyGen/Synthesia) —
// it's an honest, fully working alternative that needs nothing to set up.

let qavSegments = [];
let qavIndex = 0;
let qavSpeaking = false;
let qavMouthTimer = null;

function qavPopulateVoices() {
  const select = document.getElementById('qav-voice');
  if (!select) return;
  const voices = window.speechSynthesis?.getVoices() || [];
  if (!voices.length) return;
  const preferred = voices.filter((v) => /en/i.test(v.lang));
  const list = preferred.length ? preferred : voices;
  select.innerHTML = list.map((v, i) => `<option value="${i}">${escapeHtml(v.name)} (${escapeHtml(v.lang)})</option>`).join('');
}
if (window.speechSynthesis) {
  qavPopulateVoices();
  window.speechSynthesis.onvoiceschanged = qavPopulateVoices;
}

function qavSetMouth(talking) {
  const mouth = document.getElementById('qav-mouth');
  if (!mouth) return;
  clearInterval(qavMouthTimer);
  if (!talking) { mouth.setAttribute('ry', '4'); return; }
  let open = false;
  qavMouthTimer = setInterval(() => {
    open = !open;
    mouth.setAttribute('ry', open ? '13' : '4');
  }, 140);
}

function qavBlink() {
  const l = document.getElementById('qav-eye-l'); const r = document.getElementById('qav-eye-r');
  if (!l || !r) return;
  l.setAttribute('ry', '1'); r.setAttribute('ry', '1');
  setTimeout(() => { l.removeAttribute('ry'); r.removeAttribute('ry'); }, 140);
}
setInterval(() => { if (document.getElementById('qav-stage')?.style.display !== 'none') qavBlink(); }, 3200);

function qavSpeakNext() {
  if (!qavSpeaking || qavIndex >= qavSegments.length) {
    qavSpeaking = false;
    qavSetMouth(false);
    document.getElementById('qav-slide-label').textContent = 'Done';
    document.getElementById('qav-caption-text').textContent = 'Presentation finished.';
    return;
  }
  const seg = qavSegments[qavIndex];
  document.getElementById('qav-slide-label').textContent = `Slide ${qavIndex + 1} of ${qavSegments.length} — ${seg.heading}`;
  document.getElementById('qav-caption-text').textContent = seg.text;

  const utter = new SpeechSynthesisUtterance(seg.text);
  const voices = window.speechSynthesis.getVoices();
  const select = document.getElementById('qav-voice');
  const chosen = voices[Number(select.value)];
  if (chosen) utter.voice = chosen;
  utter.rate = 1;
  utter.onstart = () => qavSetMouth(true);
  utter.onend = () => { qavSetMouth(false); qavIndex += 1; qavSpeakNext(); };
  utter.onerror = () => { qavSetMouth(false); qavIndex += 1; qavSpeakNext(); };
  window.speechSynthesis.speak(utter);
}

document.getElementById('btn-qav-start')?.addEventListener('click', async () => {
  const sel = qpsSelectedResource();
  const status = document.getElementById('qav-status');
  if (!sel) { showToast('Select a resource first.', 'error'); return; }
  if (!window.speechSynthesis) { status.textContent = 'Your browser does not support built-in text-to-speech.'; return; }

  status.textContent = 'Loading narration...';
  try {
    const payload = sel.isLocalDraft ? { draft: sel.resource } : { resourceId: sel.resourceId };
    const data = await apiGenerateNarration(payload);
    qavSegments = data.segments;
    qavIndex = 0;
    qavSpeaking = true;
    document.getElementById('qav-stage').style.display = 'flex';
    status.textContent = 'Presenting — use Stop to end early.';
    window.speechSynthesis.cancel();
    qavSpeakNext();
  } catch (err) {
    console.error(err);
    status.textContent = err.message;
    showToast(err.message, 'error');
  }
});

document.getElementById('btn-qav-stop')?.addEventListener('click', () => {
  qavSpeaking = false;
  window.speechSynthesis?.cancel();
  qavSetMouth(false);
  document.getElementById('qav-status').textContent = 'Stopped.';
});
