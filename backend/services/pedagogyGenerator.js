const { callJson } = require('./aiGateway');

function cleanArray(value, max = 12) {
  if (!Array.isArray(value)) return [];
  return value.map((x) => String(x || '').trim()).filter(Boolean).slice(0, max);
}

function fallbackPedagogy(inputs, sections) {
  const requested = cleanArray(inputs.bloomLevels, 6);
  const levels = requested.length ? requested : ['Remember', 'Understand', 'Apply', 'Analyze'];
  const outcomes = cleanArray(inputs.courseOutcomes, 8).map((text, i) => ({ code: `CO${i + 1}`, text }));
  if (!outcomes.length) {
    outcomes.push(
      { code: 'CO1', text: `Explain the fundamental concepts of ${inputs.topic}.` },
      { code: 'CO2', text: `Apply ${inputs.topic} to course-relevant problems.` },
      { code: 'CO3', text: `Analyze examples and justify decisions related to ${inputs.topic}.` }
    );
  }
  const count = Math.max(levels.length, Math.min(Number(inputs.bloomQuestionCount || 6), 12));
  const bloomQuestions = Array.from({ length: count }, (_, i) => {
    const level = levels[i % levels.length];
    return {
      level,
      question: `${level}: Explain or demonstrate ${inputs.topic} using the ideas covered in ${sections[i % Math.max(1, sections.length)]?.heading || 'the resource'}.`,
      answer: `A strong answer should define the relevant concept, use an appropriate example, and connect the response to ${inputs.subject}.`,
      rationale: `This prompt targets the ${level} level of Bloom's taxonomy.`
    };
  });
  const coMapping = outcomes.map((co, i) => ({
    courseOutcome: co.code,
    matchedSections: sections.filter((_, index) => index % outcomes.length === i).slice(0, 4).map((s) => s.heading),
    bloomLevels: [levels[i % levels.length]],
    justification: `The selected sections and assessment prompt support ${co.code}.`,
    alignmentScore: 82
  }));
  return { bloomQuestions, courseOutcomes: outcomes, coMapping, warnings: ['Pedagogy metadata used deterministic fallback.'] };
}

async function generatePedagogyMetadata(inputs, sections) {
  const system = 'You are an expert outcome-based education and assessment designer. Return valid JSON only.';
  const prompt = `
Create Bloom questions and course outcome mapping for this detailed academic resource.
Course: ${inputs.course}; Subject: ${inputs.subject}; Topic: ${inputs.topic}; Difficulty: ${inputs.difficulty}.
Selected Bloom levels: ${(inputs.bloomLevels || []).join(', ') || 'Remember, Understand, Apply, Analyze'}.
Question count: ${Math.max(4, Math.min(Number(inputs.bloomQuestionCount || 6), 12))}.
Faculty outcomes: ${(inputs.courseOutcomes || []).join(' | ') || 'Suggest 3 measurable outcomes'}.
Section headings: ${sections.map((s) => s.heading).join(' | ')}.

Return:
{
 "bloomQuestions":[{"level":"Remember|Understand|Apply|Analyze|Evaluate|Create","question":"string","answer":"string","rationale":"string"}],
 "courseOutcomes":[{"code":"CO1","text":"string"}],
 "coMapping":[{"courseOutcome":"CO1","matchedSections":["string"],"bloomLevels":["string"],"justification":"string","alignmentScore":85}],
 "qualityReview":{"accuracy":85,"clarity":85,"alignment":85,"pedagogicalValue":85,"strengths":["string"],"improvements":["string"]}
}
`;
  try {
    const parsed = await callJson(system, prompt);
    const bloomQuestions = (parsed.bloomQuestions || []).map((x) => ({ level: String(x.level || ''), question: String(x.question || ''), answer: String(x.answer || ''), rationale: String(x.rationale || '') })).filter((x) => x.question);
    const courseOutcomes = (parsed.courseOutcomes || []).map((x, i) => ({ code: String(x.code || `CO${i + 1}`), text: String(x.text || '') })).filter((x) => x.text).slice(0, 8);
    const coMapping = (parsed.coMapping || []).map((x) => ({ courseOutcome: String(x.courseOutcome || ''), matchedSections: cleanArray(x.matchedSections, 8), bloomLevels: cleanArray(x.bloomLevels, 6), justification: String(x.justification || ''), alignmentScore: Math.max(0, Math.min(100, Number(x.alignmentScore || 75))) })).filter((x) => x.courseOutcome).slice(0, 8);
    if (!bloomQuestions.length || !courseOutcomes.length) return fallbackPedagogy(inputs, sections);
    return { bloomQuestions, courseOutcomes, coMapping, qualityReview: parsed.qualityReview || {}, warnings: [] };
  } catch (error) {
    console.warn('[phase4/pedagogy] AI metadata unavailable:', error.message);
    return fallbackPedagogy(inputs, sections);
  }
}

module.exports = { generatePedagogyMetadata, fallbackPedagogy };
