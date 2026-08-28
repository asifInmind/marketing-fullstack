import fs from 'fs';
import ShopifyProduct from '../../models/ShopifyProduct.js';
import ShopifyOrder from '../../models/ShopifyOrder.js';
import AdMetadata from '../../models/AdMetadata.js';
import DailyAdInsight from '../../models/DailyAdInsight.js';
import Merchant from '../../models/Merchant.js';
import CacheMarker from '../../models/CacheMarker.js';
import { syncProductsFromShopify } from './productApi.js';
import { syncOrdersFromShopify } from './orderApi.js';
import { findCoveringMarker } from './shopifyCore.js';
import { fetchCompleteDashboard } from '../meta/index.js';

export function matchAdToProduct(ad, productsList) {
  // 1. Try URL Handle match (most accurate)
  const url = (ad.finalUrl || '').toLowerCase();
  const handleRegex = /\/products\/([a-zA-Z0-9-_]+)/;
  const match = url.match(handleRegex);
  if (match && match[1]) {
    const handle = match[1];
    const product = productsList.find(p => p.handle.toLowerCase() === handle);
    if (product) return product;
  }

  // 1.5 Try URL contains handle match (for custom query/redirect URLs)
  if (url) {
    for (const product of productsList) {
      if (product.handle && url.includes(product.handle.toLowerCase())) {
        return product;
      }
    }
  }

  const adNameLower = (ad.name || '').toLowerCase();
  const campaignNameLower = (ad.campaignName || '').toLowerCase();

  // 2. Try Variant SKU / top-level SKU match (very accurate)
  for (const product of productsList) {
    if (product.sku && adNameLower.includes(product.sku.toLowerCase())) {
      return product;
    }
    if (product.variants) {
      for (const variant of product.variants) {
        if (variant.sku && adNameLower.includes(variant.sku.toLowerCase())) {
          return product;
        }
      }
    }
  }

  // 3. Try exact keyword matching in Product Title/Handle (bidirectional)
  for (const product of productsList) {
    const titleLower = (product.title || '').toLowerCase();
    const handleLower = (product.handle || '').toLowerCase();
    if (titleLower.length > 5) {
      if (adNameLower.includes(titleLower) || titleLower.includes(adNameLower)) {
        return product;
      }
      if (campaignNameLower.includes(titleLower) || titleLower.includes(campaignNameLower)) {
        return product;
      }
    }
    if (handleLower.length > 5) {
      if (adNameLower.includes(handleLower) || handleLower.includes(adNameLower)) {
        return product;
      }
      if (campaignNameLower.includes(handleLower) || handleLower.includes(campaignNameLower)) {
        return product;
      }
    }
  }

  // 4. Advanced Token Overlap matching for generic names (e.g. "New Sales ad" inside campaign "massasge campain - wafel")
  const stopWords = new Set([
    'new', 'sales', 'ad', 'copy', 'pics', 'video', 'campaign', 'creative', 'mix', 'pic', 
    'images', 'image', 'link', 'product', 'collections', 'products', 'men', 'mens', 
    'status', 'active', 'paused', 'enabled', 'disabled', 'draft', 'adset', 'adgroup', 
    'massasge', 'campain', 'chat', 'with', 'us', 'whatsapp', 'click', 'here', 'shop', 'now'
  ]);

  const tokenize = (str) => {
    return str
      .replace(/[\s\-_–]/g, ' ')
      .toLowerCase()
      .split(/\s+/)
      .map(w => w.trim())
      .filter(w => w.length > 2 && !stopWords.has(w));
  };

  const adTokens = new Set([...tokenize(adNameLower), ...tokenize(campaignNameLower)]);
  if (adTokens.size > 0) {
    let bestProduct = null;
    let maxOverlap = 0;

    for (const product of productsList) {
      const prodTokens = [...tokenize(product.title || ''), ...tokenize(product.handle || '')];
      let overlap = 0;
      prodTokens.forEach(t => {
        if (adTokens.has(t)) overlap++;
      });

      if (overlap > maxOverlap) {
        maxOverlap = overlap;
        bestProduct = product;
      }
    }

    if (maxOverlap > 0) {
      return bestProduct;
    }
  }

  return null;
}

