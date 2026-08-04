const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const RefreshSession = require('../models/RefreshSession');
const { requireAuth } = require('../middleware/auth');
const {
  sha256,
  randomToken,
  normalizeEmail,
  cleanText,
  passwordProblems,
  parseCookies,
  setRefreshCookie,
  clearRefreshCookie,
  clientIdentity,
  writeAudit,
  createSecurityAlert
} = require('../services/security');

const router = express.Router();
const ACCESS_MINUTES = Math.max(5, Math.min(Number(process.env.ACCESS_TOKEN_MINUTES || 20), 120));
const REFRESH_DAYS = Math.max(1, Math.min(Number(process.env.REFRESH_TOKEN_DAYS || 14), 90));
const LOCK_ATTEMPTS = Math.max(3, Number(process.env.LOGIN_LOCK_ATTEMPTS || 5));
const LOCK_MINUTES = Math.max(5, Number(process.env.LOGIN_LOCK_MINUTES || 15));

function assertJwtSecret() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    const err = new Error('JWT_SECRET must be at least 32 characters.');
    err.status = 503;
    throw err;
  }
}

function signAccessToken(user) {
  assertJwtSecret();
  return jwt.sign(
    { sub: user._id.toString(), role: user.role, ver: Number(user.tokenVersion || 0), typ: 'access' },
    process.env.JWT_SECRET,
    {
      algorithm: 'HS256',
      expiresIn: `${ACCESS_MINUTES}m`,
      issuer: process.env.JWT_ISSUER || 'ai-teacher-resource-hub',
      audience: process.env.JWT_AUDIENCE || 'ai-teacher-web',
      jwtid: crypto.randomUUID()
    }
  );
}

async function revokeFamily(familyId, reason) {
  await RefreshSession.updateMany({ familyId, revokedAt: null }, { $set: { revokedAt: new Date(), revokeReason: reason } });
}

async function issueSession(req, res, user, familyId = crypto.randomUUID()) {
  const rawRefresh = randomToken(48);
  const identity = clientIdentity(req);
  const expiresAt = new Date(Date.now() + REFRESH_DAYS * 86400000);
  await RefreshSession.create({
    user: user._id,
    tokenHash: sha256(rawRefresh),
    familyId,
    userAgentHash: identity.userAgentHash,
    ipHash: identity.ipHash,
    expiresAt
  });
  setRefreshCookie(res, rawRefresh, REFRESH_DAYS * 86400000);
  return {
    token: signAccessToken(user),
    accessExpiresInSeconds: ACCESS_MINUTES * 60,
    user: user.toSafeJSON()
  };
}

