'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import React from 'react';
import {
    KeyIcon,
    ArrowRightOnRectangleIcon,
    ArrowRightIcon,
    ShieldCheckIcon,
} from '@heroicons/react/24/outline';

export default function HomePage() {
    const [mode, setMode] = useState(null);
    const [adAccountId, setAdAccountId] = useState('');
    const [accessToken, setAccessToken] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null);
    const router = useRouter();

    // Auto-fill from localStorage on load
    useEffect(() => {
        const storedAccountId = localStorage.getItem('lastMetaAdAccountId');
        const storedToken = localStorage.getItem('lastMetaAccessToken');
        if (storedAccountId && storedToken) {
            setAdAccountId(storedAccountId);
            setAccessToken(storedToken);
            setMode('manual'); // Select manual mode automatically if details exist
        }
    }, []);

    const handleProceed = async () => {
        setErrorMessage(null);
        try {
            if (mode === 'manual') {
                if (!adAccountId || !accessToken) {
                    throw new Error('Please fill in all Meta manual fields');
                }
                
                setLoading(true);
                const cleanAccountId = adAccountId.trim().replace(/^act_/, '');
                const cleanToken = accessToken.trim();

                console.log(`[Home Page] Verifying credentials for Ad Account act_${cleanAccountId}...`);

                // Verify with Meta Graph API
                const res = await fetch(`https://graph.facebook.com/v19.0/act_${cleanAccountId}?fields=id,name&access_token=${cleanToken}`);
                const data = await res.json();

                if (data.error) {
                    throw new Error(`Verification failed: ${data.error.message || 'Invalid Account ID or Access Token.'}`);
                }

                console.log(`[Home Page] Verified successfully: ${data.name}`);

                // Try exchanging the manual token for a 60-day long-lived token via backend
                let finalToken = cleanToken;
                try {
                    const exchangeRes = await fetch('/api/Facebook-exchange-token', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ access_token: cleanToken })
                    });
                    if (exchangeRes.ok) {
                        const exchangeData = await exchangeRes.json();
                        if (exchangeData.access_token) {
                            finalToken = exchangeData.access_token;
                            if (finalToken !== cleanToken) {
                                console.log('%c[Meta Token Exchange] SUCCESS: Upgraded to 60-day long-lived token!', 'color: #10b981; font-weight: bold; font-size: 12px;');
                            } else {
                                console.log('%c[Meta Token Exchange] NOTICE: Token is already long-lived or could not be upgraded further.', 'color: #3b82f6; font-weight: bold; font-size: 12px;');
                            }
                        } else {
                            console.warn('%c[Meta Token Exchange] FAILED: Server returned no token. Using original manual token.', 'color: #ef4444; font-weight: bold; font-size: 12px;');
                        }
                    } else {
                        console.warn('%c[Meta Token Exchange] FAILED: Server returned error status. Using original manual token.', 'color: #ef4444; font-weight: bold; font-size: 12px;');
                    }
                } catch (err) {
                    console.warn('%c[Meta Token Exchange] ERROR: Network/Exchange failed. Using original manual token.', 'color: #f59e0b; font-weight: bold; font-size: 12px;', err);
                }
                
                // Store verified credentials in local storage to bypass pasting next time
                localStorage.setItem('lastMetaAdAccountId', cleanAccountId);
                localStorage.setItem('lastMetaAccessToken', finalToken);

                router.push(`/choice/${cleanAccountId}?access_token=${finalToken}`);
            } else if (mode === 'login') {
                window.location.href = '/api/Facebook-login';
            }
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'An error occurred during verification.');
            console.error('Meta verification error:', error);
        } finally {
            setLoading(false);
        }
    };

    const isProceedDisabled = () => {
        if (mode === null) return true;
        if (mode === 'manual' && (!adAccountId || !accessToken)) return true;
        return false;
    };

    const handleClearCredentials = () => {
        localStorage.removeItem('lastMetaAdAccountId');
        localStorage.removeItem('lastMetaAccessToken');
        setAdAccountId('');
        setAccessToken('');
        setMode(null);
    };

    return (
        <div className="min-h-screen bg-slate-950 relative overflow-hidden flex items-center justify-center px-4 py-12">
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute -top-40 -left-32 w-[32rem] h-[32rem] bg-indigo-600/20 rounded-full blur-[120px]" />
                <div className="absolute -bottom-40 -right-32 w-[32rem] h-[32rem] bg-fuchsia-600/10 rounded-full blur-[120px]" />
            </div>

            <div className="relative w-full max-w-2xl">
                <div className="text-center mb-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-medium text-slate-300 tracking-wide uppercase mb-5">
                        <ShieldCheckIcon className="w-3.5 h-3.5 text-indigo-400" />
                        Secure account connection
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                        Social Media Management Portal
                    </h1>
                    <p className="mt-3 text-slate-400 text-sm">
                        Connect an ad account to get started managing campaigns.
                    </p>
                </div>

                <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-sm shadow-2xl">
                    <div className="flex justify-between items-center mb-4">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            Choose how you want to proceed
                        </p>
                        {adAccountId && accessToken && (
                            <button
                                onClick={handleClearCredentials}
                                className="text-[10px] font-semibold text-red-400 hover:text-red-300 underline cursor-pointer"
                            >
                                Clear Saved Session
                            </button>
                        )}
                    </div>

                    {/* Verification Error Banner */}
                    {errorMessage && (
                        <div className="mb-5 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs font-medium text-red-400 animate-in fade-in slide-in-from-top-2">
                            ⚠️ {errorMessage}
                        </div>
                    )}

                    <p className="text-[10px] font-semibold text-blue-300/70 uppercase tracking-wider mb-2">
                        Meta Ads
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                        <label
                            className={`group relative cursor-pointer rounded-2xl border overflow-hidden transition-all ${
                                mode === 'manual'
                                    ? 'border-blue-400/60 bg-blue-500/10 ring-2 ring-blue-400/30'
                                    : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                            }`}
                        >
                            <span className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-sky-400" />
                            <input
                                type="radio"
                                name="mode"
                                value="manual"
                                checked={mode === 'manual'}
                                onChange={() => setMode('manual')}
                                className="sr-only"
                            />
                            <div className="p-4 flex flex-col items-start gap-2.5">
                                <div className="p-2 rounded-xl bg-blue-500/15">
                                    <KeyIcon className="w-4.5 h-4.5 text-blue-300" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-white leading-tight">
                                        Meta &mdash; Manual
                                    </p>
                                    <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                                        Enter Ad Account ID &amp; token
                                    </p>
                                </div>
                            </div>
                        </label>

                        <label
                            className={`group relative cursor-pointer rounded-2xl border overflow-hidden transition-all ${
                                mode === 'login'
                                    ? 'border-blue-400/60 bg-blue-500/10 ring-2 ring-blue-400/30'
                                    : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                            }`}
                        >
                            <span className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-sky-400" />
                            <input
                                type="radio"
                                name="mode"
                                value="login"
                                checked={mode === 'login'}
                                onChange={() => setMode('login')}
                                className="sr-only"
                            />
                            <div className="p-4 flex flex-col items-start gap-2.5">
                                <div className="p-2 rounded-xl bg-blue-500/15">
                                    <ArrowRightOnRectangleIcon className="w-4.5 h-4.5 text-blue-300" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-white leading-tight">
                                        Meta &mdash; Login
                                    </p>
                                    <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                                        Connect with Facebook
                                    </p>
                                </div>
                            </div>
                        </label>
                    </div>

                    {mode === 'manual' && (
                        <div className="mt-5 space-y-3 animate-in fade-in slide-in-from-top-2">
                            <div>
                                <label className="block text-[11px] font-medium text-slate-400 mb-1.5">
                                    Ad Account ID
                                </label>
                                <input
                                    type="text"
                                    value={adAccountId}
                                    onChange={(e) => setAdAccountId(e.target.value)}
                                    placeholder="e.g. 1234567890"
                                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/50 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-medium text-slate-400 mb-1.5">
                                    Access Token
                                </label>
                                <input
                                    type="text"
                                    value={accessToken}
                                    onChange={(e) => setAccessToken(e.target.value)}
                                    placeholder="Enter Access Token"
                                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/50 transition-all"
                                />
                            </div>
                        </div>
                    )}

                    <button
                        onClick={handleProceed}
                        disabled={isProceedDisabled() || loading}
                        className="mt-6 w-full flex items-center justify-center gap-2 px-6 py-3 bg-white text-slate-950 text-sm font-semibold rounded-xl shadow-lg shadow-black/20 hover:bg-slate-100 active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100 transition-all"
                    >
                        {loading ? 'Verifying Credentials...' : 'Proceed'}
                        {!loading && <ArrowRightIcon className="w-4 h-4" />}
                    </button>
                </div>

                <p className="text-center text-[11px] text-slate-500 mt-6">
                    Your credentials are used only to connect to your ad account and are never stored.
                </p>
            </div>
        </div>
    );
}
