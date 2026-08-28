'use client';

import React, { useState, useEffect } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
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
  Stack,
  Tooltip
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';

export function MetaChannelOrdersDrawer({
  open,
  onClose,
  channelName,
  startDate,
  endDate,
  currencyCode = 'PKR',
  activeDateRangeLabel = 'Last 30 Days'
}) {
  const [orders, setOrders] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const limit = 50;

  useEffect(() => {
    if (open && channelName) {
      setLoading(true);
      setError(null);
      
      const shopifyUrl = localStorage.getItem('shopifyStoreUrl') || '';
      const params = new URLSearchParams({
        channel: channelName,
        page: String(page),
        limit: String(limit)
      });
      if (shopifyUrl) params.append('shopify_url', shopifyUrl);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      fetch(`${BACKEND_URL}/api/shopify/channel-orders?${params.toString()}`)
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch channel orders');
          return res.json();
        })
        .then(resJson => {
          if (resJson.success) {
            setOrders(resJson.data);
            setTotalCount(resJson.totalCount);
            setTotalPages(resJson.totalPages);
          } else {
            throw new Error(resJson.error || 'Failed to load channel orders');
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
      setOrders([]);
      setTotalCount(0);
      setTotalPages(1);
    }
  }, [open, channelName, page, startDate, endDate]);

  // Reset page to 1 when channel or dates change
  useEffect(() => {
    setPage(1);
  }, [channelName, startDate, endDate]);

  const renderCampaignTooltip = (attr) => {
    if (!attr) return '';
    if (!attr.campaignMeta) return `Campaign ID: ${attr.utmCampaign || attr.campaignId || 'Unknown'}`;
    const meta = attr.campaignMeta;
    return (
      <Box sx={{ p: 0.5, color: '#fff' }}>
        <Typography variant="subtitle2" color="inherit" sx={{ fontWeight: 800, fontSize: '0.75rem', mb: 0.5 }}>
          Meta Campaign Details
        </Typography>
        <Typography variant="caption" color="inherit" sx={{ display: 'block', fontSize: '0.7rem' }}><strong>Name:</strong> {meta.name || '—'}</Typography>
        <Typography variant="caption" color="inherit" sx={{ display: 'block', fontSize: '0.7rem' }}><strong>ID:</strong> {meta.id}</Typography>
        <Typography variant="caption" color="inherit" sx={{ display: 'block', fontSize: '0.7rem' }}><strong>Status:</strong> {meta.status ? meta.status.toUpperCase() : '—'}</Typography>
        <Typography variant="caption" color="inherit" sx={{ display: 'block', fontSize: '0.7rem' }}>
          <strong>Period:</strong> {meta.startDate ? new Date(meta.startDate).toLocaleDateString() : '—'} to {meta.endDate ? new Date(meta.endDate).toLocaleDateString() : 'Ongoing'}
        </Typography>
      </Box>
    );
  };

  const renderAdSetTooltip = (attr) => {
    if (!attr) return '';
    if (!attr.adSetMeta) return `Ad Set ID: ${attr.utmTerm || attr.adSetId || 'Unknown'}`;
    const meta = attr.adSetMeta;
    return (
      <Box sx={{ p: 0.5, color: '#fff' }}>
        <Typography variant="subtitle2" color="inherit" sx={{ fontWeight: 800, fontSize: '0.75rem', mb: 0.5 }}>
          Meta Ad Set Details
        </Typography>
        <Typography variant="caption" color="inherit" sx={{ display: 'block', fontSize: '0.7rem' }}><strong>Name:</strong> {meta.name || '—'}</Typography>
        <Typography variant="caption" color="inherit" sx={{ display: 'block', fontSize: '0.7rem' }}><strong>ID:</strong> {meta.id}</Typography>
        <Typography variant="caption" color="inherit" sx={{ display: 'block', fontSize: '0.7rem' }}><strong>Status:</strong> {meta.status ? meta.status.toUpperCase() : '—'}</Typography>
        <Typography variant="caption" color="inherit" sx={{ display: 'block', fontSize: '0.7rem' }}>
          <strong>Period:</strong> {meta.startDate ? new Date(meta.startDate).toLocaleDateString() : '—'} to {meta.endDate ? new Date(meta.endDate).toLocaleDateString() : 'Ongoing'}
        </Typography>
      </Box>
    );
  };

  const renderAdTooltip = (attr) => {
    if (!attr) return '';
    if (!attr.adMeta && !attr.adSpendDates) return `Ad ID/Name: ${attr.utmContent || attr.adId || 'Unknown'}`;
    const meta = attr.adMeta || {};
    const spend = attr.adSpendDates;
    return (
      <Box sx={{ p: 0.5, color: '#fff' }}>
        <Typography variant="subtitle2" color="inherit" sx={{ fontWeight: 800, fontSize: '0.75rem', mb: 0.5 }}>
          Meta Ad Details
        </Typography>
        {meta.name && <Typography variant="caption" color="inherit" sx={{ display: 'block', fontSize: '0.7rem' }}><strong>Name:</strong> {meta.name}</Typography>}
        {meta.id && <Typography variant="caption" color="inherit" sx={{ display: 'block', fontSize: '0.7rem' }}><strong>ID:</strong> {meta.id}</Typography>}
        {meta.status && <Typography variant="caption" color="inherit" sx={{ display: 'block', fontSize: '0.7rem' }}><strong>Status:</strong> {meta.status.toUpperCase()}</Typography>}
        {spend && (
          <Typography variant="caption" color="inherit" sx={{ display: 'block', fontSize: '0.7rem', mt: 0.5 }}>
            <strong>Active Spend Period:</strong><br />
            {new Date(spend.firstSpend).toLocaleDateString()} to {new Date(spend.lastSpend).toLocaleDateString()}
          </Typography>
        )}
      </Box>
    );
  };

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

  const handlePageChange = (event, value) => {
    setPage(value);
  };

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
            Channel Orders: {channelName}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 1, alignItems: 'center' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              Total matched: {totalCount} {totalCount === 1 ? 'order' : 'orders'}
            </Typography>
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
            Loading Attributed Orders...
          </Typography>
        </Box>
      ) : error ? (
        <Box sx={{ p: 4 }}>
          <Alert severity="error">
            <AlertTitle>Error Loading Channel Audit</AlertTitle>
            {error}
          </Alert>
        </Box>
      ) : (
        <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto', flex: 1 }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <ShoppingBagIcon sx={{ color: 'primary.main' }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'slate.900' }}>
                Shopify Orders List (Showing {orders.length} of {totalCount})
              </Typography>
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
                  {orders.map((order) => (
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
                        {order.lineItems?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: 'success.main', fontSize: '0.9rem' }}>
                        {formatCurrency(order.totalPrice)}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxWidth: 300 }}>
                          {order.attribution?.utmSource && (
                            <Chip
                              label={`utm_source: ${order.attribution.utmSource}`}
                              size="small"
                              sx={{ fontSize: '0.6rem', height: '16px', fontWeight: 600 }}
                            />
                          )}
                          {order.attribution?.utmMedium && (
                            <Chip
                              label={`utm_medium: ${order.attribution.utmMedium}`}
                              size="small"
                              sx={{ fontSize: '0.6rem', height: '16px', fontWeight: 600 }}
                            />
                          )}
                          {order.attribution?.utmCampaign && (
                            <Tooltip title={renderCampaignTooltip(order.attribution)} arrow>
                              <span>
                                <Chip
                                  label={`campaign: ${order.attribution.utmCampaign}`}
                                  size="small"
                                  sx={{ fontSize: '0.6rem', height: '16px', fontWeight: 600, maxWidth: 120 }}
                                />
                              </span>
                            </Tooltip>
                          )}
                          {order.attribution?.utmTerm && (
                            <Tooltip title={renderAdSetTooltip(order.attribution)} arrow>
                              <span>
                                <Chip
                                  label={`term: ${order.attribution.utmTerm}`}
                                  size="small"
                                  sx={{ fontSize: '0.6rem', height: '16px', fontWeight: 600, maxWidth: 120, bgcolor: '#EFF6FF', color: '#1E40AF' }}
                                />
                              </span>
                            </Tooltip>
                          )}
                          {order.attribution?.utmContent && (
                            <Tooltip title={renderAdTooltip(order.attribution)} arrow>
                              <span>
                                <Chip
                                  label={`content: ${order.attribution.utmContent}`}
                                  size="small"
                                  sx={{ fontSize: '0.6rem', height: '16px', fontWeight: 600, maxWidth: 120, bgcolor: '#ECFDF5', color: '#065F46' }}
                                />
                              </span>
                            </Tooltip>
                          )}
                          {order.attribution?.clickId && (
                            <Chip
                              label="fbclid"
                              size="small"
                              sx={{ fontSize: '0.6rem', height: '16px', fontWeight: 600, bgcolor: '#F3E8FF', color: '#6B21A8' }}
                            />
                          )}
                          {order.referringSite && (
                            <Chip
                              label={`ref: ${order.referringSite.replace(/^https?:\/\/(www\.)?/, '')}`}
                              size="small"
                              sx={{ fontSize: '0.6rem', height: '16px', fontWeight: 600, maxWidth: 150, bgcolor: '#FEF3C7', color: '#D97706' }}
                            />
                          )}
                          {!order.attribution?.utmSource && !order.attribution?.clickId && !order.referringSite && (
                            <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary', fontStyle: 'italic' }}>
                              direct / untracked
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                  {orders.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary', fontStyle: 'italic' }}>
                        No matched orders found for this channel in this date range.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Pagination controls */}
            {totalPages > 1 && (
              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={handlePageChange}
                  color="primary"
                  size="medium"
                  shape="rounded"
                />
              </Box>
            )}
          </Box>
        </Box>
      )}
    </Drawer>
  );
}
