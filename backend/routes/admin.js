const express = require('express');
const User = require('../models/User');
const Resource = require('../models/Resource');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const LessonEvent = require('../models/LessonEvent');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

router.get('/stats', async (req, res) => {
  try {
    const [totalTeachers, totalStudents, totalAdmins, totalResources, totalQuizzes, totalAttempts, totalLessonEvents] = await Promise.all([
      User.countDocuments({ role: 'teacher' }),
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'admin' }),
      Resource.countDocuments(),
      Quiz.countDocuments(),
      QuizAttempt.countDocuments({ status: 'submitted' }),
      LessonEvent.countDocuments()
    ]);

    const byCourseAgg = await Resource.aggregate([
      { $group: { _id: '$course', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    const byTypeAgg = await Resource.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    const topTopicsAgg = await Resource.aggregate([
      { $group: { _id: '$topic', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      totalTeachers,
      totalStudents,
      totalAdmins,
      totalResources,
      totalQuizzes,
      totalAttempts,
      totalLessonEvents,
      byCourse: byCourseAgg.map((x) => ({ label: x._id || 'Unknown', count: x.count })),
      byType: byTypeAgg.map((x) => ({ label: x._id || 'Unknown', count: x.count })),
      topTopics: topTopicsAgg.map((x) => ({ label: x._id || 'Unknown', count: x.count }))
    });
  } catch (err) {
    console.error('[admin/stats]', err.message);
    res.status(500).json({ error: 'Could not load admin stats.' });
  }
});

module.exports = router;
