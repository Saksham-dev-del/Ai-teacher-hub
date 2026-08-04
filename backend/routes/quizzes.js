const express = require('express');
const crypto = require('crypto');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const Resource = require('../models/Resource');
const StudentIdentity = require('../models/StudentIdentity');
const { requireAuth, requireRole } = require('../middleware/auth');
const { generateAssessmentQuiz } = require('../providers');
const { sanitizeQuizQuestions, fallbackQuestions, quizPromptFromResource } = require('../services/quiz');
const { gradeAttempt } = require('../services/grading');
const {
  sha256,
  randomToken,
  timingSafeEqualText,
  cleanText,
  clientIdentity,
  deviceFingerprintHash,
  writeAudit,
  createSecurityAlert
} = require('../services/security');
const {
  encryptDescriptor, decryptDescriptor, encryptSelfie, decryptSelfie, descriptorSimilarity, sanitizeDescriptor,
  createIdentityProof, verifyIdentityProof, safeIdentity
} = require('../services/identity');

const router = express.Router();
router.use(requireAuth);

const ANSWER_SELECT = '+questions.correctAnswer +questions.acceptedAnswers +questions.keywords +questions.explanation';
const ATTEMPT_SECRET_SELECT = '+attemptTokenHash +submissionNonceHash +deviceFingerprintHash +userAgentHash +ipHash +savedAnswers';
const SUBMIT_GRACE_SECONDS = Math.max(0, Math.min(Number(process.env.QUIZ_SUBMISSION_GRACE_SECONDS || 5), 30));

function isOwnerOrAdmin(doc, user) {
  return user.role === 'admin' || String(doc.owner) === String(user._id);
}

function cleanString(value, max = 500) {
  return cleanText(value, max);
}

const DEFAULT_INTEGRITY_POLICY = Object.freeze({
  enabled: true,
  requireCamera: true,
  requireFullscreen: true,
  autoCancel: true,
  maxTabSwitches: 0,
  maxFullscreenExits: 0,
  maxCameraInterruptions: 1,
  blockClipboard: true,
  blockContextMenu: true,
  blockKeyboardShortcuts: true,
  detectCameraObstruction: true,
  detectFacePresence: true,
  requireSecureBrowser: true,
  cameraGraceSeconds: 15,
  cancelOnFaceMissing: true,
  faceAbsenceGraceSeconds: 2,
  requireFaceDetector: true,
  requireIdentityVerification: false,
  requireLivenessCheck: true,
  autoCancelOnIdentityMismatch: true,
  identityMatchThreshold: 0.55,
  identityMismatchLimit: 2,
  identityRecheckMinSeconds: 15,
  identityRecheckMaxSeconds: 35,
  livenessThreshold: 0.4
});

function sanitizeIntegrityPolicy(value) {
  const input = value && typeof value === 'object' ? value : {};
  const requireIdentityVerification = input.requireIdentityVerification === true;
  return {
    enabled: input.enabled !== false,
    requireCamera: requireIdentityVerification || input.requireCamera !== false,
    requireFullscreen: input.requireFullscreen !== false,
    autoCancel: input.autoCancel !== false,
    maxTabSwitches: Math.max(0, Math.min(Number(input.maxTabSwitches ?? 0), 20)),
    maxFullscreenExits: Math.max(0, Math.min(Number(input.maxFullscreenExits ?? 0), 20)),
    maxCameraInterruptions: Math.max(0, Math.min(Number(input.maxCameraInterruptions ?? 1), 20)),
    blockClipboard: input.blockClipboard !== false,
    blockContextMenu: input.blockContextMenu !== false,
    blockKeyboardShortcuts: input.blockKeyboardShortcuts !== false,
    detectCameraObstruction: input.detectCameraObstruction !== false,
    detectFacePresence: input.detectFacePresence !== false,
    requireSecureBrowser: input.requireSecureBrowser !== false,
    cameraGraceSeconds: Math.max(5, Math.min(Number(input.cameraGraceSeconds ?? 15), 120)),
    cancelOnFaceMissing: input.cancelOnFaceMissing !== false,
    faceAbsenceGraceSeconds: Math.max(2, Math.min(Number(input.faceAbsenceGraceSeconds ?? 2), 60)),
    requireFaceDetector: input.requireFaceDetector !== false,
    requireIdentityVerification,
    requireLivenessCheck: input.requireLivenessCheck !== false,
    autoCancelOnIdentityMismatch: input.autoCancelOnIdentityMismatch !== false,
    identityMatchThreshold: Math.max(0.35, Math.min(Number(input.identityMatchThreshold ?? 0.55), 0.95)),
    identityMismatchLimit: Math.max(1, Math.min(Number(input.identityMismatchLimit ?? 2), 5)),
    identityRecheckMinSeconds: Math.max(8, Math.min(Number(input.identityRecheckMinSeconds ?? 15), 120)),
    identityRecheckMaxSeconds: Math.max(12, Math.min(Number(input.identityRecheckMaxSeconds ?? 35), 300)),
    livenessThreshold: Math.max(0.1, Math.min(Number(input.livenessThreshold ?? 0.4), 0.95))
  };
}

function integrityPolicyFor(quiz) {
  return { ...DEFAULT_INTEGRITY_POLICY, ...(quiz.integrityPolicy?.toObject ? quiz.integrityPolicy.toObject() : quiz.integrityPolicy || {}) };
}

function totalQuizMarks(quiz) {
  return (quiz.questions || []).reduce((sum, q) => sum + Number(q.marks || 0), 0);
}

function shuffled(items) {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function publicQuestion(question, includeAnswers = false, orderedOptions = null) {
  const base = {
    id: String(question._id),
    prompt: question.prompt,
    type: question.type,
    options: orderedOptions || question.options || [],
    marks: question.marks,
    bloomLevel: question.bloomLevel || '',
    courseOutcome: question.courseOutcome || ''
  };
  if (includeAnswers) {
    base.correctAnswer = question.correctAnswer;
    base.acceptedAnswers = question.acceptedAnswers || [];
    base.keywords = question.keywords || [];
    base.explanation = question.explanation || '';
  }
  return base;
}

function serializeQuiz(quiz, { includeAnswers = false, includeQuestions = true, attempt = null } = {}) {
  const doc = quiz.toObject ? quiz.toObject({ virtuals: true }) : quiz;
  let questions = doc.questions || [];
  if (attempt?.questionOrder?.length) {
    const byId = new Map(questions.map((q) => [String(q._id), q]));
    questions = attempt.questionOrder.map((id) => byId.get(String(id))).filter(Boolean);
  }
  return {
    id: String(doc._id),
    title: doc.title,
    description: doc.description || '',
    course: doc.course || '',
    subject: doc.subject || '',
    topic: doc.topic || '',
    difficulty: doc.difficulty || 'Intermediate',
    durationMinutes: Number(doc.durationMinutes || 15),
    passPercentage: Number(doc.passPercentage || 40),
    maxAttempts: Number(doc.maxAttempts || 3),
    shuffleQuestions: Boolean(doc.shuffleQuestions),
    showAnswersAfterSubmit: Boolean(doc.showAnswersAfterSubmit),
    revealAnswersAfterFinalAttempt: doc.revealAnswersAfterFinalAttempt !== false,
    integrityPolicy: { ...DEFAULT_INTEGRITY_POLICY, ...(doc.integrityPolicy || {}) },
    published: Boolean(doc.published),
    totalMarks: (doc.questions || []).reduce((sum, q) => sum + Number(q.marks || 0), 0),
    questionCount: (doc.questions || []).length,
    questions: includeQuestions ? questions.map((q) => publicQuestion(q, includeAnswers, attempt?.optionOrder?.[String(q._id)] || null)) : [],
    sourceResource: doc.sourceResource ? String(doc.sourceResource) : null,
    owner: doc.owner ? String(doc.owner) : null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt
  };
}

function publicAttempt(attempt) {
  return {
    _id: String(attempt._id),
    quiz: String(attempt.quiz),
    attemptNumber: attempt.attemptNumber,
    status: attempt.status,
    startedAt: attempt.startedAt,
    expiresAt: attempt.expiresAt,
    lastHeartbeatAt: attempt.lastHeartbeatAt,
    integrityStatus: attempt.integrityStatus,
    integrityRiskScore: attempt.integrityRiskScore,
    integrityCounters: attempt.integrityCounters,
    proctoringConsent: attempt.proctoringConsent,
    cameraEnabled: attempt.cameraEnabled,
    fullscreenEnabled: attempt.fullscreenEnabled,
    identityVerified: Boolean(attempt.identityVerified),
    identityProfileVersion: Number(attempt.identityProfileVersion || 0),
    initialIdentityScore: Number(attempt.initialIdentityScore || 0),
    lastIdentityScore: Number(attempt.lastIdentityScore || 0),
    lastIdentityCheckAt: attempt.lastIdentityCheckAt || null,
    savedAnswers: attempt.savedAnswers || []
  };
}

function makeAttemptCredentials() {
  const attemptToken = randomToken(40);
  const submissionNonce = randomToken(28);
  return {
    attemptToken,
    submissionNonce,
    attemptTokenHash: sha256(attemptToken),
    submissionNonceHash: sha256(submissionNonce)
  };
}

function clientFingerprint(req) {
  return cleanString(req.headers['x-device-fingerprint'] || req.body?.clientContext?.deviceFingerprint || req.body?.deviceFingerprint, 1000);
}

function answerPayload(value) {
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => cleanString(item, 800));
  return cleanString(value, 3000);
}

