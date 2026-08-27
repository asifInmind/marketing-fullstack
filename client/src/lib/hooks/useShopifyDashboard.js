'use client';

import { useState, useEffect, useCallback } from 'react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';

const EMPTY_ARRAY = [];
const DEFAULT_SHOPIFY_SUMMARY = { totalRevenue: 0, totalOrders: 0, totalCustomers: 0, currency: 'PKR' };

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
    default:
      start.setDate(end.getDate() - 30);
  }
  
  return {
    start_date: start.toISOString(),
    end_date: end.toISOString()
  };
};

export function useShopifyDashboard(metaAds = [], dateRange = { preset: 'last_30d' }, isMetaLoading = false) {
  const [shopifyToken, setShopifyToken] = useState('');
  const [shopifyStoreUrl, setShopifyStoreUrl] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [productPerformance, setProductPerformance] = useState([]);
  const [wastedBudgetAlerts, setWastedBudgetAlerts] = useState([]);
  const [shopifySummary, setShopifySummary] = useState(DEFAULT_SHOPIFY_SUMMARY);
  const [totalStoreProducts, setTotalStoreProducts] = useState(0);
  const [unmatchedAds, setUnmatchedAds] = useState([]);
  const [error, setError] = useState(null);

  // Load credentials from localStorage or URL OAuth callback on mount
  useEffect(() => {
    // 1. Check for active OAuth redirection callback on load
    if (typeof window !== 'undefined' && window.location.search) {
      const params = new URLSearchParams(window.location.search);
      const oauthShop = params.get('shop');
      const oauthSuccess = params.get('oauth') === 'success';

      if (oauthShop && oauthSuccess) {
        console.log(`[Shopify OAuth Hook] Detected successful OAuth callback for shop: ${oauthShop}`);
        
        localStorage.setItem('shopifyStoreUrl', oauthShop);
        localStorage.setItem('shopifyAccessToken', 'oauth');

        setShopifyStoreUrl(oauthShop);
        setShopifyToken('oauth');
        setIsConnected(true);

        // Clean up parameters from browser URL bar to keep it tidy
        const newUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, document.title, newUrl);
        return; // Skip loading from localStorage since we just set it
      }
    }

    // 2. Fallback: Load credentials from localStorage
    let storedToken = localStorage.getItem('shopifyAccessToken') || localStorage.getItem('omsToken');
    let storedUrl = localStorage.getItem('shopifyStoreUrl');
    if (storedToken && storedUrl) {
      setShopifyToken(storedToken.trim());
      setShopifyStoreUrl(storedUrl.trim());
      setIsConnected(true);
    }
  }, []);

  // Fetch pre-calculated catalog performance from the backend
  const fetchShopifyData = useCallback(async (urlStr = shopifyStoreUrl, tokenStr = shopifyToken, range = dateRange, forceRefresh = false) => {
    if (!urlStr || !tokenStr) return;
    setLoading(true);
    setError(null);
    try {
      const dates = getDateRangeParams(range);
      console.log("[Shopify Dashboard Hook] Fetching performance calculations from backend:", range, dates);
      
      let perfUrl = `${BACKEND_URL}/api/shopify?type=performance&shopify_url=${encodeURIComponent(urlStr)}&shopify_token=${encodeURIComponent(tokenStr)}`;
      
      if (dates.start_date) {
        perfUrl += `&start_date=${encodeURIComponent(dates.start_date)}`;
      }
      if (dates.end_date) {
        perfUrl += `&end_date=${encodeURIComponent(dates.end_date)}`;
      }
      if (forceRefresh) {
        perfUrl += '&refresh=true';
      }

      const res = await fetch(perfUrl);
      if (!res.ok) {
        if (res.status === 429) {
          throw new Error('You are requesting too much data. Please reduce your date range or wait a moment and try again.');
        }
        const text = await res.text();
        if (text.toLowerCase().includes('rate limit') || text.toLowerCase().includes('too many requests')) {
          throw new Error('You are requesting too much data. Please reduce your date range or wait a moment and try again.');
        }
        throw new Error('Internal Server Error. Please reduce your date range or try again in a few moments.');
      }

      let json;
      try {
        json = await res.json();
      } catch (e) {
        throw new Error('Internal Server Error. Please reduce your date range or try again in a few moments.');
      }
      if (json.error) throw new Error(json.error);

      setProductPerformance(json.productPerformance || EMPTY_ARRAY);
      setWastedBudgetAlerts(json.wastedBudgetAlerts || EMPTY_ARRAY);
      setShopifySummary(json.shopifySummary || DEFAULT_SHOPIFY_SUMMARY);
      setTotalStoreProducts(json.totalProductsCount || 0);
      setUnmatchedAds(json.unmatchedAds || EMPTY_ARRAY);
    } catch (err) {
      console.error("[Shopify Dashboard Hook Error]", err);
      setError(err.message || 'Failed to fetch calculations from backend');
    } finally {
      setLoading(false);
    }
  }, [shopifyStoreUrl, shopifyToken, dateRange]);

  // Sync data automatically when inputs change, but wait for Meta to finish loading first
  useEffect(() => {
    if (isConnected && shopifyToken && shopifyStoreUrl && !isMetaLoading) {
      fetchShopifyData(shopifyStoreUrl, shopifyToken, dateRange);
    }
  }, [isConnected, shopifyToken, shopifyStoreUrl, dateRange, isMetaLoading, fetchShopifyData]);

  // Connect manual and save localStorage credentials
  const connectManual = useCallback((shopUrl, token) => {
    const cleanUrl = shopUrl.trim();
    const cleanToken = token.trim();

    localStorage.setItem('shopifyStoreUrl', cleanUrl);
    localStorage.setItem('shopifyAccessToken', cleanToken);

    setShopifyStoreUrl(cleanUrl);
    setShopifyToken(cleanToken);
    setIsConnected(true);
  }, []);

  // Disconnect and wipe credentials
  const disconnect = useCallback(() => {
    localStorage.removeItem('shopifyStoreUrl');
    localStorage.removeItem('shopifyAccessToken');
    localStorage.removeItem('omsToken');
    localStorage.removeItem('token');
    setShopifyToken('');
    setShopifyStoreUrl('');
    setProductPerformance([]);
    setWastedBudgetAlerts([]);
    setShopifySummary(DEFAULT_SHOPIFY_SUMMARY);
    setUnmatchedAds([]);
    setIsConnected(false);
    setError(null);
  }, []);

  const connectOauth = useCallback((shopUrl, actId, fbToken) => {
    console.warn("connectOauth is deprecated and has no effect.");
  }, []);

  const loadMoreProducts = useCallback(() => {
    console.log("loadMoreProducts is deprecated with server-side calculations.");
  }, []);

  const triggerRefresh = useCallback(() => {
    if (shopifyStoreUrl && shopifyToken) {
      fetchShopifyData(shopifyStoreUrl, shopifyToken, dateRange, true);
    }
  }, [shopifyStoreUrl, shopifyToken, dateRange, fetchShopifyData]);

  return {
    shopifyUrl: "OMS",
    isConnected,
    loading,
    products: productPerformance, // Provide alias for backwards compatibility
    orders: EMPTY_ARRAY,
    error,
    wastedBudgetAlerts,
    productPerformance,
    shopifySummary,
    totalStoreProducts: totalStoreProducts || productPerformance.length,
    unmatchedAds,
    nextPageInfo: null,
    loadingMore: false,
    connectOauth,
    connectManual,
    disconnect,
    refresh: triggerRefresh,
    loadMoreProducts,
  };
}
