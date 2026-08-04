const mongoose = require('mongoose');

const integrityEventSchema = new mongoose.Schema({
  type: { type: String, required: true },
  severity: { type: String, enum: ['info', 'warning', 'severe'], default: 'warning' },
  message: { type: String, default: '' },
  clientTimestamp: { type: Date, default: null },
  serverTimestamp: { type: Date, default: Date.now },
  sequence: { type: Number, default: 0 },
  requestId: { type: String, default: '' },
  meta: { type: mongoose.Schema.Types.Mixed, default: undefined }
}, { _id: false });

const answerSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
  answer: { type: mongoose.Schema.Types.Mixed, default: '' },
  isCorrect: { type: Boolean, default: false },
  awardedMarks: { type: Number, default: 0 },
  maxMarks: { type: Number, default: 0 },
  feedback: { type: String, default: '' },
  bloomLevel: { type: String, default: '' },
  courseOutcome: { type: String, default: '' }
}, { _id: false });

const draftAnswerSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
  answer: { type: mongoose.Schema.Types.Mixed, default: '' }
}, { _id: false });

const attemptSchema = new mongoose.Schema({
  quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true, index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  attemptNumber: { type: Number, min: 1, default: 1 },
  status: { type: String, enum: ['in_progress', 'submitted', 'expired', 'cancelled'], default: 'in_progress', index: true },
  answers: { type: [answerSchema], default: [] },
  savedAnswers: { type: [draftAnswerSchema], default: [], select: false },
  score: { type: Number, default: 0 },
  totalMarks: { type: Number, default: 0 },
  percentage: { type: Number, default: 0 },
  passed: { type: Boolean, default: false },
  startedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, index: true },
  submittedAt: { type: Date, default: null },
  durationSeconds: { type: Number, default: 0 },

  // Server-issued attempt credentials. Raw values are never stored.
  attemptTokenHash: { type: String, required: true, select: false },
  submissionNonceHash: { type: String, required: true, select: false },
  tokenIssuedAt: { type: Date, default: Date.now },
  deviceFingerprintHash: { type: String, required: true, select: false },
  userAgentHash: { type: String, default: '', select: false },
  ipHash: { type: String, default: '', select: false },
  questionOrder: { type: [mongoose.Schema.Types.ObjectId], default: [] },
  optionOrder: { type: mongoose.Schema.Types.Mixed, default: undefined },
  heartbeatSequence: { type: Number, default: 0 },
  eventSequence: { type: Number, default: 0 },
  autosaveSequence: { type: Number, default: 0 },
  lastHeartbeatAt: { type: Date, default: Date.now },
  lastAutosaveAt: { type: Date, default: null },
  stateVersion: { type: Number, default: 0 },

  integrityStatus: { type: String, enum: ['clear', 'review', 'cancelled'], default: 'clear', index: true },
  integrityRiskScore: { type: Number, min: 0, max: 100, default: 0 },
  integrityEvents: { type: [integrityEventSchema], default: [] },
  integrityCounters: {
    tabSwitches: { type: Number, default: 0 },
    fullscreenExits: { type: Number, default: 0 },
    cameraInterruptions: { type: Number, default: 0 },
    blockedActions: { type: Number, default: 0 },
    faceAbsenceEvents: { type: Number, default: 0 },
    multipleFaceEvents: { type: Number, default: 0 },
    networkInterruptions: { type: Number, default: 0 },
    deviceMismatches: { type: Number, default: 0 },
    replayedRequests: { type: Number, default: 0 },
    identityMismatches: { type: Number, default: 0 },
    livenessFailures: { type: Number, default: 0 }
  },
  cancellationReason: { type: String, default: '' },
  cancelledAt: { type: Date, default: null },
  proctoringConsent: { type: Boolean, default: false },
  cameraEnabled: { type: Boolean, default: false },
  fullscreenEnabled: { type: Boolean, default: false },
  clientContext: { type: mongoose.Schema.Types.Mixed, default: undefined },

  identityVerified: { type: Boolean, default: false },
  identityProfileVersion: { type: Number, default: 0 },
  initialIdentityScore: { type: Number, min: 0, max: 1, default: 0 },
  lastIdentityScore: { type: Number, min: 0, max: 1, default: 0 },
  lastIdentityCheckAt: { type: Date, default: null },
  identityCheckSequence: { type: Number, default: 0 },
  identityConsecutiveFailures: { type: Number, default: 0 },
  identityChecks: { type: [{
    checkedAt: { type: Date, default: Date.now },
    similarity: { type: Number, min: 0, max: 1, default: 0 },
    livenessScore: { type: Number, min: 0, max: 1, default: 0 },
    antiSpoofScore: { type: Number, min: 0, max: 1, default: 0 },
    status: { type: String, enum: ['verified', 'recheck', 'mismatch', 'liveness_failed'], default: 'verified' },
    sequence: { type: Number, default: 0 }
  }, { _id: false }], default: [] }
});

attemptSchema.index({ quiz: 1, student: 1, attemptNumber: 1 }, { unique: true });
attemptSchema.index({ student: 1, submittedAt: -1 });
attemptSchema.index({ status: 1, expiresAt: 1 });
attemptSchema.index({ quiz: 1, student: 1, status: 1 });

module.exports = mongoose.model('QuizAttempt', attemptSchema);
