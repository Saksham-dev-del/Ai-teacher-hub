const QuizAttempt = require('../models/QuizAttempt');

function startAttemptMonitor() {
  const intervalMs = Math.max(30000, Number(process.env.ATTEMPT_MONITOR_INTERVAL_MS || 60000));
  const run = async () => {
    try {
      const now = new Date();
      await QuizAttempt.updateMany(
        { status: 'in_progress', expiresAt: { $lt: now } },
        { $set: { status: 'expired', submittedAt: now, cancellationReason: 'Server-controlled quiz timer expired.' } }
      );
    } catch (error) {
      console.warn('[attempt-monitor]', error.message);
    }
  };
  run();
  const timer = setInterval(run, intervalMs);
  timer.unref?.();
}

module.exports = { startAttemptMonitor };
