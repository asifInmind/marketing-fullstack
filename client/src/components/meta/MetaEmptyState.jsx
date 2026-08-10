'use client';

import React from 'react';
import { AlertCircle } from 'lucide-react';

const emptyMessages = {
  campaigns: {
    title: 'No Campaigns Found',
    description: 'Create your first campaign to start seeing data here.',
    icon: AlertCircle,
  },
  adSets: {
    title: 'No Ad Sets Found',
    description: 'Create an ad set within a campaign to start seeing data here.',
    icon: AlertCircle,
  },
  ads: {
    title: 'No Ads Found',
    description: 'Create an ad within an ad set to start seeing data here.',
    icon: AlertCircle,
  },
};

export function MetaEmptyState({ type }) {
  const message = emptyMessages[type];
  const Icon = message.icon;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center">
      <div className="mx-auto w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-slate-400" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
        {message.title}
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {message.description}
      </p>
    </div>
  );
}
