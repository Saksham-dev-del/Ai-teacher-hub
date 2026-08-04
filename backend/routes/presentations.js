const express = require('express');
const Resource = require('../models/Resource');
const { requireAuth, requireRole } = require('../middleware/auth');
const { buildPresentation, THEMES } = require('../services/presentation');
const { resolveMediaAssets } = require('../services/mediaResolver');
const { liveEditDraft } = require('../services/liveEdit');
const { translateDraft } = require('../services/languageConverter');
const { reviewPresentation } = require('../services/pptReviewer');
const { generateExamNotes } = require('../services/examNotes');
const { optimizeLayout } = require('../services/layoutOptimizer');
const { beautifyContent } = require('../services/contentBeautifier');
const { suggestAnimations } = require('../services/animationPlanner');
const { buildWebsiteHtml } = require('../services/websiteGenerator');
const { buildResumeText, buildPortfolioHtml, buildBlogPost, buildLinkedInPosts, buildYouTubeScript } = require('../services/contentRepurposer');
const { buildNarrationScript } = require('../services/narrationBuilder');
const { videoScript, geminiTts } = require('../services/platformIntelligence');
const JSZip = require('jszip');

const router = express.Router();
router.use(requireAuth, requireRole('teacher', 'admin'));

function safeFileName(value) {
  return String(value || 'academic-presentation').replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase().slice(0, 100) || 'academic-presentation';
}

function isOwnerOrAdmin(resource, user) {
  return user.role === 'admin' || String(resource.owner) === String(user._id);
}

router.get('/themes', (req, res) => {
  res.json({ themes: Object.keys(THEMES) });
});

