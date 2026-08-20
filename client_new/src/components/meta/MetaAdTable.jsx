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
import { ExternalLink, Search, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { TextField } from '@mui/material';

const COLORS = {
  primary: '#36AE95',
  primaryDark: '#2B8A75',
  info: '#03C3EC',
  divider: 'rgba(0,0,0,0.12)',
  textSecondary: 'rgba(0,0,0,0.6)',
};

const columnHelper = createColumnHelper();


export function MetaAdTable({ ads, loading, loadingInsights = false, loadingCreatives }) {
  const [sorting, setSorting] = useState([{ id: 'name', desc: false }]);
  const [globalFilter, setGlobalFilter] = useState('');

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: 'Ad',
        cell: ({ row }) => (
          <div>
            <div className="font-medium text-sm text-slate-900">{row.original.name}</div>
            <div className="text-xs mt-0.5" style={{ color: COLORS.textSecondary }}>
              {row.original.type}
            </div>
          </div>
        ),
      }),
      columnHelper.accessor('headline', {
        header: 'Creative',
        cell: ({ row }) => {
          const ad = row.original;
          if (ad.headline === 'N/A') {
            return <span className="text-xs text-slate-400">No creative data</span>;
          }
          return (
            <div>
              <div className="text-sm text-slate-900">{ad.headline}</div>
              <div className="text-xs text-slate-500 truncate max-w-[150px]">{ad.description}</div>
              {ad.finalUrl !== '#' && (
                <a
                  href={ad.finalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs hover:underline flex items-center gap-1 mt-0.5"
                  style={{ color: COLORS.info }}
                >
                  {ad.finalUrl.replace(/^https?:\/\//, '').slice(0, 30)}...
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          );
        },
      }),
      columnHelper.accessor('adGroupName', {
        header: 'Ad Set',
        cell: ({ getValue }) => <span className="text-slate-600">{getValue()}</span>,
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
        cell: ({ getValue }) => getValue().toFixed(2),
        meta: { align: 'right' },
      }),
      columnHelper.accessor('cost', {
        header: 'Cost',
        cell: ({ getValue }) => getValue().toFixed(2),
        meta: { align: 'right' },
      }),
    ],
    [loadingInsights]
  );

  const table = useReactTable({
    data: ads || [],
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, columnId, filterValue) => {
      const term = filterValue.toLowerCase();
      return (
        row.original.name?.toLowerCase().includes(term) ||
        row.original.adGroupName?.toLowerCase().includes(term)
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
            Loading ads...
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
          <h3 className="text-sm font-semibold text-slate-900">Ads</h3>
          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
            {table.getFilteredRowModel().rows.length}
          </span>
          {loadingCreatives && (
            <span className="text-xs flex items-center gap-1" style={{ color: COLORS.primary }}>
              <span
                className="animate-spin rounded-full h-3 w-3 border-b-2"
                style={{ borderColor: COLORS.primary }}
              />
              Loading creatives...
            </span>
          )}
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
                    <ExternalLink className="w-8 h-8 text-slate-400" />
                    <p>No ads found</p>
                    <p className="text-xs">Create an ad to see data here</p>
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

export default MetaAdTable;