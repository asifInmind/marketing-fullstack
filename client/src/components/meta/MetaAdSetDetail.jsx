'use client';

import React from 'react';
import { ArrowLeft, Target } from 'lucide-react';
import { MetaAdTable } from './MetaAdTable.jsx';
import { MetaLoadMoreButton } from './MetaLoadMoreButton.jsx';

export function MetaAdSetDetail({
    adSet,
    ads,
    loading,
    hasMore = false,
    loadingMore = false,
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

    if (!adSet) {
        return (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center">
                <p className="text-slate-500 dark:text-slate-400">Ad Set not found</p>
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
            {/* Header Card */}
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
                            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                                <Target className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                    {adSet.name}
                                </h2>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                                    <span>Campaign: <span className="font-semibold text-slate-700 dark:text-slate-200">{adSet.campaignName}</span></span>
                                    <span>•</span>
                                    <span>Optimization: {adSet.optimizationGoal}</span>
                                    <span>•</span>
                                    <span>Status: {adSet.status}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-sm text-slate-500 dark:text-slate-400">Total Ads</div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">
                            {ads.length}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                    <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Total Spend</div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                            {formatVal(adSet.cost)}
                        </div>
                    </div>
                    <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Impressions</div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                            {adSet.impressions.toLocaleString()}
                        </div>
                    </div>
                    <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Clicks</div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                            {adSet.clicks.toLocaleString()}
                        </div>
                    </div>
                    <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Targeting</div>
                        <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[200px]" title={adSet.targeting}>
                            {adSet.targeting}
                        </div>
                    </div>
                </div>
            </div>

            {/* Ads List Card */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                        Ads in this Ad Set
                    </h3>
                    <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                        {ads.length} ads
                    </span>
                </div>

                <MetaAdTable ads={ads} loading={loading} currencyCode={currencyCode} />

                {onLoadMore && (
                    <MetaLoadMoreButton
                        hasMore={hasMore}
                        loading={loadingMore}
                        onClick={onLoadMore}
                        count={ads.length}
                    />
                )}
            </div>
        </div>
    );
}
