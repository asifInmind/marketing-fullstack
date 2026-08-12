import { META_API } from './apiConstants.js';

// Add delay between requests
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Queue for managing concurrent requests
class RequestQueue {
  constructor(concurrency = 2, delayMs = 1500) {
    this.queue = [];
    this.processing = false;
    this.concurrency = concurrency;
    this.delayMs = delayMs;
  }

  async add(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.process();
    });
  }

  async process() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.concurrency);
      await Promise.all(batch.map(async (fn) => {
        await fn();
        await delay(this.delayMs);
      }));
    }

    this.processing = false;
  }
}

// Create a singleton queue for Meta API calls
const metaQueue = new RequestQueue(2, 1500); // 2 concurrent, 1.5 second delay

// ============================================
// CORE UTILITIES
// ============================================

function buildUrl(endpoint, params) {
  const base = `${META_API.BASE_URL}/${META_API.VERSION}/${endpoint}`;
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (typeof value === 'object') {
        searchParams.append(key, JSON.stringify(value));
      } else {
        searchParams.append(key, String(value));
      }
    }
  });

  return `${base}?${searchParams.toString()}`;
}

async function retryWithBackoff(fn, retries = 2, delayTime = 1500) {
  try {
    return await fn();
  } catch (error) {
    const isRateLimit = META_API.RATE_LIMIT_ERRORS.includes(error?.code) ||
      error?.message?.includes('too many calls') ||
      error?.message?.includes('rate limit');

    if (retries > 0 && isRateLimit) {
      const backoffDelay = Math.min(delayTime * Math.pow(2, 2 - retries), 4000);
      console.warn(`⏳ Rate limit hit. Retrying in ${backoffDelay}ms... (${retries} attempts left)`);

      await new Promise(resolve => setTimeout(resolve, backoffDelay));
      return retryWithBackoff(fn, retries - 1, delayTime);
    }

    throw error;
  }
}

