const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['member', 'reviewer'], default: 'member' },
  addedAt: { type: Date, default: Date.now }
}, { _id: false });

const departmentSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 140 },
  code: { type: String, required: true, trim: true, uppercase: true, maxlength: 30 },
  description: { type: String, default: '', maxlength: 1200 },
  members: { type: [memberSchema], default: [] },
  folders: { type: [String], default: ['General', 'Lesson Plans', 'Quizzes', 'Assignments', 'Approved Resources'] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

departmentSchema.index({ owner: 1, code: 1 }, { unique: true });
departmentSchema.index({ 'members.user': 1 });
module.exports = mongoose.model('Department', departmentSchema);
