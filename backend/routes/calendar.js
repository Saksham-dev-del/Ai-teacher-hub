const express = require('express');
const LessonEvent = require('../models/LessonEvent');
const Resource = require('../models/Resource');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function isOwnerOrAdmin(doc, user) {
  return user.role === 'admin' || String(doc.owner) === String(user._id);
}

function parseDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function clean(value, max = 500) {
  return String(value || '').trim().slice(0, max);
}

router.get('/', async (req, res) => {
  try {
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 2, 1);
    const start = parseDate(req.query.start) || defaultStart;
    const end = parseDate(req.query.end) || defaultEnd;

    const query = { start: { $lt: end }, end: { $gte: start } };
    if (req.user.role === 'student') query.shared = true;
    else if (!(req.user.role === 'admin' && req.query.scope === 'all')) query.owner = req.user._id;

    const events = await LessonEvent.find(query)
      .populate('owner', 'name')
      .populate('resource', 'type topic course subject')
      .sort({ start: 1 })
      .limit(1000);
    res.json({ events });
  } catch (err) {
    console.error('[calendar/list]', err.message);
    res.status(500).json({ error: 'Could not load lesson calendar.' });
  }
});

router.post('/', requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const start = parseDate(req.body?.start);
    const end = parseDate(req.body?.end);
    if (!req.body?.title || !start || !end) return res.status(400).json({ error: 'Title, start and end time are required.' });
    if (end <= start) return res.status(400).json({ error: 'End time must be after start time.' });

    let resource = null;
    if (req.body.resourceId) {
      resource = await Resource.findById(req.body.resourceId);
      if (!resource || !isOwnerOrAdmin(resource, req.user)) return res.status(404).json({ error: 'Linked resource not found.' });
    }

    const event = new LessonEvent({
      owner: req.user._id,
      resource: resource?._id || null,
      title: clean(req.body.title, 220),
      course: clean(req.body.course || resource?.course, 100),
      subject: clean(req.body.subject || resource?.subject, 160),
      topic: clean(req.body.topic || resource?.topic, 220),
      eventType: ['lecture', 'lab', 'quiz', 'assignment', 'revision', 'meeting', 'other'].includes(req.body.eventType) ? req.body.eventType : 'lecture',
      start,
      end,
      status: ['planned', 'completed', 'cancelled'].includes(req.body.status) ? req.body.status : 'planned',
      notes: clean(req.body.notes, 3000),
      shared: req.body.shared !== false,
      color: /^#[0-9a-f]{6}$/i.test(req.body.color || '') ? req.body.color : '#2F5D50'
    });
    await event.save();
    await event.populate('resource', 'type topic course subject');
    res.status(201).json({ event });
  } catch (err) {
    console.error('[calendar/create]', err.message);
    res.status(500).json({ error: err.message || 'Could not create lesson event.' });
  }
});

router.patch('/:id', requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const event = await LessonEvent.findById(req.params.id);
    if (!event || !isOwnerOrAdmin(event, req.user)) return res.status(404).json({ error: 'Calendar event not found.' });

    ['title', 'course', 'subject', 'topic', 'notes'].forEach((field) => {
      if (req.body[field] !== undefined) event[field] = clean(req.body[field], field === 'notes' ? 3000 : 220);
    });
    if (req.body.start !== undefined) {
      const start = parseDate(req.body.start);
      if (!start) return res.status(400).json({ error: 'Invalid start date.' });
      event.start = start;
    }
    if (req.body.end !== undefined) {
      const end = parseDate(req.body.end);
      if (!end) return res.status(400).json({ error: 'Invalid end date.' });
      event.end = end;
    }
    if (event.end <= event.start) return res.status(400).json({ error: 'End time must be after start time.' });
    if (['lecture', 'lab', 'quiz', 'assignment', 'revision', 'meeting', 'other'].includes(req.body.eventType)) event.eventType = req.body.eventType;
    if (['planned', 'completed', 'cancelled'].includes(req.body.status)) event.status = req.body.status;
    if (typeof req.body.shared === 'boolean') event.shared = req.body.shared;
    if (/^#[0-9a-f]{6}$/i.test(req.body.color || '')) event.color = req.body.color;
    if (req.body.resourceId === null) event.resource = null;
    if (req.body.resourceId) {
      const resource = await Resource.findById(req.body.resourceId);
      if (!resource || !isOwnerOrAdmin(resource, req.user)) return res.status(404).json({ error: 'Linked resource not found.' });
      event.resource = resource._id;
    }
    await event.save();
    await event.populate('resource', 'type topic course subject');
    res.json({ event });
  } catch (err) {
    console.error('[calendar/update]', err.message);
    res.status(500).json({ error: err.message || 'Could not update calendar event.' });
  }
});

router.delete('/:id', requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const event = await LessonEvent.findById(req.params.id);
    if (!event || !isOwnerOrAdmin(event, req.user)) return res.status(404).json({ error: 'Calendar event not found.' });
    await LessonEvent.deleteOne({ _id: event._id });
    res.json({ ok: true });
  } catch (err) {
    console.error('[calendar/delete]', err.message);
    res.status(500).json({ error: 'Could not delete calendar event.' });
  }
});

module.exports = router;
