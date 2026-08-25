import { META_API } from '../apiConstants.js';

// Add delay between requests
export const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Queue for managing concurrent requests
export class RequestQueue {
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
export const metaQueue = new RequestQueue(2, 1500); // 2 concurrent, 1.5 second delay

export function buildUrl(endpoint, params) {
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

export async function retryWithBackoff(fn, retries = 2, delayTime = 1500) {
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

export function extractInsightsFields(insights) {
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

export async function callMetaApi(endpoint, params, config) {
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
