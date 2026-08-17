'use client';

import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { MetaStatusBadge } from './MetaStatusBadge.jsx';

export const MetaAdTable = React.memo(function MetaAdTable({ 
  ads, 
  loading, 
  loadingInsights = false, 
  loadingCreatives,
  currencyCode = 'USD'
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const paginatedAds = ads.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(ads.length / itemsPerPage);
  const formatVal = (amount) => {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode,
      }).format(amount);
    } catch {
      return `${currencyCode} ${amount.toFixed(2)}`;
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-6 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-2 text-sm text-slate-500">Loading ads...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Ads</h3>
            <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
              {ads.length} Total
            </span>
            {loadingCreatives && (
              <span className="text-xs text-blue-500 flex items-center gap-1">
                <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500"></span>
                Loading creatives...
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] md:text-xs">
            <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
              Active: {ads.filter(a => a.status === 'ENABLED' || a.status === 'ACTIVE').length}
            </span>
            <span className="px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">
              Spending: {ads.filter(a => a.cost > 0).length}
            </span>
            <span className="px-2.5 py-1 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1 cursor-help" title="Ads that are active and have spent budget in this range. Note: Ads that have not spent budget in the last 3 days (frozen ads) are filtered out of the Shopify product performance engine.">
              Active & Spending: {ads.filter(a => (a.status === 'ENABLED' || a.status === 'ACTIVE') && a.cost > 0).length}
              <span className="text-[10px] text-indigo-400">ℹ️</span>
            </span>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ad</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Creative</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Campaign</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ad Set</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Impressions</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Clicks</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">CTR</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cost</th>
            </tr>
          </thead>
          <tbody>
            {paginatedAds.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-8 text-slate-500 dark:text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <ExternalLink className="w-8 h-8 text-slate-400" />
                    <p>No ads found</p>
                    <p className="text-xs">Create an ad to see data here</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedAds.map((ad) => (
                <tr key={ad.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900 dark:text-white text-sm">
                      {ad.name}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {ad.type}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <MetaStatusBadge status={ad.status} />
                  </td>
                  <td className="px-4 py-3">
                    {ad.headline !== 'N/A' ? (
                      <div>
                        <div className="text-sm text-slate-900 dark:text-white">
                          {ad.headline}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[150px]">
                          {ad.description}
                        </div>
                        {ad.finalUrl !== '#' && (
                          <a
                            href={ad.finalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-500 hover:underline flex items-center gap-1 mt-0.5"
                          >
                            {ad.finalUrl.replace(/^https?:\/\//, '').slice(0, 30)}...
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">No creative data</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {ad.campaignName}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {ad.adGroupName}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                    {loadingInsights ? (
                      <div className="h-4 w-16 bg-slate-100 dark:bg-slate-800 animate-pulse rounded ml-auto" />
                    ) : (
                      ad.impressions.toLocaleString()
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                    {loadingInsights ? (
                      <div className="h-4 w-12 bg-slate-100 dark:bg-slate-800 animate-pulse rounded ml-auto" />
                    ) : (
                      ad.clicks.toLocaleString()
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                    {loadingInsights ? (
                      <div className="h-4 w-12 bg-slate-100 dark:bg-slate-800 animate-pulse rounded ml-auto" />
                    ) : (
                      `${ad.ctr.toFixed(2)}%`
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                    {loadingInsights ? (
                      <div className="h-4 w-16 bg-slate-100 dark:bg-slate-800 animate-pulse rounded ml-auto" />
                    ) : (
                      formatVal(ad.cost)
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <div>
            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, ads.length)} of {ads.length} ads
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:cursor-not-allowed font-medium text-slate-700 dark:text-slate-300"
            >
              Previous
            </button>
            <span className="px-2">Page {currentPage} of {totalPages}</span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:cursor-not-allowed font-medium text-slate-700 dark:text-slate-300"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
