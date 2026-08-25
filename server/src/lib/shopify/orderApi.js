import ShopifyOrder from '../../models/ShopifyOrder.js';
import CacheMarker from '../../models/CacheMarker.js';
import Merchant from '../../models/Merchant.js';
import { parseLinkHeader } from './shopifyCore.js';

export async function syncOrdersFromShopify(shopDomain, shopify_token, startDate, endDate) {
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
    let utmContent = '';
    let utmTerm = '';
    let clickId = '';
    let adId = '';
    let adSetId = '';
    let campaignId = '';

    try {
      if (landingSite) {
        const urlObj = new URL(landingSite, 'https://fallback.com');
        utmSource = urlObj.searchParams.get('utm_source') || '';
        utmMedium = urlObj.searchParams.get('utm_medium') || '';
        utmCampaign = urlObj.searchParams.get('utm_campaign') || '';
        utmContent = urlObj.searchParams.get('utm_content') || '';
        utmTerm = urlObj.searchParams.get('utm_term') || '';
        clickId = urlObj.searchParams.get('fbclid') || '';
        
        adId = urlObj.searchParams.get('ad_id') || urlObj.searchParams.get('fb_ad_id') || '';
        adSetId = urlObj.searchParams.get('adset_id') || urlObj.searchParams.get('fb_adset_id') || '';
        campaignId = urlObj.searchParams.get('campaign_id') || urlObj.searchParams.get('fb_campaign_id') || '';
      }
    } catch { }

    const phone = order.phone || order.billing_address?.phone || order.shipping_address?.phone || order.customer?.phone || '';
    const firstName = order.billing_address?.first_name || order.customer?.first_name || order.shipping_address?.first_name || '';
    const lastName = order.billing_address?.last_name || order.customer?.last_name || order.shipping_address?.last_name || '';
    const city = order.billing_address?.city || order.shipping_address?.city || '';
    const province = order.billing_address?.province || order.shipping_address?.province || '';
    const zip = order.billing_address?.zip || order.shipping_address?.zip || '';
    const country = order.billing_address?.country || order.shipping_address?.country || '';

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
        customerInfo: {
          phone,
          firstName,
          lastName,
          city,
          province,
          zip,
          country
        },
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
          utmContent,
          utmTerm,
          clickId,
          adId,
          adSetId,
          campaignId,
          attributionMethod: adId ? 'fbclid_match' : (clickId ? 'fbclid_match' : (utmSource ? 'utm_match' : 'organic'))
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

  // Trigger background Meta Conversions API dispatch (non-blocking)
  (async () => {
    try {
      const merchant = await Merchant.findOne({ storeUrl: shopDomain });
      if (merchant) {
        const savedOrders = await ShopifyOrder.find({
          storeUrl: shopDomain,
          orderId: { $in: allOrders.map(o => o.id.toString()) }
        });
        const { sendOrdersToMetaCapi } = await import('../meta/index.js');
        await sendOrdersToMetaCapi(merchant, savedOrders);
      }
    } catch (err) {
      console.error('[Shopify Sync] CAPI background trigger error:', err.message);
    }
  })();

  return allOrders;
}
