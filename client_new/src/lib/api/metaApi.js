// ============================================
// COMPLETE META API INTEGRATION
// ============================================

import { META_API } from '../utils/constants';

// ============================================
// RATE LIMITING UTILITIES
// ============================================

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

function buildUrl(
  endpoint,
  params
) {
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

async function retryWithBackoff(
  fn,
  retries = 5,
  delay = 2000
) {
  try {
    return await fn();
  } catch (error) {
    const isRateLimit = META_API.RATE_LIMIT_ERRORS.includes(error?.code) || 
                        error?.message?.includes('too many calls') ||
                        error?.message?.includes('rate limit');
    
    if (retries > 0 && isRateLimit) {
      const backoffDelay = delay * Math.pow(2, META_API.MAX_RETRIES - retries + 1);
      console.warn(`⏳ Rate limit hit. Retrying in ${backoffDelay}ms... (${retries} attempts left)`);
      
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
      return retryWithBackoff(fn, retries - 1, delay * 2);
    }
    
    throw error;
  }
}

async function callMetaApi(
  endpoint,
  params,
  config
) {
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
    
    return json;
  });
}

// ============================================
// ENRICH AD SETS WITH CAMPAIGN NAMES
// ============================================

async function enrichAdSetsWithCampaignNames(
  adSets,
  config
) {
  if (adSets.length === 0) return adSets;
  
  // Get unique campaign IDs
  const campaignIds = [...new Set(adSets.map(adSet => adSet.campaign_id))];
  
  console.log(`📡 Fetching campaign names for ${campaignIds.length} campaigns...`);
  
  // Fetch campaign names in batches
  const campaignMap = {};
  const chunkSize = 20;
  
  for (let i = 0; i < campaignIds.length; i += chunkSize) {
    const chunk = campaignIds.slice(i, i + chunkSize);
    
    const promises = chunk.map(async (campaignId) => {
      try {
        // Fetch just the campaign name
        const result = await metaQueue.add(() =>
          callMetaApi(
            campaignId,
            { fields: 'name' },
            config
          )
        );
        return { id: campaignId, name: result.name };
      } catch {
        return { id: campaignId, name: undefined };
      }
    });
    
    const results = await Promise.all(promises);
    results.forEach(({ id, name }) => {
      if (name) {
        campaignMap[id] = name;
      }
    });
    
    if (i + chunkSize < campaignIds.length) {
      await delay(500);
    }
  }
  
  console.log(`✅ Found campaign names for ${Object.keys(campaignMap).length} campaigns`);
  
  // Enrich ad sets with campaign names
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
  // 'campaign_name',
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
  'created_time', 
  'updated_time'
].join(',');

const INSIGHTS_FIELDS_ALL = [
  // Identity
  'campaign_id', 
  'campaign_name', 
  'adset_id', 
  'adset_name', 
  'ad_id', 
  'ad_name',
  // Reach
  'impressions', 
  'reach', 
  'frequency', 
  'unique_clicks', 
  'unique_ctr',
  // Clicks
  'clicks', 
  'link_clicks', 
  'ctr', 
  'inline_link_clicks',
  // Cost
  'spend', 
  'cpc', 
  'cpm', 
  'cpp', 
  'cost_per_conversion', 
  'cost_per_action_type',
  // Conversions
  'conversions', 
  'conversion_rate', 
  'conversion_values', 
  'actions', 
  'action_values',
  // Video
  'video_views', 
  'video_p100_watched_actions', 
  'video_avg_time_watched_actions',
  'video_play_actions', 
  'video_p75_watched_actions', 
  'video_p50_watched_actions',
  // Engagement
  'engagement', 
  'likes', 
  'shares', 
  'comments', 
  'post_engagement',
  // Quality
  'quality_ranking', 
  'conversion_rate_ranking',
  // Dates
  'date_start', 
  'date_stop'
].join(',');

// ============================================
// 1. CAMPAIGN FUNCTIONS
// ============================================

