import mongoose from 'mongoose';

const AdMetadataSchema = new mongoose.Schema({
  storeUrl: {
    type: String,
    required: true
  },
  channel: {
    type: String,
    enum: ['meta', 'google', 'tiktok'],
    default: 'meta'
  },
  
  // Campaign Details
  campaignId: {
    type: String,
    required: true
  },
  campaignName: {
    type: String
  },
  campaignStatus: {
    type: String
  },
  campaignObjective: {
    type: String
  },
  
  // Ad Set Details
  adSetId: {
    type: String,
    required: true
  },
  adSetName: {
    type: String
  },
  adSetStatus: {
    type: String
  },
  adSetTargeting: {
    type: String
  },
  
  // Ad Details
  adId: {
    type: String,
    required: true
  },
  adName: {
    type: String
  },
  adStatus: {
    type: String
  },
  
  // Creative Details
  creative: {
    creativeId: String,
    creativeName: String,
    thumbnailUrl: String,
    bodyText: String,
    destinationUrl: String,
    callToAction: String,
    format: String,
    headline: String,
    description: String
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for fast hierarchy querying
AdMetadataSchema.index({ adId: 1 }, { unique: true });
AdMetadataSchema.index({ storeUrl: 1, campaignId: 1 });
AdMetadataSchema.index({ storeUrl: 1, adSetId: 1 });

const AdMetadata = mongoose.model('AdMetadata', AdMetadataSchema);

export default AdMetadata;
