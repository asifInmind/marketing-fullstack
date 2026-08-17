import { Router } from 'express';
import ShopifyProduct from '../models/ShopifyProduct.js';
import ShopifyOrder from '../models/ShopifyOrder.js';
import Merchant from '../models/Merchant.js';
import AdMetadata from '../models/AdMetadata.js';
import DailyAdInsight from '../models/DailyAdInsight.js';
import CacheMarker from '../models/CacheMarker.js';
import { fetchCompleteDashboard } from '../lib/metaApi.js';

const router = Router();

// Helper to safely parse strings to numbers
function safeParseInt(val, defaultVal = 0) {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? defaultVal : parsed;
  }
  return defaultVal;
}

// Helper to sanitize shop domain name
function sanitizeShopUrl(shopUrl) {
  let url = shopUrl.trim().toLowerCase();
  url = url.replace(/^https?:\/\//, '');
  url = url.replace(/\/$/, '');
  if (!url.includes('.')) {
    url = `${url}.myshopify.com`;
  }
  return url;
}

// Helper to parse Next link headers for Shopify pagination
function parseLinkHeader(header) {
  if (!header) return null;
  const parts = header.split(',');
  const links = {};
  for (const part of parts) {
    const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (match) {
      const url = new URL(match[1]);
      const pageInfo = url.searchParams.get('page_info');
      links[match[2]] = pageInfo;
    }
  }
  return links.next || null;
}

// Helper to find a fresh cache marker that fully covers the requested date range
async function findCoveringMarker(storeUrl, channel, sinceDate, untilDate) {
  try {
    const markers = await CacheMarker.find({ storeUrl, channel });
    const cacheTtl = 4 * 60 * 60 * 1000; // 4 hours TTL
    const now = new Date();

    for (const marker of markers) {
      if (now - new Date(marker.lastUpdated) > cacheTtl) {
        continue;
      }

      const range = getMarkerRange(marker);
      if (range) {
        if (range.start <= sinceDate && range.end >= untilDate) {
          console.log(`[Cache Manager] Found covering marker "${marker.key}" for requested Shopify range ${sinceDate.toISOString().split('T')[0]} to ${untilDate.toISOString().split('T')[0]}`);
          return marker;
        }
      }
    }
  } catch (err) {
    console.warn("[Cache Manager] Error scanning covering markers:", err.message);
  }
  return null;
}

// Helper to extract the start and end dates covered by a specific cache marker
function getMarkerRange(marker) {
  let start, end;
  const key = marker.key;
  const lastUpdated = new Date(marker.lastUpdated);

  if (key.startsWith('orders_')) {
    const parts = key.replace('orders_', '').split('_');
    if (parts.length === 2 && parts[0] && parts[1]) {
      start = new Date(parts[0]);
      end = new Date(parts[1]);
    }
  } else if (key.startsWith('insights_custom_')) {
    const parts = key.replace('insights_custom_', '').split('_');
    if (parts.length === 2 && parts[0] && parts[1]) {
      start = new Date(parts[0]);
      end = new Date(parts[1]);
    }
  } else if (key.startsWith('insights_')) {
    const preset = key.replace('insights_', '');
    end = new Date(lastUpdated);
    start = new Date(lastUpdated);
    switch (preset) {
      case 'last_7d':
        start.setDate(end.getDate() - 7);
        break;
      case 'last_14d':
        start.setDate(end.getDate() - 14);
        break;
      case 'last_30d':
        start.setDate(end.getDate() - 30);
        break;
      case 'last_90d':
        start.setDate(end.getDate() - 90);
        break;
      default:
        return null;
    }
  } else {
    return null;
  }

  if (start && end) {
    start.setUTCHours(0, 0, 0, 0);
    end.setUTCHours(23, 59, 59, 999);
    return { start, end };
  }
  return null;
}

// =========================================================================
// MODULAR SYNC HELPERS (Used by both raw endpoints and performance reports)
// =========================================================================

async function syncProductsFromShopify(shopDomain, shopify_token) {
  let allProducts = [];
  let nextUrl = new URL(`https://${shopDomain}/admin/api/2024-01/products.json`);
  nextUrl.searchParams.set('status', 'active');
  nextUrl.searchParams.set('limit', '250');

  console.log(`[Shopify API Route] Syncing products live from ${nextUrl.toString()}`);

  let hasNextPage = true;
  let pageCount = 1;

  while (hasNextPage && pageCount <= 10) {
    const response = await fetch(nextUrl.toString(), {
      headers: {
        "X-Shopify-Access-Token": shopify_token,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Shopify API returned: ${text}`);
    }

    const data = await response.json();
    if (data.products) {
      allProducts = [...allProducts, ...data.products];
    }

    const linkHeader = response.headers.get('link');
    const nextPageInfo = parseLinkHeader(linkHeader);

    if (nextPageInfo) {
      nextUrl = new URL(`https://${shopDomain}/admin/api/2024-01/products.json`);
      nextUrl.searchParams.set('page_info', nextPageInfo);
      nextUrl.searchParams.set('limit', '250');
      pageCount++;
    } else {
      hasNextPage = false;
    }
  }

  if (allProducts.length > 0) {
    const productPromises = allProducts.map(prod => {
      return ShopifyProduct.findOneAndUpdate(
        { storeUrl: shopDomain, productId: prod.id.toString() },
        {
          storeUrl: shopDomain,
          productId: prod.id.toString(),
          title: prod.title,
          handle: prod.handle,
          sku: prod.variants?.[0]?.sku || '',
          imageUrl: prod.image?.src || '',
          variants: prod.variants?.map(v => ({
            variantId: v.id.toString(),
            title: v.title,
            price: parseFloat(v.price || 0),
            sku: v.sku || '',
            inventoryQuantity: v.inventory_quantity
          })) || []
        },
        { upsert: true, new: true }
      );
    });
    await Promise.all(productPromises);
  }
  return allProducts;
}

async function syncOrdersFromShopify(shopDomain, shopify_token, startDate, endDate) {
  let allOrders = [];
  let nextUrl = new URL(`https://${shopDomain}/admin/api/2024-01/orders.json`);
  nextUrl.searchParams.set('status', 'any');
  nextUrl.searchParams.set('limit', '250');

  if (startDate) {
    nextUrl.searchParams.set('created_at_min', new Date(startDate).toISOString());
  }
  if (endDate) {
    nextUrl.searchParams.set('created_at_max', new Date(endDate).toISOString());
  }

  console.log(`[Shopify API Route] Syncing orders live from ${nextUrl.toString()}`);

  let hasNextPage = true;
  let pageCount = 1;

  while (hasNextPage && pageCount <= 10) {
    const response = await fetch(nextUrl.toString(), {
      headers: {
        "X-Shopify-Access-Token": shopify_token,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Shopify API returned: ${text}`);
    }

    const data = await response.json();
    if (data.orders) {
      allOrders = [...allOrders, ...data.orders];
    }

    const linkHeader = response.headers.get('link');
    const nextPageInfo = parseLinkHeader(linkHeader);

    if (nextPageInfo) {
      nextUrl = new URL(`https://${shopDomain}/admin/api/2024-01/orders.json`);
      nextUrl.searchParams.set('page_info', nextPageInfo);
      nextUrl.searchParams.set('limit', '250');
      pageCount++;
    } else {
      hasNextPage = false;
    }
  }

  const orderPromises = allOrders.map(order => {
    const landingSite = order.landing_site || '';
    let utmSource = '';
    let utmMedium = '';
    let utmCampaign = '';
    let clickId = '';

    try {
      if (landingSite) {
        const urlObj = new URL(landingSite, 'https://fallback.com');
        utmSource = urlObj.searchParams.get('utm_source') || '';
        utmMedium = urlObj.searchParams.get('utm_medium') || '';
        utmCampaign = urlObj.searchParams.get('utm_campaign') || '';
        clickId = urlObj.searchParams.get('fbclid') || '';
      }
    } catch { }

    return ShopifyOrder.findOneAndUpdate(
      { storeUrl: shopDomain, orderId: order.id.toString() },
      {
        storeUrl: shopDomain,
        orderId: order.id.toString(),
        orderNumber: order.name,
        createdAt: new Date(order.created_at),
        totalPrice: parseFloat(order.total_price || 0),
        currency: order.currency || 'PKR',
        cancelledAt: order.cancelled_at ? new Date(order.cancelled_at) : null,
        email: order.email || '',
        landingSite: landingSite,
        referringSite: order.referring_site || '',
        lineItems: order.line_items?.map(li => ({
          productId: li.product_id?.toString() || '',
          variantId: li.variant_id?.toString() || '',
          quantity: li.quantity,
          price: parseFloat(li.price || 0)
        })) || [],
        attribution: {
          utmSource,
          utmMedium,
          utmCampaign,
          clickId,
          adId: '',
          attributionMethod: clickId ? 'fbclid_match' : (utmSource ? 'utm_match' : 'organic')
        }
      },
      { upsert: true, new: true }
    );
  });

  const markerKey = `orders_${startDate || ''}_${endDate || ''}`;
  const markerPromise = CacheMarker.findOneAndUpdate(
    { storeUrl: shopDomain, channel: 'shopify', key: markerKey },
    { lastUpdated: new Date() },
    { upsert: true, new: true }
  );

  await Promise.all([...orderPromises, markerPromise]);
  return allOrders;
}

// Helper function to match Meta Ad to a Product
function matchAdToProduct(ad, productsList) {
  // 1. Try URL Handle match (most accurate)
  const url = (ad.finalUrl || '').toLowerCase();
  const handleRegex = /\/products\/([a-zA-Z0-9-_]+)/;
  const match = url.match(handleRegex);
  if (match && match[1]) {
    const handle = match[1];
    const product = productsList.find(p => p.handle.toLowerCase() === handle);
    if (product) return product;
  }

  // 1.5 Try URL contains handle match (for custom query/redirect URLs)
  if (url) {
    for (const product of productsList) {
      if (product.handle && url.includes(product.handle.toLowerCase())) {
        return product;
      }
    }
  }

  const adNameLower = ad.name.toLowerCase();

  // 2. Try Variant SKU / top-level SKU match (very accurate)
  for (const product of productsList) {
    if (product.sku && adNameLower.includes(product.sku.toLowerCase())) {
      return product;
    }
    if (product.variants) {
      for (const variant of product.variants) {
        if (variant.sku && adNameLower.includes(variant.sku.toLowerCase())) {
          return product;
        }
      }
    }
  }

  // 3. Try Product Title match (fallback, length constraint to prevent generic false-positives)
  for (const product of productsList) {
    const titleLower = product.title.toLowerCase();
    if (titleLower.length > 5 && adNameLower.includes(titleLower)) {
      return product;
    }
  }

  return null;
}

async function syncMetaInsightsFromApi(shopDomain, fbAccessToken, adAccountId, sinceDate, untilDate, startStr, endStr) {
  try {
    const config = {
      accessToken: fbAccessToken,
      accountId: adAccountId,
      dateRange: {
        preset: 'custom',
        since: startStr,
        until: endStr
      },
      pageSize: 150
    };

    console.log(`[shopify.js Sync Meta] Calling Meta API for custom range ${startStr} to ${endStr}...`);
    const data = await fetchCompleteDashboard(config, 150, true);

    if (data) {
      const cachePromises = [];

      // A. Cache AdMetadata
      if (data.ads) {
        data.ads.forEach(ad => {
          const campaign = data.campaigns?.find(c => c.id === ad.campaign_id) || {};
          const adSet = data.adSets?.find(s => s.id === ad.adset_id) || {};

          // Enrich the live object so the response returned to the client contains these fields
          ad.campaign_name = ad.campaign?.name || campaign.name || '';
          ad.adset_name = ad.adset?.name || adSet.name || '';

          const creativeId = ad.creative?.id;
          const creative = creativeId ? (data.creatives?.[creativeId] || {}) : {};

          const updateObj = {
            storeUrl: shopDomain,
            channel: 'meta',
            campaignId: ad.campaign_id,
            campaignName: ad.campaign?.name || campaign.name || ad.campaign_name || '',
            campaignStatus: campaign.status || ad.campaign_status || '',
            campaignObjective: campaign.objective || '',
            adSetId: ad.adset_id,
            adSetName: ad.adset?.name || adSet.name || ad.adset_name || '',
            adSetStatus: adSet.status || ad.adset_status || '',
            adSetTargeting: adSet.targeting ? JSON.stringify(adSet.targeting) : '',
            adId: ad.id,
            adName: ad.name,
            adStatus: ad.status || '',
            lastUpdated: new Date()
          };

          const hasCreativeContent = creative && (creative.name || creative.final_url || creative.body || creative.headline);
          if (hasCreativeContent) {
            updateObj.creative = {
              creativeId: creativeId || '',
              creativeName: creative.name || '',
              thumbnailUrl: creative.thumbnail_url || '',
              bodyText: creative.body || '',
              destinationUrl: creative.final_url || '',
              callToAction: creative.call_to_action || '',
              format: creative.format || '',
              headline: creative.headline || '',
              description: creative.description || ''
            };
          } else {
            updateObj['creative.creativeId'] = creativeId || '';
          }

          cachePromises.push(
            AdMetadata.findOneAndUpdate(
              { adId: ad.id },
              { $set: updateObj },
              { upsert: true, new: true }
            )
          );
        });
      }

      // B. Cache DailyAdInsights
      if (data.dailyInsights) {
        data.dailyInsights.forEach(ins => {
          const insightDate = new Date(ins.date_start || new Date());
          insightDate.setUTCHours(0, 0, 0, 0);

          cachePromises.push(
            DailyAdInsight.findOneAndUpdate(
              { storeUrl: shopDomain, date: insightDate, adId: ins.ad_id },
              {
                storeUrl: shopDomain,
                date: insightDate,
                channel: 'meta',
                adId: ins.ad_id,
                spend: parseFloat(ins.spend || 0),
                impressions: parseInt(ins.impressions || 0, 10),
                clicks: parseInt(ins.clicks || 0, 10),
                conversions: parseInt(ins.conversions || 0, 10),
                conversionValue: parseFloat(ins.conversion_values || 0)
              },
              { upsert: true, new: true }
            )
          );
        });
      }

      // C. Cache Marker
      const markerKey = `insights_custom_${startStr || ''}_${endStr || ''}`;
      cachePromises.push(
        CacheMarker.findOneAndUpdate(
          { storeUrl: shopDomain, channel: 'meta', key: markerKey },
          { lastUpdated: new Date() },
          { upsert: true, new: true }
        )
      );

      await Promise.all(cachePromises);
      console.log(`[shopify.js Sync Meta] Successfully cached ${cachePromises.length} Meta objects in MongoDB.`);
    }
  } catch (err) {
    console.error("❌ [shopify.js Sync Meta] Error during background Meta sync:", err.message);
  }
}

// =========================================================================
// ROUTES
// =========================================================================

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

// GET /api/shopify
router.get('/', async (req, res) => {
  const type = req.query.type || 'products';
  const shopify_token = req.query.shopify_token || req.query.oms_token;
  const shopify_url = req.query.shopify_url;
  const limit = safeParseInt(req.query.limit, 25);
  const startDate = req.query.start_date;
  const endDate = req.query.end_date;

  console.log(`[Shopify API Route] Request: type=${type}, start_date=${startDate}, end_date=${endDate}`);

  if (!shopify_token) {
    return res.status(400).json({ error: 'Missing Shopify access token' });
  }
  if (!shopify_url) {
    return res.status(400).json({ error: 'Missing Shopify store URL/domain' });
  }

  const shopDomain = sanitizeShopUrl(shopify_url);

  try {
    await Merchant.findOneAndUpdate(
      { storeUrl: shopDomain },
      {
        storeUrl: shopDomain,
        shopifyAccessToken: shopify_token,
        currency: req.query.currency || 'PKR'
      },
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

    // --- TYPE: PERFORMANCE (Attributed reports for Shopify Catalog UI) ---
    if (type === 'performance') {
      const forceRefresh = req.query.refresh === 'true';

      // Calculate date boundary
      let sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - 30);
      let untilDate = new Date();

      if (startDate) sinceDate = new Date(startDate);
      if (endDate) untilDate = new Date(endDate);

      sinceDate.setUTCHours(0, 0, 0, 0);
      untilDate.setUTCHours(23, 59, 59, 999);

      const startStr = sinceDate.toISOString().split('T')[0];
      const endStr = untilDate.toISOString().split('T')[0];

      // 1. Sync Products (if empty or force refresh)
      let dbProducts = await ShopifyProduct.find({ storeUrl: shopDomain });
      if (forceRefresh || dbProducts.length === 0) {
        await syncProductsFromShopify(shopDomain, shopify_token);
        dbProducts = await ShopifyProduct.find({ storeUrl: shopDomain });
      }

      // 2. Sync Orders (if not covered by cache or force refresh)
      const orderCacheMarker = await findCoveringMarker(shopDomain, 'shopify', sinceDate, untilDate);
      if (forceRefresh || !orderCacheMarker) {
        await syncOrdersFromShopify(shopDomain, shopify_token, startStr, endStr);
      }

      // 2.5 Sync Meta Insights in background (if not covered by cache or force refresh)
      const metaCacheMarker = await findCoveringMarker(shopDomain, 'meta', sinceDate, untilDate);
      if (forceRefresh || !metaCacheMarker) {
        const merchant = await Merchant.findOne({ storeUrl: shopDomain });
        if (merchant && merchant.fbAccessToken && merchant.adAccountId) {
          console.log(`[Shopify Performance Sync] Meta insights cache MISS for range ${startStr} to ${endStr}. Syncing Meta in background...`);
          // Trigger asynchronously in the background (non-blocking) to prevent HTTP timeouts
          syncMetaInsightsFromApi(shopDomain, merchant.fbAccessToken, merchant.adAccountId, sinceDate, untilDate, startStr, endStr)
            .then(() => {
              console.log(`[Shopify Performance Sync] Background Meta sync complete for ${shopDomain}.`);
            })
            .catch(err => {
              console.error(`[Shopify Performance Sync] Background Meta sync failed:`, err.message);
            });
        }
      }

      const dbOrders = await ShopifyOrder.find({
        storeUrl: shopDomain,
        createdAt: { $gte: sinceDate, $lte: untilDate }
      });

      // 3. Load Meta structures and daily insights from MongoDB
      const dbMeta = await AdMetadata.find({ storeUrl: shopDomain });
      const dbInsights = await DailyAdInsight.find({
        storeUrl: shopDomain,
        date: { $gte: sinceDate, $lte: untilDate }
      });

      // 4. Aggregate insights by adId
      const adInsights = {};
      dbInsights.forEach(ins => {
        if (!adInsights[ins.adId]) {
          adInsights[ins.adId] = { spend: 0, clicks: 0, conversions: 0, conversionValue: 0, impressions: 0 };
        }
        adInsights[ins.adId].spend += ins.spend || 0;
        adInsights[ins.adId].clicks += ins.clicks || 0;
        adInsights[ins.adId].impressions += ins.impressions || 0;
        adInsights[ins.adId].conversions += ins.conversions || 0;
        adInsights[ins.adId].conversionValue += ins.conversionValue || 0;
      });

      // Find the latest insight date present in dbInsights to avoid timezone / sync lag issues
      let latestInsightTime = new Date().getTime();
      if (dbInsights.length > 0) {
        latestInsightTime = Math.max(...dbInsights.map(ins => new Date(ins.date).getTime()));
      }
      const maxInsightDate = new Date(latestInsightTime);

      // 5. Construct metaAds list (filtered to active status, has spend in range, and is NOT frozen)
      const metaAds = dbMeta.map(m => {
        const insight = adInsights[m.adId] || { spend: 0, clicks: 0, conversions: 0, conversionValue: 0, impressions: 0 };

        // Find last active date with spend > 0 in this range from the daily insights
        const adDaily = dbInsights
          .filter(ins => ins.adId === m.adId && ins.spend > 0)
          .map(ins => ins.date);

        let lastActiveDate = null;
        if (adDaily.length > 0) {
          lastActiveDate = new Date(Math.max(...adDaily.map(d => new Date(d).getTime())));
        }

        return {
          id: m.adId,
          name: m.adName || '',
          status: m.adStatus || '',
          campaignName: m.campaignName || 'N/A',
          adGroupName: m.adSetName || 'N/A',
          cost: insight.spend,
          clicks: insight.clicks,
          impressions: insight.impressions,
          conversions: insight.conversions,
          conversionValue: insight.conversionValue,
          finalUrl: m.creative?.destinationUrl || '',
          lastActiveDate: lastActiveDate, // Pass it down to performance matched ads
          creative: m.creative ? {
            id: m.creative.creativeId,
            headline: m.creative.headline,
            description: m.creative.description
          } : null
        };
      }).filter(ad => {
        const isActive = ad.status.toUpperCase() === 'ACTIVE';
        const hasSpend = ad.cost > 0;
        if (!isActive || !hasSpend) return false;

        // Check if the active ad is frozen (has not spent any budget in the last 3 days relative to the latest sync date)
        if (ad.lastActiveDate) {
          const lastDate = new Date(ad.lastActiveDate);
          const daysSinceLastSpend = Math.floor((maxInsightDate - lastDate) / (1000 * 60 * 60 * 24));
          if (daysSinceLastSpend > 3) {
            return false; // Exclude frozen ads
          }
        }
        return true;
      });

      // 6. Run Alerts Engine (active ads with spend and out of stock products)
      const wastedBudgetAlerts = [];
      metaAds.forEach(ad => {
        const isActive = ad.status.toUpperCase() === 'ACTIVE';
        const hasSpend = ad.cost > 0;

        if (isActive && hasSpend) {
          const product = matchAdToProduct(ad, dbProducts);
          if (product) {
            const totalStock = product.variants.reduce((sum, v) => sum + (v.inventoryQuantity || 0), 0);
            if (totalStock <= 0) {
              wastedBudgetAlerts.push({
                adId: ad.id,
                adName: ad.name,
                adSetName: ad.adGroupName,
                campaignName: ad.campaignName,
                spend: ad.cost,
                clicks: ad.clicks,
                shopifyProductId: product.productId,
                productTitle: product.title,
                sku: product.variants[0]?.sku || 'No SKU',
                inventoryQuantity: totalStock,
                status: ad.status,
                adUrl: ad.finalUrl || '#'
              });
            }
          }
        }
      });

      // 7. Run Product Performance Attribution Engine
      const perfMap = {};
      dbProducts.forEach(p => {
        perfMap[p.productId] = {
          productId: p.productId,
          productTitle: p.title,
          sku: p.variants[0]?.sku || '—',
          inventoryQuantity: p.variants.reduce((sum, v) => sum + (v.inventoryQuantity || 0), 0),
          shopifySalesQuantity: 0,
          shopifyRevenue: 0,
          metaSalesQuantity: 0,
          metaRevenue: 0,
          adSpend: 0,
          adClicks: 0,
          attributedSales: 0,
          attributedRevenue: 0,
          trueROAS: 0,
          metaAttributedROAS: 0,
          productImageUrl: p.imageUrl || null,
          handle: p.handle || '',
          matchedAds: [],
          firstActiveDate: null,
          lastActiveDate: null,
          variants: p.variants || []
        };
      });

      const unmatchedAds = [];
      metaAds.forEach(ad => {
        const product = matchAdToProduct(ad, dbProducts);
        if (product && perfMap[product.productId]) {
          perfMap[product.productId].adSpend += ad.cost || 0;
          perfMap[product.productId].adClicks += ad.clicks || 0;
          perfMap[product.productId].attributedSales += ad.conversions || 0;
          perfMap[product.productId].attributedRevenue += ad.conversionValue || 0;

          // Extract daily spend breakdown for this specific ad (only days with spend > 0)
          const adDailyInsights = dbInsights
            .filter(ins => ins.adId === ad.id && ins.spend > 0)
            .map(ins => ({
              date: ins.date.toISOString().split('T')[0],
              spend: ins.spend,
              clicks: ins.clicks,
              conversions: ins.conversions
            }));

          // Sort daily insights by date descending
          adDailyInsights.sort((a, b) => new Date(b.date) - new Date(a.date));

          // Get active range for this ad
          let firstActiveDate = null;
          let lastActiveDate = null;
          if (adDailyInsights.length > 0) {
            firstActiveDate = adDailyInsights[adDailyInsights.length - 1].date;
            lastActiveDate = adDailyInsights[0].date;

            // Update overall product active range
            const productRef = perfMap[product.productId];
            if (!productRef.firstActiveDate || new Date(firstActiveDate) < new Date(productRef.firstActiveDate)) {
              productRef.firstActiveDate = firstActiveDate;
            }
            if (!productRef.lastActiveDate || new Date(lastActiveDate) > new Date(productRef.lastActiveDate)) {
              productRef.lastActiveDate = lastActiveDate;
            }
          }

          perfMap[product.productId].matchedAds.push({
            id: ad.id,
            name: ad.name,
            status: ad.status,
            cost: ad.cost,
            clicks: ad.clicks,
            impressions: ad.impressions,
            conversions: ad.conversions,
            conversionValue: ad.conversionValue,
            campaignName: ad.campaignName,
            adSetName: ad.adGroupName,
            finalUrl: ad.finalUrl || '',
            firstActiveDate,
            lastActiveDate,
            dailySpendBreakdown: adDailyInsights,
            insights: {
              conversions: ad.conversions || 0,
              conversion_values: ad.conversionValue || 0,
              impressions: ad.impressions || 0,
              clicks: ad.clicks || 0,
              spend: ad.cost || 0,
              ctr: ad.impressions > 0 ? (ad.clicks / ad.impressions) : 0
            },
            creative: ad.creative ? {
              id: ad.creative.id,
              headline: ad.creative.headline,
              description: ad.creative.description
            } : null
          });
        } else {
          unmatchedAds.push({
            id: ad.id,
            name: ad.name,
            status: ad.status,
            cost: ad.cost,
            clicks: ad.clicks,
            impressions: ad.impressions,
            conversions: ad.conversions,
            conversionValue: ad.conversionValue,
            campaignName: ad.campaignName,
            adSetName: ad.adGroupName,
            finalUrl: ad.finalUrl || ''
          });
        }
      });

      const salesMap = {};
      dbOrders.forEach(order => {
        const isCancelled = order.cancelledAt !== null;
        if (!isCancelled) {
          let isMetaAttributed = false;

          const utmSource = order.attribution?.utmSource?.toLowerCase() || '';
          const clickId = order.attribution?.clickId || '';
          if (['facebook', 'meta', 'instagram', 'fb', 'ig'].includes(utmSource) || clickId) {
            isMetaAttributed = true;
          }

          // Real-time URL parse fallback for older cached order records
          if (!isMetaAttributed && order.landingSite) {
            try {
              const url = new URL(order.landingSite, 'https://fallback.com');
              const source = url.searchParams.get('utm_source')?.toLowerCase() || '';
              const fbclid = url.searchParams.get('fbclid') || '';
              if (['facebook', 'meta', 'instagram', 'fb', 'ig'].includes(source) || fbclid) {
                isMetaAttributed = true;
              }
            } catch { }
          }

          if (!isMetaAttributed && order.referringSite) {
            const ref = order.referringSite.toLowerCase();
            if (ref.includes('facebook.com') || ref.includes('instagram.com')) {
              isMetaAttributed = true;
            }
          }

          order.lineItems.forEach(item => {
            if (item.productId) {
              if (!salesMap[item.productId]) {
                salesMap[item.productId] = { quantity: 0, revenue: 0, metaQuantity: 0, metaRevenue: 0, matchedOrders: [] };
              }
              salesMap[item.productId].quantity += item.quantity || 0;
              salesMap[item.productId].revenue += (item.price * (item.quantity || 0));

              // Check if this Meta-attributed order actually matches an active ad for this product
              let isSpecificallyAttributed = false;
              if (isMetaAttributed) {
                // Get active ads mapped to this product (if any)
                const activeAdsForProduct = perfMap[item.productId]?.matchedAds || [];
                if (activeAdsForProduct.length > 0) {
                  let utmCampaign = (order.attribution?.utmCampaign || '').trim();
                  let utmContent = (order.attribution?.utmContent || '').trim();

                  if (order.landingSite) {
                    try {
                      const url = new URL(order.landingSite, 'https://fallback.com');
                      if (!utmCampaign) utmCampaign = (url.searchParams.get('utm_campaign') || '').trim();
                      if (!utmContent) utmContent = (url.searchParams.get('utm_content') || '').trim();
                    } catch { }
                  }

                  const normalizeStr = (str) => str.toLowerCase().replace(/[\s\-_]/g, '');
                  const orderCampaignNorm = normalizeStr(utmCampaign);
                  const orderContentNorm = normalizeStr(utmContent);

                  if (orderCampaignNorm || orderContentNorm) {
                    // Check if order UTMs match campaign name or ad name of any active ad
                    isSpecificallyAttributed = activeAdsForProduct.some(ad => {
                      const adCampaignNorm = normalizeStr(ad.campaignName || '');
                      const adNameNorm = normalizeStr(ad.name || '');

                      const campaignMatch = orderCampaignNorm && adCampaignNorm && (orderCampaignNorm.includes(adCampaignNorm) || adCampaignNorm.includes(orderCampaignNorm));
                      const contentMatch = orderContentNorm && adNameNorm && (orderContentNorm.includes(adNameNorm) || adNameNorm.includes(orderContentNorm));

                      return campaignMatch || contentMatch;
                    });
                  } else {
                    // General click/source match (no campaign/content specified), and product has active ads, so attribute as fallback
                    isSpecificallyAttributed = true;
                  }
                }
              }

              if (isSpecificallyAttributed) {
                salesMap[item.productId].metaQuantity += item.quantity || 0;
                salesMap[item.productId].metaRevenue += (item.price * (item.quantity || 0));

                let utmCampaign = order.attribution?.utmCampaign || '';
                let utmContent = order.attribution?.utmContent || '';

                if (order.landingSite) {
                  try {
                    const url = new URL(order.landingSite, 'https://fallback.com');
                    if (!utmCampaign) utmCampaign = url.searchParams.get('utm_campaign') || '';
                    if (!utmContent) utmContent = url.searchParams.get('utm_content') || '';
                  } catch { }
                }

                salesMap[item.productId].matchedOrders.push({
                  orderId: order.orderId,
                  orderNumber: order.orderNumber || order.name || '',
                  createdAt: order.createdAt,
                  email: order.email || '—',
                  quantity: item.quantity || 0,
                  price: item.price || 0,
                  totalPrice: (item.price || 0) * (item.quantity || 0),
                  utmSource: order.attribution?.utmSource || '',
                  utmCampaign: utmCampaign,
                  utmContent: utmContent,
                  clickId: order.attribution?.clickId || ''
                });
              }
            }
          });
        }
      });

      const productPerformance = Object.values(perfMap)
        .map(item => {
          const sales = salesMap[item.productId] || { quantity: 0, revenue: 0, metaQuantity: 0, metaRevenue: 0, matchedOrders: [] };
          item.shopifySalesQuantity = sales.quantity;
          item.shopifyRevenue = sales.revenue;
          item.metaSalesQuantity = sales.metaQuantity;
          item.metaRevenue = sales.metaRevenue;
          item.matchedOrders = sales.matchedOrders || [];

          // Match daily Shopify conversions driven by Meta
          const isOrderMatchedToAd = (order, ad) => {
            const normalizeStr = (str) => (str || '').toLowerCase().replace(/[\s\-_]/g, '');
            const orderCampaignNorm = normalizeStr(order.utmCampaign);
            const orderContentNorm = normalizeStr(order.utmContent);

            // If the order has specific UTM campaign or ad content parameters, enforce strict matching
            if (orderCampaignNorm || orderContentNorm) {
              const adCampaignNorm = normalizeStr(ad.campaignName);
              const adNameNorm = normalizeStr(ad.name);

              const campaignMatch = orderCampaignNorm && adCampaignNorm && (orderCampaignNorm.includes(adCampaignNorm) || adCampaignNorm.includes(orderCampaignNorm));
              const contentMatch = orderContentNorm && adNameNorm && (orderContentNorm.includes(adNameNorm) || adNameNorm.includes(orderContentNorm));

              return campaignMatch || contentMatch;
            }

            // Fallback match: if the order has no specific UTM parameters but is in matchedOrders (which only contains Meta-attributed orders),
            // it means it was a general Meta/Facebook referral or click ID. We attribute it to any active ad on that day.
            return true;
          };

          item.matchedAds.forEach(ad => {
            if (!ad.dailySpendBreakdown) {
              ad.dailySpendBreakdown = [];
            }

            // Find all dates where this ad has spend recorded
            const adInsightDates = new Set(ad.dailySpendBreakdown.map(day => day.date));

            // Find all Shopify orders matched to this specific ad
            const adOrders = item.matchedOrders.filter(order => isOrderMatchedToAd(order, ad));

            // Dynamically add rows for any days where conversions occurred but there was no spend insight
            adOrders.forEach(order => {
              const orderDate = new Date(order.createdAt).toISOString().split('T')[0];
              if (!adInsightDates.has(orderDate)) {
                adInsightDates.add(orderDate);
                ad.dailySpendBreakdown.push({
                  date: orderDate,
                  spend: 0,
                  clicks: 0,
                  conversions: 0
                });
              }
            });

            // Map order conversions to each day in the timeline breakdown
            ad.dailySpendBreakdown = ad.dailySpendBreakdown.map(day => {
              const dayOrders = adOrders.filter(order => {
                const orderDate = new Date(order.createdAt).toISOString().split('T')[0];
                return orderDate === day.date;
              });

              return {
                ...day,
                shopifyConversions: dayOrders.length,
                shopifyQuantity: dayOrders.reduce((sum, o) => sum + (o.quantity || 0), 0)
              };
            });

            // Sort by date descending so the timeline is correctly ordered
            ad.dailySpendBreakdown.sort((a, b) => new Date(b.date) - new Date(a.date));
          });

          item.trueROAS = item.adSpend > 0 ? sales.revenue / item.adSpend : 0;
          item.metaAttributedROAS = item.adSpend > 0 ? item.attributedRevenue / item.adSpend : 0;

          // Compute automated gap check audits
          const warnings = [];
          let hasGap = false;
          let wastedSpend = 0;

          const stock = item.inventoryQuantity;
          const spend = item.adSpend;

          if (stock <= 0 && spend > 0) {
            hasGap = true;
            wastedSpend = spend;
            warnings.push({
              type: 'OUT_OF_STOCK',
              severity: 'HIGH',
              message: `This product is out of stock (Stock: ${stock}) but is actively spending marketing budget of ${spend.toLocaleString()} PKR.`
            });
          } else if (stock > 0 && stock < 10 && spend > 0) {
            hasGap = true;
            warnings.push({
              type: 'LOW_STOCK',
              severity: 'MEDIUM',
              message: `Low inventory level (${stock} items left). Consider reducing ad spend or replenishing stock to avoid wasted budget.`
            });
          }

          if (spend > 5000 && item.trueROAS < 1.0) {
            hasGap = true;
            warnings.push({
              type: 'LOW_ROAS',
              severity: 'HIGH',
              message: `Low ROAS (${item.trueROAS.toFixed(2)}x) with high ad spend (${spend.toLocaleString()} PKR). Consider pausing or optimizing targeting.`
            });
          }

          if (spend === 0 && sales.quantity > 10) {
            hasGap = true;
            warnings.push({
              type: 'NO_ADS_ORGANIC',
              severity: 'INFO',
              message: `This product has strong organic sales (${sales.quantity} items sold) but no marketing spend. Consider launching ad test campaigns.`
            });
          }

          item.gapChecks = {
            hasGap,
            wastedSpend,
            warnings
          };

          return item;
        })
        .filter(item => item.adSpend > 0); // Only return products with currently active, spending ad activity!

      // 8. Calculate Shopify Metrics Summary
      const validOrders = dbOrders.filter(o => o.cancelledAt === null);
      const totalRevenue = validOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
      const totalOrders = validOrders.length;
      const uniqueEmails = new Set(validOrders.map(o => o.email).filter(Boolean));
      const totalCustomers = uniqueEmails.size;
      const currency = validOrders[0]?.currency || 'PKR';

      // Meta-Attributed Shopify Orders that match the active, currently spending ads
      const activeMetaOrderIds = new Set();
      let activeMetaRevenue = 0;
      let activeMetaOrdersCount = 0;
      const activeMetaEmails = new Set();

      Object.values(salesMap).forEach(sales => {
        sales.matchedOrders.forEach(o => {
          if (!activeMetaOrderIds.has(o.orderId)) {
            activeMetaOrderIds.add(o.orderId);
            const dbOrder = dbOrders.find(dbo => dbo.orderId === o.orderId);
            if (dbOrder) {
              activeMetaRevenue += dbOrder.totalPrice || 0;
              activeMetaOrdersCount++;
              if (dbOrder.email) activeMetaEmails.add(dbOrder.email);
            }
          }
        });
      });

      const metaRevenue = activeMetaRevenue;
      const metaOrdersCount = activeMetaOrdersCount;
      const metaCustomersCount = activeMetaEmails.size;

      const shopifySummary = {
        totalRevenue,
        totalOrders,
        totalCustomers,
        currency,
        metaRevenue,
        metaOrdersCount,
        metaCustomersCount
      };

      console.log(`[Shopify API Route] Compiled performance report: products=${productPerformance.length}, alerts=${wastedBudgetAlerts.length}, totalOrders=${totalOrders}`);

      return res.json({
        success: true,
        productPerformance,
        wastedBudgetAlerts,
        shopifySummary,
        totalProductsCount: dbProducts.length,
        metaAdsCount: metaAds.length,
        unmatchedAdsCount: unmatchedAds.length,
        unmatchedAds
      });
    }

    return res.status(400).json({ error: "Invalid type parameter. Use type=products, type=orders, or type=performance" });
  } catch (error) {
    console.error("[Shopify API Route Error]", error);
    return res.status(500).json({ error: error.message || 'Failed to fetch from Shopify' });
  }
});

export default router;
