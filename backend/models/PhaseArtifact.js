const mongoose = require('mongoose');

const phaseArtifactSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  phase: { type: Number, enum: [7, 8, 9, 10, 11], required: true, index: true },
  category: { type: String, required: true, index: true },
  action: { type: String, required: true, index: true },
  title: { type: String, required: true, maxlength: 260 },
  course: { type: String, default: '', maxlength: 100 },
  subject: { type: String, default: '', maxlength: 160 },
  topic: { type: String, default: '', maxlength: 220 },
  sourceResource: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource', default: null },
  inputs: { type: mongoose.Schema.Types.Mixed, default: {} },
  output: { type: mongoose.Schema.Types.Mixed, required: true },
  generationMode: { type: String, enum: ['ai', 'fallback', 'hybrid'], default: 'ai' },
  createdAt: { type: Date, default: Date.now }
});

phaseArtifactSchema.index({ owner: 1, phase: 1, createdAt: -1 });
module.exports = mongoose.model('PhaseArtifact', phaseArtifactSchema);