function sanitizeSubmittedAnswers(quiz, answers) {
  const allowed = new Set((quiz.questions || []).map((q) => String(q._id)));
  const seen = new Set();
  return (Array.isArray(answers) ? answers : []).slice(0, 200).map((item) => {
    const questionId = cleanString(item?.questionId, 80);
    if (!allowed.has(questionId) || seen.has(questionId)) return null;
    seen.add(questionId);
    return { questionId, answer: answerPayload(item?.answer) };
  }).filter(Boolean);
}

async function expireAttempt(attempt, quiz, reason = 'The server-controlled quiz timer expired.') {
  const now = new Date();
  attempt.status = 'expired';
  attempt.submittedAt = now;
  attempt.durationSeconds = Math.max(0, Math.round((now.getTime() - attempt.startedAt.getTime()) / 1000));
  attempt.totalMarks = quiz ? totalQuizMarks(quiz) : Number(attempt.totalMarks || 0);
  attempt.cancellationReason = reason;
  attempt.integrityStatus = attempt.integrityRiskScore >= 50 ? 'review' : attempt.integrityStatus;
  await attempt.save();
}

async function cancelAttempt(attempt, quiz, reason, req, alertType = 'quiz_integrity_cancel') {
  const now = new Date();
  attempt.status = 'cancelled';
  attempt.integrityStatus = 'cancelled';
  attempt.cancellationReason = cleanString(reason, 800);
  attempt.cancelledAt = now;
  attempt.submittedAt = now;
  attempt.score = 0;
  attempt.totalMarks = totalQuizMarks(quiz);
  attempt.percentage = 0;
  attempt.passed = false;
  attempt.durationSeconds = Math.max(0, Math.round((now.getTime() - attempt.startedAt.getTime()) / 1000));
  attempt.stateVersion = Number(attempt.stateVersion || 0) + 1;
  await attempt.save();
  await writeAudit({ req, actor: req.user, action: 'QUIZ_ATTEMPT_CANCELLED', outcome: 'blocked', severity: 'high', targetType: 'QuizAttempt', targetId: attempt._id, metadata: { reason, quizId: quiz._id } });
  await createSecurityAlert({ req, actor: req.user, type: alertType, title: 'Secure quiz attempt cancelled', description: reason, severity: 'high', targetType: 'QuizAttempt', targetId: attempt._id, metadata: { quizId: String(quiz._id), riskScore: attempt.integrityRiskScore } });
}

async function loadSecureAttempt(req, quizId, { requireNonce = false, allowExpiredGrace = false } = {}) {
  const attempt = await QuizAttempt.findOne({
    _id: req.body?.attemptId,
    quiz: quizId,
    student: req.user._id,
    status: 'in_progress'
  }).select(ATTEMPT_SECRET_SELECT);
  if (!attempt) return { error: [404, 'Active quiz attempt not found.'] };

  const token = cleanString(req.headers['x-quiz-attempt-token'], 300);
  if (!token || !timingSafeEqualText(sha256(token), attempt.attemptTokenHash)) {
    attempt.integrityCounters.replayedRequests = Number(attempt.integrityCounters?.replayedRequests || 0) + 1;
    attempt.markModified('integrityCounters');
    attempt.integrityRiskScore = Math.min(100, Number(attempt.integrityRiskScore || 0) + 35);
    await attempt.save();
    await createSecurityAlert({ req, actor: req.user, type: 'attempt_token_invalid', title: 'Invalid secure attempt token', description: 'A quiz operation was blocked because its server-issued attempt token was missing or invalid.', severity: 'critical', targetType: 'QuizAttempt', targetId: attempt._id });
    return { error: [403, 'Secure attempt token is invalid. The attempt has been flagged.'] };
  }

  if (requireNonce) {
    const nonce = cleanString(req.headers['x-quiz-submission-nonce'], 300);
    if (!nonce || !timingSafeEqualText(sha256(nonce), attempt.submissionNonceHash)) {
      await createSecurityAlert({ req, actor: req.user, type: 'submission_nonce_invalid', title: 'Invalid quiz submission nonce', description: 'A final submission was blocked because its one-time submission nonce was invalid.', severity: 'critical', targetType: 'QuizAttempt', targetId: attempt._id });
      return { error: [403, 'Submission authorization is invalid.'] };
    }
  }

  const identity = clientIdentity(req);
  const fingerprint = clientFingerprint(req);
  if (!fingerprint || deviceFingerprintHash(fingerprint) !== attempt.deviceFingerprintHash || (attempt.userAgentHash && attempt.userAgentHash !== identity.userAgentHash)) {
    attempt.integrityCounters.deviceMismatches = Number(attempt.integrityCounters?.deviceMismatches || 0) + 1;
    attempt.markModified('integrityCounters');
    attempt.integrityRiskScore = Math.min(100, Number(attempt.integrityRiskScore || 0) + 80);
    attempt.integrityStatus = 'review';
    await attempt.save();
    await createSecurityAlert({ req, actor: req.user, type: 'quiz_device_mismatch', title: 'Quiz device/session mismatch', description: 'The quiz request did not match the device/browser fingerprint bound at attempt start.', severity: 'critical', targetType: 'QuizAttempt', targetId: attempt._id });
    return { error: [403, 'This attempt is bound to another browser/device session.'] };
  }

  if (attempt.ipHash && attempt.ipHash !== identity.ipHash) {
    attempt.integrityRiskScore = Math.min(100, Number(attempt.integrityRiskScore || 0) + 15);
    attempt.integrityStatus = 'review';
    attempt.integrityEvents.push({ type: 'network_change', severity: 'info', message: 'Network address changed during the attempt.', serverTimestamp: new Date(), requestId: req.id });
    attempt.ipHash = identity.ipHash;
    await attempt.save();
  }

  const graceMs = allowExpiredGrace ? SUBMIT_GRACE_SECONDS * 1000 : 0;
  if (attempt.expiresAt.getTime() + graceMs < Date.now()) return { expired: true, attempt };
  return { attempt };
}

function sendSecureError(res, result) {
  if (!result?.error) return false;
  res.status(result.error[0]).json({ error: result.error[1] });
  return true;
}

router.get('/my/attempts', requireRole('student'), async (req, res, next) => {
  try {
    const attempts = await QuizAttempt.find({ student: req.user._id, status: { $in: ['submitted', 'cancelled', 'expired'] } })
      .populate('quiz', 'title course subject topic passPercentage')
      .sort({ submittedAt: -1 })
      .limit(100);
    res.json({ attempts });
  } catch (err) { next(err); }
});

