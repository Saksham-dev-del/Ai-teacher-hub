const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  resource: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  tag: { type: String, enum: ['Useful', 'Needs edit', 'Best for exam', 'Best for class explanation', 'Well researched'], default: 'Useful' },
  review: { type: String, default: '', maxlength: 1000 },
  updatedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});
schema.index({ resource: 1, user: 1 }, { unique: true });
module.exports = mongoose.model('ResourceRating', schema);