function extractInsightsFields(insights) {
  if (!insights) return insights;

  // Parse numbers
  insights.spend = parseFloat(insights.spend || 0);
  insights.impressions = parseInt(insights.impressions || 0, 10);
  insights.clicks = parseInt(insights.clicks || 0, 10);
  insights.reach = parseInt(insights.reach || 0, 10);
  insights.frequency = parseFloat(insights.frequency || 0);
  insights.ctr = parseFloat(insights.ctr || 0);
  insights.cpc = parseFloat(insights.cpc || 0);
  insights.cpm = parseFloat(insights.cpm || 0);
  insights.cpp = parseFloat(insights.cpp || 0);

  const actions = insights.actions || [];
  const actionValues = insights.action_values || [];

  // 1. Extract link_clicks
  const linkClickAction = actions.find(a => a.action_type === 'link_click');
  insights.link_clicks = linkClickAction ? parseInt(linkClickAction.value, 10) : 0;

  // 2. Extract conversions (purchases)
  const purchaseAction = actions.find(a => a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase');
  insights.conversions = purchaseAction ? parseInt(purchaseAction.value, 10) : 0;

  // 3. Extract conversion_values
  const purchaseValueAction = actionValues.find(a => a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase');
  insights.conversion_values = purchaseValueAction ? parseFloat(purchaseValueAction.value) : 0;

  // 4. Extract likes, comments, shares, engagement
  const likeAction = actions.find(a => a.action_type === 'like');
  insights.likes = likeAction ? parseInt(likeAction.value, 10) : 0;

  const commentAction = actions.find(a => a.action_type === 'comment');
  insights.comments = commentAction ? parseInt(commentAction.value, 10) : 0;

  const shareAction = actions.find(a => a.action_type === 'share');
  insights.shares = shareAction ? parseInt(shareAction.value, 10) : 0;

  const postEngagementAction = actions.find(a => a.action_type === 'post_engagement');
  insights.engagement = postEngagementAction ? parseInt(postEngagementAction.value, 10) : 0;

  // 5. Extract video_views
  const videoPlayAction = actions.find(a => a.action_type === 'video_view' || a.action_type === 'video_play');
  insights.video_views = videoPlayAction ? parseInt(videoPlayAction.value, 10) : 0;

  // 6. Compute conversion_rate
  const clicks = parseInt(insights.clicks || 0, 10);
  insights.conversion_rate = clicks > 0 ? (insights.conversions / clicks) * 100 : 0;

  return insights;
}

async function callMetaApi(endpoint, params, config) {
  const url = buildUrl(endpoint, {
    ...params,
    access_token: config.accessToken
  });

  return retryWithBackoff(async () => {
    const response = await fetch(url);
    const json = await response.json();

    if (json.error) {
      throw {
        message: json.error.error_user_msg || json.error.message,
        code: json.error.code,
        type: json.error.type,
        error: json.error
      };
    }

    // Process insights responses to dynamically parse actions and action_values
    if (endpoint.endsWith('/insights') || endpoint.includes('/insights')) {
      if (json.data && Array.isArray(json.data)) {
        json.data = json.data.map(extractInsightsFields);
      }
    }

    return json;
  });
}

// ============================================
// ENRICH AD SETS WITH CAMPAIGN NAMES
// ============================================

async function enrichAdSetsWithCampaignNames(adSets, config) {
  if (adSets.length === 0) return adSets;

  const campaignIds = [...new Set(adSets.map(adSet => adSet.campaign_id))];

  console.log(`📡 Fetching campaign names for ${campaignIds.length} campaigns in bulk...`);

  const campaignMap = {};
  const chunkSize = 50;

  for (let i = 0; i < campaignIds.length; i += chunkSize) {
    const chunk = campaignIds.slice(i, i + chunkSize);

    try {
      const result = await metaQueue.add(() =>
        callMetaApi(
          '',
          {
            ids: chunk.join(','),
            fields: 'name'
          },
          config
        )
      );

      if (result) {
        Object.entries(result).forEach(([id, campaignObj]) => {
          if (campaignObj && campaignObj.name) {
            campaignMap[id] = campaignObj.name;
          }
        });
      }
    } catch (err) {
      console.warn(`⚠️ Failed to fetch bulk campaign names for chunk starting at index ${i}:`, err);
    }

    if (i + chunkSize < campaignIds.length) {
      await delay(500);
    }
  }

  console.log(`✅ Found campaign names for ${Object.keys(campaignMap).length} campaigns`);

  return adSets.map(adSet => ({
    ...adSet,
    campaign_name: campaignMap[adSet.campaign_id] || 'Unknown Campaign'
  }));
}

// ============================================
// FIELD DEFINITIONS
// ============================================

const CAMPAIGN_FIELDS = [
  'id',
  'name',
  'objective',
  'status',
  'effective_status',
  'daily_budget',
  'lifetime_budget',
  'budget_remaining',
  'start_time',
  'stop_time',
  'created_time',
  'updated_time',
  'buying_type',
  'special_ad_categories',
  'spend_cap',
  'bid_strategy',
  'configured_status'
].join(',');

const ADSET_FIELDS = [
  'id',
  'name',
  'campaign_id',
  'status',
  'effective_status',
  'daily_budget',
  'lifetime_budget',
  'budget_remaining',
  'start_time',
  'end_time',
  'bid_strategy',
  'optimization_goal',
  'billing_event',
  'targeting',
  'created_time',
  'updated_time'
].join(',');

const AD_FIELDS = [
  'id',
  'name',
  'adset_id',
  'campaign_id',
  'status',
  'effective_status',
  'creative',
  'created_time',
  'updated_time'
].join(',');

const INSIGHTS_FIELDS_ALL = [
  'campaign_id',
  'campaign_name',
  'adset_id',
  'adset_name',
  'ad_id',
  'ad_name',
  'impressions',
  'reach',
  'frequency',
  'unique_clicks',
  'unique_ctr',
  'clicks',
  'ctr',
  'inline_link_clicks',
  'spend',
  'cpc',
  'cpm',
  'cpp',
  'cost_per_action_type',
  'actions',
  'action_values',
  'video_p100_watched_actions',
  'video_avg_time_watched_actions',
  'video_play_actions',
  'video_p75_watched_actions',
  'video_p50_watched_actions',
  'post_engagement',
  'quality_ranking',
  'conversion_rate_ranking',
  'date_start',
  'date_stop'
].join(',');

const INSIGHTS_FIELDS_AD_DAILY = [
  'ad_id',
  'ad_name',
  'spend',
  'impressions',
  'clicks',
  'actions',
  'action_values',
  'date_start',
  'date_stop'
].join(',');

// ============================================
// 1. CAMPAIGN FUNCTIONS
// ============================================

export async function fetchAllCampaigns(config, after, limit = META_API.PAGE_SIZE) {
  const cleanActId = config.accountId.startsWith('act_')
    ? config.accountId
    : `act_${config.accountId}`;

  const params = {
    fields: CAMPAIGN_FIELDS,
    limit: limit
  };

  if (after) {
    params.after = after;
  }

  return metaQueue.add(() =>
    callMetaApi(`${cleanActId}/campaigns`, params, config)
  );
}

// ============================================
// 2. AD SET FUNCTIONS
// ============================================

export async function fetchAllAdSets(config, after, limit = META_API.PAGE_SIZE) {
  const cleanActId = config.accountId.startsWith('act_')
    ? config.accountId
    : `act_${config.accountId}`;

  const params = {
    fields: ADSET_FIELDS,
    limit: limit
  };

  if (after) {
    params.after = after;
  }

  const result = await metaQueue.add(() =>
    callMetaApi(`${cleanActId}/adsets`, params, config)
  );

  if (result.data && result.data.length > 0) {
    result.data = await enrichAdSetsWithCampaignNames(result.data, config);
  }

  return result;
}

// ============================================
// 3. AD FUNCTIONS
// ============================================

export async function fetchAllAds(config, after, limit = META_API.PAGE_SIZE) {
  const cleanActId = config.accountId.startsWith('act_')
    ? config.accountId
    : `act_${config.accountId}`;

  const params = {
    fields: AD_FIELDS,
    limit: limit
  };

  if (after) {
    params.after = after;
  }

  return metaQueue.add(() =>
    callMetaApi(`${cleanActId}/ads`, params, config)
  );
}

// ============================================
// 4. CREATIVE FUNCTIONS (LAZY LOAD)
// ============================================

const CREATIVE_FIELDS = [
  'id',
  'name',
  'object_story_spec{link_data{link,message,name,description,call_to_action}}',
  'image_url',
  'thumbnail_url'
].join(',');

export async function fetchCreativeById(creativeId, config) {
  const params = {
    fields: CREATIVE_FIELDS
  };

  return metaQueue.add(() =>
    callMetaApi(creativeId, params, config)
  );
}

export async function fetchCreativesBatch(creativeIds, config) {
  const creativeMap = {};

  const uniqueCreativeIds = [...new Set(creativeIds.filter(Boolean))];

  if (uniqueCreativeIds.length === 0) {
    return creativeMap;
  }

  console.log(`🔄 Fetching ${uniqueCreativeIds.length} unique creatives in bulk...`);

  const chunkSize = 50;
  for (let i = 0; i < uniqueCreativeIds.length; i += chunkSize) {
    const chunk = uniqueCreativeIds.slice(i, i + chunkSize);

    try {
      const result = await metaQueue.add(() =>
        callMetaApi(
          '',
          {
            ids: chunk.join(','),
            fields: CREATIVE_FIELDS
          },
          config
        )
      );

      if (result) {
        Object.entries(result).forEach(([id, creative]) => {
          if (creative) {
            const linkData = creative.object_story_spec?.link_data || {};

            creativeMap[id] = {
              id: creative.id,
              headline: linkData.name || 'N/A',
              description: linkData.message || 'N/A',
              final_url: linkData.link || 'N/A',
              call_to_action: linkData.call_to_action?.type || 'N/A',
              image_url: creative.image_url || '',
              thumbnail_url: creative.thumbnail_url || '',
              fullCreative: creative
            };
          }
        });
      }
    } catch (err) {
      console.warn(`⚠️ Failed to fetch bulk creatives for chunk starting at index ${i}:`, err);
    }

    if (i + chunkSize < uniqueCreativeIds.length) {
      await delay(500);
    }
  }

  console.log(`✅ Fetched ${Object.keys(creativeMap).length} creatives in bulk`);
  return creativeMap;
}

// ============================================
// 5. INSIGHTS FUNCTIONS
// ============================================

async function fetchInsightById(id, level, config) {
  const dateRange = config.dateRange || { preset: META_API.DEFAULT_DATE_PRESET };

  const params = {
    fields: INSIGHTS_FIELDS_ALL,
    level: level
  };

  if (dateRange.since && dateRange.until) {
    params.time_range = { since: dateRange.since, until: dateRange.until };
  } else {
    params.date_preset = dateRange.preset || META_API.DEFAULT_DATE_PRESET;
  }

  try {
    const result = await metaQueue.add(() =>
      callMetaApi(`${id}/insights`, params, config)
    );
    return result.data?.[0] || null;
  } catch (error) {
    console.warn(`⚠️ Failed to fetch insights for ${level} ${id}:`, error);
    return null;
  }
}

async function fetchInsightsBatch(ids, level, config) {
  const insightsMap = {};

  if (ids.length === 0) {
    return insightsMap;
  }

  console.log(`🔄 Fetching insights for ${ids.length} ${level}s...`);

  const chunkSize = 10;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);

    console.log(`📡 Processing insights batch ${i / chunkSize + 1}/${Math.ceil(ids.length / chunkSize)}...`);

    const promises = chunk.map(id =>
      fetchInsightById(id, level, config)
    );

    const results = await Promise.all(promises);
    results.forEach((insight, index) => {
      if (insight) {
        const id = chunk[index];
        insightsMap[id] = insight;
      }
    });

    if (i + chunkSize < ids.length) {
      console.log(`⏳ Waiting 2 seconds before next insights batch...`);
      await delay(2000);
    }
  }

  console.log(`✅ Fetched ${Object.keys(insightsMap).length} insights for ${level}s`);
  return insightsMap;
}

