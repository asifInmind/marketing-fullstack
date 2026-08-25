import { META_API } from '../apiConstants.js';
import { callMetaApi, metaQueue } from './metaCore.js';

export const AD_FIELDS = [
  'id',
  'name',
  'adset_id',
  'campaign_id',
  'campaign{id,name}',
  'adset{id,name}',
  'status',
  'effective_status',
  'creative',
  'created_time',
  'updated_time'
].join(',');

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

export async function loadMoreAds(config, after, limit = META_API.PAGE_SIZE) {
  return fetchAllAds(config, after, limit);
}
