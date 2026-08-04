// AI Visual Learning Engine — Concept Explainer (Phase 11, new doc)
let qceAnimTimer = null;
let qceAnimIndex = 0;
let qceAnimSteps = [];
let qceQuizAnswers = {};

function renderConceptExplainer() {
  // Nothing to load eagerly — output is generated on demand by the button.
}

const QCE_MODE_LABEL = { text: '📝 Text', diagram: '📐 Diagram', animation: '🎞 Animation', voice: '🔊 Voice', quiz: '❓ Quiz' };

function qceRenderAnalysis(analysis) {
  const tags = analysis.recommendedModes.map((m) => `<span class="qce-tag">${escapeHtml(QCE_MODE_LABEL[m] || m)}</span>`).join('');
  return `<div class="qce-card qce-analysis">
    <div class="qce-card-head"><span>Concept Analysis</span><b>${escapeHtml(analysis.generationMode)}</b></div>
    <h3>${escapeHtml(analysis.conceptType)}</h3>
    <p>${escapeHtml(analysis.reasoning || '')}</p>
    <div class="qce-tags">${tags}</div>
  </div>`;
}

function qceRenderText(textBlock) {
  if (!textBlock) return '';
  return `<div class="qce-card">
    <div class="qce-card-head"><span>📝 Text Explanation</span></div>
    <p id="qce-text-body">${escapeHtml(textBlock.text)}</p>
    <button id="btn-qce-voice" class="gen-btn phase3-action qle-btn">🔊 Read aloud</button>
    <span id="qce-voice-status" class="qce-voice-status"></span>
  </div>`;
}

function qceRenderDiagram(diagram) {
  if (!diagram) return '';
  const encoded = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(diagram.svg);
  return `<div class="qce-card">
    <div class="qce-card-head"><span>📐 Diagram (${escapeHtml(diagram.type)})</span></div>
    <div class="p10-svg">${diagram.svg}</div>
    <a class="gen-btn p10-download" download="diagram.svg" href="${encoded}">Download SVG</a>
  </div>`;
}

function qceRenderAnimation(animation) {
  if (!animation) return '';
  qceAnimSteps = animation.steps;
  qceAnimIndex = 0;
  const dots = animation.steps.map((_, i) => `<i data-dot="${i}"></i>`).join('');
  return `<div class="qce-card">
    <div class="qce-card-head"><span>🎞 Animation — ${escapeHtml(animation.title)}</span></div>
    <p class="qce-anim-note">Simple step-by-step visual walkthrough (not a rendered video — this project doesn't run a video-rendering pipeline).</p>
    <div class="qce-anim-frame">
      <div class="qce-anim-label" id="qce-anim-label"></div>
      <div class="qce-anim-text" id="qce-anim-text"></div>
    </div>
    <div class="qce-anim-controls">
      <button id="btn-qce-prev" class="gen-btn phase3-action qle-btn">⏮ Prev</button>
      <button id="btn-qce-play" class="gen-btn phase3-action qle-btn">▶ Play</button>
      <button id="btn-qce-next" class="gen-btn phase3-action qle-btn">Next ⏭</button>
    </div>
    <div class="qce-anim-dots" id="qce-anim-dots">${dots}</div>
  </div>`;
}

function qceShowAnimFrame() {
  const step = qceAnimSteps[qceAnimIndex];
  if (!step) return;
  document.getElementById('qce-anim-label').textContent = `${qceAnimIndex + 1}. ${step.label}`;
  document.getElementById('qce-anim-text').textContent = step.description;
  document.querySelectorAll('#qce-anim-dots i').forEach((dot, i) => dot.classList.toggle('active', i === qceAnimIndex));
}

function qceRenderQuiz(quiz) {
  if (!quiz) return '';
  qceQuizAnswers = {};
  const items = quiz.questions.map((q, qi) => `
    <div class="qce-quiz-q" data-qi="${qi}">
      <b>${qi + 1}. ${escapeHtml(q.question)}</b>
      <div class="qce-quiz-opts">${q.options.map((opt, oi) => `<button class="qce-opt" data-qi="${qi}" data-oi="${oi}">${escapeHtml(opt)}</button>`).join('')}</div>
      <p class="qce-quiz-explain" style="display:none;"></p>
    </div>`).join('');
  return `<div class="qce-card">
    <div class="qce-card-head"><span>❓ Quick Quiz</span></div>
    ${items}
  </div>`;
}

