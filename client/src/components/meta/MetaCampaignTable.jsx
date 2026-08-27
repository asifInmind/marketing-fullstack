// 'use client';

// import React, { useState } from 'react';
// import { Search, Filter, Download, TrendingUp, TrendingDown, ChevronRight } from 'lucide-react';
// import { MetaStatusBadge } from './MetaStatusBadge';

// export function MetaCampaignTable({ campaigns, loading, loadingInsights = false, onCampaignClick }) {
//   const [sortField, setSortField] = useState('name');
//   const [sortDirection, setSortDirection] = useState('asc');
//   const [searchTerm, setSearchTerm] = useState('');

//   const filteredCampaigns = campaigns.filter(campaign =>
//     campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
//     campaign.type.toLowerCase().includes(searchTerm.toLowerCase())
//   );

//   const sortedCampaigns = [...filteredCampaigns].sort((a, b) => {
//     const aVal = a[sortField] ?? '';
//     const bVal = b[sortField] ?? '';
//     if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
//     if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
//     return 0;
//   });

//   const handleSort = (field) => {
//     if (sortField === field) {
//       setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
//     } else {
//       setSortField(field);
//       setSortDirection('asc');
//     }
//   };

//   const getTypeColor = (type) => {
//     const typeMap = {
//       VIDEO: 'bg-blue-500/15 text-blue-400',
//       DISPLAY: 'bg-purple-500/15 text-purple-400',
//       SEARCH: 'bg-emerald-500/15 text-emerald-400',
//       SHOPPING: 'bg-amber-500/15 text-amber-400',
//       LEAD_GEN: 'bg-pink-500/15 text-pink-400',
//       APP_INSTALL: 'bg-indigo-500/15 text-indigo-400',
//       SOCIAL: 'bg-orange-500/15 text-orange-400',
//     };
//     return typeMap[type] || 'bg-slate-500/15 text-slate-400';
//   };

//   if (loading) {
//     return (
//       <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
//         <div className="p-6 text-center">
//           <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
//           <p className="mt-2 text-sm text-slate-500">Loading campaigns...</p>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
//       {/* Table Header with Controls */}
//       <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
//         <div className="flex items-center gap-2">
//           <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Campaigns</h3>
//           <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
//             {campaigns.length}
//           </span>
//         </div>
//         <div className="flex items-center gap-2">
//           <div className="relative">
//             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
//             <input
//               type="text"
//               placeholder="Search campaigns..."
//               value={searchTerm}
//               onChange={(e) => setSearchTerm(e.target.value)}
//               className="pl-9 pr-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-900 dark:text-white placeholder:text-slate-400"
//             />
//           </div>
//           <button className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
//             <Filter className="w-4 h-4 text-slate-500" />
//           </button>
//           <button className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
//             <Download className="w-4 h-4 text-slate-500" />
//           </button>
//         </div>
//       </div>

//       {/* Table */}
//       <div className="overflow-x-auto">
//         <table className="w-full text-sm">
//           <thead>
//             <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
//               <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Campaign</th>
//               <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
//               <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Type</th>
//               <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Impressions</th>
//               <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Clicks</th>
//               <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">CTR</th>
//               <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cost</th>
//               <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Conversions</th>
//               <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Revenue</th>
//               <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">ROAS</th>
//             </tr>
//           </thead>
//           <tbody>
//             {sortedCampaigns.length === 0 ? (
//               <tr>
//                 <td colSpan={11} className="text-center py-8 text-slate-500 dark:text-slate-400">
//                   <div className="flex flex-col items-center gap-2">
//                     <Search className="w-8 h-8 text-slate-400" />
//                     <p>No campaigns found</p>
//                     <p className="text-xs">Try adjusting your search</p>
//                   </div>
//                 </td>
//               </tr>
//             ) : (
//               sortedCampaigns.map((campaign) => (
//                 <tr
//                   key={campaign.id}
//                   className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
//                 >
//                   <td className="px-4 py-3">
//                     {onCampaignClick && (
//                       <div className="font-medium text-slate-900 cursor-pointer hover:text-blue-500 dark:text-white text-sm" onClick={() => onCampaignClick(campaign.id)} >
//                         {campaign.name}
//                       </div>
//                     )}
//                     {campaign.objective && (
//                       <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
//                         Objective: {campaign.objective}
//                       </div>
//                     )}
//                   </td>
//                   <td className="px-4 py-3">
//                     <MetaStatusBadge status={campaign.status} />
//                   </td>
//                   <td className="px-4 py-3">
//                     <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(campaign.type)}`}>
//                       {campaign.type.replace('_', ' ')}
//                     </span>
//                   </td>
//                   <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
//                     {loadingInsights ? (
//                       <div className="h-4 w-16 bg-slate-100 dark:bg-slate-800 animate-pulse rounded ml-auto" />
//                     ) : (
//                       campaign.impressions.toLocaleString()
//                     )}
//                   </td>
//                   <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
//                     {loadingInsights ? (
//                       <div className="h-4 w-12 bg-slate-100 dark:bg-slate-800 animate-pulse rounded ml-auto" />
//                     ) : (
//                       campaign.clicks.toLocaleString()
//                     )}
//                   </td>
//                   <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
//                     {loadingInsights ? (
//                       <div className="h-4 w-12 bg-slate-100 dark:bg-slate-800 animate-pulse rounded ml-auto" />
//                     ) : (
//                       `${campaign.ctr.toFixed(2)}%`
//                     )}
//                   </td>
//                   <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
//                     {loadingInsights ? (
//                       <div className="h-4 w-16 bg-slate-100 dark:bg-slate-800 animate-pulse rounded ml-auto" />
//                     ) : (
//                       `$${campaign.cost.toFixed(2)}`
//                     )}
//                   </td>
//                   <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
//                     {loadingInsights ? (
//                       <div className="h-4 w-12 bg-slate-100 dark:bg-slate-800 animate-pulse rounded ml-auto" />
//                     ) : (
//                       campaign.conversions.toLocaleString()
//                     )}
//                   </td>
//                   <td className="px-4 py-3 text-right font-medium text-emerald-600 dark:text-emerald-400">
//                     {loadingInsights ? (
//                       <div className="h-4 w-16 bg-slate-100 dark:bg-slate-800 animate-pulse rounded ml-auto" />
//                     ) : (
//                       `$${campaign.conversionValue.toFixed(2)}`
//                     )}
//                   </td>
//                   <td className="px-4 py-3 text-right">
//                     {loadingInsights ? (
//                       <div className="h-4 w-12 bg-slate-100 dark:bg-slate-800 animate-pulse rounded ml-auto" />
//                     ) : (
//                       <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${campaign.roas > 2
//                         ? 'bg-emerald-500/15 text-emerald-500'
//                         : campaign.roas > 1
//                           ? 'bg-amber-500/15 text-amber-500'
//                           : 'bg-red-500/15 text-red-500'
//                         }`}>
//                         {campaign.roas > 0 ? campaign.roas.toFixed(2) + 'x' : '0x'}
//                       </span>
//                     )}
//                   </td>
//                 </tr>
//               ))
//             )}
//           </tbody>
//         </table>
//       </div>
//     </div>
//   );
// }

