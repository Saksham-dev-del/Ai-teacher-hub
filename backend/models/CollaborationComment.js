const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  resource: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource', required: true, index: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true, maxlength: 3000 },
  type: { type: String, enum: ['comment', 'review', 'change-request', 'approval-note'], default: 'comment' },
  resolved: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
schema.index({ resource: 1, createdAt: -1 });
module.exports = mongoose.model('CollaborationComment', schema);
