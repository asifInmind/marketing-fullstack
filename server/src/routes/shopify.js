import { Router } from 'express';

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

  try {
    if (type === 'products') {
      const url = new URL(`https://${shopDomain}/admin/api/2024-01/products.json`);
      if (page_info && page_info.length > 5) {
        url.searchParams.set('page_info', page_info);
      } else {
        url.searchParams.set('status', 'active');
      }
      url.searchParams.set('limit', limit.toString());
      
      console.log(`[Shopify API Route] Fetching products from ${url.toString()}`);
      
      const response = await fetch(url.toString(), {
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
      const linkHeader = response.headers.get('link');
      const nextPageInfo = parseLinkHeader(linkHeader);

      return res.json({
        products: data.products || [],
        nextPageInfo
      });
    }
    
    if (type === 'orders') {
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

      console.log(`[Shopify API Route] Page 1 target URL: ${nextUrl.toString()}`);

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
