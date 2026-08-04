const mongoose = require('mongoose');

const refreshSessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true, index: true },
  familyId: { type: String, required: true, index: true },
  userAgentHash: { type: String, default: '' },
  ipHash: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  lastUsedAt: { type: Date, default: Date.now },
  revokedAt: { type: Date, default: null },
  revokeReason: { type: String, default: '' },
  replacedByHash: { type: String, default: '' }
});

refreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshSessionSchema.index({ user: 1, revokedAt: 1, expiresAt: 1 });
module.exports = mongoose.model('RefreshSession', refreshSessionSchema);
