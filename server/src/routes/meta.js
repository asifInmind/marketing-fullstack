import { Router } from 'express';
import { 
  fetchCompleteDashboard, 
  fetchDashboardInsightsOnly, 
  loadMoreCampaigns, 
  loadMoreAdSets, 
  loadMoreAds 
} from '../lib/meta/index.js';
import Merchant from '../models/Merchant.js';
import AdMetadata from '../models/AdMetadata.js';
import DailyAdInsight from '../models/DailyAdInsight.js';
import CacheMarker from '../models/CacheMarker.js';

const router = Router();

// Helper to resolve dates
function getMetaDateRange(preset, since, until) {
  let start, end;
  if (since && until) {
    start = new Date(since);
    end = new Date(until);
  } else {
    end = new Date();
    start = new Date();
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
      default:
        start.setDate(end.getDate() - 30);
    }
  }
  // Normalize date objects to standard Start-of-Day (00:00:00) and End-of-Day (23:59:59)
  start.setUTCHours(0, 0, 0, 0);
  end.setUTCHours(23, 59, 59, 999);
  return { sinceDate: start, untilDate: end };
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
          console.log(`[Cache Manager] Found covering marker "${marker.key}" for requested range ${sinceDate.toISOString().split('T')[0]} to ${untilDate.toISOString().split('T')[0]}`);
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

  if (key.startsWith('insights_custom_')) {
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
      default:
        return null;
    }
  } else if (key.startsWith('orders_')) {
    const parts = key.replace('orders_', '').split('_');
    if (parts.length === 2 && parts[0] && parts[1]) {
      start = new Date(parts[0]);
      end = new Date(parts[1]);
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

// Helper to compile and filter Meta Insights/Metadata to ACTIVE status only
function compileMetaDashboardResponse(dbMeta, dbInsights) {
  const campaignMap = {};
  const adSetMap = {};
  const adsList = [];
  const creativesMap = {};

  dbMeta.forEach(m => {
    if (m.campaignId) {
      const existing = campaignMap[m.campaignId];
      campaignMap[m.campaignId] = {
        id: m.campaignId,
        name: m.campaignName || existing?.name || '',
        status: m.campaignStatus || existing?.status || '',
        objective: m.campaignObjective || existing?.objective || '',
        start_time: m.campaignStartDate || existing?.start_time || '',
        stop_time: m.campaignEndDate || existing?.stop_time || ''
      };
    }
    if (m.adSetId) {
      let parsedTargeting = null;
      try {
        if (m.adSetTargeting) {
          parsedTargeting = JSON.parse(m.adSetTargeting);
        }
      } catch (e) {
        parsedTargeting = m.adSetTargeting;
      }

      const existing = adSetMap[m.adSetId];
      adSetMap[m.adSetId] = {
        id: m.adSetId,
        name: m.adSetName || existing?.name || '',
        status: m.adSetStatus || existing?.status || '',
        targeting: parsedTargeting || existing?.targeting || null,
        campaignId: m.campaignId || existing?.campaignId || '',
        campaignName: m.campaignName || existing?.campaignName || '',
        start_time: m.adSetStartDate || existing?.start_time || '',
        end_time: m.adSetEndDate || existing?.end_time || ''
      };
    }

    const creative = m.creative ? {
      id: m.creative.creativeId,
      name: m.creative.creativeName,
      thumbnailUrl: m.creative.thumbnailUrl,
      body: m.creative.bodyText,
      finalUrl: m.creative.destinationUrl,
      callToAction: m.creative.callToAction,
      format: m.creative.format,
      headline: m.creative.headline,
      description: m.creative.description
    } : null;

    adsList.push({
      id: m.adId,
      name: m.adName,
      status: m.adStatus,
      campaignId: m.campaignId,
      adSetId: m.adSetId,
      campaignName: m.campaignName,
      adGroupName: m.adSetName,
      creative: creative,
      created_time: m.adCreatedTime || m.createdAt || m.lastUpdated
    });

    if (creative) {
      creativesMap[creative.id] = creative;
    }
  });

  // Back-fill campaign and adset names across objects to resolve dirty database caches
  adsList.forEach(ad => {
    if (!ad.campaignName && ad.campaignId && campaignMap[ad.campaignId]?.name) {
      ad.campaignName = campaignMap[ad.campaignId].name;
    }
    if (!ad.adGroupName && ad.adSetId && adSetMap[ad.adSetId]?.name) {
      ad.adGroupName = adSetMap[ad.adSetId].name;
    }
  });

  Object.values(adSetMap).forEach(adSet => {
    if (!adSet.campaignName && adSet.campaignId && campaignMap[adSet.campaignId]?.name) {
      adSet.campaignName = campaignMap[adSet.campaignId].name;
    }
  });

  // Aggregate daily insights by adId, campaignId, and adSetId
  const adInsights = {};
  const adSetInsights = {};
  const campaignInsights = {};

  let totalSpend = 0;
  let totalImpressions = 0;
  let totalClicks = 0;
  let totalConversions = 0;
  let totalRevenue = 0;

  dbInsights.forEach(insight => {
    const metaAd = dbMeta.find(m => m.adId === insight.adId);
    if (!metaAd) return;

    const campaignId = metaAd.campaignId;
    const adSetId = metaAd.adSetId;

    // Ad-level sum (always calculate for all ads so table rows display them)
    if (!adInsights[insight.adId]) {
      adInsights[insight.adId] = { spend: 0, impressions: 0, clicks: 0, conversions: 0, conversion_values: 0 };
    }
    adInsights[insight.adId].spend += insight.spend;
    adInsights[insight.adId].impressions += insight.impressions;
    adInsights[insight.adId].clicks += insight.clicks;
    adInsights[insight.adId].conversions += insight.conversions;
    adInsights[insight.adId].conversion_values += insight.conversionValue;

    // AdSet-level sum (always calculate for all adsets)
    if (adSetId) {
      if (!adSetInsights[adSetId]) {
        adSetInsights[adSetId] = { spend: 0, impressions: 0, clicks: 0, conversions: 0, conversion_values: 0 };
      }
      adSetInsights[adSetId].spend += insight.spend;
      adSetInsights[adSetId].impressions += insight.impressions;
      adSetInsights[adSetId].clicks += insight.clicks;
      adSetInsights[adSetId].conversions += insight.conversions;
      adSetInsights[adSetId].conversion_values += insight.conversionValue;
    }

    // Campaign-level sum (always calculate for all campaigns)
    if (campaignId) {
      if (!campaignInsights[campaignId]) {
        campaignInsights[campaignId] = { spend: 0, impressions: 0, clicks: 0, conversions: 0, conversion_values: 0 };
      }
      campaignInsights[campaignId].spend += insight.spend;
      campaignInsights[campaignId].impressions += insight.impressions;
      campaignInsights[campaignId].clicks += insight.clicks;
      campaignInsights[campaignId].conversions += insight.conversions;
      campaignInsights[campaignId].conversion_values += insight.conversionValue;
    }

    // Grand Total Sum (ONLY sum currently active campaigns/adsets/ads for Metrics Cards!)
    const isAdActive = metaAd.adStatus && metaAd.adStatus.toUpperCase() === 'ACTIVE';
    const isAdSetActive = metaAd.adSetStatus && metaAd.adSetStatus.toUpperCase() === 'ACTIVE';
    const isCampaignActive = metaAd.campaignStatus && metaAd.campaignStatus.toUpperCase() === 'ACTIVE';
    
    if (isAdActive && isAdSetActive && isCampaignActive) {
      totalSpend += insight.spend;
      totalImpressions += insight.impressions;
      totalClicks += insight.clicks;
      totalConversions += insight.conversions;
      totalRevenue += insight.conversionValue;
    }
  });

  const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const avgCPC = totalClicks > 0 ? totalSpend / totalClicks : 0;
  const avgROAS = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  const activeCampCount = Object.values(campaignMap).filter(c => c.status === 'ACTIVE').length;
  const pausedCampCount = Object.values(campaignMap).filter(c => c.status !== 'ACTIVE').length;

  return {
    campaigns: Object.values(campaignMap),
    adSets: Object.values(adSetMap),
    ads: adsList,
    campaignInsights,
    adSetInsights,
    adInsights,
    creatives: creativesMap,
    summary: {
      totalSpend,
      totalImpressions,
      totalClicks,
      totalConversions,
      totalRevenue,
      avgCTR,
      avgCPC,
      avgROAS,
      averageROAS: avgROAS,
      activeCampaigns: activeCampCount,
      pausedCampaigns: pausedCampCount
    },
    pagination: {
      campaigns: { hasMore: false },
      adSets: { hasMore: false },
      ads: { hasMore: false }
    },
    loading: false
  };
}

// GET /api/meta/debug-meta
router.get('/debug-meta', async (req, res) => {
  try {
    let accessToken = req.query.access_token;
    const accountId = req.query.account_id;
    if (!accountId) {
      return res.status(400).json({ error: "Missing account ID" });
    }

    if (!accessToken) {
      const cleanActId = accountId.startsWith('act_') ? accountId.replace('act_', '') : accountId;
      const merchant = await Merchant.findOne({
        $or: [
          { adAccountId: accountId },
          { adAccountId: cleanActId },
          { "integrations.meta.adAccountId": accountId },
          { "integrations.meta.adAccountId": `act_${accountId}` }
        ]
      });
      if (merchant && merchant.fbAccessToken) {
        accessToken = merchant.fbAccessToken;
      } else if (merchant && merchant.integrations?.meta?.accessToken) {
        accessToken = merchant.integrations.meta.accessToken;
      }
    }

    if (!accessToken) {
      return res.status(400).json({ error: "Could not find Meta access token in DB or query" });
    }
    
    const { fetchAllAds, fetchAllAdsInsights } = await import('../lib/meta/index.js');
    const config = { accessToken, accountId };
    const adsResult = await fetchAllAds(config, undefined, 150);
    const insightsResult = await fetchAllAdsInsights(config);
    
    return res.json({
      adsCount: adsResult.data?.length || 0,
      ads: adsResult.data?.map(a => ({ id: a.id, name: a.name, status: a.status, effective_status: a.effective_status })),
      insightsCount: Object.keys(insightsResult).length,
      insightsKeys: Object.keys(insightsResult)
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/meta
router.get('/', async (req, res) => {
  try {
    let accessToken = req.query.access_token;
    
    // Check Authorization header for Bearer token
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7).trim();
    }

    const accountId = req.query.account_id;
    const datePreset = req.query.date_preset || 'last_30d';
    const since = req.query.since || undefined;
    const until = req.query.until || undefined;
    const pageSize = parseInt(req.query.page_size || '10', 10);
    const type = req.query.type || 'all';

    if (!accessToken) {
      return res.status(400).json({ error: 'Missing access_token parameter' });
    }

    if (!accountId) {
      return res.status(400).json({ error: 'Missing account_id parameter' });
    }

    // Helper to sanitize shop domain name (defined locally for route safety)
    const sanitizeShopUrl = (shopUrl) => {
      let url = shopUrl.trim().toLowerCase();
      url = url.replace(/^https?:\/\//, '');
      url = url.replace(/\/$/, '');
      if (!url.includes('.')) {
        url = `${url}.myshopify.com`;
      }
      return url;
    };

    // Resolve store tenant from adAccountId or shopify_url query param
    let storeUrl = 'unknown';
    const shopifyUrlParam = req.query.shopify_url;

    if (shopifyUrlParam) {
      storeUrl = sanitizeShopUrl(shopifyUrlParam);
      // Auto-link/Upsert Meta credentials into the Merchant record
      try {
        await Merchant.findOneAndUpdate(
          { storeUrl },
          {
            storeUrl,
            adAccountId: accountId,
            fbAccessToken: accessToken,
            $set: {
              "integrations.meta.accessToken": accessToken,
              "integrations.meta.adAccountId": accountId,
              "integrations.meta.connectedAt": new Date()
            }
          },
          { upsert: true, new: true }
        );
        console.log(`[Meta API Route] Auto-linked Meta Account ${accountId} to Merchant ${storeUrl}`);
      } catch (err) {
        console.warn("[Meta API Route] Merchant auto-link update failed:", err.message);
      }
    } else {
      // Fallback: lookup by accountId
      try {
        const cleanActId = accountId.startsWith('act_') ? accountId.replace('act_', '') : accountId;
        const merchant = await Merchant.findOne({
          $or: [
            { adAccountId: accountId },
            { adAccountId: cleanActId },
            { "integrations.meta.adAccountId": accountId },
            { "integrations.meta.adAccountId": `act_${accountId}` }
          ]
        });
        if (merchant) {
          storeUrl = merchant.storeUrl;
        }
      } catch (err) {
        console.warn("[Meta API Route] Merchant DB lookup error:", err.message);
      }
    }

    const { sinceDate, untilDate } = getMetaDateRange(datePreset, since, until);

    const forceRefresh = req.query.refresh === 'true';
    // 1. Try Cache First (Skip if storeUrl is unknown or forceRefresh is true)
    if (storeUrl !== 'unknown' && !forceRefresh) {
      try {
        const cacheMarker = await findCoveringMarker(storeUrl, 'meta', sinceDate, untilDate);
        const isCacheValid = !!cacheMarker;

        if (isCacheValid) {
          const dbInsights = await DailyAdInsight.find({
            storeUrl,
            date: { $gte: sinceDate, $lte: untilDate }
          });
          const dbMeta = await AdMetadata.find({ storeUrl });
          
          // Verify that we have the structural metadata cached for all unique ads in insights
          const uniqueAdIdsInInsights = [...new Set(dbInsights.map(i => i.adId))];
          const cachedAdIds = dbMeta.map(m => m.adId);
          const hasAllStructures = uniqueAdIdsInInsights.every(adId => cachedAdIds.includes(adId));

          if (dbMeta && dbMeta.length > 0 && hasAllStructures && dbInsights.length > 0) {
            console.log(`[Meta API Route] Cache HIT: Returning filtered active structures and insights from MongoDB`);
            const payload = compileMetaDashboardResponse(dbMeta, dbInsights);
            return res.json({
              success: true,
              data: payload
            });
          }
        }
      } catch (dbErr) {
        console.warn("[Meta API Route] DB fetch failed, falling back to API:", dbErr.message);
      }
    }

    // 2. Cache MISS: Fetch from Meta live (force high pageSize of 150 to cache all active structures)
    const config = {
      accessToken,
      accountId,
      dateRange: {
        preset: datePreset,
        since,
        until,
      },
      pageSize: 150, // Retrieve and cache the entire Meta structure in MongoDB
    };

    console.log(`[Meta API Route] Cache MISS: Fetching live from Meta Graph API (forcing limit 150)...`);
    let data;
    if (type === 'structure') {
      data = await fetchCompleteDashboard(config, 150, false);
    } else if (type === 'insights') {
      data = await fetchDashboardInsightsOnly(config);
    } else {
      data = await fetchCompleteDashboard(config, 150, true);
    }

    // 3. Cache fetched data to MongoDB in background
    if (storeUrl !== 'unknown' && data) {
      const cachePromises = [];

      // A. Cache AdMetadata
      if (data.ads) {
        data.ads.forEach(ad => {
          const campaignId = ad.campaign_id || ad.campaign?.id;
          const adSetId = ad.adset_id || ad.adset?.id;
          const campaign = data.campaigns?.find(c => c.id === campaignId) || {};
          const adSet = data.adSets?.find(s => s.id === adSetId) || {};

          // Enrich the live object so the response returned to the client contains these fields
          ad.campaign_name = ad.campaign?.name || campaign.name || ad.campaign_name || '';
          ad.adset_name = ad.adset?.name || adSet.name || ad.adset_name || '';

          const creativeId = ad.creative?.id;
          const creative = creativeId ? (data.creatives?.[creativeId] || {}) : {};

          const updateObj = {
            storeUrl,
            channel: 'meta',
            campaignId: campaignId,
            campaignName: ad.campaign?.name || campaign.name || ad.campaign_name || '',
            campaignStatus: campaign.status || ad.campaign_status || '',
            campaignObjective: campaign.objective || '',
            campaignStartDate: campaign.start_time || '',
            campaignEndDate: campaign.stop_time || '',
            adSetId: adSetId,
            adSetName: ad.adset?.name || adSet.name || ad.adset_name || '',
            adSetStatus: adSet.status || ad.adset_status || '',
            adSetTargeting: adSet.targeting ? JSON.stringify(adSet.targeting) : '',
            adSetStartDate: adSet.start_time || '',
            adSetEndDate: adSet.end_time || '',
            adId: ad.id,
            adName: ad.name,
            adStatus: ad.status || '',
            adCreatedTime: ad.created_time || '',
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

      // B. Cache DailyAdInsights (normalize the storage date to midnight Start-of-Day)
      if (data.dailyInsights) {
        data.dailyInsights.forEach(ins => {
          const insightDate = new Date(ins.date_start || new Date());
          insightDate.setUTCHours(0, 0, 0, 0); // Normalize to clean daily day boundaries
          
          cachePromises.push(
            DailyAdInsight.findOneAndUpdate(
              { storeUrl, date: insightDate, adId: ins.ad_id },
              {
                storeUrl,
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

      if (type !== 'structure') {
        const markerKey = (datePreset && datePreset !== 'custom')
          ? `insights_${datePreset}`
          : `insights_custom_${since || ''}_${until || ''}`;
        cachePromises.push(
          CacheMarker.findOneAndUpdate(
            { storeUrl, channel: 'meta', key: markerKey },
            { lastUpdated: new Date() },
            { upsert: true, new: true }
          )
        );
      }
      
      try {
        await Promise.all(cachePromises);
        console.log(`[Meta API Route] Successfully cached ${cachePromises.length} Meta structures, insights, and marker in MongoDB`);
      } catch (err) {
        console.error("❌ [Meta API Route] Error caching Meta data in MongoDB:", err);
      }
    }

    const dbInsights = await DailyAdInsight.find({
      storeUrl,
      date: { $gte: sinceDate, $lte: untilDate }
    });
    const dbMeta = await AdMetadata.find({ storeUrl });
    const payload = compileMetaDashboardResponse(dbMeta, dbInsights);

    return res.json({
      success: true,
      data: payload,
    });
  } catch (error) {
    console.error('Meta API Route Error:', error);
    // Detect expired/invalid access token - return 401 so frontend can re-authenticate
    const isAuthError = error?.code === 190 || error?.type === 'OAuthException' ||
      (typeof error?.message === 'string' && (
        error.message.includes('Session has expired') ||
        error.message.includes('Invalid OAuth') ||
        error.message.includes('access token')
      ));
    if (isAuthError) {
      return res.status(401).json({
        success: false,
        error: 'Meta access token has expired. Please reconnect your Meta account.',
        code: 'TOKEN_EXPIRED',
        originalCode: error?.code,
      });
    }
    const statusCode = (error?.code === 4 || error?.code === 17) ? 429 : 500;
    return res.status(statusCode).json({
      success: false,
      error: error?.message || 'Failed to fetch Meta dashboard data',
      code: error?.code || 'UNKNOWN_ERROR',
    });
  }
});

// POST /api/meta
router.post('/', async (req, res) => {
  try {
    const { 
      accessToken, 
      accountId, 
      type, 
      after, 
      datePreset = 'last_30d',
      pageSize = 100 
    } = req.body;

    if (!accessToken || !accountId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const config = {
      accessToken,
      accountId,
      dateRange: { preset: datePreset },
      pageSize,
    };

    let result;
    switch (type) {
      case 'campaigns':
        result = await loadMoreCampaigns(config, after, pageSize);
        break;
      case 'adSets':
        result = await loadMoreAdSets(config, after, pageSize);
        break;
      case 'ads':
        result = await loadMoreAds(config, after, pageSize);
        break;
      case 'creatives':
        const { ads } = req.body;
        if (!ads) {
          return res.status(400).json({ error: 'Missing ads parameters for loading creatives' });
        }

        // Extract ad IDs from incoming structures
        const adIds = ads.map(a => typeof a === 'object' ? a.id : a).filter(Boolean);

        // 1. Try Loading from MongoDB Cache First
        try {
          const dbAds = await AdMetadata.find({ adId: { $in: adIds } });
          const cachedCreatives = {};

          dbAds.forEach(m => {
            const hasContent = m.creative?.destinationUrl || m.creative?.creativeName || m.creative?.bodyText || m.creative?.headline;
            if (m.creative && m.creative.creativeId && hasContent) {
              cachedCreatives[m.adId] = {
                id: m.creative.creativeId,
                name: m.creative.creativeName || m.creative.headline || '',
                thumbnail_url: m.creative.thumbnailUrl,
                body: m.creative.bodyText || m.creative.description || '',
                destination_url: m.creative.destinationUrl,
                url_tags: m.creative.destinationUrl,
                final_url: m.creative.destinationUrl,
                call_to_action: m.creative.callToAction,
                format: m.creative.format,
                headline: m.creative.headline || m.creative.creativeName || '',
                description: m.creative.description || m.creative.bodyText || ''
              };
            }
          });

          const missingAdIds = adIds.filter(id => !cachedCreatives[id]);

          if (missingAdIds.length === 0) {
            console.log(`[Meta API Route] Cache HIT: Returning ${Object.keys(cachedCreatives).length} creatives from MongoDB`);
            result = cachedCreatives;
            break;
          }

          console.log(`[Meta API Route] Cache PARTIAL HIT: Fetching ${missingAdIds.length} missing creatives from Meta Graph API...`);
          const { loadCreativesForAds } = await import('../lib/meta/index.js');

          const missingAdsFormat = dbAds
            .filter(m => missingAdIds.includes(m.adId))
            .map(m => ({ id: m.adId, creative: { id: m.creative?.creativeId || ads.find(a => a.id === m.adId)?.creative?.id } }))
            .filter(a => a.creative?.id);

          let liveCreatives = {};
          if (missingAdsFormat.length > 0) {
            liveCreatives = await loadCreativesForAds(missingAdsFormat, config);

            // Cache live fetched creatives in the background
            const creativePromises = Object.entries(liveCreatives).map(([adId, creative]) => {
              return AdMetadata.findOneAndUpdate(
                { adId },
                {
                  creative: {
                    creativeId: creative.id || '',
                    creativeName: creative.headline || creative.name || '',
                    thumbnailUrl: creative.thumbnail_url || creative.image_url || '',
                    bodyText: creative.description || creative.body || '',
                    destinationUrl: creative.final_url || creative.url_tags || creative.destination_url || '',
                    callToAction: creative.call_to_action || '',
                    format: creative.format || '',
                    headline: creative.headline || creative.name || '',
                    description: creative.description || creative.body || ''
                  }
                },
                { upsert: false }
              );
            });
            Promise.all(creativePromises).catch(err => console.error("Error caching creatives:", err));
          }

          result = { ...cachedCreatives, ...liveCreatives };
          break;
        } catch (dbErr) {
          console.warn("[Meta API Route] DB creatives fetch failed, falling back to API:", dbErr.message);
        }

        // 2. Fallback directly to Meta Graph API
        const { loadCreativesForAds } = await import('../lib/meta/index.js');
        result = await loadCreativesForAds(ads, config);
        break;
      default:
        return res.status(400).json({ error: 'Invalid type. Must be campaigns, adSets, ads, or creatives' });
    }

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Meta API Load More Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to load more data',
    });
  }
});

export default router;
