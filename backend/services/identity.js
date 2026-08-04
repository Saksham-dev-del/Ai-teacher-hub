const crypto = require('crypto');
const jwt = require('jsonwebtoken');

function identitySecret() {
  return String(process.env.FACE_IDENTITY_SECRET || process.env.AUDIT_HASH_SECRET || process.env.JWT_SECRET || 'development-face-secret-change-me');
}

function encryptionKey() {
  return crypto.createHash('sha256').update(identitySecret()).digest();
}

function encryptPayload(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64')
  };
}

function decryptPayload(ciphertext, iv, tag) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]);
  return JSON.parse(plaintext.toString('utf8'));
}

function sanitizeDescriptor(value) {
  if (!Array.isArray(value) || value.length < 64 || value.length > 4096) throw Object.assign(new Error('A valid face descriptor was not supplied.'), { status: 400 });
  const output = value.map((item) => Number(item));
  if (output.some((item) => !Number.isFinite(item) || Math.abs(item) > 100)) throw Object.assign(new Error('Face descriptor contains invalid values.'), { status: 400 });
  return output.map((item) => Math.round(item * 1000000) / 1000000);
}

function descriptorDistance(a, b, options = { order: 2, multiplier: 25 }) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length < 64) return Number.POSITIVE_INFINITY;
  const order = Number(options.order || 2);
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const diff = order === 2 ? a[i] - b[i] : Math.abs(a[i] - b[i]);
    sum += order === 2 ? diff * diff : diff ** order;
  }
  return Math.round(100 * Number(options.multiplier || 25) * sum) / 100;
}

function descriptorSimilarity(a, b, options = { order: 2, multiplier: 25, min: 0.2, max: 0.8 }) {
  const distance = descriptorDistance(a, b, options);
  if (!Number.isFinite(distance)) return 0;
  if (distance === 0) return 1;
  const order = Number(options.order || 2);
  const root = order === 2 ? Math.sqrt(distance) : distance ** (1 / order);
  const min = Number(options.min ?? 0.2);
  const max = Number(options.max ?? 0.8);
  const normalized = (1 - root / 100 - min) / Math.max(0.0001, max - min);
  return Math.round(1000 * Math.max(0, Math.min(1, normalized))) / 1000;
}

function encryptDescriptor(descriptor) {
  return encryptPayload(sanitizeDescriptor(descriptor));
}

function decryptDescriptor(identity) {
  return sanitizeDescriptor(decryptPayload(identity.descriptorCiphertext, identity.descriptorIv, identity.descriptorTag));
}

function parseSelfieDataUrl(value) {
  const text = String(value || '');
  const match = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(text);
  if (!match) throw Object.assign(new Error('Enrollment selfie must be a JPEG or PNG image.'), { status: 400 });
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > Number(process.env.MAX_IDENTITY_SELFIE_BYTES || 350000)) throw Object.assign(new Error('Enrollment selfie is empty or too large.'), { status: 400 });
  return { mime: match[1], base64: bytes.toString('base64') };
}

function encryptSelfie(dataUrl) {
  const selfie = parseSelfieDataUrl(dataUrl);
  return { ...encryptPayload(selfie.base64), mime: selfie.mime };
}

function decryptSelfie(identity) {
  if (!identity.selfieCiphertext) return null;
  return {
    mime: identity.selfieMime || 'image/jpeg',
    bytes: Buffer.from(decryptPayload(identity.selfieCiphertext, identity.selfieIv, identity.selfieTag), 'base64')
  };
}

function proofSecret() {
  return crypto.createHash('sha256').update(`${identitySecret()}:identity-proof`).digest('hex');
}

function createIdentityProof({ studentId, quizId, deviceFingerprintHash, similarity, identityVersion }) {
  return jwt.sign({
    sub: String(studentId),
    quizId: String(quizId),
    deviceFingerprintHash: String(deviceFingerprintHash),
    similarity: Number(similarity || 0),
    identityVersion: Number(identityVersion || 1),
    purpose: 'quiz-identity-proof',
    jti: crypto.randomUUID()
  }, proofSecret(), {
    expiresIn: '2m',
    issuer: process.env.JWT_ISSUER || 'ai-teacher-resource-hub',
    audience: 'quiz-identity-start'
  });
}

function verifyIdentityProof(token, { studentId, quizId, deviceFingerprintHash, minimumSimilarity = 0.55 }) {
  try {
    const payload = jwt.verify(String(token || ''), proofSecret(), {
      issuer: process.env.JWT_ISSUER || 'ai-teacher-resource-hub',
      audience: 'quiz-identity-start'
    });
    const valid = payload.purpose === 'quiz-identity-proof'
      && String(payload.sub) === String(studentId)
      && String(payload.quizId) === String(quizId)
      && String(payload.deviceFingerprintHash) === String(deviceFingerprintHash)
      && Number(payload.similarity || 0) >= Number(minimumSimilarity || 0.55);
    return valid ? payload : null;
  } catch (_) {
    return null;
  }
}

function safeIdentity(identity) {
  if (!identity) return { enrolled: false, status: 'not_enrolled' };
  return {
    id: String(identity._id),
    student: identity.student && typeof identity.student === 'object' ? {
      id: String(identity.student._id || identity.student.id || identity.student),
      name: identity.student.name || '',
      email: identity.student.email || ''
    } : String(identity.student),
    enrolled: true,
    status: identity.status,
    descriptorLength: identity.descriptorLength,
    livenessScore: identity.livenessScore,
    antiSpoofScore: identity.antiSpoofScore,
    challengeType: identity.challengeType,
    challengePassed: identity.challengePassed,
    enrolledAt: identity.enrolledAt,
    verifiedAt: identity.verifiedAt,
    rejectionReason: identity.rejectionReason || '',
    version: identity.version,
    lastMatchedAt: identity.lastMatchedAt,
    lastMatchScore: identity.lastMatchScore,
    hasSelfie: Boolean(identity.selfieCiphertext || identity.selfieMime)
  };
}

module.exports = {
  encryptPayload,
  decryptPayload,
  sanitizeDescriptor,
  descriptorDistance,
  descriptorSimilarity,
  encryptDescriptor,
  decryptDescriptor,
  encryptSelfie,
  decryptSelfie,
  createIdentityProof,
  verifyIdentityProof,
  safeIdentity
};
