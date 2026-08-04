const express = require('express');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
}

function addMetric(map, key, item) {
  const label = String(key || 'Unmapped');
  if (!map[label]) map[label] = { label, attempts: 0, correct: 0, awarded: 0, maximum: 0, percentages: [] };
  const target = map[label];
  target.attempts += 1;
  target.correct += item.isCorrect ? 1 : 0;
  target.awarded += Number(item.awardedMarks || 0);
  target.maximum += Number(item.maxMarks || 0);
}

function finalizeMetricMap(map) {
  return Object.values(map).map((item) => ({
    label: item.label,
    attempts: item.attempts,
    accuracy: item.attempts ? round((item.correct / item.attempts) * 100) : 0,
    marksPercentage: item.maximum ? round((item.awarded / item.maximum) * 100) : 0
  })).sort((a, b) => b.attempts - a.attempts);
}

function scoreDistribution(attempts) {
  const bins = [
    { label: '0-39', min: 0, max: 39.999, count: 0 },
    { label: '40-59', min: 40, max: 59.999, count: 0 },
    { label: '60-74', min: 60, max: 74.999, count: 0 },
    { label: '75-89', min: 75, max: 89.999, count: 0 },
    { label: '90-100', min: 90, max: 100, count: 0 }
  ];
  attempts.forEach((attempt) => {
    const score = Number(attempt.percentage || 0);
    const bin = bins.find((item) => score >= item.min && score <= item.max);
    if (bin) bin.count += 1;
  });
  return bins.map(({ label, count }) => ({ label, count }));
}

router.get('/', async (req, res) => {
  try {
    let attempts = [];
    let quizzes = [];

    if (req.user.role === 'student') {
      attempts = await QuizAttempt.find({ student: req.user._id, status: 'submitted' })
        .populate('quiz', 'title course subject topic passPercentage owner')
        .sort({ submittedAt: -1 })
        .limit(2000);
      quizzes = [...new Map(attempts.filter((a) => a.quiz).map((a) => [String(a.quiz._id), a.quiz])).values()];
    } else {
      const quizQuery = req.user.role === 'admin' && req.query.scope === 'all' ? {} : { owner: req.user._id };
      quizzes = await Quiz.find(quizQuery).select('title course subject topic passPercentage owner published').sort({ createdAt: -1 });
      attempts = await QuizAttempt.find({ quiz: { $in: quizzes.map((q) => q._id) }, status: 'submitted' })
        .populate('quiz', 'title course subject topic passPercentage owner')
        .populate('student', 'name email')
        .sort({ submittedAt: -1 })
        .limit(5000);
    }

    const submitted = attempts.filter((attempt) => attempt.quiz);
    const averageScore = submitted.length ? submitted.reduce((sum, item) => sum + Number(item.percentage || 0), 0) / submitted.length : 0;
    const passRate = submitted.length ? submitted.filter((item) => item.passed).length / submitted.length * 100 : 0;
    const studentIds = new Set(submitted.map((item) => String(item.student?._id || item.student || '')).filter(Boolean));

    const byQuiz = new Map();
    const byTopic = new Map();
    const byBloom = {};
    const byCourseOutcome = {};

    submitted.forEach((attempt) => {
      const quiz = attempt.quiz;
      const quizId = String(quiz._id);
      if (!byQuiz.has(quizId)) byQuiz.set(quizId, { id: quizId, label: quiz.title, attempts: 0, total: 0, passed: 0, students: new Set() });
      const q = byQuiz.get(quizId);
      q.attempts += 1;
      q.total += Number(attempt.percentage || 0);
      q.passed += attempt.passed ? 1 : 0;
      q.students.add(String(attempt.student?._id || attempt.student || ''));

      const topicKey = `${quiz.subject || 'General'} · ${quiz.topic || quiz.title}`;
      if (!byTopic.has(topicKey)) byTopic.set(topicKey, { label: topicKey, attempts: 0, total: 0 });
      const topic = byTopic.get(topicKey);
      topic.attempts += 1;
      topic.total += Number(attempt.percentage || 0);

      (attempt.answers || []).forEach((answer) => {
        addMetric(byBloom, answer.bloomLevel || 'Unmapped', answer);
        if (answer.courseOutcome) addMetric(byCourseOutcome, answer.courseOutcome, answer);
      });
    });

    const quizStats = [...byQuiz.values()].map((item) => ({
      id: item.id,
      label: item.label,
      attempts: item.attempts,
      averageScore: round(item.total / Math.max(item.attempts, 1)),
      passRate: round(item.passed / Math.max(item.attempts, 1) * 100),
      uniqueStudents: [...item.students].filter(Boolean).length
    })).sort((a, b) => b.attempts - a.attempts);

    const topicStats = [...byTopic.values()].map((item) => ({
      label: item.label,
      attempts: item.attempts,
      averageScore: round(item.total / Math.max(item.attempts, 1))
    })).sort((a, b) => b.attempts - a.attempts);

    const bloomStats = finalizeMetricMap(byBloom);
    const coStats = finalizeMetricMap(byCourseOutcome);
    const weakAreas = [
      ...topicStats.map((x) => ({ type: 'Topic', label: x.label, score: x.averageScore, attempts: x.attempts })),
      ...bloomStats.map((x) => ({ type: 'Bloom', label: x.label, score: x.marksPercentage, attempts: x.attempts })),
      ...coStats.map((x) => ({ type: 'Outcome', label: x.label, score: x.marksPercentage, attempts: x.attempts }))
    ].filter((x) => x.attempts >= 1).sort((a, b) => a.score - b.score).slice(0, 6);

    const recentAttempts = submitted.slice(0, 12).map((attempt) => ({
      id: String(attempt._id),
      quizId: String(attempt.quiz._id),
      quizTitle: attempt.quiz.title,
      course: attempt.quiz.course,
      subject: attempt.quiz.subject,
      topic: attempt.quiz.topic,
      student: attempt.student && attempt.student.name ? { name: attempt.student.name, email: attempt.student.email } : null,
      percentage: round(attempt.percentage),
      passed: Boolean(attempt.passed),
      durationSeconds: Number(attempt.durationSeconds || 0),
      submittedAt: attempt.submittedAt
    }));

    res.json({
      role: req.user.role,
      summary: {
        totalQuizzes: quizzes.length,
        publishedQuizzes: quizzes.filter((q) => q.published).length,
        totalAttempts: submitted.length,
        averageScore: round(averageScore),
        passRate: round(passRate),
        activeStudents: req.user.role === 'student' ? 1 : studentIds.size
      },
      scoreDistribution: scoreDistribution(submitted),
      byQuiz: quizStats.slice(0, 20),
      byTopic: topicStats.slice(0, 20),
      byBloom: bloomStats,
      byCourseOutcome: coStats,
      weakAreas,
      recentAttempts
    });
  } catch (err) {
    console.error('[performance]', err.message);
    res.status(500).json({ error: 'Could not calculate performance analytics.' });
  }
});

module.exports = router;
