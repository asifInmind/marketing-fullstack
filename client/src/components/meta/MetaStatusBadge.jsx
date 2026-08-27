'use client';

import React from 'react';
import Chip from '@mui/material/Chip';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

const statusMap = {
  ENABLED: {
    color: 'success',
    icon: <PlayCircleOutlineIcon sx={{ fontSize: 16 }} />,
    label: 'Active',
  },
  PAUSED: {
    color: 'warning',
    icon: <PauseCircleOutlineIcon sx={{ fontSize: 16 }} />,
    label: 'Paused',
  },
  REMOVED: {
    color: 'error',
    icon: <HighlightOffIcon sx={{ fontSize: 16 }} />,
    label: 'Removed',
  },
  UNKNOWN: {
    color: 'default',
    icon: <HelpOutlineIcon sx={{ fontSize: 16 }} />,
    label: 'Unknown',
  },
};

export function MetaStatusBadge({ status }) {
  const normalizedStatus = String(status || '').toUpperCase();
  const config = statusMap[normalizedStatus] || statusMap.UNKNOWN;

  return (
    <Chip
      size="small"
      icon={config.icon}
      label={config.label}
      color={config.color}
      variant="light"
      sx={{
        fontWeight: 600,
        fontSize: '0.75rem',
        borderRadius: '4px',
        py: 0.2
      }}
    />
  );
}

export default MetaStatusBadge;