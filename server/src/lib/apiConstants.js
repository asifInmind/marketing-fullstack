export const META_API = {
  VERSION: 'v19.0',
  BASE_URL: 'https://graph.facebook.com',
  MAX_RETRIES: 3,
  RATE_LIMIT_ERRORS: [4, 17],
  DEFAULT_DATE_PRESET: 'last_30d',
  PAGE_SIZE: 10,
  INSIGHTS_CHUNK_SIZE: 50,
};

const OMS_API_BASE_URL = process.env.OMS_API_BASE_URL || 'https://test-backend-production-ad06.up.railway.app/api/v1';

export const API_CONSTANTS = {
  meta: {
    auth: {
      login: (appId, redirectUri, scope) => 
        `https://www.facebook.com/${META_API.VERSION}/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&response_type=code`,
      tokenExchange: `${META_API.BASE_URL}/${META_API.VERSION}/oauth/access_token`,
      adAccounts: `${META_API.BASE_URL}/${META_API.VERSION}/me/adaccounts`,
    }
  },
  shopify: {
    getProducts: `${OMS_API_BASE_URL}/products`,
    getOrders: `${OMS_API_BASE_URL}/orders/history`,
  }
};
