const express = require('express');
const AuditLog = require('../models/AuditLog');
const SecurityAlert = require('../models/SecurityAlert');
const RefreshSession = require('../models/RefreshSession');
const QuizAttempt = require('../models/QuizAttempt');
const Syllabus = require('../models/Syllabus');
const User = require('../models/User');
const { requireAuth, requireRole } = require('../middleware/auth');
const { writeAudit, clearRefreshCookie } = require('../services/security');

const router = express.Router();
router.use(requireAuth);

router.get('/me/sessions', async (req, res, next) => {
  try {
    const sessions = await RefreshSession.find({ user: req.user._id, revokedAt: null, expiresAt: { $gt: new Date() } })
      .sort({ lastUsedAt: -1 }).limit(30).select('-tokenHash -replacedByHash');
    res.json({ sessions: sessions.map((s) => ({ id: s._id, createdAt: s.createdAt, lastUsedAt: s.lastUsedAt, expiresAt: s.expiresAt })) });
  } catch (err) { next(err); }
});

router.delete('/me/sessions/:id', async (req, res, next) => {
  try {
    const result = await RefreshSession.updateOne({ _id: req.params.id, user: req.user._id, revokedAt: null }, { $set: { revokedAt: new Date(), revokeReason: 'user-revoked' } });
    if (!result.matchedCount) return res.status(404).json({ error: 'Session not found.' });
    await writeAudit({ req, actor: req.user, action: 'REFRESH_SESSION_REVOKED', targetType: 'RefreshSession', targetId: req.params.id, severity: 'warning' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.use(requireRole('admin'));

router.get('/overview', async (req, res, next) => {
  try {
    const since24h = new Date(Date.now() - 86400000);
    const [
      openAlerts, criticalAlerts, blocked24h, failedLogins24h, activeSessions, flaggedAttempts, cancelledAttempts, flaggedDocuments,
      recentAlerts, recentLogs
    ] = await Promise.all([
      SecurityAlert.countDocuments({ status: 'open' }),
      SecurityAlert.countDocuments({ status: 'open', severity: { $in: ['high', 'critical'] } }),
      AuditLog.countDocuments({ createdAt: { $gte: since24h }, outcome: 'blocked' }),
      AuditLog.countDocuments({ createdAt: { $gte: since24h }, action: 'LOGIN_FAILED' }),
      RefreshSession.countDocuments({ revokedAt: null, expiresAt: { $gt: new Date() } }),
      QuizAttempt.countDocuments({ integrityStatus: 'review' }),
      QuizAttempt.countDocuments({ status: 'cancelled' }),
      Syllabus.countDocuments({ securityStatus: { $ne: 'clear' } }),
      SecurityAlert.find().sort({ createdAt: -1 }).limit(12).populate('actor', 'name email role'),
      AuditLog.find().sort({ createdAt: -1 }).limit(20).populate('actor', 'name email role')
    ]);
    res.json({
      metrics: { openAlerts, criticalAlerts, blocked24h, failedLogins24h, activeSessions, flaggedAttempts, cancelledAttempts, flaggedDocuments },
      recentAlerts, recentLogs
    });
  } catch (err) { next(err); }
});

router.get('/alerts', async (req, res, next) => {
  try {
    const query = {};
    if (['open', 'acknowledged', 'resolved'].includes(req.query.status)) query.status = req.query.status;
    if (['low', 'medium', 'high', 'critical'].includes(req.query.severity)) query.severity = req.query.severity;
    const alerts = await SecurityAlert.find(query).sort({ createdAt: -1 }).limit(200).populate('actor', 'name email role');
    res.json({ alerts });
  } catch (err) { next(err); }
});

router.patch('/alerts/:id', async (req, res, next) => {
  try {
    const status = req.body?.status;
    if (!['acknowledged', 'resolved'].includes(status)) return res.status(400).json({ error: 'Status must be acknowledged or resolved.' });
    const update = { status, acknowledgedBy: req.user._id, acknowledgedAt: new Date() };
    if (status === 'resolved') update.resolvedAt = new Date();
    const alert = await SecurityAlert.findByIdAndUpdate(req.params.id, { $set: update }, { new: true });
    if (!alert) return res.status(404).json({ error: 'Security alert not found.' });
    await writeAudit({ req, actor: req.user, action: 'SECURITY_ALERT_UPDATED', targetType: 'SecurityAlert', targetId: alert._id, metadata: { status } });
    res.json({ alert });
  } catch (err) { next(err); }
});

router.get('/logs', async (req, res, next) => {
  try {
    const query = {};
    if (req.query.action) query.action = String(req.query.action).slice(0, 120);
    if (['success', 'failure', 'blocked'].includes(req.query.outcome)) query.outcome = req.query.outcome;
    const logs = await AuditLog.find(query).sort({ createdAt: -1 }).limit(Math.min(300, Number(req.query.limit || 100))).populate('actor', 'name email role');
    res.json({ logs });
  } catch (err) { next(err); }
});

router.post('/users/:id/revoke-sessions', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    user.tokenVersion = Number(user.tokenVersion || 0) + 1;
    await user.save();
    await RefreshSession.updateMany({ user: user._id, revokedAt: null }, { $set: { revokedAt: new Date(), revokeReason: 'admin-revoked' } });
    await writeAudit({ req, actor: req.user, action: 'ADMIN_REVOKED_USER_SESSIONS', targetType: 'User', targetId: user._id, severity: 'high' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
