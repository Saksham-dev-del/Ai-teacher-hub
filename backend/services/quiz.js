const DEFAULT_BLOOM = ['Remember', 'Understand', 'Apply', 'Analyze'];

function clean(value, max = 500) {
  return String(value || '').trim().slice(0, max);
}

function safeOptions(options, correctAnswer) {
  const unique = [];
  [...(Array.isArray(options) ? options : []), correctAnswer]
    .map((item) => clean(item, 300))
    .filter(Boolean)
    .forEach((item) => {
      if (!unique.some((existing) => existing.toLowerCase() === item.toLowerCase())) unique.push(item);
    });
  return unique.slice(0, 6);
}

function sanitizeQuizQuestions(items, maxQuestions = 20) {
  return (Array.isArray(items) ? items : []).slice(0, maxQuestions).map((item, index) => {
    const type = ['mcq', 'true_false', 'short'].includes(item.type) ? item.type : 'mcq';
    let correctAnswer = item.correctAnswer ?? item.answer ?? '';
    if (type === 'true_false') correctAnswer = /true|yes|correct|1/i.test(String(correctAnswer)) ? 'True' : 'False';
    const options = type === 'true_false'
      ? ['True', 'False']
      : type === 'mcq'
        ? safeOptions(item.options, correctAnswer)
        : [];

    if (type === 'mcq' && options.length < 2) {
      options.push('None of the above');
    }

    return {
      prompt: clean(item.prompt || item.question || `Question ${index + 1}`, 1000),
      type,
      options,
      correctAnswer: clean(correctAnswer, 500),
      acceptedAnswers: (item.acceptedAnswers || []).map((v) => clean(v, 300)).filter(Boolean).slice(0, 8),
      keywords: (item.keywords || []).map((v) => clean(v, 80)).filter(Boolean).slice(0, 12),
      marks: Math.max(1, Math.min(Number(item.marks || 1), 20)),
      explanation: clean(item.explanation || item.rationale || '', 1200),
      bloomLevel: clean(item.bloomLevel || item.level || DEFAULT_BLOOM[index % DEFAULT_BLOOM.length], 40),
      courseOutcome: clean(item.courseOutcome || item.co || '', 40)
    };
  }).filter((item) => item.prompt && item.correctAnswer);
}

function resourceText(resource) {
  const sections = (resource.sections || []).map((s) => `${s.h}: ${s.b}`).join('\n');
  const qa = (resource.qa || []).map((q) => `${q.q} Answer: ${q.a}`).join('\n');
  const bloom = (resource.bloomQuestions || []).map((q) => `${q.level}: ${q.question} Answer: ${q.answer}`).join('\n');
  return [sections, qa, bloom].filter(Boolean).join('\n\n').slice(0, 16000);
}

function fallbackQuestions(resource, count = 8) {
  const bloom = resource.bloomQuestions || [];
  const qa = resource.qa || [];
  const sections = resource.sections || [];
  const pool = [];

  bloom.forEach((item, index) => {
    pool.push({
      prompt: item.question,
      type: 'short',
      correctAnswer: item.answer,
      acceptedAnswers: [],
      keywords: String(item.answer || '').split(/\s+/).filter((w) => w.length > 5).slice(0, 6),
      marks: 2,
      explanation: item.rationale || '',
      bloomLevel: item.level || DEFAULT_BLOOM[index % DEFAULT_BLOOM.length],
      courseOutcome: resource.courseOutcomes?.[index % Math.max(resource.courseOutcomes?.length || 1, 1)]?.code || ''
    });
  });

  qa.forEach((item, index) => {
    pool.push({
      prompt: item.q,
      type: 'short',
      correctAnswer: item.a,
      keywords: String(item.a || '').split(/\s+/).filter((w) => w.length > 5).slice(0, 6),
      marks: 2,
      explanation: item.a,
      bloomLevel: DEFAULT_BLOOM[index % DEFAULT_BLOOM.length],
      courseOutcome: ''
    });
  });

  sections.forEach((item, index) => {
    const correct = clean(item.h, 180);
    pool.push({
      prompt: `Which section best matches this description: “${clean(item.b, 220)}”?`,
      type: 'mcq',
      options: [correct, ...sections.filter((_, i) => i !== index).map((s) => clean(s.h, 180)).slice(0, 3)],
      correctAnswer: correct,
      marks: 1,
      explanation: clean(item.b, 700),
      bloomLevel: index % 2 ? 'Understand' : 'Remember',
      courseOutcome: ''
    });
  });

  return sanitizeQuizQuestions(pool, count);
}

function quizPromptFromResource(resource, settings = {}) {
  const count = Math.max(4, Math.min(Number(settings.questionCount || 10), 20));
  const objectiveTypes = settings.objectiveOnly === false ? 'MCQ, true/false, and short-answer' : 'MCQ and true/false';
  const outcomes = (resource.courseOutcomes || []).map((co) => `${co.code}: ${co.text}`).join('\n') || 'No explicit course outcomes supplied.';
  return [
    'Create a fully auto-gradable college quiz from the supplied academic resource.',
    `Title/topic: ${resource.topic}`,
    `Course: ${resource.course || ''}`,
    `Subject: ${resource.subject || ''}`,
    `Difficulty: ${settings.difficulty || resource.difficulty || 'Intermediate'}`,
    `Create exactly ${count} questions using ${objectiveTypes}.`,
    'Use plausible distractors, exactly one correct answer for each MCQ, and concise explanations.',
    'Distribute questions across Remember, Understand, Apply and Analyze levels where the content permits.',
    'Map questions to course outcomes when possible.',
    'Return raw JSON only with shape:',
    '{"title":"string","description":"string","questions":[{"prompt":"string","type":"mcq|true_false|short","options":["string"],"correctAnswer":"string","acceptedAnswers":["string"],"keywords":["string"],"marks":1,"explanation":"string","bloomLevel":"string","courseOutcome":"CO1"}]}',
    '',
    'COURSE OUTCOMES:', outcomes,
    '',
    'RESOURCE CONTENT:', resourceText(resource)
  ].join('\n');
}

module.exports = { sanitizeQuizQuestions, fallbackQuestions, quizPromptFromResource, resourceText };