router.post('/register', async (req, res, next) => {
  try {
    const name = cleanText(req.body?.name, 120);
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    const role = req.body?.role;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    const problems = passwordProblems(password);
    if (problems.length) return res.status(400).json({ error: `Password must include ${problems.join(', ')}.` });

    const finalRole = ['teacher', 'student'].includes(role) ? role : 'teacher';
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });

    const user = new User({ name, email, role: finalRole, tokenVersion: -1 });
    await user.setPassword(password);
    await user.save();
    const session = await issueSession(req, res, user);
    await writeAudit({ req, actor: user, action: 'ACCOUNT_REGISTERED', metadata: { role: user.role } });
    res.status(201).json(session);
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

    const user = await User.findOne({ email });
    if (!user) {
      await writeAudit({ req, action: 'LOGIN_FAILED', outcome: 'failure', severity: 'warning', metadata: { emailHash: sha256(email) } });
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    if (!user.isActive) return res.status(403).json({ error: 'This account is disabled.' });
    if (user.isLocked()) {
      const seconds = Math.max(1, Math.ceil((user.lockUntil.getTime() - Date.now()) / 1000));
      res.setHeader('Retry-After', String(seconds));
      return res.status(423).json({ error: `Account temporarily locked. Try again in ${Math.ceil(seconds / 60)} minute(s).` });
    }

    const ok = await user.checkPassword(password);
    if (!ok) {
      user.failedLoginAttempts = Number(user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= LOCK_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + LOCK_MINUTES * 60000);
        await createSecurityAlert({ req, actor: user, type: 'account_lockout', title: 'Account locked after repeated login failures', description: 'The account was temporarily locked after repeated invalid password attempts.', severity: 'high', targetType: 'User', targetId: user._id });
      }
      await user.save();
      await writeAudit({ req, actor: user, action: 'LOGIN_FAILED', outcome: 'failure', severity: 'warning', metadata: { failedAttempts: user.failedLoginAttempts } });
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const identity = clientIdentity(req);
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.lastLoginAt = new Date();
    user.lastLoginIpHash = identity.ipHash;
    await user.save();
    const session = await issueSession(req, res, user);
    await writeAudit({ req, actor: user, action: 'LOGIN_SUCCESS' });
    res.json(session);
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const raw = parseCookies(req).trh_refresh;
    if (!raw) return res.status(401).json({ error: 'Refresh session is unavailable.' });
    const tokenHash = sha256(raw);
    const session = await RefreshSession.findOne({ tokenHash }).populate('user');
    if (!session) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Refresh session is invalid.' });
    }
    if (session.revokedAt) {
      await revokeFamily(session.familyId, 'refresh-token-reuse');
      if (session.user) {
        session.user.tokenVersion = Number(session.user.tokenVersion || 0) + 1;
        await session.user.save();
      }
      await createSecurityAlert({ req, actor: session.user, type: 'refresh_token_reuse', title: 'Possible refresh-token reuse detected', description: 'A revoked refresh token was presented. The entire session family was revoked.', severity: 'critical', targetType: 'User', targetId: session.user?._id });
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Session reuse was detected. Please log in again.' });
    }
    if (!session.user || !session.user.isActive || session.expiresAt.getTime() <= Date.now()) {
      session.revokedAt = new Date();
      session.revokeReason = 'expired-or-user-disabled';
      await session.save();
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Refresh session expired.' });
    }

    const identity = clientIdentity(req);
    if (session.userAgentHash && session.userAgentHash !== identity.userAgentHash) {
      await revokeFamily(session.familyId, 'user-agent-mismatch');
      session.user.tokenVersion = Number(session.user.tokenVersion || 0) + 1;
      await session.user.save();
      await createSecurityAlert({ req, actor: session.user, type: 'session_device_mismatch', title: 'Session device mismatch', description: 'A refresh token was used from a different browser signature.', severity: 'critical', targetType: 'User', targetId: session.user._id });
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Session device changed. Please log in again.' });
    }

    session.revokedAt = new Date();
    session.revokeReason = 'rotated';
    session.lastUsedAt = new Date();
    const nextRaw = randomToken(48);
    const nextHash = sha256(nextRaw);
    session.replacedByHash = nextHash;
    await session.save();

    const expiresAt = new Date(Date.now() + REFRESH_DAYS * 86400000);
    await RefreshSession.create({
      user: session.user._id,
      tokenHash: nextHash,
      familyId: session.familyId,
      userAgentHash: identity.userAgentHash,
      ipHash: identity.ipHash,
      expiresAt
    });
    setRefreshCookie(res, nextRaw, REFRESH_DAYS * 86400000);
    await writeAudit({ req, actor: session.user, action: 'ACCESS_TOKEN_REFRESHED' });
    res.json({ token: signAccessToken(session.user), accessExpiresInSeconds: ACCESS_MINUTES * 60, user: session.user.toSafeJSON() });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', async (req, res) => {
  const raw = parseCookies(req).trh_refresh;
  if (raw) await RefreshSession.updateOne({ tokenHash: sha256(raw), revokedAt: null }, { $set: { revokedAt: new Date(), revokeReason: 'logout' } });
  clearRefreshCookie(res);
  res.json({ ok: true });
});

router.post('/logout-all', requireAuth, async (req, res, next) => {
  try {
    req.user.tokenVersion = Number(req.user.tokenVersion || 0) + 1;
    await req.user.save();
    await RefreshSession.updateMany({ user: req.user._id, revokedAt: null }, { $set: { revokedAt: new Date(), revokeReason: 'logout-all' } });
    clearRefreshCookie(res);
    await writeAudit({ req, actor: req.user, action: 'ALL_SESSIONS_REVOKED', severity: 'warning' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user.toSafeJSON(), security: { accessTokenMinutes: ACCESS_MINUTES, refreshTokenDays: REFRESH_DAYS } });
});

module.exports = router;
