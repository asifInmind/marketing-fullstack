import { META_API } from '../apiConstants.js';
import { fetchAllCampaigns } from './campaignApi.js';
import { fetchAllAdSets } from './adSetApi.js';
import { fetchAllAds } from './adApi.js';
import { fetchAllCampaignsInsights, fetchAllAdSetsInsights, fetchAllAdsInsights } from './insightsApi.js';

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