router.post('/generate', requireRole('teacher', 'admin'), async (req, res, next) => {
  try {
    const { resourceId, questionCount, durationMinutes, difficulty, title, published } = req.body || {};
    if (!resourceId) return res.status(400).json({ error: 'Select a saved resource first.' });
    const resource = await Resource.findById(resourceId);
    if (!resource || !isOwnerOrAdmin(resource, req.user)) return res.status(404).json({ error: 'Resource not found.' });

    let generated = null;
    let generationMode = 'ai';
    let warning = '';
    try {
      generated = await generateAssessmentQuiz(quizPromptFromResource(resource, { questionCount, difficulty, objectiveOnly: true }));
    } catch (err) {
      generationMode = 'fallback';
      warning = `Gemini quiz generation was unavailable, so a deterministic quiz was created from the saved resource. ${err.message || ''}`.trim();
    }
    let questions = sanitizeQuizQuestions(generated?.questions || [], Math.max(4, Math.min(Number(questionCount || 10), 20)));
    if (questions.length < 4) {
      generationMode = 'fallback';
      questions = fallbackQuestions(resource, Math.max(4, Math.min(Number(questionCount || 10), 20)));
    }
    if (!questions.length) return res.status(422).json({ error: 'The selected resource does not contain enough content to build a quiz.' });

    const quiz = await Quiz.create({
      owner: req.user._id,
      sourceResource: resource._id,
      title: cleanString(title || generated?.title || `${resource.topic} — Smart Quiz`, 220),
      description: cleanString(generated?.description || `Auto-graded assessment generated from ${resource.type}: ${resource.topic}`, 1200),
      course: resource.course || '', subject: resource.subject || '', topic: resource.topic || '',
      difficulty: ['Beginner', 'Intermediate', 'Advanced'].includes(difficulty) ? difficulty : (resource.difficulty || 'Intermediate'),
      durationMinutes: Math.max(5, Math.min(Number(durationMinutes || 15), 180)),
      passPercentage: 40, maxAttempts: 3, shuffleQuestions: true, showAnswersAfterSubmit: true,
      revealAnswersAfterFinalAttempt: true,
      integrityPolicy: sanitizeIntegrityPolicy(req.body?.integrityPolicy),
      published: Boolean(published), questions
    });
    const fullQuiz = await Quiz.findById(quiz._id).select(ANSWER_SELECT);
    await writeAudit({ req, actor: req.user, action: 'QUIZ_CREATED', targetType: 'Quiz', targetId: quiz._id, metadata: { questionCount: questions.length, published: quiz.published } });
    res.status(201).json({ quiz: serializeQuiz(fullQuiz, { includeAnswers: true }), generationMode, warning });
  } catch (err) { next(err); }
});

router.post('/', requireRole('teacher', 'admin'), async (req, res, next) => {
  try {
    const questions = sanitizeQuizQuestions(req.body?.questions || [], 30);
    if (!questions.length) return res.status(400).json({ error: 'Add at least one valid question.' });
    const quiz = await Quiz.create({
      owner: req.user._id,
      title: cleanString(req.body.title || 'Untitled Quiz', 220),
      description: cleanString(req.body.description, 1200),
      course: cleanString(req.body.course, 100), subject: cleanString(req.body.subject, 160), topic: cleanString(req.body.topic, 220),
      difficulty: ['Beginner', 'Intermediate', 'Advanced'].includes(req.body.difficulty) ? req.body.difficulty : 'Intermediate',
      durationMinutes: Math.max(1, Math.min(Number(req.body.durationMinutes || 15), 240)),
      passPercentage: Math.max(0, Math.min(Number(req.body.passPercentage || 40), 100)),
      maxAttempts: Math.max(1, Math.min(Number(req.body.maxAttempts || 3), 20)),
      shuffleQuestions: req.body.shuffleQuestions !== false,
      showAnswersAfterSubmit: req.body.showAnswersAfterSubmit !== false,
      revealAnswersAfterFinalAttempt: req.body.revealAnswersAfterFinalAttempt !== false,
      integrityPolicy: sanitizeIntegrityPolicy(req.body.integrityPolicy),
      published: Boolean(req.body.published), questions
    });
    const fullQuiz = await Quiz.findById(quiz._id).select(ANSWER_SELECT);
    await writeAudit({ req, actor: req.user, action: 'QUIZ_CREATED', targetType: 'Quiz', targetId: quiz._id });
    res.status(201).json({ quiz: serializeQuiz(fullQuiz, { includeAnswers: true }) });
  } catch (err) { next(err); }
});

router.get('/', async (req, res, next) => {
  try {
    if (req.user.role === 'student') {
      const quizzes = await Quiz.find({ published: true }).sort({ createdAt: -1 }).limit(150);
      const attempts = await QuizAttempt.aggregate([
        { $match: { student: req.user._id } },
        { $group: { _id: '$quiz', attempts: { $sum: 1 }, cancelledAttempts: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } }, bestPercentage: { $max: { $cond: [{ $eq: ['$status', 'submitted'] }, '$percentage', null] } }, lastSubmittedAt: { $max: '$submittedAt' } } }
      ]);
      const attemptMap = new Map(attempts.map((item) => [String(item._id), item]));
      return res.json({ quizzes: quizzes.map((quiz) => ({ ...serializeQuiz(quiz, { includeQuestions: false }), attemptSummary: attemptMap.get(String(quiz._id)) || { attempts: 0, bestPercentage: null } })) });
    }

    const query = req.user.role === 'admin' && req.query.scope === 'all' ? {} : { owner: req.user._id };
    const quizzes = await Quiz.find(query).select(ANSWER_SELECT).sort({ createdAt: -1 }).limit(200);
    const ids = quizzes.map((quiz) => quiz._id);
    const attemptCounts = await QuizAttempt.aggregate([
      { $match: { quiz: { $in: ids }, status: { $in: ['submitted', 'cancelled', 'expired'] } } },
      { $group: { _id: '$quiz', attempts: { $sum: 1 }, averageScore: { $avg: '$percentage' }, uniqueStudents: { $addToSet: '$student' } } }
    ]);
    const countMap = new Map(attemptCounts.map((item) => [String(item._id), item]));
    res.json({ quizzes: quizzes.map((quiz) => {
      const stats = countMap.get(String(quiz._id));
      return { ...serializeQuiz(quiz, { includeAnswers: true }), stats: stats ? { attempts: stats.attempts, averageScore: Math.round(stats.averageScore * 10) / 10, uniqueStudents: stats.uniqueStudents.length } : { attempts: 0, averageScore: 0, uniqueStudents: 0 } };
    }) });
  } catch (err) { next(err); }
});


// ---------------------------------------------------------------------------
// Student identity enrollment, approval and face-match proof endpoints.
// Only one consented enrollment selfie is stored; continuous camera video is
// never uploaded or recorded. Face descriptors and the selfie are encrypted.
// ---------------------------------------------------------------------------
router.get('/identity/me', requireRole('student'), async (req, res, next) => {
  try {
    const identity = await StudentIdentity.findOne({ student: req.user._id }).select('+selfieCiphertext').populate('student', 'name email');
    res.json({ identity: safeIdentity(identity) });
  } catch (err) { next(err); }
});

