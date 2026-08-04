const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { gradeQuestion, gradeAttempt } = require('../services/grading');
const { sanitizeQuizQuestions, fallbackQuestions } = require('../services/quiz');
const { buildPresentation } = require('../services/presentation');
const Quiz = require('../models/Quiz');
const LessonEvent = require('../models/LessonEvent');

async function run() {
  const mcq = gradeQuestion({ type: 'mcq', correctAnswer: 'Pandas', marks: 2 }, 'Pandas');
  assert.equal(mcq.isCorrect, true);
  assert.equal(mcq.awardedMarks, 2);

  const short = gradeQuestion({ type: 'short', correctAnswer: 'Supervised learning uses labelled data', keywords: ['labelled', 'data'], marks: 4 }, 'It trains from labelled data.');
  assert.equal(short.isCorrect, true);
  assert.equal(short.awardedMarks, 4);

  const fakeQuiz = {
    passPercentage: 50,
    questions: [
      { _id: '000000000000000000000001', type: 'mcq', correctAnswer: 'A', marks: 1, bloomLevel: 'Remember' },
      { _id: '000000000000000000000002', type: 'true_false', correctAnswer: 'True', marks: 1, bloomLevel: 'Understand' }
    ]
  };
  const graded = gradeAttempt(fakeQuiz, [
    { questionId: '000000000000000000000001', answer: 'A' },
    { questionId: '000000000000000000000002', answer: 'False' }
  ]);
  assert.equal(graded.score, 1);
  assert.equal(graded.percentage, 50);
  assert.equal(graded.passed, true);

  const questions = sanitizeQuizQuestions([{ prompt: 'Python is interpreted.', type: 'true_false', correctAnswer: 'True', marks: 1 }]);
  assert.equal(questions.length, 1);
  assert.deepEqual(questions[0].options, ['True', 'False']);

  const resource = {
    topic: 'Machine Learning', course: 'B.Tech', subject: 'ML', difficulty: 'Intermediate',
    sections: [
      { h: 'Supervised Learning', b: 'Uses labelled examples for prediction.' },
      { h: 'Unsupervised Learning', b: 'Finds patterns without labelled outputs.' },
      { h: 'Clustering', b: 'Groups similar observations.' },
      { h: 'Regression', b: 'Predicts continuous target values.' }
    ],
    bloomQuestions: [{ level: 'Apply', question: 'Choose an algorithm for labelled data.', answer: 'A supervised learning algorithm.' }]
  };
  assert.ok(fallbackQuestions(resource, 5).length >= 4);

  const quizModel = new Quiz({
    owner: '000000000000000000000010', title: 'Smoke Quiz', questions: questions.map((q) => ({ ...q, correctAnswer: q.correctAnswer }))
  });
  assert.equal(quizModel.validateSync(), undefined);

  const eventModel = new LessonEvent({
    owner: '000000000000000000000010', title: 'ML Lecture', start: new Date(), end: new Date(Date.now() + 3600000)
  });
  assert.equal(eventModel.validateSync(), undefined);

  const ppt = await buildPresentation({
    type: 'Lesson Plan', topic: 'Machine Learning Foundations', course: 'B.Tech', subject: 'Machine Learning', difficulty: 'Intermediate',
    sections: resource.sections,
    courseOutcomes: [{ code: 'CO1', text: 'Explain major learning paradigms.' }],
    bloomQuestions: [{ level: 'Apply', question: 'Select a learning paradigm for a labelled dataset.' }],
    coMapping: [{ courseOutcome: 'CO1', bloomLevels: ['Understand', 'Apply'], alignmentScore: 88, justification: 'The content and questions support the outcome.' }],
    qualityScore: { overall: 91, strengths: ['Clear structure'], improvements: ['Add a dataset example'] }
  }, { theme: 'academic' });
  assert.ok(Buffer.isBuffer(ppt));
  assert.ok(ppt.length > 25000);
  assert.equal(ppt.slice(0, 2).toString(), 'PK');

  const root = path.join(__dirname, '..', '..');
  const html = fs.readFileSync(path.join(root, 'frontend', 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'frontend', 'css', 'styles.css'), 'utf8');
  const motion = fs.readFileSync(path.join(root, 'frontend', 'vendor', 'motion-umd.js'), 'utf8');
  ['view-quizzes', 'view-presentations', 'view-calendar', 'Performance Analytics'].forEach((marker) => assert.ok(html.includes(marker), `${marker} missing`));
  ['quiz-attempt-stage', 'ppt-studio-grid', 'calendar-grid', 'performance-grid'].forEach((marker) => assert.ok(css.includes(marker), `${marker} CSS missing`));
  assert.ok(motion.includes('global.Motion'));

  console.log('Phase 3 smoke tests passed: grading, quiz sanitation/fallback, schemas, PPTX generation, UI modules and Motion vendor.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
