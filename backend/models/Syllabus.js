const mongoose = require('mongoose');

const chunkSchema = new mongoose.Schema({
  index: { type: Number, required: true },
  text: { type: String, required: true },
  wordCount: { type: Number, default: 0 },
  embedding: { type: [Number], default: undefined }
}, { _id: false });

const syllabusSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  originalName: { type: String, required: true },
  course: { type: String, default: '' },
  subject: { type: String, default: '' },
  fileHash: { type: String, required: true },
  pageCount: { type: Number, default: 0 },
  wordCount: { type: Number, default: 0 },
  textLength: { type: Number, default: 0 },
  chunkCount: { type: Number, default: 0 },
  embeddingStatus: { type: String, enum: ['semantic', 'lexical'], default: 'lexical' },
  embeddingModel: { type: String, default: '' },
  securityStatus: { type: String, enum: ['clear', 'review', 'high-risk'], default: 'clear', index: true },
  promptInjectionScore: { type: Number, min: 0, max: 100, default: 0 },
  securityFindings: { type: [mongoose.Schema.Types.Mixed], default: undefined },
  chunks: { type: [chunkSchema], default: [] },
  createdAt: { type: Date, default: Date.now }
});

syllabusSchema.index({ owner: 1, createdAt: -1 });
syllabusSchema.index({ owner: 1, fileHash: 1 }, { unique: true });

module.exports = mongoose.model('Syllabus', syllabusSchema);