router.post('/identity/enroll', requireRole('student'), async (req, res, next) => {
  try {
    if (req.body?.consent !== true) return res.status(400).json({ error: 'Explicit biometric enrollment consent is required.' });
    if (req.body?.challengePassed !== true) return res.status(400).json({ error: 'Live blink/liveness challenge was not completed.' });
    const descriptor = sanitizeDescriptor(req.body?.descriptor);
    const livenessScore = Math.max(0, Math.min(Number(req.body?.livenessScore || 0), 1));
    const antiSpoofScore = Math.max(0, Math.min(Number(req.body?.antiSpoofScore || 0), 1));
    if (livenessScore < 0.25 || antiSpoofScore < 0.25) return res.status(400).json({ error: 'Liveness or anti-spoof confidence was too low. Improve lighting and try again.' });
    const descriptorEncrypted = encryptDescriptor(descriptor);
    const selfieEncrypted = encryptSelfie(req.body?.selfieDataUrl);
    const existing = await StudentIdentity.findOne({ student: req.user._id });
    const nextVersion = Number(existing?.version || 0) + 1;
    const identity = existing || new StudentIdentity({ student: req.user._id });
    identity.descriptorCiphertext = descriptorEncrypted.ciphertext;
    identity.descriptorIv = descriptorEncrypted.iv;
    identity.descriptorTag = descriptorEncrypted.tag;
    identity.descriptorLength = descriptor.length;
    identity.selfieCiphertext = selfieEncrypted.ciphertext;
    identity.selfieIv = selfieEncrypted.iv;
    identity.selfieTag = selfieEncrypted.tag;
    identity.selfieMime = selfieEncrypted.mime;
    identity.livenessScore = livenessScore;
    identity.antiSpoofScore = antiSpoofScore;
    identity.challengeType = cleanString(req.body?.challengeType || 'blink', 80);
    identity.challengePassed = true;
    identity.consentAt = new Date();
    identity.enrolledAt = new Date();
    identity.status = 'pending';
    identity.verifiedBy = null;
    identity.verifiedAt = null;
    identity.rejectedBy = null;
    identity.rejectedAt = null;
    identity.rejectionReason = '';
    identity.version = nextVersion;
    await identity.save();
    await writeAudit({ req, actor: req.user, action: 'STUDENT_FACE_IDENTITY_ENROLLED', targetType: 'StudentIdentity', targetId: identity._id, metadata: { version: nextVersion, livenessScore, antiSpoofScore } });
    res.status(existing ? 200 : 201).json({ identity: safeIdentity(identity), message: 'Face identity submitted for teacher/admin verification.' });
  } catch (err) { next(err); }
});

router.get('/identity/pending', requireRole('teacher', 'admin'), async (req, res, next) => {
  try {
    const identities = await StudentIdentity.find({ status: { $in: ['pending', 'verified', 'rejected'] } })
      .select('+selfieCiphertext')
      .populate('student', 'name email role isActive')
      .sort({ status: 1, updatedAt: -1 })
      .limit(250);
    res.json({ identities: identities.map(safeIdentity) });
  } catch (err) { next(err); }
});

router.get('/identity/student/:studentId/selfie', async (req, res, next) => {
  try {
    const isSelf = req.user.role === 'student' && String(req.user._id) === String(req.params.studentId);
    if (!isSelf && !['teacher', 'admin'].includes(req.user.role)) return res.status(403).json({ error: 'Identity image access is restricted.' });
    const identity = await StudentIdentity.findOne({ student: req.params.studentId }).select('+selfieCiphertext +selfieIv +selfieTag');
    if (!identity) return res.status(404).json({ error: 'Identity enrollment not found.' });
    const selfie = decryptSelfie(identity);
    if (!selfie) return res.status(404).json({ error: 'Enrollment selfie not available.' });
    res.setHeader('Content-Type', selfie.mime);
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('Content-Disposition', 'inline; filename="identity-selfie.jpg"');
    res.end(selfie.bytes);
  } catch (err) { next(err); }
});

router.post('/identity/student/:studentId/approve', requireRole('teacher', 'admin'), async (req, res, next) => {
  try {
    const identity = await StudentIdentity.findOne({ student: req.params.studentId }).select('+selfieCiphertext').populate('student', 'name email');
    if (!identity) return res.status(404).json({ error: 'Identity enrollment not found.' });
    identity.status = 'verified';
    identity.verifiedBy = req.user._id;
    identity.verifiedAt = new Date();
    identity.rejectedBy = null;
    identity.rejectedAt = null;
    identity.rejectionReason = '';
    await identity.save();
    await writeAudit({ req, actor: req.user, action: 'STUDENT_FACE_IDENTITY_APPROVED', targetType: 'StudentIdentity', targetId: identity._id, metadata: { studentId: req.params.studentId, version: identity.version } });
    res.json({ identity: safeIdentity(identity) });
  } catch (err) { next(err); }
});

router.post('/identity/student/:studentId/reject', requireRole('teacher', 'admin'), async (req, res, next) => {
  try {
    const identity = await StudentIdentity.findOne({ student: req.params.studentId }).select('+selfieCiphertext').populate('student', 'name email');
    if (!identity) return res.status(404).json({ error: 'Identity enrollment not found.' });
    identity.status = 'rejected';
    identity.rejectedBy = req.user._id;
    identity.rejectedAt = new Date();
    identity.rejectionReason = cleanString(req.body?.reason || 'Enrollment requires a clearer, supervised re-capture.', 800);
    identity.verifiedBy = null;
    identity.verifiedAt = null;
    await identity.save();
    await writeAudit({ req, actor: req.user, action: 'STUDENT_FACE_IDENTITY_REJECTED', outcome: 'blocked', severity: 'warning', targetType: 'StudentIdentity', targetId: identity._id, metadata: { studentId: req.params.studentId, reason: identity.rejectionReason } });
    res.json({ identity: safeIdentity(identity) });
  } catch (err) { next(err); }
});

router.post('/:id/identity-check', requireRole('student'), async (req, res, next) => {
  try {
    const quiz = await Quiz.findOne({ _id: req.params.id, published: true });
    if (!quiz) return res.status(404).json({ error: 'Quiz is not available.' });
    const policy = integrityPolicyFor(quiz);
    if (!policy.requireIdentityVerification) return res.json({ required: false, verified: true, identityProofToken: '' });
    const fingerprint = clientFingerprint(req);
    if (fingerprint.length < 16) return res.status(400).json({ error: 'Secure device fingerprint is missing.' });
    const identity = await StudentIdentity.findOne({ student: req.user._id, status: 'verified' }).select('+descriptorCiphertext +descriptorIv +descriptorTag');
    if (!identity) return res.status(403).json({ error: 'A teacher/admin-verified student face identity is required before this quiz can start.', code: 'IDENTITY_NOT_VERIFIED' });
    const current = sanitizeDescriptor(req.body?.descriptor);
    const livenessScore = Math.max(0, Math.min(Number(req.body?.livenessScore || 0), 1));
    const antiSpoofScore = Math.max(0, Math.min(Number(req.body?.antiSpoofScore || 0), 1));
    if (policy.requireLivenessCheck && (livenessScore < policy.livenessThreshold || antiSpoofScore < policy.livenessThreshold)) {
      await createSecurityAlert({ req, actor: req.user, type: 'identity_liveness_failed', title: 'Quiz identity liveness check failed', description: 'The initial live identity verification did not meet the configured liveness threshold.', severity: 'high', targetType: 'Quiz', targetId: quiz._id, metadata: { livenessScore, antiSpoofScore } });
      return res.status(403).json({ error: 'Live identity verification failed. Use good lighting, face the camera and try again.', code: 'LIVENESS_FAILED' });
    }
    const registered = decryptDescriptor(identity);
    const similarity = descriptorSimilarity(registered, current);
    if (similarity < policy.identityMatchThreshold) {
      await createSecurityAlert({ req, actor: req.user, type: 'identity_start_mismatch', title: 'Different person may be attempting quiz', description: 'The live face did not match the teacher-approved student identity.', severity: 'critical', targetType: 'Quiz', targetId: quiz._id, metadata: { similarity, threshold: policy.identityMatchThreshold } });
      await writeAudit({ req, actor: req.user, action: 'QUIZ_IDENTITY_START_BLOCKED', outcome: 'blocked', severity: 'critical', targetType: 'Quiz', targetId: quiz._id, metadata: { similarity, threshold: policy.identityMatchThreshold } });
      return res.status(403).json({ error: 'Face identity did not match the registered student. The quiz cannot start.', code: 'IDENTITY_MISMATCH', similarity });
    }
    identity.lastMatchedAt = new Date();
    identity.lastMatchScore = similarity;
    await identity.save();
    const identityProofToken = createIdentityProof({ studentId: req.user._id, quizId: quiz._id, deviceFingerprintHash: deviceFingerprintHash(fingerprint), similarity, identityVersion: identity.version });
    res.json({ required: true, verified: true, similarity, identityProofToken, identityVersion: identity.version, livenessScore, antiSpoofScore });
  } catch (err) { next(err); }
});

