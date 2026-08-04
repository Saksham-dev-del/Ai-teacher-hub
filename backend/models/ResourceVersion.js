const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  resource: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource', required: true, index: true },
  versionNumber: { type: Number, required: true },
  label: { type: String, default: '', maxlength: 100 },
  note: { type: String, default: '', maxlength: 1000 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now }
});
schema.index({ resource: 1, versionNumber: 1 }, { unique: true });
module.exports = mongoose.model('ResourceVersion', schema);
