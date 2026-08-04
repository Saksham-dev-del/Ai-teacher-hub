const mongoose = require('mongoose');

const studentIdentitySchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  status: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending', index: true },
  descriptorCiphertext: { type: String, required: true, select: false },
  descriptorIv: { type: String, required: true, select: false },
  descriptorTag: { type: String, required: true, select: false },
  descriptorLength: { type: Number, min: 64, max: 4096, required: true },
  selfieCiphertext: { type: String, default: '', select: false },
  selfieIv: { type: String, default: '', select: false },
  selfieTag: { type: String, default: '', select: false },
  selfieMime: { type: String, enum: ['', 'image/jpeg', 'image/png'], default: '' },
  livenessScore: { type: Number, min: 0, max: 1, default: 0 },
  antiSpoofScore: { type: Number, min: 0, max: 1, default: 0 },
  challengeType: { type: String, default: 'blink', maxlength: 80 },
  challengePassed: { type: Boolean, default: false },
  consentAt: { type: Date, required: true },
  enrolledAt: { type: Date, default: Date.now },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  verifiedAt: { type: Date, default: null },
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  rejectedAt: { type: Date, default: null },
  rejectionReason: { type: String, default: '', maxlength: 800 },
  version: { type: Number, min: 1, default: 1 },
  lastMatchedAt: { type: Date, default: null },
  lastMatchScore: { type: Number, min: 0, max: 1, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

studentIdentitySchema.pre('save', function updateTimestamp(next) {
  this.updatedAt = new Date();
  next();
});

studentIdentitySchema.index({ status: 1, updatedAt: -1 });

module.exports = mongoose.model('StudentIdentity', studentIdentitySchema);