export async function fetchAllCampaignsInsights(config) {
  const cleanActId = config.accountId.startsWith('act_')
    ? config.accountId
    : `act_${config.accountId}`;

  const dateRange = config.dateRange || { preset: META_API.DEFAULT_DATE_PRESET };

  const params = {
    fields: INSIGHTS_FIELDS_ALL,
    level: 'campaign'
  };

  if (dateRange.since && dateRange.until) {
    params.time_range = { since: dateRange.since, until: dateRange.until };
  } else {
    params.date_preset = dateRange.preset || META_API.DEFAULT_DATE_PRESET;
  }

  try {
    console.log(`📡 Fetching all campaign insights...`);
    const result = await metaQueue.add(() =>
      callMetaApi(`${cleanActId}/insights`, params, config)
    );

    const insightsMap = {};
    result.data.forEach(insight => {
      if (insight.campaign_id) {
        insightsMap[insight.campaign_id] = insight;
      }
    });
    console.log(`✅ Fetched ${Object.keys(insightsMap).length} campaign insights`);
    return insightsMap;
  } catch (error) {
    // Re-throw auth errors (expired token, invalid token) so route can return 401
    if (error?.code === 190 || error?.type === 'OAuthException') {
      throw error;
    }
    console.warn('⚠️ Failed to fetch campaign insights:', error);
    return {};
  }
}