router.post('/export', async (req, res) => {
  try {
    let draft = req.body?.draft || null;
    if (req.body?.resourceId) {
      const resource = await Resource.findById(req.body.resourceId);
      if (!resource || !isOwnerOrAdmin(resource, req.user)) return res.status(404).json({ error: 'Saved resource not found.' });
      draft = resource.toObject();
    }
    if (!draft || !draft.topic) return res.status(400).json({ error: 'Select a saved resource or provide a generated draft.' });

    const assets = await resolveMediaAssets(draft, req.user);
    const buffer = await buildPresentation(draft, {
      theme: req.body?.theme || 'academic',
      author: req.user.name,
      institution: req.body?.institution || 'Academic Institution',
      maxContentSlides: req.body?.maxContentSlides || draft.targetSlides || 8,
      includeSpeakerNotes: req.body?.includeSpeakerNotes !== false,
      assets
    });
    const fileName = `${safeFileName(draft.topic)}_presentation.pptx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error('[presentations/export]', err);
    res.status(500).json({ error: err.message || 'PPT generation failed.' });
  }
});

router.post('/live-edit', async (req, res) => {
  try {
    let draft = req.body?.draft || null;
    if (req.body?.resourceId) {
      const resource = await Resource.findById(req.body.resourceId);
      if (!resource || !isOwnerOrAdmin(resource, req.user)) return res.status(404).json({ error: 'Saved resource not found.' });
      draft = resource.toObject();
    }
    if (!draft || !draft.topic) return res.status(400).json({ error: 'Select a saved resource or provide a generated draft.' });

    const { draft: revisedDraft, warnings } = await liveEditDraft(draft, String(req.body?.instruction || ''));
    res.json({ draft: revisedDraft, warnings });
  } catch (err) {
    console.error('[presentations/live-edit]', err);
    res.status(400).json({ error: err.message || 'Live edit failed.' });
  }
});

router.post('/translate', async (req, res) => {
  try {
    let draft = req.body?.draft || null;
    if (req.body?.resourceId) {
      const resource = await Resource.findById(req.body.resourceId);
      if (!resource || !isOwnerOrAdmin(resource, req.user)) return res.status(404).json({ error: 'Saved resource not found.' });
      draft = resource.toObject();
    }
    if (!draft || !draft.topic) return res.status(400).json({ error: 'Select a saved resource or provide a generated draft.' });

    const { draft: translated, warnings } = await translateDraft(draft, String(req.body?.targetLanguage || 'English'));
    res.json({ draft: translated, warnings });
  } catch (err) {
    console.error('[presentations/translate]', err);
    res.status(400).json({ error: err.message || 'Translation failed.' });
  }
});

router.post('/review', async (req, res) => {
  try {
    let draft = req.body?.draft || null;
    if (req.body?.resourceId) {
      const resource = await Resource.findById(req.body.resourceId);
      if (!resource || !isOwnerOrAdmin(resource, req.user)) return res.status(404).json({ error: 'Saved resource not found.' });
      draft = resource.toObject();
    }
    if (!draft || !draft.topic) return res.status(400).json({ error: 'Select a saved resource or provide a generated draft.' });

    const report = await reviewPresentation(draft, String(req.body?.theme || 'academic'));
    res.json({ report });
  } catch (err) {
    console.error('[presentations/review]', err);
    res.status(400).json({ error: err.message || 'Review failed.' });
  }
});

router.post('/exam-notes', async (req, res) => {
  try {
    let draft = req.body?.draft || null;
    if (req.body?.resourceId) {
      const resource = await Resource.findById(req.body.resourceId);
      if (!resource || !isOwnerOrAdmin(resource, req.user)) return res.status(404).json({ error: 'Saved resource not found.' });
      draft = resource.toObject();
    }
    if (!draft || !draft.topic) return res.status(400).json({ error: 'Select a saved resource or provide a generated draft.' });

    const notes = await generateExamNotes(draft);
    res.json({ notes });
  } catch (err) {
    console.error('[presentations/exam-notes]', err);
    res.status(400).json({ error: err.message || 'Exam notes generation failed.' });
  }
});

router.post('/optimize-layout', async (req, res) => {
  try {
    let draft = req.body?.draft || null;
    if (req.body?.resourceId) {
      const resource = await Resource.findById(req.body.resourceId);
      if (!resource || !isOwnerOrAdmin(resource, req.user)) return res.status(404).json({ error: 'Saved resource not found.' });
      draft = resource.toObject();
    }
    if (!draft || !draft.topic) return res.status(400).json({ error: 'Select a saved resource or provide a generated draft.' });

    const { draft: optimized, splitCount, warnings } = await optimizeLayout(draft);
    res.json({ draft: optimized, splitCount, warnings });
  } catch (err) {
    console.error('[presentations/optimize-layout]', err);
    res.status(400).json({ error: err.message || 'Layout optimization failed.' });
  }
});

router.post('/beautify', async (req, res) => {
  try {
    const rawText = String(req.body?.rawText || '');
    if (!rawText.trim()) return res.status(400).json({ error: 'Paste some notes to beautify first.' });
    const result = await beautifyContent(rawText, String(req.body?.topic || ''));
    res.json(result);
  } catch (err) {
    console.error('[presentations/beautify]', err);
    res.status(400).json({ error: err.message || 'Content beautify failed.' });
  }
});

router.post('/animation-plan', async (req, res) => {
  try {
    let draft = req.body?.draft || null;
    if (req.body?.resourceId) {
      const resource = await Resource.findById(req.body.resourceId);
      if (!resource || !isOwnerOrAdmin(resource, req.user)) return res.status(404).json({ error: 'Saved resource not found.' });
      draft = resource.toObject();
    }
    if (!draft || !draft.topic) return res.status(400).json({ error: 'Select a saved resource or provide a generated draft.' });

    const { plan, note } = suggestAnimations(draft);
    res.json({ plan, note });
  } catch (err) {
    console.error('[presentations/animation-plan]', err);
    res.status(400).json({ error: err.message || 'Animation plan failed.' });
  }
});

router.post('/website', async (req, res) => {
  try {
    let draft = req.body?.draft || null;
    if (req.body?.resourceId) {
      const resource = await Resource.findById(req.body.resourceId);
      if (!resource || !isOwnerOrAdmin(resource, req.user)) return res.status(404).json({ error: 'Saved resource not found.' });
      draft = resource.toObject();
    }
    if (!draft || !draft.topic) return res.status(400).json({ error: 'Select a saved resource or provide a generated draft.' });

    const html = buildWebsiteHtml(draft);
    res.json({ html });
  } catch (err) {
    console.error('[presentations/website]', err);
    res.status(400).json({ error: err.message || 'Website generation failed.' });
  }
});

router.post('/repurpose', async (req, res) => {
  try {
    let draft = req.body?.draft || null;
    if (req.body?.resourceId) {
      const resource = await Resource.findById(req.body.resourceId);
      if (!resource || !isOwnerOrAdmin(resource, req.user)) return res.status(404).json({ error: 'Saved resource not found.' });
      draft = resource.toObject();
    }
    if (!draft || !draft.topic) return res.status(400).json({ error: 'Select a saved resource or provide a generated draft.' });
    if (!(draft.reportSections || []).length) return res.status(400).json({ error: 'This presentation has no sections yet — generate it first.' });

    const format = req.body?.format;
    if (format === 'resume') return res.json({ text: buildResumeText(draft) });
    if (format === 'portfolio') return res.json({ html: buildPortfolioHtml(draft) });
    if (format === 'blog') return res.json(await buildBlogPost(draft));
    if (format === 'linkedin') return res.json(await buildLinkedInPosts(draft));
    if (format === 'youtube') {
      const videoFormat = String(req.body?.videoFormat || 'YouTube video script (5-8 minutes)');
      const script = await buildYouTubeScript(draft, videoFormat, videoScript);
      return res.json({ script });
    }
    return res.status(400).json({ error: 'Unknown format. Use resume, portfolio, blog, linkedin, or youtube.' });
  } catch (err) {
    console.error('[presentations/repurpose]', err);
    res.status(400).json({ error: err.message || 'Repurposing failed.' });
  }
});

router.post('/narration', async (req, res) => {
  try {
    let draft = req.body?.draft || null;
    if (req.body?.resourceId) {
      const resource = await Resource.findById(req.body.resourceId);
      if (!resource || !isOwnerOrAdmin(resource, req.user)) return res.status(404).json({ error: 'Saved resource not found.' });
      draft = resource.toObject();
    }
    if (!draft || !draft.topic) return res.status(400).json({ error: 'Select a saved resource or provide a generated draft.' });

    const { segments, fullScript, estimatedSeconds } = buildNarrationScript(draft);

    if (req.body?.audio) {
      try {
        const wav = await geminiTts(fullScript.slice(0, 7000));
        res.setHeader('Content-Type', 'audio/wav');
        res.setHeader('Content-Disposition', `attachment; filename="${String(draft.topic).replace(/[^a-z0-9]+/gi, '-')}-narration.wav"`);
        return res.send(wav);
      } catch (audioErr) {
        return res.status(200).json({ segments, fullScript, estimatedSeconds, audioError: audioErr.message });
      }
    }
    res.json({ segments, fullScript, estimatedSeconds });
  } catch (err) {
    console.error('[presentations/narration]', err);
    res.status(400).json({ error: err.message || 'Narration generation failed.' });
  }
});

// Phase 11.36: AI Video Presentation — HONEST SCOPE. This project doesn't run
// slide-to-image rendering or video encoding (ffmpeg), so it cannot produce an
// actual .mp4. Instead this packages everything a teacher (or a video editor)
// needs to assemble one quickly: the .pptx, a full narration script with
// per-slide timing, and narration audio where TTS succeeds.
router.post('/video-package', async (req, res) => {
  try {
    let draft = req.body?.draft || null;
    if (req.body?.resourceId) {
      const resource = await Resource.findById(req.body.resourceId);
      if (!resource || !isOwnerOrAdmin(resource, req.user)) return res.status(404).json({ error: 'Saved resource not found.' });
      draft = resource.toObject();
    }
    if (!draft || !draft.topic) return res.status(400).json({ error: 'Select a saved resource or provide a generated draft.' });
    if (!(draft.reportSections || []).length) return res.status(400).json({ error: 'This presentation has no sections yet — generate it first.' });

    const zip = new JSZip();
    const safeName = String(draft.topic).replace(/[^a-z0-9]+/gi, '-');

    const pptxBuffer = await buildPresentation(draft, { theme: req.body?.theme || 'academic', maxContentSlides: Number(req.body?.maxContentSlides) || draft.targetSlides || 26, institution: req.body?.institution || '', includeSpeakerNotes: true });
    zip.file(`${safeName}.pptx`, pptxBuffer);

    const { segments, fullScript, estimatedSeconds } = buildNarrationScript(draft);
    zip.file('narration-script.txt', fullScript);
    zip.file('manifest.json', JSON.stringify({
      topic: draft.topic,
      estimatedTotalSeconds: estimatedSeconds,
      slideCount: segments.length,
      slides: segments.map((s, i) => ({ slideNumber: i + 1, heading: s.heading, narration: s.text }))
    }, null, 2));

    try {
      const wav = await geminiTts(fullScript.slice(0, 7000));
      zip.file('narration-audio.wav', wav);
    } catch (audioErr) {
      zip.file('narration-audio-ERROR.txt', `Narration audio could not be generated: ${audioErr.message}\nThe script (narration-script.txt) and slides are still included.`);
    }

    zip.file('READ-ME.txt', 'This is a "video assembly kit", not a rendered video: this project doesn\'t run slide-to-image rendering or video encoding.\n\n1. Open the .pptx and export slides as images (PowerPoint: File > Export > Change File Type > PNG, "All Slides").\n2. Use narration-audio.wav (or import narration-script.txt into any TTS tool) as the voiceover.\n3. Use manifest.json for per-slide timing to assemble a video in any editor (CapCut, Premiere, DaVinci Resolve, or even PowerPoint\'s own "Record Slide Show" feature, which is often the fastest option).');

    const buf = await zip.generateAsync({ type: 'nodebuffer' });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}-video-package.zip"`);
    res.send(buf);
  } catch (err) {
    console.error('[presentations/video-package]', err);
    res.status(400).json({ error: err.message || 'Video package generation failed.' });
  }
});

module.exports = router;
