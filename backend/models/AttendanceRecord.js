const mongoose = require('mongoose');

const attendanceRecordSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  course: { type: String, default: '', maxlength: 100 },
  subject: { type: String, default: '', maxlength: 160 },
  topic: { type: String, default: '', maxlength: 220 },
  lessonDate: { type: Date, required: true, index: true },
  status: { type: String, enum: ['present', 'absent', 'late', 'excused'], default: 'absent', index: true },
  notes: { type: String, default: '', maxlength: 1200 },
  reminder: {
    title: { type: String, default: '' },
    message: { type: String, default: '' },
    suggestedActions: { type: [String], default: [] },
    sent: { type: Boolean, default: false },
    sentAt: { type: Date, default: null }
  },
  createdAt: { type: Date, default: Date.now }
});

attendanceRecordSchema.index({ owner: 1, student: 1, lessonDate: -1 });
module.exports = mongoose.model('AttendanceRecord', attendanceRecordSchema);
