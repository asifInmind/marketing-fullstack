import mongoose from 'mongoose';

const AttributionErrorSchema = new mongoose.Schema({
  storeUrl: {
    type: String,
    required: true
  },
  errorType: {
    type: String,
    enum: ['unmatched_ad', 'unmatched_order', 'api_failure'],
    required: true
  },
  source: {
    type: String,
    enum: ['meta', 'shopify'],
    required: true
  },
  rawData: {
    type: mongoose.Schema.Types.Mixed
  },
  attemptedMatch: {
    type: String
  },
  errorMessage: {
    type: String
  },
  resolved: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Optimized index for error queues
AttributionErrorSchema.index({ storeUrl: 1, resolved: 1, createdAt: -1 });

const AttributionError = mongoose.model('AttributionError', AttributionErrorSchema);

export default AttributionError;
