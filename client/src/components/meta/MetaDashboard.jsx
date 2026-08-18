'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart3,
  Calendar,
  RefreshCw,
  ChevronDown,
  ShoppingBag,
  AlertTriangle,
  ExternalLink,
  X,
  Filter,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  Sparkles,
  Info,
} from 'lucide-react';
import { useMetaDashboard } from '../../lib/hooks/useMetaDashboard.js';
import { useShopifyDashboard } from '../../lib/hooks/useShopifyDashboard.js';
import { ShopifyConnectModal } from '../shopify/ShopifyConnectModal.jsx';
import { MetaMetricCards } from './MetaMetricCards.jsx';
import { MetaCampaignTable } from './MetaCampaignTable.jsx';
import { MetaAdSetTable } from './MetaAdSetTable.jsx';
import { MetaAdTable } from './MetaAdTable.jsx';
import { MetaCampaignDetail } from './MetaCampaignDetail.jsx';
import { MetaAdSetDetail } from './MetaAdSetDetail.jsx';
import { MetaLoadMoreButton } from './MetaLoadMoreButton.jsx';
import { DATE_RANGE_OPTIONS } from '../../lib/utils/constants.js';

export function MetaDashboard({ accessToken, accountId }) {
  const [activeTab, setActiveTab] = useState('campaigns');
  const [selectedDateRange, setSelectedDateRange] = useState('last_30d');
  const [currentTime, setCurrentTime] = useState('');
  const [isShopifyModalOpen, setIsShopifyModalOpen] = useState(false);

  const [selectedCampaignId, setSelectedCampaignId] = useState(null);
  const [showCampaignDetail, setShowCampaignDetail] = useState(false);

  const [selectedAdSetId, setSelectedAdSetId] = useState(null);
  const [showAdSetDetail, setShowAdSetDetail] = useState(false);

  const [shopifyAdFilter, setShopifyAdFilter] = useState('running');
  const [shopifyPerfSort, setShopifyPerfSort] = useState('best');
  const [selectedProductPerformance, setSelectedProductPerformance] = useState(null);

  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const {
    campaigns,
    adSets,
    ads,
    summary,
    loading,
    loadingInsights,
    loadingMore,
    loadingCreatives,
    hasMore,
    error,
    loadMore,
    loadCreatives,
    refresh,
    setDateRange,
    dateRange,
    tokenExpired,
  } = useMetaDashboard(accessToken, accountId);

  const {
    shopifyUrl,
    isConnected: isShopifyConnected,
    loading: shopifyLoading,
    products: shopifyProducts,
    orders: shopifyOrders,
    error: shopifyError,
    wastedBudgetAlerts,
    productPerformance,
    shopifySummary,
    totalStoreProducts,
    nextPageInfo: shopifyNextPageInfo,
    loadingMore: shopifyLoadingMore,
    unmatchedAds,
    connectOauth,
    connectManual,
    disconnect: disconnectShopify,
    refresh: refreshShopify,
    loadMoreProducts,
  } = useShopifyDashboard(ads, dateRange, loading || loadingInsights);

  const [cardsViewMode, setCardsViewMode] = useState('comparison');

  const filteredAndSortedProducts = useMemo(() => {
    // Return all calculated products directly from backend report
    let items = [...productPerformance];

    // Filter by running ads if selected (must have active spend AND at least one ad currently ACTIVE today)
    if (shopifyAdFilter === 'running') {
      items = items.filter(item =>
        item.adSpend > 0 && item.matchedAds?.some(ad => ad.status.toUpperCase() === 'ACTIVE')
      );
    }

    // Sort by Meta ROAS (Best vs Worst)
    items.sort((a, b) => {
      if (shopifyPerfSort === 'best') {
        return b.metaAttributedROAS - a.metaAttributedROAS;
      } else {
        return a.metaAttributedROAS - b.metaAttributedROAS;
      }
    });

    return items;
  }, [productPerformance, shopifyPerfSort, shopifyAdFilter]);

  const campaignNames = useMemo(() => {
    if (!selectedProductPerformance) return [];
    return Array.from(new Set(selectedProductPerformance.matchedAds?.map(ad => ad.campaignName).filter(Boolean)));
  }, [selectedProductPerformance]);

  const adSetNames = useMemo(() => {
    if (!selectedProductPerformance) return [];
    return Array.from(new Set(selectedProductPerformance.matchedAds?.map(ad => ad.adSetName || ad.adGroupName).filter(Boolean)));
  }, [selectedProductPerformance]);

  const adNames = useMemo(() => {
    if (!selectedProductPerformance) return [];
    return Array.from(new Set(selectedProductPerformance.matchedAds?.map(ad => ad.name).filter(Boolean)));
  }, [selectedProductPerformance]);

  const currencyCode = isShopifyConnected ? (shopifySummary?.currency || 'USD') : 'USD';

  const formatShopifyCurrency = useCallback((amount) => {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode,
      }).format(amount);
    } catch {
      return `${currencyCode} ${amount.toFixed(2)}`;
    }
  }, [currencyCode]);

  const getActiveDateRangeLabel = () => {
    if (selectedDateRange === 'custom') {
      return `${customStartDate || '—'} to ${customEndDate || '—'}`;
    }
    const option = DATE_RANGE_OPTIONS.find(opt => opt.value === selectedDateRange);
    return option ? option.label : 'Last 30 Days';
  };

  const selectedCampaign = selectedCampaignId
    ? campaigns.find(c => c.id === selectedCampaignId)
    : null;

  const filteredAdSets = selectedCampaignId
    ? adSets.filter(adSet => adSet.campaignId === selectedCampaignId)
    : adSets;

  const selectedAdSet = selectedAdSetId
    ? adSets.find(s => s.id === selectedAdSetId)
    : null;

  const filteredAds = selectedAdSetId
    ? ads.filter(ad => ad.adSetId === selectedAdSetId)
    : ads;

  const handleCampaignClick = (campaignId) => {
    setSelectedCampaignId(campaignId);
    setShowCampaignDetail(true);
  };

  const handleBackFromDetail = () => {
    setSelectedCampaignId(null);
    setShowCampaignDetail(false);
  };

  const handleAdSetClick = (adSetId) => {
    setSelectedAdSetId(adSetId);
    setShowAdSetDetail(true);
  };

  const handleBackFromAdSetDetail = () => {
    setSelectedAdSetId(null);
    setShowAdSetDetail(false);
  };

  useEffect(() => {
    setCurrentTime(new Date().toLocaleString());
  }, []);

  // Automatically load ad creatives when ads are loaded, updated, or when tab changes
  useEffect(() => {
    if (activeTab === 'ads' && ads && ads.length > 0) {
      const adIds = ads.map(ad => ad.id);
      loadCreatives(adIds);
    }
  }, [ads, activeTab, loadCreatives]);

  const handleDateRangeChange = (value) => {
    setSelectedDateRange(value);
    if (value === 'custom') {
      return;
    }
    setDateRange({ preset: value });
  };

  const handleApplyCustomDate = () => {
    if (customStartDate && customEndDate) {
      setDateRange({
        preset: 'custom',
        since: customStartDate,
        until: customEndDate,
      });
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'ads' && ads.length > 0) {
      const adIds = ads.map(ad => ad.id);
      loadCreatives(adIds);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-xl border border-red-200 dark:border-red-800 p-8 text-center">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
            Failed to Load Dashboard
          </h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
            {error}
          </p>
          <button
            onClick={refresh}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Token Expired Banner */}
      {tokenExpired && (
        <div className="bg-amber-50 dark:bg-amber-950 border-b border-amber-200 dark:border-amber-800 px-4 py-3">
          <div className="w-[90%] max-w-[1600px] mx-auto flex items-center gap-3">
            <span className="text-amber-500 text-xl">⚠️</span>
            <div className="flex-1">
              <p className="text-amber-800 dark:text-amber-200 font-semibold text-sm">
                Meta Access Token Expired
              </p>
              <p className="text-amber-700 dark:text-amber-300 text-xs">
                Your Meta access token expired. Insights metrics show zeros. To restore live data, go back to the home page and reconnect your Meta account.
              </p>
            </div>
            <a
              href="/"
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
            >
              Reconnect Meta
            </a>
          </div>
        </div>
      )}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="w-[90%] max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between py-4 gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="bg-blue-600 p-2 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                    {showCampaignDetail ? 'Campaign Details' : 'Meta Ads Dashboard'}
                  </h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {showCampaignDetail && selectedCampaign
                      ? selectedCampaign.name
                      : `Account: ${accountId}`}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isShopifyConnected ? (
                <div className="flex items-center gap-2 bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-3 py-1.5 rounded-lg border border-emerald-500/20 text-sm">
                  <ShoppingBag className="w-4 h-4 text-emerald-500" />
                  <span className="font-semibold hidden md:inline">Shopify Synced success</span>
                  <button
                    onClick={disconnectShopify}
                    className="text-xs hover:text-emerald-950 dark:hover:text-white underline ml-1 cursor-pointer"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsShopifyModalOpen(true)}
                  className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg text-sm transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
                >
                  <ShoppingBag className="w-4 h-4 text-slate-400" />
                  <span>Sync Shopify</span>
                </button>
              )}

              <div className="flex flex-wrap items-center gap-2 text-sm bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <select
                    value={selectedDateRange}
                    onChange={(e) => handleDateRangeChange(e.target.value)}
                    className="bg-transparent border-none text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
                  >
                    {DATE_RANGE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </div>

                {selectedDateRange === 'custom' && (
                  <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800 animate-in fade-in slide-in-from-left duration-250">
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750 rounded px-1.5 py-0.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
                    />
                    <span className="text-slate-400 text-xs">to</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750 rounded px-1.5 py-0.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
                    />
                    <button
                      onClick={handleApplyCustomDate}
                      disabled={!customStartDate || !customEndDate}
                      className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[10px] font-bold px-2 py-1 rounded transition-colors cursor-pointer"
                    >
                      Apply
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={async () => {
                  await refresh();
                  if (isShopifyConnected) refreshShopify();
                }}
                disabled={loading || loadingInsights || shopifyLoading}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 text-slate-500 ${(loading || loadingInsights || shopifyLoading) ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="w-[90%] max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {showAdSetDetail && selectedAdSet ? (
          <MetaAdSetDetail
            adSet={selectedAdSet}
            ads={filteredAds}
            loading={loading}
            hasMore={hasMore.ads}
            loadingMore={loadingMore.ads}
            onLoadMore={() => loadMore('ads')}
            onBack={handleBackFromAdSetDetail}
            currencyCode={currencyCode}
          />
        ) : showCampaignDetail && selectedCampaign ? (
          <MetaCampaignDetail
            campaign={selectedCampaign}
            adSets={filteredAdSets}
            loading={loading}
            hasMore={hasMore.adSets}
            loadingMore={loadingMore.adSets}
            onLoadMore={() => loadMore('adSets')}
            onBack={handleBackFromDetail}
            onAdSetClick={handleAdSetClick}
            currencyCode={currencyCode}
          />
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
              <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Performance Overview
              </h3>
              {isShopifyConnected && (
                <div className="inline-flex rounded-lg p-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80">
                  <button
                    onClick={() => setCardsViewMode('comparison')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${cardsViewMode === 'comparison'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                  >
                    Comparison
                  </button>
                  <button
                    onClick={() => setCardsViewMode('meta')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${cardsViewMode === 'meta'
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-850 dark:hover:text-slate-200'
                      }`}
                  >
                    Meta Only
                  </button>
                  <button
                    onClick={() => setCardsViewMode('shopify')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${cardsViewMode === 'shopify'
                      ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-850 dark:hover:text-slate-200'
                      }`}
                  >
                    Shopify Only
                  </button>
                </div>
              )}
            </div>

            <MetaMetricCards
              summary={summary}
              loading={loading || loadingInsights}
              shopifyConnected={isShopifyConnected}
              shopifySummary={shopifySummary}
              viewMode={cardsViewMode}
            />



            <div className="border-b border-slate-200 dark:border-slate-800">
              <nav className="flex gap-6">
                <button
                  onClick={() => handleTabChange('campaigns')}
                  className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === 'campaigns'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                >
                  Campaigns
                  <span className="ml-2 text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                    {campaigns.length}
                  </span>
                </button>
                <button
                  onClick={() => handleTabChange('adSets')}
                  className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === 'adSets'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                >
                  Ad Sets
                  <span className="ml-2 text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                    {adSets.length}
                  </span>
                </button>
                <button
                  onClick={() => handleTabChange('ads')}
                  className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === 'ads'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                >
                  Ads
                  <span className="ml-2 text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                    {ads.length}
                  </span>
                  {loadingCreatives && (
                    <span className="ml-2 text-xs text-blue-500">Loading creatives...</span>
                  )}
                </button>
                <button
                  onClick={() => handleTabChange('shopify')}
                  className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === 'shopify'
                    ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                >
                  Shopify Catalog
                  {isShopifyConnected && (
                    <span className="ml-2 text-xs bg-emerald-100 dark:bg-emerald-800/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                      {shopifyProducts.length}
                    </span>
                  )}
                </button>
              </nav>
            </div>

            {activeTab === 'campaigns' && (
              <>
                <MetaCampaignTable
                  campaigns={campaigns}
                  loading={loading}
                  loadingInsights={loadingInsights}
                  onCampaignClick={handleCampaignClick}
                  currencyCode={currencyCode}
                />
                <MetaLoadMoreButton
                  hasMore={hasMore.campaigns}
                  loading={loadingMore.campaigns}
                  onClick={() => loadMore('campaigns')}
                  count={campaigns.length}
                />
              </>
            )}

            {activeTab === 'adSets' && (
              <>
                <MetaAdSetTable
                  adSets={adSets}
                  loading={loading}
                  loadingInsights={loadingInsights}
                  onAdSetClick={handleAdSetClick}
                  currencyCode={currencyCode}
                />
                <MetaLoadMoreButton
                  hasMore={hasMore.adSets}
                  loading={loadingMore.adSets}
                  onClick={() => loadMore('adSets')}
                  count={adSets.length}
                />
              </>
            )}

            {activeTab === 'ads' && (
              <>
                <MetaAdTable
                  ads={ads}
                  loading={loading}
                  loadingInsights={loadingInsights}
                  loadingCreatives={loadingCreatives}
                  currencyCode={currencyCode}
                  unmatchedAds={unmatchedAds}
                />
                <MetaLoadMoreButton
                  hasMore={hasMore.ads}
                  loading={loadingMore.ads}
                  onClick={() => loadMore('ads')}
                  count={ads.length}
                />
              </>
            )}

            {activeTab === 'shopify' && (
              <>
                {isShopifyConnected && !shopifyLoading && !shopifyError && (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <ShoppingBag className="w-5 h-5 text-emerald-500" />
                        Shopify Catalog Performance
                      </h3>

                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="relative">
                        <select
                          value={shopifyPerfSort}
                          onChange={(e) => setShopifyPerfSort(e.target.value)}
                          className="appearance-none pl-9 pr-8 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer transition-colors shadow-sm"
                        >
                          <option value="best">Best Performing Ads </option>
                          <option value="bad">Bad Performing Ads </option>
                        </select>
                        {shopifyPerfSort === 'best' ? (
                          <TrendingUp className="absolute left-3 top-2.5 w-3.5 h-3.5 text-emerald-500 disabled:opacity-50" />
                        ) : (
                          <TrendingDown className="absolute left-3 top-2.5 w-3.5 h-3.5 text-red-500 disabled:opacity-50" />
                        )}
                        <ChevronDown className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                  {!isShopifyConnected ? (
                    <div className="p-12 text-center space-y-4">
                      <ShoppingBag className="w-16 h-16 text-slate-300 dark:text-slate-700 mx-auto animate-pulse" />
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white text-base">Shopify Not Synced</h3>

                      </div>
                      <button
                        onClick={() => setIsShopifyModalOpen(true)}
                        className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-medium text-sm rounded-xl transition-all shadow-md shadow-emerald-500/10 cursor-pointer"
                      >
                        Connect shopify
                      </button>
                    </div>
                  ) : shopifyLoading ? (
                    <div className="p-12 text-center space-y-3">
                      <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mx-auto" />
                      <p className="text-sm text-slate-500">Syncing products and order history...</p>
                    </div>
                  ) : shopifyError ? (
                    <div className="p-12 text-center space-y-4">
                      <div className="text-red-500 text-3xl">⚠️</div>
                      <div>
                        <h4 className="font-semibold text-slate-900 dark:text-white text-sm">Failed to sync with inMind</h4>
                        <p className="text-xs text-red-500 mt-1 max-w-sm mx-auto">{shopifyError}</p>
                      </div>
                      <button
                        onClick={() => refreshShopify()}
                        className="px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-xs rounded-lg transition-colors cursor-pointer"
                      >
                        Try Sync Again
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto animate-in fade-in duration-200">
                      <table className="w-full text-left text-sm border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold bg-slate-50/50 dark:bg-slate-950/20">
                            <th className="p-4">Product Title (SKU)</th>
                            <th className="p-4">Inventory Level</th>
                            <th className="p-4 text-right">Ad Spend (Meta)</th>
                            <th className="p-4 text-right">Meta Sales (Pixel)</th>
                            <th className="p-4 text-right">Meta Sales (UTM)</th>
                            <th className="p-4 text-right">Meta ROAS (Pixel)</th>
                            <th className="p-4 text-right">Meta ROAS (UTM)</th>
                            {shopifyAdFilter === 'running' && <th className="p-4 text-center">Ads Performance</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                          {filteredAndSortedProducts.length === 0 ? (
                            <tr>
                              <td colSpan={shopifyAdFilter === 'running' ? 8 : 7} className="p-8 text-center text-slate-400">
                                No products found matching your filters.
                              </td>
                            </tr>
                          ) : (
                            filteredAndSortedProducts.map(item => {
                              const utmRoas = item.adSpend > 0 ? item.metaRevenue / item.adSpend : 0;
                              return (
                                <tr key={item.productId} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/10">
                                  <td className="p-4">
                                    <div className="font-medium text-slate-900 dark:text-white">{item.productTitle}</div>
                                    <div className="text-[10px] text-slate-400">SKU: {item.sku}</div>
                                  </td>
                                  <td className="p-4">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${item.inventoryQuantity <= 0
                                      ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                                      : item.inventoryQuantity < 10
                                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                      }`}>
                                      {item.inventoryQuantity <= 0
                                        ? 'Out of Stock'
                                        : `${item.inventoryQuantity} in stock`}
                                    </span>
                                  </td>
                                  <td className="p-4 text-right font-semibold text-slate-700 dark:text-slate-300">{formatShopifyCurrency(item.adSpend)}</td>
                                  <td className="p-4 text-right">
                                    <div className="font-semibold text-slate-900 dark:text-white">{formatShopifyCurrency(item.attributedRevenue)}</div>
                                    <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{item.attributedSales} sold</div>
                                  </td>
                                  <td className="p-4 text-right">
                                    <div className="font-semibold text-slate-900 dark:text-white">{formatShopifyCurrency(item.metaRevenue)}</div>
                                    <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{item.metaSalesQuantity} sold</div>
                                  </td>
                                  <td className="p-4 text-right">
                                    <span className={`font-bold ${item.metaAttributedROAS > 2
                                      ? 'text-emerald-500'
                                      : item.metaAttributedROAS > 1
                                        ? 'text-amber-500'
                                        : item.adSpend > 0
                                          ? 'text-red-500'
                                          : 'text-slate-400'
                                      }`}>
                                      {item.adSpend > 0
                                        ? `${item.metaAttributedROAS.toFixed(2)}x`
                                        : 'No Ads'}
                                    </span>
                                  </td>
                                  <td className="p-4 text-right">
                                    <span className={`font-bold ${utmRoas > 2
                                      ? 'text-emerald-500'
                                      : utmRoas > 1
                                        ? 'text-amber-500'
                                        : item.adSpend > 0
                                          ? 'text-red-500'
                                          : 'text-slate-400'
                                      }`}>
                                      {item.adSpend > 0
                                        ? `${utmRoas.toFixed(2)}x`
                                        : 'No Ads'}
                                    </span>
                                  </td>
                                  {shopifyAdFilter === 'running' && (
                                    <td className="p-4 text-center">
                                      {item.adSpend > 0 ? (
                                        <button
                                          onClick={() => setSelectedProductPerformance(item)}
                                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800/80 transition-all cursor-pointer shadow-sm animate-in fade-in"
                                        >
                                          <span>Audit Ad Performance</span>
                                          <ArrowUpRight className="w-3.5 h-3.5" />
                                        </button>
                                      ) : (
                                        <span className="text-slate-300 dark:text-slate-700 font-semibold">—</span>
                                      )}
                                    </td>
                                  )}
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {isShopifyConnected && !shopifyLoading && !shopifyError && filteredAndSortedProducts.length > 0 && (
                  <MetaLoadMoreButton
                    hasMore={!!shopifyNextPageInfo}
                    loading={shopifyLoadingMore}
                    onClick={loadMoreProducts}
                    count={totalStoreProducts}
                    filteredCount={filteredAndSortedProducts.length}
                  />
                )}
              </>
            )}
          </>
        )}

        <div className="text-center text-xs text-slate-500 dark:text-slate-400 py-4 border-t border-slate-200 dark:border-slate-800">
          Data is updated in real-time • Last sync: {currentTime || 'Loading...'}
        </div>
      </div>

      <ShopifyConnectModal
        isOpen={isShopifyModalOpen}
        onClose={() => setIsShopifyModalOpen(false)}
        onConnectManual={connectManual}
        loading={shopifyLoading}
      />

      {selectedProductPerformance && (
        <div
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 transition-opacity duration-300 animate-fade-in flex justify-end"
          onClick={() => setSelectedProductPerformance(null)}
        >
          <style>{`
            @keyframes slideIn {
              from { transform: translateX(100%); }
              to { transform: translateX(0); }
            }
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            .animate-slide-in {
              animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
            .animate-fade-in {
              animation: fadeIn 0.2s ease-out forwards;
            }
          `}</style>

          <div
            className="w-[90%] max-w-[1500px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col h-full z-50 animate-slide-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/20">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white max-w-xl truncate">
                  {selectedProductPerformance.productTitle}
                </h2>
                <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <span>SKU: {selectedProductPerformance.sku}</span>
                  <span>•</span>
                  <span className={`font-semibold ${selectedProductPerformance.inventoryQuantity <= 0 ? 'text-red-500' : 'text-slate-600 dark:text-slate-300'}`}>
                    {selectedProductPerformance.inventoryQuantity <= 0 ? 'Out of Stock' : `${selectedProductPerformance.inventoryQuantity} in stock`}
                  </span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-semibold text-[10px] uppercase tracking-wider border border-blue-100 dark:border-blue-800/40">
                    <Calendar className="w-3 h-3" />
                    {getActiveDateRangeLabel()}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedProductPerformance(null)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-950/30 rounded-xl border border-slate-100 dark:border-slate-800/40 shadow-sm">
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Meta ROAS (Pixel)</div>
                  <div className={`text-2xl font-bold mt-1 ${selectedProductPerformance.metaAttributedROAS > 2 ? 'text-emerald-500' : selectedProductPerformance.metaAttributedROAS > 1 ? 'text-amber-500' : selectedProductPerformance.adSpend > 0 ? 'text-red-500' : 'text-slate-400'
                    }`}>
                    {selectedProductPerformance.adSpend > 0 ? `${selectedProductPerformance.metaAttributedROAS.toFixed(2)}x` : '—'}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Meta Pixel / Spend</div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-950/30 rounded-xl border border-slate-100 dark:border-slate-800/40 shadow-sm">
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Meta ROAS (UTM)</div>
                  {(() => {
                    const utmRoas = selectedProductPerformance.adSpend > 0 ? selectedProductPerformance.metaRevenue / selectedProductPerformance.adSpend : 0;
                    return (
                      <>
                        <div className={`text-2xl font-bold mt-1 ${utmRoas > 2 ? 'text-emerald-500' : utmRoas > 1 ? 'text-amber-500' : selectedProductPerformance.adSpend > 0 ? 'text-red-500' : 'text-slate-400'
                          }`}>
                          {selectedProductPerformance.adSpend > 0 ? `${utmRoas.toFixed(2)}x` : '—'}
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Facebook UTM / Spend</div>
                      </>
                    );
                  })()}
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-950/30 rounded-xl border border-slate-100 dark:border-slate-800/40 shadow-sm">
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Blended ROAS</div>
                  <div className={`text-2xl font-bold mt-1 ${selectedProductPerformance.trueROAS > 2 ? 'text-emerald-500' : selectedProductPerformance.trueROAS > 1 ? 'text-amber-500' : selectedProductPerformance.adSpend > 0 ? 'text-red-500' : 'text-slate-400'
                    }`}>
                    {selectedProductPerformance.adSpend > 0 ? `${selectedProductPerformance.trueROAS.toFixed(2)}x` : '—'}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Overall Store ROAS</div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-950/30 rounded-xl border border-slate-100 dark:border-slate-800/40 shadow-sm">
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Meta Sales (Pixel)</div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    {formatShopifyCurrency(selectedProductPerformance.attributedRevenue)}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                    {selectedProductPerformance.attributedSales} sales conversions
                  </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-950/30 rounded-xl border border-slate-100 dark:border-slate-800/40 shadow-sm">
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Meta Sales (UTM)</div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    {formatShopifyCurrency(selectedProductPerformance.metaRevenue)}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                    {selectedProductPerformance.metaSalesQuantity} sales conversions
                  </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-950/30 rounded-xl border border-slate-100 dark:border-slate-800/40 shadow-sm">
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Sales (All Channels)</div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    {formatShopifyCurrency(selectedProductPerformance.shopifyRevenue)}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                    {selectedProductPerformance.shopifySalesQuantity} items sold
                  </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-950/30 rounded-xl border border-slate-100 dark:border-slate-800/40 shadow-sm">
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Ad Spend (Meta)</div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    {formatShopifyCurrency(selectedProductPerformance.adSpend)}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                    {selectedProductPerformance.firstActiveDate && selectedProductPerformance.lastActiveDate ? (
                      <span className="text-blue-600 dark:text-blue-400 font-semibold text-[9px]">
                        Active: {new Date(selectedProductPerformance.firstActiveDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - {new Date(selectedProductPerformance.lastActiveDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    ) : (
                      `From ${selectedProductPerformance.matchedAds?.length || 0} active ads`
                    )}
                  </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-950/30 rounded-xl border border-slate-100 dark:border-slate-800/40 shadow-sm">
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Ad Clicks</div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    {selectedProductPerformance.adClicks}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                    Avg. CPC: {selectedProductPerformance.adSpend > 0 && selectedProductPerformance.adClicks > 0 ? formatShopifyCurrency(selectedProductPerformance.adSpend / selectedProductPerformance.adClicks) : '—'}
                  </div>
                </div>
              </div>

              {/* Connected Campaign Structure Details */}
              {selectedProductPerformance.matchedAds?.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-950/30 rounded-xl border border-slate-200/60 dark:border-slate-800/40 shadow-sm flex flex-col justify-between min-h-[140px]">
                    <div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-2.5">Connected Campaigns</div>
                      <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                        {campaignNames.map((name, idx) => (
                          <div key={idx} className="text-xs font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 px-2.5 py-1.5 rounded-lg shadow-sm leading-relaxed break-words" title={name}>
                            {name}
                          </div>
                        ))}
                        {campaignNames.length === 0 && <div className="text-xs text-slate-400 italic">No campaigns linked</div>}
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-950/30 rounded-xl border border-slate-100 dark:border-slate-800/40 shadow-sm flex flex-col justify-between min-h-[140px]">
                    <div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-2.5">Connected Ad Sets</div>
                      <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                        {adSetNames.map((name, idx) => (
                          <div key={idx} className="text-xs font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 px-2.5 py-1.5 rounded-lg shadow-sm leading-relaxed break-words" title={name}>
                            {name}
                          </div>
                        ))}
                        {adSetNames.length === 0 && <div className="text-xs text-slate-400 italic">No ad sets linked</div>}
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-950/30 rounded-xl border border-slate-100 dark:border-slate-800/40 shadow-sm flex flex-col justify-between min-h-[140px]">
                    <div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-2.5">Connected Ads</div>
                      <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                        {adNames.map((name, idx) => (
                          <div key={idx} className="text-xs font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 px-2.5 py-1.5 rounded-lg shadow-sm leading-relaxed break-words" title={name}>
                            {name}
                          </div>
                        ))}
                        {adNames.length === 0 && <div className="text-xs text-slate-400 italic">No ads linked</div>}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-500" />
                  Meta Ads Performance Details ({selectedProductPerformance.matchedAds?.length || 0})
                </h3>

                {(!selectedProductPerformance.matchedAds || selectedProductPerformance.matchedAds.length === 0) ? (
                  <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 text-xs">
                    No Meta Ads are currently linked to this product's handle or title.
                  </div>
                ) : (
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold bg-slate-50/50 dark:bg-slate-950/20">
                          <th className="p-3">Ad Name / Campaign</th>
                          <th className="p-3 text-center">Status</th>
                          <th className="p-3 text-right">Spend</th>
                          <th className="p-3 text-right">Impressions</th>
                          <th className="p-3 text-right">Clicks (CTR)</th>
                          <th className="p-3 text-right">Conversions</th>
                          <th className="p-3 text-right">Value (ROAS)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                        {selectedProductPerformance.matchedAds.map((ad) => {
                          const adRoas = ad.cost > 0 ? (ad.insights?.conversion_values || ad.roas || 0) / ad.cost : 0;
                          return (
                            <tr key={ad.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-950/5">
                              <td className="p-3 max-w-[220px]">
                                <div className="font-semibold text-slate-900 dark:text-white truncate" title={ad.name}>
                                  {ad.name}
                                </div>
                                <div className="text-[10px] text-slate-400 truncate mt-0.5" title={ad.campaignName}>
                                  Cmp: {ad.campaignName}
                                </div>
                                <div className="text-[10px] text-slate-400 truncate" title={ad.adGroupName}>
                                  Set: {ad.adGroupName}
                                </div>
                              </td>
                              <td className="p-3 text-center">
                                <div className="flex flex-col items-center gap-1">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${ad.status.toUpperCase() === 'ACTIVE'
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                    }`}>
                                    {ad.status.toUpperCase()}
                                  </span>
                                  {(() => {
                                    if (ad.status.toUpperCase() !== 'ACTIVE') return null;
                                    const today = new Date();
                                    const lastDate = ad.lastActiveDate ? new Date(ad.lastActiveDate) : null;
                                    const daysSinceLastSpend = lastDate ? Math.floor((today - lastDate) / (1000 * 60 * 60 * 24)) : null;
                                    
                                    if (ad.cost === 0) {
                                      return (
                                        <span className="text-[9px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-0.5 whitespace-nowrap" title="No budget has been spent on this ad during the selected range. Check Ads Manager for budget cap or bid issues.">
                                          ⚠️ No spend
                                        </span>
                                      );
                                    } else if (daysSinceLastSpend !== null && daysSinceLastSpend > 3) {
                                      return (
                                        <span className="text-[9px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-0.5 whitespace-nowrap" title={`This active ad has stopped spending budget since ${new Date(ad.lastActiveDate).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}. Check Meta billing or account limits.`}>
                                          ⚠️ Frozen {daysSinceLastSpend}d
                                        </span>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>
                              </td>
                              <td className="p-3 text-right font-medium">{formatShopifyCurrency(ad.cost || 0)}</td>
                              <td className="p-3 text-right">{ad.impressions?.toLocaleString() || '—'}</td>
                              <td className="p-3 text-right">
                                <div>{ad.clicks?.toLocaleString() || '0'}</div>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  {ad.ctr ? `${(ad.ctr * 100).toFixed(2)}%` : ad.insights?.ctr ? `${(ad.insights.ctr * 100).toFixed(2)}%` : '—'}
                                </div>
                              </td>
                              <td className="p-3 text-right font-medium">
                                {ad.insights?.conversions || 0}
                              </td>
                              <td className="p-3 text-right font-semibold">
                                <div>{formatShopifyCurrency(ad.insights?.conversion_values || 0)}</div>
                                <div className={`text-[10px] font-bold mt-0.5 ${adRoas > 2 ? 'text-emerald-500' : adRoas > 1 ? 'text-amber-500' : ad.cost > 0 ? 'text-red-500' : 'text-slate-400'
                                  }`}>
                                  {ad.cost > 0 ? `${adRoas.toFixed(2)}x` : '—'}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Daily Spend Breakdown Log */}
                {selectedProductPerformance.matchedAds?.some(ad => ad.dailySpendBreakdown?.length > 0) && (
                  <div className="mt-6">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-emerald-500" />
                      Daily Ad Spend Timeline
                    </h3>
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-slate-900/40">
                      <div className="max-h-[250px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold bg-slate-50/50 dark:bg-slate-950/20 sticky top-0">
                              <th className="p-3">Date</th>
                              <th className="p-3">Ad Source</th>
                              <th className="p-3 text-right">Spend</th>
                              <th className="p-3 text-right">Clicks</th>
                              <th className="p-3 text-right">Meta Conv.</th>
                              <th className="p-3 text-right">Shopify Conv.</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                            {selectedProductPerformance.matchedAds.flatMap(ad =>
                              (ad.dailySpendBreakdown || []).map(day => ({
                                ...day,
                                adName: ad.name
                              }))
                            )
                              .sort((a, b) => new Date(b.date) - new Date(a.date))
                              .map((day, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/30 dark:hover:bg-slate-950/5">
                                  <td className="p-3 font-medium text-slate-900 dark:text-white">
                                    {new Date(day.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                  </td>
                                  <td className="p-3 text-slate-500 truncate max-w-[150px]" title={day.adName}>
                                    {day.adName}
                                  </td>
                                  <td className="p-3 text-right font-semibold text-slate-800 dark:text-slate-200">
                                    {formatShopifyCurrency(day.spend)}
                                  </td>
                                  <td className="p-3 text-right">{day.clicks}</td>
                                  <td className="p-3 text-right font-medium text-emerald-600 dark:text-emerald-400">{day.conversions}</td>
                                  <td className="p-3 text-right font-medium text-blue-600 dark:text-blue-400" title={`Attributed Shopify Conversions: ${day.shopifyConversions || 0} orders (${day.shopifyQuantity || 0} items)`}>
                                    {day.shopifyConversions || 0}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* Shopify Attributed Orders Verification Log */}
                {selectedProductPerformance.matchedOrders?.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-blue-500" />
                      Shopify Attributed Orders Verification ({selectedProductPerformance.matchedOrders.length})
                    </h3>
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-slate-900/40">
                      <div className="max-h-[250px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold bg-slate-50/50 dark:bg-slate-950/20 sticky top-0">
                              <th className="p-3">Order</th>
                              <th className="p-3">Date</th>
                              <th className="p-3">Customer</th>
                              <th className="p-3 text-right">Items</th>
                              <th className="p-3 text-right">Item Price</th>
                              <th className="p-3 text-right">Total Price</th>
                              <th className="p-3">Attribution Source</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                            {selectedProductPerformance.matchedOrders
                              .slice()
                              .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                              .map((order, idx) => {
                                // Match order details to the product's matched Meta Ads to audit status
                                const matchedAd = selectedProductPerformance.matchedAds?.find(ad => {
                                  const contentMatch = order.utmContent && ad.name?.toLowerCase().trim() === order.utmContent.toLowerCase().trim();
                                  const campaignMatch = order.utmCampaign && ad.campaignName?.toLowerCase().trim() === order.utmCampaign.toLowerCase().trim();
                                  return contentMatch || campaignMatch;
                                });

                                const adStatus = matchedAd ? matchedAd.status : null;
                                const adName = matchedAd ? matchedAd.name : null;
                                const campaignName = matchedAd ? matchedAd.campaignName : null;

                                return (
                                  <tr key={idx} className="hover:bg-slate-50/30 dark:hover:bg-slate-950/5">
                                    <td className="p-3 font-semibold text-blue-600 dark:text-blue-400">
                                      {order.orderNumber || `#${order.orderId.slice(-6)}`}
                                    </td>
                                    <td className="p-3 text-slate-500">
                                      {new Date(order.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                    <td className="p-3 text-slate-600 dark:text-slate-400 truncate max-w-[150px]" title={order.email}>
                                      {order.email}
                                    </td>
                                    <td className="p-3 text-right font-medium">{order.quantity}</td>
                                    <td className="p-3 text-right">{formatShopifyCurrency(order.price)}</td>
                                    <td className="p-3 text-right font-bold text-slate-900 dark:text-white">{formatShopifyCurrency(order.totalPrice)}</td>
                                    <td className="p-3">
                                      <div className="flex flex-col gap-1.5">
                                        <div className="flex flex-wrap gap-1">
                                          {order.utmSource && (
                                            <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-semibold text-[9px] uppercase border border-emerald-100 dark:border-emerald-900/30">
                                              utm_src: {order.utmSource}
                                            </span>
                                          )}
                                          {order.utmCampaign && (
                                            <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold text-[9px] uppercase border border-blue-100 dark:border-blue-900/30 truncate max-w-[120px]" title={order.utmCampaign}>
                                              campaign: {order.utmCampaign}
                                            </span>
                                          )}
                                          {order.clickId && (
                                            <span className="px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-semibold text-[9px] uppercase border border-purple-100 dark:border-purple-900/30 truncate max-w-[100px]" title={order.clickId}>
                                              fbclid
                                            </span>
                                          )}
                                          {!order.utmSource && !order.utmCampaign && !order.clickId && (
                                            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[9px] font-semibold">
                                              organic facebook ref
                                            </span>
                                          )}
                                        </div>

                                        {/* Dynamic connection status helper */}
                                        {matchedAd ? (
                                          <div className="flex items-center gap-1.5 mt-0.5 bg-slate-50 dark:bg-slate-950/40 px-2 py-1 rounded border border-slate-200/60 dark:border-slate-800/40 w-fit">
                                            <span className={`w-1.5 h-1.5 rounded-full ${adStatus?.toUpperCase() === 'ACTIVE' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                                            <span className={`text-[10px] font-bold ${adStatus?.toUpperCase() === 'ACTIVE' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                                              {adStatus?.toUpperCase() === 'ACTIVE' ? 'Active Ad' : 'Paused Ad'}: {adName || campaignName}
                                            </span>
                                          </div>
                                        ) : (
                                          (order.utmCampaign || order.utmContent) && (
                                            <div className="flex items-center gap-1.5 mt-0.5 text-slate-400 dark:text-slate-500">
                                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                                              <span className="text-[10px] font-semibold italic">
                                                Old / Deleted Ad Campaign
                                              </span>
                                            </div>
                                          )
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 shadow-sm bg-white dark:bg-slate-900">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Product Variants Inventory
                  </h4>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400">
                          <th className="pb-2">Variant Title / SKU</th>
                          <th className="pb-2 text-right">Price</th>
                          <th className="pb-2 text-right">Inventory</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-slate-800/40">
                        {(() => {
                          const variants = selectedProductPerformance.variants || [];
                          if (variants.length === 0) {
                            return (
                              <tr>
                                <td colSpan={3} className="py-4 text-center text-slate-400">
                                  No variant details available.
                                </td>
                              </tr>
                            );
                          }
                          return variants.map((v) => (
                            <tr key={v.id}>
                              <td className="py-2.5 font-medium text-slate-700 dark:text-slate-300">
                                <div>{v.title || 'Default'}</div>
                                {v.sku && <div className="text-[10px] text-slate-400 font-normal mt-0.5">SKU: {v.sku}</div>}
                              </td>
                              <td className="py-2.5 text-right font-medium">{formatShopifyCurrency(parseFloat(v.price))}</td>
                              <td className="py-2.5 text-right">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${(v.inventoryQuantity || 0) <= 0
                                  ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                                  : (v.inventoryQuantity || 0) < 10
                                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                  }`}>
                                  {v.inventoryQuantity || 0} left
                                </span>
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 shadow-sm bg-white dark:bg-slate-900">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Ad Optimization Strategy
                  </h4>

                  <div className="space-y-3.5">
                    {selectedProductPerformance.adSpend > 0 ? (
                      selectedProductPerformance.trueROAS > 2 ? (
                        <div className="p-3.5 bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-start gap-3">
                          <Sparkles className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                          <div>
                            <div className="text-xs font-bold text-emerald-800 dark:text-emerald-400">Scale Ad Spend</div>
                            <div className="text-[11px] text-emerald-700 dark:text-emerald-500 mt-1 leading-relaxed">
                              This product is performing exceptionally well with a True ROAS of {selectedProductPerformance.trueROAS.toFixed(2)}x. Consider raising the campaign budget by 20% or scaling target audiences.
                            </div>
                          </div>
                        </div>
                      ) : selectedProductPerformance.trueROAS > 1 ? (
                        <div className="p-3.5 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-3">
                          <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                          <div>
                            <div className="text-xs font-bold text-amber-800 dark:text-amber-400">Optimize Copy / Creatives</div>
                            <div className="text-[11px] text-amber-700 dark:text-amber-500 mt-1 leading-relaxed">
                              ROAS is positive ({selectedProductPerformance.trueROAS.toFixed(2)}x) but close to breakeven. Optimize target audiences, refresh ad creatives, or try a direct discount offer.
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3.5 bg-red-500/5 dark:bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
                          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                          <div>
                            <div className="text-xs font-bold text-red-800 dark:text-red-400">Underperforming Ads warning</div>
                            <div className="text-[11px] text-red-700 dark:text-red-500 mt-1 leading-relaxed">
                              This product is running ads but returns are low or zero. We recommend auditing product prices, landing page loading speeds, or pausing budget wastage.
                            </div>
                          </div>
                        </div>
                      )
                    ) : (
                      <div className="p-3.5 bg-slate-50 dark:bg-slate-950/40 rounded-lg flex items-start gap-3">
                        <ShoppingBag className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                        <div>
                          <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Untapped Opportunity</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                            This item has {selectedProductPerformance.inventoryQuantity} in stock but is not being advertised. Launch test creatives for this item.
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedProductPerformance.inventoryQuantity <= 0 && selectedProductPerformance.adSpend > 0 && (
                      <div className="p-3.5 bg-red-500/10 dark:bg-red-500/25 border border-red-500/20 rounded-lg flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5 animate-pulse" />
                        <div>
                          <div className="text-xs font-bold text-red-800 dark:text-red-400">Wasting Ad Budget!</div>
                          <div className="text-[11px] text-red-700 dark:text-red-500 mt-1 leading-relaxed font-semibold">
                            Critical: You are active spending on a product that is out of stock. Pause all matching ads immediately.
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
