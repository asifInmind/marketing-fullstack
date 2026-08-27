'use client';

import React from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AdjustIcon from '@mui/icons-material/Adjust';
import CustomAvatar from '../mui/Avator';
import { MetaDynamicTable } from './MetaDynamicTable';
import { MetaLoadMoreButton } from './MetaLoadMoreButton';

export function MetaAdSetDetail({
  adSet,
  ads,
  loading,
  hasMore,
  loadingMore,
  onLoadMore,
  onBack,
  currencyCode = 'USD',
}) {
  const formatVal = (amount) => {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode,
      }).format(amount);
    } catch {
      return `${currencyCode} ${amount.toFixed(2)}`;
    }
  };

  if (!adSet) {
    return (
      <Card elevation={1} sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
          Ad Set not found
        </Typography>
        <Button variant="outlined" onClick={onBack}>
          Go Back
        </Button>
      </Card>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Ad Set Details Header Card */}
      <Card sx={{ borderRadius: 1, boxShadow: '0px 1px 3px #0F172A14', background: 'white', color: "#22303EE6", p: 0 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 3 }}>
            <IconButton onClick={onBack} color="primary" sx={{ border: '1px solid #D1D5DB', borderRadius: 2 }}>
              <ArrowBackIcon className="text-[#22303EE6]" />
            </IconButton>

            <CustomAvatar skin="light" color="success" variant="rounded" size={44}>
              <AdjustIcon />
            </CustomAvatar>

            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2, color: "#22303EE6" }}>
                {adSet.name}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mt: 0.5 }}>
                <Typography variant="caption" className='text-secondary'>Campaign: {adSet.campaignName}</Typography>
                <Typography variant="caption" className='text-secondary'>•</Typography>
                <Typography variant="caption" className='text-secondary'>Optimization: {adSet.optimizationGoal}</Typography>
                <Typography variant="caption" className='text-secondary'>•</Typography>
                <Typography variant="caption" className='text-secondary'>Status: {adSet.status}</Typography>
              </Box>
            </Box>

            <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
              <Typography variant="caption" className='text-secondary'>Total Ads</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: "#22303EE6" }}>
                {ads.length}
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Quick Metrics Grid */}
          <Grid container spacing={2}>
            <Grid item xs={6} sm={3}>
              <Typography variant="h5" className='text-secondary'>Total Spend</Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#22303EE6" }}>
                {formatVal(adSet.cost || 0)}
              </Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="h5" className='text-secondary'>Impressions</Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#22303EE6" }}>
                {adSet.impressions ? adSet.impressions.toLocaleString() : '0'}
              </Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="h5" className='text-secondary'>Clicks</Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#22303EE6" }}>
                {adSet.clicks ? adSet.clicks.toLocaleString() : '0'}
              </Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="h5" className='text-secondary'>Targeting</Typography>
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 700,
                  color: "#22303EE6",
                  fontSize: '0.875rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '200px'
                }}
                title={adSet.targeting}
              >
                {adSet.targeting || '—'}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Filtered Ads Section */}
      <Card elevation={1} sx={{ background: 'white' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#22303EE6", p: 3 }}>
            Ads in this Ad Set
          </Typography>
          <Chip label={`${ads.length} ads`} size="small" variant="outlined" color="primary" />
        </Box>

        <MetaDynamicTable
          activeTab="ads"
          data={ads}
          loading={loading}
          currencyCode={currencyCode}
        />

        {hasMore && (
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
            <MetaLoadMoreButton
              hasMore={hasMore}
              loading={loadingMore}
              onClick={onLoadMore}
              count={ads.length}
            />
          </Box>
        )}
      </Card>
    </Box>
  );
}

export default MetaAdSetDetail;
