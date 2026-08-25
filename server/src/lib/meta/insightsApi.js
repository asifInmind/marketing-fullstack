import { META_API } from '../apiConstants.js';
import { callMetaApi, metaQueue, delay } from './metaCore.js';

export const INSIGHTS_FIELDS_ALL = [
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

export const INSIGHTS_FIELDS_AD_DAILY = [
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

export async function fetchInsightById(id, level, config) {
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

export async function fetchInsightsBatch(ids, level, config) {
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
    
    let hasNextPage = true;
    let afterCursor = null;
    const adInsights = {};
    const dailyInsights = [];
    let pageCount = 1;

    while (hasNextPage && pageCount <= 15) {
      const currentParams = { ...params };
      if (afterCursor) {
        currentParams.after = afterCursor;
      }

      console.log(`[Meta API Pagination] Fetching ad insights page ${pageCount}...`);
      const result = await metaQueue.add(() =>
        callMetaApi(`${cleanActId}/insights`, currentParams, config)
      );

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

      if (result.paging?.cursors?.after) {
        afterCursor = result.paging.cursors.after;
        pageCount++;
      } else {
        hasNextPage = false;
      }
    }

    console.log(`✅ Fetched ${dailyInsights.length} daily ad insights for ${Object.keys(adInsights).length} ads across ${pageCount} pages`);
    return { adInsights, dailyInsights };
  } catch (error) {
    if (error?.code === 190 || error?.type === 'OAuthException') {
      throw error;
    }
    console.error('⚠️ Failed to fetch ad insights:', error);
    throw error;
  }
}
