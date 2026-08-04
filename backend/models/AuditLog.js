const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  actorRole: { type: String, default: '' },
  action: { type: String, required: true, index: true },
  outcome: { type: String, enum: ['success', 'failure', 'blocked'], default: 'success', index: true },
  severity: { type: String, enum: ['info', 'warning', 'high', 'critical'], default: 'info', index: true },
  targetType: { type: String, default: '' },
  targetId: { type: String, default: '' },
  requestId: { type: String, default: '', index: true },
  ipHash: { type: String, default: '', index: true },
  userAgentHash: { type: String, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: undefined },
  createdAt: { type: Date, default: Date.now, index: true },
  expiresAt: { type: Date, required: true }
});

auditLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
auditLogSchema.index({ createdAt: -1, severity: 1 });
module.exports = mongoose.model('AuditLog', auditLogSchema);
