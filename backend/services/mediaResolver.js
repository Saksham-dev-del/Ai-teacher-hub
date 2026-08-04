const MediaAsset = require('../models/MediaAsset');

async function resolveMediaAssets(draft, user) {
  const ids = (draft.visualAssets || []).map((x) => x._id || x.id).filter(Boolean);
  if (!ids.length) return [];
  const query = { _id: { $in: ids } };
  if (user && user.role !== 'admin') query.owner = user._id;
  return MediaAsset.find(query);
}

module.exports = { resolveMediaAssets };
