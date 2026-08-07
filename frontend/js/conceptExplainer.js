// AI Visual Learning Engine — Concept Explainer (Phase 11, new doc)
let qceAnimTimer = null;
let qceAnimIndex = 0;
let qceAnimSteps = [];
let qceQuizAnswers = {};
let qceCurrentTopic = '';
let qceCurrentAnalysis = null;
let qceCurrentTextExplanation = '';
let qceUsedThemes = [];
let qceQuizWrongCount = 0;

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

      // Phase 19: Adaptive Tutor — after repeated wrong answers, offer a
      // different (more everyday/analogy-based) explanation automatically.
      if (oi !== q.correctIndex) {
        qceQuizWrongCount += 1;
        if (qceQuizWrongCount >= 2) qceShowAdaptivePrompt();
      }
    });
  });
}

function qceShowAdaptivePrompt() {
  const card = document.getElementById('qce-adaptive-note');
  document.getElementById('qce-adaptive-text').textContent = `Looks like "${qceCurrentTopic}" isn't landing with the technical explanation (${qceQuizWrongCount} missed so far). Let's try a completely different, everyday-language approach instead.`;
  card.style.display = 'block';
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

  // Reset per-topic state (Phase 17-22 tracking)
  qceUsedThemes = [];
  qceQuizWrongCount = 0;
  document.getElementById('qce-adaptive-note').style.display = 'none';
  document.getElementById('qce-checkpoint').style.display = 'none';
  document.getElementById('qce-checkpoint-output').innerHTML = '';
  document.getElementById('qce-sim-output').innerHTML = '';
  document.getElementById('qce-revision-output').innerHTML = '';
  document.getElementById('qce-doubt-output').innerHTML = '';
  document.getElementById('qce-related-output').innerHTML = '';

  try {
    const data = await apiConceptExplain({ topic });
    qceCurrentTopic = topic;
    qceCurrentAnalysis = data.analysis;
    qceCurrentTextExplanation = data.textExplanation?.text || '';

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
      const utter = new SpeechSynthesisUtterance(document.getElementById('qce-text-body').textContent);
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

    document.getElementById('qce-checkpoint').style.display = 'block';
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

// ---------- Phase 13: AI Analogy Engine ----------
let qceThemes = [];
async function qceLoadThemes() {
  if (qceThemes.length) return qceThemes;
  try { const { themes } = await p10json('/api/intelligence/analogy-themes'); qceThemes = themes; } catch (_) { qceThemes = []; }
  return qceThemes;
}
document.getElementById('btn-qce-analogies')?.addEventListener('click', async () => {
  const topic = document.getElementById('qce-topic').value.trim();
  if (!topic) { showToast('Enter a topic first.', 'error'); return; }
  const btn = document.getElementById('btn-qce-analogies');
  btn.disabled = true; btn.classList.add('generating');
  try {
    const [data, themes] = await Promise.all([apiGenerateAnalogies({ topic }), qceLoadThemes()]);
    document.getElementById('qce-analogies').innerHTML = data.analogies.map((a) => `<span class="qce-tag qce-analogy-tag">${escapeHtml(a.icon)} ${escapeHtml(a.title)} — <i>${escapeHtml(a.description)}</i></span>`).join('');
    document.getElementById('qce-theme-row').innerHTML = themes.map((t) => `<button class="qce-theme-btn" data-theme="${t.key}">${t.icon} ${escapeHtml(t.label)}</button>`).join('');
    document.querySelectorAll('.qce-theme-btn').forEach((tb) => tb.addEventListener('click', async () => {
      const out = document.getElementById('qce-theme-output');
      out.innerHTML = '<p class="qce-anim-note">Generating...</p>';
      try {
        const themed = await apiAnalogyExplain({ topic, theme: tb.dataset.theme });
        out.innerHTML = `<div class="qce-themed-box"><b>${escapeHtml(themed.theme.icon)} Explained via ${escapeHtml(themed.theme.label)}</b><p>${escapeHtml(themed.explanation)}</p></div>`;
      } catch (err) { out.innerHTML = `<p class="qce-anim-note">${escapeHtml(err.message)}</p>`; }
    }));
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false; btn.classList.remove('generating');
  }
});

// ---------- Phase 14/15/16: Storyboard → Animation Engine → Voice Tutor ----------
let qceStoryboard = null;
let qceSbIndex = 0;
let qceSbPlaying = false;

const QCE_VOICE_PRESETS = {
  teacher: { rate: 1, pitch: 1 },
  professor: { rate: 0.82, pitch: 0.8 },
  friendly: { rate: 1.1, pitch: 1.2 },
  fast: { rate: 1.55, pitch: 1 }
};
function qcePickVoice(langPref) {
  const voices = window.speechSynthesis?.getVoices() || [];
  if (langPref === 'hi') return voices.find((v) => /^hi/i.test(v.lang)) || voices.find((v) => /^en/i.test(v.lang)) || voices[0];
  if (langPref === 'hinglish') return voices.find((v) => /^hi/i.test(v.lang)) || voices.find((v) => /^en-in/i.test(v.lang)) || voices.find((v) => /^en/i.test(v.lang)) || voices[0];
  return voices.find((v) => /^en/i.test(v.lang)) || voices[0];
}

document.getElementById('btn-qce-storyboard')?.addEventListener('click', async () => {
  const topic = document.getElementById('qce-topic').value.trim();
  if (!topic) { showToast('Enter a topic first.', 'error'); return; }
  const btn = document.getElementById('btn-qce-storyboard');
  btn.disabled = true; btn.classList.add('generating');
  try {
    qceStoryboard = await apiGenerateStoryboard({ topic });
    qceSbIndex = 0;
    const stage = document.getElementById('qce-storyboard-stage');
    stage.style.display = 'block';
    stage.innerHTML = `<div class="qce-sb-strip">${qceStoryboard.scenes.map((s, i) => `<div class="qce-sb-panel" data-scene="${i}"><span>Scene ${s.sceneNumber}</span><b>${escapeHtml(s.title)}</b><p>${escapeHtml(s.description)}</p></div>`).join('')}</div>`;
    document.getElementById('qce-sb-controls').style.display = 'flex';
    const blob = new Blob([JSON.stringify(qceStoryboard, null, 2)], { type: 'application/json' });
    document.getElementById('qce-sb-download').href = URL.createObjectURL(blob);
    showToast('Storyboard ready', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false; btn.classList.remove('generating');
  }
});

function qceHighlightScene(i, style) {
  document.querySelectorAll('.qce-sb-panel').forEach((p, pi) => {
    p.classList.remove('active', 'style-whiteboard', 'style-motion', 'style-2d', 'style-memory', 'style-flowchart', 'style-timeline', 'style-character');
    if (pi === i) p.classList.add('active', `style-${style}`);
  });
  document.querySelector(`.qce-sb-panel[data-scene="${i}"]`)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
}

function qcePlayScene() {
  if (!qceSbPlaying || !qceStoryboard || qceSbIndex >= qceStoryboard.scenes.length) {
    qceSbPlaying = false;
    return;
  }
  const style = document.getElementById('qce-anim-style').value;
  qceHighlightScene(qceSbIndex, style);

  if (!window.speechSynthesis) { qceSbIndex += 1; window.setTimeout(qcePlayScene, 1800); return; }
  const scene = qceStoryboard.scenes[qceSbIndex];
  const voiceKey = document.getElementById('qce-voice-style').value;
  const langKey = document.getElementById('qce-voice-lang').value;
  const preset = QCE_VOICE_PRESETS[voiceKey] || QCE_VOICE_PRESETS.teacher;

  const utter = new SpeechSynthesisUtterance(scene.narration);
  utter.rate = preset.rate; utter.pitch = preset.pitch;
  const voice = qcePickVoice(langKey === 'hinglish' ? 'hinglish' : langKey);
  if (voice) utter.voice = voice;
  utter.onend = () => { qceSbIndex += 1; qcePlayScene(); };
  utter.onerror = () => { qceSbIndex += 1; qcePlayScene(); };
  window.speechSynthesis.speak(utter);
}

document.getElementById('btn-qce-play-story')?.addEventListener('click', () => {
  if (!qceStoryboard) return;
  window.speechSynthesis?.cancel();
  qceSbIndex = 0;
  qceSbPlaying = true;
  qcePlayScene();
});
document.getElementById('btn-qce-stop-story')?.addEventListener('click', () => {
  qceSbPlaying = false;
  window.speechSynthesis?.cancel();
});

// ---------- Phase 17: Interactive Learning Mode ----------
document.getElementById('btn-qce-yes')?.addEventListener('click', () => {
  document.getElementById('qce-checkpoint-output').innerHTML = '<p class="qce-anim-note">Great! Try "What should I learn next?" below to continue your roadmap.</p>';
});
document.getElementById('btn-qce-no')?.addEventListener('click', () => qceExplainAgainSimpler());
document.getElementById('btn-qce-again')?.addEventListener('click', () => qceExplainAgainSimpler());
document.getElementById('btn-qce-example')?.addEventListener('click', async () => {
  const out = document.getElementById('qce-checkpoint-output');
  out.innerHTML = '<p class="qce-anim-note">Fetching another example...</p>';
  try {
    const themes = await qceLoadThemes();
    const unused = themes.filter((t) => !qceUsedThemes.includes(t.key));
    const theme = (unused.length ? unused : themes)[Math.floor(Math.random() * (unused.length ? unused.length : themes.length))];
    qceUsedThemes.push(theme.key);
    const themed = await apiAnalogyExplain({ topic: qceCurrentTopic, theme: theme.key, conceptType: qceCurrentAnalysis?.conceptType });
    out.innerHTML = `<div class="qce-themed-box"><b>${escapeHtml(themed.theme.icon)} Another example — via ${escapeHtml(themed.theme.label)}</b><p>${escapeHtml(themed.explanation)}</p></div>`;
  } catch (err) { out.innerHTML = `<p class="qce-anim-note">${escapeHtml(err.message)}</p>`; }
});
async function qceExplainAgainSimpler() {
  const out = document.getElementById('qce-checkpoint-output');
  out.innerHTML = '<p class="qce-anim-note">Simplifying...</p>';
  try {
    const simpler = await apiSimplifyExplanation({ topic: qceCurrentTopic, conceptType: qceCurrentAnalysis?.conceptType, previousExplanation: qceCurrentTextExplanation });
    out.innerHTML = `<div class="qce-themed-box"><b>🔁 Simpler explanation</b><p>${escapeHtml(simpler.text)}</p></div>`;
  } catch (err) { out.innerHTML = `<p class="qce-anim-note">${escapeHtml(err.message)}</p>`; }
}

// ---------- Phase 18: Live Simulation Engine ----------
document.getElementById('btn-qce-simulate')?.addEventListener('click', async () => {
  if (!qceCurrentTopic) { showToast('Explain a topic first.', 'error'); return; }
  const btn = document.getElementById('btn-qce-simulate');
  const out = document.getElementById('qce-sim-output');
  btn.disabled = true; btn.classList.add('generating');
  out.innerHTML = '<p class="qce-anim-note">Running simulation...</p>';
  try {
    const sim = await apiRunSimulation({ topic: qceCurrentTopic, conceptType: qceCurrentAnalysis?.conceptType });
    out.innerHTML = `<b class="qce-sim-title">${escapeHtml(sim.title)}</b><div class="qce-sim-strip">${sim.states.map((s, i) => `
      <div class="qce-sim-frame">
        <span>${escapeHtml(s.stepLabel)}</span>
        <table>${Object.entries(s.snapshot).map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`).join('')}</table>
        <p>${escapeHtml(s.description)}</p>
      </div>`).join('<div class="qce-sim-arrow">→</div>')}</div>`;
  } catch (err) { out.innerHTML = `<p class="qce-anim-note">${escapeHtml(err.message)}</p>`; showToast(err.message, 'error'); }
  finally { btn.disabled = false; btn.classList.remove('generating'); }
});

// ---------- Phase 19: Adaptive Tutor switch ----------
document.getElementById('btn-qce-adaptive-switch')?.addEventListener('click', async () => {
  const btn = document.getElementById('btn-qce-adaptive-switch');
  btn.disabled = true; btn.classList.add('generating');
  try {
    const themes = await qceLoadThemes();
    const funThemes = themes.filter((t) => ['cricket', 'gaming', 'whatsapp'].includes(t.key));
    const theme = funThemes[Math.floor(Math.random() * funThemes.length)] || themes[0];
    const themed = await apiAnalogyExplain({ topic: qceCurrentTopic, theme: theme.key, conceptType: qceCurrentAnalysis?.conceptType });
    document.getElementById('qce-adaptive-text').innerHTML = `${escapeHtml(themed.theme.icon)} <b>Via ${escapeHtml(themed.theme.label)}:</b> ${escapeHtml(themed.explanation)}`;
    qceQuizWrongCount = 0;
  } catch (err) { showToast(err.message, 'error'); }
  finally { btn.disabled = false; btn.classList.remove('generating'); }
});

// ---------- Phase 20: Revision Engine ----------
document.getElementById('btn-qce-revision')?.addEventListener('click', async () => {
  if (!qceCurrentTopic) { showToast('Explain a topic first.', 'error'); return; }
  const btn = document.getElementById('btn-qce-revision');
  const out = document.getElementById('qce-revision-output');
  btn.disabled = true; btn.classList.add('generating');
  out.innerHTML = '<p class="qce-anim-note">Building revision pack...</p>';
  try {
    const rev = await apiGenerateRevisionPack({ topic: qceCurrentTopic, conceptType: qceCurrentAnalysis?.conceptType });
    out.innerHTML = `
      <div class="qce-rev-block"><b>📝 Notes</b><ul>${rev.notes.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ul></div>
      <div class="qce-rev-block"><b>🃏 Flashcards</b><div class="qce-flash-mini-grid">${rev.flashcards.map((f) => `<div class="qce-flash-mini" data-flip="0"><div class="qce-flash-mini-inner"><div class="face front">${escapeHtml(f.front)}</div><div class="face back">${escapeHtml(f.back)}</div></div></div>`).join('')}</div></div>
      <div class="qce-rev-block"><b>🧠 Mindmap</b><div id="qce-rev-mindmap"></div></div>
      <div class="qce-rev-block"><b>📋 Cheatsheet</b><ul>${rev.cheatsheet.map((c) => `<li>${escapeHtml(c)}</li>`).join('')}</ul></div>
      <div class="qce-rev-block"><b>🎤 Interview Questions</b><ul>${rev.interviewQuestions.map((q) => `<li>${escapeHtml(q)}</li>`).join('')}</ul></div>
      <div class="qce-rev-block"><b>✅ MCQs</b>${rev.mcqs.map((q, i) => `<p><b>${i + 1}. ${escapeHtml(q.question)}</b><br>${q.options.map((o, oi) => `${oi === q.correctIndex ? '✅' : '▫️'} ${escapeHtml(o)}`).join('<br>')}</p>`).join('')}</div>
      ${rev.codingProblems.length ? `<div class="qce-rev-block"><b>💻 Coding Problems</b>${rev.codingProblems.map((p) => `<p><b>${escapeHtml(p.title)}</b><br>${escapeHtml(p.prompt)}</p>`).join('')}</div>` : ''}`;
    document.querySelectorAll('.qce-flash-mini').forEach((el) => el.addEventListener('click', () => el.classList.toggle('flipped')));
    if (window.visualizeInline) { /* no-op placeholder */ }
    const mm = rev.mindmap;
    document.getElementById('qce-rev-mindmap').innerHTML = `<div class="qce-mindmap-list">${mm.nodes.map((n, i) => i === 0 ? `<span class="qce-mm-root">${escapeHtml(n)}</span>` : `<span class="qce-mm-node">${escapeHtml(n)}</span>`).join('')}</div>`;
  } catch (err) { out.innerHTML = `<p class="qce-anim-note">${escapeHtml(err.message)}</p>`; showToast(err.message, 'error'); }
  finally { btn.disabled = false; btn.classList.remove('generating'); }
});

// ---------- Phase 21: Doubt Solver ----------
document.getElementById('btn-qce-doubt')?.addEventListener('click', async () => {
  if (!qceCurrentTopic) { showToast('Explain a topic first.', 'error'); return; }
  const btn = document.getElementById('btn-qce-doubt');
  const out = document.getElementById('qce-doubt-output');
  btn.disabled = true; btn.classList.add('generating');
  out.innerHTML = '<p class="qce-anim-note">Detecting confusion, preparing a fresh angle...</p>';
  try {
    const themes = await qceLoadThemes();
    const unused = themes.filter((t) => !qceUsedThemes.includes(t.key));
    const theme = (unused.length ? unused : themes)[Math.floor(Math.random() * (unused.length ? unused.length : themes.length))];
    qceUsedThemes.push(theme.key);
    const [simpler, themed] = await Promise.all([
      apiSimplifyExplanation({ topic: qceCurrentTopic, conceptType: qceCurrentAnalysis?.conceptType, previousExplanation: qceCurrentTextExplanation }),
      apiAnalogyExplain({ topic: qceCurrentTopic, theme: theme.key, conceptType: qceCurrentAnalysis?.conceptType })
    ]);
    out.innerHTML = `
      <div class="qce-themed-box"><b>🔁 Simpler language</b><p>${escapeHtml(simpler.text)}</p></div>
      <div class="qce-themed-box"><b>${escapeHtml(theme.icon)} New analogy — ${escapeHtml(theme.label)}</b><p>${escapeHtml(themed.explanation)}</p></div>
      <p class="qce-anim-note">Tip: scroll up and hit "Play" on the Animation/Storyboard for a fresh visual pass too.</p>`;
  } catch (err) { out.innerHTML = `<p class="qce-anim-note">${escapeHtml(err.message)}</p>`; showToast(err.message, 'error'); }
  finally { btn.disabled = false; btn.classList.remove('generating'); }
});

// ---------- Phase 22: Knowledge Graph ----------
document.getElementById('btn-qce-related')?.addEventListener('click', async () => {
  if (!qceCurrentTopic) { showToast('Explain a topic first.', 'error'); return; }
  const btn = document.getElementById('btn-qce-related');
  const out = document.getElementById('qce-related-output');
  btn.disabled = true; btn.classList.add('generating');
  out.innerHTML = '<p class="qce-anim-note">Mapping the roadmap...</p>';
  try {
    const { topics } = await apiRelatedTopics({ topic: qceCurrentTopic, conceptType: qceCurrentAnalysis?.conceptType });
    const relIcon = { prerequisite: '⬅️', next: '➡️', related: '🔗' };
    out.innerHTML = `<div class="qce-kg-list">${topics.map((t) => `<button class="qce-kg-node" data-topic="${escapeHtml(t.name)}">${relIcon[t.relation] || '🔗'} ${escapeHtml(t.name)} <small>${escapeHtml(t.relation)}</small></button>`).join('')}</div>`;
    document.querySelectorAll('.qce-kg-node').forEach((btn2) => btn2.addEventListener('click', () => {
      document.getElementById('qce-topic').value = btn2.dataset.topic;
      qceExplain();
      document.getElementById('qce-topic').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }));
  } catch (err) { out.innerHTML = `<p class="qce-anim-note">${escapeHtml(err.message)}</p>`; showToast(err.message, 'error'); }
  finally { btn.disabled = false; btn.classList.remove('generating'); }
});