'use client';

import React, { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import { Search, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { MetaStatusBadge } from './MetaStatusBadge';
import { TextField } from '@mui/material';

// Theme colors (from colorSchemes.js) — kept here so this file is self-contained.
// Swap these for your MUI theme tokens (primary.main, error.main, etc.) if you'd
// rather pull them from the theme provider instead of hardcoding.
const COLORS = {
  primary: '#36AE95',
  primaryDark: '#2B8A75',
  error: '#FF3E1D',
  success: '#71DD37',
  warning: '#FFAB00',
  divider: 'rgba(0,0,0,0.12)',
  textSecondary: 'rgba(0,0,0,0.6)',
};

const columnHelper = createColumnHelper();

const TYPE_COLOR_MAP = {
  VIDEO: 'bg-blue-500/15 text-blue-500',
  DISPLAY: 'bg-purple-500/15 text-purple-500',
  SEARCH: 'bg-emerald-500/15 text-emerald-500',
  SHOPPING: 'bg-amber-500/15 text-amber-500',
  LEAD_GEN: 'bg-pink-500/15 text-pink-500',
  APP_INSTALL: 'bg-indigo-500/15 text-indigo-500',
  SOCIAL: 'bg-orange-500/15 text-orange-500',
};

function getTypeColor(type) {
  return TYPE_COLOR_MAP[type] || 'bg-slate-500/15 text-slate-500';
}


export function MetaCampaignTable({ campaigns, loading, loadingInsights = false, onCampaignClick }) {
  const [sorting, setSorting] = useState([{ id: 'name', desc: false }]);
  const [globalFilter, setGlobalFilter] = useState('');

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: 'Campaign',
        cell: ({ row }) => (
          <div>
            <div
              className={`font-medium text-sm ${onCampaignClick ? 'cursor-pointer hover:underline' : ''}`}
              style={{ color: COLORS.primaryDark }}
              onClick={() => onCampaignClick && onCampaignClick(row.original.id)}
            >
              {row.original.name}
            </div>
            {row.original.objective && (
              <div className="text-xs mt-0.5" style={{ color: COLORS.textSecondary }}>
                Objective: {row.original.objective}
              </div>
            )}
          </div>
        ),
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        // cell: ({ getValue }) => <MetaStatusBadge status={getValue()} />,
        cell: ({ getValue }) => getValue(),
      }),
      columnHelper.accessor('type', {
        header: 'Type',
        cell: ({ getValue }) => (
          // <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(getValue())}`}>
          getValue().replace('_', ' ')
          // </span>
        ),
      }),
      columnHelper.accessor('impressions', {
        header: 'Impressions',
        cell: ({ getValue }) =>
          loadingInsights ? <SkeletonCell w="w-16" /> : getValue().toLocaleString(),
        meta: { align: 'right' },
      }),
      columnHelper.accessor('clicks', {
        header: 'Clicks',
        cell: ({ getValue }) =>
          loadingInsights ? <SkeletonCell w="w-12" /> : getValue().toLocaleString(),
        meta: { align: 'right' },
      }),
      columnHelper.accessor('ctr', {
        header: 'CTR',
        cell: ({ getValue }) =>
          loadingInsights ? <SkeletonCell w="w-12" /> : `${getValue().toFixed(2)}%`,
        meta: { align: 'right' },
      }),
      columnHelper.accessor('cost', {
        header: 'Cost',
        cell: ({ getValue }) =>
          loadingInsights ? <SkeletonCell w="w-16" /> : `$${getValue().toFixed(2)}`,
        meta: { align: 'right' },
      }),
      columnHelper.accessor('conversions', {
        header: 'Conversions',
        cell: ({ getValue }) =>
          loadingInsights ? <SkeletonCell w="w-12" /> : getValue().toLocaleString(),
        meta: { align: 'right' },
      }),
      columnHelper.accessor('conversionValue', {
        header: 'Revenue',
        cell: ({ getValue }) =>
          loadingInsights ? (
            <SkeletonCell w="w-12" />
          ) : (
              getValue().toFixed(2)
          ),
        meta: { align: 'right' },
      }),
      columnHelper.accessor('roas', {
        header: 'ROAS',
        cell: ({ getValue }) => {
          if (loadingInsights) return <SkeletonCell w="w-12" />;
          
          return (
            getValue().toFixed(2)
          );
        },
        meta: { align: 'right' },
      }),
    ],
    [loadingInsights, onCampaignClick]
  );

  const table = useReactTable({
    data: campaigns || [],
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, columnId, filterValue) => {
      const term = filterValue.toLowerCase();
      return (
        row.original.name?.toLowerCase().includes(term) ||
        row.original.type?.toLowerCase().includes(term)
      );
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const handleReset = () => {
    setSorting([{ id: 'name', desc: false }]);
    setGlobalFilter('');
  };

  const handleDownloadReport = () => {
    const rows = table.getFilteredRowModel().rows.map((r) => r.original);
    const header = columns.map((c) => c.header).join(',');
    const body = rows
      .map((c) =>
        [
          c.name,
          c.status,
          c.type,
          c.impressions,
          c.clicks,
          c.ctr,
          c.cost,
          c.conversions,
          c.conversionValue,
          c.roas,
        ].join(',')
      )
      .join('\n');
    const csv = `${header}\n${body}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'campaign-report.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: COLORS.divider }}>
        <div className="p-6 text-center">
          <div
            className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto"
            style={{ borderColor: COLORS.primary }}
          />
          <p className="mt-2 text-sm" style={{ color: COLORS.textSecondary }}>
            Loading campaigns...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: COLORS.divider }}>
      {/* Top bar: search + Reset / Apply / Download Report (matches reference screenshot) */}
      <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ borderColor: COLORS.divider }}>
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-900">Campaigns</h3>
          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
            {table.getFilteredRowModel().rows.length}
          </span>
          <div className="relative ml-2">
            <TextField
                          label="Search ad sets"
                          variant="outlined"
                          size='small'
                          className="pl-9 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 text-slate-900 placeholder:text-slate-400"
                          value={globalFilter}
                          onChange={(e) => setGlobalFilter(e.target.value)}
                        />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="px-4 py-1.5 text-sm font-semibold rounded-lg border transition-colors hover:bg-red-50"
            style={{ borderColor: COLORS.error, color: COLORS.error }}
          >
            Reset
          </button>
          <button
            className="px-4 py-1.5 text-sm font-semibold rounded-lg text-white transition-colors"
            style={{ backgroundColor: COLORS.primary }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = COLORS.primaryDark)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = COLORS.primary)}
          >
            Apply
          </button>
          <button
            onClick={handleDownloadReport}
            className="px-4 py-1.5 text-sm font-semibold rounded-lg text-white transition-colors"
            style={{ backgroundColor: COLORS.primary }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = COLORS.primaryDark)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = COLORS.primary)}
          >
            Download Report
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} style={{ backgroundColor: COLORS.primary }}>
                {headerGroup.headers.map((header) => {
                  const align = header.column.columnDef.meta?.align === 'right' ? 'text-right justify-end' : 'text-left';
                  return (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className={`px-4 py-3 text-xs font-semibold text-white uppercase tracking-wider cursor-pointer select-none ${align}`}
                    >
                      <div className={`flex items-center gap-1 ${align}`}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </div>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-8 text-slate-500">
                  <div className="flex flex-col items-center gap-2">
                    <Search className="w-8 h-8 text-slate-400" />
                    <p>No campaigns found</p>
                    <p className="text-xs">Try adjusting your search</p>
                  </div>
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b hover:bg-slate-50 transition-colors"
                  style={{ borderColor: COLORS.divider }}
                >
                  {row.getVisibleCells().map((cell) => {
                    const align = cell.column.columnDef.meta?.align === 'right' ? 'text-right' : 'text-left';
                    return (
                      <td key={cell.id} className={`px-4 py-3 text-slate-700 ${align}`}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SkeletonCell({ w }) {
  return <div className={`h-4 ${w} bg-slate-100 animate-pulse rounded ml-auto`} />;
}

export default MetaCampaignTable;