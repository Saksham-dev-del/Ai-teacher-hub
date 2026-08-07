const { callJson } = require('./aiGateway');
const { UNTRUSTED_REFERENCE_RULES } = require('./promptGuard');
const { diagramPlan, renderDiagramSvg } = require('./platformIntelligence');

const ALL_MODES = ['text', 'diagram', 'animation', 'voice', 'quiz'];
const EXPLANATION_STRATEGIES = ['Memory Animation', 'Real Life Analogy', 'Code Walkthrough', 'Node Animation', 'Flowchart', 'Layer Animation', 'Timeline Walkthrough'];

// ---------- Concept Analyzer ----------
function fallbackAnalysis(topic) {
  const t = String(topic || '').toLowerCase();
  let conceptType = 'General Concept';
  let diagramType = 'concept-map';
  let conceptTags = ['Core Idea'];
  let explanationStrategy = 'Real Life Analogy';
  if (/pass by|reference|pointer|memory|address/.test(t)) { conceptType = 'Memory & Variable Behaviour'; diagramType = 'sequence'; conceptTags = ['Memory', 'Function Calling', 'Variables', 'Copying']; explanationStrategy = 'Memory Animation'; }
  else if (/recursion|recursive/.test(t)) { conceptType = 'Recursive Process'; diagramType = 'flowchart'; conceptTags = ['Function Calls', 'Base Case', 'Call Stack']; explanationStrategy = 'Code Walkthrough'; }
  else if (/deadlock|race condition|concurren|lock|mutex/.test(t)) { conceptType = 'Concurrency & Resource Management'; diagramType = 'state'; conceptTags = ['Processes', 'Resource Locking', 'Waiting']; explanationStrategy = 'Real Life Analogy'; }
  else if (/sort|search|algorithm|complexity/.test(t)) { conceptType = 'Algorithm / Divide & Conquer'; diagramType = 'flowchart'; conceptTags = ['Steps', 'Comparisons', 'Complexity']; explanationStrategy = 'Flowchart'; }
  else if (/tree|graph|linked list|stack|queue|node/.test(t)) { conceptType = 'Data Structure'; diagramType = 'concept-map'; conceptTags = ['Nodes', 'Links', 'Traversal']; explanationStrategy = 'Node Animation'; }
  else if (/neural|gradient|deep learning|training|weight|machine learning/.test(t)) { conceptType = 'Machine Learning Process'; diagramType = 'process'; conceptTags = ['Layers', 'Weights', 'Training Loop']; explanationStrategy = 'Layer Animation'; }
  else if (/network|packet|router|protocol|client.server/.test(t)) { conceptType = 'Networking / Systems Process'; diagramType = 'sequence'; conceptTags = ['Packets', 'Routing', 'Protocol']; explanationStrategy = 'Timeline Walkthrough'; }
  else if (/database|normalization|transaction|sql|query/.test(t)) { conceptType = 'Database Process'; diagramType = 'flowchart'; conceptTags = ['Tables', 'Relations', 'Process']; explanationStrategy = 'Flowchart'; }
  return {
    conceptType,
    conceptTags,
    explanationStrategy,
    reasoning: `Classified from keywords in "${topic}".`,
    recommendedModes: ['text', 'diagram', 'animation', 'voice', 'quiz'],
    diagramType,
    generationMode: 'fallback'
  };
}

