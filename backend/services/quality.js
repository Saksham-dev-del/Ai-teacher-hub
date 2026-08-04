function clamp(value, min = 0, max = 100) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function flattenContent(result) {
  const parts = [];
  for (const section of result.sections || []) parts.push(`${section.h || ''} ${section.b || ''}`);
  for (const item of result.qa || []) parts.push(`${item.q || ''} ${item.a || ''}`);
  for (const item of result.bloomQuestions || []) parts.push(`${item.level || ''} ${item.question || ''} ${item.answer || ''}`);
  return parts.join(' ').trim();
}

function sentenceStats(text) {
  const sentences = String(text || '').split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  const words = String(text || '').split(/\s+/).filter(Boolean);
  return {
    sentences: sentences.length,
    words: words.length,
    averageWordsPerSentence: sentences.length ? words.length / sentences.length : words.length
  };
}

function gradeFor(score) {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Very Good';
  if (score >= 70) return 'Good';
  if (score >= 60) return 'Needs Review';
  return 'Improve Before Use';
}

function buildQualityScore(result, inputs, grounding) {
  const text = flattenContent(result);
  const stats = sentenceStats(text);
  const mainItemCount = (result.sections || []).length + (result.qa || []).length;
  const requestedBloom = Array.isArray(inputs.bloomLevels) ? inputs.bloomLevels.length : 0;
  const actualBloomLevels = new Set((result.bloomQuestions || []).map((q) => String(q.level || '').toLowerCase()));
  const mappedOutcomes = (result.coMapping || []).filter((item) => item.courseOutcome).length;
  const outcomes = (result.courseOutcomes || []).length;
  const sourceTags = text.match(/\[S\d+\]/g) || [];

  const completeness = clamp(45 + Math.min(35, mainItemCount * 7) + Math.min(20, stats.words / 45));
  const clarity = clamp(stats.averageWordsPerSentence >= 8 && stats.averageWordsPerSentence <= 24
    ? 92
    : 92 - Math.abs(stats.averageWordsPerSentence - 16) * 2.1);
  const bloomAlignment = requestedBloom
    ? clamp((actualBloomLevels.size / requestedBloom) * 100)
    : clamp(actualBloomLevels.size ? 85 : 72);
  const outcomeAlignment = outcomes ? clamp((mappedOutcomes / outcomes) * 100) : 70;
  const syllabusGrounding = grounding && grounding.chunks && grounding.chunks.length
    ? clamp(55 + Math.min(30, grounding.coverage * 0.3) + Math.min(15, sourceTags.length * 3))
    : 68;

  const deterministic = Math.round(
    completeness * 0.23 +
    clarity * 0.17 +
    bloomAlignment * 0.19 +
    outcomeAlignment * 0.21 +
    syllabusGrounding * 0.20
  );

  const review = result.qualityReview || {};
  const aiAverage = ['accuracy', 'clarity', 'alignment', 'pedagogicalValue']
    .map((key) => Number(review[key]))
    .filter(Number.isFinite)
    .reduce((acc, value, _, arr) => acc + value / arr.length, 0);
  const overall = clamp(aiAverage ? deterministic * 0.7 + aiAverage * 0.3 : deterministic);

  const strengths = Array.isArray(review.strengths) ? review.strengths.slice(0, 3) : [];
  const improvements = Array.isArray(review.improvements) ? review.improvements.slice(0, 3) : [];
  if (!strengths.length) strengths.push('Clear structure', 'Course-aligned learning flow');
  if (!improvements.length) improvements.push('Teacher should verify domain facts and examples before classroom use.');

  return {
    overall,
    grade: gradeFor(overall),
    metrics: {
      completeness,
      clarity,
      bloomAlignment,
      outcomeAlignment,
      syllabusGrounding
    },
    strengths,
    improvements,
    teacherReviewRequired: true
  };
}

module.exports = { buildQualityScore };
