const express = require('express');
const User = require('../models/User');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const PhaseArtifact = require('../models/PhaseArtifact');
const AttendanceRecord = require('../models/AttendanceRecord');
const { requireAuth, requireRole } = require('../middleware/auth');
const { writeAudit, cleanText } = require('../services/security');
const { ACTIONS, EXAM_TYPES, QUESTION_TYPES, validateBlueprint, generateAcademic, attendanceReminder } = require('../services/academicSuite');

const router = express.Router();
router.use(requireAuth, requireRole('teacher', 'admin'));

function activeStudentFilter() {
  return {
    role: { $regex: /^student$/i },
    $or: [{ isActive: true }, { isActive: { $exists: false } }]
  };
}

async function accessibleStudentIds(user) {
  // Legacy records created before `isActive` existed are treated as active and
  // backfilled. Attendance is intentionally independent of quiz history.
  await User.updateMany({ role: { $regex: /^student$/i }, isActive: { $exists: false } }, { $set: { isActive: true, role: 'student' } });
  return (await User.find(activeStudentFilter()).select('_id')).map((student) => String(student._id));
}

router.get('/config', (req, res) => res.json({ actions: ACTIONS, examTypes: EXAM_TYPES, questionTypes: QUESTION_TYPES }));

router.get('/students', async (req, res, next) => {
  try {
    const ids = await accessibleStudentIds(req.user);
    const students = await User.find({ _id: { $in: ids }, ...activeStudentFilter() }).select('name email').sort({ name: 1 });
    res.json({ students });
  } catch (err) { next(err); }
});

router.post('/blueprint/validate', (req, res) => {
  const totalMarks = Math.max(10, Math.min(200, Number(req.body?.totalMarks || 50)));
  res.json({ validation: validateBlueprint(req.body?.blueprint, totalMarks) });
});

router.post('/generate', async (req, res, next) => {
  try {
    const body = req.body || {};
    const action = cleanText(body.action, 80);
    if (!ACTIONS.includes(action)) return res.status(400).json({ error: 'Select a valid Phase 8 action.' });
    const input = {
      course: cleanText(body.course, 100),
      subject: cleanText(body.subject, 160),
      topic: cleanText(body.topic, 220),
      units: body.units,
      examType: EXAM_TYPES.includes(body.examType) ? body.examType : 'Internal Exam',
      totalMarks: Math.max(10, Math.min(200, Number(body.totalMarks || 50))),
      durationMinutes: Math.max(15, Math.min(300, Number(body.durationMinutes || 90))),
      questionTypes: Array.isArray(body.questionTypes) ? body.questionTypes.filter((x) => QUESTION_TYPES.includes(x)) : [],
      blueprint: body.blueprint,
      assignmentTitle: cleanText(body.assignmentTitle, 220),
      examDate: body.examDate,
      dailyMinutes: Math.max(15, Math.min(360, Number(body.dailyMinutes || 60))),
      context: cleanText(body.context, 1600),
      programmingLanguage: cleanText(body.programmingLanguage, 60),
      programCount: Math.max(3, Math.min(20, Number(body.programCount || 10)))
    };
    if (!input.subject) return res.status(400).json({ error: 'Subject is required.' });

    if (action === 'question-paper') {
      const validation = validateBlueprint(input.blueprint, input.totalMarks);
      if (!validation.valid) return res.status(422).json({ error: validation.message, validation });
    }

    const generated = await generateAcademic(action, input);
    const artifact = await PhaseArtifact.create({
      owner: req.user._id,
      phase: 8,
      category: 'academic-planning-assessment',
      action,
      title: cleanText(generated.output.title || `${input.subject} — Phase 8`, 260),
      course: input.course,
      subject: input.subject,
      topic: input.topic,
      inputs: input,
      output: generated.output,
      generationMode: generated.generationMode
    });
    await writeAudit({ req, actor: req.user, action: 'PHASE8_ARTIFACT_CREATED', targetType: 'PhaseArtifact', targetId: artifact._id, metadata: { action, generationMode: generated.generationMode } });
    res.status(201).json({ artifact, output: generated.output, generationMode: generated.generationMode, warning: generated.warning });
  } catch (err) {
    if (err.code === 'BLUEPRINT_MISMATCH') return res.status(422).json({ error: err.message, validation: err.validation });
    next(err);
  }
});

router.get('/artifacts', async (req, res, next) => {
  try {
    const query = req.user.role === 'admin' && req.query.scope === 'all' ? { phase: 8 } : { phase: 8, owner: req.user._id };
    const artifacts = await PhaseArtifact.find(query).sort({ createdAt: -1 }).limit(120);
    res.json({ artifacts });
  } catch (err) { next(err); }
});

router.post('/attendance', async (req, res, next) => {
  try {
    const body = req.body || {};
    const ids = await accessibleStudentIds(req.user);
    if (!ids.includes(String(body.studentId || ''))) return res.status(404).json({ error: 'Student is not accessible for attendance tracking.' });
    const student = await User.findOne({ _id: body.studentId, ...activeStudentFilter() });
    if (!student) return res.status(404).json({ error: 'Student not found.' });
    const status = ['present', 'absent', 'late', 'excused'].includes(body.status) ? body.status : 'absent';
    const reminder = status === 'absent' ? attendanceReminder(body, student.name) : { title: '', message: '', suggestedActions: [] };
    const record = await AttendanceRecord.create({
      owner: req.user._id,
      student: student._id,
      course: cleanText(body.course, 100),
      subject: cleanText(body.subject, 160),
      topic: cleanText(body.topic, 220),
      lessonDate: body.lessonDate ? new Date(body.lessonDate) : new Date(),
      status,
      notes: cleanText(body.notes, 1200),
      reminder
    });
    await writeAudit({ req, actor: req.user, action: 'ATTENDANCE_RECORDED', targetType: 'AttendanceRecord', targetId: record._id, metadata: { status, studentId: student._id } });
    res.status(201).json({ record: await record.populate('student', 'name email') });
  } catch (err) { next(err); }
});

router.get('/attendance', async (req, res, next) => {
  try {
    const query = req.user.role === 'admin' && req.query.scope === 'all' ? {} : { owner: req.user._id };
    const records = await AttendanceRecord.find(query).populate('student', 'name email').sort({ lessonDate: -1 }).limit(200);
    res.json({ records });
  } catch (err) { next(err); }
});

router.patch('/attendance/:id/reminder', async (req, res, next) => {
  try {
    const query = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, owner: req.user._id };
    const record = await AttendanceRecord.findOne(query);
    if (!record) return res.status(404).json({ error: 'Attendance record not found.' });
    record.reminder.sent = Boolean(req.body?.sent);
    record.reminder.sentAt = record.reminder.sent ? new Date() : null;
    await record.save();
    res.json({ record });
  } catch (err) { next(err); }
});

module.exports = router;
