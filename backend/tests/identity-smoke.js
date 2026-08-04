const assert = require('assert');
const fs = require('fs');
const path = require('path');
process.env.JWT_SECRET = process.env.JWT_SECRET || 'j'.repeat(64);
process.env.AUDIT_HASH_SECRET = process.env.AUDIT_HASH_SECRET || 'a'.repeat(64);
process.env.FACE_IDENTITY_SECRET = process.env.FACE_IDENTITY_SECRET || 'f'.repeat(64);

const {
  encryptDescriptor,
  decryptPayload,
  descriptorSimilarity,
  createIdentityProof,
  verifyIdentityProof
} = require('../services/identity');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const StudentIdentity = require('../models/StudentIdentity');

const base = Array.from({ length: 1024 }, (_, index) => Math.sin(index / 17) * 0.01);
const near = base.map((value, index) => value + Math.sin(index / 29) * 0.0002);
const far = base.map((value, index) => value + (index % 2 ? 0.5 : -0.5));
const encrypted = encryptDescriptor(base);
const decrypted = decryptPayload(encrypted.ciphertext, encrypted.iv, encrypted.tag);
assert.strictEqual(decrypted.length, 1024);
assert.ok(descriptorSimilarity(base, near) > 0.8, 'Near descriptors should match.');
assert.ok(descriptorSimilarity(base, far) < 0.55, 'Far descriptors should not match.');
const proof = createIdentityProof({ studentId: 'student-1', quizId: 'quiz-1', deviceFingerprintHash: 'device-hash', similarity: 0.82, identityVersion: 2 });
const verified = verifyIdentityProof(proof, { studentId: 'student-1', quizId: 'quiz-1', deviceFingerprintHash: 'device-hash', minimumSimilarity: 0.55 });
assert.ok(verified && verified.identityVersion === 2, 'Identity proof should verify.');
assert.strictEqual(verifyIdentityProof(proof, { studentId: 'other', quizId: 'quiz-1', deviceFingerprintHash: 'device-hash', minimumSimilarity: 0.55 }), null);

assert.ok(Quiz.schema.path('integrityPolicy.requireIdentityVerification'));
assert.ok(Quiz.schema.path('integrityPolicy.identityMatchThreshold'));
assert.ok(QuizAttempt.schema.path('identityChecks'));
assert.ok(QuizAttempt.schema.path('identityVerified'));
assert.ok(StudentIdentity.schema.path('descriptorCiphertext'));
assert.ok(StudentIdentity.schema.path('status'));

const routes = fs.readFileSync(path.join(__dirname, '..', 'routes', 'quizzes.js'), 'utf8');
['/identity/enroll', '/identity/pending', '/identity-check', '/identity-recheck', 'verifyIdentityProof'].forEach((marker) => assert.ok(routes.includes(marker), `Missing route marker ${marker}`));
const frontend = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'js', 'identity.js'), 'utf8');
['collectIdentitySample', 'prepareQuizIdentityProof', 'performContinuousIdentityRecheck', 'apiIdentityApprove'].forEach((marker) => assert.ok(frontend.includes(marker), `Missing frontend marker ${marker}`));
['facemesh.json', 'iris.json', 'faceres.json', 'antispoof.json', 'liveness.json'].forEach((name) => assert.ok(fs.existsSync(path.join(__dirname, '..', '..', 'frontend', 'models', name)), `Missing model ${name}`));

console.log('PASS encrypted identity enrollment, signed proof, model schemas, routes, local models and continuous recheck smoke tests');
