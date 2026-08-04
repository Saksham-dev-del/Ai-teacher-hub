const mongoose = require('mongoose');

const mediaAssetSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  originalName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, default: 0 },
  storagePath: { type: String, required: true },
  url: { type: String, default: '' },
  fileHash: { type: String, default: '', index: true },
  caption: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

mediaAssetSchema.index({ owner: 1, createdAt: -1 });
module.exports = mongoose.model('MediaAsset', mediaAssetSchema);
