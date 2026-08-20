'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

export function MetaLoadMoreButton({
  hasMore,
  loading,
  onClick,
  count,
}) {
  if (!hasMore && count === 0) {
    return null;
  }

  return (
    <div className="flex flex-col items-center gap-2 py-4">
      {hasMore ? (
        <button
          onClick={onClick}
          disabled={loading}
          className="px-6 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading...
            </>
          ) : (
            'Load More'
          )}
        </button>
      ) : count > 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Showing all {count} items
        </p>
      ) : null}
    </div>
  );
}