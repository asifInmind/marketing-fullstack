// 'use client';

// import React from 'react';
// import { Target, Search } from 'lucide-react';
// import { MetaStatusBadge } from './MetaStatusBadge';

// export function MetaAdSetTable({ adSets, loading, loadingInsights = false }) {
//   if (loading) {
//     return (
//       <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
//         <div className="p-6 text-center">
//           <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
//           <p className="mt-2 text-sm text-slate-500">Loading ad sets...</p>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
//       <div className="p-4 border-b border-slate-200 dark:border-slate-800">
//         <div className="flex items-center gap-2">
//           <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Ad Sets</h3>
//           <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
//             {adSets.length}
//           </span>
//         </div>
//       </div>
//       <div className="overflow-x-auto">
//         <table className="w-full text-sm">
//           <thead>
//             <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
//               <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ad Set</th>
//               <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Campaign</th>
//               <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
//               <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Targeting</th>
//               <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Impressions</th>
//               <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Clicks</th>
//               <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">CTR</th>
//               <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cost</th>
//               <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Conversions</th>
//             </tr>
//           </thead>
//           <tbody>
//             {adSets.length === 0 ? (
//               <tr>
//                 <td colSpan={9} className="text-center py-8 text-slate-500 dark:text-slate-400">
//                   <div className="flex flex-col items-center gap-2">
//                     <Target className="w-8 h-8 text-slate-400" />
//                     <p>No ad sets found</p>
//                     <p className="text-xs">Create an ad set to see data here</p>
//                   </div>
//                 </td>
//               </tr>
//             ) : (
//               adSets.map((adSet) => (
//                 <tr key={adSet.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
//                   <td className="px-4 py-3">
//                     <div className="font-medium text-slate-900 dark:text-white text-sm">
//                       {adSet.name}
//                     </div>
//                     <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
//                       Opt: {adSet.optimizationGoal}
//                     </div>
//                   </td>
//                   <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
//                     {adSet.campaignName}
//                   </td>
//                   <td className="px-4 py-3">
//                     <MetaStatusBadge status={adSet.status} />
//                   </td>
//                   <td className="px-4 py-3">
//                     <div className="text-xs text-slate-600 dark:text-slate-300 truncate max-w-[150px]" title={adSet.targeting}>
//                       {adSet.targeting}
//                     </div>
//                   </td>
//                   <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
//                     {loadingInsights ? (
//                       <div className="h-4 w-16 bg-slate-100 dark:bg-slate-800 animate-pulse rounded ml-auto" />
//                     ) : (
//                       adSet.impressions.toLocaleString()
//                     )}
//                   </td>
//                   <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
//                     {loadingInsights ? (
//                       <div className="h-4 w-12 bg-slate-100 dark:bg-slate-800 animate-pulse rounded ml-auto" />
//                     ) : (
//                       adSet.clicks.toLocaleString()
//                     )}
//                   </td>
//                   <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
//                     {loadingInsights ? (
//                       <div className="h-4 w-12 bg-slate-100 dark:bg-slate-800 animate-pulse rounded ml-auto" />
//                     ) : (
//                       `${adSet.ctr.toFixed(2)}%`
//                     )}
//                   </td>
//                   <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
//                     {loadingInsights ? (
//                       <div className="h-4 w-16 bg-slate-100 dark:bg-slate-800 animate-pulse rounded ml-auto" />
//                     ) : (
//                       `$${adSet.cost.toFixed(2)}`
//                     )}
//                   </td>
//                   <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
//                     {loadingInsights ? (
//                       <div className="h-4 w-12 bg-slate-100 dark:bg-slate-800 animate-pulse rounded ml-auto" />
//                     ) : (
//                       adSet.conversions.toLocaleString()
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
import { Target, Search, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { MetaStatusBadge } from './MetaStatusBadge';
import { InputAdornment, TextField } from '@mui/material';

const COLORS = {
  primary: '#36AE95',
  primaryDark: '#2B8A75',
  divider: 'rgba(0,0,0,0.12)',
  textSecondary: 'rgba(0,0,0,0.6)',
};

const columnHelper = createColumnHelper();


export function MetaAdSetTable({ adSets, loading, loadingInsights = false }) {
  const [sorting, setSorting] = useState([{ id: 'name', desc: false }]);
  const [globalFilter, setGlobalFilter] = useState('');

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: 'Ad Set',
        cell: ({ row }) => (
          <div>
            <div className="font-medium text-sm text-slate-900">{row.original.name}</div>
            <div className="text-xs mt-0.5" style={{ color: COLORS.textSecondary }}>
              Opt: {row.original.optimizationGoal}
            </div>
          </div>
        ),
      }),
      columnHelper.accessor('campaignName', {
        header: 'Campaign',
        cell: ({ getValue }) => <span className="text-slate-600">{getValue()}</span>,
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        cell: ({ getValue }) => getValue()
      }),
      columnHelper.accessor('targeting', {
        header: 'Targeting',
        cell: ({ getValue }) => (
          <div className="text-xs text-slate-600 truncate max-w-[150px]" title={getValue()}>
            {getValue()}
          </div>
        ),
      }),
      columnHelper.accessor('impressions', {
        header: 'Impressions',
        cell: ({ getValue }) => getValue().toLocaleString(),
        meta: { align: 'right' },
      }),
      columnHelper.accessor('clicks', {
        header: 'Clicks',
        cell: ({ getValue }) => getValue().toLocaleString(),
        meta: { align: 'right' },
      }),
      columnHelper.accessor('ctr', {
        header: 'CTR',
        cell: ({ getValue }) => `${getValue().toFixed(2)}%`,
        meta: { align: 'right' },
      }),
      columnHelper.accessor('cost', {
        header: 'Cost',
        cell: ({ getValue }) => `$${getValue().toFixed(2)}`,
        meta: { align: 'right' },
      }),
      columnHelper.accessor('conversions', {
        header: 'Conversions',
        cell: ({ getValue }) => getValue().toLocaleString(),
        meta: { align: 'right' },
      }),
    ],
    [loadingInsights]
  );

  const table = useReactTable({
    data: adSets || [],
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, columnId, filterValue) => {
      const term = filterValue.toLowerCase();
      return (
        row.original.name?.toLowerCase().includes(term) ||
        row.original.campaignName?.toLowerCase().includes(term)
      );
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  if (loading) {
    return (
      <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: COLORS.divider }}>
        <div className="p-6 text-center">
          <div
            className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto"
            style={{ borderColor: COLORS.primary }}
          />
          <p className="mt-2 text-sm" style={{ color: COLORS.textSecondary }}>
            Loading ad sets...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: COLORS.divider }}>
      {/* Top bar */}
      <div className="p-4 border-b flex items-center justify-between gap-3" style={{ borderColor: COLORS.divider }}>
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-900">Ad Sets</h3>
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
                    <Target className="w-8 h-8 text-slate-400" />
                    <p>No ad sets found</p>
                    <p className="text-xs">Create an ad set to see data here</p>
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

export default MetaAdSetTable;