const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema({ h: String, b: String }, { _id: false });
const qaSchema = new mongoose.Schema({ q: String, a: String }, { _id: false });
const bloomQuestionSchema = new mongoose.Schema({ level: String, question: String, answer: String, rationale: String }, { _id: false });
const outcomeSchema = new mongoose.Schema({ code: String, text: String }, { _id: false });
const coMappingSchema = new mongoose.Schema({ courseOutcome: String, matchedSections: [String], bloomLevels: [String], justification: String, alignmentScore: Number }, { _id: false });
const groundingChunkSchema = new mongoose.Schema({ sourceId: String, chunkIndex: Number, score: Number, preview: String }, { _id: false });
const workflowEventSchema = new mongoose.Schema({
  action: String,
  by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  note: String,
  at: { type: Date, default: Date.now }
}, { _id: false });

const resourceSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, required: true }, topic: { type: String, required: true }, course: String, subject: String,
  difficulty: String, duration: String, language: String, style: String,
  phase: { type: Number, default: 2 }, contentDepth: String, visualDensity: String,
  targetPages: Number, targetSlides: Number, examplesPerTopic: Number,
  includeDiagrams: Boolean, includeImages: Boolean, includeCaseStudies: Boolean, includeReferences: Boolean, includeSpeakerNotes: Boolean,
  executiveSummary: String,
  reportSections: { type: [mongoose.Schema.Types.Mixed], default: undefined },
  references: { type: [mongoose.Schema.Types.Mixed], default: undefined }, citationUsage: { type: [mongoose.Schema.Types.Mixed], default: undefined },
  visualAssets: { type: [mongoose.Schema.Types.Mixed], default: undefined }, validationReport: { type: mongoose.Schema.Types.Mixed, default: undefined },
  generationWarnings: { type: [String], default: undefined }, sections: [sectionSchema], qa: [qaSchema], bloomQuestions: [bloomQuestionSchema],
  courseOutcomes: [outcomeSchema], coMapping: [coMappingSchema], qualityScore: { type: mongoose.Schema.Types.Mixed, default: undefined },
  syllabus: { type: mongoose.Schema.Types.ObjectId, ref: 'Syllabus', default: null }, syllabusName: String,
  grounding: { mode: String, coverage: Number, embeddingModel: String, retrievedChunks: [groundingChunkSchema] },
  shared: { type: Boolean, default: false },

  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null, index: true },
  folderName: { type: String, default: 'General', maxlength: 120 },
  collaborators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  workflowStatus: { type: String, enum: ['draft', 'in_review', 'approved', 'rejected'], default: 'draft', index: true },
  workflowHistory: { type: [workflowEventSchema], default: [] },
  submittedForReviewAt: { type: Date, default: null }, reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null }, reviewNote: { type: String, default: '', maxlength: 2000 },
  currentVersion: { type: Number, default: 1 },
  ratingAverage: { type: Number, default: 0 }, ratingCount: { type: Number, default: 0 },
  publicShareEnabled: { type: Boolean, default: false },
  searchText: { type: String, default: '' }, searchEmbedding: { type: [Number], default: undefined }, searchEmbeddingModel: { type: String, default: '' },
  lastSafetyReview: { type: mongoose.Schema.Types.Mixed, default: undefined },
  createdAt: { type: Date, default: Date.now }, updatedAt: { type: Date, default: Date.now }
});
resourceSchema.index({ owner: 1, createdAt: -1 });
resourceSchema.index({ department: 1, workflowStatus: 1, updatedAt: -1 });
resourceSchema.index({ topic: 'text', subject: 'text', course: 'text', searchText: 'text' });
module.exports = mongoose.model('Resource', resourceSchema);
