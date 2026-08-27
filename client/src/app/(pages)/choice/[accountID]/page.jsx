'use client';

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { MetaDashboard } from '../../../../components/meta/MetaDashboard';

// Content component with useSearchParams
function DashboardContent() {
  const { accountID } = useParams();
  const searchParams = useSearchParams();
  const accessToken = searchParams.get('access_token') ?? '';

  if (!accessToken) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-xl border border-red-200 dark:border-red-800 p-8 text-center">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
            Missing Access Token
          </h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Please authenticate to view your dashboard.
          </p>
        </div>
      </div>
    );
  }

  return (
    <MetaDashboard
      accessToken={accessToken}
      accountId={accountID}
    />
  );
}

// Loading component
function DashboardLoading() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                  <div className="w-12 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
                </div>
                <div className="mt-3 space-y-2">
                  <div className="w-20 h-8 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="w-24 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
                </div>
              </div>
            ))}
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
            <div className="space-y-3">
              <div className="h-8 w-40 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-12 w-full bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-12 w-full bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-12 w-full bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main page export with Suspense
export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardContent />
    </Suspense>
  );
}