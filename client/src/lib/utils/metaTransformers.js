// ============================================
// META DATA TRANSFORMERS
// ============================================

import {
  META_STATUS_MAP,
  OBJECTIVE_MAP,
  OBJECTIVE_TYPE_MAP,
  DEFAULT_VALUES,
} from './constants.js';

// ============================================
// SAFE VALUE GETTERS
// ============================================

export function safeNumber(value, fallback = DEFAULT_VALUES.NUMBER) {
  if (value === undefined || value === null || value === '' || isNaN(value)) {
    return fallback;
  }
  return Number(value);
}

export function safeString(value, fallback = DEFAULT_VALUES.TEXT) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  return String(value);
}

export function safeCurrency(value) {
  const num = safeNumber(value);
  if (num === 0) return '$0.00';
  return `$${num.toFixed(2)}`;
}

export function safePercentage(value) {
  const num = safeNumber(value);
  if (num === 0) return '0%';
  return `${num.toFixed(2)}%`;
}

// ============================================
// ROAS CALCULATOR
// ============================================

export function calculateROAS(revenue, spend) {
  if (!spend || spend === 0) return 0;
  return revenue / spend;
}

// ============================================
// STATUS TRANSFORMERS
// ============================================

export function transformStatus(metaStatus) {
  const mapped = META_STATUS_MAP[metaStatus];
  return mapped || 'UNKNOWN';
}

// ============================================
// OBJECTIVE TRANSFORMERS
// ============================================

export function transformObjective(objective) {
  const mapped = OBJECTIVE_MAP[objective];
  return mapped || DEFAULT_VALUES.TEXT;
}

export function transformObjectiveType(objective) {
  const mapped = OBJECTIVE_TYPE_MAP[objective];
  return mapped || 'UNKNOWN';
}

// ============================================
// INSIGHTS TRANSFORMERS
// ============================================

export function transformInsights(insights) {
  if (!insights) {
    return {
      impressions: 0,
      reach: 0,
      frequency: 0,
      unique_clicks: 0,
      unique_ctr: 0,
      clicks: 0,
      link_clicks: 0,
      ctr: 0,
      inline_link_clicks: 0,
      spend: 0,
      cpc: 0,
      cpm: 0,
      cpp: 0,
      cost_per_conversion: 0,
      cost_per_action_type: [],
      conversions: 0,
      conversion_rate: 0,
      conversion_values: 0,
      actions: [],
      action_values: [],
      video_views: 0,
      video_p100_watched_actions: 0,
      video_avg_time_watched_actions: 0,
      video_play_actions: 0,
      engagement: 0,
      likes: 0,
      shares: 0,
      comments: 0,
      post_engagement: 0,
      quality_ranking: 'UNKNOWN',
      conversion_rate_ranking: 'UNKNOWN',
      date_start: '',
      date_stop: '',
    };
  }

  return {
    impressions: safeNumber(insights.impressions),
    reach: safeNumber(insights.reach),
    frequency: safeNumber(insights.frequency),
    unique_clicks: safeNumber(insights.unique_clicks),
    unique_ctr: safeNumber(insights.unique_ctr),
    clicks: safeNumber(insights.clicks),
    link_clicks: safeNumber(insights.link_clicks),
    ctr: safeNumber(insights.ctr),
    inline_link_clicks: safeNumber(insights.inline_link_clicks),
    spend: safeNumber(insights.spend),
    cpc: safeNumber(insights.cpc),
    cpm: safeNumber(insights.cpm),
    cpp: safeNumber(insights.cpp),
    cost_per_conversion: safeNumber(insights.cost_per_conversion),
    cost_per_action_type: insights.cost_per_action_type || [],
    conversions: safeNumber(insights.conversions),
    conversion_rate: safeNumber(insights.conversion_rate),
    conversion_values: safeNumber(insights.conversion_values),
    actions: insights.actions || [],
    action_values: insights.action_values || [],
    video_views: safeNumber(insights.video_views),
    video_p100_watched_actions: safeNumber(insights.video_p100_watched_actions),
    video_avg_time_watched_actions: safeNumber(insights.video_avg_time_watched_actions),
    video_play_actions: safeNumber(insights.video_play_actions),
    engagement: safeNumber(insights.engagement),
    likes: safeNumber(insights.likes),
    shares: safeNumber(insights.shares),
    comments: safeNumber(insights.comments),
    post_engagement: safeNumber(insights.post_engagement),
    quality_ranking: insights.quality_ranking || 'UNKNOWN',
    conversion_rate_ranking: insights.conversion_rate_ranking || 'UNKNOWN',
    date_start: safeString(insights.date_start),
    date_stop: safeString(insights.date_stop),
  };
}

// ============================================
// CAMPAIGN TRANSFORMER
// ============================================

export function transformCampaign(campaign, insights) {
  const transformedInsights = transformInsights(insights);
  
  const cost = transformedInsights.spend;
  const revenue = transformedInsights.conversion_values;
  const roas = calculateROAS(revenue, cost);
  
  return {
    id: campaign.id,
    name: safeString(campaign.name),
    status: transformStatus(campaign.status),
    type: transformObjectiveType(campaign.objective),
    objective: transformObjective(campaign.objective),
    clicks: transformedInsights.clicks,
    impressions: transformedInsights.impressions,
    cost: cost,
    ctr: transformedInsights.ctr,
    cpc: transformedInsights.cpc,
    conversions: transformedInsights.conversions,
    conversionValue: revenue,
    budget: campaign.daily_budget ? campaign.daily_budget / 100 : 0,
    startDate: campaign.start_time,
    endDate: campaign.stop_time,
    roas: roas,
    raw: campaign,
    insights: transformedInsights,
  };
}