export async function fetchAllCampaigns(
  config,
  after,
  limit = META_API.PAGE_SIZE
) {
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
    callMetaApi(
      `${cleanActId}/campaigns`,
      params,
      config
    )
  );
}

// ============================================
// 2. AD SET FUNCTIONS
// ============================================

export async function fetchAllAdSets(
  config,
  after,
  limit = META_API.PAGE_SIZE
) {
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
    callMetaApi(
      `${cleanActId}/adsets`,
      params,
      config
    )
  );
  
  // ✅ ENRICH: Add campaign names
  if (result.data && result.data.length > 0) {
    result.data = await enrichAdSetsWithCampaignNames(result.data, config);
  }
  
  return result;
}

// ============================================
// 3. AD FUNCTIONS
// ============================================

export async function fetchAllAds(
  config,
  after,
  limit = META_API.PAGE_SIZE
) {
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
    callMetaApi(
      `${cleanActId}/ads`,
      params,
      config
    )
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

export async function fetchCreativeById(
  creativeId,
  config
) {
  const params = {
    fields: CREATIVE_FIELDS
  };
  
  return metaQueue.add(() => 
    callMetaApi(
      creativeId,
      params,
      config
    )
  );
}

export async function fetchCreativesBatch(
  creativeIds,
  config
) {
  const creativeMap = {};
  
  if (creativeIds.length === 0) {
    return creativeMap;
  }
  
  console.log(`🔄 Fetching ${creativeIds.length} creatives in batches...`);
  
  // Process in chunks of 5 to avoid rate limits
  const chunkSize = 5;
  for (let i = 0; i < creativeIds.length; i += chunkSize) {
    const chunk = creativeIds.slice(i, i + chunkSize);
    
    console.log(`📡 Processing creative batch ${i/chunkSize + 1}/${Math.ceil(creativeIds.length/chunkSize)}...`);
    
    const promises = chunk.map(id => 
      fetchCreativeById(id, config).catch(() => null)
    );
    
    const results = await Promise.all(promises);
    results.forEach((creative, index) => {
      if (creative) {
        const id = chunk[index];
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
    
    if (i + chunkSize < creativeIds.length) {
      console.log(`⏳ Waiting 1 second before next creative batch...`);
      await delay(1000);
    }
  }
  
  console.log(`✅ Fetched ${Object.keys(creativeMap).length} creatives`);
  return creativeMap;
}

// ============================================
// 5. INSIGHTS FUNCTIONS
// ============================================

async function fetchInsightById(
  id,
  level,
  config
) {
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
      callMetaApi(
        `${id}/insights`,
        params,
        config
      )
    );
    return result.data?.[0] || null;
  } catch (error) {
    console.warn(`⚠️ Failed to fetch insights for ${level} ${id}:`, error);
    return null;
  }
}

async function fetchInsightsBatch(
  ids,
  level,
  config
) {
  const insightsMap = {};
  
  if (ids.length === 0) {
    return insightsMap;
  }
  
  console.log(`🔄 Fetching insights for ${ids.length} ${level}s...`);
  
  // Process in chunks of 10 to avoid rate limits
  const chunkSize = 10;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    
    console.log(`📡 Processing insights batch ${i/chunkSize + 1}/${Math.ceil(ids.length/chunkSize)}...`);
    
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

export async function fetchAllCampaignsInsights(
  config
) {
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
      callMetaApi(
        `${cleanActId}/insights`,
        params,
        config
      )
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
    console.warn('⚠️ Failed to fetch campaign insights:', error);
    return {};
  }
}

export async function fetchAllAdSetsInsights(
  config
) {
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
      callMetaApi(
        `${cleanActId}/insights`,
        params,
        config
      )
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
    console.warn('⚠️ Failed to fetch adset insights:', error);
    return {};
  }
}

export async function fetchAllAdsInsights(
  config
) {
  const cleanActId = config.accountId.startsWith('act_') 
    ? config.accountId 
    : `act_${config.accountId}`;
  
  const dateRange = config.dateRange || { preset: META_API.DEFAULT_DATE_PRESET };
  
  const params = {
    fields: INSIGHTS_FIELDS_ALL,
    level: 'ad',
    limit: 150
  };
  
  if (dateRange.since && dateRange.until) {
    params.time_range = { since: dateRange.since, until: dateRange.until };
  } else {
    params.date_preset = dateRange.preset || META_API.DEFAULT_DATE_PRESET;
  }
  
  try {
    console.log(`📡 Fetching all ad insights...`);
    const result = await metaQueue.add(() => 
      callMetaApi(
        `${cleanActId}/insights`,
        params,
        config
      )
    );
    
    const insightsMap = {};
    result.data?.forEach(insight => {
      if (insight.ad_id) {
        insightsMap[insight.ad_id] = insight;
      }
    });
    console.log(`✅ Fetched ${Object.keys(insightsMap).length} ad insights`);
    return insightsMap;
  } catch (error) {
    console.warn('⚠️ Failed to fetch ad insights:', error);
    return {};
  }
}

// ============================================
// 6. LOAD MORE FUNCTIONS
// ============================================

export async function loadMoreCampaigns(
  config,
  after,
  limit = META_API.PAGE_SIZE
) {
  return fetchAllCampaigns(config, after, limit);
}

export async function loadMoreAdSets(
  config,
  after,
  limit = META_API.PAGE_SIZE
) {
  return fetchAllAdSets(config, after, limit);
}

export async function loadMoreAds(
  config,
  after,
  limit = META_API.PAGE_SIZE
) {
  return fetchAllAds(config, after, limit);
}

// ============================================
// 7. LAZY LOAD CREATIVES FOR ADS
// ============================================

export async function loadCreativesForAds(
  ads,
  config
) {
  if (ads.length === 0) {
    return {};
  }
  
  console.log(`🔄 Loading creatives for ${ads.length} ads...`);
  
  const creativeIds = [];
  const adCreativeMap = {};
  
  // Fetch creative ID for each ad in batches
  const chunkSize = 10;
  for (let i = 0; i < ads.length; i += chunkSize) {
    const chunk = ads.slice(i, i + chunkSize);
    
    const adPromises = chunk.map(async (ad) => {
      try {
        const result = await metaQueue.add(() => 
          callMetaApi(
            ad.id,
            { fields: 'creative{id}' },
            config
          )
        );
        if (result.creative?.id) {
          creativeIds.push(result.creative.id);
          return { adId: ad.id, creativeId: result.creative.id };
        }
        return null;
      } catch {
        return null;
      }
    });
    
    const adCreativePairs = await Promise.all(adPromises);
    const validPairs = adCreativePairs.filter(p => p !== null);
    
    // Map creative IDs to ad IDs
    validPairs.forEach(pair => {
      if (pair) {
        creativeIds.push(pair.creativeId);
      }
    });
    
    if (i + chunkSize < ads.length) {
      await delay(500);
    }
  }
  
  if (creativeIds.length === 0) {
    console.log('ℹ️ No creative IDs found for ads');
    return {};
  }
  
  // Fetch creative details
  const creativeMap = await fetchCreativesBatch(creativeIds, config);
  
  // Map back to ads
  // We need to rebuild the mapping since we lost the adId -> creativeId mapping
  // Re-fetch the creative IDs with ad mapping
  const allPairs = [];
  for (let i = 0; i < ads.length; i += chunkSize) {
    const chunk = ads.slice(i, i + chunkSize);
    const promises = chunk.map(async (ad) => {
      try {
        const result = await metaQueue.add(() => 
          callMetaApi(
            ad.id,
            { fields: 'creative{id}' },
            config
          )
        );
        if (result.creative?.id && creativeMap[result.creative.id]) {
          return { adId: ad.id, creativeId: result.creative.id };
        }
        return null;
      } catch {
        return null;
      }
    });
    const results = await Promise.all(promises);
    allPairs.push(...results.filter(p => p !== null));
    await delay(500);
  }
  
  allPairs.forEach(pair => {
    if (pair && creativeMap[pair.creativeId]) {
      adCreativeMap[pair.adId] = creativeMap[pair.creativeId];
    }
  });
  
  console.log(`✅ Loaded creatives for ${Object.keys(adCreativeMap).length} ads`);
  return adCreativeMap;
}

// ============================================
// 8. COMPLETE DASHBOARD DATA
// ============================================

// export async function fetchCompleteDashboard(
//   config,
//   pageSize = META_API.PAGE_SIZE,
//   includeInsights = true
// ) {
//   const loadingState = {
//     campaigns: true,
//     adSets: true,
//     ads: true,
//     insights: true, // we set to true initially, will change if loaded or skipped
//     creatives: false,
//   };
  
//   const errors = {};
  
//   try {
//     console.log('🔄 Starting dashboard fetch with rate limiting...');
    
//     // Step 1: Fetch campaigns, ad sets, and ads with rate limiting
//     console.log('📡 Fetching campaigns, ad sets, ads...');
    
//     const [campaignsResult, adSetsResult, adsResult] = await Promise.all([
//       fetchAllCampaigns(config, undefined, pageSize),
//       fetchAllAdSets(config, undefined, pageSize),
//       fetchAllAds(config, undefined, pageSize)
//     ]);
    
//     console.log(`✅ Fetched: ${campaignsResult.data.length} campaigns, ${adSetsResult.data.length} ad sets, ${adsResult.data.length} ads`);
    
//     loadingState.campaigns = false;
//     loadingState.adSets = false;
//     loadingState.ads = false;
    
//     let campaignInsights = {};
//     let adSetInsights = {};
//     let adInsights = {};
    
//     let totalSpend = 0;
//     let totalImpressions = 0;
//     let totalClicks = 0;
//     let totalConversions = 0;
//     let totalRevenue = 0;
//     let avgCTR = 0;
//     let avgCPC = 0;
//     let avgROAS = 0;
    
//     if (includeInsights) {
//       console.log(`📡 Fetching insights for campaigns, ad sets, ads...`);
      
//       [campaignInsights, adSetInsights, adInsights] = await Promise.all([
//         fetchAllCampaignsInsights(config),
//         fetchAllAdSetsInsights(config),
//         fetchAllAdsInsights(config)
//       ]);
      
//       console.log(`✅ Insights fetched: ${Object.keys(campaignInsights).length} campaigns, ${Object.keys(adSetInsights).length} ad sets, ${Object.keys(adInsights).length} ads`);
      
//       loadingState.insights = false;
      
//       // Build summary
//       const allInsights = Object.values(campaignInsights);
//       totalSpend = allInsights.reduce((sum, i) => sum + (i.spend || 0), 0);
//       totalImpressions = allInsights.reduce((sum, i) => sum + (i.impressions || 0), 0);
//       totalClicks = allInsights.reduce((sum, i) => sum + (i.clicks || 0), 0);
//       totalConversions = allInsights.reduce((sum, i) => sum + (i.conversions || 0), 0);
//       totalRevenue = allInsights.reduce((sum, i) => sum + (i.conversion_values || 0), 0);
      
//       avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
//       avgCPC = totalClicks > 0 ? totalSpend / totalClicks : 0;
//       avgROAS = totalSpend > 0 ? totalRevenue / totalSpend : 0;
//     }
    
//     const activeCampaigns = campaignsResult.data.filter(c => c.status === 'ACTIVE').length;
//     const pausedCampaigns = campaignsResult.data.filter(c => c.status === 'PAUSED').length;
    
//     return {
//       campaigns: campaignsResult.data,
//       adSets: adSetsResult.data,
//       ads: adsResult.data,
//       campaignInsights,
//       adSetInsights,
//       adInsights,
//       creatives: {},
//       summary: {
//         totalCampaigns: campaignsResult.data.length,
//         totalAdSets: adSetsResult.data.length,
//         totalAds: adsResult.data.length,
//         totalSpend,
//         totalImpressions,
//         totalClicks,
//         totalConversions,
//         totalRevenue,
//         avgCTR,
//         avgCPC,
//         avgROAS,
//         averageROAS: avgROAS,
//         activeCampaigns,
//         pausedCampaigns
//       },
//       pagination: {
//         campaigns: { 
//           hasMore: !!campaignsResult.paging?.next, 
//           after: campaignsResult.paging?.cursors?.after 
//         },
//         adSets: { 
//           hasMore: !!adSetsResult.paging?.next, 
//           after: adSetsResult.paging?.cursors?.after 
//         },
//         ads: { 
//           hasMore: !!adsResult.paging?.next, 
//           after: adsResult.paging?.cursors?.after 
//         }
//       },
//       loading: loadingState,
//       errors: errors
//     };
//   } catch (error) {
//     console.error('❌ Dashboard fetch error:', error);
    
//     // Check if it's a rate limit error
//     if (error.code === 4 || error.code === 17 || error.message?.includes('too many calls')) {
//       errors.campaigns = 'Rate limit exceeded. Please wait a moment and try again.';
//     } else {
//       errors.campaigns = error.message || 'Failed to fetch dashboard data';
//     }
    
//     return {
//       campaigns: [],
//       adSets: [],
//       ads: [],
//       campaignInsights: {},
//       adSetInsights: {},
//       adInsights: {},
//       creatives: {},
//       summary: {
//         totalCampaigns: 0,
//         totalAdSets: 0,
//         totalAds: 0,
//         totalSpend: 0,
//         totalImpressions: 0,
//         totalClicks: 0,
//         totalConversions: 0,
//         totalRevenue: 0,
//         avgCTR: 0,
//         avgCPC: 0,
//         avgROAS: 0,
//         averageROAS: 0,
//         activeCampaigns: 0,
//         pausedCampaigns: 0
//       },
//       pagination: {
//         campaigns: { hasMore: false },
//         adSets: { hasMore: false },
//         ads: { hasMore: false }
//       },
//       loading: loadingState,
//       errors: errors
//     };
//   }
// }

const META_BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL

export async function fetchCompleteDashboard(config) {
  const params = new URLSearchParams({
    account_id: config.accountId,
    shopify_url: config.shopify_url,
    date_preset: config.dateRange?.preset || 'last_30d',
  });

  console.log('params', params);
  console.log('META_BACKEND_URL', META_BACKEND_URL);
  

  if (
    config.dateRange?.preset === 'custom' &&
    config.dateRange?.since &&
    config.dateRange?.until
  ) {
    params.append('since', config.dateRange.since);
    params.append('until', config.dateRange.until);
  }

  const response = await fetch(
    `${META_BACKEND_URL}/api/meta?${params.toString()}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result?.message ||
      result?.error ||
      'Failed to fetch Meta dashboard'
    );
  }

  return result;
}

export async function fetchDashboardInsightsOnly(
  config
) {
  try {
    console.log('📡 Progressive load: Fetching insights only...');
    
    const [campaignInsights, adSetInsights, adInsights] = await Promise.all([
      fetchAllCampaignsInsights(config),
      fetchAllAdSetsInsights(config),
      fetchAllAdsInsights(config)
    ]);
    
    // Build summary
    const allInsights = Object.values(campaignInsights);
    const totalSpend = allInsights.reduce((sum, i) => sum + (i.spend || 0), 0);
    const totalImpressions = allInsights.reduce((sum, i) => sum + (i.impressions || 0), 0);
    const totalClicks = allInsights.reduce((sum, i) => sum + (i.clicks || 0), 0);
    const totalConversions = allInsights.reduce((sum, i) => sum + (i.conversions || 0), 0);
    const totalRevenue = allInsights.reduce((sum, i) => sum + (i.conversion_values || 0), 0);
    
    const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const avgCPC = totalClicks > 0 ? totalSpend / totalClicks : 0;
    const avgROAS = totalSpend > 0 ? totalRevenue / totalSpend : 0;
    
    return {
      campaignInsights,
      adSetInsights,
      adInsights,
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