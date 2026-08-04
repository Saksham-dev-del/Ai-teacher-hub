function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function answerMatches(candidate, expected) {
  return normalizeText(candidate) === normalizeText(expected);
}

function gradeShortAnswer(question, answer) {
  const normalized = normalizeText(answer);
  if (!normalized) return { isCorrect: false, fraction: 0, feedback: 'No answer was submitted.' };

  const accepted = [question.correctAnswer, ...(question.acceptedAnswers || [])]
    .flat()
    .map(normalizeText)
    .filter(Boolean);

  if (accepted.some((item) => normalized === item)) {
    return { isCorrect: true, fraction: 1, feedback: 'Correct answer.' };
  }

  const keywords = (question.keywords || []).map(normalizeText).filter(Boolean);
  if (!keywords.length) {
    const expectedWords = normalizeText(question.correctAnswer).split(' ').filter((w) => w.length > 3);
    const overlap = expectedWords.filter((word) => normalized.includes(word)).length;
    const ratio = expectedWords.length ? overlap / expectedWords.length : 0;
    return {
      isCorrect: ratio >= 0.75,
      fraction: ratio >= 0.75 ? 1 : ratio >= 0.45 ? 0.5 : 0,
      feedback: ratio >= 0.75 ? 'Answer contains the expected core idea.' : 'Answer is missing important expected concepts.'
    };
  }

  const matched = keywords.filter((keyword) => normalized.includes(keyword)).length;
  const ratio = matched / keywords.length;
  return {
    isCorrect: ratio >= 0.75,
    fraction: ratio >= 0.75 ? 1 : ratio >= 0.5 ? 0.5 : 0,
    feedback: ratio >= 0.75
      ? 'Answer includes the required key concepts.'
      : `Matched ${matched} of ${keywords.length} expected key concepts.`
  };
}

function gradeQuestion(question, answer) {
  const marks = Math.max(1, Number(question.marks || 1));
  let result;

  if (question.type === 'short') {
    result = gradeShortAnswer(question, answer);
  } else if (Array.isArray(question.correctAnswer)) {
    const expected = question.correctAnswer.map(normalizeText).sort();
    const submitted = (Array.isArray(answer) ? answer : [answer]).map(normalizeText).filter(Boolean).sort();
    const exact = expected.length === submitted.length && expected.every((value, index) => value === submitted[index]);
    result = { isCorrect: exact, fraction: exact ? 1 : 0, feedback: exact ? 'Correct answer.' : 'Incorrect answer.' };
  } else {
    const correct = answerMatches(answer, question.correctAnswer);
    result = { isCorrect: correct, fraction: correct ? 1 : 0, feedback: correct ? 'Correct answer.' : 'Incorrect answer.' };
  }

  return {
    isCorrect: result.isCorrect,
    awardedMarks: Math.round(marks * result.fraction * 100) / 100,
    maxMarks: marks,
    feedback: result.feedback,
    bloomLevel: question.bloomLevel || '',
    courseOutcome: question.courseOutcome || ''
  };
}

function gradeAttempt(quiz, submittedAnswers) {
  const answerMap = new Map();
  if (Array.isArray(submittedAnswers)) {
    submittedAnswers.forEach((item) => answerMap.set(String(item.questionId || ''), item.answer));
  } else if (submittedAnswers && typeof submittedAnswers === 'object') {
    Object.entries(submittedAnswers).forEach(([key, value]) => answerMap.set(String(key), value));
  }

  const results = (quiz.questions || []).map((question) => {
    const questionId = String(question._id);
    const answer = answerMap.get(questionId) ?? '';
    const graded = gradeQuestion(question, answer);
    return {
      questionId: question._id,
      answer,
      ...graded,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation || ''
    };
  });

  const score = results.reduce((sum, item) => sum + Number(item.awardedMarks || 0), 0);
  const totalMarks = results.reduce((sum, item) => sum + Number(item.maxMarks || 0), 0);
  const percentage = totalMarks ? Math.round((score / totalMarks) * 10000) / 100 : 0;
  return {
    results,
    score: Math.round(score * 100) / 100,
    totalMarks,
    percentage,
    passed: percentage >= Number(quiz.passPercentage || 40)
  };
}

module.exports = { normalizeText, gradeQuestion, gradeAttempt };