export async function fetchAllAdSetsInsights(config) {
  const cleanActId = config.accountId.startsWith('act_')
    ? config.accountId
    : `act_${config.accountId}`;

  const dateRange = config.dateRange || { preset: META_API.DEFAULT_DATE_PRESET };

  const params = {
    fields: INSIGHTS_FIELDS_ALL,
    level: 'adset',
    limit: 150
  };

  if (dateRange.since && dateRange.until) {
    params.time_range = { since: dateRange.since, until: dateRange.until };
  } else {
    params.date_preset = dateRange.preset || META_API.DEFAULT_DATE_PRESET;
  }

  try {
    console.log(`📡 Fetching all adset insights...`);
    const result = await metaQueue.add(() =>
      callMetaApi(`${cleanActId}/insights`, params, config)
    );

    const insightsMap = {};
    result.data?.forEach(insight => {
      if (insight.adset_id) {
        insightsMap[insight.adset_id] = insight;
      }
    });
    console.log(`✅ Fetched ${Object.keys(insightsMap).length} adset insights`);
    return insightsMap;
  } catch (error) {
    // Re-throw auth errors (expired token, invalid token) so route can return 401
    if (error?.code === 190 || error?.type === 'OAuthException') {
      throw error;
    }
    console.warn('⚠️ Failed to fetch adset insights:', error);
    return {};
  }
}