router.post('/:id/identity-recheck', requireRole('student'), async (req, res, next) => {
  try {
    const secured = await loadSecureAttempt(req, req.params.id);
    if (sendSecureError(res, secured)) return;
    const attempt = secured.attempt;
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ error: 'Quiz not found.' });
    if (secured.expired) {
      await expireAttempt(attempt, quiz);
      return res.status(410).json({ error: 'Quiz time expired.', expired: true });
    }
    const policy = integrityPolicyFor(quiz);
    if (!policy.requireIdentityVerification) return res.json({ required: false, verified: true, cancelled: false });
    const sequence = Number(req.body?.sequence || 0);
    if (!Number.isInteger(sequence) || sequence <= Number(attempt.identityCheckSequence || 0)) return res.status(409).json({ error: 'Identity-check sequence is stale.' });
    attempt.identityCheckSequence = sequence;
    const identity = await StudentIdentity.findOne({ student: req.user._id, status: 'verified' }).select('+descriptorCiphertext +descriptorIv +descriptorTag');
    if (!identity || Number(identity.version || 0) !== Number(attempt.identityProfileVersion || 0)) {
      await cancelAttempt(attempt, quiz, 'Verified student identity is missing or changed during the active attempt.', req, 'identity_profile_changed');
      return res.json({ cancelled: true, cancellationReason: attempt.cancellationReason });
    }
    const current = sanitizeDescriptor(req.body?.descriptor);
    const livenessScore = Math.max(0, Math.min(Number(req.body?.livenessScore || 0), 1));
    const antiSpoofScore = Math.max(0, Math.min(Number(req.body?.antiSpoofScore || 0), 1));
    const similarity = descriptorSimilarity(decryptDescriptor(identity), current);
    const livenessFailed = policy.requireLivenessCheck && (livenessScore < policy.livenessThreshold || antiSpoofScore < policy.livenessThreshold);
    const mismatch = similarity < policy.identityMatchThreshold;
    const status = livenessFailed ? 'liveness_failed' : mismatch ? 'mismatch' : 'verified';
    attempt.identityChecks.push({ checkedAt: new Date(), similarity, livenessScore, antiSpoofScore, status, sequence });
    if (attempt.identityChecks.length > 100) attempt.identityChecks = attempt.identityChecks.slice(-100);
    attempt.lastIdentityCheckAt = new Date();
    attempt.lastIdentityScore = similarity;
    if (mismatch || livenessFailed) {
      attempt.identityConsecutiveFailures = Number(attempt.identityConsecutiveFailures || 0) + 1;
      attempt.integrityRiskScore = Math.min(100, Number(attempt.integrityRiskScore || 0) + (mismatch ? 60 : 45));
      if (mismatch) attempt.integrityCounters.identityMismatches = Number(attempt.integrityCounters?.identityMismatches || 0) + 1;
      if (livenessFailed) attempt.integrityCounters.livenessFailures = Number(attempt.integrityCounters?.livenessFailures || 0) + 1;
      attempt.markModified('integrityCounters');
      attempt.integrityEvents.push({ type: mismatch ? 'identity_mismatch' : 'liveness_failed', severity: 'severe', sequence, message: mismatch ? 'Live face did not match the verified student identity.' : 'Live anti-spoof/liveness confidence fell below the required threshold.', serverTimestamp: new Date(), requestId: req.id, meta: { similarity, threshold: policy.identityMatchThreshold, livenessScore, antiSpoofScore } });
    } else {
      attempt.identityConsecutiveFailures = 0;
      attempt.identityVerified = true;
      identity.lastMatchedAt = new Date();
      identity.lastMatchScore = similarity;
      await identity.save();
    }
    let cancellationReason = '';
    const severeMismatch = similarity < Math.max(0.2, policy.identityMatchThreshold - 0.25);
    if (policy.autoCancelOnIdentityMismatch && mismatch && (severeMismatch || attempt.identityConsecutiveFailures >= policy.identityMismatchLimit)) cancellationReason = 'The person in front of the camera did not match the verified student identity.';
    if (policy.autoCancelOnIdentityMismatch && livenessFailed && attempt.identityConsecutiveFailures >= policy.identityMismatchLimit) cancellationReason = 'Repeated live identity/liveness verification failed during the attempt.';
    if (cancellationReason) {
      await cancelAttempt(attempt, quiz, cancellationReason, req, 'quiz_identity_mismatch');
      return res.json({ cancelled: true, cancellationReason, similarity, livenessScore, antiSpoofScore });
    }
    attempt.integrityStatus = attempt.identityConsecutiveFailures > 0 ? 'review' : (attempt.integrityRiskScore >= 50 ? 'review' : 'clear');
    await attempt.save();
    res.json({
      required: true,
      verified: !mismatch && !livenessFailed,
      recheckRequired: mismatch || livenessFailed,
      cancelled: false,
      similarity,
      threshold: policy.identityMatchThreshold,
      livenessScore,
      antiSpoofScore,
      consecutiveFailures: attempt.identityConsecutiveFailures,
      integrityStatus: attempt.integrityStatus,
      riskScore: attempt.integrityRiskScore,
      counters: attempt.integrityCounters
    });
  } catch (err) { next(err); }
});

router.get('/:id/attempts', requireRole('teacher', 'admin'), async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz || !isOwnerOrAdmin(quiz, req.user)) return res.status(404).json({ error: 'Quiz not found.' });
    const attempts = await QuizAttempt.find({ quiz: quiz._id, status: { $in: ['submitted', 'cancelled', 'expired'] } })
      .populate('student', 'name email')
      .sort({ submittedAt: -1, cancelledAt: -1, startedAt: -1 });
    res.json({ attempts });
  } catch (err) { next(err); }
});

