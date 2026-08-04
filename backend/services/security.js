const crypto = require('crypto');
const AuditLog = require('../models/AuditLog');
const SecurityAlert = require('../models/SecurityAlert');

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function hmac(value) {
  const key = process.env.AUDIT_HASH_SECRET || process.env.JWT_SECRET || 'development-only-change-me';
  return crypto.createHmac('sha256', key).update(String(value || '')).digest('hex');
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function timingSafeEqualText(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase().slice(0, 254);
}

function cleanText(value, max = 500) {
  return String(value || '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim()
    .slice(0, max);
}

function passwordProblems(password) {
  const value = String(password || '');
  const problems = [];
  if (value.length < 10) problems.push('at least 10 characters');
  if (!/[a-z]/.test(value)) problems.push('one lowercase letter');
  if (!/[A-Z]/.test(value)) problems.push('one uppercase letter');
  if (!/[0-9]/.test(value)) problems.push('one number');
  if (!/[^A-Za-z0-9]/.test(value)) problems.push('one special character');
  if (/(password|qwerty|123456|admin|letmein)/i.test(value)) problems.push('a less predictable phrase');
  return problems;
}

function parseCookies(req) {
  const out = {};
  const raw = String(req.headers.cookie || '');
  raw.split(';').forEach((piece) => {
    const idx = piece.indexOf('=');
    if (idx === -1) return;
    const key = piece.slice(0, idx).trim();
    const value = piece.slice(idx + 1).trim();
    if (!key) return;
    try { out[key] = decodeURIComponent(value); } catch (_) { out[key] = value; }
  });
  return out;
}

function setRefreshCookie(res, token, maxAgeMs) {
  const secure = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';
  const parts = [
    `trh_refresh=${encodeURIComponent(token)}`,
    'Path=/api/auth',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${Math.max(1, Math.floor(maxAgeMs / 1000))}`
  ];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearRefreshCookie(res) {
  const secure = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';
  const parts = ['trh_refresh=', 'Path=/api/auth', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0'];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket?.remoteAddress || req.ip || '';
}

function clientIdentity(req) {
  const ip = clientIp(req);
  const ua = cleanText(req.headers['user-agent'], 600);
  return {
    ipHash: hmac(ip),
    userAgentHash: hmac(ua),
    userAgent: ua,
    requestId: req.id || ''
  };
}

function deviceFingerprintHash(value) {
  return hmac(cleanText(value, 1000));
}

function safeMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return undefined;
  const blocked = /password|secret|token|authorization|cookie|api.?key|camera.?frame|image.?data/i;
  const output = {};
  for (const [key, value] of Object.entries(metadata).slice(0, 30)) {
    if (blocked.test(key)) continue;
    if (typeof value === 'string') output[key] = cleanText(value, 800);
    else if (typeof value === 'number' || typeof value === 'boolean' || value === null) output[key] = value;
    else if (Array.isArray(value)) output[key] = value.slice(0, 20).map((item) => typeof item === 'string' ? cleanText(item, 300) : item);
    else if (typeof value === 'object') output[key] = JSON.parse(JSON.stringify(value).slice(0, 3000));
  }
  return output;
}

async function writeAudit({ req, actor, action, outcome = 'success', severity = 'info', targetType = '', targetId = '', metadata }) {
  try {
    const identity = req ? clientIdentity(req) : {};
    await AuditLog.create({
      actor: actor?._id || actor || null,
      actorRole: actor?.role || '',
      action: cleanText(action, 120),
      outcome,
      severity,
      targetType: cleanText(targetType, 80),
      targetId: cleanText(targetId, 160),
      requestId: identity.requestId || '',
      ipHash: identity.ipHash || '',
      userAgentHash: identity.userAgentHash || '',
      metadata: safeMetadata(metadata),
      expiresAt: new Date(Date.now() + Math.max(7, Number(process.env.AUDIT_RETENTION_DAYS || 180)) * 86400000)
    });
  } catch (error) {
    console.warn('[audit] Could not persist audit event:', error.message);
  }
}

async function createSecurityAlert({ req, actor, type, title, description, severity = 'medium', targetType = '', targetId = '', metadata }) {
  try {
    const identity = req ? clientIdentity(req) : {};
    return await SecurityAlert.create({
      actor: actor?._id || actor || null,
      actorRole: actor?.role || '',
      type: cleanText(type, 100),
      title: cleanText(title, 180),
      description: cleanText(description, 1400),
      severity,
      targetType: cleanText(targetType, 80),
      targetId: cleanText(targetId, 160),
      requestId: identity.requestId || '',
      ipHash: identity.ipHash || '',
      metadata: safeMetadata(metadata)
    });
  } catch (error) {
    console.warn('[security-alert] Could not persist alert:', error.message);
    return null;
  }
}

function safeFilename(name, fallback = 'upload') {
  const base = String(name || fallback).normalize('NFKC').replace(/[\\/\0]/g, '_').replace(/[^A-Za-z0-9._ -]/g, '_').replace(/\.{2,}/g, '.').trim();
  return (base || fallback).slice(0, 180);
}

function hasDangerousDoubleExtension(name) {
  const lower = String(name || '').toLowerCase();
  return /\.(exe|com|scr|bat|cmd|ps1|js|mjs|cjs|html?|svg|php|jar|msi|dll|sh|py|pl)(\.|$)/i.test(lower) || /\.(pdf|png|jpe?g)\.[a-z0-9]{1,8}$/i.test(lower);
}

module.exports = {
  sha256,
  hmac,
  randomToken,
  timingSafeEqualText,
  normalizeEmail,
  cleanText,
  passwordProblems,
  parseCookies,
  setRefreshCookie,
  clearRefreshCookie,
  clientIp,
  clientIdentity,
  deviceFingerprintHash,
  safeMetadata,
  writeAudit,
  createSecurityAlert,
  safeFilename,
  hasDangerousDoubleExtension
};
