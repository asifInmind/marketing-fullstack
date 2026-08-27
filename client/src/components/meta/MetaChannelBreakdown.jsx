'use client'

import React from 'react';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';

export function MetaChannelBreakdown({ channelBreakdown, totalRevenue, currencyCode = 'USD', loading = false }) {
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

  if (!channelBreakdown || channelBreakdown.length === 0) {
    return null;
  }

  return (
    <Card sx={{ bgcolor: 'white', borderRadius: 2.5, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', p: '24px !important', mb: 1.5 }}>
      <Typography variant="caption" sx={{ fontWeight: 800, textTransform: 'uppercase', tracking: 'wider', color: 'text.secondary', fontSize: '0.7rem', display: 'block', mb: 2 }}>
        Shopify Sales Channel Attribution Breakdown
      </Typography>
      <Grid container spacing={3}>
        {channelBreakdown.map((chan) => {
          const pct = totalRevenue > 0 ? (chan.revenue / totalRevenue) * 100 : 0;

          return (
            <Grid item xs={12} sm={6} md={3} key={chan.channel}>
              <Box sx={{ p: 2, border: '1px solid #F1F5F9', borderRadius: 2 }}>
                {loading ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Skeleton variant="text" width="50%" height={16} />
                    <Skeleton variant="text" width="70%" height={28} />
                    <Skeleton variant="text" width="90%" height={16} />
                  </Box>
                ) : (
                  <>
                    <Typography variant="caption" sx={{ fontWeight: 800, textTransform: 'uppercase', tracking: 'wider', color: 'text.secondary', fontSize: '0.65rem' }}>
                      {chan.channel}
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#22303E', mt: 0.5 }}>
                      {formatCurrency(chan.revenue)}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, alignItems: 'center' }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                        {chan.orders} {chan.orders === 1 ? 'order' : 'orders'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 700 }}>
                        {pct.toFixed(1)}% Share
                      </Typography>
                    </Box>
                    <Box sx={{ width: '100%', height: 4, bgcolor: '#F1F5F9', borderRadius: 1, mt: 1, overflow: 'hidden' }}>
                      <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: 'success.main' }} />
                    </Box>
                  </>
                )}
              </Box>
            </Grid>
          );
        })}
      </Grid>
    </Card>
  );
}