router.post('/:id/start', requireRole('student'), async (req, res, next) => {
  try {
    const quiz = await Quiz.findOne({ _id: req.params.id, published: true });
    if (!quiz) return res.status(404).json({ error: 'Quiz is not available.' });
    const fingerprint = clientFingerprint(req);
    if (fingerprint.length < 16) return res.status(400).json({ error: 'Secure device fingerprint is missing. Reload the page and try again.' });
    const policy = integrityPolicyFor(quiz);
    if (policy.enabled && !req.body?.proctoringConsent) return res.status(400).json({ error: 'Academic integrity consent is required before starting this proctored quiz.' });
    if (policy.enabled && policy.requireCamera && req.body?.cameraReady !== true) return res.status(400).json({ error: 'Camera permission and an active camera feed are required.' });
    if (policy.enabled && policy.requireFullscreen && req.body?.fullscreenReady !== true) return res.status(400).json({ error: 'Fullscreen secure mode is required.' });

    let verifiedIdentity = null;
    let identityProofPayload = null;
    if (policy.enabled && policy.requireIdentityVerification) {
      verifiedIdentity = await StudentIdentity.findOne({ student: req.user._id, status: 'verified' });
      if (!verifiedIdentity) return res.status(403).json({ error: 'A teacher/admin-verified face identity is required before starting this quiz.', code: 'IDENTITY_NOT_VERIFIED' });
      identityProofPayload = verifyIdentityProof(req.body?.identityProofToken, {
        studentId: req.user._id,
        quizId: quiz._id,
        deviceFingerprintHash: deviceFingerprintHash(fingerprint),
        minimumSimilarity: policy.identityMatchThreshold
      });
      if (!identityProofPayload || Number(identityProofPayload.identityVersion || 0) !== Number(verifiedIdentity.version || 0)) {
        return res.status(403).json({ error: 'Live identity proof is missing, expired or does not match this device. Verify your face again.', code: 'IDENTITY_PROOF_REQUIRED' });
      }
    }

    let active = await QuizAttempt.findOne({ quiz: quiz._id, student: req.user._id, status: 'in_progress' }).select(ATTEMPT_SECRET_SELECT).sort({ startedAt: -1 });
    if (active && active.expiresAt.getTime() < Date.now()) {
      await expireAttempt(active, quiz);
      active = null;
    }
    const identity = clientIdentity(req);
    const credentials = makeAttemptCredentials();

    if (active) {
      if (deviceFingerprintHash(fingerprint) !== active.deviceFingerprintHash || active.userAgentHash !== identity.userAgentHash) {
        await createSecurityAlert({ req, actor: req.user, type: 'attempt_resume_device_mismatch', title: 'Quiz resume blocked on a different device', description: 'An active quiz attempt was requested from a different browser/device fingerprint.', severity: 'critical', targetType: 'QuizAttempt', targetId: active._id });
        return res.status(403).json({ error: 'This active attempt can only be resumed from the browser/device where it started.' });
      }
      active.proctoringConsent = Boolean(req.body?.proctoringConsent);
      active.cameraEnabled = Boolean(req.body?.cameraReady);
      active.fullscreenEnabled = Boolean(req.body?.fullscreenReady);
      active.clientContext = req.body?.clientContext && typeof req.body.clientContext === 'object' ? req.body.clientContext : active.clientContext;
      if (policy.requireIdentityVerification) {
        active.identityVerified = true;
        active.identityProfileVersion = Number(verifiedIdentity.version || 0);
        active.initialIdentityScore = Number(identityProofPayload.similarity || 0);
        active.lastIdentityScore = Number(identityProofPayload.similarity || 0);
        active.lastIdentityCheckAt = new Date();
        active.identityConsecutiveFailures = 0;
      }
      active.attemptTokenHash = credentials.attemptTokenHash;
      active.submissionNonceHash = credentials.submissionNonceHash;
      active.tokenIssuedAt = new Date();
      active.lastHeartbeatAt = new Date();
      active.heartbeatSequence = 0;
      active.eventSequence = 0;
      active.autosaveSequence = 0;
      active.stateVersion = Number(active.stateVersion || 0) + 1;
      await active.save();
      return res.json({
        attempt: publicAttempt(active), quiz: serializeQuiz(quiz, { includeQuestions: true, attempt: active }), resumed: true,
        attemptToken: credentials.attemptToken, submissionNonce: credentials.submissionNonce,
        serverNow: new Date().toISOString(), serverDeadline: active.expiresAt.toISOString(), heartbeatIntervalSeconds: 12,
        identityRecheckMinSeconds: policy.identityRecheckMinSeconds, identityRecheckMaxSeconds: policy.identityRecheckMaxSeconds
      });
    }

    const attemptCount = await QuizAttempt.countDocuments({ quiz: quiz._id, student: req.user._id });
    if (attemptCount >= quiz.maxAttempts) return res.status(409).json({ error: `Maximum ${quiz.maxAttempts} attempts reached.` });
    const questionOrder = quiz.shuffleQuestions ? shuffled(quiz.questions.map((q) => q._id)) : quiz.questions.map((q) => q._id);
    const optionOrder = {};
    quiz.questions.forEach((q) => { optionOrder[String(q._id)] = quiz.shuffleQuestions && q.type !== 'short' ? shuffled(q.options || []) : (q.options || []); });
    const now = new Date();
    const expiresAt = new Date(now.getTime() + Number(quiz.durationMinutes || 15) * 60000);
    const attempt = await QuizAttempt.create({
      quiz: quiz._id, student: req.user._id, attemptNumber: attemptCount + 1,
      proctoringConsent: Boolean(req.body?.proctoringConsent), cameraEnabled: Boolean(req.body?.cameraReady), fullscreenEnabled: Boolean(req.body?.fullscreenReady),
      clientContext: req.body?.clientContext && typeof req.body.clientContext === 'object' ? req.body.clientContext : undefined,
      startedAt: now, expiresAt, questionOrder, optionOrder,
      attemptTokenHash: credentials.attemptTokenHash, submissionNonceHash: credentials.submissionNonceHash,
      deviceFingerprintHash: deviceFingerprintHash(fingerprint), userAgentHash: identity.userAgentHash, ipHash: identity.ipHash,
      lastHeartbeatAt: now,
      identityVerified: Boolean(policy.requireIdentityVerification),
      identityProfileVersion: policy.requireIdentityVerification ? Number(verifiedIdentity.version || 0) : 0,
      initialIdentityScore: policy.requireIdentityVerification ? Number(identityProofPayload.similarity || 0) : 0,
      lastIdentityScore: policy.requireIdentityVerification ? Number(identityProofPayload.similarity || 0) : 0,
      lastIdentityCheckAt: policy.requireIdentityVerification ? now : null,
      identityChecks: policy.requireIdentityVerification ? [{ checkedAt: now, similarity: Number(identityProofPayload.similarity || 0), livenessScore: Number(req.body?.identityLivenessScore || 0), antiSpoofScore: Number(req.body?.identityAntiSpoofScore || 0), status: 'verified', sequence: 0 }] : []
    });
    await writeAudit({ req, actor: req.user, action: 'QUIZ_ATTEMPT_STARTED', targetType: 'QuizAttempt', targetId: attempt._id, metadata: { quizId: quiz._id, attemptNumber: attempt.attemptNumber } });
    res.status(201).json({
      attempt: publicAttempt(attempt), quiz: serializeQuiz(quiz, { includeQuestions: true, attempt }), resumed: false,
      attemptToken: credentials.attemptToken, submissionNonce: credentials.submissionNonce,
      serverNow: now.toISOString(), serverDeadline: expiresAt.toISOString(), heartbeatIntervalSeconds: 12,
      identityRecheckMinSeconds: policy.identityRecheckMinSeconds, identityRecheckMaxSeconds: policy.identityRecheckMaxSeconds
    });
  } catch (err) { next(err); }
});

router.post('/:id/heartbeat', requireRole('student'), async (req, res, next) => {
  try {
    const secured = await loadSecureAttempt(req, req.params.id);
    if (sendSecureError(res, secured)) return;
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ error: 'Quiz not found.' });
    if (secured.expired) {
      await expireAttempt(secured.attempt, quiz);
      return res.status(410).json({ error: 'The server-controlled quiz timer has expired.', expired: true });
    }
    const attempt = secured.attempt;
    const sequence = Number(req.body?.sequence || 0);
    if (!Number.isInteger(sequence) || sequence <= Number(attempt.heartbeatSequence || 0)) {
      attempt.integrityCounters.replayedRequests = Number(attempt.integrityCounters?.replayedRequests || 0) + 1;
      attempt.markModified('integrityCounters');
      attempt.integrityRiskScore = Math.min(100, Number(attempt.integrityRiskScore || 0) + 10);
      await attempt.save();
      return res.status(409).json({ error: 'Heartbeat sequence was replayed or out of order.' });
    }
    attempt.heartbeatSequence = sequence;
    attempt.lastHeartbeatAt = new Date();
    const policy = integrityPolicyFor(quiz);
    let cancelReason = '';
    if (policy.enabled && policy.requireFullscreen && req.body?.fullscreen !== true) cancelReason = 'Required fullscreen state was not present during a server heartbeat.';
    if (policy.enabled && policy.requireCamera && req.body?.cameraActive !== true) cancelReason = 'Required camera state was not present during a server heartbeat.';
    let identityRecheckDue = false;
    if (policy.enabled && policy.requireIdentityVerification) {
      if (!attempt.identityVerified) cancelReason = 'The active attempt does not have a valid student identity lock.';
      const lastCheck = attempt.lastIdentityCheckAt ? attempt.lastIdentityCheckAt.getTime() : 0;
      const ageSeconds = lastCheck ? (Date.now() - lastCheck) / 1000 : Number.POSITIVE_INFINITY;
      identityRecheckDue = ageSeconds >= Number(policy.identityRecheckMaxSeconds || 35);
      const hardTimeout = Math.max(120, Number(policy.identityRecheckMaxSeconds || 35) * 4);
      if (ageSeconds > hardTimeout) cancelReason = 'Continuous student identity verification became stale for too long.';
    }
    if (cancelReason && policy.autoCancel) {
      await cancelAttempt(attempt, quiz, cancelReason, req, 'heartbeat_policy_failure');
      return res.json({ cancelled: true, cancellationReason: cancelReason, serverNow: new Date().toISOString() });
    }
    await attempt.save();
    res.json({
      ok: true, status: attempt.status, serverNow: new Date().toISOString(), serverDeadline: attempt.expiresAt.toISOString(),
      riskScore: attempt.integrityRiskScore, integrityStatus: attempt.integrityStatus, counters: attempt.integrityCounters,
      identityRecheckDue, lastIdentityCheckAt: attempt.lastIdentityCheckAt, lastIdentityScore: attempt.lastIdentityScore
    });
  } catch (err) { next(err); }
});

