'use client';

import React from 'react';
import {
  DollarSign,
  MousePointerClick,
  Eye,
  Target,
  Wallet,
  Percent,
  ShoppingBag,
  Users,
  Coins,
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
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 hover:shadow-md transition-shadow duration-200 flex flex-col justify-between min-h-[140px]">
      <div>
        {/* Top Header: Card Title & Icon */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            {title}
          </span>
          <div className={`p-1.5 rounded-lg ${color}`}>
            <Icon className="w-4 h-4 text-white" />
          </div>
        </div>

        {/* Content Section */}
        {isDouble ? (
          <div className="grid grid-cols-2 gap-2 divide-x divide-slate-100 dark:divide-slate-800/80">
            {/* Left Side: Meta Ads */}
            <div className="pr-2">
              <span className="block text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                Meta Ads
              </span>
              <p className="text-[14px] font-extrabold text-slate-800 dark:text-slate-100 tracking-tight truncate" title={value}>
                {typeof value === 'number' ? formatCompactNumber(value) : value}
              </p>
            </div>
            
            {/* Right Side: Shopify */}
            <div className="pl-4">
              <span className="block text-[9px] font-bold text-emerald-500 uppercase tracking-wider mb-1 animate-pulse">
                Shopify
              </span>
              <p className="text-[14px] font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight truncate" title={secondaryValue}>
                {typeof secondaryValue === 'number' ? formatCompactNumber(secondaryValue) : secondaryValue}
              </p>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-[18px] font-extrabold text-slate-850 dark:text-slate-100 tracking-tight truncate" title={value}>
              {typeof value === 'number' ? formatCompactNumber(value) : value}
            </p>
          </div>
        )}
      </div>

      {subtitle && (
        <p className="text-[10px] font-medium mt-3 text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800/60 pt-2">
          {subtitle}
        </p>
      )}
    </div>
  );
};

export function MetaMetricCards({
  summary,
  loading,
  shopifyConnected = false,
  shopifySummary,
  viewMode = 'comparison'
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

  const attributedROAS = shopifySummary && summary?.totalSpend && summary.totalSpend > 0
    ? (shopifySummary.metaRevenue || 0) / summary.totalSpend
    : 0;

  const attributedROASDisplay = attributedROAS > 0
    ? `${attributedROAS.toFixed(2)}x`
    : '0.00x';

  const aov = shopifySummary && shopifySummary.totalOrders > 0
    ? shopifySummary.totalRevenue / shopifySummary.totalOrders
    : 0;

  const getROASSubtitle = (roas) => {
    if (roas === 0) return 'No revenue yet';
    if (roas > 3) return 'Excellent ROI';
    if (roas > 2) return 'Good ROI';
    if (roas > 1) return 'Breaking even';
    return 'Below break-even';
  };

  const activeCurrency = shopifyConnected && shopifySummary ? shopifySummary.currency : 'USD';

  // --- Render Mode 1: Meta Only (or if Shopify not connected) ---
  if (viewMode === 'meta' || !shopifyConnected) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Ad Spend"
          value={formatCurrency(summary?.totalSpend || 0, activeCurrency)}
          icon={DollarSign}
          color="bg-emerald-500"
          loading={loading}
          subtitle="Total marketing budget spent"
        />
        <MetricCard
          title="Ad Clicks"
          value={summary?.totalClicks || 0}
          icon={MousePointerClick}
          color="bg-blue-500"
          loading={loading}
          subtitle="Total link traffic generated"
        />
        <MetricCard
          title="Ad Impressions"
          value={summary?.totalImpressions || 0}
          icon={Eye}
          color="bg-purple-500"
          loading={loading}
          subtitle="Total ad views on feeds"
        />
        <MetricCard
          title="Ad Conversions"
          value={summary?.totalConversions || 0}
          icon={Target}
          color="bg-amber-500"
          loading={loading}
          subtitle="Meta pixel purchases tracked"
        />
        <MetricCard
          title="Ad Revenue"
          value={formatCurrency(summary?.totalRevenue || 0, activeCurrency)}
          icon={Wallet}
          color="bg-indigo-500"
          loading={loading}
          subtitle="Meta reported purchase value"
        />
        <MetricCard
          title="Meta ROAS"
          value={roasDisplay}
          icon={Percent}
          color="bg-violet-600"
          loading={loading}
          subtitle={getROASSubtitle(summary?.averageROAS || 0)}
        />
      </div>
    );
  }

  // --- Render Mode 2: Shopify Only ---
  if (viewMode === 'shopify') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Store Revenue"
          value={formatCurrency(shopifySummary?.totalRevenue || 0, activeCurrency)}
          icon={Wallet}
          color="bg-indigo-500"
          loading={loading}
          subtitle="Total sales from all channels"
        />
        <MetricCard
          title="Store Orders"
          value={shopifySummary?.totalOrders || 0}
          icon={ShoppingBag}
          color="bg-emerald-500"
          loading={loading}
          subtitle="Total checkout transactions completed"
        />
        <MetricCard
          title="Store Customers"
          value={shopifySummary?.totalCustomers || 0}
          icon={Users}
          color="bg-blue-500"
          loading={loading}
          subtitle="Unique purchasing buyers"
        />
        <MetricCard
          title="Average Order Value"
          value={formatCurrency(aov, activeCurrency)}
          icon={Coins}
          color="bg-amber-500"
          loading={loading}
          subtitle="Average spend per order (AOV)"
        />
        <MetricCard
          title="Blended ROAS (MER)"
          value={blendedROASDisplay}
          icon={Percent}
          color="bg-violet-600"
          loading={loading}
          subtitle="Total Store Sales / Meta Ad Spend"
        />
      </div>
    );
  }

  // --- Render Mode 3: Comparison (Default) ---
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <MetricCard
        title="Spend & Orders"
        value={formatCurrency(summary?.totalSpend || 0, activeCurrency)}
        secondaryTitle="Meta Orders"
        secondaryValue={shopifySummary?.metaOrdersCount || 0}
        icon={DollarSign}
        color="bg-emerald-500"
        loading={loading}
        subtitle="Meta Spend vs Shopify-Attributed Orders"
      />
      <MetricCard
        title="Traffic & Buyers"
        value={summary?.totalClicks || 0}
        secondaryTitle="Meta Customers"
        secondaryValue={shopifySummary?.metaCustomersCount || 0}
        icon={MousePointerClick}
        color="bg-blue-500"
        loading={loading}
        subtitle="Meta Clicks vs Shopify-Attributed Buyers"
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
        title="Conversions Audit"
        value={summary?.totalConversions || 0}
        secondaryTitle="Meta Orders"
        secondaryValue={shopifySummary?.metaOrdersCount || 0}
        icon={Target}
        color="bg-amber-500"
        loading={loading}
        subtitle="Pixel Purchases vs Shopify-Attributed Orders"
      />
      <MetricCard
        title="Revenue Audit"
        value={formatCurrency(summary?.totalRevenue || 0, activeCurrency)}
        secondaryTitle="Meta Revenue"
        secondaryValue={formatCurrency(shopifySummary?.metaRevenue || 0, activeCurrency)}
        icon={Wallet}
        color="bg-indigo-500"
        loading={loading}
        subtitle="Pixel Revenue vs Shopify-Attributed Revenue"
      />
      <MetricCard
        title="ROAS Comparison"
        value={roasDisplay}
        secondaryTitle="Meta ROAS"
        secondaryValue={attributedROASDisplay}
        icon={Percent}
        color="bg-violet-600"
        loading={loading}
        subtitle="Pixel ROAS vs Shopify-Attributed ROAS"
      />
    </div>
  );
}
