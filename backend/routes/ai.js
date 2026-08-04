const express = require('express');
const { generateContent } = require('../providers');
const { exportPdf } = require('../export/pdf');
const { exportDocx } = require('../export/docx');
const { requireAuth } = require('../middleware/auth');
const Syllabus = require('../models/Syllabus');
const { retrieveRelevantChunks } = require('../services/rag');
const { buildQualityScore } = require('../services/quality');
const { resolveMediaAssets } = require('../services/mediaResolver');

const router = express.Router();
router.use(requireAuth);

function safeName(draft) {
  const base = (draft && draft.topic) || 'resource';
  return base.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
}

function cleanStringArray(value, max) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '').trim()).filter(Boolean).slice(0, max);
}

router.post('/generate', async (req, res) => {
  try {
    const {
      course, subject, topic, difficulty, duration, type, language, style,
      syllabusId, useRag, bloomLevels, bloomQuestionCount, courseOutcomes
    } = req.body || {};

    if (!course || !subject || !topic || !difficulty || !duration || !type || !style) {
      return res.status(400).json({ error: 'Missing one or more required fields.' });
    }

    let syllabus = null;
    let ragContext = { mode: 'none', chunks: [], coverage: 0, embeddingModel: '' };
    if (useRag && syllabusId) {
      syllabus = await Syllabus.findOne({ _id: syllabusId, owner: req.user._id });
      if (!syllabus) return res.status(404).json({ error: 'Selected syllabus could not be found.' });
      const query = `${course} ${subject} ${topic} ${type} ${cleanStringArray(bloomLevels, 6).join(' ')}`;
      ragContext = await retrieveRelevantChunks(
        syllabus,
        query,
        Math.max(3, Math.min(Number(process.env.RAG_TOP_K || 5), 8))
      );
    }

    const inputs = {
      course: String(course).slice(0, 100),
      subject: String(subject).slice(0, 160),
      topic: String(topic).slice(0, 220),
      difficulty: String(difficulty).slice(0, 40),
      duration: String(duration).slice(0, 40),
      type: String(type).slice(0, 60),
      language: String(language || 'English').slice(0, 50),
      style: String(style).slice(0, 60),
      bloomLevels: cleanStringArray(bloomLevels, 6),
      bloomQuestionCount: Math.max(4, Math.min(Number(bloomQuestionCount || 6), 12)),
      courseOutcomes: cleanStringArray(courseOutcomes, 8),
      ragContext
    };

    const result = await generateContent(inputs);
    const qualityScore = buildQualityScore(result, inputs, ragContext);
    const grounding = {
      mode: ragContext.mode,
      coverage: ragContext.coverage,
      embeddingModel: ragContext.embeddingModel || syllabus?.embeddingModel || '',
      retrievedChunks: (ragContext.chunks || []).map(({ sourceId, chunkIndex, score, preview }) => ({ sourceId, chunkIndex, score, preview }))
    };

    res.json({
      ...result,
      qualityScore,
      syllabusId: syllabus ? syllabus._id : null,
      syllabusName: syllabus ? syllabus.originalName : '',
      grounding
    });
  } catch (err) {
    console.error('[generate]', err);
    res.status(500).json({ error: err.message || 'AI generation failed.' });
  }
});

router.post('/export/pdf', async (req, res) => {
  try {
    const draft = req.body && req.body.draft;
    if (!draft) return res.status(400).json({ error: 'Missing draft in request body.' });
    const assets = await resolveMediaAssets(draft, req.user);
    const bytes = await exportPdf(draft, { assets, institution: req.body?.institution || 'Academic Institution' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName(draft)}.pdf"`);
    res.send(Buffer.from(bytes));
  } catch (err) {
    console.error('[export/pdf]', err.message);
    res.status(500).json({ error: err.message || 'PDF export failed.' });
  }
});

router.post('/export/docx', async (req, res) => {
  try {
    const draft = req.body && req.body.draft;
    if (!draft) return res.status(400).json({ error: 'Missing draft in request body.' });
    const buffer = await exportDocx(draft);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName(draft)}.docx"`);
    res.send(buffer);
  } catch (err) {
    console.error('[export/docx]', err.message);
    res.status(500).json({ error: err.message || 'DOCX export failed.' });
  }
});

module.exports = router;
