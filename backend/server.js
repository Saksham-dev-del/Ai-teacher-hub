require('dotenv').config();
const express = require('express');
const path = require('path');
const { connectDB } = require('./config/db');
const {
  requestContext,
  securityHeaders,
  originGuard,
  noSqlInjectionGuard,
  createRateLimit,
  apiErrorHandler
} = require('./middleware/security');
const { startAttemptMonitor } = require('./services/attemptMonitor');

const authRoutes = require('./routes/auth');
const resourceRoutes = require('./routes/resources');
const aiRoutes = require('./routes/ai');
const adminRoutes = require('./routes/admin');
const syllabusRoutes = require('./routes/syllabus');
const quizRoutes = require('./routes/quizzes');
const performanceRoutes = require('./routes/performance');
const calendarRoutes = require('./routes/calendar');
const presentationRoutes = require('./routes/presentations');
const detailedRoutes = require('./routes/detailed');
const mediaRoutes = require('./routes/media');
const securityRoutes = require('./routes/security');
const personalizedRoutes = require('./routes/personalized');
const academicSuiteRoutes = require('./routes/academicSuite');
const collaborationRoutes = require('./routes/collaboration');
const intelligenceRoutes = require('./routes/intelligence');

const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);

app.use(requestContext);
app.use(securityHeaders);
app.use(express.json({ limit: `${Math.max(1, Number(process.env.MAX_JSON_MB || 6))}mb`, strict: true }));
app.use(originGuard);
app.use(noSqlInjectionGuard);

const generalApiLimit = createRateLimit({ windowMs: 15 * 60 * 1000, max: Number(process.env.API_RATE_LIMIT || 600), name: 'API' });
const loginLimit = createRateLimit({ windowMs: 15 * 60 * 1000, max: Number(process.env.LOGIN_RATE_LIMIT || 12), name: 'login' });
const registerLimit = createRateLimit({ windowMs: 60 * 60 * 1000, max: Number(process.env.REGISTER_RATE_LIMIT || 8), name: 'registration' });
const refreshLimit = createRateLimit({ windowMs: 15 * 60 * 1000, max: 80, name: 'session refresh' });
const aiLimit = createRateLimit({ windowMs: 60 * 60 * 1000, max: Number(process.env.AI_RATE_LIMIT || 40), name: 'AI generation' });
const exportLimit = createRateLimit({ windowMs: 15 * 60 * 1000, max: Number(process.env.EXPORT_RATE_LIMIT || 20), name: 'document export' });
const uploadLimit = createRateLimit({ windowMs: 60 * 60 * 1000, max: Number(process.env.UPLOAD_RATE_LIMIT || 30), name: 'file upload' });
const quizWriteLimit = createRateLimit({ windowMs: 60 * 1000, max: Number(process.env.QUIZ_EVENT_RATE_LIMIT || 120), name: 'secure quiz event' });
const phase910Limit = createRateLimit({ windowMs: 60 * 60 * 1000, max: Number(process.env.PHASE910_RATE_LIMIT || 120), name: 'Phase 9/10 platform' });
const phase78Limit = createRateLimit({ windowMs: 60 * 60 * 1000, max: Number(process.env.PHASE78_RATE_LIMIT || 80), name: 'Phase 7/8 generation' });

