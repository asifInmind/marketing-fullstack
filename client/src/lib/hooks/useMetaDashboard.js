'use client'
// ============================================
// USE META DASHBOARD HOOK
// ============================================

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

const EMPTY_ARRAY = [];
const DEFAULT_META_SUMMARY = {
  totalCampaigns: 0,
  totalAdSets: 0,
  totalAds: 0,
  totalSpend: 0,
  totalImpressions: 0,
  totalClicks: 0,
  totalConversions: 0,
  totalRevenue: 0,
  avgCTR: 0,
  avgCPC: 0,
  avgROAS: 0,
  activeCampaigns: 0,
  pausedCampaigns: 0,
  averageROAS: 0,
};

import {
  transformCampaigns,
  transformAdSets,
  transformAds,
} from '../utils/metaTransformers.js';

export function useMetaDashboard(accessToken, accountId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingInsights, setLoadingInsights] = useState(true);
  const [loadingMore, setLoadingMore] = useState({
    campaigns: false,
    adSets: false,
    ads: false,
  });
  const [loadingCreatives, setLoadingCreatives] = useState(false);
  const [error, setError] = useState(null);
  const [tokenExpired, setTokenExpired] = useState(false);
  const [dateRange, setDateRange] = useState({
    preset: 'last_30d',
  });
  
  const configRef = useRef({
    accessToken,
    accountId,
    dateRange,
  });
  
  // Update config when params change
  useEffect(() => {
    configRef.current = {
      accessToken,
      accountId,
      dateRange,
    };
  }, [accessToken, accountId, dateRange]);
  
  // Transform data (memoized to prevent new array references on every render)
  const transformed = useMemo(() => {
    if (!data) return null;
    
    return {
      campaigns: transformCampaigns(data.campaigns, data.campaignInsights),
      adSets: transformAdSets(data.adSets, data.adSetInsights),
      ads: transformAds(data.ads, data.adInsights, data.creatives),
      summary: data.summary,
    };
  }, [data]);
  
  // Fetch dashboard data
  const fetchDashboard = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setLoadingInsights(true);
    setError(null);
    
    const baseParams = new URLSearchParams({
      account_id: configRef.current.accountId,
      date_preset: configRef.current.dateRange?.preset || 'last_30d',
      page_size: String(configRef.current.pageSize || 10),
    });

    const storedShopUrl = localStorage.getItem('shopifyStoreUrl');
    if (storedShopUrl) {
      baseParams.append('shopify_url', storedShopUrl);
    }

    if (configRef.current.dateRange?.since) {
      baseParams.append('since', configRef.current.dateRange.since);
    }
    if (configRef.current.dateRange?.until) {
      baseParams.append('until', configRef.current.dateRange.until);
    }

    try {
      console.log('📡 Step 1: Fetching dashboard structure (forceRefresh:', forceRefresh, ')...');
      const structParams = new URLSearchParams(baseParams);
      structParams.append('type', 'structure');
      if (forceRefresh) {
        structParams.append('refresh', 'true');
      }

      const structResponse = await fetch(`/api/meta?${structParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${configRef.current.accessToken}`
        }
      });
      const structResult = await structResponse.json();

      if (!structResult.success) {
        throw new Error(structResult.error || 'Failed to fetch dashboard structure');
      }

      console.log('✅ Structure fetched:', {
        campaigns: structResult.data.campaigns?.length || 0,
        adSets: structResult.data.adSets?.length || 0,
        ads: structResult.data.ads?.length || 0,
      });

      setData(structResult.data);
      setLoading(false); // Stop structure loading spinner, show UI

      // Step 2: Fetch insights in the background
      console.log('📡 Step 2: Fetching dashboard insights (forceRefresh:', forceRefresh, ')...');
      const insightsParams = new URLSearchParams(baseParams);
      insightsParams.append('type', 'insights');
      if (forceRefresh) {
        insightsParams.append('refresh', 'true');
      }

      fetch(`/api/meta?${insightsParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${configRef.current.accessToken}`
        }
      })
        .then(res => res.json())
        .then(insightsResult => {
          if (insightsResult.success) {
            console.log('✅ Insights fetched successfully');
            setData(prev => {
              if (!prev) return null;
              return {
                ...prev,
                campaignInsights: insightsResult.data.campaignInsights || {},
                adSetInsights: insightsResult.data.adSetInsights || {},
                adInsights: insightsResult.data.adInsights || {},
                summary: {
                  ...prev.summary,
                  ...insightsResult.data.summary,
                },
                loading: {
                  ...prev.loading,
                  insights: false
                }
              };
            });
          } else {
            // Check if the token has expired
            if (insightsResult.code === 'TOKEN_EXPIRED') {
              console.warn('⚠️ Meta token expired - insights unavailable. User must reconnect.');
              setTokenExpired(true);
              setError('Meta access token has expired. Please reconnect your Meta account.');
            } else {
              console.warn('⚠️ Failed to fetch insights:', insightsResult.error);
            }
          }
        })
        .catch(err => {
          console.warn('⚠️ Insights network error:', err);
        })
        .finally(() => {
          setLoadingInsights(false);
        });

      // Step 3: Fetch creatives in the background (enables instant Shopify matching)
      if (structResult.data.ads && structResult.data.ads.length > 0) {
        setLoadingCreatives(true);
        fetch('/api/meta', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            accessToken: configRef.current.accessToken,
            accountId: configRef.current.accountId,
            type: 'creatives',
            ads: structResult.data.ads,
          }),
        })
          .then(res => res.json())
          .then(creativesResult => {
            if (creativesResult.success) {
              console.log('✅ Creatives fetched successfully in background');
              setData(prev => {
                if (!prev) return null;
                return {
                  ...prev,
                  creatives: {
                    ...prev.creatives,
                    ...creativesResult.data,
                  }
                };
              });
            }
          })
          .catch(err => {
            console.warn('⚠️ Creatives network error:', err);
          })
          .finally(() => {
            setLoadingCreatives(false);
          });
      }

    } catch (err) {
      // Check if the error is a token expiry from the structure fetch
      if (err.message?.includes('TOKEN_EXPIRED') || err.message?.includes('expired')) {
        setTokenExpired(true);
      }
      setError(err.message || 'Failed to fetch dashboard data');
      setData(null);
      setLoading(false);
      setLoadingInsights(false);
    }
  }, []);
  
  // Load more function
  const loadMore = useCallback(async (type) => {
    if (!data) return;
    
    // We fetch from the proxy API via POST
    const typeMap = {
      campaigns: {
        hasMore: data.pagination.campaigns.hasMore,
        after: data.pagination.campaigns.after,
        setter: (newData) => {
          setData(prev => ({
            ...prev,
            campaigns: [...prev.campaigns, ...newData.data.data],
            pagination: {
              ...prev.pagination,
              campaigns: {
                hasMore: !!newData.data.paging?.next,
                after: newData.data.paging?.cursors?.after,
              },
            },
          }));
        },
      },
      adSets: {
        hasMore: data.pagination.adSets.hasMore,
        after: data.pagination.adSets.after,
        setter: (newData) => {
          setData(prev => ({
            ...prev,
            adSets: [...prev.adSets, ...newData.data.data],
            pagination: {
              ...prev.pagination,
              adSets: {
                hasMore: !!newData.data.paging?.next,
                after: newData.data.paging?.cursors?.after,
              },
            },
          }));
        },
      },
      ads: {
        hasMore: data.pagination.ads.hasMore,
        after: data.pagination.ads.after,
        setter: (newData) => {
          setData(prev => ({
            ...prev,
            ads: [...prev.ads, ...newData.data.data],
            pagination: {
              ...prev.pagination,
              ads: {
                hasMore: !!newData.data.paging?.next,
                after: newData.data.paging?.cursors?.after,
              },
            },
          }));
        },
      },
    };
    
    const config = typeMap[type];
    if (!config.hasMore || !config.after) return;
    
    setLoadingMore(prev => ({ ...prev, [type]: true }));
    
    try {
      const response = await fetch('/api/meta', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessToken: configRef.current.accessToken,
          accountId: configRef.current.accountId,
          type,
          after: config.after,
          datePreset: dateRange.preset,
          pageSize: configRef.current.pageSize || 10,
        }),
      });
      
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || `Failed to load more ${type}`);
      }
      
      config.setter(result);
    } catch (err) {
      setError(err.message || `Failed to load more ${type}`);
    } finally {
      setLoadingMore(prev => ({ ...prev, [type]: false }));
    }
  }, [data, dateRange]);
  
  // Load creatives for ads
  const loadCreatives = useCallback(async (adIds) => {
    if (!data || adIds.length === 0) return;
    
    const adsWithoutCreatives = data.ads.filter(
      ad => adIds.includes(ad.id) && !data.creatives[ad.id]
    );
    
    if (adsWithoutCreatives.length === 0) return;
    
    setLoadingCreatives(true);
    
    try {
      // In the server setup, loadCreativesForAds is handled inside the backend server,
      // but if the client initiates it, we proxy it.
      // Wait, let's keep loadCreatives proxy if needed, or if it isn't used, we can configure it.
      // Wait! The frontend hook had a direct call to the frontend library functions `loadCreativesForAds`.
      // Let's modify this to fetch from backend instead!
      // In backend meta controller/route: we can add a route for loading creatives, or handle it as a post.
      // Let's check: was there an endpoint for creatives? No, the backend didn't expose loadCreatives directly,
      // but wait! The backend handles campaigns, adsets, ads, structure, insights.
      // Let's see: is loadCreatives used? Let's check if the frontend hook can make a request to the backend.
      // Wait, let's implement the proxy endpoint for creatives on the server side if needed, or we can fetch it.
      // Let's check if we can make a POST request to `/api/meta` with `type: 'creatives'`!
      // Wait! Let's check if the backend route `/api/meta` supports `type: 'creatives'`.
      // Let's look at `server/src/routes/meta.js`:
      // Switch type: 'campaigns', 'adSets', 'ads'. No 'creatives'.
      // Wait, let's see if we should add it!
      // Let's look at how `useMetaDashboard.ts` was doing it:
      // It was importing `loadCreativesForAds` from `../api/metaApi` directly into the client!
      // Ah! The original frontend was running `loadCreativesForAds` *client-side* directly calling the Facebook Graph API from the browser!
      // Since it requires calling Facebook, we can either proxy it or do it client-side. But since we are separating the backend completely,
      // let's do it client-side or proxy it. Since the user wants ALL APIs to be in the backend, let's add `creatives` to the backend POST router!
      // Let's check if the backend already has `loadCreativesForAds` in `backend/src/lib/metaApi.js`.
      // Yes! It was fully migrated to `server/src/lib/metaApi.js`!
      // So all we need to do is modify `server/src/routes/meta.js` to support `case 'creatives'` in POST, and then calling `loadCreativesForAds(ads, config)`!
      // This is extremely elegant and keeps the backend 100% separate!
      // Let's write the hook call to fetch `/api/meta` with type `creatives`:
      const response = await fetch('/api/meta', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessToken: configRef.current.accessToken,
          accountId: configRef.current.accountId,
          type: 'creatives',
          ads: adsWithoutCreatives,
        }),
      });
      
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to load creatives');
      }
      
      setData(prev => ({
        ...prev,
        creatives: {
          ...prev.creatives,
          ...result.data,
        },
      }));
    } catch (err) {
      setError(err.message || 'Failed to load creatives');
    } finally {
      setLoadingCreatives(false);
    }
  }, [data]);
  
  // Set date range
  const handleSetDateRange = useCallback((range) => {
    setDateRange(range);
  }, []);
  
  // Initial fetch
  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);
  
  // Refresh when date range changes
  useEffect(() => {
    if (!loading) {
      fetchDashboard();
    }
  }, [dateRange]);
  
  const hasMore = useMemo(() => ({
    campaigns: data?.pagination.campaigns.hasMore || false,
    adSets: data?.pagination.adSets.hasMore || false,
    ads: data?.pagination.ads.hasMore || false,
  }), [
    data?.pagination.campaigns.hasMore,
    data?.pagination.adSets.hasMore,
    data?.pagination.ads.hasMore
  ]);
  
  const triggerRefresh = useCallback(() => {
    fetchDashboard(true);
  }, [fetchDashboard]);

  return {
    campaigns: transformed?.campaigns || EMPTY_ARRAY,
    adSets: transformed?.adSets || EMPTY_ARRAY,
    ads: transformed?.ads || EMPTY_ARRAY,
    summary: data?.summary || DEFAULT_META_SUMMARY,
    loading,
    loadingInsights,
    loadingMore,
    loadingCreatives,
    hasMore,
    error,
    loadMore,
    loadCreatives,
    refresh: triggerRefresh,
    setDateRange: handleSetDateRange,
    dateRange,
    tokenExpired,
  };
}
