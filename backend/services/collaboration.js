const crypto = require('crypto');
const Department = require('../models/Department');
const QRCode = require('../vendor/QRCode');
const QRErrorCorrectLevel = require('../vendor/QRCode/QRErrorCorrectLevel');

const SNAPSHOT_FIELDS = [
  'type','topic','course','subject','difficulty','duration','language','style','phase','contentDepth','visualDensity',
  'targetPages','targetSlides','examplesPerTopic','includeDiagrams','includeImages','includeCaseStudies','includeReferences','includeSpeakerNotes',
  'executiveSummary','reportSections','references','citationUsage','visualAssets','validationReport','generationWarnings','sections','qa',
  'bloomQuestions','courseOutcomes','coMapping','qualityScore','syllabus','syllabusName','grounding','folderName','department','workflowStatus','reviewNote'
];

function resourceSnapshot(resource) {
  const obj = resource.toObject ? resource.toObject() : resource;
  const snapshot = {};
  SNAPSHOT_FIELDS.forEach((key) => { if (typeof obj[key] !== 'undefined') snapshot[key] = obj[key]; });
  return snapshot;
}

function applySnapshot(resource, snapshot = {}) {
  SNAPSHOT_FIELDS.forEach((key) => { if (Object.prototype.hasOwnProperty.call(snapshot, key)) resource[key] = snapshot[key]; });
  resource.updatedAt = new Date();
  return resource;
}

async function departmentMembership(userId, departmentId) {
  if (!departmentId) return null;
  const dept = await Department.findById(departmentId);
  if (!dept) return null;
  if (String(dept.owner) === String(userId)) return { department: dept, role: 'reviewer', owner: true };
  const member = (dept.members || []).find((x) => String(x.user) === String(userId));
  return member ? { department: dept, role: member.role, owner: false } : null;
}

async function canAccessResource(user, resource, options = {}) {
  if (!user || !resource) return false;
  if (user.role === 'admin') return true;
  const isOwner = String(resource.owner) === String(user._id);
  const membership = await departmentMembership(user._id, resource.department);
  if (options.review) {
    // Independent review: a resource owner cannot approve/reject their own work.
    if (isOwner) return false;
    return Boolean(membership && (membership.role === 'reviewer' || membership.owner));
  }
  if (isOwner) return true;
  if ((resource.collaborators || []).some((id) => String(id) === String(user._id))) return true;
  if (membership) return true;
  return !options.write && Boolean(resource.shared);
}

function shareCode() { return crypto.randomBytes(14).toString('base64url'); }

function qrSvgDataUrl(text, options = {}) {
  const qr = new QRCode(-1, QRErrorCorrectLevel.M);
  qr.addData(String(text || ''));
  qr.make();
  const count = qr.getModuleCount();
  const margin = Number(options.margin || 4);
  const size = count + margin * 2;
  const cells = [];
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.isDark(row, col)) cells.push(`<rect x=\"${col + margin}\" y=\"${row + margin}\" width=\"1\" height=\"1\"/>`);
    }
  }
  const svg = `<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 ${size} ${size}\" shape-rendering=\"crispEdges\"><rect width=\"100%\" height=\"100%\" fill=\"white\"/><g fill=\"#0f172a\">${cells.join('')}</g></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function timeWeight(type = '', phase = 0) {
  const t = String(type).toLowerCase();
  if (t.includes('lesson')) return 0.75;
  if (t.includes('quiz') || t.includes('question')) return 0.5;
  if (t.includes('assignment') || t.includes('rubric')) return 0.45;
  if (t.includes('ppt') || t.includes('presentation')) return 1;
  if (t.includes('report') || phase === 4) return 1.25;
  if (t.includes('notes')) return 0.6;
  return 0.4;
}

function topFrequency(items, field) {
  const map = new Map();
  items.forEach((item) => { const v = String(item?.[field] || '').trim(); if (v) map.set(v, (map.get(v) || 0) + 1); });
  return [...map.entries()].sort((a,b) => b[1]-a[1])[0] || ['',0];
}

function workloadFromData(resources = [], quizzes = [], artifacts = []) {
  const lessonPlans = resources.filter((r) => /lesson/i.test(r.type || '')).length;
  const assignments = resources.filter((r) => /assignment/i.test(r.type || '')).length + artifacts.filter((a) => /assignment|rubric/i.test(a.action || '')).length;
  const quizCount = quizzes.length + resources.filter((r) => /quiz|question paper/i.test(r.type || '')).length + artifacts.filter((a) => /question-paper/i.test(a.action || '')).length;
  const estimated = resources.reduce((sum,r) => sum + timeWeight(r.type, r.phase), 0) + quizzes.length * 0.45 + artifacts.length * 0.4;
  const [mostSubject, subjectUses] = topFrequency(resources.concat(artifacts), 'subject');
  const [mostTopic, topicUses] = topFrequency(resources.concat(artifacts), 'topic');
  return {
    lessonPlansGenerated: lessonPlans,
    quizzesCreated: quizCount,
    assignmentsCreated: assignments,
    totalResources: resources.length,
    estimatedTimeSavedHours: Math.round(estimated * 10) / 10,
    mostUsedSubject: mostSubject || 'Not enough data',
    mostUsedTopic: mostTopic || 'Not enough data',
    mostUsedSubjectCount: subjectUses,
    mostUsedTopicCount: topicUses,
    approvedResources: resources.filter((r) => r.workflowStatus === 'approved').length,
    inReviewResources: resources.filter((r) => r.workflowStatus === 'in_review').length
  };
}

module.exports = { SNAPSHOT_FIELDS, resourceSnapshot, applySnapshot, departmentMembership, canAccessResource, shareCode, qrSvgDataUrl, timeWeight, workloadFromData };