app.use('/api', generalApiLimit);
app.use('/api/auth/login', loginLimit);
app.use('/api/auth/register', registerLimit);
app.use('/api/auth/refresh', refreshLimit);
app.use('/api/generate', aiLimit);
app.use('/api/detailed', aiLimit);
app.use('/api/presentations/export', exportLimit);
app.use('/api/presentations/live-edit', aiLimit);
app.use('/api/presentations/translate', aiLimit);
app.use('/api/presentations/review', aiLimit);
app.use('/api/presentations/exam-notes', aiLimit);
app.use('/api/presentations/optimize-layout', aiLimit);
app.use('/api/presentations/beautify', aiLimit);
app.use('/api/presentations/animation-plan', generalApiLimit);
app.use('/api/presentations/website', generalApiLimit);
app.use('/api/presentations/repurpose', aiLimit);
app.use('/api/presentations/narration', aiLimit);
app.use('/api/presentations/video-package', aiLimit);
app.use('/api/export', exportLimit);
app.use('/api/syllabus/upload', uploadLimit);
app.use('/api/media/upload', uploadLimit);
app.use('/api/quizzes', quizWriteLimit);
app.use('/api/personalized/generate', phase78Limit);
app.use('/api/academic-suite/generate', phase78Limit);
app.use('/api/collaboration', phase910Limit);
app.use('/api/intelligence', phase910Limit);

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    provider: (process.env.AI_PROVIDER || 'gemini').toLowerCase(),
    phase: 11,
    security: {
      zeroTrustQuiz: true,
      serverSideGrading: true,
      serverControlledTimer: true,
      signedAttemptTokens: true,
      oneTimeSubmissionNonce: true,
      heartbeatAndAutosave: true,
      refreshTokenRotation: true,
      accountLockout: true,
      rateLimiting: true,
      auditLogging: true,
      securityAlerts: true,
      promptInjectionGuard: true,
      privateMediaServing: true,
      strictUploadValidation: true,
      personalizedLearningEngine: true,
      learningLevelDetection: true,
      adaptiveNotes: true,
      questionPaperBlueprints: true,
      coursePlanning: true,
      revisionPlanning: true,
      attendanceReminders: true,
      teacherCollaboration: true,
      contentVersionHistory: true,
      departmentDashboards: true,
      qrResourceSharing: true,
      voiceAndAudioNotes: true,
      diagramGeneration: true,
      similarityRiskAnalysis: true,
      claimLevelFactualVerification: true,
      syllabusEvidenceMapping: true,
      strictFacePresenceCancellation: true,
      encryptedStudentIdentityEnrollment: true,
      teacherApprovedIdentityProfiles: true,
      liveFaceIdentityMatching: true,
      continuousIdentityReauthentication: true,
      antiSpoofAndLivenessChecks: true,
      impersonationPrevention: true,
      semanticSmartSearch: true,
      offlinePwa: true
    }
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/syllabus', syllabusRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/presentations', presentationRoutes);
app.use('/api/detailed', detailedRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/personalized', personalizedRoutes);
app.use('/api/academic-suite', academicSuiteRoutes);
app.use('/api/collaboration', collaborationRoutes);
app.use('/api/intelligence', intelligenceRoutes);
app.use('/api', aiRoutes);
app.use('/api/admin', adminRoutes);

app.use(express.static(path.join(__dirname, '..', 'frontend'), {
  etag: true,
  maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
  }
}));

app.use('/api', (req, res) => res.status(404).json({ error: 'API endpoint not found.', requestId: req.id }));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html')));
app.use(apiErrorHandler);

const PORT = process.env.PORT || 3000;

function configurationWarnings() {
  const warnings = [];
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) warnings.push('JWT_SECRET must be at least 32 characters. Authentication will reject requests until fixed.');
  if (!process.env.MONGODB_URI) warnings.push('MONGODB_URI is not configured.');
  if (process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'true') warnings.push('Set COOKIE_SECURE=true in production.');
  return warnings;
}

async function main() {
  configurationWarnings().forEach((warning) => console.warn(`!! Security configuration: ${warning}`));
  try {
    await connectDB();
    startAttemptMonitor();
  } catch (err) {
    console.error('!! Could not connect to MongoDB:', err.message);
    console.error('!! The server will still start, but authentication, saved resources, security logs and quizzes require MONGODB_URI in backend/.env');
  }
  app.listen(PORT, () => {
    console.log(`AI Teacher Resource Hub Identity Security Upgrade running at http://localhost:${PORT}`);
    console.log(`Using AI provider: ${(process.env.AI_PROVIDER || 'gemini').toLowerCase()}`);
    console.log('Platform mode: zero-trust security + encrypted student identity lock + continuous impersonation prevention');
  });
}

main();
