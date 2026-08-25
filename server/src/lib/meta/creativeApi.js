import { callMetaApi, metaQueue, delay } from './metaCore.js';

export const CREATIVE_FIELDS = [
  'id',
  'name',
  'body',
  'object_story_spec{link_data{link,message,name,description,call_to_action},video_data{image_url,message,call_to_action},template_data{link,message,name}}',
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
            const videoData = creative.object_story_spec?.video_data || {};
            const templateData = creative.object_story_spec?.template_data || {};

            const headlineText = linkData.name || videoData.call_to_action?.value?.title || templateData.name || creative.name || 'N/A';
            const bodyText = linkData.message || videoData.message || templateData.message || creative.body || 'N/A';
            const finalLink = linkData.link || videoData.call_to_action?.value?.link || templateData.link || 'N/A';

            creativeMap[id] = {
              id: creative.id,
              headline: headlineText,
              description: bodyText,
              final_url: finalLink,
              call_to_action: linkData.call_to_action?.type || videoData.call_to_action?.type || 'N/A',
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
