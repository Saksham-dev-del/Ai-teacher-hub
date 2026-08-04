const mongoose = require('mongoose');

const weakAreaSchema = new mongoose.Schema({
  label: String,
  score: Number,
  attempts: Number
}, { _id: false });

const learningProfileSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  level: { type: String, enum: ['Needs revision', 'Beginner', 'Intermediate', 'Advanced'], default: 'Needs revision', index: true },
  averageScore: { type: Number, default: 0 },
  recentAverage: { type: Number, default: 0 },
  totalAttempts: { type: Number, default: 0 },
  passRate: { type: Number, default: 0 },
  weakTopics: { type: [weakAreaSchema], default: [] },
  weakBloomLevels: { type: [weakAreaSchema], default: [] },
  recommendedNotesMode: { type: String, default: 'Easy explanation notes' },
  recommendations: { type: [String], default: [] },
  lastCalculatedAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

learningProfileSchema.pre('save', function setUpdated(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('LearningProfile', learningProfileSchema);
