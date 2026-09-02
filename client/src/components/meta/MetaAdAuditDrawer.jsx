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

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';

export function MetaAdAuditDrawer({
  open,
  onClose,
  adId,
  adName: initialAdName,
  startDate,
  endDate,
  currencyCode = 'PKR',
  activeDateRangeLabel = 'Last 30 Days'
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dailyPage, setDailyPage] = useState(1);
  const [ordersPage, setOrdersPage] = useState(1);
  const PAGE_SIZE = 100;

  useEffect(() => {
    if (open && adId) {
      setLoading(true);
      setError(null);
      
      const shopifyUrl = localStorage.getItem('shopifyStoreUrl') || '';
      const params = new URLSearchParams({
        ad_id: adId,
        currency: currencyCode,
        _t: String(Date.now())
      });
      if (shopifyUrl) params.append('shopify_url', shopifyUrl);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      fetch(`${BACKEND_URL}/api/shopify/ad-performance?${params.toString()}`)
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch ad performance calculations');
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
  }, [open, adId, startDate, endDate, currencyCode]);

  useEffect(() => {
    setDailyPage(1);
    setOrdersPage(1);
  }, [adId, startDate, endDate]);

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

  const adName = data?.adName || initialAdName || 'N/A';
  const adStatus = data?.adStatus || 'UNKNOWN';

  const dailyTrends = data?.dailySpendBreakdown || [];
  const totalDailyPages = Math.ceil(dailyTrends.length / PAGE_SIZE);
  const paginatedDailyTrends = dailyTrends.slice((dailyPage - 1) * PAGE_SIZE, dailyPage * PAGE_SIZE);

  // Pagination for orders table
  const matchedOrders = data?.matchedOrders || [];
  const totalOrdersPages = Math.ceil(matchedOrders.length / PAGE_SIZE);
  const paginatedOrders = matchedOrders.slice((ordersPage - 1) * PAGE_SIZE, ordersPage * PAGE_SIZE);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { width: { xs: '100%', md: '80%', lg: '75%', xl: '65%' }, bgcolor: '#F8FAFC' }
      }}
    >
      {/* Drawer Header */}
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#fff', borderBottom: '1px solid #E2E8F0' }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, color: 'slate.900' }}>
            Ad Audit: {adName}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 1, alignItems: 'center' }}>
            <Chip
              label={adStatus.toUpperCase()}
              color={adStatus.toUpperCase() === 'ACTIVE' || adStatus.toUpperCase() === 'ENABLED' ? 'success' : 'default'}
              size="small"
              sx={{ fontWeight: 700, fontSize: '0.65rem', height: '20px' }}
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
            Analyzing Ad Attribution...
          </Typography>
        </Box>
      ) : error ? (
        <Box sx={{ p: 4 }}>
          <Alert severity="error">
            <AlertTitle>Error Loading Performance Audit</AlertTitle>
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
                <Card sx={{ bgcolor: 'white', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #E2E8F0' }}>
                  <CardContent sx={{ p: '20px !important' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase' }}>
                      {kpi.title}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, mt: 1, color: kpi.color }}>
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
                <TableHead sx={{ '& th': { bgcolor: '#F8FAFC', fontWeight: 700 } }}>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell align="right">Meta Spend</TableCell>
                    <TableCell align="center">Meta Conversion</TableCell>
                    <TableCell align="center">Shopify Conversion</TableCell>
                    <TableCell align="right">Meta ROAS</TableCell>
                    <TableCell align="right">Shopify ROAS</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedDailyTrends.map((day) => {
                    const metaROAS = day.spend > 0 ? (day.metaRevenue || 0) / day.spend : 0;
                    const shopifyROAS = day.spend > 0 ? (day.shopifyRevenue || 0) / day.spend : 0;
                    return (
                      <TableRow key={day.date}>
                        <TableCell sx={{ color: 'text.secondary' }}>{day.date}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>{formatCurrency(day.spend)}</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                          {day.conversions || 0}
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                          {day.shopifyConversions || 0}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: metaROAS >= 2 ? 'success.main' : metaROAS > 0 ? 'warning.main' : 'text.secondary' }}>
                          {metaROAS > 0 ? `${metaROAS.toFixed(2)}x` : '—'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: shopifyROAS >= 2 ? 'success.main' : shopifyROAS > 0 ? 'warning.main' : 'text.secondary' }}>
                          {shopifyROAS > 0 ? `${shopifyROAS.toFixed(2)}x` : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {dailyTrends.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 3, color: 'text.secondary', fontStyle: 'italic' }}>
                        No daily insight details
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

          {/* Attributed Orders */}
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ShoppingBagIcon sx={{ color: 'primary.main' }} />
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
                    <TableCell sx={{ fontWeight: 700 }}>Line Items (Price & Qty)</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Qty</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Order Value</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Attribution Details</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedOrders.map((order) => {
                    const totalQty = order.lineItems?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
                    return (
                      <TableRow key={order.orderId} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                        <TableCell sx={{ fontWeight: 700, color: 'primary.main' }}>
                          #{order.orderNumber}
                        </TableCell>
                        <TableCell sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
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
                        <TableCell>
                          <Stack spacing={0.5}>
                            {order.lineItems?.map((item, index) => {
                              const itemPrice = item.price || 0;
                              const qty = item.quantity || 1;
                              const itemTotal = itemPrice * qty;
                              return (
                                <Typography key={index} variant="caption" sx={{ display: 'block', fontSize: '0.75rem', color: 'text.secondary' }}>
                                  {qty > 1 ? (
                                    <>• {qty} x {formatCurrency(itemPrice)} = <strong style={{ color: '#374151' }}>{formatCurrency(itemTotal)}</strong></>
                                  ) : (
                                    <>• <strong style={{ color: '#374151' }}>{formatCurrency(itemPrice)}</strong></>
                                  )}
                                </Typography>
                              );
                            })}
                            {(!order.lineItems || order.lineItems.length === 0) && (
                              <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                                No item details
                              </Typography>
                            )}
                          </Stack>
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
                          {totalQty}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: 'success.main', fontSize: '0.9rem' }}>
                          {formatCurrency(order.totalPrice)}
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxWidth: 260 }}>
                            {order.utmSource && (
                              <Chip
                                label={`utm_source: ${order.utmSource}`}
                                size="small"
                                sx={{ fontSize: '0.6rem', height: '16px', fontWeight: 600 }}
                              />
                            )}
                            {order.utmCampaign && (
                              <Chip
                                label={`campaign: ${order.utmCampaign}`}
                                size="small"
                                sx={{ fontSize: '0.6rem', height: '16px', fontWeight: 600, maxWidth: 100 }}
                              />
                            )}
                            {order.utmContent && (
                              <Chip
                                label={`content: ${order.utmContent}`}
                                size="small"
                                sx={{ fontSize: '0.6rem', height: '16px', fontWeight: 600, maxWidth: 100, bgcolor: '#ECFDF5', color: '#065F46' }}
                              />
                            )}
                            {order.utmTerm && (
                              <Chip
                                label={`term: ${order.utmTerm}`}
                                size="small"
                                sx={{ fontSize: '0.6rem', height: '16px', fontWeight: 600, maxWidth: 100, bgcolor: '#EFF6FF', color: '#1E40AF' }}
                              />
                            )}
                            {order.clickId && (
                              <Chip
                                label="fbclid"
                                size="small"
                                sx={{ fontSize: '0.6rem', height: '16px', fontWeight: 600, bgcolor: '#F3E8FF', color: '#6B21A8' }}
                              />
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {matchedOrders.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary', fontStyle: 'italic' }}>
                        No matched orders found for this ad in this date range.
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