router.post('/:id/autosave', requireRole('student'), async (req, res, next) => {
  try {
    const secured = await loadSecureAttempt(req, req.params.id);
    if (sendSecureError(res, secured)) return;
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ error: 'Quiz not found.' });
    if (secured.expired) {
      await expireAttempt(secured.attempt, quiz);
      return res.status(410).json({ error: 'Quiz time expired.', expired: true });
    }
    const attempt = secured.attempt;
    const sequence = Number(req.body?.sequence || 0);
    if (!Number.isInteger(sequence) || sequence <= Number(attempt.autosaveSequence || 0)) return res.status(409).json({ error: 'Autosave sequence is stale.' });
    attempt.savedAnswers = sanitizeSubmittedAnswers(quiz, req.body?.answers || []);
    attempt.autosaveSequence = sequence;
    attempt.lastAutosaveAt = new Date();
    await attempt.save();
    res.json({ ok: true, savedAt: attempt.lastAutosaveAt, savedCount: attempt.savedAnswers.length });
  } catch (err) { next(err); }
});

router.post('/:id/integrity', requireRole('student'), async (req, res, next) => {
  try {
    const secured = await loadSecureAttempt(req, req.params.id);
    if (sendSecureError(res, secured)) return;
    const attempt = secured.attempt;
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ error: 'Quiz not found.' });
    if (secured.expired) {
      await expireAttempt(attempt, quiz);
      return res.status(410).json({ error: 'Quiz time expired.', expired: true });
    }
    const policy = integrityPolicyFor(quiz);
    if (!policy.enabled) return res.json({ cancelled: false, integrityStatus: 'clear', riskScore: 0, counters: attempt.integrityCounters });

    const allowed = new Set([
      'tab_hidden', 'window_blur', 'fullscreen_exit', 'copy_attempt', 'cut_attempt', 'paste_attempt', 'context_menu', 'restricted_shortcut',
      'camera_stopped', 'camera_muted', 'camera_obstructed', 'camera_permission_revoked', 'face_missing', 'face_missing_timeout', 'face_detector_unavailable', 'face_returned', 'multiple_faces', 'embedded_window',
      'automation_detected', 'network_offline', 'network_online', 'heartbeat_failed', 'devtools_layout_change', 'identity_engine_unavailable', 'identity_mismatch', 'identity_verified', 'liveness_failed'
    ]);
    const type = cleanString(req.body?.type, 80);
    if (!allowed.has(type)) return res.status(400).json({ error: 'Unknown integrity event.' });
    const sequence = Number(req.body?.sequence || 0);
    if (!Number.isInteger(sequence) || sequence <= Number(attempt.eventSequence || 0)) return res.status(409).json({ error: 'Integrity event sequence is stale.' });
    attempt.eventSequence = sequence;

    const defaults = {
      tab_hidden: ['warning', 35], window_blur: ['info', 5], fullscreen_exit: ['warning', 40], copy_attempt: ['warning', 10], cut_attempt: ['warning', 10],
      paste_attempt: ['warning', 15], context_menu: ['info', 5], restricted_shortcut: ['warning', 10], camera_stopped: ['severe', 70], camera_muted: ['warning', 35],
      camera_obstructed: ['warning', 45], camera_permission_revoked: ['severe', 80], face_missing: ['warning', 18], face_missing_timeout: ['severe', 100], face_detector_unavailable: ['severe', 100], face_returned: ['info', 0], multiple_faces: ['severe', 100],
      embedded_window: ['severe', 80], automation_detected: ['severe', 80], network_offline: ['warning', 15], network_online: ['info', 0], heartbeat_failed: ['warning', 20], devtools_layout_change: ['info', 5], identity_engine_unavailable: ['severe', 100], identity_mismatch: ['severe', 100], identity_verified: ['info', 0], liveness_failed: ['severe', 70]
    };
    const [defaultSeverity, risk] = defaults[type] || ['warning', 10];
    const severity = ['info', 'warning', 'severe'].includes(req.body?.severity) ? req.body.severity : defaultSeverity;
    attempt.integrityEvents.push({
      type, severity, sequence, requestId: req.id,
      message: cleanString(req.body?.message || type.replace(/_/g, ' '), 500),
      clientTimestamp: req.body?.clientTimestamp ? new Date(req.body.clientTimestamp) : null,
      serverTimestamp: new Date(),
      meta: req.body?.meta && typeof req.body.meta === 'object' ? req.body.meta : undefined
    });
    if (attempt.integrityEvents.length > 200) attempt.integrityEvents = attempt.integrityEvents.slice(-200);

    const counters = attempt.integrityCounters || {};
    if (type === 'tab_hidden') counters.tabSwitches = Number(counters.tabSwitches || 0) + 1;
    if (type === 'fullscreen_exit') counters.fullscreenExits = Number(counters.fullscreenExits || 0) + 1;
    if (['camera_stopped', 'camera_muted', 'camera_obstructed', 'camera_permission_revoked'].includes(type)) counters.cameraInterruptions = Number(counters.cameraInterruptions || 0) + 1;
    if (['copy_attempt', 'cut_attempt', 'paste_attempt', 'context_menu', 'restricted_shortcut'].includes(type)) counters.blockedActions = Number(counters.blockedActions || 0) + 1;
    if (['face_missing','face_missing_timeout'].includes(type)) counters.faceAbsenceEvents = Number(counters.faceAbsenceEvents || 0) + 1;
    if (type === 'multiple_faces') counters.multipleFaceEvents = Number(counters.multipleFaceEvents || 0) + 1;
    if (type === 'network_offline') counters.networkInterruptions = Number(counters.networkInterruptions || 0) + 1;
    if (type === 'identity_mismatch') counters.identityMismatches = Number(counters.identityMismatches || 0) + 1;
    if (type === 'liveness_failed') counters.livenessFailures = Number(counters.livenessFailures || 0) + 1;
    attempt.integrityCounters = counters;
    attempt.markModified('integrityCounters');
    attempt.integrityRiskScore = Math.min(100, Math.max(Number(attempt.integrityRiskScore || 0), 0) + risk);

    let cancellationReason = '';
    if (policy.autoCancel) {
      if (policy.requireCamera && ['camera_stopped', 'camera_permission_revoked'].includes(type)) cancellationReason = 'Required camera feed was stopped or permission was revoked.';
      else if (policy.detectFacePresence && type === 'multiple_faces') cancellationReason = 'More than one face was detected during the secure attempt.';
      else if (policy.detectFacePresence && policy.cancelOnFaceMissing && type === 'face_missing_timeout') cancellationReason = `No face remained visible for more than ${Number(policy.faceAbsenceGraceSeconds || 2)} seconds.`;
      else if (policy.detectFacePresence && policy.requireFaceDetector && type === 'face_detector_unavailable') cancellationReason = 'Required local face-detection engine became unavailable during the attempt.';
      else if (policy.requireIdentityVerification && type === 'identity_engine_unavailable') cancellationReason = 'Required local face-identity engine became unavailable during the attempt.';
      else if (policy.requireIdentityVerification && policy.autoCancelOnIdentityMismatch && type === 'identity_mismatch') cancellationReason = 'The live face did not match the verified student identity.';
      else if (Number(counters.tabSwitches || 0) > Number(policy.maxTabSwitches || 0)) cancellationReason = 'The allowed tab/window switch limit was exceeded.';
      else if (policy.requireFullscreen && Number(counters.fullscreenExits || 0) > Number(policy.maxFullscreenExits || 0)) cancellationReason = 'The allowed fullscreen-exit limit was exceeded.';
      else if (Number(counters.cameraInterruptions || 0) > Number(policy.maxCameraInterruptions || 0)) cancellationReason = 'The allowed camera interruption limit was exceeded.';
      else if (attempt.integrityRiskScore >= 100) cancellationReason = 'Multiple high-risk integrity events were detected.';
      else if (policy.requireSecureBrowser && ['embedded_window', 'automation_detected'].includes(type)) cancellationReason = 'The quiz was not running in an approved secure browser context.';
    }
    if (cancellationReason) await cancelAttempt(attempt, quiz, cancellationReason, req);
    else {
      attempt.integrityStatus = attempt.integrityRiskScore >= 50 ? 'review' : 'clear';
      await attempt.save();
    }
    res.json({
      cancelled: attempt.status === 'cancelled', integrityStatus: attempt.integrityStatus, riskScore: attempt.integrityRiskScore,
      counters: attempt.integrityCounters, message: cancellationReason || 'Integrity event recorded for teacher review.', cancellationReason
    });
  } catch (err) { next(err); }
});

