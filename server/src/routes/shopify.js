import { Router } from 'express';
import ShopifyProduct from '../models/ShopifyProduct.js';
import ShopifyOrder from '../models/ShopifyOrder.js';
import Merchant from '../models/Merchant.js';
import AdMetadata from '../models/AdMetadata.js';
import DailyAdInsight from '../models/DailyAdInsight.js';
import CacheMarker from '../models/CacheMarker.js';

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
    // Key format: orders_YYYY-MM-DD_YYYY-MM-DD
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

// GET /api/shopify/debug-db
router.get('/debug-db', async (req, res) => {
  try {
    const adMetadataCount = await AdMetadata.countDocuments();
    const insightsCount = await DailyAdInsight.countDocuments();
    const productsCount = await ShopifyProduct.countDocuments();
    const ordersCount = await ShopifyOrder.countDocuments();
    const merchantCount = await Merchant.countDocuments();
    const markerCount = await CacheMarker.countDocuments();

    // Get date boundaries
    const earliestInsight = await DailyAdInsight.findOne({}).sort({ date: 1 });
    const latestInsight = await DailyAdInsight.findOne({}).sort({ date: -1 });

    const earliestOrder = await ShopifyOrder.findOne({}).sort({ createdAt: 1 });
    const latestOrder = await ShopifyOrder.findOne({}).sort({ createdAt: -1 });

    // Group insights by date
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

    // Group orders by date
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
      ordersDistribution: ordersByDate.slice(0, 30), // first 30 days
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
      message: "Cleared all creatives in AdMetadata. The next dashboard refresh will download all 150 creatives live and log the debug info!"
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
  const shopify_token = req.query.shopify_token || req.query.oms_token; // support fallback
  const shopify_url = req.query.shopify_url;
  const limit = safeParseInt(req.query.limit, 25);
  const page_info = req.query.page_info || req.query.page; // support page_info from pagination
  const startDate = req.query.start_date;
  const endDate = req.query.end_date;

  console.log(`[Shopify API Route] Date range query: type=${type}, start_date=${startDate}, end_date=${endDate}`);

  if (!shopify_token) {
    return res.status(400).json({ error: 'Missing Shopify access token' });
  }
  if (!shopify_url) {
    return res.status(400).json({ error: 'Missing Shopify store URL/domain' });
  }

  const shopDomain = sanitizeShopUrl(shopify_url);

  // Auto-link/Upsert Merchant record in MongoDB
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
      // 1. Try Cache First
      if (!forceRefresh) {
        try {
          const dbProducts = await ShopifyProduct.find({ storeUrl: shopDomain });
          if (dbProducts && dbProducts.length > 0) {
            console.log(`[Shopify API Route] Cache HIT: Returning ${dbProducts.length} products from MongoDB`);
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
                inventory_quantity: v.inventoryQuantity
              })) || []
            }));
            return res.json({
              products: formattedProducts,
              nextPageInfo: null
            });
          }
        } catch (dbErr) {
          console.warn("[Shopify API Route] DB product fetch failed, falling back to API:", dbErr.message);
        }
      }

      // 2. Cache MISS: Fetch all products from Shopify live using cursor pagination
      let allProducts = [];
      let nextUrl = new URL(`https://${shopDomain}/admin/api/2024-01/products.json`);
      nextUrl.searchParams.set('status', 'active');
      nextUrl.searchParams.set('limit', '250');

      console.log(`[Shopify API Route] Cache MISS: Fetching products live starting from ${nextUrl.toString()}`);

      let hasNextPage = true;
      let pageCount = 1;

      while (hasNextPage && pageCount <= 10) { // Safety cap of 2,500 products (10 pages)
        console.log(`[Shopify API Route] Fetching products page ${pageCount}: ${nextUrl.toString()}`);
        const response = await fetch(nextUrl.toString(), {
          headers: {
            "X-Shopify-Access-Token": shopify_token,
            "Content-Type": "application/json"
          }
        });

        if (!response.ok) {
          const text = await response.text();
          return res.status(response.status).json({ error: `Shopify API returned: ${text}` });
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

      console.log(`[Shopify API Route] Successfully fetched ${allProducts.length} products total across ${pageCount} pages`);

      // Cache products in the database in the background
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
                inventoryQuantity: v.inventory_quantity
              })) || []
            },
            { upsert: true, new: true }
          );
        });

        Promise.all(productPromises)
          .then(() => console.log(`[Shopify API Route] Cached ${allProducts.length} products in MongoDB`))
          .catch(err => console.error("Error caching products:", err));
      }

      return res.json({
        products: allProducts,
        nextPageInfo: null
      });
    }
    
    // --- TYPE: ORDERS ---
    if (type === 'orders') {
      const forceRefresh = req.query.refresh === 'true';
      // 1. Try Cache First
      if (!forceRefresh && startDate && endDate) {
        try {
          const cacheMarker = await findCoveringMarker(shopDomain, 'shopify', new Date(startDate), new Date(endDate));
          const isCacheValid = !!cacheMarker;

          if (isCacheValid) {
            const query = {
              storeUrl: shopDomain,
              createdAt: {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
              }
            };
            const dbOrders = await ShopifyOrder.find(query);
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
        } catch (dbErr) {
          console.warn("[Shopify API Route] DB order fetch failed, falling back to API:", dbErr.message);
        }
      }

      // 2. Fallback to live Shopify API
      let allOrders = [];
      let nextUrl = new URL(`https://${shopDomain}/admin/api/2024-01/orders.json`);
      nextUrl.searchParams.set('status', 'any');
      nextUrl.searchParams.set('limit', '250');
      
      if (startDate) {
        try {
          nextUrl.searchParams.set('created_at_min', new Date(startDate).toISOString());
        } catch {}
      }
      if (endDate) {
        try {
          nextUrl.searchParams.set('created_at_max', new Date(endDate).toISOString());
        } catch {}
      }

      console.log(`[Shopify API Route] Cache MISS: Fetching orders live from ${nextUrl.toString()}`);

      let hasNextPage = true;
      let pageCount = 1;

      while (hasNextPage && pageCount <= 10) {
        console.log(`[Shopify API Route] Fetching orders page ${pageCount}: ${nextUrl.toString()}`);
        const response = await fetch(nextUrl.toString(), {
          headers: {
            "X-Shopify-Access-Token": shopify_token,
            "Content-Type": "application/json"
          }
        });

        if (!response.ok) {
          const text = await response.text();
          return res.status(response.status).json({ error: `Shopify API returned: ${text}` });
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

      // Cache orders to database in the background
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
        } catch {}

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
              adId: '', // Matches ad ID in background mappings later
              attributionMethod: clickId ? 'fbclid_match' : (utmSource ? 'utm_match' : 'organic')
            }
          },
          { upsert: true, new: true }
        );
      });

      const markerKey = `orders_${startDate?.split('T')[0] || ''}_${endDate?.split('T')[0] || ''}`;
      const markerPromise = CacheMarker.findOneAndUpdate(
        { storeUrl: shopDomain, channel: 'shopify', key: markerKey },
        { lastUpdated: new Date() },
        { upsert: true, new: true }
      );

      Promise.all([...orderPromises, markerPromise])
        .then(() => console.log(`[Shopify API Route] Cached ${allOrders.length} orders and marker in MongoDB`))
        .catch(err => console.error("Error caching orders and marker:", err));

      console.log(`[Shopify API Route] Successfully fetched ${allOrders.length} orders total across ${pageCount} pages`);
      return res.json({
        orders: allOrders,
        nextPageInfo: null
      });
    }

    return res.status(400).json({ error: "Invalid type parameter. Use type=products or type=orders" });
  } catch (error) {
    console.error("[Shopify API Route Error]", error);
    return res.status(500).json({ error: error.message || 'Failed to fetch from Shopify' });
  }
});

export default router;
