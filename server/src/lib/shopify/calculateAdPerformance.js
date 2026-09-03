import ShopifyOrder from '../../models/ShopifyOrder.js';
import AdMetadata from '../../models/AdMetadata.js';
import DailyAdInsight from '../../models/DailyAdInsight.js';

/**
 * Aggregates and calculates ad-level ROAS, matched Shopify sales, daily breakdown, and KPIs.
 */
export async function calculateAdPerformance({ shopDomain, adId, startDate, endDate, currencyCode = 'PKR' }) {
  // 1. Resolve dates
  let sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - 30);
  let untilDate = new Date();

  if (startDate) sinceDate = new Date(startDate);
  if (endDate) untilDate = new Date(endDate);

  sinceDate.setUTCHours(0, 0, 0, 0);
  untilDate.setUTCHours(23, 59, 59, 999);

  // 2. Load Meta structures, insights, and Shopify orders
  const dbMeta = await AdMetadata.find({ storeUrl: shopDomain, adId });

  const adName = dbMeta[0]?.adName || 'N/A';
  const adStatus = dbMeta[0]?.adStatus || 'UNKNOWN';

  const dbInsights = await DailyAdInsight.find({
    storeUrl: shopDomain,
    adId: adId,
    date: { $gte: sinceDate, $lte: untilDate }
  });

  const dbOrders = await ShopifyOrder.find({
    storeUrl: shopDomain,
    createdAt: { $gte: sinceDate, $lte: untilDate }
  });

  // 3. Aggregate ad-level Meta metrics
  let totalSpend = 0;
  let totalClicks = 0;
  let totalImpressions = 0;
  let totalConversions = 0;
  let totalRevenue = 0;

  dbInsights.forEach(ins => {
    totalSpend += ins.spend || 0;
    totalClicks += ins.clicks || 0;
    totalImpressions += ins.impressions || 0;
    totalConversions += ins.conversions || 0;
    totalRevenue += ins.conversionValue || 0;
  });

  // 4. Find matched Shopify orders for this ad
  const normalizeStr = (str) => {
    try {
      return decodeURIComponent(str || '').toLowerCase().replace(/[\s\-_]/g, '');
    } catch {
      return (str || '').toLowerCase().replace(/[\s\-_]/g, '');
    }
  };

  const targetAdNameNorm = normalizeStr(adName);

  const matchedOrders = [];
  let shopifyRevenue = 0;

  dbOrders.forEach(o => {
    if (o.cancelledAt !== null && o.cancelledAt !== undefined) return;

    let isMatched = false;
    let orderSource = (o.attribution?.utmSource || '').trim();
    let orderClickId = (o.attribution?.clickId || '').trim();
    let orderAdId = (o.attribution?.adId || '').trim();
    let orderAdSetId = (o.attribution?.adSetId || '').trim();
    let orderCampaignId = (o.attribution?.campaignId || '').trim();
    let orderCampaignName = (o.attribution?.utmCampaign || '').trim();
    let orderContent = (o.attribution?.utmContent || '').trim();
    let orderTerm = (o.attribution?.utmTerm || '').trim();

    // Fallback parsing from landingSite URL
    if (o.landingSite) {
      try {
        const url = new URL(o.landingSite, 'https://fallback.com');
        if (!orderSource) orderSource = (url.searchParams.get('utm_source') || '').trim();
        if (!orderClickId) orderClickId = (url.searchParams.get('fbclid') || '').trim();
        if (!orderCampaignName) orderCampaignName = (url.searchParams.get('utm_campaign') || '').trim();
        if (!orderContent) orderContent = (url.searchParams.get('utm_content') || '').trim();
        if (!orderTerm) orderTerm = (url.searchParams.get('utm_term') || '').trim();
        if (!orderAdId) orderAdId = url.searchParams.get('ad_id') || url.searchParams.get('fb_ad_id') || '';
        if (!orderAdSetId) orderAdSetId = url.searchParams.get('adset_id') || url.searchParams.get('fb_adset_id') || '';
        if (!orderCampaignId) orderCampaignId = url.searchParams.get('campaign_id') || url.searchParams.get('fb_campaign_id') || '';
      } catch { }
    }

    // Tier 2 Fallback: parsing from customerJourney (lastVisit then firstVisit)
    const journey = o.customerJourney;
    const lastVisit = journey?.lastVisit;
    const firstVisit = journey?.firstVisit;
    const journeyUtm = (lastVisit?.utmCampaign || lastVisit?.utmSource || lastVisit?.utmContent || lastVisit?.utmTerm) ? lastVisit : firstVisit;

    if (journeyUtm) {
      if (!orderSource) orderSource = (journeyUtm.utmSource || journeyUtm.referringSite || '').trim();
      if (!orderCampaignName) orderCampaignName = (journeyUtm.utmCampaign || '').trim();
      if (!orderContent) orderContent = (journeyUtm.utmContent || '').trim();
      if (!orderTerm) orderTerm = (journeyUtm.utmTerm || '').trim();
    }

    if (!orderCampaignId && orderCampaignName && /^\d+$/.test(orderCampaignName)) {
      orderCampaignId = orderCampaignName;
    }
    if (!orderAdSetId && orderTerm && /^\d+$/.test(orderTerm)) {
      orderAdSetId = orderTerm;
    }
    if (!orderAdId && orderContent && /^\d+$/.test(orderContent)) {
      orderAdId = orderContent;
    }

    const orderContentNorm = normalizeStr(orderContent);
    const orderTermNorm = normalizeStr(orderTerm);

    // Guard clause: If the order explicitly specifies a different ad ID, ad set ID, or campaign ID, skip matching it
    const orderAId = orderAdId || (orderContent && /^\d+$/.test(orderContent) ? orderContent : null);
    if (orderAId && orderAId !== adId) {
      return;
    }
    const adSetId = dbMeta[0]?.adSetId;
    const orderAsId = orderAdSetId || (orderTerm && /^\d+$/.test(orderTerm) ? orderTerm : null);
    if (adSetId && orderAsId && orderAsId !== adSetId) {
      return;
    }
    const campaignId = dbMeta[0]?.campaignId;
    const orderCampId = orderCampaignId || (orderCampaignName && /^\d+$/.test(orderCampaignName) ? orderCampaignName : null);
    if (campaignId && orderCampId && orderCampId !== campaignId) {
      return;
    }

    // 1. Direct ID matching (accurate)
    if (orderAdId && adId === orderAdId) {
      isMatched = true;
    }
    // 1.5. UTM parameters containing raw IDs (e.g. utm_content={{ad.id}} or utm_term={{ad.id}})
    else if (orderContent && orderContent.trim() === adId) {
      isMatched = true;
    } else if (orderTerm && orderTerm.trim() === adId) {
      isMatched = true;
    }
    // 2. Fuzzy Ad name matching (using utm_content/utm_term as typical for ad level)
    else if (targetAdNameNorm && orderContentNorm && (orderContentNorm.includes(targetAdNameNorm) || targetAdNameNorm.includes(orderContentNorm))) {
      isMatched = true;
    } else if (targetAdNameNorm && orderTermNorm && (orderTermNorm.includes(targetAdNameNorm) || targetAdNameNorm.includes(orderTermNorm))) {
      isMatched = true;
    }

    if (isMatched) {
      const orderPrice = o.totalPrice || 0;
      shopifyRevenue += orderPrice;
      matchedOrders.push({
        orderId: o.orderId,
        orderNumber: o.orderNumber || o.name || '',
        createdAt: o.createdAt,
        email: o.email || '—',
        totalPrice: orderPrice,
        customerInfo: o.customerInfo || {},
        utmSource: o.attribution?.utmSource || '',
        utmCampaign: orderCampaignName || o.attribution?.campaignId || o.attribution?.utmCampaign || '',
        utmContent: orderContent || o.attribution?.adId || o.attribution?.utmContent || '',
        utmTerm: orderTerm || o.attribution?.adSetId || o.attribution?.utmTerm || '',
        campaignId: o.attribution?.campaignId || orderCampaignId || '',
        adSetId: o.attribution?.adSetId || orderAdSetId || '',
        adId: o.attribution?.adId || orderAdId || '',
        clickId: o.attribution?.clickId || '',
        lineItems: o.lineItems?.map(li => ({
          product_id: li.productId,
          variant_id: li.variantId,
          quantity: li.quantity,
          price: li.price
        })) || []
      });
    }
  });

  // Sort matched orders by date descending
  matchedOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // 5. Aggregate Daily spend & Shopify conversion breakdown
  const dailyMap = {};

  // Initialize map with daily insights dates
  dbInsights.forEach(ins => {
    const dateStr = ins.date.toISOString().split('T')[0];
    if (!dailyMap[dateStr]) {
      dailyMap[dateStr] = { date: dateStr, spend: 0, clicks: 0, conversions: 0, metaRevenue: 0, shopifyConversions: 0, shopifyRevenue: 0 };
    }
    dailyMap[dateStr].spend += ins.spend || 0;
    dailyMap[dateStr].clicks += ins.clicks || 0;
    dailyMap[dateStr].conversions += ins.conversions || 0;
    dailyMap[dateStr].metaRevenue += ins.conversionValue || 0;
  });

  // Map matched orders to daily breakdown
  matchedOrders.forEach(o => {
    const dateStr = new Date(o.createdAt).toISOString().split('T')[0];
    if (!dailyMap[dateStr]) {
      dailyMap[dateStr] = { date: dateStr, spend: 0, clicks: 0, conversions: 0, metaRevenue: 0, shopifyConversions: 0, shopifyRevenue: 0 };
    }
    dailyMap[dateStr].shopifyConversions++;
    dailyMap[dateStr].shopifyRevenue += o.totalPrice;
  });

  const dailySpendBreakdown = Object.values(dailyMap).sort((a, b) => new Date(b.date) - new Date(a.date));

  const trueROAS = totalSpend > 0 ? shopifyRevenue / totalSpend : 0;
  const metaROAS = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  return {
    adId,
    adName,
    adStatus,
    metaSpend: totalSpend,
    metaClicks: totalClicks,
    metaImpressions: totalImpressions,
    metaConversions: totalConversions,
    metaRevenue: totalRevenue,
    shopifyRevenue,
    shopifyConversions: matchedOrders.length,
    trueROAS,
    metaROAS,
    matchedOrders,
    dailySpendBreakdown
  };
}
