'use client';

import React from 'react';
import {
  DollarSign,
  MousePointerClick,
  Eye,
  Target,
  Wallet,
  Percent,
} from 'lucide-react';

const formatCurrency = (amount, currency) => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
};

const formatCompactNumber = (number) => {
  if (number === undefined || number === null) return '0';
  const num = typeof number === 'number' ? number : parseFloat(number);
  if (isNaN(num)) return number;

  try {
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      compactDisplay: 'short',
      maximumFractionDigits: 1
    }).format(num);
  } catch {
    return num.toLocaleString();
  }
};

const MetricCard = ({
  title,
  value,
  secondaryTitle,
  secondaryValue,
  icon: Icon,
  color,
  loading,
  subtitle,
}) => {
  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-lg" />
          <div className="w-12 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
        </div>
        <div className="mt-3 space-y-2">
          <div className="w-20 h-8 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="w-24 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
        </div>
      </div>
    );
  }

  const isDouble = secondaryValue !== undefined;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
      </div>
      <div>
        {isDouble ? (
          <div className="grid grid-cols-2 gap-2 divide-x divide-slate-100 dark:divide-slate-800">
            <div>
              <p className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                {typeof value === 'number' ? formatCompactNumber(value) : value}
              </p>
              <p className="text-[10px] uppercase font-semibold text-slate-400 mt-0.5">{title}</p>
            </div>
            <div className="pl-4">
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">
                {typeof secondaryValue === 'number' ? formatCompactNumber(secondaryValue) : secondaryValue}
              </p>
              <p className="text-[10px] uppercase font-semibold text-slate-400 mt-0.5">{secondaryTitle}</p>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              {typeof value === 'number' ? formatCompactNumber(value) : value}
            </p>
            <p className="text-xs uppercase font-semibold text-slate-400 mt-0.5">{title}</p>
          </div>
        )}

        {subtitle && (
          <p className="text-[10px] font-medium mt-2 text-slate-400 dark:text-slate-500">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
};

export function MetaMetricCards({
  summary,
  loading,
  shopifyConnected = false,
  shopifySummary
}) {
  const roasDisplay = summary?.averageROAS && summary.averageROAS > 0
    ? `${summary.averageROAS.toFixed(2)}x`
    : '0x';

  const blendedROAS = shopifySummary && summary?.totalSpend && summary.totalSpend > 0
    ? shopifySummary.totalRevenue / summary.totalSpend
    : 0;

  const blendedROASDisplay = blendedROAS > 0
    ? `${blendedROAS.toFixed(2)}x`
    : '0.00x';

  const getROASSubtitle = (roas) => {
    if (roas === 0) return 'No revenue yet';
    if (roas > 3) return 'Excellent ROI';
    if (roas > 2) return 'Good ROI';
    if (roas > 1) return 'Breaking even';
    return 'Below break-even';
  };

  const activeCurrency = shopifyConnected && shopifySummary ? shopifySummary.currency : 'USD';

  const gridClass = shopifyConnected
    ? "grid grid-cols-1 md:grid-cols-3 gap-4"
    : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4";

  return (
    <div className={gridClass}>
      <MetricCard
        title="Meta Spend"
        value={formatCurrency(summary?.totalSpend || 0, activeCurrency)}
        secondaryTitle="Store Orders"
        secondaryValue={shopifyConnected ? shopifySummary?.totalOrders : undefined}
        icon={DollarSign}
        color="bg-emerald-500"
        loading={loading}
        subtitle={shopifyConnected ? 'Ad Spend vs Store Orders' : 'Total Marketing Spend'}
      />
      <MetricCard
        title="Ad Clicks"
        value={summary?.totalClicks || 0}
        secondaryTitle="Store Customers"
        secondaryValue={shopifyConnected ? shopifySummary?.totalCustomers : undefined}
        icon={MousePointerClick}
        color="bg-blue-500"
        loading={loading}
        subtitle={shopifyConnected ? 'Traffic vs Unique Buyers' : 'Total Ad Clicks'}
      />
      <MetricCard
        title="Ad Impressions"
        value={summary?.totalImpressions || 0}
        icon={Eye}
        color="bg-purple-500"
        loading={loading}
        subtitle="Marketing Audience Reach"
      />
      <MetricCard
        title="Ad Conversions"
        value={summary?.totalConversions || 0}
        secondaryTitle="Store Orders"
        secondaryValue={shopifyConnected ? shopifySummary?.totalOrders : undefined}
        icon={Target}
        color="bg-amber-500"
        loading={loading}
        subtitle={shopifyConnected ? 'Attributed vs Actual Orders' : 'Ad purchase conversions'}
      />
      <MetricCard
        title="Ad Revenue"
        value={formatCurrency(summary?.totalRevenue || 0, activeCurrency)}
        secondaryTitle="Store Revenue"
        secondaryValue={
          shopifyConnected && shopifySummary
            ? formatCurrency(shopifySummary.totalRevenue, shopifySummary.currency)
            : undefined
        }
        icon={Wallet}
        color="bg-indigo-500"
        loading={loading}
        subtitle={shopifyConnected ? 'Attributed vs Actual Sales' : 'Ad reported conversion value'}
      />
      <MetricCard
        title="Meta ROAS"
        value={roasDisplay}
        secondaryTitle="Blended ROAS (MER)"
        secondaryValue={shopifyConnected ? blendedROASDisplay : undefined}
        icon={Percent}
        color="bg-violet-600"
        loading={loading}
        subtitle={
          shopifyConnected
            ? `Blended ROAS: ${blendedROAS > 1 ? 'Profitable' : 'Below Break-Even'}`
            : getROASSubtitle(summary?.averageROAS || 0)
        }
      />
    </div>
  );
}
