'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function SelectAccountContent() {
    const [adAccounts, setAdAccounts] = useState([]);
    const [error, setError] = useState('');
    const searchParams = useSearchParams();
    const router = useRouter();

    const urlAccessToken = searchParams.get('access_token');
    const accessToken = urlAccessToken ?? 'EAANNwrHSS7EBO98baLarQqy3CpdM5cr7nyAdmkA3oTDejtU7ka6GiOnBmtimNZB33ep71xqgFFJom4rXcAEX3irRBzfKQMViTBTyYiemWZCWdrZCApvySLDNzyXZBuBlNK6ZAGfv0QbjXQPVEoacpeyZBhZC5IeUCJdG8gcK9d0ljXEQWx8JJ9zNLmCWfjmz8ElBMBAvEcfySMmbKDhnN6hddHHrgZDZD';

    useEffect(() => {
        const fetchAdAccounts = async () => {
            try {
                const res = await fetch(`https://graph.facebook.com/v19.0/me/adaccounts?fields=id,name,account_status&access_token=${accessToken}`);
                const data = await res.json();
                if (data.error) {
                    setError(data.error.message);
                    return;
                }
                setAdAccounts(data.data);
            } catch {
                setError('Failed to fetch ad accounts.');
            }
        };

        if (accessToken) fetchAdAccounts();
    }, [accessToken]);

    const handleSubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const selectedId = formData.get('account');
        if (selectedId) {
            router.push(`/choice/${selectedId}?access_token=${accessToken}`);
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-8">
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Select an Ad Account</h2>
                <p className="text-sm text-gray-500 mt-1">Choose the account you want to manage campaigns for.</p>
            </div>

            {error && (
                <div className="mb-6 flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3.5">
                    <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                    <span>{error}</span>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2.5">
                    {adAccounts.map((account) => (
                        <label
                            key={account.id}
                            htmlFor={account.id}
                            className="group flex items-center gap-3.5 p-4 rounded-2xl border border-gray-200 bg-white cursor-pointer transition-all hover:border-gray-300 hover:shadow-sm has-[:checked]:border-amber-400 has-[:checked]:bg-amber-50 has-[:checked]:ring-1 has-[:checked]:ring-amber-300"
                        >
                            <input
                                type="radio"
                                name="account"
                                value={account.id.replace('act_', '')}
                                id={account.id}
                                required
                                className="peer sr-only"
                            />

                            <span className="relative shrink-0 w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center transition-colors peer-checked:border-amber-500 group-has-[:checked]:border-amber-500">
                                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 scale-0 transition-transform peer-checked:scale-100 group-has-[:checked]:scale-100" />
                            </span>

                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{account.name}</p>
                                <p className="text-xs text-gray-400 font-mono mt-0.5">{account.id}</p>
                            </div>

                            <svg
                                className="w-4 h-4 text-amber-500 opacity-0 scale-90 transition-all peer-checked:opacity-100 peer-checked:scale-100 group-has-[:checked]:opacity-100 group-has-[:checked]:scale-100 shrink-0"
                                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                        </label>
                    ))}
                </div>

                <button
                    type="submit"
                    className="w-full sm:w-auto px-6 py-2.5 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 active:scale-[0.98] rounded-xl transition-all cursor-pointer shadow-sm"
                >
                    Continue
                </button>
            </form>
        </div>
    );
}

export default function SelectAccountPage() {
    return (
        <Suspense
            fallback={
                <div className="max-w-2xl mx-auto p-8 flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto"></div>
                        <p className="mt-4 text-gray-600">Loading ad accounts...</p>
                    </div>
                </div>
            }
        >
            <SelectAccountContent />
        </Suspense>
    );
}
