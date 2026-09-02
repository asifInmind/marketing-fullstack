import { META_API } from '../apiConstants.js';
import { callMetaApi, metaQueue, delay } from './metaCore.js';

export const ADSET_FIELDS = [
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

export async function enrichAdSetsWithCampaignNames(adSets, config) {
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
            fields: 'name,status,effective_status'
          },
          config
        )
      );

      if (result) {
        Object.entries(result).forEach(([id, campaignObj]) => {
          if (campaignObj) {
            campaignMap[id] = {
              name: campaignObj.name || '',
              status: campaignObj.status || '',
              effective_status: campaignObj.effective_status || ''
            };
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
    campaign_name: campaignMap[adSet.campaign_id]?.name || 'Unknown Campaign',
    campaign_status: campaignMap[adSet.campaign_id]?.status || ''
  }));
}

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

export async function loadMoreAdSets(config, after, limit = META_API.PAGE_SIZE) {
  return fetchAllAdSets(config, after, limit);
}
