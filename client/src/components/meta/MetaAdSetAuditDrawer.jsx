'use client';

import React, { useState, useEffect } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  AlertTitle,
  Pagination,
  Stack
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import BarChartIcon from '@mui/icons-material/BarChart';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import WarningIcon from '@mui/icons-material/Warning';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';

export function MetaAdSetAuditDrawer({
  open,
  onClose,
  adSetId,
  adSetName: initialAdSetName,
  startDate,
  endDate,
  currencyCode = 'PKR',
  activeDateRangeLabel = 'Last 30 Days'
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open && adSetId) {
      setLoading(true);
      setError(null);
      
      const shopifyUrl = localStorage.getItem('shopifyStoreUrl') || '';
      const params = new URLSearchParams({
        adset_id: adSetId,
        currency: currencyCode
      });
      if (shopifyUrl) params.append('shopify_url', shopifyUrl);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      fetch(`${BACKEND_URL}/api/shopify/adset-performance?${params.toString()}`)
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch ad set performance calculations');
          return res.json();
        })
        .then(resJson => {
          if (resJson.success) {
            setData(resJson.data);
          } else {
            throw new Error(resJson.error || 'Failed to fetch calculations');
          }
        })
        .catch(err => {
          console.error(err);
          setError(err.message);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setData(null);
    }
  }, [open, adSetId, startDate, endDate, currencyCode]);

  const [dailyPage, setDailyPage] = useState(1);
  const [ordersPage, setOrdersPage] = useState(1);
  const PAGE_SIZE = 100;

  useEffect(() => {
    setDailyPage(1);
    setOrdersPage(1);
  }, [adSetId, startDate, endDate]);

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

  const adSetName = data?.adSetName || initialAdSetName || 'N/A';
  const adSetStatus = data?.adSetStatus || 'UNKNOWN';

  const dailyTrends = data?.dailySpendBreakdown || [];
  const totalDailyPages = Math.ceil(dailyTrends.length / PAGE_SIZE);
  const paginatedDailyTrends = dailyTrends.slice((dailyPage - 1) * PAGE_SIZE, dailyPage * PAGE_SIZE);

  const matchedOrders = data?.matchedOrders || [];
  const totalOrdersPages = Math.ceil(matchedOrders.length / PAGE_SIZE);
  const paginatedOrders = matchedOrders.slice((ordersPage - 1) * PAGE_SIZE, ordersPage * PAGE_SIZE);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { width: { xs: '100%', md: '80%', lg: '70%', xl: '60%' }, bgcolor: '#F8FAFC' }
      }}
    >
      {/* Drawer Header */}
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#fff', borderBottom: '1px solid #E2E8F0' }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, color: 'slate.900' }}>
            {adSetName}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 1, alignItems: 'center' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              AdSet ID: {adSetId}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>•</Typography>
            <Chip
              label={adSetStatus}
              size="small"
              sx={{
                fontWeight: 700,
                fontSize: '0.7rem',
                height: '20px',
                bgcolor: adSetStatus.toUpperCase() === 'ACTIVE' ? '#D1FAE5' : '#F3F4F6',
                color: adSetStatus.toUpperCase() === 'ACTIVE' ? '#065F46' : '#374151'
              }}
            />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>•</Typography>
            <Chip
              icon={<CalendarTodayIcon sx={{ fontSize: '0.85rem !important' }} />}
              label={activeDateRangeLabel}
              size="small"
              sx={{
                fontWeight: 700,
                fontSize: '0.7rem',
                height: '20px',
                bgcolor: '#E0F2FE',
                color: '#0369A1'
              }}
            />
          </Box>
        </Box>
        <IconButton onClick={onClose} edge="end">
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Drawer Body */}
      {loading ? (
        <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 2 }}>
          <CircularProgress size={42} />
          <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
            Calculating Ad Set Audit Details...
          </Typography>
        </Box>
      ) : error ? (
        <Box sx={{ p: 4 }}>
          <Alert severity="error">
            <AlertTitle>Error Loading Audit</AlertTitle>
            {error}
          </Alert>
        </Box>
      ) : data ? (
        <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto', flex: 1 }}>
          
          {/* KPI Grid */}
          <Grid container spacing={2}>
            {[
              {
                title: 'Meta ROAS (Pixel)',
                value: `${(data.metaROAS || 0).toFixed(2)}x`,
                subtitle: 'Pixel Revenue / Spend',
                color: data.metaROAS >= 2 ? '#10B981' : data.metaROAS >= 1 ? '#F59E0B' : '#EF4444'
              },
              {
                title: 'Shopify ROAS (Attributed)',
                value: `${(data.trueROAS || 0).toFixed(2)}x`,
                subtitle: 'Shopify Revenue / Spend',
                color: data.trueROAS >= 2 ? '#10B981' : data.trueROAS >= 1 ? '#F59E0B' : '#EF4444'
              },
              {
                title: 'Ad Spend (Meta)',
                value: formatCurrency(data.metaSpend || 0),
                subtitle: `${(data.metaClicks || 0).toLocaleString()} clicks • ${(data.metaImpressions || 0).toLocaleString()} impressions`,
                color: 'text.primary'
              },
              {
                title: 'Meta Sales (Pixel)',
                value: formatCurrency(data.metaRevenue || 0),
                subtitle: `${data.metaConversions || 0} conversions`,
                color: 'text.primary'
              },
              {
                title: 'Shopify Sales (Attributed)',
                value: formatCurrency(data.shopifyRevenue || 0),
                subtitle: `${data.shopifyConversions || 0} conversions`,
                color: 'text.primary'
              }
            ].map((kpi, idx) => (
              <Grid item xs={12} sm={6} md={2.4} key={idx}>
                <Card sx={{ bgcolor: '#fff', borderRadius: 1.5, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #E2E8F0' }}>
                  <CardContent sx={{ p: 2 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', tracking: 'wider', display: 'block', mb: 1 }}>
                      {kpi.title}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: kpi.color }}>
                      {kpi.value}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                      {kpi.subtitle}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Warnings Section */}
          {data.gapChecks?.warnings?.length > 0 && (
            <Box>
              {data.gapChecks.warnings.map((warn, wIdx) => (
                <Alert severity="warning" key={wIdx} icon={<WarningIcon />} sx={{ borderRadius: 1.5 }}>
                  <AlertTitle>Performance Warning</AlertTitle>
                  {warn.message}
                </Alert>
              ))}
            </Box>
          )}

          {/* Daily Trend Breakdown */}
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <BarChartIcon sx={{ color: 'primary.main' }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'slate.900' }}>
                  Daily Trend Breakdown ({dailyTrends.length})
                </Typography>
              </Box>
              {dailyTrends.length > PAGE_SIZE && (
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  Showing {(dailyPage - 1) * PAGE_SIZE + 1}–{Math.min(dailyPage * PAGE_SIZE, dailyTrends.length)} of {dailyTrends.length}
                </Typography>
              )}
            </Box>
            <TableContainer component={Paper} sx={{ borderRadius: 1.5, border: '1px solid #E2E8F0', boxShadow: 'none' }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#F8FAFC' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Spend</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Clicks</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Pixel Conv.</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Shopify Conv.</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Shopify Sales</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedDailyTrends.map((row) => (
                    <TableRow key={row.date} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                      <TableCell sx={{ fontWeight: 600 }}>{row.date}</TableCell>
                      <TableCell align="right">{formatCurrency(row.spend)}</TableCell>
                      <TableCell align="right">{row.clicks.toLocaleString()}</TableCell>
                      <TableCell align="right">{row.conversions}</TableCell>
                      <TableCell align="right">{row.shopifyConversions}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, color: 'success.main' }}>{formatCurrency(row.shopifyRevenue)}</TableCell>
                    </TableRow>
                  ))}
                  {dailyTrends.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 3, color: 'text.secondary', fontStyle: 'italic' }}>
                        No daily trends found for this date range.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Daily Trends Pagination */}
            {totalDailyPages > 1 && (
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
                <Pagination
                  count={totalDailyPages}
                  page={dailyPage}
                  onChange={(e, v) => setDailyPage(v)}
                  color="primary"
                  size="small"
                  shape="rounded"
                />
              </Box>
            )}
          </Box>

          {/* Matched Orders List */}
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ShoppingBagIcon sx={{ color: 'success.main' }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'slate.900' }}>
                  Attributed Shopify Orders ({matchedOrders.length})
                </Typography>
              </Box>
              {matchedOrders.length > PAGE_SIZE && (
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  Showing {(ordersPage - 1) * PAGE_SIZE + 1}–{Math.min(ordersPage * PAGE_SIZE, matchedOrders.length)} of {matchedOrders.length}
                </Typography>
              )}
            </Box>
            <TableContainer component={Paper} sx={{ borderRadius: 1.5, border: '1px solid #E2E8F0', boxShadow: 'none' }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#F8FAFC' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Order #</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Customer Email</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Order Value</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Attribution Source</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedOrders.map((order) => (
                    <TableRow key={order.orderId} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                      <TableCell sx={{ fontWeight: 700, color: 'primary.main' }}>
                        #{order.orderNumber}
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>
                        {new Date(order.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                        {order.email}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: 'success.main' }}>
                        {formatCurrency(order.totalPrice)}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {order.utmSource && (
                            <Chip
                              label={`utm_src: ${order.utmSource}`}
                              size="small"
                              sx={{ fontSize: '0.6rem', height: '16px', fontWeight: 600 }}
                            />
                          )}
                          {order.utmCampaign && (
                            <Chip
                              label={`campaign: ${order.utmCampaign}`}
                              size="small"
                              sx={{ fontSize: '0.6rem', height: '16px', fontWeight: 600, maxWidth: 120 }}
                            />
                          )}
                          {order.utmTerm && (
                            <Chip
                              label={`adset: ${order.utmTerm}`}
                              size="small"
                              sx={{ fontSize: '0.6rem', height: '16px', fontWeight: 600, maxWidth: 120, bgcolor: '#EFF6FF', color: '#1E40AF' }}
                            />
                          )}
                          {order.utmContent && (
                            <Chip
                              label={`ad: ${order.utmContent}`}
                              size="small"
                              sx={{ fontSize: '0.6rem', height: '16px', fontWeight: 600, maxWidth: 120, bgcolor: '#ECFDF5', color: '#065F46' }}
                            />
                          )}
                          {order.clickId && (
                            <Chip
                              label="fbclid"
                              size="small"
                              sx={{ fontSize: '0.6rem', height: '16px', fontWeight: 600, bgcolor: '#F3E8FF', color: '#6B21A8' }}
                            />
                          )}
                          {!order.utmSource && !order.utmCampaign && !order.utmContent && !order.utmTerm && !order.clickId && (
                            <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary', fontStyle: 'italic' }}>
                              organic facebook ref
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                  {matchedOrders.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary', fontStyle: 'italic' }}>
                        No matched orders found for this ad set in this date range.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Orders Pagination */}
            {totalOrdersPages > 1 && (
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
                <Pagination
                  count={totalOrdersPages}
                  page={ordersPage}
                  onChange={(e, v) => setOrdersPage(v)}
                  color="primary"
                  size="small"
                  shape="rounded"
                />
              </Box>
            )}
          </Box>

        </Box>
      ) : null}
    </Drawer>
  );
}
