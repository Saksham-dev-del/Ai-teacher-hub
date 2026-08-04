const mongoose = require('mongoose');

const securityAlertSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  actorRole: { type: String, default: '' },
  type: { type: String, required: true, index: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium', index: true },
  status: { type: String, enum: ['open', 'acknowledged', 'resolved'], default: 'open', index: true },
  targetType: { type: String, default: '' },
  targetId: { type: String, default: '' },
  requestId: { type: String, default: '' },
  ipHash: { type: String, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: undefined },
  acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  acknowledgedAt: { type: Date, default: null },
  resolvedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now, index: true }
});

securityAlertSchema.index({ status: 1, severity: 1, createdAt: -1 });
module.exports = mongoose.model('SecurityAlert', securityAlertSchema);