async function analyzeConcept(topic) {
  const fallback = fallbackAnalysis(topic);
  try {
    const system = `You are an expert CS/academic teaching assistant that decides how to best explain a concept to a student. ${UNTRUSTED_REFERENCE_RULES} Return JSON only.`;
    const prompt = `Topic: "${topic}"\nIdentify:\n1. conceptType — a short label (e.g. "Memory & Variable Behaviour", "Recursive Process", "Concurrency", "Data Structure", "Algorithm", "Database Process", "Networking Process", "Machine Learning Process", or another short label)\n2. conceptTags — 2-4 short tags naming the underlying building blocks (e.g. for Pass by Value: ["Memory","Function Calling","Variables","Copying"])\n3. explanationStrategy — the single best teaching strategy from: ${EXPLANATION_STRATEGIES.join(', ')}\n4. recommendedModes — which of these genuinely help: text, diagram, animation, voice, quiz\n5. diagramType — best pick from: flowchart, mind-map, er, architecture, uml, sequence, state, process, comparison, timeline\nReturn {"conceptType":"...","conceptTags":["..."],"explanationStrategy":"...","reasoning":"one sentence","recommendedModes":["text","diagram",...],"diagramType":"..."}`;
    const ai = await callJson(system, prompt);
    if (ai.conceptType && Array.isArray(ai.recommendedModes) && ai.recommendedModes.length) {
      return {
        conceptType: String(ai.conceptType).slice(0, 80),
        conceptTags: Array.isArray(ai.conceptTags) && ai.conceptTags.length ? ai.conceptTags.map((t) => String(t).slice(0, 30)).slice(0, 5) : fallback.conceptTags,
        explanationStrategy: EXPLANATION_STRATEGIES.includes(ai.explanationStrategy) ? ai.explanationStrategy : fallback.explanationStrategy,
        reasoning: String(ai.reasoning || '').slice(0, 200),
        recommendedModes: ai.recommendedModes.filter((m) => ALL_MODES.includes(m)).slice(0, 5).length ? ai.recommendedModes.filter((m) => ALL_MODES.includes(m)) : fallback.recommendedModes,
        diagramType: ai.diagramType || fallback.diagramType,
        generationMode: 'ai'
      };
    }
  } catch (_) {}
  return fallback;
}

// ---------- Text Explanation ----------
function fallbackTextExplanation(topic, conceptType) {
  return `${topic} is a ${conceptType.toLowerCase()} concept. Understanding it requires looking at what happens step by step — the diagram and animation below break this down visually, and the quiz at the end checks whether the idea has landed.`;
}
async function generateTextExplanation(topic, conceptType) {
  try {
    const system = `You are a clear, friendly teacher explaining a concept to a student in 3-4 short sentences — plain language, one concrete example, no fluff. ${UNTRUSTED_REFERENCE_RULES} Return JSON only.`;
    const ai = await callJson(system, `Explain "${topic}" (a ${conceptType} concept) in 3-4 short sentences with one concrete example. Return {"explanation":"..."}`);
    if (ai.explanation && ai.explanation.length > 30) return { text: ai.explanation.slice(0, 900), generationMode: 'ai' };
  } catch (_) {}
  return { text: fallbackTextExplanation(topic, conceptType), generationMode: 'fallback' };
}

// Phase 21 (Doubt Solver) / Phase 17 (Interactive "Explain Again"): re-explain
// in noticeably simpler language when a student signals confusion.
function fallbackSimplerExplanation(topic) {
  return `Let's slow down. ${topic}, in the simplest terms: imagine the smallest possible everyday example of it, focus only on that one thing, and ignore every other detail for now.`;
}
async function simplifyExplanation(topic, conceptType, previousExplanation = '') {
  try {
    const system = `A student said they still don't understand this explanation. Rewrite it in MUCH simpler language — shorter sentences, a single concrete everyday example, avoid jargon entirely. ${UNTRUSTED_REFERENCE_RULES} Return JSON only.`;
    const prompt = `Topic: "${topic}" (${conceptType})\n${previousExplanation ? `Previous explanation that didn't land: "${previousExplanation}"\n` : ''}Give a much simpler explanation, max 3 short sentences, one tiny everyday example, no technical terms unless absolutely unavoidable (and if used, define them in the same breath).\nReturn {"explanation":"..."}`;
    const ai = await callJson(system, prompt);
    if (ai.explanation && ai.explanation.length > 20) return { text: ai.explanation.slice(0, 600), generationMode: 'ai' };
  } catch (_) {}
  return { text: fallbackSimplerExplanation(topic), generationMode: 'fallback' };
}


