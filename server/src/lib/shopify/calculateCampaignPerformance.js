import ShopifyOrder from '../../models/ShopifyOrder.js';
import AdMetadata from '../../models/AdMetadata.js';
import DailyAdInsight from '../../models/DailyAdInsight.js';

// Aggregates and calculates campaign-level ROAS, matched Shopify sales, daily breakdown, and health alerts.
export async function calculateCampaignPerformance({ shopDomain, campaignId, startDate, endDate, currencyCode = 'PKR' }) {
  // 1. Resolve dates
  let sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - 30);
  let untilDate = new Date();

  if (startDate) sinceDate = new Date(startDate);
  if (endDate) untilDate = new Date(endDate);

  sinceDate.setUTCHours(0, 0, 0, 0);
  untilDate.setUTCHours(23, 59, 59, 999);

  // 2. Load Meta structures, insights, and Shopify orders
  const dbMeta = await AdMetadata.find({ storeUrl: shopDomain, campaignId });


  const adIds = dbMeta.map(m => m.adId).filter(Boolean);
  const adSetIds = Array.from(new Set(dbMeta.map(m => m.adSetId).filter(Boolean)));
  const adNames = dbMeta.map(m => m.adName || '').filter(Boolean);
  const adSetNames = Array.from(new Set(dbMeta.map(m => m.adSetName || '').filter(Boolean)));

  const dbInsights = await DailyAdInsight.find({
    storeUrl: shopDomain,
    adId: { $in: adIds },
    date: { $gte: sinceDate, $lte: untilDate }
  });

  const dbOrders = await ShopifyOrder.find({
    storeUrl: shopDomain,
    createdAt: { $gte: sinceDate, $lte: untilDate }
  });

  // 3. Aggregate campaign-level Meta metrics
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

  const campaignName = dbMeta[0]?.campaignName || 'N/A';
  const campaignStatus = dbMeta[0]?.campaignStatus || 'UNKNOWN';

  // 4. Find matched Shopify orders for this campaign
  const normalizeStr = (str) => {
    try {
      return decodeURIComponent(str || '').toLowerCase().replace(/[\s\-_]/g, '');
    } catch {
      return (str || '').toLowerCase().replace(/[\s\-_]/g, '');
    }
  };
  const targetCampaignNorm = normalizeStr(campaignName);
  const normalizedAdNames = adNames.map(name => normalizeStr(name)).filter(Boolean);
  const normalizedAdSetNames = adSetNames.map(name => normalizeStr(name)).filter(Boolean);



  const matchedOrders = [];
  let shopifyRevenue = 0;

  dbOrders.forEach(o => {
    if (o.cancelledAt !== null) return;

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

    const orderCampaignNorm = normalizeStr(orderCampaignName);
    const orderContentNorm = normalizeStr(orderContent);
    const orderTermNorm = normalizeStr(orderTerm);

    // Guard clause: If the order explicitly specifies a different campaign ID, do not match it to this campaign
    const orderCampId = orderCampaignId || (orderCampaignName && /^\d+$/.test(orderCampaignName) ? orderCampaignName : null);
    if (orderCampId && orderCampId !== campaignId) {
      return;
    }

    // 1. Direct ID matching (accurate)
    if (orderCampaignId && campaignId === orderCampaignId) {
      isMatched = true;
    } else if (orderAdId && adIds.includes(orderAdId)) {
      isMatched = true;
    } else if (orderAdSetId && adSetIds.includes(orderAdSetId)) {
      isMatched = true;
    }
    // 1.5. UTM parameters containing raw IDs (e.g. utm_campaign={{campaign.id}} parameters)
    else if (orderCampaignName && orderCampaignName.trim() === campaignId) {
      isMatched = true;
    } else if (orderContent && adIds.includes(orderContent.trim())) {
      isMatched = true;
    } else if (orderTerm && adSetIds.includes(orderTerm.trim())) {
      isMatched = true;
    }
    // 2. Fuzzy Campaign name matching
    else if (targetCampaignNorm && orderCampaignNorm && (orderCampaignNorm.includes(targetCampaignNorm) || targetCampaignNorm.includes(orderCampaignNorm))) {
      isMatched = true;
    }
    // 3. Fuzzy Ad / Ad Set name matching
    else if (orderContentNorm && normalizedAdNames.some(an => orderContentNorm.includes(an) || an.includes(orderContentNorm))) {
      isMatched = true;
    }
    else if (orderTermNorm && normalizedAdSetNames.some(asn => orderTermNorm.includes(asn) || asn.includes(orderTermNorm))) {
      isMatched = true;
    }

    const isMetaSource = (o.attribution?.utmSource || '').toLowerCase().includes('fac') ||
      (o.attribution?.utmSource || '').toLowerCase().includes('fb') ||
      (o.landingSite || '').toLowerCase().includes('fbclid') ||
      (o.landingSite || '').toLowerCase().includes('utm_source=fac') ||
      (o.landingSite || '').toLowerCase().includes('utm_source=fb');



    if (isMatched) {
      // Find line items price sum
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
        clickId: o.attribution?.clickId || ''
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
      dailyMap[dateStr] = { date: dateStr, spend: 0, clicks: 0, conversions: 0, shopifyConversions: 0, shopifyRevenue: 0 };
    }
    dailyMap[dateStr].spend += ins.spend || 0;
    dailyMap[dateStr].clicks += ins.clicks || 0;
    dailyMap[dateStr].conversions += ins.conversions || 0;
  });

  // Map matched orders to daily breakdown
  matchedOrders.forEach(o => {
    const dateStr = new Date(o.createdAt).toISOString().split('T')[0];
    if (!dailyMap[dateStr]) {
      dailyMap[dateStr] = { date: dateStr, spend: 0, clicks: 0, conversions: 0, shopifyConversions: 0, shopifyRevenue: 0 };
    }
    dailyMap[dateStr].shopifyConversions++;
    dailyMap[dateStr].shopifyRevenue += o.totalPrice;
  });

  const dailySpendBreakdown = Object.values(dailyMap).sort((a, b) => new Date(b.date) - new Date(a.date));

  // 6. Generate health checks / warnings
  const warnings = [];
  let hasGap = false;
  let wastedSpend = 0;

  const trueROAS = totalSpend > 0 ? shopifyRevenue / totalSpend : 0;
  const metaROAS = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  if (totalSpend > 5000 && trueROAS < 1.0) {
    hasGap = true;
    wastedSpend = totalSpend;
    warnings.push({
      type: 'LOW_ROAS',
      severity: 'HIGH',
      message: `Low ROAS (${trueROAS.toFixed(2)}x) with high campaign spend (${formatCurrencyLabel(totalSpend, currencyCode)}). Consider pausing or optimizing targeting.`
    });
  }

  return {
    campaignId,
    campaignName,
    campaignStatus,
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
    dailySpendBreakdown,
    gapChecks: {
      hasGap,
      wastedSpend,
      warnings
    }
  };
}

function formatCurrencyLabel(amount, currencyCode) {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
    }).format(amount);
  } catch {
    return `${currencyCode} ${amount.toFixed(2)}`;
  }
}