router.post('/:id/submit', requireRole('student'), async (req, res, next) => {
  try {
    const secured = await loadSecureAttempt(req, req.params.id, { requireNonce: true, allowExpiredGrace: true });
    if (sendSecureError(res, secured)) return;
    const quiz = await Quiz.findById(req.params.id).select(ANSWER_SELECT);
    if (!quiz) return res.status(404).json({ error: 'Quiz not found.' });
    if (secured.expired) {
      await expireAttempt(secured.attempt, quiz);
      return res.status(410).json({ error: 'The server-controlled quiz timer expired before submission.', expired: true });
    }
    const attempt = secured.attempt;
    const sanitizedAnswers = sanitizeSubmittedAnswers(quiz, req.body?.answers || []);
    const graded = gradeAttempt(quiz, sanitizedAnswers);
    const now = new Date();
    const version = Number(attempt.stateVersion || 0);
    const answerDocs = graded.results.map(({ correctAnswer, explanation, ...item }) => item);
    const updated = await QuizAttempt.findOneAndUpdate(
      { _id: attempt._id, status: 'in_progress', stateVersion: version },
      { $set: {
        answers: answerDocs, savedAnswers: [], score: graded.score, totalMarks: graded.totalMarks, percentage: graded.percentage, passed: graded.passed,
        status: 'submitted', submittedAt: now, durationSeconds: Math.max(0, Math.round((now.getTime() - attempt.startedAt.getTime()) / 1000)),
        stateVersion: version + 1, submissionNonceHash: sha256(randomToken(28))
      } },
      { new: true }
    );
    if (!updated) return res.status(409).json({ error: 'This attempt was already submitted, cancelled or modified.' });

    const reveal = quiz.showAnswersAfterSubmit && (!quiz.revealAnswersAfterFinalAttempt || updated.attemptNumber >= quiz.maxAttempts);
    const review = graded.results.map((item) => ({
      questionId: String(item.questionId), answer: item.answer, isCorrect: item.isCorrect, awardedMarks: item.awardedMarks, maxMarks: item.maxMarks,
      feedback: item.feedback, bloomLevel: item.bloomLevel, courseOutcome: item.courseOutcome,
      ...(reveal ? { correctAnswer: item.correctAnswer, explanation: item.explanation } : {})
    }));
    await writeAudit({ req, actor: req.user, action: 'QUIZ_ATTEMPT_SUBMITTED', targetType: 'QuizAttempt', targetId: updated._id, metadata: { quizId: quiz._id, percentage: graded.percentage, integrityStatus: updated.integrityStatus } });
    res.json({ result: {
      attemptId: String(updated._id), attemptNumber: updated.attemptNumber, score: graded.score, totalMarks: graded.totalMarks, percentage: graded.percentage,
      passed: graded.passed, passPercentage: quiz.passPercentage, durationSeconds: updated.durationSeconds, integrityStatus: updated.integrityStatus,
      integrityRiskScore: updated.integrityRiskScore, integrityCounters: updated.integrityCounters, answersRevealed: reveal,
      answerRevealMessage: reveal ? 'Answer key shown because no protected future attempt remains.' : 'Correct answers remain protected until the final allowed attempt.', review
    } });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id).select(req.user.role === 'student' ? '' : ANSWER_SELECT);
    if (!quiz) return res.status(404).json({ error: 'Quiz not found.' });
    if (req.user.role === 'student' && !quiz.published) return res.status(403).json({ error: 'Quiz is not published.' });
    if (req.user.role !== 'student' && !isOwnerOrAdmin(quiz, req.user)) return res.status(403).json({ error: 'You do not have access to this quiz.' });
    res.json({ quiz: serializeQuiz(quiz, { includeAnswers: req.user.role !== 'student', includeQuestions: req.user.role !== 'student' }) });
  } catch (err) { next(err); }
});

router.patch('/:id', requireRole('teacher', 'admin'), async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id).select(ANSWER_SELECT);
    if (!quiz || !isOwnerOrAdmin(quiz, req.user)) return res.status(404).json({ error: 'Quiz not found.' });
    ['title', 'description', 'course', 'subject', 'topic'].forEach((field) => {
      if (req.body[field] !== undefined) quiz[field] = cleanString(req.body[field], field === 'description' ? 1200 : 220);
    });
    if (['Beginner', 'Intermediate', 'Advanced'].includes(req.body.difficulty)) quiz.difficulty = req.body.difficulty;
    if (req.body.durationMinutes !== undefined) quiz.durationMinutes = Math.max(1, Math.min(Number(req.body.durationMinutes), 240));
    if (req.body.passPercentage !== undefined) quiz.passPercentage = Math.max(0, Math.min(Number(req.body.passPercentage), 100));
    if (req.body.maxAttempts !== undefined) quiz.maxAttempts = Math.max(1, Math.min(Number(req.body.maxAttempts), 20));
    if (typeof req.body.published === 'boolean') quiz.published = req.body.published;
    if (typeof req.body.shuffleQuestions === 'boolean') quiz.shuffleQuestions = req.body.shuffleQuestions;
    if (typeof req.body.showAnswersAfterSubmit === 'boolean') quiz.showAnswersAfterSubmit = req.body.showAnswersAfterSubmit;
    if (typeof req.body.revealAnswersAfterFinalAttempt === 'boolean') quiz.revealAnswersAfterFinalAttempt = req.body.revealAnswersAfterFinalAttempt;
    if (req.body.integrityPolicy && typeof req.body.integrityPolicy === 'object') quiz.integrityPolicy = sanitizeIntegrityPolicy(req.body.integrityPolicy);
    if (Array.isArray(req.body.questions)) {
      const questions = sanitizeQuizQuestions(req.body.questions, 30);
      if (!questions.length) return res.status(400).json({ error: 'At least one valid question is required.' });
      quiz.questions = questions;
    }
    await quiz.save();
    await writeAudit({ req, actor: req.user, action: 'QUIZ_UPDATED', targetType: 'Quiz', targetId: quiz._id });
    res.json({ quiz: serializeQuiz(quiz, { includeAnswers: true }) });
  } catch (err) { next(err); }
});

router.delete('/:id', requireRole('teacher', 'admin'), async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz || !isOwnerOrAdmin(quiz, req.user)) return res.status(404).json({ error: 'Quiz not found.' });
    await Promise.all([Quiz.deleteOne({ _id: quiz._id }), QuizAttempt.deleteMany({ quiz: quiz._id })]);
    await writeAudit({ req, actor: req.user, action: 'QUIZ_DELETED', targetType: 'Quiz', targetId: quiz._id, severity: 'warning' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
