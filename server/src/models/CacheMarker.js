import mongoose from 'mongoose';

const CacheMarkerSchema = new mongoose.Schema({
  storeUrl: {
    type: String,
    required: true
  },
  channel: {
    type: String,
    required: true // e.g., 'meta'
  },
  key: {
    type: String,
    required: true // e.g., 'insights_last_7d', 'insights_last_30d', 'structure'
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Ensure unique index for fast lookups and upserts
CacheMarkerSchema.index({ storeUrl: 1, channel: 1, key: 1 }, { unique: true });

const CacheMarker = mongoose.model('CacheMarker', CacheMarkerSchema);

export default CacheMarker;
