import CacheMarker from '../../models/CacheMarker.js';

export const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-01';

// Helper to safely parse strings to numbers
export function safeParseInt(val, defaultVal = 0) {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? defaultVal : parsed;
  }
  return defaultVal;
}

// Helper to sanitize shop domain name
export function sanitizeShopUrl(shopUrl) {
  let url = shopUrl.trim().toLowerCase();
  url = url.replace(/^https?:\/\//, '');
  url = url.replace(/\/$/, '');
  if (!url.includes('.')) {
    url = `${url}.myshopify.com`;
  }
  return url;
}

// Helper to parse Next link headers for Shopify pagination
export function parseLinkHeader(header) {
  if (!header) return null;
  const parts = header.split(',');
  const links = {};
  for (const part of parts) {
    const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (match) {
      const url = new URL(match[1]);
      const pageInfo = url.searchParams.get('page_info');
      links[match[2]] = pageInfo;
    }
  }
  return links.next || null;
}

// Helper to find a fresh cache marker that fully covers the requested date range
export async function findCoveringMarker(storeUrl, channel, sinceDate, untilDate) {
  try {
    const markers = await CacheMarker.find({ storeUrl, channel });
    const cacheTtl = 4 * 60 * 60 * 1000; // 4 hours TTL
    const now = new Date();

    for (const marker of markers) {
      if (now - new Date(marker.lastUpdated) > cacheTtl) {
        continue;
      }

      const range = getMarkerRange(marker);
      if (range) {
        if (range.start <= sinceDate && range.end >= untilDate) {
          console.log(`[Cache Manager] Found covering marker "${marker.key}" for requested Shopify range ${sinceDate.toISOString().split('T')[0]} to ${untilDate.toISOString().split('T')[0]}`);
          return marker;
        }
      }
    }
  } catch (err) {
    console.warn("[Cache Manager] Error scanning covering markers:", err.message);
  }
  return null;
}

// Helper to extract the start and end dates covered by a specific cache marker
export function getMarkerRange(marker) {
  let start, end;
  const key = marker.key;
  const lastUpdated = new Date(marker.lastUpdated);

  if (key.startsWith('orders_')) {
    const parts = key.replace('orders_', '').split('_');
    if (parts.length === 2 && parts[0] && parts[1]) {
      start = new Date(parts[0]);
      end = new Date(parts[1]);
    }
  } else if (key.startsWith('insights_custom_')) {
    const parts = key.replace('insights_custom_', '').split('_');
    if (parts.length === 2 && parts[0] && parts[1]) {
      start = new Date(parts[0]);
      end = new Date(parts[1]);
    }
  } else if (key.startsWith('insights_')) {
    const preset = key.replace('insights_', '');
    end = new Date(lastUpdated);
    start = new Date(lastUpdated);
    switch (preset) {
      case 'last_7d':
        start.setDate(end.getDate() - 7);
        break;
      case 'last_14d':
        start.setDate(end.getDate() - 14);
        break;
      case 'last_30d':
        start.setDate(end.getDate() - 30);
        break;
      default:
        return null;
    }
  } else {
    return null;
  }

  if (start && end) {
    start.setUTCHours(0, 0, 0, 0);
    end.setUTCHours(23, 59, 59, 999);
    return { start, end };
  }
  return null;
}
