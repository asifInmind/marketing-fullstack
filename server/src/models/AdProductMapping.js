import mongoose from 'mongoose';

const AdProductMappingSchema = new mongoose.Schema({
  storeUrl: {
    type: String,
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
  shopifyProductId: {
    type: String,
    required: true
  },
  mappedBy: {
    type: String,
    enum: ['auto', 'manual'],
    default: 'auto'
  },
  matchMethod: {
    type: String,
    enum: ['url_handle', 'ad_name_keyword', 'sku_match', 'manual'],
    default: 'url_handle'
  },
  matchConfidence: {
    type: Number,
    min: 0,
    max: 100,
    default: 100
  },
  matchSource: {
    type: String
  }
}, {
  timestamps: true
});

// Compound indexes
AdProductMappingSchema.index({ storeUrl: 1, adId: 1 }, { unique: true });
AdProductMappingSchema.index({ storeUrl: 1, shopifyProductId: 1 });

const AdProductMapping = mongoose.model('AdProductMapping', AdProductMappingSchema);

export default AdProductMapping;
