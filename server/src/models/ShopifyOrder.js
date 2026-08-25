import mongoose from 'mongoose';

const ShopifyOrderSchema = new mongoose.Schema({
  storeUrl: {
    type: String,
    required: true
  },
  orderId: {
    type: String,
    required: true
  },
  orderNumber: {
    type: String
  },
  createdAt: {
    type: Date,
    required: true
  },
  totalPrice: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'PKR'
  },
  cancelledAt: {
    type: Date,
    default: null
  },
  email: {
    type: String,
    default: ''
  },
  customerInfo: {
    phone: { type: String, default: '' },
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    city: { type: String, default: '' },
    province: { type: String, default: '' },
    zip: { type: String, default: '' },
    country: { type: String, default: '' }
  },
  landingSite: {
    type: String,
    default: ''
  },
  referringSite: {
    type: String,
    default: ''
  },
  lineItems: [
    {
      productId: String,
      variantId: String,
      quantity: Number,
      price: Number
    }
  ],
  attribution: {
    utmSource: String,
    utmMedium: String,
    utmCampaign: String,
    utmContent: String,
    utmTerm: String,
    clickId: String,            // Meta fbclid click token
    adId: String,               // Attributed Meta Ad ID
    adName: String,
    campaignId: String,
    adSetId: String,
    attributedAt: Date,
    attributionMethod: {
      type: String,
      enum: ['fbclid_match', 'utm_match', 'ip_match', 'organic']
    }
  },
  sentToMeta: {
    type: Boolean,
    default: false
  },
  sentToMetaAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: { createdAt: 'systemCreatedAt', updatedAt: 'systemUpdatedAt' }
});

// Production indexes
ShopifyOrderSchema.index({ storeUrl: 1, orderId: 1 }, { unique: true });
ShopifyOrderSchema.index({ storeUrl: 1, createdAt: -1 });
ShopifyOrderSchema.index({ 'attribution.clickId': 1 });
ShopifyOrderSchema.index({ storeUrl: 1, 'attribution.adId': 1 });

const ShopifyOrder = mongoose.model('ShopifyOrder', ShopifyOrderSchema);

export default ShopifyOrder;
