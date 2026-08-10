// ============================================
// STATUS MAPPINGS
// ============================================

export const META_STATUS_MAP = {
  ACTIVE: 'ENABLED',
  PAUSED: 'PAUSED',
  DELETED: 'REMOVED',
  ARCHIVED: 'REMOVED',
  UNKNOWN: 'UNKNOWN',
};

export const DASHBOARD_STATUS_MAP = {
  ENABLED: 'ACTIVE',
  PAUSED: 'PAUSED',
  REMOVED: 'DELETED',
  UNKNOWN: 'UNKNOWN',
};

// ============================================
// OBJECTIVE MAPPINGS
// ============================================

export const OBJECTIVE_MAP = {
  APP_INSTALLS: 'App Install',
  AWARENESS: 'Brand Awareness',
  BRAND_AWARENESS: 'Brand Awareness',
  CONVERSIONS: 'Conversions',
  EVENT_RESPONSES: 'Event Response',
  LEAD_GENERATION: 'Lead Generation',
  LINK_CLICKS: 'Link Clicks',
  MESSAGES: 'Messages',
  OUTCOME_AWARENESS: 'Brand Awareness',
  OUTCOME_TRAFFIC: 'Traffic',
  OUTCOME_ENGAGEMENT: 'Engagement',
  OUTCOME_LEADS: 'Lead Generation',
  OUTCOME_APP_PROMOTION: 'App Install',
  OUTCOME_SALES: 'Conversions',
  OUTCOME_CATALOG_SALES: 'Catalog Sales',
  PAGE_LIKES: 'Page Likes',
  POST_ENGAGEMENT: 'Post Engagement',
  REACH: 'Reach',
  SOCIAL: 'Social',
  TRAFFIC: 'Traffic',
  VIDEO_VIEWS: 'Video Views',
  WEBSITE_CONVERSIONS: 'Website Conversions',
  WEBSITE_PURCHASES: 'Website Purchases',
  UNKNOWN: 'N/A',
};

export const OBJECTIVE_TYPE_MAP = {
  APP_INSTALLS: 'APP_INSTALL',
  AWARENESS: 'VIDEO',
  BRAND_AWARENESS: 'VIDEO',
  CONVERSIONS: 'SHOPPING',
  EVENT_RESPONSES: 'SOCIAL',
  LEAD_GENERATION: 'LEAD_GEN',
  LINK_CLICKS: 'DISPLAY',
  MESSAGES: 'SOCIAL',
  OUTCOME_AWARENESS: 'VIDEO',
  OUTCOME_TRAFFIC: 'DISPLAY',
  OUTCOME_ENGAGEMENT: 'SOCIAL',
  OUTCOME_LEADS: 'LEAD_GEN',
  OUTCOME_APP_PROMOTION: 'APP_INSTALL',
  OUTCOME_SALES: 'SHOPPING',
  OUTCOME_CATALOG_SALES: 'SHOPPING',
  PAGE_LIKES: 'SOCIAL',
  POST_ENGAGEMENT: 'SOCIAL',
  REACH: 'VIDEO',
  SOCIAL: 'SOCIAL',
  TRAFFIC: 'DISPLAY',
  VIDEO_VIEWS: 'VIDEO',
  WEBSITE_CONVERSIONS: 'SHOPPING',
  WEBSITE_PURCHASES: 'SHOPPING',
  UNKNOWN: 'UNKNOWN',
};

// ============================================
// DEFAULT VALUES FOR MISSING DATA
// ============================================

export const DEFAULT_VALUES = {
  NUMBER: 0,
  TEXT: 'N/A',
  CURRENCY: '$0.00',
  PERCENTAGE: '0%',
  STATUS: 'UNKNOWN',
  DATE: 'N/A',
  URL: '#',
};
