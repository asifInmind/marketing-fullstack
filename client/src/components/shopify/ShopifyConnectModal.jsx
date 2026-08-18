'use client';

import React, { useState } from 'react';
import { ShoppingBag, X, Key, AlertCircle, RefreshCw, Globe } from 'lucide-react';

export function ShopifyConnectModal({
  isOpen,
  onClose,
  onConnectManual,
  loading
}) {
  const [activeTab, setActiveTab] = useState('oauth'); // 'oauth' or 'manual'
  const [shopUrl, setShopUrl] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [validationError, setValidationError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setValidationError(null);

    const cleanUrl = shopUrl.trim();
    const cleanToken = apiToken.trim();

    if (!cleanUrl) {
      setValidationError('Please enter your Shopify Store Domain.');
      return;
    }

    if (activeTab === 'oauth') {
      // Redirect browser to server OAuth route
      const cleanShop = cleanUrl.toLowerCase().replace(/^https?:\/\//, '');
      window.location.href = `/api/shopify/auth?shop=${encodeURIComponent(cleanShop)}`;
      return;
    }

    if (!cleanToken) {
      setValidationError('Please enter your Shopify Admin Access Token.');
      return;
    }

    onConnectManual(cleanUrl, cleanToken);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-slate-900 dark:text-white">Connect Shopify Store</h3>
              <p className="text-xs text-slate-500">Sync products and order analytics directly</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 px-6 bg-slate-50/50 dark:bg-slate-950/10">
          <button
            type="button"
            onClick={() => {
              setActiveTab('oauth');
              setValidationError(null);
            }}
            className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'oauth'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            Automatic Link (OAuth)
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('manual');
              setValidationError(null);
            }}
            className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'manual'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            Manual Link (Token)
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {validationError && (
            <div className="p-3 bg-red-500/10 border border-red-200 dark:border-red-800/50 rounded-xl flex gap-2 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Description */}
          <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-900 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {activeTab === 'oauth' ? (
              <span>
                Enter your Shopify domain (e.g. <strong>store-name.myshopify.com</strong>). Clicking authenticate will redirect you to Shopify to securely link your catalog and orders.
              </span>
            ) : (
              <span>
                Enter your store domain and custom Admin API Access Token to manually synchronize catalog pricing, stock levels, and order attribution parameters.
              </span>
            )}
          </div>

          {/* Store URL Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" /> Shopify Store Domain
            </label>
            <input
              type="text"
              placeholder="e.g. your-store-name.myshopify.com"
              value={shopUrl}
              onChange={(e) => setShopUrl(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-500/50 transition-all text-sm"
              required
            />
          </div>

          {/* Token Input (Manual mode only) */}
          {activeTab === 'manual' && (
            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5" /> Admin API Access Token
              </label>
              <input
                type="password"
                placeholder="e.g. shpat_xxxxxxxxxxxxxxxxxxxxxxxx"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-500/50 transition-all text-sm"
                required={activeTab === 'manual'}
              />
            </div>
          )}

          {/* Submit Action */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-medium rounded-xl transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Connecting...
                </>
              ) : activeTab === 'oauth' ? (
                'Authenticate & Link (OAuth)'
              ) : (
                'Connect Shopify Store'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
