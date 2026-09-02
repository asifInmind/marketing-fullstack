/**
 * Parser and extractor for Shopify customerJourneySummary and UTM/Meta attribution data.
 */

/**
 * Extracts and normalizes UTM parameters, click IDs, Meta IDs, and visit metrics from a Shopify Order.
 * 
 * @param {Object} order - Shopify GraphQL Order node or REST Order object
 * @returns {{
 *   landingSite: string,
 *   referringSite: string,
 *   attribution: {
 *     utmSource: string,
 *     utmMedium: string,
 *     utmCampaign: string,
 *     utmContent: string,
 *     utmTerm: string,
 *     clickId: string,
 *     adId: string,
 *     adSetId: string,
 *     campaignId: string,
 *     attributionMethod: string
 *   },
 *   customerJourney: {
 *     daysToConversion: number,
 *     momentsCount: number,
 *     firstVisit: Object,
 *     lastVisit: Object
 *   }
 * }}
 */
export function parseCustomerJourneySummary(order) {
  const journey = order.customerJourneySummary;
  const firstVisitData = journey?.firstVisit;
  const lastVisitData = journey?.lastVisit;

  const firstUtm = firstVisitData?.utmParameters;
  const lastUtm = lastVisitData?.utmParameters;

  const landingSite = lastVisitData?.landingPage || order.landingSite || '';

  let utmSource = '';
  let utmMedium = '';
  let utmCampaign = '';
  let utmContent = '';
  let utmTerm = '';
  let clickId = '';
  let adId = '';
  let adSetId = '';
  let campaignId = '';

  // 1. Primary Extraction: Try extracting from landingSite URL query parameters
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

  // 2. Structured visit summaries
  const firstVisit = {
    landingPage: firstVisitData?.landingPage || '',
    referringSite: firstVisitData?.referrerUrl || '',
    utmSource: firstUtm?.source || '',
    utmMedium: firstUtm?.medium || '',
    utmCampaign: firstUtm?.campaign || '',
    utmContent: firstUtm?.content || '',
    utmTerm: firstUtm?.term || ''
  };

  const lastVisit = {
    landingPage: lastVisitData?.landingPage || '',
    referringSite: lastVisitData?.referrerUrl || '',
    utmSource: lastUtm?.source || '',
    utmMedium: lastUtm?.medium || '',
    utmCampaign: lastUtm?.campaign || '',
    utmContent: lastUtm?.content || '',
    utmTerm: lastUtm?.term || ''
  };

  // 3. Fallback: If parameters are missing from landingSite, check lastVisit then firstVisit
  const journeyUtm = (lastUtm?.campaign || lastUtm?.source || lastUtm?.content || lastUtm?.term) ? lastUtm : firstUtm;
  const journeySource = lastVisitData?.referrerUrl || firstVisitData?.referrerUrl || '';

  if (!utmSource) utmSource = journeyUtm?.source || journeySource || '';
  if (!utmMedium) utmMedium = journeyUtm?.medium || '';
  if (!utmCampaign) utmCampaign = journeyUtm?.campaign || '';
  if (!utmContent) utmContent = journeyUtm?.content || '';
  if (!utmTerm) utmTerm = journeyUtm?.term || '';

  // 4. Auto-resolve numeric Meta IDs from UTM fields if not directly set
  if (!campaignId && utmCampaign && /^\d+$/.test(utmCampaign.trim())) {
    campaignId = utmCampaign.trim();
  }
  if (!adSetId && utmTerm && /^\d+$/.test(utmTerm.trim())) {
    adSetId = utmTerm.trim();
  }
  if (!adId && utmContent && /^\d+$/.test(utmContent.trim())) {
    adId = utmContent.trim();
  }

  // 5. Determine attribution method
  const attributionMethod = (adId || clickId)
    ? 'fbclid_match'
    : ((campaignId || adSetId || utmCampaign || utmSource) ? 'utm_match' : 'organic');

  const referringSite = lastVisitData?.referrerUrl || firstVisitData?.referrerUrl || order.referringSite || '';

  const customerJourney = {
    daysToConversion: journey?.daysToConversion || 0,
    momentsCount: (typeof journey?.momentsCount === 'object' ? journey?.momentsCount?.count : journey?.momentsCount) || 0,
    firstVisit,
    lastVisit
  };

  const attribution = {
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
  };

  return {
    landingSite,
    referringSite,
    attribution,
    customerJourney
  };
}
