import mongoose from 'mongoose';

const DailyAdInsightSchema = new mongoose.Schema({
  storeUrl: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  channel: {
    type: String,
    enum: ['meta', 'google', 'tiktok'],
    default: 'meta'
  },
  adId: {
    type: String,
    required: true
  },
  
  // Daily Metrics
  spend: {
    type: Number,
    default: 0
  },
  impressions: {
    type: Number,
    default: 0
  },
  clicks: {
    type: Number,
    default: 0
  },
  conversions: {
    type: Number,
    default: 0
  },
  conversionValue: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Compound index to ensure uniqueness and optimize query speeds
DailyAdInsightSchema.index({ storeUrl: 1, date: 1, adId: 1 }, { unique: true });

const DailyAdInsight = mongoose.model('DailyAdInsight', DailyAdInsightSchema);

export default DailyAdInsight;
