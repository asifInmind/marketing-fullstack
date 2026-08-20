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
import BarChartIcon from '@mui/icons-material/BarChart';
import CustomAvatar from '../mui/Avator';
import { MetaDynamicTable } from './MetaDynamicTable';
import { MetaLoadMoreButton } from './MetaLoadMoreButton';

export function MetaCampaignDetail({
  campaign,
  adSets,
  loading,
  hasMore,
  loadingMore,
  onLoadMore,
  onBack,
  onAdSetClick,
  currencyCode = 'USD',
}) {
  const formatCurrency = (amount) => {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode,
      }).format(amount);
    } catch {
      return `${currencyCode} ${amount.toFixed(2)}`;
    }
  };

  if (!campaign) {
    return (
      <Card elevation={1} sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
          Campaign not found
        </Typography>
        <Button variant="outlined" onClick={onBack}>
          Go Back
        </Button>
      </Card>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Campaign Details Header Card */}
      <Card sx={{ borderRadius: 1, boxShadow: '0px 1px 3px #0F172A14', background: 'white', color: "#22303EE6", p: 0 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 3 }}>
            <IconButton onClick={onBack} color="primary" sx={{ border: '1px solid #D1D5DB', borderRadius: 2 }}>
              <ArrowBackIcon className="text-[#22303EE6]" />
            </IconButton>

            <CustomAvatar skin="light" color="primary" variant="rounded" size={44}>
              <BarChartIcon />
            </CustomAvatar>

            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2, color: "#22303EE6" }}>
                {campaign.name}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mt: 0.5 }}>
                <Typography variant="caption" className='text-secondary' >Objective: {campaign.objective}</Typography>
                <Typography variant="caption" className='text-secondary'>•</Typography>
                <Typography variant="caption" className='text-secondary'>Status: {campaign.status}</Typography>
                <Typography variant="caption" className='text-secondary'>•</Typography>
                <Typography variant="caption" className='text-secondary'>Type: {campaign.type}</Typography>
              </Box>
            </Box>

            <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
              <Typography variant="caption" className='text-secondary'>Total Ad Sets</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: "#22303EE6" }}>
                {adSets.length}
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Quick Metrics Grid */}
          <Grid container spacing={2}>
            <Grid item xs={6} sm={3}>
              <Typography variant="h5" className='text-secondary'>Total Spend</Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#22303EE6" }}>
                {formatCurrency(campaign.cost || 0)}
              </Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="h5" className='text-secondary'>Impressions</Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#22303EE6" }}>
                {campaign.impressions ? campaign.impressions.toLocaleString() : '0'}
              </Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="h5" className='text-secondary'>Conversions</Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#22303EE6" }}>
                {campaign.conversions ? campaign.conversions.toLocaleString() : '0'}
              </Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="h5" className='text-secondary'>ROAS</Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#22303EE6" }}>
                {campaign.roas > 0 ? campaign.roas.toFixed(2) + 'x' : '0x'}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Filtered Ad Sets Section */}
      <Card elevation={1} sx={{ background: 'white',  }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color:"#22303EE6" ,  p: 3}}>
            Ad Sets in this Campaign
          </Typography>
          <Chip label={`${adSets.length} ad sets`} size="small" variant="outlined" color="primary" sx={{ mr: 3 }} />
        </Box>

        <MetaDynamicTable
          activeTab="adSets"
          data={adSets}
          loading={loading}
          onAdSetClick={onAdSetClick}
          currencyCode={currencyCode}
        />

        {hasMore && (
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
            <MetaLoadMoreButton
              hasMore={hasMore}
              loading={loadingMore}
              onClick={onLoadMore}
              count={adSets.length}
            />
          </Box>
        )}
      </Card>
    </Box>
  );
}

export default MetaCampaignDetail;