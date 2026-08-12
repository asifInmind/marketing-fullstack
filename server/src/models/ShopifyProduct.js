import mongoose from 'mongoose';

const ShopifyProductSchema = new mongoose.Schema({
  storeUrl: {
    type: String,
    required: true
  },
  productId: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  handle: {
    type: String,
    required: true
  },
  sku: {
    type: String
  },
  imageUrl: {
    type: String
  },
  variants: [
    {
      variantId: String,
      title: String,
      price: Number,
      inventoryQuantity: Number
    }
  ]
}, {
  timestamps: true
});

// Indexes for query performance and uniqueness
ShopifyProductSchema.index({ storeUrl: 1, productId: 1 }, { unique: true });
ShopifyProductSchema.index({ storeUrl: 1, handle: 1 });

const ShopifyProduct = mongoose.model('ShopifyProduct', ShopifyProductSchema);

export default ShopifyProduct;
