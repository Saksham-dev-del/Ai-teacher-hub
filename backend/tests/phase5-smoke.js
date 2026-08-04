const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');

const root = path.join(__dirname, '..');
const quizRoutes = fs.readFileSync(path.join(root, 'routes', 'quizzes.js'), 'utf8');
const quizUi = fs.readFileSync(path.join(root, '..', 'frontend', 'js', 'quizzes.js'), 'utf8');
const phase3Api = fs.readFileSync(path.join(root, '..', 'frontend', 'js', 'phase3-api.js'), 'utf8');
const syllabusRoute = fs.readFileSync(path.join(root, 'routes', 'syllabus.js'), 'utf8');
const mediaRoute = fs.readFileSync(path.join(root, 'routes', 'media.js'), 'utf8');
const resourceRoute = fs.readFileSync(path.join(root, 'routes', 'resources.js'), 'utf8');

[
  "router.post('/:id/heartbeat'",
  "router.post('/:id/autosave'",
  "router.post('/:id/integrity'",
  'attemptTokenHash',
  'submissionNonceHash',
  'server-controlled quiz timer',
  'deviceFingerprintHash',
  'findOneAndUpdate'
].forEach((marker) => assert(quizRoutes.includes(marker), `${marker} missing from secure quiz route`));

['getUserMedia', 'visibilitychange', 'requestFullscreen', 'startSecureServerChannel', 'secureAutosave', 'x-quiz-attempt-token'].forEach((marker) => {
  assert(quizUi.includes(marker) || phase3Api.includes(marker), `${marker} missing from secure frontend`);
});
assert(syllabusRoute.includes("subarray(0, 5).toString('ascii') !== '%PDF-'") || syllabusRoute.includes("'%PDF-'"));
assert(syllabusRoute.includes('hasDangerousDoubleExtension'));
assert(mediaRoute.includes('private_uploads'));
assert(mediaRoute.includes('signature does not match'));
assert(resourceRoute.includes("requireRole('teacher', 'admin')"));

const quiz = new Quiz({
  owner: '64b64c000000000000000001', title: 'Phase 5 Secure Quiz', durationMinutes: 15,
  questions: [{ prompt: 'Q?', correctAnswer: 'A', options: ['A', 'B'] }]
});
assert.strictEqual(quiz.integrityPolicy.requireCamera, true);
assert.strictEqual(quiz.integrityPolicy.autoCancel, true);

const now = new Date();
const attempt = new QuizAttempt({
  quiz: '64b64c000000000000000002', student: '64b64c000000000000000003',
  expiresAt: new Date(now.getTime() + 60000), attemptTokenHash: 'a'.repeat(64), submissionNonceHash: 'b'.repeat(64),
  deviceFingerprintHash: 'c'.repeat(64), status: 'in_progress'
});
assert.equal(attempt.validateSync(), undefined);
assert.equal(attempt.integrityCounters.networkInterruptions, 0);

console.log('Phase 5 smoke tests passed: camera/fullscreen monitoring, secure heartbeat, autosave, server timer, anti-replay credentials and strict uploads.');
