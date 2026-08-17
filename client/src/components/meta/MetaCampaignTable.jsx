'use client';

import React, { useState } from 'react';
import { Search, Filter, Download } from 'lucide-react';
import { MetaStatusBadge } from './MetaStatusBadge.jsx';

export const MetaCampaignTable = React.memo(function MetaCampaignTable({ 
  campaigns, 
  loading, 
  loadingInsights = false, 
  onCampaignClick,
  currencyCode = 'USD'
}) {
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

  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const filteredCampaigns = campaigns.filter(campaign =>
    campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    campaign.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedCampaigns = [...filteredCampaigns].sort((a, b) => {
    const aVal = a[sortField] ?? '';
    const bVal = b[sortField] ?? '';
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const paginatedCampaigns = sortedCampaigns.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(sortedCampaigns.length / itemsPerPage);

  const handleSort = (field) => {
    setCurrentPage(1);
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getTypeColor = (type) => {
    const typeMap = {
      VIDEO: 'bg-blue-500/15 text-blue-400',
      DISPLAY: 'bg-purple-500/15 text-purple-400',
      SEARCH: 'bg-emerald-500/15 text-emerald-400',
      SHOPPING: 'bg-amber-500/15 text-amber-400',
      LEAD_GEN: 'bg-pink-500/15 text-pink-400',
      APP_INSTALL: 'bg-indigo-500/15 text-indigo-400',
      SOCIAL: 'bg-orange-500/15 text-orange-400',
    };
    return typeMap[type] || 'bg-slate-500/15 text-slate-400';
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-6 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-2 text-sm text-slate-500">Loading campaigns...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Campaigns</h3>
          <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
            {campaigns.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search campaigns..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9 pr-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-900 dark:text-white placeholder:text-slate-400"
            />
          </div>
          <button className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <Filter className="w-4 h-4 text-slate-500" />
          </button>
          <button className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <Download className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Campaign</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Type</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Impressions</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Clicks</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">CTR</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cost</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Conversions</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Revenue</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">ROAS</th>
            </tr>
          </thead>
          <tbody>
            {paginatedCampaigns.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-8 text-slate-500 dark:text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <Search className="w-8 h-8 text-slate-400" />
                    <p>No campaigns found</p>
                    <p className="text-xs">Try adjusting your search</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedCampaigns.map((campaign) => (
                <tr
                  key={campaign.id}
                  className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                >
                  <td className="px-4 py-3">
                    {onCampaignClick ? (
                      <div className="font-medium text-slate-900 cursor-pointer hover:text-blue-500 dark:text-white text-sm" onClick={() => onCampaignClick(campaign.id)} >
                        {campaign.name}
                      </div>
                    ) : (
                      <div className="font-medium text-slate-900 dark:text-white text-sm">
                        {campaign.name}
                      </div>
                    )}
                    {campaign.objective && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Objective: {campaign.objective}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <MetaStatusBadge status={campaign.status} />
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(campaign.type)}`}>
                      {campaign.type.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                    {loadingInsights ? (
                      <div className="h-4 w-16 bg-slate-100 dark:bg-slate-800 animate-pulse rounded ml-auto" />
                    ) : (
                      campaign.impressions.toLocaleString()
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                    {loadingInsights ? (
                      <div className="h-4 w-12 bg-slate-100 dark:bg-slate-800 animate-pulse rounded ml-auto" />
                    ) : (
                      campaign.clicks.toLocaleString()
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                    {loadingInsights ? (
                      <div className="h-4 w-12 bg-slate-100 dark:bg-slate-800 animate-pulse rounded ml-auto" />
                    ) : (
                      `${campaign.ctr.toFixed(2)}%`
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                    {loadingInsights ? (
                      <div className="h-4 w-16 bg-slate-100 dark:bg-slate-800 animate-pulse rounded ml-auto" />
                    ) : (
                      formatVal(campaign.cost)
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                    {loadingInsights ? (
                      <div className="h-4 w-12 bg-slate-100 dark:bg-slate-800 animate-pulse rounded ml-auto" />
                    ) : (
                      campaign.conversions.toLocaleString()
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-emerald-600 dark:text-emerald-400">
                    {loadingInsights ? (
                      <div className="h-4 w-16 bg-slate-100 dark:bg-slate-800 animate-pulse rounded ml-auto" />
                    ) : (
                      formatVal(campaign.conversionValue)
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {loadingInsights ? (
                      <div className="h-4 w-12 bg-slate-100 dark:bg-slate-800 animate-pulse rounded ml-auto" />
                    ) : (
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${campaign.roas > 2
                        ? 'bg-emerald-500/15 text-emerald-500'
                        : campaign.roas > 1
                          ? 'bg-amber-500/15 text-amber-500'
                          : 'bg-red-500/15 text-red-500'
                        }`}>
                        {campaign.roas > 0 ? campaign.roas.toFixed(2) + 'x' : '0x'}
                      </span>
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
            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, sortedCampaigns.length)} of {sortedCampaigns.length} campaigns
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
