import { META_API } from '../apiConstants.js';
import { callMetaApi, metaQueue } from './metaCore.js';

export const CAMPAIGN_FIELDS = [
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

export async function loadMoreCampaigns(config, after, limit = META_API.PAGE_SIZE) {
  return fetchAllCampaigns(config, after, limit);
}
