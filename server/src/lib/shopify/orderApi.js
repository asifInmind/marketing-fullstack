import ShopifyOrder from '../../models/ShopifyOrder.js';
import CacheMarker from '../../models/CacheMarker.js';
import Merchant from '../../models/Merchant.js';
import { SHOPIFY_API_VERSION } from './shopifyCore.js';

// Helper to make fetch requests with exponential backoff on 429 rate limit
async function fetchWithRetry(url, options, retries = 3, backoff = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : backoff * Math.pow(2, i);
        console.warn(`[Shopify API] Rate limited (429). Retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      return response;
    } catch (err) {
      if (i === retries - 1) throw err;
      const waitTime = backoff * Math.pow(2, i);
      console.warn(`[Shopify API] Fetch error: ${err.message}. Retrying in ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

const ORDERS_QUERY = `
  query getOrders($first: Int!, $after: String, $query: String) {
    orders(first: $first, after: $after, query: $query) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          name
          createdAt
          totalPriceSet {
            presentmentMoney {
              amount
              currencyCode
            }
          }
          cancelledAt
          email
          phone
          billingAddress {
            firstName
            lastName
            phone
            city
            province
            zip
            country
          }
          shippingAddress {
            firstName
            lastName
            phone
            city
            province
            zip
            country
          }
          customer {
            firstName
            lastName
            phone
          }
          customerJourneySummary {
            daysToConversion
            momentsCount {
              count
            }
            firstVisit {
              landingPage
              referrerUrl
              utmParameters {
                source
                medium
                campaign
                content
                term
              }
            }
            lastVisit {
              landingPage
              referrerUrl
              utmParameters {
                source
                medium
                campaign
                content
                term
              }
            }
          }
          lineItems(first: 50) {
            edges {
              node {
                product {
                  id
                }
                variant {
                  id
                }
                quantity
                originalUnitPriceSet {
                  presentmentMoney {
                    amount
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

export async function syncOrdersFromShopify(shopDomain, shopify_token, startDate, endDate) {
  const allOrders = [];
  const graphqlUrl = `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
  
  // Construct search query
  const queryParts = [];
  if (startDate) {
    queryParts.push(`created_at:>=${new Date(startDate).toISOString()}`);
  }
  if (endDate) {
    queryParts.push(`created_at:<=${new Date(endDate).toISOString()}`);
  }
  const queryStr = queryParts.length > 0 ? queryParts.join(' AND ') : undefined;

  let hasNextPage = true;
  let cursor = null;
  let pageCount = 1;

  console.log(`[Shopify API Route] Syncing orders live from Shopify GraphQL endpoint for ${shopDomain}`);

  while (hasNextPage && pageCount <= 10) {
    const response = await fetchWithRetry(graphqlUrl, {
      method: 'POST',
      headers: {
        "X-Shopify-Access-Token": shopify_token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query: ORDERS_QUERY,
        variables: {
          first: 50, // Grab 50 at a time to stay safe on query complexity limits
          after: cursor,
          query: queryStr
        }
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Shopify GraphQL API returned HTTP ${response.status}: ${text}`);
    }

    const resJson = await response.json();
    if (resJson.errors) {
      throw new Error(`Shopify GraphQL errors: ${JSON.stringify(resJson.errors)}`);
    }

    const connection = resJson.data?.orders;
    if (!connection) {
      break;
    }

    const edges = connection.edges || [];
    edges.forEach(edge => {
      if (edge.node) {
        allOrders.push(edge.node);
      }
    });

    hasNextPage = connection.pageInfo?.hasNextPage || false;
    cursor = connection.pageInfo?.endCursor || null;
    pageCount++;
  }

  const orderPromises = allOrders.map(order => {
    const numericId = order.id.split('/').pop();
    const landingSite = order.customerJourneySummary?.lastVisit?.landingPage || '';
    
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

    const phone = order.phone || order.billingAddress?.phone || order.shippingAddress?.phone || order.customer?.phone || '';
    const firstName = order.billingAddress?.firstName || order.customer?.firstName || order.shippingAddress?.firstName || '';
    const lastName = order.billingAddress?.lastName || order.customer?.lastName || order.shippingAddress?.lastName || '';
    const city = order.billingAddress?.city || order.shippingAddress?.city || '';
    const province = order.billingAddress?.province || order.shippingAddress?.province || '';
    const zip = order.billingAddress?.zip || order.shippingAddress?.zip || '';
    const country = order.billingAddress?.country || order.shippingAddress?.country || '';

    // Parse customer journey parameters
    const journey = order.customerJourneySummary;
    const firstVisitData = journey?.firstVisit;
    const firstUtm = firstVisitData?.utmParameters;
    const firstVisit = {
      landingPage: firstVisitData?.landingPage || '',
      referringSite: firstVisitData?.referrerUrl || '',
      utmSource: firstUtm?.source || '',
      utmMedium: firstUtm?.medium || '',
      utmCampaign: firstUtm?.campaign || '',
      utmContent: firstUtm?.content || '',
      utmTerm: firstUtm?.term || ''
    };

    const lastVisitData = journey?.lastVisit;
    const lastUtm = lastVisitData?.utmParameters;
    const lastVisit = {
      landingPage: lastVisitData?.landingPage || '',
      referringSite: lastVisitData?.referrerUrl || '',
      utmSource: lastUtm?.source || '',
      utmMedium: lastUtm?.medium || '',
      utmCampaign: lastUtm?.campaign || '',
      utmContent: lastUtm?.content || '',
      utmTerm: lastUtm?.term || ''
    };

    // Tier 2 Fallback: If parameters are missing from landingSite, check lastVisit then firstVisit
    const journeyUtm = (lastUtm?.campaign || lastUtm?.source || lastUtm?.content || lastUtm?.term) ? lastUtm : firstUtm;
    const journeySource = lastVisitData?.referrerUrl || firstVisitData?.referrerUrl || '';

    if (!utmSource) utmSource = journeyUtm?.source || journeySource || '';
    if (!utmMedium) utmMedium = journeyUtm?.medium || '';
    if (!utmCampaign) utmCampaign = journeyUtm?.campaign || '';
    if (!utmContent) utmContent = journeyUtm?.content || '';
    if (!utmTerm) utmTerm = journeyUtm?.term || '';

    // Auto-resolve numeric Meta IDs from UTM fields
    if (!campaignId && utmCampaign && /^\d+$/.test(utmCampaign.trim())) {
      campaignId = utmCampaign.trim();
    }
    if (!adSetId && utmTerm && /^\d+$/.test(utmTerm.trim())) {
      adSetId = utmTerm.trim();
    }
    if (!adId && utmContent && /^\d+$/.test(utmContent.trim())) {
      adId = utmContent.trim();
    }

    const attributionMethod = (adId || clickId) ? 'fbclid_match' : ((campaignId || adSetId || utmCampaign || utmSource) ? 'utm_match' : 'organic');

    // Convert GraphQL format to compatible format for existing backend callers
    order.id = numericId;

    return ShopifyOrder.findOneAndUpdate(
      { storeUrl: shopDomain, orderId: numericId },
      {
        storeUrl: shopDomain,
        orderId: numericId,
        orderNumber: order.name,
        createdAt: new Date(order.createdAt),
        totalPrice: parseFloat(order.totalPriceSet?.presentmentMoney?.amount || 0),
        currency: order.totalPriceSet?.presentmentMoney?.currencyCode || 'PKR',
        cancelledAt: order.cancelledAt ? new Date(order.cancelledAt) : null,
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
        referringSite: order.customerJourneySummary?.lastVisit?.referrerUrl || firstVisitData?.referrerUrl || '',
        lineItems: order.lineItems?.edges?.map(edge => {
          const li = edge.node;
          return {
            productId: li.product?.id ? li.product.id.split('/').pop() : '',
            variantId: li.variant?.id ? li.variant.id.split('/').pop() : '',
            quantity: li.quantity,
            price: parseFloat(li.originalUnitPriceSet?.presentmentMoney?.amount || 0)
          };
        }) || [],
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
          attributionMethod
        },
        customerJourney: {
          daysToConversion: journey?.daysToConversion || 0,
          momentsCount: (typeof journey?.momentsCount === 'object' ? journey?.momentsCount?.count : journey?.momentsCount) || 0,
          firstVisit,
          lastVisit
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