export async function fetchAllAdsInsights(config) {
  const cleanActId = config.accountId.startsWith('act_')
    ? config.accountId
    : `act_${config.accountId}`;

  const dateRange = config.dateRange || { preset: META_API.DEFAULT_DATE_PRESET };

  const params = {
    fields: INSIGHTS_FIELDS_AD_DAILY,
    level: 'ad',
    limit: 150,
    time_increment: 1 // Fetch daily breakdown for MongoDB caching
  };

  if (dateRange.since && dateRange.until) {
    params.time_range = { since: dateRange.since, until: dateRange.until };
  } else {
    params.date_preset = dateRange.preset || META_API.DEFAULT_DATE_PRESET;
  }

  try {
    console.log(`📡 Fetching all ad insights with daily breakdown...`);
    const result = await metaQueue.add(() =>
      callMetaApi(`${cleanActId}/insights`, params, config)
    );

    const adInsights = {};
    const dailyInsights = [];

    result.data?.forEach(insight => {
      if (insight.ad_id) {
        dailyInsights.push(insight);

        if (!adInsights[insight.ad_id]) {
          adInsights[insight.ad_id] = {
            ad_id: insight.ad_id,
            ad_name: insight.ad_name,
            spend: 0,
            impressions: 0,
            clicks: 0,
            conversions: 0,
            conversion_values: 0,
            date_start: insight.date_start,
            date_stop: insight.date_stop
          };
        }

        adInsights[insight.ad_id].spend += parseFloat(insight.spend || 0);
        adInsights[insight.ad_id].impressions += parseInt(insight.impressions || 0, 10);
        adInsights[insight.ad_id].clicks += parseInt(insight.clicks || 0, 10);
        adInsights[insight.ad_id].conversions += parseInt(insight.conversions || 0, 10);
        adInsights[insight.ad_id].conversion_values += parseFloat(insight.conversion_values || 0);
      }
    });

    console.log(`✅ Fetched ${dailyInsights.length} daily ad insights for ${Object.keys(adInsights).length} ads`);
    return { adInsights, dailyInsights };
  } catch (error) {
    // Re-throw auth errors (expired token, invalid token) so route can return 401
    if (error?.code === 190 || error?.type === 'OAuthException') {
      throw error;
    }
    console.error('⚠️ Failed to fetch ad insights:', error);
    throw error;
  }
}

// ============================================
// 6. LOAD MORE FUNCTIONS
// ============================================

export async function loadMoreCampaigns(config, after, limit = META_API.PAGE_SIZE) {
  return fetchAllCampaigns(config, after, limit);
}

export async function loadMoreAdSets(config, after, limit = META_API.PAGE_SIZE) {
  return fetchAllAdSets(config, after, limit);
}

export async function loadMoreAds(config, after, limit = META_API.PAGE_SIZE) {
  return fetchAllAds(config, after, limit);
}

// ============================================
// 7. LAZY LOAD CREATIVES FOR ADS
// ============================================

export async function loadCreativesForAds(ads, config) {
  if (ads.length === 0) {
    return {};
  }

  console.log(`🔄 Loading creatives for ${ads.length} ads...`);

  const creativeIds = ads.map(ad => ad.creative?.id).filter(Boolean);
  const adCreativeMap = {};

  if (creativeIds.length === 0) {
    console.log('ℹ️ No creative IDs found for ads');
    return {};
  }

  const creativeMap = await fetchCreativesBatch(creativeIds, config);

  ads.forEach(ad => {
    if (ad.creative?.id && creativeMap[ad.creative.id]) {
      adCreativeMap[ad.id] = creativeMap[ad.creative.id];
    }
  });

  console.log(`✅ Loaded creatives for ${Object.keys(adCreativeMap).length} ads`);
  return adCreativeMap;
}

// ============================================
// 8. COMPLETE DASHBOARD DATA
// ============================================