function qceWireQuiz(quiz) {
  document.querySelectorAll('.qce-opt').forEach((btn) => {
    btn.addEventListener('click', () => {
      const qi = Number(btn.dataset.qi);
      if (qceQuizAnswers[qi] !== undefined) return; // already answered
      const oi = Number(btn.dataset.oi);
      const q = quiz.questions[qi];
      qceQuizAnswers[qi] = oi;
      const block = document.querySelector(`.qce-quiz-q[data-qi="${qi}"]`);
      block.querySelectorAll('.qce-opt').forEach((b) => {
        const boi = Number(b.dataset.oi);
        b.classList.add(boi === q.correctIndex ? 'correct' : boi === oi ? 'wrong' : 'muted');
        b.disabled = true;
      });
      const explainEl = block.querySelector('.qce-quiz-explain');
      explainEl.textContent = (oi === q.correctIndex ? '✅ Correct — ' : '❌ Not quite — ') + q.explanation;
      explainEl.style.display = 'block';
    });
  });
}

async function qceExplain() {
  const topic = document.getElementById('qce-topic').value.trim();
  const status = document.getElementById('qce-status');
  const button = document.getElementById('btn-qce-explain');
  const output = document.getElementById('qce-output');
  if (!topic) { showToast('Enter a topic first.', 'error'); return; }

  clearInterval(qceAnimTimer);
  button.disabled = true;
  button.classList.add('generating');
  status.innerHTML = '<span class="status-pulse"></span> Analysing the concept and deciding the best explanation modes...';
  output.innerHTML = '';

  try {
    const data = await apiConceptExplain({ topic });
    let html = qceRenderAnalysis(data.analysis);
    html += qceRenderText(data.textExplanation);
    html += qceRenderDiagram(data.diagram);
    html += qceRenderAnimation(data.animation);
    html += qceRenderQuiz(data.quiz);
    output.innerHTML = html;

    if (data.animation) qceShowAnimFrame();
    if (data.quiz) qceWireQuiz(data.quiz);

    document.getElementById('btn-qce-voice')?.addEventListener('click', () => {
      const voiceStatus = document.getElementById('qce-voice-status');
      if (!window.speechSynthesis) { voiceStatus.textContent = 'Voice not supported in this browser.'; return; }
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(data.textExplanation.text);
      utter.onstart = () => { voiceStatus.textContent = 'Speaking...'; };
      utter.onend = () => { voiceStatus.textContent = ''; };
      window.speechSynthesis.speak(utter);
    });

    document.getElementById('btn-qce-prev')?.addEventListener('click', () => { qceAnimIndex = Math.max(0, qceAnimIndex - 1); qceShowAnimFrame(); });
    document.getElementById('btn-qce-next')?.addEventListener('click', () => { qceAnimIndex = Math.min(qceAnimSteps.length - 1, qceAnimIndex + 1); qceShowAnimFrame(); });
    document.getElementById('btn-qce-play')?.addEventListener('click', (e) => {
      if (qceAnimTimer) {
        clearInterval(qceAnimTimer); qceAnimTimer = null; e.target.textContent = '▶ Play';
        return;
      }
      e.target.textContent = '⏸ Pause';
      qceAnimTimer = setInterval(() => {
        qceAnimIndex += 1;
        if (qceAnimIndex >= qceAnimSteps.length) { qceAnimIndex = qceAnimSteps.length - 1; clearInterval(qceAnimTimer); qceAnimTimer = null; e.target.textContent = '▶ Play'; return; }
        qceShowAnimFrame();
      }, 2600);
    });

    status.textContent = `Explained as "${data.analysis.conceptType}" using ${data.analysis.recommendedModes.length} mode(s).`;
  } catch (err) {
    console.error(err);
    status.textContent = err.message;
    showToast(err.message, 'error');
  } finally {
    button.disabled = false;
    button.classList.remove('generating');
  }
}
document.getElementById('btn-qce-explain')?.addEventListener('click', qceExplain);