// ---------- Animation (honest scope): AI-planned step sequence, rendered
// client-side as an auto-advancing frame-by-frame visual walkthrough — real
// but simple (not smooth motion-graphics, which needs a rendering pipeline
// this project doesn't run).
function fallbackAnimationSteps(topic) {
  return {
    title: `${topic} — step by step`,
    steps: [
      { label: 'Step 1', description: `Start with the initial state relevant to ${topic}.` },
      { label: 'Step 2', description: 'The key operation or action happens here.' },
      { label: 'Step 3', description: 'Observe what changes as a result.' },
      { label: 'Step 4', description: 'Compare the before and after to understand the concept.' }
    ]
  };
}
async function generateAnimationSteps(topic, conceptType) {
  const fallback = fallbackAnimationSteps(topic);
  try {
    const system = `You create a step-by-step visual walkthrough plan for a teaching animation. Each step is one "frame" a student would see in sequence. ${UNTRUSTED_REFERENCE_RULES} Return JSON only.`;
    const prompt = `Topic: "${topic}" (${conceptType})\nCreate a 4-7 step visual walkthrough — concrete, specific to this topic (use actual variable names/values/nodes where relevant, not generic placeholders). Each step: a short label (2-4 words) and a one-sentence description of what the student sees happening at that moment.\nReturn {"title":"...","steps":[{"label":"...","description":"..."}]}`;
    const ai = await callJson(system, prompt);
    if (Array.isArray(ai.steps) && ai.steps.length >= 3) {
      return { title: String(ai.title || fallback.title).slice(0, 100), steps: ai.steps.slice(0, 8).map((s) => ({ label: String(s.label || '').slice(0, 30), description: String(s.description || '').slice(0, 160) })), generationMode: 'ai' };
    }
  } catch (_) {}
  return { ...fallback, generationMode: 'fallback' };
}

// ---------- Quick Quiz (standalone — no saved resource needed) ----------
function fallbackQuiz(topic) {
  return {
    questions: [
      { question: `What best describes ${topic}?`, options: ['A core concept covered in this topic', 'An unrelated idea', 'A syntax error', 'A hardware component'], correctIndex: 0, explanation: 'Review the text explanation and diagram above.' }
    ]
  };
}
async function generateQuickQuiz(topic, conceptType) {
  const fallback = fallbackQuiz(topic);
  try {
    const system = `You write short, fair multiple-choice quiz questions to check understanding of a concept just taught. ${UNTRUSTED_REFERENCE_RULES} Return JSON only.`;
    const prompt = `Topic: "${topic}" (${conceptType})\nWrite 4 multiple-choice questions (4 options each, one correct) that check real understanding, not just memorised terms. Include a one-sentence explanation for the correct answer.\nReturn {"questions":[{"question":"...","options":["...","...","...","..."],"correctIndex":0,"explanation":"..."}]}`;
    const ai = await callJson(system, prompt);
    if (Array.isArray(ai.questions) && ai.questions.length) {
      return { questions: ai.questions.slice(0, 6).map((q) => ({ question: String(q.question || '').slice(0, 200), options: (q.options || []).map((o) => String(o).slice(0, 100)).slice(0, 4), correctIndex: Math.min(3, Math.max(0, Number(q.correctIndex) || 0)), explanation: String(q.explanation || '').slice(0, 200) })), generationMode: 'ai' };
    }
  } catch (_) {}
  return { ...fallback, generationMode: 'fallback' };
}

// ---------- Orchestrator ----------
async function explainConcept(topic) {
  const analysis = await analyzeConcept(topic);
  const modes = new Set(analysis.recommendedModes);
  const result = { topic, analysis };

  if (modes.has('text')) result.textExplanation = await generateTextExplanation(topic, analysis.conceptType);
  if (modes.has('diagram')) {
    const plan = await diagramPlan(analysis.diagramType, topic, analysis.conceptType);
    result.diagram = { type: analysis.diagramType, plan, svg: renderDiagramSvg(plan, analysis.diagramType) };
  }
  if (modes.has('animation')) result.animation = await generateAnimationSteps(topic, analysis.conceptType);
  if (modes.has('quiz')) result.quiz = await generateQuickQuiz(topic, analysis.conceptType);
  // 'voice' mode needs no server work — the frontend reads result.textExplanation
  // aloud using the same free browser TTS built for Presenter Avatar (Lite).

  return result;
}

module.exports = { analyzeConcept, generateTextExplanation, simplifyExplanation, generateAnimationSteps, generateQuickQuiz, explainConcept, ALL_MODES, EXPLANATION_STRATEGIES };
