'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

const EMPTY_PRODUCTS = [];
const EMPTY_ORDERS = [];
const DEFAULT_SHOPIFY_SUMMARY = { totalRevenue: 0, totalOrders: 0, totalCustomers: 0, currency: 'PKR' };
const EMPTY_ALERTS = [];
const EMPTY_PERFORMANCE = [];

const getDateRangeParams = (range) => {
  if (!range) return {};
  
  if (range.preset === 'custom' && range.since && range.until) {
    return {
      start_date: new Date(range.since).toISOString(),
      end_date: new Date(range.until + 'T23:59:59').toISOString()
    };
  }
  
  const end = new Date();
  const start = new Date();
  
  switch (range.preset) {
    case 'last_7d':
      start.setDate(end.getDate() - 7);
      break;
    case 'last_14d':
      start.setDate(end.getDate() - 14);
      break;
    case 'last_30d':
      start.setDate(end.getDate() - 30);
      break;
    case 'last_90d':
      start.setDate(end.getDate() - 90);
      break;
    default:
      start.setDate(end.getDate() - 30);
  }
  
  return {
    start_date: start.toISOString(),
    end_date: end.toISOString()
  };
};

export function useShopifyDashboard(metaAds = [], dateRange = { preset: 'last_30d' }) {
  const [shopifyToken, setShopifyToken] = useState('');
  const [shopifyStoreUrl, setShopifyStoreUrl] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState(null);

  const [nextPageInfo, setNextPageInfo] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Load credentials from localStorage on mount
  useEffect(() => {
    let storedToken = localStorage.getItem('shopifyAccessToken') || localStorage.getItem('omsToken');
    let storedUrl = localStorage.getItem('shopifyStoreUrl');
    if (storedToken && storedUrl) {
      setShopifyToken(storedToken.trim());
      setShopifyStoreUrl(storedUrl.trim());
      setIsConnected(true);
    }
  }, []);

  // Fetch data from Next.js server-side API proxy
  const fetchShopifyData = useCallback(async (urlStr = shopifyStoreUrl, tokenStr = shopifyToken, range = dateRange, forceRefresh = false) => {
    if (!urlStr || !tokenStr) return;
    setLoading(true);
    setError(null);
    try {
      const dates = getDateRangeParams(range);
      console.log("[Shopify Dashboard Hook] fetchShopifyData range:", range, "dates calculated:", dates, "forceRefresh:", forceRefresh);
      let orderUrl = `/api/shopify?type=orders&shopify_url=${encodeURIComponent(urlStr)}&shopify_token=${encodeURIComponent(tokenStr)}&limit=250`;
      if (dates.start_date) {
        orderUrl += `&start_date=${encodeURIComponent(dates.start_date)}`;
      }
      if (dates.end_date) {
        orderUrl += `&end_date=${encodeURIComponent(dates.end_date)}`;
      }

      let prodUrl = `/api/shopify?type=products&shopify_url=${encodeURIComponent(urlStr)}&shopify_token=${encodeURIComponent(tokenStr)}&limit=250`;

      if (forceRefresh) {
        orderUrl += '&refresh=true';
        prodUrl += '&refresh=true';
      }

      console.log("[Shopify Dashboard Hook] Fetching Shopify products and orders in parallel...");
      const [prodRes, orderRes] = await Promise.all([
        fetch(prodUrl),
        fetch(orderUrl)
      ]);

      if (!prodRes.ok) {
        throw new Error(`Products sync failed: ${prodRes.statusText}`);
      }
      if (!orderRes.ok) {
        throw new Error(`Orders sync failed: ${orderRes.statusText}`);
      }

      const prodData = await prodRes.json();
      const orderData = await orderRes.json();

      if (prodData.error) throw new Error(prodData.error);
      if (orderData.error) throw new Error(orderData.error);

      let allProducts = prodData.products || [];
      let nextPage = prodData.nextPageInfo || null;

      // Auto-load remaining pages in background to find all products
      while (nextPage) {
        try {
          console.log(`[Shopify Dashboard Hook] Fetching next page of products...`);
          const res = await fetch(
            `/api/shopify?type=products&limit=250` +
            `&shopify_url=${encodeURIComponent(urlStr)}` +
            `&shopify_token=${encodeURIComponent(tokenStr)}` +
            `&page_info=${encodeURIComponent(nextPage)}`
          );
          if (!res.ok) break;
          const data = await res.json();
          if (data.products) {
            allProducts = [...allProducts, ...data.products];
          }
          nextPage = data.nextPageInfo || null;
        } catch (e) {
          console.warn('Failed to fetch paginated products in background:', e);
          break;
        }
      }

      setProducts(allProducts);
      setOrders(orderData.orders || []);
      setNextPageInfo(null);
    } catch (err) {
      console.error("[Shopify Dashboard Hook Error]", err);
      setError(err.message || 'An error occurred while loading data from Shopify.');
    } finally {
      setLoading(false);
    }
  }, [shopifyStoreUrl, shopifyToken, dateRange]);

  // Load more products for pagination
  const loadMoreProducts = useCallback(async () => {
    if (!shopifyToken || !shopifyStoreUrl || !nextPageInfo || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(
        `/api/shopify?type=products&limit=50` +
        `&shopify_url=${encodeURIComponent(shopifyStoreUrl)}` +
        `&shopify_token=${encodeURIComponent(shopifyToken)}` +
        `&page_info=${encodeURIComponent(nextPageInfo)}`
      );
      if (!res.ok) {
        throw new Error(`Failed to load more products: ${res.statusText}`);
      }
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }
      setProducts(prev => [...prev, ...(data.products || [])]);
      setNextPageInfo(data.nextPageInfo || null);
    } catch (err) {
      console.error('Error paginating products:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [shopifyToken, shopifyStoreUrl, nextPageInfo, loadingMore]);

  // Trigger fetch if credentials or date range change
  useEffect(() => {
    if (isConnected && shopifyToken && shopifyStoreUrl) {
      fetchShopifyData(shopifyStoreUrl, shopifyToken, dateRange);
    }
  }, [isConnected, shopifyToken, shopifyStoreUrl, dateRange, fetchShopifyData]);

  // Connect automatically using Shopify OAuth redirection (DEPRECATED for OMS, stubbed out to prevent crashes)
  const connectOauth = useCallback((shopUrl, actId, fbToken) => {
    console.warn("connectOauth is deprecated and has no effect with OMS.");
  }, []);

  // Connect manually with store URL and admin access token
  const connectManual = useCallback((shopUrl, token) => {
    const cleanUrl = shopUrl.trim();
    const cleanToken = token.trim();

    localStorage.setItem('shopifyStoreUrl', cleanUrl);
    localStorage.setItem('shopifyAccessToken', cleanToken);

    setShopifyStoreUrl(cleanUrl);
    setShopifyToken(cleanToken);
    setIsConnected(true);
  }, []);

  // Disconnect and wipe localStorage keys
  const disconnect = useCallback(() => {
    localStorage.removeItem('shopifyStoreUrl');
    localStorage.removeItem('shopifyAccessToken');
    localStorage.removeItem('omsToken');
    localStorage.removeItem('token');
    setShopifyToken('');
    setShopifyStoreUrl('');
    setProducts([]);
    setOrders([]);
    setNextPageInfo(null);
    setIsConnected(false);
    setError(null);
  }, []);

  // Helper function to match Meta Ad to a Product
  const matchAdToProduct = useCallback((ad, shopifyProducts) => {
    const url = (ad.finalUrl || ad.creative?.url_tags || '').toLowerCase();

    const handleRegex = /\/products\/([a-zA-Z0-9-_]+)/;
    const match = url.match(handleRegex);
    if (match && match[1]) {
      const handle = match[1];
      const product = shopifyProducts.find(p => p.handle.toLowerCase() === handle);
      if (product) return product;
    }

    const adNameLower = ad.name.toLowerCase();
    for (const product of shopifyProducts) {
      if (adNameLower.includes(product.title.toLowerCase())) {
        return product;
      }
      for (const variant of product.variants) {
        if (variant.sku && adNameLower.includes(variant.sku.toLowerCase())) {
          return product;
        }
      }
    }

    return null;
  }, []);

  // 1. Wasted Budget Alerts Engine
  const wastedBudgetAlerts = useMemo(() => {
    if (!isConnected || products.length === 0 || metaAds.length === 0) return [];

    const alerts = [];

    metaAds.forEach(ad => {
      const isActive = ad.status.toUpperCase() === 'ACTIVE' || ad.raw?.effective_status === 'ACTIVE';
      const hasSpend = ad.cost > 0;

      if (isActive && hasSpend) {
        const product = matchAdToProduct(ad, products);
        if (product) {
          const totalStock = product.variants.reduce((sum, v) => sum + (v.inventory_quantity || 0), 0);

          if (totalStock <= 0) {
            alerts.push({
              adId: ad.id,
              adName: ad.name,
              adSetName: ad.adGroupName || '—',
              campaignName: ad.campaignName || '—',
              spend: ad.cost,
              clicks: ad.clicks,
              shopifyProductId: product.id,
              productTitle: product.title,
              sku: product.variants[0]?.sku || 'No SKU',
              inventoryQuantity: totalStock,
              status: ad.status,
              adUrl: ad.finalUrl || '#',
            });
          }
        }
      }
    });

    return alerts;
  }, [isConnected, products, metaAds, matchAdToProduct]);

  // 2. Product Performance Engine
  const productPerformance = useMemo(() => {
    if (!isConnected || products.length === 0) return [];

    const perfMap = {};

    products.forEach(p => {
      perfMap[p.id] = {
        product: p,
        adSpend: 0,
        adClicks: 0,
        attributedSales: 0,
        attributedRevenue: 0,
        matchedAds: [],
      };
    });

    metaAds.forEach(ad => {
      const product = matchAdToProduct(ad, products);
      if (product && perfMap[product.id]) {
        perfMap[product.id].adSpend += ad.cost || 0;
        perfMap[product.id].adClicks += ad.clicks || 0;
        perfMap[product.id].attributedSales += ad.insights?.conversions || 0;
        perfMap[product.id].attributedRevenue += ad.insights?.conversion_values || 0;
        perfMap[product.id].matchedAds.push(ad);
      }
    });

    console.log('🔮 [useShopifyDashboard] productPerformance debug:', {
      isConnected,
      productsCount: products.length,
      ordersCount: orders.length,
      metaAdsCount: metaAds.length,
      matchedProducts: Object.values(perfMap).filter(p => p.adSpend > 0).map(p => ({ title: p.product.title, spend: p.adSpend }))
    });

    const salesMap = {};

    orders.forEach(order => {
      const isCancelled = order.cancelled_at !== null;
      if (!isCancelled) {
        // Parse UTM parameters from landing site to check for Meta attribution
        let isMetaAttributed = false;
        if (order.landing_site) {
          try {
            const url = new URL(order.landing_site, 'https://dummybase.com');
            const source = url.searchParams.get('utm_source')?.toLowerCase();
            const clickId = url.searchParams.get('fbclid');

            if (['facebook', 'meta', 'instagram', 'fb', 'ig'].includes(source) || clickId) {
              isMetaAttributed = true;
            }
          } catch (e) {
            // URL parse safety fallback
          }
        }

        if (order.referring_site && !isMetaAttributed) {
          const ref = order.referring_site.toLowerCase();
          if (ref.includes('facebook.com') || ref.includes('instagram.com')) {
            isMetaAttributed = true;
          }
        }

        order.line_items.forEach(item => {
          if (item.product_id) {
            if (!salesMap[item.product_id]) {
              salesMap[item.product_id] = { quantity: 0, revenue: 0, metaQuantity: 0, metaRevenue: 0 };
            }
            salesMap[item.product_id].quantity += item.quantity || 0;
            salesMap[item.product_id].revenue += (parseFloat(item.price) * (item.quantity || 0));

            if (isMetaAttributed) {
              salesMap[item.product_id].metaQuantity += item.quantity || 0;
              salesMap[item.product_id].metaRevenue += (parseFloat(item.price) * (item.quantity || 0));
            }
          }
        });
      }
    });

    return Object.values(perfMap).map(({ product, adSpend, adClicks, attributedSales, attributedRevenue, matchedAds }) => {
      const totalStock = product.variants.reduce((sum, v) => sum + (v.inventory_quantity || 0), 0);
      const actualSales = salesMap[product.id] || { quantity: 0, revenue: 0, metaQuantity: 0, metaRevenue: 0 };
      
      const trueROAS = adSpend > 0 ? actualSales.revenue / adSpend : 0;
      const metaAttributedROAS = adSpend > 0 ? actualSales.metaRevenue / adSpend : 0;

      return {
        productId: product.id,
        productTitle: product.title,
        sku: product.variants[0]?.sku || '—',
        inventoryQuantity: totalStock,
        shopifySalesQuantity: actualSales.quantity,
        shopifyRevenue: actualSales.revenue,
        metaSalesQuantity: actualSales.metaQuantity,
        metaRevenue: actualSales.metaRevenue,
        adSpend,
        adClicks,
        attributedSales,
        attributedRevenue,
        trueROAS,
        metaAttributedROAS,
        productImageUrl: product.image?.src || (product.images && product.images[0]?.src) || null,
        matchedAds,
      };
    });
  }, [isConnected, products, orders, metaAds, matchAdToProduct]);

  // 3. Store Metrics Summary
  const shopifySummary = useMemo(() => {
    if (!isConnected || orders.length === 0) {
      return DEFAULT_SHOPIFY_SUMMARY;
    }

    const validOrders = orders.filter(o => o.cancelled_at === null);
    const totalRevenue = validOrders.reduce((sum, o) => sum + parseFloat(o.total_price || '0'), 0);
    const totalOrders = validOrders.length;

    const uniqueEmails = new Set(validOrders.map(o => o.email).filter(Boolean));
    const totalCustomers = uniqueEmails.size;

    const currency = validOrders[0]?.currency || 'PKR';

    return { totalRevenue, totalOrders, totalCustomers, currency };
  }, [isConnected, orders]);

  const triggerRefresh = useCallback(() => {
    if (shopifyStoreUrl && shopifyToken) {
      fetchShopifyData(shopifyStoreUrl, shopifyToken, dateRange, true);
    }
  }, [shopifyStoreUrl, shopifyToken, dateRange, fetchShopifyData]);

  return {
    shopifyUrl: "OMS",
    isConnected,
    loading,
    products: products || EMPTY_PRODUCTS,
    orders: orders || EMPTY_ORDERS,
    error,
    wastedBudgetAlerts: wastedBudgetAlerts || EMPTY_ALERTS,
    productPerformance: productPerformance || EMPTY_PERFORMANCE,
    shopifySummary: shopifySummary || DEFAULT_SHOPIFY_SUMMARY,
    nextPageInfo,
    loadingMore,
    connectOauth,
    connectManual,
    disconnect,
    refresh: triggerRefresh,
    loadMoreProducts,
  };
}
