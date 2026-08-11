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
import { MetaLoadMoreButton } from './MetaLoadMoreButton.jsx';
import { DATE_RANGE_OPTIONS } from '../../lib/utils/constants.js';

export function MetaDashboard({ accessToken, accountId }) {
  const [activeTab, setActiveTab] = useState('campaigns');
  const [selectedDateRange, setSelectedDateRange] = useState('last_30d');
  const [currentTime, setCurrentTime] = useState('');
  const [isShopifyModalOpen, setIsShopifyModalOpen] = useState(false);

  const [selectedCampaignId, setSelectedCampaignId] = useState(null);
  const [showCampaignDetail, setShowCampaignDetail] = useState(false);

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
    nextPageInfo: shopifyNextPageInfo,
    loadingMore: shopifyLoadingMore,
    connectOauth,
    connectManual,
    disconnect: disconnectShopify,
    refresh: refreshShopify,
    loadMoreProducts,
  } = useShopifyDashboard(ads, dateRange);

  const [cardsViewMode, setCardsViewMode] = useState('comparison');

  const filteredAndSortedProducts = useMemo(() => {
    // Filter strictly only products with active ad spend
    const items = productPerformance.filter(item => item.adSpend > 0);

    // Sort by true ROAS (Best vs Worst)
    items.sort((a, b) => {
      if (shopifyPerfSort === 'best') {
        return b.trueROAS - a.trueROAS;
      } else {
        return a.trueROAS - b.trueROAS;
      }
    });

    return items;
  }, [productPerformance, shopifyPerfSort]);

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

  const handleCampaignClick = (campaignId) => {
    setSelectedCampaignId(campaignId);
    setShowCampaignDetail(true);
  };

  const handleBackFromDetail = () => {
    setSelectedCampaignId(null);
    setShowCampaignDetail(false);
  };

  useEffect(() => {
    setCurrentTime(new Date().toLocaleString());
  }, []);

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
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
                onClick={() => {
                  refresh();
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {showCampaignDetail && selectedCampaign ? (
          <MetaCampaignDetail
            campaign={selectedCampaign}
            adSets={filteredAdSets}
            loading={loading}
            hasMore={hasMore.adSets}
            loadingMore={loadingMore.adSets}
            onLoadMore={() => loadMore('adSets')}
            onBack={handleBackFromDetail}
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
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                      cardsViewMode === 'comparison'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    Comparison
                  </button>
                  <button
                    onClick={() => setCardsViewMode('meta')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                      cardsViewMode === 'meta'
                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-slate-500 hover:text-slate-850 dark:hover:text-slate-200'
                    }`}
                  >
                    Meta Only
                  </button>
                  <button
                    onClick={() => setCardsViewMode('shopify')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                      cardsViewMode === 'shopify'
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

            {isShopifyConnected && wastedBudgetAlerts.length > 0 && (
              <div className="bg-red-500/10 border border-red-200 dark:border-red-800/60 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-500 text-white rounded-lg">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-red-800 dark:text-red-400">Wasted Ad Budget: Out-of-Stock Products</h3>
                    <p className="text-xs text-red-600 dark:text-red-500">
                      You are actively spending marketing budget on Meta Ads for products that are currently sold out on your Shopify store (synced via inMind).
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-400 font-semibold">
                        <th className="py-2">Active Meta Ad</th>
                        <th className="py-2">Campaign</th>
                        <th className="py-2">Shopify Product</th>
                        <th className="py-2 text-right">Spend Wasted</th>
                        <th className="py-2 text-right">Clicks</th>
                        <th className="py-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-red-200/50 dark:divide-red-800/20 text-red-900 dark:text-red-300">
                      {wastedBudgetAlerts.map(alert => (
                        <tr key={alert.adId} className="hover:bg-red-500/5">
                          <td className="py-2.5 font-medium flex items-center gap-1">
                            {alert.adName}
                            {alert.adUrl && alert.adUrl !== '#' && (
                              <a href={alert.adUrl} target="_blank" rel="noopener noreferrer" className="hover:text-red-950 dark:hover:text-white">
                                <ExternalLink className="w-3.5 h-3.5 inline" />
                              </a>
                            )}
                          </td>
                          <td className="py-2.5">{alert.campaignName}</td>
                          <td className="py-2.5">
                            <span className="font-medium">{alert.productTitle}</span>
                            <span className="block text-[10px] text-red-500/70">SKU: {alert.sku}</span>
                          </td>
                          <td className="py-2.5 text-right font-semibold">{formatShopifyCurrency(alert.spend)}</td>
                          <td className="py-2.5 text-right font-medium">{alert.clicks}</td>
                          <td className="py-2.5 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500 text-white uppercase animate-pulse">
                              Out of Stock
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

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
                            <th className="p-4 text-right">Shopify Sales (Qty)</th>
                            <th className="p-4 text-right">Shopify Revenue</th>
                            <th className="p-4 text-right">Attributed Ad Spend</th>
                            <th className="p-4 text-right">True Product ROAS</th>
                            {shopifyAdFilter === 'running' && <th className="p-4 text-center">Ads Performance</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                          {filteredAndSortedProducts.length === 0 ? (
                            <tr>
                              <td colSpan={shopifyAdFilter === 'running' ? 7 : 6} className="p-8 text-center text-slate-400">
                                No products found matching your filters.
                              </td>
                            </tr>
                          ) : (
                            filteredAndSortedProducts.map(item => (
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
                                <td className="p-4 text-right font-medium">{item.shopifySalesQuantity}</td>
                                <td className="p-4 text-right font-semibold">{formatShopifyCurrency(item.shopifyRevenue)}</td>
                                <td className="p-4 text-right font-semibold text-slate-500 dark:text-slate-400">{formatShopifyCurrency(item.adSpend)}</td>
                                <td className="p-4 text-right">
                                  <span className={`font-bold ${item.trueROAS > 2
                                    ? 'text-emerald-500'
                                    : item.trueROAS > 1
                                      ? 'text-amber-500'
                                      : item.adSpend > 0
                                        ? 'text-red-500'
                                        : 'text-slate-400'
                                    }`}>
                                    {item.adSpend > 0
                                      ? `${item.trueROAS.toFixed(2)}x`
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
                            ))
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
                    count={shopifyProducts.length}
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
            className="w-[80%] max-w-4xl bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col h-full z-50 animate-slide-in"
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
                  <span className={`font-semibold ${selectedProductPerformance.inventoryQuantity <= 0 ? 'text-red-500' : 'text-emerald-500'}`}>
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
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-950/30 rounded-xl border border-slate-100 dark:border-slate-800/40 shadow-sm">
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">True ROAS</div>
                  <div className={`text-2xl font-bold mt-1 ${selectedProductPerformance.trueROAS > 2 ? 'text-emerald-500' : selectedProductPerformance.trueROAS > 1 ? 'text-amber-500' : selectedProductPerformance.adSpend > 0 ? 'text-red-500' : 'text-slate-400'
                    }`}>
                    {selectedProductPerformance.adSpend > 0 ? `${selectedProductPerformance.trueROAS.toFixed(2)}x` : '—'}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Total Revenue / Spend</div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-950/30 rounded-xl border border-slate-100 dark:border-slate-800/40 shadow-sm">
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Shopify Sales Revenue</div>
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
                    From {selectedProductPerformance.matchedAds?.length || 0} active ads
                  </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-950/30 rounded-xl border border-slate-100 dark:border-slate-800/40 shadow-sm">
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Attributed Sales Rev.</div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    {formatShopifyCurrency(selectedProductPerformance.attributedRevenue)}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                    {selectedProductPerformance.attributedSales} sales conversions
                  </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-950/30 rounded-xl border border-slate-100 dark:border-slate-800/40 col-span-2 md:col-span-1 shadow-sm">
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Ad Clicks</div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    {selectedProductPerformance.adClicks}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                    Avg. CPC: {selectedProductPerformance.adSpend > 0 && selectedProductPerformance.adClicks > 0 ? formatShopifyCurrency(selectedProductPerformance.adSpend / selectedProductPerformance.adClicks) : '—'}
                  </div>
                </div>
              </div>

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
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${ad.status.toUpperCase() === 'ACTIVE'
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                  }`}>
                                  {ad.status.toUpperCase()}
                                </span>
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
                          const rawProduct = shopifyProducts.find(p => p.id === selectedProductPerformance.productId);
                          if (!rawProduct || !rawProduct.variants || rawProduct.variants.length === 0) {
                            return (
                              <tr>
                                <td colSpan={3} className="py-4 text-center text-slate-400">
                                  No variant details available.
                                </td>
                              </tr>
                            );
                          }
                          return rawProduct.variants.map((v) => (
                            <tr key={v.id}>
                              <td className="py-2.5 font-medium text-slate-700 dark:text-slate-300">
                                <div>{v.title || 'Default'}</div>
                                {v.sku && <div className="text-[10px] text-slate-400 font-normal mt-0.5">SKU: {v.sku}</div>}
                              </td>
                              <td className="py-2.5 text-right font-medium">{formatShopifyCurrency(parseFloat(v.price))}</td>
                              <td className="py-2.5 text-right">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${(v.inventory_quantity || 0) <= 0
                                  ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                                  : (v.inventory_quantity || 0) < 10
                                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                  }`}>
                                  {v.inventory_quantity || 0} left
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
