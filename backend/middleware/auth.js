const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { writeAudit } = require('../services/security');

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Not authenticated. Please log in.' });
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      return res.status(503).json({ error: 'Server authentication is not configured securely.' });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: process.env.JWT_ISSUER || 'ai-teacher-resource-hub',
      audience: process.env.JWT_AUDIENCE || 'ai-teacher-web'
    });
    if (payload.typ !== 'access') return res.status(401).json({ error: 'Invalid session token type.' });

    const user = await User.findById(payload.sub);
    if (!user || !user.isActive) return res.status(401).json({ error: 'Session is no longer valid. Please log in again.' });
    if (Number(payload.ver || 0) !== Number(user.tokenVersion || 0)) {
      return res.status(401).json({ error: 'Session was revoked. Please log in again.' });
    }

    req.user = user;
    req.auth = { jti: payload.jti, issuedAt: payload.iat, expiresAt: payload.exp };
    next();
  } catch (err) {
    writeAudit({ req, action: 'ACCESS_TOKEN_REJECTED', outcome: 'blocked', severity: 'warning', metadata: { reason: err.name } });
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      writeAudit({ req, actor: req.user, action: 'ROLE_ACCESS_BLOCKED', outcome: 'blocked', severity: 'high', metadata: { requiredRoles: roles, route: req.originalUrl } });
      return res.status(403).json({ error: 'You do not have permission to do this.' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
