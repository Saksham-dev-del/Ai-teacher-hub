const mongoose = require('mongoose');

const lessonEventSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  resource: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource', default: null },
  title: { type: String, required: true, trim: true, maxlength: 220 },
  course: { type: String, default: '' },
  subject: { type: String, default: '' },
  topic: { type: String, default: '' },
  eventType: { type: String, enum: ['lecture', 'lab', 'quiz', 'assignment', 'revision', 'meeting', 'other'], default: 'lecture' },
  start: { type: Date, required: true, index: true },
  end: { type: Date, required: true },
  status: { type: String, enum: ['planned', 'completed', 'cancelled'], default: 'planned' },
  notes: { type: String, default: '', maxlength: 3000 },
  shared: { type: Boolean, default: true },
  color: { type: String, default: '#2F5D50' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

lessonEventSchema.pre('save', function setUpdatedAt(next) {
  this.updatedAt = new Date();
  next();
});

lessonEventSchema.index({ owner: 1, start: 1 });
lessonEventSchema.index({ shared: 1, start: 1 });

module.exports = mongoose.model('LessonEvent', lessonEventSchema);