export async function syncMetaInsightsFromApi(shopDomain, fbAccessToken, adAccountId, sinceDate, untilDate, startStr, endStr) {
  try {
    const config = {
      accessToken: fbAccessToken,
      accountId: adAccountId,
      dateRange: {
        preset: 'custom',
        since: startStr,
        until: endStr
      },
      pageSize: 150
    };

    console.log(`[shopify.js Sync Meta] Calling Meta API for custom range ${startStr} to ${endStr}...`);
    const data = await fetchCompleteDashboard(config, 150, true);

    if (data) {
      const cachePromises = [];

      // A. Cache AdMetadata
      if (data.ads) {
        data.ads.forEach(ad => {
          const campaign = data.campaigns?.find(c => c.id === ad.campaign_id) || {};
          const adSet = data.adSets?.find(s => s.id === ad.adset_id) || {};

          // Enrich the live object so the response returned to the client contains these fields
          ad.campaign_name = ad.campaign?.name || campaign.name || '';
          ad.adset_name = ad.adset?.name || adSet.name || '';

          const creativeId = ad.creative?.id;
          const creative = creativeId ? (data.creatives?.[creativeId] || {}) : {};

          const updateObj = {
            storeUrl: shopDomain,
            channel: 'meta',
            campaignId: ad.campaign_id,
            campaignName: ad.campaign?.name || campaign.name || ad.campaign_name || '',
            campaignStatus: campaign.status || ad.campaign_status || '',
            campaignObjective: campaign.objective || '',
            campaignStartDate: campaign.start_time || '',
            campaignEndDate: campaign.stop_time || '',
            adSetId: ad.adset_id,
            adSetName: ad.adset?.name || adSet.name || ad.adset_name || '',
            adSetStatus: adSet.status || ad.adset_status || '',
            adSetTargeting: adSet.targeting ? JSON.stringify(adSet.targeting) : '',
            adSetStartDate: adSet.start_time || '',
            adSetEndDate: adSet.end_time || '',
            adId: ad.id,
            adName: ad.name,
            adStatus: ad.status || '',
            adCreatedTime: ad.created_time || ad.createdAt || '',
            lastUpdated: new Date()
          };

          const hasCreativeContent = creative && (creative.name || creative.final_url || creative.body || creative.headline);
          if (hasCreativeContent) {
            updateObj.creative = {
              creativeId: creativeId || '',
              creativeName: creative.name || '',
              thumbnailUrl: creative.thumbnail_url || creative.image_url || '',
              bodyText: creative.body || '',
              destinationUrl: creative.final_url || '',
              callToAction: creative.call_to_action || '',
              format: creative.format || '',
              headline: creative.headline || '',
              description: creative.description || ''
            };
          } else {
            updateObj['creative.creativeId'] = creativeId || '';
          }

          cachePromises.push(
            AdMetadata.findOneAndUpdate(
              { adId: ad.id },
              { $set: updateObj },
              { upsert: true, new: true }
            )
          );
        });
      }

      // B. Cache DailyAdInsights
      if (data.dailyInsights) {
        data.dailyInsights.forEach(ins => {
          const insightDate = new Date(ins.date_start || new Date());
          insightDate.setUTCHours(0, 0, 0, 0);

          cachePromises.push(
            DailyAdInsight.findOneAndUpdate(
              { storeUrl: shopDomain, date: insightDate, adId: ins.ad_id },
              {
                storeUrl: shopDomain,
                date: insightDate,
                channel: 'meta',
                adId: ins.ad_id,
                spend: parseFloat(ins.spend || 0),
                impressions: parseInt(ins.impressions || 0, 10),
                clicks: parseInt(ins.clicks || 0, 10),
                conversions: parseInt(ins.conversions || 0, 10),
                conversionValue: parseFloat(ins.conversion_values || 0)
              },
              { upsert: true, new: true }
            )
          );
        });
      }

      // C. Cache Marker
      const markerKey = `insights_custom_${startStr || ''}_${endStr || ''}`;
      cachePromises.push(
        CacheMarker.findOneAndUpdate(
          { storeUrl: shopDomain, channel: 'meta', key: markerKey },
          { lastUpdated: new Date() },
          { upsert: true, new: true }
        )
      );

      await Promise.all(cachePromises);
      console.log(`[shopify.js Sync Meta] Successfully cached ${cachePromises.length} Meta objects in MongoDB.`);
    }
  } catch (err) {
    console.error("❌ [shopify.js Sync Meta] Error during background Meta sync:", err.message);
  }
}

