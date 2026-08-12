import mongoose from 'mongoose';

const ProductDailyPerformanceSchema = new mongoose.Schema({
  storeUrl: {
    type: String,
    required: true
  },
  productId: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  
  // Ad stats
  adSpend: {
    type: Number,
    default: 0
  },
  adImpressions: {
    type: Number,
    default: 0
  },
  adClicks: {
    type: Number,
    default: 0
  },
  
  // Store stats
  shopifyRevenue: {
    type: Number,
    default: 0
  },
  shopifyOrders: {
    type: Number,
    default: 0
  },
  shopifyUnitsSold: {
    type: Number,
    default: 0
  },
  
  // Attributed metrics
  attributedRevenue: {
    type: Number,
    default: 0
  },
  attributedOrders: {
    type: Number,
    default: 0
  },
  
  // Calculated derived statistics
  trueROAS: {
    type: Number,
    default: 0
  },
  blendedROAS: {
    type: Number,
    default: 0
  },
  
  // Associated Ad assets
  topAdIds: {
    type: [String],
    default: []
  }
}, {
  timestamps: true
});

// Single compound index to cover all dashboard query variations
ProductDailyPerformanceSchema.index({ storeUrl: 1, productId: 1, date: 1 }, { unique: true });

const ProductDailyPerformance = mongoose.model('ProductDailyPerformance', ProductDailyPerformanceSchema);

export default ProductDailyPerformance;
