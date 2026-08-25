'use client'
// ============================================
// USE META DASHBOARD HOOK
// ============================================

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';

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

      const structResponse = await fetch(`${BACKEND_URL}/api/meta?${structParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${configRef.current.accessToken}`
        }
      });

      if (!structResponse.ok) {
        if (structResponse.status === 429) {
          throw new Error('You are requesting too much data. Please reduce your date range or wait a moment and try again.');
        }
        const text = await structResponse.text();
        if (text.toLowerCase().includes('rate limit') || text.toLowerCase().includes('too many requests')) {
          throw new Error('You are requesting too much data. Please reduce your date range or wait a moment and try again.');
        }
        throw new Error('Internal Server Error. Please reduce your date range or try again in a few moments.');
      }

      let structResult;
      try {
        structResult = await structResponse.json();
      } catch (e) {
        throw new Error('Internal Server Error. Please reduce your date range or try again in a few moments.');
      }

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

      // Step 2: Fetch insights sequentially
      console.log('📡 Step 2: Fetching dashboard insights (forceRefresh:', forceRefresh, ')...');
      const insightsParams = new URLSearchParams(baseParams);
      insightsParams.append('type', 'insights');
      if (forceRefresh) {
        insightsParams.append('refresh', 'true');
      }

      try {
        const insightsRes = await fetch(`${BACKEND_URL}/api/meta?${insightsParams.toString()}`, {
          headers: {
            'Authorization': `Bearer ${configRef.current.accessToken}`
          }
        });

        if (!insightsRes.ok) {
          if (insightsRes.status === 429) {
            setError('You are requesting too much data. Please reduce your date range or wait a moment and try again.');
            return;
          }
          const text = await insightsRes.text();
          if (text.toLowerCase().includes('rate limit') || text.toLowerCase().includes('too many requests')) {
            setError('You are requesting too much data. Please reduce your date range or wait a moment and try again.');
            return;
          }
          setError('Failed to load insights. Please reduce your date range or try again in a few moments.');
          return;
        }

        let insightsResult;
        try {
          insightsResult = await insightsRes.json();
        } catch (e) {
          setError('Failed to parse insights. Please try again in a few moments.');
          return;
        }
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
          if (insightsResult.code === 'TOKEN_EXPIRED') {
            console.warn('⚠️ Meta token expired - insights unavailable. User must reconnect.');
            setTokenExpired(true);
            setError('Meta access token has expired. Please reconnect your Meta account.');
          } else {
            console.warn('⚠️ Failed to fetch insights:', insightsResult.error);
          }
        }
      } catch (err) {
        console.warn('⚠️ Insights network error:', err);
      } finally {
        setLoadingInsights(false);
      }

      // Step 3: Fetch creatives sequentially (enables instant Shopify matching)
      if (structResult.data.ads && structResult.data.ads.length > 0) {
        setLoadingCreatives(true);
        try {
          const creativesRes = await fetch(`${BACKEND_URL}/api/meta`, {
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
          });
          const creativesResult = await creativesRes.json();
          if (creativesResult.success) {
            console.log('✅ Creatives fetched successfully');
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
        } catch (err) {
          console.warn('⚠️ Creatives network error:', err);
        } finally {
          setLoadingCreatives(false);
        }
      }

    } catch (err) {
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
        hasMore: data.pagination?.campaigns?.hasMore,
        after: data.pagination?.campaigns?.after,
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
        hasMore: data.pagination?.adSets?.hasMore,
        after: data.pagination?.adSets?.after,
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
        hasMore: data.pagination?.ads?.hasMore,
        after: data.pagination?.ads?.after,
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
      const response = await fetch(`${BACKEND_URL}/api/meta`, {
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
      
      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('You are requesting too much data. Please reduce your date range or wait a moment and try again.');
        }
        const text = await response.text();
        if (text.toLowerCase().includes('rate limit') || text.toLowerCase().includes('too many requests')) {
          throw new Error('You are requesting too much data. Please reduce your date range or wait a moment and try again.');
        }
        throw new Error('Failed to fetch more data. Please try again in a moment.');
      }
      
      let result;
      try {
        result = await response.json();
      } catch (e) {
        throw new Error('Failed to parse data response. Please try again in a moment.');
      }
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
    
    const adsList = data.ads || [];
    const creatives = data.creatives || {};
    const adsWithoutCreatives = adsList.filter(
      ad => adIds.includes(ad.id) && !creatives[ad.id]
    );
    
    if (adsWithoutCreatives.length === 0) return;
    
    setLoadingCreatives(true);
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/meta`, {
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
      
      setData(prev => {
        if (!prev) return null;
        return {
          ...prev,
          creatives: {
            ...(prev.creatives || {}),
            ...result.data,
          },
        };
      });
    } catch (err) {
      console.warn('⚠️ Failed to load creatives:', err.message);
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
    campaigns: data?.pagination?.campaigns?.hasMore || false,
    adSets: data?.pagination?.adSets?.hasMore || false,
    ads: data?.pagination?.ads?.hasMore || false,
  }), [
    data?.pagination?.campaigns?.hasMore,
    data?.pagination?.adSets?.hasMore,
    data?.pagination?.ads?.hasMore
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