export async function calculateCatalogPerformance({ shopDomain, shopify_token, startDate, endDate, currencyCode = 'PKR', forceRefresh = false }) {
  // Calculate date boundary
  let sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - 30);
  let untilDate = new Date();

  if (startDate) sinceDate = new Date(startDate);
  if (endDate) untilDate = new Date(endDate);

  sinceDate.setUTCHours(0, 0, 0, 0);
  untilDate.setUTCHours(23, 59, 59, 999);

  const startStr = sinceDate.toISOString().split('T')[0];
  const endStr = untilDate.toISOString().split('T')[0];

  // 1. Sync Products (if empty or force refresh)
  let dbProducts = await ShopifyProduct.find({ storeUrl: shopDomain });
  if (forceRefresh || dbProducts.length === 0) {
    await syncProductsFromShopify(shopDomain, shopify_token);
    dbProducts = await ShopifyProduct.find({ storeUrl: shopDomain });
  }

  // 2. Sync Orders (if not covered by cache or force refresh)
  const orderCacheMarker = await findCoveringMarker(shopDomain, 'shopify', sinceDate, untilDate);
  if (forceRefresh || !orderCacheMarker) {
    await syncOrdersFromShopify(shopDomain, shopify_token, startStr, endStr);
  }

  // 2.5 Sync Meta Insights in background (if not covered by cache or force refresh)
  const metaCacheMarker = await findCoveringMarker(shopDomain, 'meta', sinceDate, untilDate);
  if (forceRefresh || !metaCacheMarker) {
    const merchant = await Merchant.findOne({ storeUrl: shopDomain });
    if (merchant && merchant.fbAccessToken && merchant.adAccountId) {
      console.log(`[Shopify Performance Sync] Meta insights cache MISS for range ${startStr} to ${endStr}. Syncing Meta in background...`);
      syncMetaInsightsFromApi(shopDomain, merchant.fbAccessToken, merchant.adAccountId, sinceDate, untilDate, startStr, endStr)
        .then(() => {
          console.log(`[Shopify Performance Sync] Background Meta sync complete for ${shopDomain}.`);
        })
        .catch(err => {
          console.error(`[Shopify Performance Sync] Background Meta sync failed:`, err.message);
        });
    }
  }

  const dbOrders = await ShopifyOrder.find({
    storeUrl: shopDomain,
    createdAt: { $gte: sinceDate, $lte: untilDate }
  });

  // 3. Load Meta structures and daily insights from MongoDB
  const dbMeta = await AdMetadata.find({ storeUrl: shopDomain });
  const dbInsights = await DailyAdInsight.find({
    storeUrl: shopDomain,
    date: { $gte: sinceDate, $lte: untilDate }
  });

  // 4. Aggregate insights by adId
  const adInsights = {};
  dbInsights.forEach(ins => {
    if (!adInsights[ins.adId]) {
      adInsights[ins.adId] = { spend: 0, clicks: 0, conversions: 0, conversionValue: 0, impressions: 0 };
    }
    adInsights[ins.adId].spend += ins.spend || 0;
    adInsights[ins.adId].clicks += ins.clicks || 0;
    adInsights[ins.adId].impressions += ins.impressions || 0;
    adInsights[ins.adId].conversions += ins.conversions || 0;
    adInsights[ins.adId].conversionValue += ins.conversionValue || 0;
  });

  // Find the latest insight date present in dbInsights to avoid timezone / sync lag issues
  let latestInsightTime = new Date().getTime();
  if (dbInsights.length > 0) {
    latestInsightTime = Math.max(...dbInsights.map(ins => new Date(ins.date).getTime()));
  }
  const maxInsightDate = new Date(latestInsightTime);

  // 5. Construct metaAds list (filtered to active status, has spend in range, and is NOT frozen)
  const metaAds = dbMeta.map(m => {
    const insight = adInsights[m.adId] || { spend: 0, clicks: 0, conversions: 0, conversionValue: 0, impressions: 0 };

    // Find last active date with spend > 0 in this range from the daily insights
    const adDaily = dbInsights
      .filter(ins => ins.adId === m.adId && ins.spend > 0)
      .map(ins => ins.date);

    let lastActiveDate = null;
    if (adDaily.length > 0) {
      lastActiveDate = new Date(Math.max(...adDaily.map(d => new Date(d).getTime())));
    }

    return {
      id: m.adId,
      name: m.adName || '',
      status: m.adStatus || '',
      campaignId: m.campaignId || '',
      adSetId: m.adSetId || '',
      campaignName: m.campaignName || 'N/A',
      campaignStatus: m.campaignStatus || '',
      adGroupName: m.adSetName || 'N/A',
      adSetStatus: m.adSetStatus || '',
      cost: insight.spend,
      clicks: insight.clicks,
      impressions: insight.impressions,
      conversions: insight.conversions,
      conversionValue: insight.conversionValue,
      finalUrl: m.creative?.destinationUrl || '',
      lastActiveDate: lastActiveDate,
      creative: m.creative ? {
        id: m.creative.creativeId,
        headline: m.creative.headline,
        description: m.creative.description
      } : null
    };
  }).filter(ad => {
    const statusUpper = ad.status?.toUpperCase();
    const isActive = statusUpper === 'ACTIVE' || statusUpper === 'ENABLED';
    
    const campStatusUpper = ad.campaignStatus?.toUpperCase();
    const isCampaignActive = campStatusUpper === 'ACTIVE' || campStatusUpper === 'ENABLED';
    
    const adSetStatusUpper = ad.adSetStatus?.toUpperCase();
    const isAdSetActive = adSetStatusUpper === 'ACTIVE' || adSetStatusUpper === 'ENABLED';
    
    const hasSpend = ad.cost > 0;
    if (!isActive || !isCampaignActive || !isAdSetActive || !hasSpend) return false;

    // Check if the active ad is frozen (has not spent any budget in the last 3 days relative to the latest sync date)
    if (ad.lastActiveDate) {
      const lastDate = new Date(ad.lastActiveDate);
      const daysSinceLastSpend = Math.floor((maxInsightDate - lastDate) / (1000 * 60 * 60 * 24));
      if (daysSinceLastSpend > 3) {
        return false;
      }
    }
    return true;
  });

  // 6. Run Alerts Engine (active ads with spend and out of stock products)
  const wastedBudgetAlerts = [];
  metaAds.forEach(ad => {
    const isActive = ad.status.toUpperCase() === 'ACTIVE';
    const hasSpend = ad.cost > 0;

    if (isActive && hasSpend) {
      const product = matchAdToProduct(ad, dbProducts);
      if (product) {
        const totalStock = product.variants.reduce((sum, v) => sum + (v.inventoryQuantity || 0), 0);
        if (totalStock <= 0) {
          wastedBudgetAlerts.push({
            adId: ad.id,
            adName: ad.name,
            adSetName: ad.adGroupName,
            campaignName: ad.campaignName,
            spend: ad.cost,
            clicks: ad.clicks,
            shopifyProductId: product.productId,
            productTitle: product.title,
            sku: product.variants[0]?.sku || 'No SKU',
            inventoryQuantity: totalStock,
            status: ad.status,
            adUrl: ad.finalUrl || '#'
          });
        }
      }
    }
  });

  // 7. Run Product Performance Attribution Engine
  const perfMap = {};
  dbProducts.forEach(p => {
    perfMap[p.productId] = {
      productId: p.productId,
      productTitle: p.title,
      sku: p.variants[0]?.sku || '—',
      inventoryQuantity: p.variants.reduce((sum, v) => sum + (v.inventoryQuantity || 0), 0),
      shopifySalesQuantity: 0,
      shopifyRevenue: 0,
      metaSalesQuantity: 0,
      metaRevenue: 0,
      adSpend: 0,
      adClicks: 0,
      adImpressions: 0,
      attributedSales: 0,
      attributedRevenue: 0,
      trueROAS: 0,
      metaAttributedROAS: 0,
      productImageUrl: p.imageUrl || null,
      handle: p.handle || '',
      matchedAds: [],
      firstActiveDate: null,
      lastActiveDate: null,
      variants: p.variants || []
    };
  });

  const unmatchedAds = [];
  metaAds.forEach(ad => {
    const product = matchAdToProduct(ad, dbProducts);
    if (product && perfMap[product.productId]) {
      perfMap[product.productId].adSpend += ad.cost || 0;
      perfMap[product.productId].adClicks += ad.clicks || 0;
      perfMap[product.productId].adImpressions += ad.impressions || 0;
      perfMap[product.productId].attributedSales += ad.conversions || 0;
      perfMap[product.productId].attributedRevenue += ad.conversionValue || 0;

      // Extract daily spend breakdown for this specific ad (only days with spend > 0)
      const adDailyInsights = dbInsights
        .filter(ins => ins.adId === ad.id && ins.spend > 0)
        .map(ins => ({
          date: ins.date.toISOString().split('T')[0],
          spend: ins.spend,
          clicks: ins.clicks,
          conversions: ins.conversions
        }));

      // Sort daily insights by date descending
      adDailyInsights.sort((a, b) => new Date(b.date) - new Date(a.date));

      // Get active range for this ad
      let firstActiveDate = null;
      let lastActiveDate = null;
      if (adDailyInsights.length > 0) {
        firstActiveDate = adDailyInsights[adDailyInsights.length - 1].date;
        lastActiveDate = adDailyInsights[0].date;

        // Update overall product active range
        const productRef = perfMap[product.productId];
        if (!productRef.firstActiveDate || new Date(firstActiveDate) < new Date(productRef.firstActiveDate)) {
          productRef.firstActiveDate = firstActiveDate;
        }
        if (!productRef.lastActiveDate || new Date(lastActiveDate) > new Date(productRef.lastActiveDate)) {
          productRef.lastActiveDate = lastActiveDate;
        }
      }

      perfMap[product.productId].matchedAds.push({
        id: ad.id,
        name: ad.name,
        status: ad.status,
        cost: ad.cost,
        clicks: ad.clicks,
        impressions: ad.impressions,
        conversions: ad.conversions,
        conversionValue: ad.conversionValue,
        campaignId: ad.campaignId || '',
        adSetId: ad.adSetId || '',
        campaignName: ad.campaignName,
        adSetName: ad.adGroupName,
        finalUrl: ad.finalUrl || '',
        firstActiveDate,
        lastActiveDate,
        dailySpendBreakdown: adDailyInsights,
        insights: {
          conversions: ad.conversions || 0,
          conversion_values: ad.conversionValue || 0,
          impressions: ad.impressions || 0,
          clicks: ad.clicks || 0,
          spend: ad.cost || 0,
          ctr: ad.impressions > 0 ? (ad.clicks / ad.impressions) : 0
        },
        creative: ad.creative ? {
          id: ad.creative.id,
          headline: ad.creative.headline,
          description: ad.creative.description
        } : null
      });
    } else {
      unmatchedAds.push({
        id: ad.id,
        name: ad.name,
        status: ad.status,
        cost: ad.cost,
        clicks: ad.clicks,
        impressions: ad.impressions,
        conversions: ad.conversions,
        conversionValue: ad.conversionValue,
        campaignName: ad.campaignName,
        adSetName: ad.adGroupName,
        finalUrl: ad.finalUrl || ''
      });
    }
  });

  const salesMap = {};
  let totalMetaRevenue = 0;
  let totalMetaOrdersCount = 0;
  const totalMetaEmails = new Set();

  dbOrders.forEach(order => {
    const isCancelled = order.cancelledAt !== null && order.cancelledAt !== undefined;
    if (!isCancelled) {
      let isMetaAttributed = false;

      const utmSource = order.attribution?.utmSource?.toLowerCase() || '';
      const clickId = order.attribution?.clickId || '';
      if (['facebook', 'meta', 'instagram', 'fb', 'ig'].includes(utmSource) || clickId) {
        isMetaAttributed = true;
      }

      // Real-time URL parse fallback for older cached order records
      if (!isMetaAttributed && order.landingSite) {
        try {
          const url = new URL(order.landingSite, 'https://fallback.com');
          const source = url.searchParams.get('utm_source')?.toLowerCase() || '';
          const fbclid = url.searchParams.get('fbclid') || '';
          if (['facebook', 'meta', 'instagram', 'fb', 'ig'].includes(source) || fbclid) {
            isMetaAttributed = true;
          }
        } catch { }
      }

      if (!isMetaAttributed && order.referringSite) {
        const ref = order.referringSite.toLowerCase();
        if (ref.includes('facebook.com') || ref.includes('instagram.com')) {
          isMetaAttributed = true;
        }
      }

      let orderMatchedActiveAd = false;

      order.lineItems.forEach(item => {
        if (item.productId) {
          if (!salesMap[item.productId]) {
            salesMap[item.productId] = { quantity: 0, revenue: 0, metaQuantity: 0, metaRevenue: 0, matchedOrders: [] };
          }
          salesMap[item.productId].quantity += item.quantity || 0;
          salesMap[item.productId].revenue += (item.price * (item.quantity || 0));

          // Check if this Meta-attributed order actually matches an active ad for this product
          let isSpecificallyAttributed = false;
          if (isMetaAttributed) {
            // Get active ads mapped to this product (if any)
            const activeAdsForProduct = perfMap[item.productId]?.matchedAds || [];
            if (activeAdsForProduct.length > 0) {
              let utmCampaign = (order.attribution?.utmCampaign || '').trim();
              let utmContent = (order.attribution?.utmContent || '').trim();
              let utmTerm = (order.attribution?.utmTerm || '').trim();
              let orderAdId = (order.attribution?.adId || '').trim();
              let orderAdSetId = (order.attribution?.adSetId || '').trim();
              let orderCampaignId = (order.attribution?.campaignId || '').trim();
              let orderClickId = (order.attribution?.clickId || '').trim();

              if (order.landingSite) {
                try {
                  const url = new URL(order.landingSite, 'https://fallback.com');
                  if (!utmCampaign) utmCampaign = (url.searchParams.get('utm_campaign') || '').trim();
                  if (!utmContent) utmContent = (url.searchParams.get('utm_content') || '').trim();
                  if (!utmTerm) utmTerm = (url.searchParams.get('utm_term') || '').trim();
                  if (!orderAdId) orderAdId = url.searchParams.get('ad_id') || url.searchParams.get('fb_ad_id') || '';
                  if (!orderAdSetId) orderAdSetId = url.searchParams.get('adset_id') || url.searchParams.get('fb_adset_id') || '';
                  if (!orderCampaignId) orderCampaignId = url.searchParams.get('campaign_id') || url.searchParams.get('fb_campaign_id') || '';
                  if (!orderClickId) orderClickId = url.searchParams.get('fbclid') || '';
                } catch { }
              }

              const normalizeStr = (str) => {
                try {
                  return decodeURIComponent(str || '').toLowerCase().replace(/[\s\-_]/g, '');
                } catch {
                  return (str || '').toLowerCase().replace(/[\s\-_]/g, '');
                }
              };
              const orderCampaignNorm = normalizeStr(utmCampaign);
              const orderContentNorm = normalizeStr(utmContent);
              const orderTermNorm = normalizeStr(utmTerm);

              if (orderCampaignNorm || orderContentNorm || orderTermNorm || orderAdId || orderAdSetId || orderCampaignId) {
                isSpecificallyAttributed = activeAdsForProduct.some(ad => {
                  const adCampaignNorm = normalizeStr(ad.campaignName || '');
                  const adNameNorm = normalizeStr(ad.name || '');
                  const adSetNorm = normalizeStr(ad.adGroupName || '');

                  const adCampaignId = (ad.campaignId || '').trim();
                  const adId = (ad.id || '').trim();
                  const adSetId = (ad.adSetId || '').trim();

                  // 1. Direct ID matches (extremely accurate)
                  if (orderAdId && adId === orderAdId) return true;
                  if (orderAdSetId && adSetId === orderAdSetId) return true;
                  if (orderCampaignId && adCampaignId === orderCampaignId) return true;

                  // 2. Fuzzy Text match fallbacks
                  const campaignMatch = (orderCampaignNorm && adCampaignNorm && (orderCampaignNorm.includes(adCampaignNorm) || adCampaignNorm.includes(orderCampaignNorm))) ||
                                        (utmCampaign && adCampaignId && utmCampaign.trim().includes(adCampaignId));

                  const contentMatch = (orderContentNorm && adNameNorm && (orderContentNorm.includes(adNameNorm) || adNameNorm.includes(orderContentNorm))) ||
                                       (utmContent && adId && utmContent.trim().includes(adId));

                  const adSetMatch = (orderTermNorm && adSetNorm && (orderTermNorm.includes(adSetNorm) || adSetNorm.includes(orderTermNorm))) ||
                                     (utmTerm && adSetId && utmTerm.trim().includes(adSetId)) ||
                                     (orderCampaignNorm && adSetNorm && (orderCampaignNorm.includes(adSetNorm) || adSetNorm.includes(orderCampaignNorm))) ||
                                     (utmCampaign && adSetId && utmCampaign.trim().includes(adSetId));

                  return campaignMatch || contentMatch || adSetMatch;
                });
              } else {
                // Without any specific UTM parameters or IDs, we cannot verify it came from active ads
                isSpecificallyAttributed = false;
              }
            }
          }

          if (isSpecificallyAttributed) {
            orderMatchedActiveAd = true;
            salesMap[item.productId].metaQuantity += item.quantity || 0;
            salesMap[item.productId].metaRevenue += (item.price * (item.quantity || 0));

            let utmCampaign = order.attribution?.utmCampaign || '';
            let utmContent = order.attribution?.utmContent || '';
            let utmTerm = order.attribution?.utmTerm || '';
            let orderAdId = order.attribution?.adId || '';
            let orderAdSetId = order.attribution?.adSetId || '';
            let orderCampaignId = order.attribution?.campaignId || '';

            if (order.landingSite) {
              try {
                const url = new URL(order.landingSite, 'https://fallback.com');
                if (!utmCampaign) utmCampaign = url.searchParams.get('utm_campaign') || '';
                if (!utmContent) utmContent = url.searchParams.get('utm_content') || '';
                if (!utmTerm) utmTerm = url.searchParams.get('utm_term') || '';
                if (!orderAdId) orderAdId = url.searchParams.get('ad_id') || url.searchParams.get('fb_ad_id') || '';
                if (!orderAdSetId) orderAdSetId = url.searchParams.get('adset_id') || url.searchParams.get('fb_adset_id') || '';
                if (!orderCampaignId) orderCampaignId = url.searchParams.get('campaign_id') || url.searchParams.get('fb_campaign_id') || '';
              } catch { }
            }

            salesMap[item.productId].matchedOrders.push({
              orderId: order.orderId,
              orderNumber: order.orderNumber || order.name || '',
              createdAt: order.createdAt,
              email: order.email || '—',
              quantity: item.quantity || 0,
              price: item.price || 0,
              totalPrice: (item.price || 0) * (item.quantity || 0),
              utmSource: order.attribution?.utmSource || '',
              utmCampaign: utmCampaign,
              utmContent: utmContent,
              utmTerm: utmTerm,
              clickId: order.attribution?.clickId || '',
              adId: orderAdId,
              adSetId: orderAdSetId,
              campaignId: orderCampaignId
            });
          }
        }
      });

      if (orderMatchedActiveAd) {
        totalMetaRevenue += order.totalPrice || 0;
        totalMetaOrdersCount++;
        if (order.email) totalMetaEmails.add(order.email);
      }
    }
  });

  const productPerformance = Object.values(perfMap)
    .map(item => {
      const sales = salesMap[item.productId] || { quantity: 0, revenue: 0, metaQuantity: 0, metaRevenue: 0, matchedOrders: [] };
      item.shopifySalesQuantity = sales.quantity;
      item.shopifyRevenue = sales.revenue;
      item.metaSalesQuantity = sales.metaQuantity;
      item.metaRevenue = sales.metaRevenue;
      item.matchedOrders = sales.matchedOrders || [];

      // Match daily Shopify conversions driven by Meta
      const isOrderMatchedToAd = (order, ad) => {
        const normalizeStr = (str) => (str || '').toLowerCase().replace(/[\s\-_]/g, '');
        const orderCampaignNorm = normalizeStr(order.utmCampaign);
        const orderContentNorm = normalizeStr(order.utmContent);
        const orderTermNorm = normalizeStr(order.utmTerm);

        const orderAdId = (order.adId || '').trim();
        const orderAdSetId = (order.adSetId || '').trim();
        const orderCampaignId = (order.campaignId || '').trim();

        const adId = (ad.id || '').trim();
        const adSetId = (ad.adSetId || '').trim();
        const adCampaignId = (ad.campaignId || '').trim();

        // Guard clauses: If the order explicitly specifies a different ad ID, ad set ID, or campaign ID, skip matching
        const orderAId = orderAdId || (order.utmContent && /^\d+$/.test(order.utmContent) ? order.utmContent : null);
        if (orderAId && orderAId !== adId) return false;

        const orderAsId = orderAdSetId || (order.utmTerm && /^\d+$/.test(order.utmTerm) ? order.utmTerm : null);
        if (orderAsId && orderAsId !== adSetId) return false;

        const orderCampId = orderCampaignId || (order.utmCampaign && /^\d+$/.test(order.utmCampaign) ? order.utmCampaign : null);
        if (orderCampId && orderCampId !== adCampaignId) return false;

        // 1. Direct ID matches (extremely accurate)
        if (orderAdId && adId === orderAdId) return true;
        if (orderAdSetId && adSetId === orderAdSetId) return true;
        if (orderCampaignId && adCampaignId === orderCampaignId) return true;

        // 2. Fuzzy Text match fallbacks
        if (orderCampaignNorm || orderContentNorm || orderTermNorm) {
          const adCampaignNorm = normalizeStr(ad.campaignName);
          const adNameNorm = normalizeStr(ad.name);
          const adSetNorm = normalizeStr(ad.adGroupName);

          const campaignMatch = orderCampaignNorm && adCampaignNorm && (orderCampaignNorm.includes(adCampaignNorm) || adCampaignNorm.includes(orderCampaignNorm));
          const contentMatch = orderContentNorm && adNameNorm && (orderContentNorm.includes(adNameNorm) || adNameNorm.includes(orderContentNorm));
          const adSetMatch = orderTermNorm && adSetNorm && (orderTermNorm.includes(adSetNorm) || adSetNorm.includes(orderTermNorm));

          return campaignMatch || contentMatch || adSetMatch;
        }
        return true;
      };

      item.matchedAds.forEach(ad => {
        if (!ad.dailySpendBreakdown) {
          ad.dailySpendBreakdown = [];
        }

        const adInsightDates = new Set(ad.dailySpendBreakdown.map(day => day.date));
        const adOrders = item.matchedOrders.filter(order => isOrderMatchedToAd(order, ad));

        adOrders.forEach(order => {
          const orderDate = new Date(order.createdAt).toISOString().split('T')[0];
          if (!adInsightDates.has(orderDate)) {
            adInsightDates.add(orderDate);
            ad.dailySpendBreakdown.push({
              date: orderDate,
              spend: 0,
              clicks: 0,
              conversions: 0
            });
          }
        });

        ad.dailySpendBreakdown = ad.dailySpendBreakdown.map(day => {
          const dayOrders = adOrders.filter(order => {
            const orderDate = new Date(order.createdAt).toISOString().split('T')[0];
            return orderDate === day.date;
          });

          return {
            ...day,
            shopifyConversions: dayOrders.length,
            shopifyQuantity: dayOrders.reduce((sum, o) => sum + (o.quantity || 0), 0)
          };
        });

        ad.dailySpendBreakdown.sort((a, b) => new Date(b.date) - new Date(a.date));
      });

      item.trueROAS = item.adSpend > 0 ? sales.revenue / item.adSpend : 0;
      item.metaAttributedROAS = item.adSpend > 0 ? item.attributedRevenue / item.adSpend : 0;

      // Compute automated gap check audits
      const warnings = [];
      let hasGap = false;
      let wastedSpend = 0;

      const stock = item.inventoryQuantity;
      const spend = item.adSpend;

      if (stock <= 0 && spend > 0) {
        hasGap = true;
        wastedSpend = spend;
        warnings.push({
          type: 'OUT_OF_STOCK',
          severity: 'HIGH',
          message: `This product is out of stock (Stock: ${stock}) but is actively spending marketing budget of ${spend.toLocaleString()} PKR.`
        });
      } else if (stock > 0 && stock < 10 && spend > 0) {
        hasGap = true;
        warnings.push({
          type: 'LOW_STOCK',
          severity: 'MEDIUM',
          message: `Low inventory level (${stock} items left). Consider reducing ad spend or replenishing stock to avoid wasted budget.`
        });
      }

      if (spend > 5000 && item.trueROAS < 1.0) {
        hasGap = true;
        warnings.push({
          type: 'LOW_ROAS',
          severity: 'HIGH',
          message: `Low ROAS (${item.trueROAS.toFixed(2)}x) with high ad spend (${spend.toLocaleString()} PKR). Consider pausing or optimizing targeting.`
        });
      }

      if (spend === 0 && sales.quantity > 10) {
        hasGap = true;
        warnings.push({
          type: 'NO_ADS_ORGANIC',
          severity: 'INFO',
          message: `This product has strong organic sales (${sales.quantity} items sold) but no marketing spend. Consider launching ad test campaigns.`
        });
      }

      item.gapChecks = {
        hasGap,
        wastedSpend,
        warnings
      };

      return item;
    })
    .filter(item => item.adSpend > 0);

  // 8. Calculate Shopify Metrics Summary
  const validOrders = dbOrders.filter(o => o.cancelledAt === null);
  const totalRevenue = validOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
  const totalOrders = validOrders.length;
  const uniqueEmails = new Set(validOrders.map(o => o.email).filter(Boolean));
  const totalCustomers = uniqueEmails.size;
  const currency = validOrders[0]?.currency || currencyCode;

  // Compute channel breakdown
  const channels = {
    'Meta': { orders: 0, revenue: 0 },
    'Google': { orders: 0, revenue: 0 },
    'TikTok': { orders: 0, revenue: 0 },
    'Pinterest': { orders: 0, revenue: 0 },
    'Email': { orders: 0, revenue: 0 },
    'Organic/Direct': { orders: 0, revenue: 0 },
    'Other': { orders: 0, revenue: 0 }
  };

  validOrders.forEach(o => {
    const channel = getOrderChannel(o.attribution?.utmSource || '', o.referringSite || '', o.attribution?.clickId || '');
    channels[channel].orders++;
    channels[channel].revenue += (o.totalPrice || 0);
  });

  const channelBreakdown = Object.entries(channels)
    .map(([name, data]) => ({
      channel: name,
      orders: data.orders,
      revenue: parseFloat(data.revenue.toFixed(2))
    }))
    .filter(c => c.orders > 0)
    .sort((a, b) => b.revenue - a.revenue);

  const metaRevenue = totalMetaRevenue;
  const metaOrdersCount = totalMetaOrdersCount;
  const metaCustomersCount = totalMetaEmails.size;

  const shopifySummary = {
    totalRevenue,
    totalOrders,
    totalCustomers,
    currency,
    metaRevenue,
    metaOrdersCount,
    metaCustomersCount,
    channelBreakdown
  };

  console.log(`[Shopify API Route] Compiled performance report: products=${productPerformance.length}, alerts=${wastedBudgetAlerts.length}, totalOrders=${totalOrders}`);

  return {
    productPerformance,
    wastedBudgetAlerts,
    shopifySummary,
    totalProductsCount: dbProducts.length,
    metaAdsCount: metaAds.length,
    unmatchedAdsCount: unmatchedAds.length,
    unmatchedAds
  };
}

// Helper to classify order traffic source channels
export function getOrderChannel(utmSource, referringSite, clickId = '') {
  const src = (utmSource || '').toLowerCase().trim();
  const ref = (referringSite || '').toLowerCase().trim();
  const cid = (clickId || '').toLowerCase().trim();

  if (cid || ['facebook', 'instagram', 'meta', 'fb', 'ig'].some(k => src.includes(k) || ref.includes(k))) {
    return 'Meta';
  }
  if (['google', 'youtube', 'gads', 'google_ads'].some(k => src.includes(k) || ref.includes(k))) {
    return 'Google';
  }
  if (['tiktok', 'tt', 'bytedance'].some(k => src.includes(k) || ref.includes(k))) {
    return 'TikTok';
  }
  if (['pinterest', 'pin'].some(k => src.includes(k) || ref.includes(k))) {
    return 'Pinterest';
  }
  if (['newsletter', 'email', 'klaviyo', 'mailchimp'].some(k => src.includes(k))) {
    return 'Email';
  }
  if (!utmSource && !referringSite) {
    return 'Organic/Direct';
  }
  return 'Other';
}


