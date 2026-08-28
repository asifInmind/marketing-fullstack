import { Router } from 'express';
import crypto from 'crypto';
import ShopifyProduct from '../models/ShopifyProduct.js';
import ShopifyOrder from '../models/ShopifyOrder.js';
import Merchant from '../models/Merchant.js';
import DailyAdInsight from '../models/DailyAdInsight.js';
import CacheMarker from '../models/CacheMarker.js';
import AdMetadata from '../models/AdMetadata.js';

import {
  safeParseInt,
  sanitizeShopUrl,
  findCoveringMarker,
  syncProductsFromShopify,
  syncOrdersFromShopify,
  calculateCatalogPerformance,
  calculateCampaignPerformance,
  calculateAdSetPerformance,
  calculateAdPerformance,
  getOrderChannel
} from '../lib/shopify/index.js';

const router = Router();

// GET /api/shopify/debug-db
router.get('/debug-db', async (req, res) => {
  try {
    const adMetadataCount = await AdMetadata.countDocuments();
    const insightsCount = await DailyAdInsight.countDocuments();
    const productsCount = await ShopifyProduct.countDocuments();
    const ordersCount = await ShopifyOrder.countDocuments();
    const merchantCount = await Merchant.countDocuments();
    const markerCount = await CacheMarker.countDocuments();

    const earliestInsight = await DailyAdInsight.findOne({}).sort({ date: 1 });
    const latestInsight = await DailyAdInsight.findOne({}).sort({ date: -1 });

    const earliestOrder = await ShopifyOrder.findOne({}).sort({ createdAt: 1 });
    const latestOrder = await ShopifyOrder.findOne({}).sort({ createdAt: -1 });

    const insightsByDate = await DailyAdInsight.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          count: { $sum: 1 },
          totalSpend: { $sum: "$spend" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const ordersByDate = await ShopifyOrder.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
          totalRevenue: { $sum: "$totalPrice" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const markers = await CacheMarker.find({});

    return res.json({
      counts: {
        Merchants: merchantCount,
        AdMetadata: adMetadataCount,
        DailyAdInsight: insightsCount,
        ShopifyProduct: productsCount,
        ShopifyOrder: ordersCount,
        CacheMarker: markerCount
      },
      insightsRange: {
        earliest: earliestInsight?.date || null,
        latest: latestInsight?.date || null
      },
      ordersRange: {
        earliest: earliestOrder?.createdAt || null,
        latest: latestOrder?.createdAt || null
      },
      insightsDistribution: insightsByDate,
      ordersDistribution: ordersByDate.slice(0, 30),
      markers
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/shopify/reset-creatives
router.get('/reset-creatives', async (req, res) => {
  try {
    const result = await AdMetadata.updateMany({}, { $set: { creative: {} } });
    console.log("🧹 [DB Cache Reset] Cleared creative cache in AdMetadata:", result.modifiedCount);
    return res.json({
      success: true,
      message: "Cleared all creatives in AdMetadata. The next dashboard refresh will download all creatives live!"
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/shopify/reset-db
router.get('/reset-db', async (req, res) => {
  try {
    await AdMetadata.deleteMany({});
    await DailyAdInsight.deleteMany({});
    await ShopifyProduct.deleteMany({});
    await ShopifyOrder.deleteMany({});
    await Merchant.deleteMany({});
    await CacheMarker.deleteMany({});

    console.log("🧹 [DB Cache Reset] Successfully emptied all cache collections in MongoDB.");
    return res.json({
      success: true,
      message: "All database caches and merchant data have been successfully deleted from MongoDB! You are now starting from scratch."
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/shopify/clear-orders
router.get('/clear-orders', async (req, res) => {
  try {
    await ShopifyOrder.deleteMany({});
    await CacheMarker.deleteMany({ channel: 'shopify' });
    console.log("🧹 [DB Cache Reset] Cleared Shopify orders and Cache Markers.");
    return res.json({
      success: true,
      message: "Successfully deleted all Shopify orders and Shopify Cache Markers. Your merchant settings and tokens remain intact. Please reload the dashboard to perform a fresh sync!"
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/shopify
router.get('/', async (req, res) => {
  const type = req.query.type || 'products';
  let shopify_token = req.query.shopify_token || req.query.oms_token;
  const shopify_url = req.query.shopify_url;
  const limit = safeParseInt(req.query.limit, 25);
  const startDate = req.query.start_date;
  const endDate = req.query.end_date;

  console.log(`[Shopify API Route] Request: type=${type}, start_date=${startDate}, end_date=${endDate}`);

  if (!shopify_url) {
    return res.status(400).json({ error: 'Missing Shopify store URL/domain' });
  }

  const shopDomain = sanitizeShopUrl(shopify_url);

  // If token is missing or 'oauth' placeholder, look up from database Merchant record
  if (!shopify_token || shopify_token === 'oauth') {
    try {
      const merchant = await Merchant.findOne({ storeUrl: shopDomain });
      if (merchant && merchant.shopifyAccessToken) {
        shopify_token = merchant.shopifyAccessToken;
      }
    } catch (err) {
      console.warn("[Shopify API Route] Failed to look up OAuth token from DB:", err.message);
    }
  }

  if (!shopify_token) {
    return res.status(400).json({ error: 'Missing Shopify access token' });
  }

  try {
    const updateObj = {
      storeUrl: shopDomain,
      currency: req.query.currency || 'PKR'
    };
    if (req.query.shopify_token && req.query.shopify_token !== 'oauth') {
      updateObj.shopifyAccessToken = req.query.shopify_token;
    }
    await Merchant.findOneAndUpdate(
      { storeUrl: shopDomain },
      updateObj,
      { upsert: true, new: true }
    );
    console.log(`[Shopify API Route] Auto-linked Merchant record for ${shopDomain}`);
  } catch (err) {
    console.warn("[Shopify API Route] Merchant auto-link failed:", err.message);
  }

  try {
    // --- TYPE: PRODUCTS ---
    if (type === 'products') {
      const forceRefresh = req.query.refresh === 'true';
      let dbProducts = await ShopifyProduct.find({ storeUrl: shopDomain });

      if (forceRefresh || dbProducts.length === 0) {
        await syncProductsFromShopify(shopDomain, shopify_token);
        dbProducts = await ShopifyProduct.find({ storeUrl: shopDomain });
      }

      const formattedProducts = dbProducts.map(p => ({
        id: p.productId,
        title: p.title,
        handle: p.handle,
        sku: p.sku || '',
        image: p.imageUrl ? { src: p.imageUrl } : null,
        variants: p.variants?.map(v => ({
          id: v.variantId,
          title: v.title,
          price: v.price.toString(),
          sku: v.sku || '',
          inventory_quantity: v.inventoryQuantity
        })) || []
      }));

      return res.json({
        products: formattedProducts,
        nextPageInfo: null
      });
    }

    // --- TYPE: ORDERS ---
    if (type === 'orders') {
      const forceRefresh = req.query.refresh === 'true';
      let sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - 30);
      let untilDate = new Date();

      if (startDate) sinceDate = new Date(startDate);
      if (endDate) untilDate = new Date(endDate);

      sinceDate.setUTCHours(0, 0, 0, 0);
      untilDate.setUTCHours(23, 59, 59, 999);

      const cacheMarker = await findCoveringMarker(shopDomain, 'shopify', sinceDate, untilDate);
      const isCacheValid = !forceRefresh && !!cacheMarker;

      if (!isCacheValid) {
        const startStr = sinceDate.toISOString().split('T')[0];
        const endStr = untilDate.toISOString().split('T')[0];
        await syncOrdersFromShopify(shopDomain, shopify_token, startStr, endStr);
      }

      const dbOrders = await ShopifyOrder.find({
        storeUrl: shopDomain,
        createdAt: {
          $gte: sinceDate,
          $lte: untilDate
        }
      });

      console.log(`[Shopify API Route] Cache HIT: Returning ${dbOrders.length} orders from MongoDB`);
      const formattedOrders = dbOrders.map(o => ({
        id: o.orderId,
        name: o.orderNumber,
        created_at: o.createdAt.toISOString(),
        total_price: o.totalPrice.toString(),
        currency: o.currency,
        cancelled_at: o.cancelledAt ? o.cancelledAt.toISOString() : null,
        email: o.email || '',
        landing_site: o.landingSite || '',
        referring_site: o.referringSite || '',
        line_items: o.lineItems?.map(li => ({
          product_id: li.productId,
          variant_id: li.variantId,
          quantity: li.quantity,
          price: li.price.toString()
        })) || []
      }));

      return res.json({
        orders: formattedOrders,
        nextPageInfo: null
      });
    }

    // --- TYPE: PERFORMANCE ---
    if (type === 'performance') {
      const forceRefresh = req.query.refresh === 'true';
      const currency = req.query.currency || 'PKR';

      const performanceResult = await calculateCatalogPerformance({
        shopDomain,
        shopify_token,
        startDate,
        endDate,
        currencyCode: currency,
        forceRefresh
      });

      return res.json({
        success: true,
        ...performanceResult
      });
    }

    return res.status(400).json({ error: "Invalid type parameter. Use type=products, type=orders, or type=performance" });
  } catch (error) {
    console.error("[Shopify API Route Error]", error);
    return res.status(500).json({ error: error.message || 'Failed to fetch from Shopify' });
  }
});

// GET /api/shopify/campaign-performance
router.get('/campaign-performance', async (req, res) => {
  try {
    const { campaign_id, start_date, end_date, currency, shopify_url } = req.query;
    if (!campaign_id) {
      return res.status(400).json({ error: "Missing campaign_id query parameter" });
    }

    const shopDomain = shopify_url ? sanitizeShopUrl(shopify_url) : 'OMS';
    const merchant = await Merchant.findOne({ storeUrl: shopDomain });
    if (!merchant) {
      return res.status(404).json({ error: "Merchant not found" });
    }

    const result = await calculateCampaignPerformance({
      shopDomain,
      shopify_token: merchant.shopifyAccessToken,
      campaignId: campaign_id,
      startDate: start_date,
      endDate: end_date,
      currencyCode: currency || 'PKR'
    });

    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error("[Shopify API Campaign Performance Error]", error);
    return res.status(500).json({ error: error.message || 'Failed to calculate campaign performance' });
  }
});

// GET /api/shopify/adset-performance
router.get('/adset-performance', async (req, res) => {
  try {
    const { adset_id, start_date, end_date, currency, shopify_url } = req.query;
    if (!adset_id) {
      return res.status(400).json({ error: "Missing adset_id query parameter" });
    }

    const shopDomain = shopify_url ? sanitizeShopUrl(shopify_url) : 'OMS';
    const merchant = await Merchant.findOne({ storeUrl: shopDomain });
    if (!merchant) {
      return res.status(404).json({ error: "Merchant not found" });
    }

    const result = await calculateAdSetPerformance({
      shopDomain,
      adSetId: adset_id,
      startDate: start_date,
      endDate: end_date,
      currencyCode: currency || 'PKR'
    });

    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error("[Shopify API Ad Set Performance Error]", error);
    return res.status(500).json({ error: error.message || 'Failed to calculate ad set performance' });
  }
});

// GET /api/shopify/channel-orders
router.get('/channel-orders', async (req, res) => {
  try {
    const { channel, start_date, end_date, shopify_url, page = 1, limit = 50 } = req.query;
    if (!channel) {
      return res.status(400).json({ error: "Missing channel query parameter" });
    }

    const shopDomain = shopify_url ? sanitizeShopUrl(shopify_url) : 'OMS';

    // Resolve date boundary
    let sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - 30);
    let untilDate = new Date();

    if (start_date) sinceDate = new Date(start_date);
    if (end_date) untilDate = new Date(end_date);

    sinceDate.setUTCHours(0, 0, 0, 0);
    untilDate.setUTCHours(23, 59, 59, 999);

    const dbOrders = await ShopifyOrder.find({
      storeUrl: shopDomain,
      createdAt: { $gte: sinceDate, $lte: untilDate },
      cancelledAt: null
    }).sort({ createdAt: -1 });

    // Filter by channel
    const filteredOrders = dbOrders.filter(o => {
      if (channel === 'Store Total') return true;
      const orderChan = getOrderChannel(o.attribution?.utmSource || '', o.referringSite || '', o.attribution?.clickId || '');
      return orderChan.toLowerCase() === channel.toLowerCase();
    });

    // Pagination
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = pageNum * limitNum;

    const paginatedOrders = filteredOrders.slice(startIndex, endIndex);

    // Extract unique IDs for batch queries
    const campaignIds = new Set();
    const adSetIds = new Set();
    const adIds = new Set();

    paginatedOrders.forEach(o => {
      const attr = o.attribution;
      if (attr) {
        if (attr.campaignId) campaignIds.add(attr.campaignId);
        if (attr.utmCampaign && /^\d+$/.test(attr.utmCampaign)) campaignIds.add(attr.utmCampaign);

        if (attr.adSetId) adSetIds.add(attr.adSetId);
        if (attr.utmTerm && /^\d+$/.test(attr.utmTerm)) adSetIds.add(attr.utmTerm);

        if (attr.adId) adIds.add(attr.adId);
        if (attr.utmContent && /^\d+$/.test(attr.utmContent)) adIds.add(attr.utmContent);
      }
    });

    const campaignIdArr = Array.from(campaignIds);
    const adSetIdArr = Array.from(adSetIds);
    const adIdArr = Array.from(adIds);

    let metadataList = [];
    let insightsAgg = [];

    if (campaignIdArr.length > 0 || adSetIdArr.length > 0 || adIdArr.length > 0) {
      metadataList = await AdMetadata.find({
        storeUrl: shopDomain,
        $or: [
          { campaignId: { $in: campaignIdArr } },
          { adSetId: { $in: adSetIdArr } },
          { adId: { $in: adIdArr } }
        ]
      }).lean();
    }

    if (adIdArr.length > 0) {
      insightsAgg = await DailyAdInsight.aggregate([
        {
          $match: {
            storeUrl: shopDomain,
            adId: { $in: adIdArr },
            spend: { $gt: 0 }
          }
        },
        {
          $group: {
            _id: "$adId",
            firstSpend: { $min: "$date" },
            lastSpend: { $max: "$date" }
          }
        }
      ]);
    }

    // Create maps for quick lookup
    const metadataMapByCampaign = new Map();
    const metadataMapByAdSet = new Map();
    const metadataMapByAd = new Map();

    metadataList.forEach(m => {
      if (m.campaignId) metadataMapByCampaign.set(m.campaignId, m);
      if (m.adSetId) metadataMapByAdSet.set(m.adSetId, m);
      if (m.adId) metadataMapByAd.set(m.adId, m);
    });

    const adSpendDatesMap = new Map();
    insightsAgg.forEach(i => {
      adSpendDatesMap.set(i._id, {
        firstSpend: i.firstSpend,
        lastSpend: i.lastSpend
      });
    });

    const formattedOrders = paginatedOrders.map(o => {
      const attr = o.attribution || {};
      const orderCampaignId = attr.campaignId || (attr.utmCampaign && /^\d+$/.test(attr.utmCampaign) ? attr.utmCampaign : null);
      const orderAdSetId = attr.adSetId || (attr.utmTerm && /^\d+$/.test(attr.utmTerm) ? attr.utmTerm : null);
      const orderAdId = attr.adId || (attr.utmContent && /^\d+$/.test(attr.utmContent) ? attr.utmContent : null);

      const campaignMeta = orderCampaignId ? metadataMapByCampaign.get(orderCampaignId) : null;
      const adSetMeta = orderAdSetId ? metadataMapByAdSet.get(orderAdSetId) : null;
      const adMeta = orderAdId ? metadataMapByAd.get(orderAdId) : null;
      const spendDates = orderAdId ? adSpendDatesMap.get(orderAdId) : null;

      return {
        orderId: o.orderId,
        orderNumber: o.orderNumber || o.name || '',
        createdAt: o.createdAt,
        email: o.email || '—',
        totalPrice: o.totalPrice,
        currency: o.currency,
        attribution: {
          utmSource: attr.utmSource || '',
          utmMedium: attr.utmMedium || '',
          utmCampaign: attr.utmCampaign || '',
          utmContent: attr.utmContent || '',
          utmTerm: attr.utmTerm || '',
          clickId: attr.clickId || '',
          adId: attr.adId || '',
          adName: attr.adName || '',
          campaignId: attr.campaignId || '',
          adSetId: attr.adSetId || '',
          attributionMethod: attr.attributionMethod || '',
          campaignMeta: campaignMeta ? {
            id: campaignMeta.campaignId,
            name: campaignMeta.campaignName,
            status: campaignMeta.campaignStatus,
            startDate: campaignMeta.campaignStartDate,
            endDate: campaignMeta.campaignEndDate
          } : null,
          adSetMeta: adSetMeta ? {
            id: adSetMeta.adSetId,
            name: adSetMeta.adSetName,
            status: adSetMeta.adSetStatus,
            startDate: adSetMeta.adSetStartDate,
            endDate: adSetMeta.adSetEndDate
          } : null,
          adMeta: adMeta ? {
            id: adMeta.adId,
            name: adMeta.adName,
            status: adMeta.adStatus,
            createdTime: adMeta.adCreatedTime
          } : null,
          adSpendDates: spendDates ? {
            firstSpend: spendDates.firstSpend,
            lastSpend: spendDates.lastSpend
          } : null
        },
        lineItems: o.lineItems?.map(li => ({
          product_id: li.productId,
          variant_id: li.variantId,
          quantity: li.quantity,
          price: li.price
        })) || [],
        referringSite: o.referringSite || '',
        landingSite: o.landingSite || ''
      };
    });

    return res.json({
      success: true,
      totalCount: filteredOrders.length,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(filteredOrders.length / limitNum),
      data: formattedOrders
    });
  } catch (error) {
    console.error("[Shopify API Channel Orders Error]", error);
    return res.status(500).json({ error: error.message || 'Failed to fetch channel orders' });
  }
});

// GET /api/shopify/ad-performance
router.get('/ad-performance', async (req, res) => {
  try {
    const { ad_id, start_date, end_date, currency, shopify_url } = req.query;
    if (!ad_id) {
      return res.status(400).json({ error: "Missing ad_id query parameter" });
    }

    const shopDomain = shopify_url ? sanitizeShopUrl(shopify_url) : 'OMS';
    const merchant = await Merchant.findOne({ storeUrl: shopDomain });
    if (!merchant) {
      return res.status(404).json({ error: "Merchant not found" });
    }

    const result = await calculateAdPerformance({
      shopDomain,
      adId: ad_id,
      startDate: start_date,
      endDate: end_date,
      currencyCode: currency || 'PKR'
    });

    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error("[Shopify API Ad Performance Error]", error);
    return res.status(500).json({ error: error.message || 'Failed to calculate ad performance' });
  }
});

// GET /api/shopify/auth
router.get('/auth', async (req, res) => {
  const shop = req.query.shop;
  if (!shop) {
    return res.status(400).send('Missing shop parameter');
  }

  const shopDomain = sanitizeShopUrl(shop);
  const apiKey = process.env.SHOPIFY_API_KEY;
  const redirectUri = process.env.SHOPIFY_REDIRECT_URI;
  const scopes = 'read_products,read_orders,read_all_orders';
  const state = crypto.randomBytes(16).toString('hex');

  const redirectUrl = `https://${shopDomain}/admin/oauth/authorize?client_id=${apiKey}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
  console.log(`[Shopify OAuth] Redirecting shop ${shopDomain} to Shopify authorization...`);
  return res.redirect(redirectUrl);
});

// GET /api/shopify/auth/callback
router.get('/auth/callback', async (req, res) => {
  const { shop, code, state, hmac } = req.query;

  if (!shop || !code || !state || !hmac) {
    return res.status(400).send('Required OAuth parameters are missing');
  }

  const shopDomain = sanitizeShopUrl(shop);

  // Verification 1: Stateless check of state format
  if (state.length !== 32) {
    return res.status(400).send('OAuth state verification failed');
  }

  // Verification 2: Verify HMAC Signature
  const apiSecret = process.env.SHOPIFY_API_SECRET;
  if (!apiSecret) {
    console.error("[Shopify OAuth] Missing SHOPIFY_API_SECRET in env variables");
    return res.status(500).send('Internal server configuration error');
  }

  // Format Shopify's lexicographically sorted validation query string manually
  const keys = Object.keys(req.query).filter(k => k !== 'hmac').sort();
  const message = keys.map(k => `${k}=${req.query[k]}`).join('&');
  const generatedHmac = crypto
    .createHmac('sha256', apiSecret)
    .update(message)
    .digest('hex');

  if (generatedHmac !== hmac) {
    console.warn(`[Shopify OAuth] HMAC validation failed for ${shopDomain}`);
    return res.status(400).send('HMAC validation failed');
  }

  // Exchange auth code for token
  const apiKey = process.env.SHOPIFY_API_KEY;
  try {
    const tokenUrl = `https://${shopDomain}/admin/oauth/access_token`;
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: apiKey,
        client_secret: apiSecret,
        code
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${errorText}`);
    }

    const tokenData = await response.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      throw new Error('Access token not found in response');
    }

    // Save token to Merchant db model
    await Merchant.findOneAndUpdate(
      { storeUrl: shopDomain },
      {
        storeUrl: shopDomain,
        shopifyAccessToken: accessToken,
        currency: 'PKR'
      },
      { upsert: true, new: true }
    );

    console.log(`[Shopify OAuth] Authorized and saved access token for ${shopDomain}`);

    // Redirect to frontend landing page with shop domain
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    return res.redirect(`${frontendUrl}/?shop=${encodeURIComponent(shopDomain)}&oauth=success`);
  } catch (err) {
    console.error('[Shopify OAuth Callback Error]', err);
    return res.status(500).send(`Authentication failed: ${err.message}`);
  }
});

export default router;
