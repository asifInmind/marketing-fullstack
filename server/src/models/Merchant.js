import mongoose from 'mongoose';

const MerchantSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    sparse: true
  },
  brandName: {
    type: String
  },
  storeUrl: {
    type: String,
    unique: true,
    sparse: true
  },
  shopifyAccessToken: {
    type: String
  },
  currency: {
    type: String,
    default: 'PKR'
  },
  
  // Meta/Facebook integration (for login/oauth compatibility)
  fbUserId: {
    type: String,
    sparse: true
  },
  fbAccessToken: {
    type: String
  },
  adAccountId: {
    type: String
  },
  
  // Extra settings
  omsToken: {
    type: String
  },
  settings: {
    syncIntervalMinutes: {
      type: Number,
      default: 60
    },
    autoAlertsEnabled: {
      type: Boolean,
      default: true
    }
  },
  
  // Normalized integration properties
  integrations: {
    meta: {
      accessToken: String,
      adAccountId: String,
      pixelId: String,
      connectedAt: Date
    }
  }
}, {
  timestamps: true
});

// Indexes
MerchantSchema.index({ storeUrl: 1 }, { unique: true, sparse: true });
MerchantSchema.index({ fbUserId: 1 }, { unique: true, sparse: true });

const Merchant = mongoose.model('Merchant', MerchantSchema);

export default Merchant;
