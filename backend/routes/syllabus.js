const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const Syllabus = require('../models/Syllabus');
const { requireAuth, requireRole } = require('../middleware/auth');
const { normalizeWhitespace, chunkText, embedDocuments } = require('../services/rag');
const { neutralizeReferenceText } = require('../services/promptGuard');
const { safeFilename, hasDangerousDoubleExtension, writeAudit, createSecurityAlert } = require('../services/security');


async function parsePdf(buffer) {
  const { extractText, getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const parsed = await extractText(pdf, { mergePages: true });
  return {
    text: parsed.text || '',
    numpages: Number(parsed.totalPages || 0)
  };
}

const router = express.Router();
router.use(requireAuth, requireRole('teacher', 'admin'));

const maxMb = Math.max(2, Number(process.env.MAX_SYLLABUS_PDF_MB || 10));
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxMb * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const lower = String(file.originalname || '').toLowerCase();
    const isPdf = file.mimetype === 'application/pdf' && lower.endsWith('.pdf') && !hasDangerousDoubleExtension(lower);
    cb(isPdf ? null : new Error('Only genuine single-extension PDF syllabus files are supported.'), isPdf);
  }
});

function summary(doc) {
  return {
    _id: doc._id,
    originalName: doc.originalName,
    course: doc.course,
    subject: doc.subject,
    pageCount: doc.pageCount,
    wordCount: doc.wordCount,
    chunkCount: doc.chunkCount,
    embeddingStatus: doc.embeddingStatus,
    embeddingModel: doc.embeddingModel,
    securityStatus: doc.securityStatus || 'clear',
    promptInjectionScore: Number(doc.promptInjectionScore || 0),
    createdAt: doc.createdAt
  };
}

router.get('/', async (req, res) => {
  try {
    const docs = await Syllabus.find({ owner: req.user._id })
      .sort({ createdAt: -1 })
      .select('-chunks');
    res.json({ syllabi: docs.map(summary) });
  } catch (error) {
    console.error('[syllabus/list]', error.message);
    res.status(500).json({ error: 'Could not load syllabus library.' });
  }
});

router.get('/:id/preview', async (req, res) => {
  try {
    const doc = await Syllabus.findOne({ _id: req.params.id, owner: req.user._id });
    if (!doc) return res.status(404).json({ error: 'Syllabus not found.' });
    res.json({
      syllabus: summary(doc),
      preview: doc.chunks.slice(0, 3).map((chunk) => ({ index: chunk.index, text: chunk.text.slice(0, 700) }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Could not preview syllabus.' });
  }
});

router.post('/upload', (req, res) => {
  upload.single('syllabus')(req, res, async (uploadError) => {
    if (uploadError) {
      const tooLarge = uploadError.code === 'LIMIT_FILE_SIZE';
      return res.status(400).json({ error: tooLarge ? `PDF must be smaller than ${maxMb} MB.` : uploadError.message });
    }

    try {
      if (!req.file) return res.status(400).json({ error: 'Please select a syllabus PDF.' });
      const lowerName = String(req.file.originalname || '').toLowerCase();
      if (!lowerName.endsWith('.pdf') || req.file.mimetype !== 'application/pdf') {
        return res.status(400).json({ error: 'Only genuine .pdf files are accepted. Renamed or double-extension files are blocked.' });
      }
      if (req.file.buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
        return res.status(400).json({ error: 'The uploaded file is not a valid PDF document.' });
      }
      const fileHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
      const existing = await Syllabus.findOne({ owner: req.user._id, fileHash });
      if (existing) return res.json({ syllabus: summary(existing), duplicate: true });

      const parsed = await parsePdf(req.file.buffer);
      const rawText = normalizeWhitespace(parsed.text);
      const guarded = neutralizeReferenceText(rawText);
      const text = normalizeWhitespace(guarded.sanitized);
      if (text.length < 120) {
        return res.status(400).json({
          error: 'Very little selectable text was found. Upload a text-based PDF or convert the scanned syllabus with OCR first.'
        });
      }

      const chunks = chunkText(text);
      let embeddingStatus = 'lexical';
      let embeddingModel = '';
      try {
        const embedded = await embedDocuments(chunks, req.file.originalname);
        if (embedded) {
          chunks.forEach((chunk, index) => { chunk.embedding = embedded.vectors[index]; });
          embeddingStatus = 'semantic';
          embeddingModel = embedded.model;
        }
      } catch (embeddingError) {
        console.warn('[syllabus/upload] Semantic indexing unavailable; saved with lexical RAG:', embeddingError.message);
      }

      const doc = new Syllabus({
        owner: req.user._id,
        originalName: safeFilename(req.file.originalname, 'syllabus.pdf'),
        course: String(req.body.course || '').slice(0, 80),
        subject: String(req.body.subject || '').slice(0, 120),
        fileHash,
        pageCount: Number(parsed.numpages || 0),
        wordCount: text.split(/\s+/).filter(Boolean).length,
        textLength: text.length,
        chunkCount: chunks.length,
        embeddingStatus,
        embeddingModel,
        securityStatus: guarded.status,
        promptInjectionScore: guarded.score,
        securityFindings: guarded.findings,
        chunks
      });
      await doc.save();
      await writeAudit({ req, actor: req.user, action: 'SYLLABUS_UPLOADED', targetType: 'Syllabus', targetId: doc._id, metadata: { fileHash, securityStatus: guarded.status, promptInjectionScore: guarded.score } });
      if (guarded.status !== 'clear') await createSecurityAlert({ req, actor: req.user, type: 'prompt_injection_in_document', title: 'Instruction-like text found in uploaded syllabus', description: 'Potential prompt-injection text was neutralized before RAG indexing.', severity: guarded.status === 'high-risk' ? 'high' : 'medium', targetType: 'Syllabus', targetId: doc._id, metadata: { score: guarded.score, findings: guarded.findings.map((x) => x.id) } });
      res.status(201).json({ syllabus: summary(doc), duplicate: false });
    } catch (error) {
      console.error('[syllabus/upload]', error);
      if (error && error.code === 11000) {
        const existing = await Syllabus.findOne({ owner: req.user._id, fileHash: error.keyValue && error.keyValue.fileHash });
        if (existing) return res.json({ syllabus: summary(existing), duplicate: true });
      }
      res.status(500).json({ error: error.message || 'Could not process syllabus PDF.' });
    }
  });
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await Syllabus.deleteOne({ _id: req.params.id, owner: req.user._id });
    if (!result.deletedCount) return res.status(404).json({ error: 'Syllabus not found.' });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Could not delete syllabus.' });
  }
});

module.exports = router;
