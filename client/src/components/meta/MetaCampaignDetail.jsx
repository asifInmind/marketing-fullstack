'use client';

import React from 'react';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import { MetaAdSetTable } from './MetaAdSetTable.jsx';
import { MetaLoadMoreButton } from './MetaLoadMoreButton.jsx';

export function MetaCampaignDetail({
    campaign,
    adSets,
    loading,
    hasMore,
    loadingMore,
    onLoadMore,
    onBack,
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

    if (!campaign) {
        return (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center">
                <p className="text-slate-500 dark:text-slate-400">Campaign not found</p>
                <button
                    onClick={onBack}
                    className="mt-4 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                    Go Back
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-slate-500" />
                    </button>
                    <div className="flex-1">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                    {campaign.name}
                                </h2>
                                <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                                    <span>Objective: {campaign.objective}</span>
                                    <span>•</span>
                                    <span>Status: {campaign.status}</span>
                                    <span>•</span>
                                    <span>Type: {campaign.type}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-sm text-slate-500 dark:text-slate-400">Total Ad Sets</div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">
                            {adSets.length}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                    <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Total Spend</div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                            {formatVal(campaign.cost)}
                        </div>
                    </div>
                    <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Impressions</div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                            {campaign.impressions.toLocaleString()}
                        </div>
                    </div>
                    <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Conversions</div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                            {campaign.conversions.toLocaleString()}
                        </div>
                    </div>
                    <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">ROAS</div>
                        <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                            {campaign.roas > 0 ? campaign.roas.toFixed(2) + 'x' : '0x'}
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                        Ad Sets in this Campaign
                    </h3>
                    <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                        {adSets.length} ad sets
                    </span>
                </div>

                <MetaAdSetTable adSets={adSets} loading={loading} currencyCode={currencyCode} />

                <MetaLoadMoreButton
                    hasMore={hasMore}
                    loading={loadingMore}
                    onClick={onLoadMore}
                    count={adSets.length}
                />
            </div>
        </div>
    );
}
