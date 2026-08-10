import mongoose from 'mongoose';

const MerchantSchema = new mongoose.Schema({
  fbUserId: {
    type: String,
    unique: true,
    sparse: true
  },
  fbAccessToken: {
    type: String
  },
  adAccountId: {
    type: String
  },
  omsToken: {
    type: String
  },
  storeUrl: {
    type: String
  },
  currency: {
    type: String,
    default: 'PKR'
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
  }
}, {
  timestamps: true
});

const Merchant = mongoose.model('Merchant', MerchantSchema);

export default Merchant;
