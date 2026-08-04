const assert = require('assert');
const { validateBlueprint, allocateMarks, buildQuestionPaper, fallbackAcademic, attendanceReminder, ACTIONS } = require('../services/academicSuite');

const blueprint = [
  { unit: 'Unit 1', topic: 'Statistics', marks: 20, difficulty: 'Easy' },
  { unit: 'Unit 2', topic: 'EDA', marks: 15, difficulty: 'Medium' },
  { unit: 'Unit 3', topic: 'Supervised Learning', marks: 15, difficulty: 'Advanced' }
];
const valid = validateBlueprint(blueprint, 50);
assert.strictEqual(valid.valid, true);
assert.strictEqual(valid.allocatedMarks, 50);
assert.strictEqual(validateBlueprint(blueprint, 60).valid, false);

const allocations = allocateMarks(17, ['MCQ', '2 marks', '5 marks', '10 marks']);
assert.strictEqual(allocations.reduce((a, b) => a + b, 0), 17);

const paper = buildQuestionPaper({
  course: 'B.Tech', subject: 'Machine Learning', examType: 'Mid-Term', totalMarks: 50, durationMinutes: 90,
  blueprint, questionTypes: ['MCQ', '2 marks', '5 marks', '10 marks', 'Case study']
});
assert.strictEqual(paper.totals.marks, 50);
assert.strictEqual(paper.blueprintValidation.valid, true);
assert(paper.questions.length >= 5);
assert.strictEqual(paper.answerKey.length, paper.questions.length);

for (const action of ACTIONS.filter((x) => x !== 'question-paper')) {
  const out = fallbackAcademic(action, {
    course: 'B.Tech', subject: 'Programming', topic: 'Python Loops', units: 'Unit 1\nUnit 2\nUnit 3', assignmentTitle: 'Loop Project', totalMarks: 100,
    examDate: new Date(Date.now() + 7 * 86400000).toISOString(), dailyMinutes: 60, programmingLanguage: 'Python', programCount: 10
  });
  assert(out.title, `${action} should have title`);
}

const reminder = attendanceReminder({ subject: 'DBMS', topic: 'Normalization' }, 'Student One');
assert(reminder.message.includes('Normalization'));
assert(reminder.suggestedActions.length >= 2);

console.log('Phase 8 smoke tests passed: blueprint validation, exact-mark paper, planners, rubric, revision, case study, coding labs and reminders.');
