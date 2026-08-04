const crypto = require('crypto');
const { writeAudit, createSecurityAlert, clientIp } = require('../services/security');

function requestContext(req, res, next) {
  req.id = String(req.headers['x-request-id'] || crypto.randomUUID()).slice(0, 100);
  res.setHeader('X-Request-Id', req.id);
  next();
}

function securityHeaders(req, res, next) {
  const production = process.env.NODE_ENV === 'production';
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(), display-capture=(), payment=(), usb=(), serial=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Origin-Agent-Cluster', '?1');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "connect-src 'self'",
    "font-src 'self' data:",
    "worker-src 'self' blob:"
  ].join('; '));
  if (production) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store, max-age=0');
  next();
}

function originGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = String(req.headers.origin || '');
  const host = String(req.headers.host || '');
  const allowed = String(process.env.ALLOWED_ORIGINS || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (!origin) return next(); // CLI/mobile clients still need Bearer auth.
  let valid = false;
  try {
    const parsed = new URL(origin);
    valid = parsed.host === host || allowed.includes(origin);
  } catch (_) {}
  if (valid) return next();
  writeAudit({ req, action: 'REQUEST_ORIGIN_BLOCKED', outcome: 'blocked', severity: 'high', metadata: { origin } });
  createSecurityAlert({ req, type: 'origin_mismatch', title: 'Cross-origin write request blocked', description: 'A state-changing request arrived from an unapproved origin.', severity: 'high', metadata: { origin } });
  return res.status(403).json({ error: 'Request origin is not allowed.' });
}

function hasUnsafeKey(value, depth = 0) {
  if (!value || typeof value !== 'object' || depth > 12) return false;
  if (Array.isArray(value)) return value.some((item) => hasUnsafeKey(item, depth + 1));
  return Object.entries(value).some(([key, child]) => key.startsWith('$') || key.includes('.') || key === '__proto__' || key === 'constructor' || key === 'prototype' || hasUnsafeKey(child, depth + 1));
}

function noSqlInjectionGuard(req, res, next) {
  if (hasUnsafeKey(req.body) || hasUnsafeKey(req.query) || hasUnsafeKey(req.params)) {
    writeAudit({ req, actor: req.user, action: 'NOSQL_PAYLOAD_BLOCKED', outcome: 'blocked', severity: 'high' });
    createSecurityAlert({ req, actor: req.user, type: 'nosql_injection', title: 'Potential NoSQL injection blocked', description: 'A request contained prohibited MongoDB operator or prototype keys.', severity: 'high' });
    return res.status(400).json({ error: 'Request contains prohibited field names.' });
  }
  next();
}

const buckets = new Map();
function createRateLimit({ windowMs, max, name = 'request', key = (req) => clientIp(req), skip = () => false }) {
  const cleanupEvery = Math.max(windowMs, 60000);
  let lastCleanup = 0;
  return function rateLimiter(req, res, next) {
    if (skip(req)) return next();
    const now = Date.now();
    if (now - lastCleanup > cleanupEvery) {
      lastCleanup = now;
      for (const [bucketKey, value] of buckets.entries()) if (value.resetAt <= now) buckets.delete(bucketKey);
    }
    const bucketKey = `${name}:${key(req)}`;
    const current = buckets.get(bucketKey);
    const state = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
    state.count += 1;
    buckets.set(bucketKey, state);
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - state.count)));
    res.setHeader('RateLimit-Reset', String(Math.ceil(state.resetAt / 1000)));
    if (state.count <= max) return next();
    const retryAfter = Math.max(1, Math.ceil((state.resetAt - now) / 1000));
    res.setHeader('Retry-After', String(retryAfter));
    writeAudit({ req, actor: req.user, action: 'RATE_LIMIT_BLOCKED', outcome: 'blocked', severity: 'warning', metadata: { limiter: name, retryAfter } });
    return res.status(429).json({ error: `Too many ${name} requests. Try again in ${retryAfter} seconds.` });
  };
}

function apiErrorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  console.error(`[${req.id || 'request'}]`, err);
  writeAudit({ req, actor: req.user, action: 'UNHANDLED_SERVER_ERROR', outcome: 'failure', severity: 'high', metadata: { route: req.originalUrl, errorName: err.name } });
  const status = Number(err.status || err.statusCode || 500);
  const message = status >= 500 ? 'The server could not complete this request.' : (err.message || 'Request failed.');
  res.status(status).json({ error: message, requestId: req.id });
}

module.exports = { requestContext, securityHeaders, originGuard, noSqlInjectionGuard, createRateLimit, apiErrorHandler };
