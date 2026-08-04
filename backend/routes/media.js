const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const MediaAsset = require('../models/MediaAsset');
const Resource = require('../models/Resource');
const { requireAuth, requireRole } = require('../middleware/auth');
const { safeFilename, hasDangerousDoubleExtension, writeAudit, createSecurityAlert } = require('../services/security');

const router = express.Router();
router.use(requireAuth);
const uploadRoot = path.join(__dirname, '..', 'private_uploads');
fs.mkdirSync(uploadRoot, { recursive: true });

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = path.join(uploadRoot, String(req.user._id));
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const ext = file.mimetype === 'image/png' ? '.png' : '.jpg';
    cb(null, `${Date.now()}-${crypto.randomBytes(16).toString('hex')}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: Math.max(2, Number(process.env.MAX_VISUAL_IMAGE_MB || 8)) * 1024 * 1024, files: 8, fields: 8, parts: 20 },
  fileFilter(req, file, cb) {
    const ext = path.extname(String(file.originalname || '')).toLowerCase();
    const valid = !hasDangerousDoubleExtension(file.originalname)
      && ((file.mimetype === 'image/png' && ext === '.png') || (file.mimetype === 'image/jpeg' && ['.jpg', '.jpeg'].includes(ext)));
    cb(valid ? null : new Error('Only genuine single-extension PNG, JPG or JPEG images are supported.'), valid);
  }
});

function summary(doc) {
  return {
    _id: doc._id,
    originalName: doc.originalName,
    mimeType: doc.mimeType,
    size: doc.size,
    url: `/api/media/${doc._id}/file`,
    caption: doc.caption,
    createdAt: doc.createdAt
  };
}

router.get('/', requireRole('teacher', 'admin'), async (req, res, next) => {
  try {
    const query = req.user.role === 'admin' && req.query.scope === 'all' ? {} : { owner: req.user._id };
    const items = await MediaAsset.find(query).sort({ createdAt: -1 }).limit(100);
    res.json({ assets: items.map(summary) });
  } catch (err) { next(err); }
});

router.get('/:id/file', async (req, res, next) => {
  try {
    const doc = await MediaAsset.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Image not found.' });
    let allowed = req.user.role === 'admin' || String(doc.owner) === String(req.user._id);
    if (!allowed && req.user.role === 'student') {
      allowed = Boolean(await Resource.exists({ shared: true, $or: [{ 'visualAssets._id': String(doc._id) }, { 'visualAssets._id': doc._id }] }));
    }
    if (!allowed) return res.status(403).json({ error: 'You do not have access to this image.' });
    if (!fs.existsSync(doc.storagePath)) return res.status(404).json({ error: 'Stored image file is missing.' });
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${safeFilename(doc.originalName, 'image')}"`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    fs.createReadStream(doc.storagePath).pipe(res);
  } catch (err) { next(err); }
});

router.post('/upload', requireRole('teacher', 'admin'), (req, res, next) => {
  upload.array('images', 8)(req, res, async (error) => {
    if (error) return res.status(400).json({ error: error.message });
    try {
      const docs = [];
      for (const file of req.files || []) {
        const header = fs.readFileSync(file.path).subarray(0, 16);
        const isPng = header.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
        const isJpeg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
        const signatureMatches = (file.mimetype === 'image/png' && isPng) || (file.mimetype === 'image/jpeg' && isJpeg);
        if (!signatureMatches) {
          try { fs.unlinkSync(file.path); } catch (_) {}
          await createSecurityAlert({ req, actor: req.user, type: 'malicious_upload', title: 'Image signature mismatch blocked', description: 'An uploaded image extension/MIME type did not match its binary signature.', severity: 'high', metadata: { originalName: safeFilename(file.originalname) } });
          return res.status(400).json({ error: 'The uploaded image signature does not match its declared type.' });
        }
        const fileHash = crypto.createHash('sha256').update(fs.readFileSync(file.path)).digest('hex');
        const doc = await MediaAsset.create({
          owner: req.user._id,
          originalName: safeFilename(file.originalname, 'image'),
          mimeType: file.mimetype,
          size: file.size,
          storagePath: file.path,
          url: '',
          caption: String(req.body.caption || '').replace(/[<>]/g, '').slice(0, 240),
          fileHash
        });
        docs.push(summary(doc));
        await writeAudit({ req, actor: req.user, action: 'MEDIA_UPLOADED', targetType: 'MediaAsset', targetId: doc._id, metadata: { mimeType: file.mimetype, size: file.size, fileHash } });
      }
      if (!docs.length) return res.status(400).json({ error: 'Select at least one image.' });
      res.status(201).json({ assets: docs });
    } catch (err) { next(err); }
  });
});

router.delete('/:id', requireRole('teacher', 'admin'), async (req, res, next) => {
  try {
    const query = { _id: req.params.id };
    if (req.user.role !== 'admin') query.owner = req.user._id;
    const doc = await MediaAsset.findOne(query);
    if (!doc) return res.status(404).json({ error: 'Image not found.' });
    try { if (fs.existsSync(doc.storagePath)) fs.unlinkSync(doc.storagePath); } catch (_) {}
    await doc.deleteOne();
    await writeAudit({ req, actor: req.user, action: 'MEDIA_DELETED', targetType: 'MediaAsset', targetId: doc._id, severity: 'warning' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