export async function fetchCompleteDashboard(config, pageSize = META_API.PAGE_SIZE, includeInsights = true) {
  const loadingState = {
    campaigns: true,
    adSets: true,
    ads: true,
    insights: true,
    creatives: false,
  };

  const errors = {};

  try {
    console.log('🔄 Starting dashboard fetch with rate limiting...');
    console.log('📡 Fetching campaigns, ad sets, ads...');

    const [campaignsResult, adSetsResult, adsResult] = await Promise.all([
      fetchAllCampaigns(config, undefined, pageSize),
      fetchAllAdSets(config, undefined, pageSize),
      fetchAllAds(config, undefined, pageSize)
    ]);

    console.log(`✅ Fetched: ${campaignsResult.data.length} campaigns, ${adSetsResult.data.length} ad sets, ${adsResult.data.length} ads`);

    loadingState.campaigns = false;
    loadingState.adSets = false;
    loadingState.ads = false;

    let campaignInsights = {};
    let adSetInsights = {};
    let adInsights = {};
    let dailyInsights = [];

    let totalSpend = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalConversions = 0;
    let totalRevenue = 0;
    let avgCTR = 0;
    let avgCPC = 0;
    let avgROAS = 0;

    if (includeInsights) {
      console.log(`📡 Fetching insights for campaigns, ad sets, ads...`);

      const [campaignsResult, adSetsResult, adsInsightsResult] = await Promise.all([
        fetchAllCampaignsInsights(config),
        fetchAllAdSetsInsights(config),
        fetchAllAdsInsights(config)
      ]);

      campaignInsights = campaignsResult;
      adSetInsights = adSetsResult;
      adInsights = adsInsightsResult.adInsights;
      dailyInsights = adsInsightsResult.dailyInsights;

      console.log(`✅ Insights fetched: ${Object.keys(campaignInsights).length} campaigns, ${Object.keys(adSetInsights).length} ad sets, ${Object.keys(adInsights).length} ads`);

      loadingState.insights = false;

      const allInsights = Object.values(campaignInsights);
      totalSpend = allInsights.reduce((sum, i) => sum + parseFloat(i.spend || 0), 0);
      totalImpressions = allInsights.reduce((sum, i) => sum + parseInt(i.impressions || 0, 10), 0);
      totalClicks = allInsights.reduce((sum, i) => sum + parseInt(i.clicks || 0, 10), 0);
      totalConversions = allInsights.reduce((sum, i) => sum + parseInt(i.conversions || 0, 10), 0);
      totalRevenue = allInsights.reduce((sum, i) => sum + parseFloat(i.conversion_values || 0), 0);

      avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
      avgCPC = totalClicks > 0 ? totalSpend / totalClicks : 0;
      avgROAS = totalSpend > 0 ? totalRevenue / totalSpend : 0;
    }

    const activeCampaigns = campaignsResult.data.filter(c => c.status === 'ACTIVE').length;
    const pausedCampaigns = campaignsResult.data.filter(c => c.status === 'PAUSED').length;

    return {
      campaigns: campaignsResult.data,
      adSets: adSetsResult.data,
      ads: adsResult.data,
      campaignInsights,
      adSetInsights,
      adInsights,
      dailyInsights,
      creatives: {},
      summary: {
        totalCampaigns: campaignsResult.data.length,
        totalAdSets: adSetsResult.data.length,
        totalAds: adsResult.data.length,
        totalSpend,
        totalImpressions,
        totalClicks,
        totalConversions,
        totalRevenue,
        avgCTR,
        avgCPC,
        avgROAS,
        averageROAS: avgROAS,
        activeCampaigns,
        pausedCampaigns
      },
      pagination: {
        campaigns: {
          hasMore: !!campaignsResult.paging?.next,
          after: campaignsResult.paging?.cursors?.after
        },
        adSets: {
          hasMore: !!adSetsResult.paging?.next,
          after: adSetsResult.paging?.cursors?.after
        },
        ads: {
          hasMore: !!adsResult.paging?.next,
          after: adsResult.paging?.cursors?.after
        }
      },
      loading: loadingState,
      errors: errors
    };
  } catch (error) {
    console.error('❌ Dashboard fetch error:', error);
    throw error;
  }
}

export async function fetchDashboardInsightsOnly(config) {
  try {
    console.log('📡 Progressive load: Fetching insights only...');

    const [campaignsResult, adSetsResult, adsInsightsResult] = await Promise.all([
      fetchAllCampaignsInsights(config),
      fetchAllAdSetsInsights(config),
      fetchAllAdsInsights(config)
    ]);

    const campaignInsights = campaignsResult;
    const adSetInsights = adSetsResult;
    const adInsights = adsInsightsResult.adInsights;
    const dailyInsights = adsInsightsResult.dailyInsights;

    const allInsights = Object.values(campaignInsights);
    const totalSpend = allInsights.reduce((sum, i) => sum + parseFloat(i.spend || 0), 0);
    const totalImpressions = allInsights.reduce((sum, i) => sum + parseInt(i.impressions || 0, 10), 0);
    const totalClicks = allInsights.reduce((sum, i) => sum + parseInt(i.clicks || 0, 10), 0);
    const totalConversions = allInsights.reduce((sum, i) => sum + parseInt(i.conversions || 0, 10), 0);
    const totalRevenue = allInsights.reduce((sum, i) => sum + parseFloat(i.conversion_values || 0), 0);

    const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const avgCPC = totalClicks > 0 ? totalSpend / totalClicks : 0;
    const avgROAS = totalSpend > 0 ? totalRevenue / totalSpend : 0;

    return {
      campaignInsights,
      adSetInsights,
      adInsights,
      dailyInsights,
      summary: {
        totalSpend,
        totalImpressions,
        totalClicks,
        totalConversions,
        totalRevenue,
        avgCTR,
        avgCPC,
        avgROAS,
        averageROAS: avgROAS
      }
    };
  } catch (error) {
    console.error('❌ Failed to fetch insights progressively:', error);
    throw error;
  }
}
