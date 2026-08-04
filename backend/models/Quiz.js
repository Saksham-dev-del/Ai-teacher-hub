const mongoose = require('mongoose');


const integrityPolicySchema = new mongoose.Schema({
  enabled: { type: Boolean, default: true },
  requireCamera: { type: Boolean, default: true },
  requireFullscreen: { type: Boolean, default: true },
  autoCancel: { type: Boolean, default: true },
  maxTabSwitches: { type: Number, min: 0, max: 20, default: 0 },
  maxFullscreenExits: { type: Number, min: 0, max: 20, default: 0 },
  maxCameraInterruptions: { type: Number, min: 0, max: 20, default: 1 },
  blockClipboard: { type: Boolean, default: true },
  blockContextMenu: { type: Boolean, default: true },
  blockKeyboardShortcuts: { type: Boolean, default: true },
  detectCameraObstruction: { type: Boolean, default: true },
  detectFacePresence: { type: Boolean, default: true },
  requireSecureBrowser: { type: Boolean, default: true },
  cameraGraceSeconds: { type: Number, min: 5, max: 120, default: 15 },
  cancelOnFaceMissing: { type: Boolean, default: true },
  faceAbsenceGraceSeconds: { type: Number, min: 2, max: 60, default: 2 },
  requireFaceDetector: { type: Boolean, default: true },
  requireIdentityVerification: { type: Boolean, default: false },
  requireLivenessCheck: { type: Boolean, default: true },
  autoCancelOnIdentityMismatch: { type: Boolean, default: true },
  identityMatchThreshold: { type: Number, min: 0.35, max: 0.95, default: 0.55 },
  identityMismatchLimit: { type: Number, min: 1, max: 5, default: 2 },
  identityRecheckMinSeconds: { type: Number, min: 8, max: 120, default: 15 },
  identityRecheckMaxSeconds: { type: Number, min: 12, max: 300, default: 35 },
  livenessThreshold: { type: Number, min: 0.1, max: 0.95, default: 0.4 }
}, { _id: false });

const quizQuestionSchema = new mongoose.Schema({
  prompt: { type: String, required: true, trim: true },
  type: { type: String, enum: ['mcq', 'true_false', 'short'], default: 'mcq' },
  options: { type: [String], default: [] },
  correctAnswer: { type: mongoose.Schema.Types.Mixed, required: true, select: false },
  acceptedAnswers: { type: [String], default: [], select: false },
  keywords: { type: [String], default: [], select: false },
  marks: { type: Number, min: 1, max: 20, default: 1 },
  explanation: { type: String, default: '', select: false },
  bloomLevel: { type: String, default: 'Understand' },
  courseOutcome: { type: String, default: '' }
}, { _id: true });

const quizSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sourceResource: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource', default: null },
  title: { type: String, required: true, trim: true, maxlength: 220 },
  description: { type: String, default: '', maxlength: 1200 },
  course: { type: String, default: '' },
  subject: { type: String, default: '' },
  topic: { type: String, default: '' },
  difficulty: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced'], default: 'Intermediate' },
  durationMinutes: { type: Number, min: 1, max: 240, default: 15 },
  passPercentage: { type: Number, min: 0, max: 100, default: 40 },
  maxAttempts: { type: Number, min: 1, max: 20, default: 3 },
  shuffleQuestions: { type: Boolean, default: true },
  showAnswersAfterSubmit: { type: Boolean, default: true },
  revealAnswersAfterFinalAttempt: { type: Boolean, default: true },
  integrityPolicy: { type: integrityPolicySchema, default: () => ({}) },
  published: { type: Boolean, default: false, index: true },
  questions: { type: [quizQuestionSchema], validate: [(v) => Array.isArray(v) && v.length > 0, 'At least one question is required.'] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

quizSchema.pre('save', function setUpdatedAt(next) {
  this.updatedAt = new Date();
  next();
});

quizSchema.virtual('totalMarks').get(function totalMarks() {
  return (this.questions || []).reduce((sum, q) => sum + Number(q.marks || 0), 0);
});

quizSchema.set('toJSON', { virtuals: true });
quizSchema.set('toObject', { virtuals: true });
quizSchema.index({ owner: 1, createdAt: -1 });
quizSchema.index({ published: 1, course: 1, subject: 1, createdAt: -1 });

module.exports = mongoose.model('Quiz', quizSchema);
