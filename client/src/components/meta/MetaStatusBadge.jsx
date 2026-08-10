'use client';

import React from 'react';
import {
  PlayCircle,
  PauseCircle,
  StopCircle,
  AlertCircle,
} from 'lucide-react';

const statusMap = {
  ENABLED: {
    color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    icon: <PlayCircle className="w-3.5 h-3.5" />,
    label: 'Active',
  },
  PAUSED: {
    color: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    icon: <PauseCircle className="w-3.5 h-3.5" />,
    label: 'Paused',
  },
  REMOVED: {
    color: 'bg-red-500/15 text-red-400 border-red-500/30',
    icon: <StopCircle className="w-3.5 h-3.5" />,
    label: 'Removed',
  },
  UNKNOWN: {
    color: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
    icon: <AlertCircle className="w-3.5 h-3.5" />,
    label: 'Unknown',
  },
};

export function MetaStatusBadge({ status }) {
  const config = statusMap[status] || statusMap.UNKNOWN;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.color}`}>
      {config.icon}
      {config.label}
    </span>
  );
}