// ============================================
// AD SET TRANSFORMER
// ============================================

export function transformAdSet(adSet, insights) {
  const transformedInsights = transformInsights(insights);
  
  const cost = transformedInsights.spend;
  const revenue = transformedInsights.conversion_values;
  const roas = calculateROAS(revenue, cost);
  
  // Format targeting summary
  let targetingSummary = 'All';
  if (adSet.targeting) {
    const parts = [];
    if (adSet.targeting.age_min || adSet.targeting.age_max) {
      parts.push(`Age ${adSet.targeting.age_min || 13}-${adSet.targeting.age_max || 65}+`);
    }
    if (adSet.targeting.genders && adSet.targeting.genders.length > 0) {
      parts.push(adSet.targeting.genders.join(', '));
    }
    if (adSet.targeting.geo_locations?.geo_locations?.countries) {
      parts.push(adSet.targeting.geo_locations.geo_locations.countries.join(', '));
    }
    targetingSummary = parts.length > 0 ? parts.join(' • ') : 'All';
  }
  
  console.log('🔄 Transforming ad set:', {
    id: adSet.id,
    name: adSet.name,
    campaign_id: adSet.campaignId || adSet.campaign_id,
    campaign_name: adSet.campaignName || adSet.campaign_name,
  });
  
  return {
    id: adSet.id,
    name: safeString(adSet.name),
    campaignName: safeString(adSet.campaignName || adSet.campaign_name || 'N/A'),
    campaignId: adSet.campaignId || adSet.campaign_id,
    campaignStatus: adSet.campaignStatus || adSet.campaign_status || 'UNKNOWN',
    status: transformStatus(adSet.status),
    clicks: transformedInsights.clicks,
    impressions: transformedInsights.impressions,
    cost: cost,
    ctr: transformedInsights.ctr,
    conversions: transformedInsights.conversions,
    conversionValue: revenue,
    budget: adSet.daily_budget ? adSet.daily_budget / 100 : 0,
    targeting: targetingSummary,
    optimizationGoal: safeString(adSet.optimization_goal, 'N/A'),
    startDate: adSet.start_time || adSet.startDate,
    endDate: adSet.end_time || adSet.endDate,
    roas: roas,
    raw: adSet,
    insights: transformedInsights,
  };
}

// ============================================
// AD TRANSFORMER
// ============================================

export function transformAd(ad, insights, creative) {
  const transformedInsights = transformInsights(insights);
  
  const cost = transformedInsights.spend;
  const revenue = transformedInsights.conversion_values;
  const roas = calculateROAS(revenue, cost);
  
  const callToActionStr = creative?.callToAction || creative?.call_to_action || '';
  let adType = 'DISPLAY';
  if (callToActionStr) {
    if (callToActionStr.includes('LEARN')) adType = 'VIDEO';
    else if (callToActionStr.includes('SHOP')) adType = 'SHOPPING';
    else if (callToActionStr.includes('SIGN')) adType = 'LEAD_GEN';
  }
  
  return {
    id: ad.id,
    name: safeString(ad.name),
    type: adType,
    adGroupName: safeString(ad.adGroupName || ad.adset_name || 'N/A'),
    campaignName: safeString(ad.campaignName || ad.campaign_name || 'N/A'),
    campaignStatus: ad.campaignStatus || ad.campaign_status || 'UNKNOWN',
    adSetId: ad.adSetId || ad.adset_id,
    campaignId: ad.campaignId || ad.campaign_id,
    clicks: transformedInsights.clicks,
    impressions: transformedInsights.impressions,
    cost: cost,
    ctr: transformedInsights.ctr,
    conversions: transformedInsights.conversions,
    conversionValue: revenue,
    headline: creative?.headline || DEFAULT_VALUES.TEXT,
    description: creative?.description || DEFAULT_VALUES.TEXT,
    finalUrl: creative?.finalUrl || creative?.final_url || DEFAULT_VALUES.URL,
    status: transformStatus(ad.status),
    startDate: ad.created_time || ad.createdAt,
    endDate: null,
    roas: roas,
    raw: ad,
    insights: transformedInsights,
    creative: creative || null,
  };
}

// ============================================
// BATCH TRANSFORMERS
// ============================================

export function transformCampaigns(campaigns, insightsMap) {
  if (!campaigns || campaigns.length === 0) {
    return [];
  }
  
  return campaigns.map(campaign => 
    transformCampaign(campaign, insightsMap?.[campaign.id])
  );
}

export function transformAdSets(adSets, insightsMap) {
  if (!adSets || adSets.length === 0) {
    return [];
  }
  
  return adSets.map(adSet => 
    transformAdSet(adSet, insightsMap?.[adSet.id])
  );
}

export function transformAds(ads, insightsMap, creativesMap) {
  if (!ads || ads.length === 0) {
    return [];
  }
  
  return ads.map(ad => {
    const creativeId = ad.creative?.id || ad.raw?.creative?.id;
    const creativeObj = creativesMap?.[creativeId] || creativesMap?.[ad.id] || null;
    return transformAd(ad, insightsMap?.[ad.id], creativeObj);
  });
}
