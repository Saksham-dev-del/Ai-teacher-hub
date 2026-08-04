const assert = require('assert');
const { detectLearningLevel, fallbackPersonalized, resourceText, ACTIONS } = require('../services/personalization');

function mockAttempt(score, topic, bloom = 'Apply') {
  return {
    status: 'submitted', percentage: score, passed: score >= 40,
    quiz: { subject: 'Machine Learning', topic, title: topic },
    answers: [
      { bloomLevel: bloom, awardedMarks: score >= 60 ? 4 : 1, maxMarks: 5 },
      { bloomLevel: 'Understand', awardedMarks: score >= 50 ? 2 : 0, maxMarks: 2 }
    ]
  };
}

const advanced = detectLearningLevel([mockAttempt(92, 'Regression'), mockAttempt(86, 'Classification'), mockAttempt(84, 'Clustering')]);
assert.strictEqual(advanced.level, 'Advanced');
assert(advanced.averageScore >= 80);

const revision = detectLearningLevel([mockAttempt(22, 'Regression'), mockAttempt(30, 'Classification')]);
assert.strictEqual(revision.level, 'Needs revision');
assert(revision.weakTopics.length >= 1);

const beginner = detectLearningLevel([mockAttempt(50, 'Regression'), mockAttempt(55, 'Classification')]);
assert.strictEqual(beginner.level, 'Beginner');

const text = resourceText({ executiveSummary: 'Overview', sections: [{ h: 'Core', b: 'Detailed body' }], qa: [{ q: 'Question?', a: 'Answer' }] });
assert(text.includes('Detailed body'));

for (const action of ACTIONS) {
  const output = fallbackPersonalized(action, {
    course: 'B.Tech', subject: 'DBMS', topic: 'Normalization', classPerformance: 'Weak', teachingStyle: 'Practical', language: 'Hinglish', notesMode: 'Easy explanation notes', targetMode: 'Make it easier'
  }, 'Normalization reduces redundancy. Example tables and questions.');
  assert(output.title, `${action} should have a title`);
  assert(Array.isArray(output.sections), `${action} should have sections`);
  if (action === 'flashcards') assert(output.flashcards.length >= 5);
}

console.log('Phase 7 smoke tests passed: learning-level detection, adaptive generation actions, feedback and flashcards.');
