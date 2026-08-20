'use client';

import React from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CustomAvatar from '../mui/Avator';

const emptyMessages = {
  campaigns: {
    title: 'No Campaigns Found',
    description: 'Create your first campaign to start seeing data here.',
  },
  adSets: {
    title: 'No Ad Sets Found',
    description: 'Create an ad set within a campaign to start seeing data here.',
  },
  ads: {
    title: 'No Ads Found',
    description: 'Create an ad within an ad set to start seeing data here.',
  },
};

export function MetaEmptyState({ type }) {
  const message = emptyMessages[type] || {
    title: 'No Data Found',
    description: 'There is currently no data available to display.',
  };

  return (
    <Card elevation={1} sx={{ borderRadius: 3, p: 4, textAlign: 'center' }}>
      <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
        <CustomAvatar skin="light" color="secondary" variant="rounded" size={54} sx={{ mb: 1 }}>
          <InfoOutlinedIcon fontSize="large" />
        </CustomAvatar>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {message.title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {message.description}
        </Typography>
      </CardContent>
    </Card>
  );
}

export default MetaEmptyState;