const express = require('express');
const Syllabus = require('../models/Syllabus');
const MediaAsset = require('../models/MediaAsset');
const { requireAuth, requireRole } = require('../middleware/auth');
const { retrieveRelevantChunks } = require('../services/rag');
const { runDetailedGeneration } = require('../services/detailedGeneration');

const router = express.Router();
router.use(requireAuth, requireRole('teacher', 'admin'));
const jobs = new Map();
const MAX_JOBS = 120;

function publicJob(job) {
  return { id: job.id, status: job.status, stage: job.stage, progress: job.progress, message: job.message, draft: job.status === 'complete' ? job.draft : undefined, error: job.error, createdAt: job.createdAt };
}

function cleanList(value, max = 10) {
  return Array.isArray(value) ? value.map((x) => String(x || '').trim()).filter(Boolean).slice(0, max) : [];
}

async function buildRagContext(syllabi, query) {
  const all = [];
  let semanticUsed = false;
  for (const syllabus of syllabi) {
    const context = await retrieveRelevantChunks(syllabus, query, Math.max(2, Math.min(Number(process.env.RAG_TOP_K || 5), 7)));
    if (context.mode === 'semantic-hybrid') semanticUsed = true;
    (context.chunks || []).forEach((chunk) => all.push({ ...chunk, documentName: syllabus.originalName, syllabusId: syllabus._id }));
  }
  all.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  const limit = Math.max(4, Math.min(Number(process.env.PHASE4_RAG_TOP_K || 10), 16));
  const chunks = all.slice(0, limit).map((chunk, i) => ({ ...chunk, sourceId: `S${i + 1}` }));
  return {
    mode: semanticUsed ? 'hybrid-multi-source' : syllabi.length ? 'lexical-multi-source' : 'none',
    chunks,
    coverage: chunks.length ? Math.round(chunks.reduce((s, x) => s + Number(x.score || 0), 0) / chunks.length * 100) : 0,
    embeddingModel: syllabi.find((x) => x.embeddingModel)?.embeddingModel || ''
  };
}

function normalizeInputs(body) {
  return {
    course: String(body.course || '').slice(0, 100),
    subject: String(body.subject || '').slice(0, 160),
    topic: String(body.topic || '').slice(0, 220),
    difficulty: String(body.difficulty || 'Intermediate').slice(0, 40),
    duration: String(body.duration || '60 minutes').slice(0, 40),
    type: String(body.type || 'Notes').slice(0, 60),
    language: String(body.language || 'English').slice(0, 50),
    style: String(body.style || 'Concept-First').slice(0, 60),
    contentDepth: String(body.contentDepth || 'detailed').toLowerCase(),
    visualDensity: String(body.visualDensity || 'balanced').toLowerCase(),
    targetPages: Math.max(4, Math.min(Number(body.targetPages || 20), 50)),
    targetSlides: Math.max(8, Math.min(Number(body.targetSlides || 26), 100)),
    presentationType: String(body.presentationType || '').slice(0, 60),
    examplesPerTopic: Math.max(1, Math.min(Number(body.examplesPerTopic || 2), 5)),
    includeDiagrams: body.includeDiagrams !== false,
    includeImages: body.includeImages !== false,
    includeCaseStudies: body.includeCaseStudies !== false,
    includeReferences: body.includeReferences !== false,
    includeSpeakerNotes: body.includeSpeakerNotes !== false,
    bloomLevels: cleanList(body.bloomLevels, 6),
    bloomQuestionCount: Math.max(4, Math.min(Number(body.bloomQuestionCount || 8), 12)),
    courseOutcomes: cleanList(body.courseOutcomes, 8)
  };
}

router.post('/jobs', async (req, res) => {
  const inputs = normalizeInputs(req.body || {});
  if (!inputs.course || !inputs.subject || !inputs.topic) return res.status(400).json({ error: 'Course, subject and topic are required.' });
  const referenceIds = req.body.useRag === false ? [] : cleanList(req.body.referenceIds || (req.body.syllabusId ? [req.body.syllabusId] : []), 6);
  const mediaIds = cleanList(req.body.mediaAssetIds, 8);
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const job = { id, owner: String(req.user._id), status: 'queued', stage: 'queued', progress: 1, message: 'Detailed generation job queued', draft: null, error: '', createdAt: new Date().toISOString() };
  jobs.set(id, job);
  while (jobs.size > MAX_JOBS) jobs.delete(jobs.keys().next().value);
  res.status(202).json({ job: publicJob(job) });

  setImmediate(async () => {
    try {
      job.status = 'running';
      job.stage = 'sources';
      job.progress = 4;
      job.message = 'Loading selected academic sources and visual assets';
      const syllabi = referenceIds.length ? await Syllabus.find({ _id: { $in: referenceIds }, owner: req.user._id }) : [];
      const mediaAssets = mediaIds.length ? await MediaAsset.find({ _id: { $in: mediaIds }, owner: req.user._id }) : [];
      const query = `${inputs.course} ${inputs.subject} ${inputs.topic} ${inputs.type} ${inputs.bloomLevels.join(' ')}`;
      const ragContext = syllabi.length ? await buildRagContext(syllabi, query) : { mode: 'none', chunks: [], coverage: 0, embeddingModel: '' };
      const draft = await runDetailedGeneration({
        inputs,
        ragContext,
        syllabi,
        mediaAssets,
        onProgress(update) { Object.assign(job, update); }
      });
      draft.syllabusId = syllabi[0]?._id || null;
      draft.syllabusName = syllabi.map((x) => x.originalName).join(', ');
      draft.referenceIds = syllabi.map((x) => x._id);
      draft.grounding = {
        mode: ragContext.mode,
        coverage: ragContext.coverage,
        embeddingModel: ragContext.embeddingModel,
        retrievedChunks: ragContext.chunks.map(({ sourceId, chunkIndex, score, preview, documentName }) => ({ sourceId, chunkIndex, score, preview: preview || String(ragContext.chunks.find((x) => x.sourceId === sourceId)?.text || '').slice(0, 500), documentName }))
      };
      job.draft = draft;
      job.status = 'complete';
      job.stage = 'complete';
      job.progress = 100;
      job.message = 'Detailed visual resource is ready';
    } catch (error) {
      console.error('[phase4/job]', error);
      job.status = 'failed';
      job.stage = 'failed';
      job.error = error.message || 'Detailed generation failed.';
      job.message = job.error;
    }
  });
});

router.get('/jobs/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job || job.owner !== String(req.user._id)) return res.status(404).json({ error: 'Generation job not found.' });
  res.json({ job: publicJob(job) });
});

module.exports = router;
