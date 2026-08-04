const express = require('express');
const Resource = require('../models/Resource');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const User = require('../models/User');
const LearningProfile = require('../models/LearningProfile');
const PhaseArtifact = require('../models/PhaseArtifact');
const { requireAuth, requireRole } = require('../middleware/auth');
const { writeAudit, cleanText } = require('../services/security');
const { resourceText, detectLearningLevel, generatePersonalized, ACTIONS } = require('../services/personalization');

const router = express.Router();
router.use(requireAuth);

function p7ActiveStudentFilter() {
  return { role: { $regex: /^student$/i }, $or: [{ isActive: true }, { isActive: { $exists: false } }] };
}

async function teacherStudentIds(user) {
  await User.updateMany({ role: { $regex: /^student$/i }, isActive: { $exists: false } }, { $set: { isActive: true, role: 'student' } });
  const students = await User.find(p7ActiveStudentFilter()).select('_id');
  return students.map((x) => String(x._id));
}

async function resolveStudent(req, requestedId) {
  if (req.user.role === 'student') return req.user;
  const id = String(requestedId || '');
  if (!id) return null;
  const allowed = await teacherStudentIds(req.user);
  if (!allowed.includes(id)) return null;
  return User.findOne({ _id: id, ...p7ActiveStudentFilter() });
}

async function calculateAndSave(student) {
  const attempts = await QuizAttempt.find({ student: student._id, status: 'submitted' })
    .populate('quiz', 'title subject topic course')
    .sort({ submittedAt: -1 })
    .limit(500);
  const result = detectLearningLevel(attempts);
  const profile = await LearningProfile.findOneAndUpdate(
    { student: student._id },
    { ...result, student: student._id, lastCalculatedAt: new Date(), updatedAt: new Date() },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return profile;
}

router.get('/students', requireRole('teacher', 'admin'), async (req, res, next) => {
  try {
    const ids = await teacherStudentIds(req.user);
    const students = await User.find({ _id: { $in: ids }, ...p7ActiveStudentFilter() }).select('name email').sort({ name: 1 });
    res.json({ students });
  } catch (err) { next(err); }
});

router.get('/profile', async (req, res, next) => {
  try {
    const student = await resolveStudent(req, req.query.studentId);
    if (!student) return res.status(404).json({ error: 'Student learning profile is not available.' });
    const profile = await calculateAndSave(student);
    res.json({ student: { id: student._id, name: student.name, email: student.email }, profile });
  } catch (err) { next(err); }
});

router.post('/profile/refresh', async (req, res, next) => {
  try {
    const student = await resolveStudent(req, req.body?.studentId);
    if (!student) return res.status(404).json({ error: 'Student learning profile is not available.' });
    const profile = await calculateAndSave(student);
    await writeAudit({ req, actor: req.user, action: 'LEARNING_PROFILE_REFRESHED', targetType: 'User', targetId: student._id, metadata: { level: profile.level } });
    res.json({ student: { id: student._id, name: student.name, email: student.email }, profile });
  } catch (err) { next(err); }
});

router.post('/generate', requireRole('teacher', 'admin'), async (req, res, next) => {
  try {
    const body = req.body || {};
    const action = cleanText(body.action, 80);
    if (!ACTIONS.includes(action)) return res.status(400).json({ error: 'Select a valid Phase 7 action.' });

    let resource = null;
    if (body.resourceId) {
      resource = await Resource.findById(body.resourceId);
      if (!resource || (req.user.role !== 'admin' && String(resource.owner) !== String(req.user._id))) {
        return res.status(404).json({ error: 'Selected source resource was not found.' });
      }
    }

    let student = null;
    let learningProfile = null;
    if (body.studentId) {
      student = await resolveStudent(req, body.studentId);
      if (!student) return res.status(404).json({ error: 'Selected student is not accessible.' });
      learningProfile = await calculateAndSave(student);
    }

    const input = {
      course: cleanText(body.course || resource?.course, 100),
      subject: cleanText(body.subject || resource?.subject, 160),
      topic: cleanText(body.topic || resource?.topic, 220),
      classPerformance: ['Weak', 'Average', 'Advanced'].includes(body.classPerformance) ? body.classPerformance : 'Average',
      teachingStyle: ['Theory', 'Practical', 'Activity-based'].includes(body.teachingStyle) ? body.teachingStyle : 'Theory',
      language: ['English', 'Hindi', 'Hinglish'].includes(body.language) ? body.language : 'English',
      notesMode: cleanText(body.notesMode, 100),
      targetMode: cleanText(body.targetMode, 100),
      learningProfile: learningProfile ? {
        level: learningProfile.level,
        averageScore: learningProfile.averageScore,
        weakTopics: learningProfile.weakTopics,
        weakBloomLevels: learningProfile.weakBloomLevels,
        recommendedNotesMode: learningProfile.recommendedNotesMode
      } : undefined
    };
    if (!input.topic) return res.status(400).json({ error: 'Topic or source resource is required.' });

    const generated = await generatePersonalized(action, input, resourceText(resource));
    const artifact = await PhaseArtifact.create({
      owner: req.user._id,
      student: student?._id || null,
      phase: 7,
      category: 'personalized-learning',
      action,
      title: cleanText(generated.output.title || `${input.topic} — Phase 7`, 260),
      course: input.course,
      subject: input.subject,
      topic: input.topic,
      sourceResource: resource?._id || null,
      inputs: input,
      output: generated.output,
      generationMode: generated.generationMode
    });
    await writeAudit({ req, actor: req.user, action: 'PHASE7_ARTIFACT_CREATED', targetType: 'PhaseArtifact', targetId: artifact._id, metadata: { action, generationMode: generated.generationMode } });
    res.status(201).json({ artifact, output: generated.output, generationMode: generated.generationMode, warning: generated.warning });
  } catch (err) { next(err); }
});

router.get('/artifacts', async (req, res, next) => {
  try {
    const query = req.user.role === 'student' ? { phase: 7, student: req.user._id } : { phase: 7, owner: req.user._id };
    const artifacts = await PhaseArtifact.find(query).sort({ createdAt: -1 }).limit(100);
    res.json({ artifacts });
  } catch (err) { next(err); }
});

module.exports = router;
