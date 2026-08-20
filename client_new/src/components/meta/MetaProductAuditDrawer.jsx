'use client';

import React, { useMemo } from 'react';
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
  Button
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import BarChartIcon from '@mui/icons-material/BarChart';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import InfoIcon from '@mui/icons-material/Info';
import WarningIcon from '@mui/icons-material/Warning';

export function MetaProductAuditDrawer({
  open,
  onClose,
  product,
  currencyCode = 'PKR',
  activeDateRangeLabel = 'Last 30 Days'
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

  const campaignNames = useMemo(() => {
    if (!product) return [];
    return Array.from(new Set((product.matchedAds || []).map(ad => ad.campaignName).filter(Boolean)));
  }, [product]);

  const adSetNames = useMemo(() => {
    if (!product) return [];
    return Array.from(new Set((product.matchedAds || []).map(ad => ad.adSetName || ad.adGroupName).filter(Boolean)));
  }, [product]);

  const adNames = useMemo(() => {
    if (!product) return [];
    return Array.from(new Set((product.matchedAds || []).map(ad => ad.name).filter(Boolean)));
  }, [product]);

  if (!product) return null;

  const utmRoas = product.adSpend > 0 ? product.metaRevenue / product.adSpend : 0;

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
            {product.productTitle}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 1, alignItems: 'center' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              SKU: {product.sku || 'N/A'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>•</Typography>
            <Chip
              label={product.inventoryQuantity <= 0 ? 'Out of Stock' : `${product.inventoryQuantity} in stock`}
              size="small"
              sx={{
                fontWeight: 700,
                fontSize: '0.7rem',
                height: '20px',
                bgcolor: product.inventoryQuantity <= 0 ? '#FEE2E2' : '#D1FAE5',
                color: product.inventoryQuantity <= 0 ? '#991B1B' : '#065F46'
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
      <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto', flex: 1 }}>

        {/* Structure Links */}
        {(product.matchedAds || []).length > 0 && (
          <Grid container spacing={2}>
            {[
              { label: 'Connected Campaigns', items: campaignNames },
              { label: 'Connected Ad Sets', items: adSetNames },
              { label: 'Connected Ads', items: adNames }
            ].map((section, sIdx) => (
              <Grid item xs={12} md={4} key={sIdx}>
                <Card sx={{ bgcolor: '#fff', borderRadius: 1.5, height: '100%', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <CardContent sx={{ p: 2 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 800, textTransform: 'uppercase', tracking: 'wider', display: 'block', mb: 1.5 }}>
                      {section.label}
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 150, overflowY: 'auto', pr: 1 }}>
                      {section.items.map((name, idx) => (
                        <Box key={idx} sx={{ py: 0.2 }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main', wordBreak: 'break-word', display: 'block' }}>
                            • {name}
                          </Typography>
                        </Box>
                      ))}
                      {section.items.length === 0 && (
                        <Typography variant="caption" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                          None linked
                        </Typography>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        {/* KPI Grid */}
        <Grid container spacing={2}>
          {[
            {
              title: 'Meta ROAS (Pixel)',
              value: product.adSpend > 0 ? `${product.metaAttributedROAS.toFixed(2)}x` : '—',
              subtitle: 'Meta Pixel / Spend',
              color: product.metaAttributedROAS >= 2 ? '#10B981' : product.metaAttributedROAS >= 1 ? '#F59E0B' : '#EF4444'
            },
            {
              title: 'Meta ROAS (UTM)',
              value: product.adSpend > 0 ? `${utmRoas.toFixed(2)}x` : '—',
              subtitle: 'Facebook UTM / Spend',
              color: utmRoas >= 2 ? '#10B981' : utmRoas >= 1 ? '#F59E0B' : '#EF4444'
            },
            {
              title: 'Blended ROAS',
              value: product.adSpend > 0 ? `${(product.trueROAS || 0).toFixed(2)}x` : '—',
              subtitle: 'Overall Store ROAS',
              color: (product.trueROAS || 0) >= 2 ? '#10B981' : (product.trueROAS || 0) >= 1 ? '#F59E0B' : '#EF4444'
            },
            {
              title: 'Meta Sales (Pixel)',
              value: formatCurrency(product.attributedRevenue || 0),
              subtitle: `${product.attributedSales || 0} conversions`,
              color: 'text.primary'
            },
            {
              title: 'Meta Sales (UTM)',
              value: formatCurrency(product.metaRevenue || 0),
              subtitle: `${product.metaSalesQuantity || 0} conversions`,
              color: 'text.primary'
            },
            {
              title: 'Total Sales (All Channels)',
              value: formatCurrency(product.shopifyRevenue || 0),
              subtitle: `${product.shopifySalesQuantity || 0} items sold`,
              color: 'text.primary'
            },
            {
              title: 'Ad Spend (Meta)',
              value: formatCurrency(product.adSpend || 0),
              subtitle: product.firstActiveDate && product.lastActiveDate
                ? `Active: ${new Date(product.firstActiveDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${new Date(product.lastActiveDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                : `From ${product.matchedAds?.length || 0} matched ads`,
              color: 'text.primary'
            },
            {
              title: 'Ad Clicks',
              value: Number(product.adClicks || 0).toLocaleString(),
              subtitle: `Avg. CPC: ${product.adSpend > 0 && product.adClicks > 0 ? formatCurrency(product.adSpend / product.adClicks) : '—'}`,
              color: 'text.primary'
            }
          ].map((kpi, idx) => (
            <Grid item xs={6} sm={4} md={3} key={idx}>
              <Card sx={{ bgcolor: '#fff', borderRadius: 1.5, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <CardContent sx={{ p: '16px !important' }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block' }}>
                    {kpi.title}
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: kpi.color }}>
                    {kpi.value}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5, fontSize: '0.65rem' }}>
                    {kpi.subtitle}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Meta Ads Breakdown */}
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <BarChartIcon sx={{ color: 'primary.main', fontSize: '1.2rem' }} />
            Meta Ads Performance Details ({(product.matchedAds || []).length})
          </Typography>

          {(!product.matchedAds || product.matchedAds.length === 0) ? (
            <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 1.5 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                No Meta Ads are currently linked to this product's handle or title.
              </Typography>
            </Paper>
          ) : (
            <TableContainer component={Paper} sx={{ borderRadius: 1.5, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: 'primary.main' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#fff' }}>Ad Name / Campaign</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#fff' }}>Status</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#fff' }}>Spend</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#fff' }}>Impressions</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#fff' }}>Clicks (CTR)</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#fff' }}>Conversions</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#fff' }}>Value (ROAS)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {product.matchedAds.map((ad) => {
                    const adRoas = ad.cost > 0 ? (ad.insights?.conversion_values || ad.roas || 0) / ad.cost : 0;
                    return (
                      <TableRow key={ad.id} hover>
                        <TableCell sx={{ maxWidth: 200 }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.primary', display: 'block', noWrap: true, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {ad.name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', noWrap: true, overflow: 'hidden', textOverflow: 'ellipsis', mt: 0.5 }}>
                            Cmp: {ad.campaignName}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', noWrap: true, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            Set: {ad.adGroupName || ad.adSetName}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                            <Chip
                              label={ad.status.toUpperCase()}
                              size="small"
                              sx={{
                                fontWeight: 700,
                                fontSize: '0.65rem',
                                height: '18px',
                                bgcolor: ad.status.toUpperCase() === 'ACTIVE' || ad.status.toUpperCase() === 'ENABLED' ? '#E2FBE9' : '#E2E8F0',
                                color: ad.status.toUpperCase() === 'ACTIVE' || ad.status.toUpperCase() === 'ENABLED' ? '#0E622B' : '#475569'
                              }}
                            />
                            {(() => {
                              const adStatusUpper = ad.status.toUpperCase();
                              if (adStatusUpper !== 'ACTIVE' && adStatusUpper !== 'ENABLED') return null;

                              if (ad.cost === 0) {
                                return (
                                  <Typography variant="caption" sx={{ color: '#D97706', fontSize: '0.65rem', fontWeight: 600 }}>
                                    ⚠️ No spend
                                  </Typography>
                                );
                              }

                              const today = new Date();
                              const lastDate = ad.lastActiveDate ? new Date(ad.lastActiveDate) : null;
                              const daysSinceLastSpend = lastDate ? Math.floor((today - lastDate) / (1000 * 60 * 60 * 24)) : null;

                              if (daysSinceLastSpend !== null && daysSinceLastSpend > 3) {
                                const formattedLastActive = new Date(ad.lastActiveDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                                return (
                                  <Typography
                                    variant="caption"
                                    sx={{ color: '#D97706', fontSize: '0.65rem', fontWeight: 600, cursor: 'help' }}
                                    title={`This active ad has stopped spending budget since ${formattedLastActive}. Check Meta billing or account limits.`}
                                  >
                                    ⚠️ Frozen {daysSinceLastSpend}d
                                  </Typography>
                                );
                              }
                              return null;
                            })()}
                          </Box>
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>{formatCurrency(ad.cost || 0)}</TableCell>
                        <TableCell align="right">{Number(ad.impressions || 0).toLocaleString()}</TableCell>
                        <TableCell align="right">
                          <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>
                            {Number(ad.clicks || 0).toLocaleString()}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '0.65rem' }}>
                            {(() => {
                              const clicks = Number(ad.clicks || ad.insights?.clicks || 0);
                              const impressions = Number(ad.impressions || ad.insights?.impressions || 0);
                              let ctrVal = ad.ctr ? ad.ctr * 100 : ad.insights?.ctr ? ad.insights.ctr * 100 : 0;

                              if (ctrVal === 0 && impressions > 0) {
                                ctrVal = (clicks / impressions) * 100;
                              }
                              return `${ctrVal.toFixed(2)}%`;
                            })()}
                          </Typography>
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>{ad.insights?.conversions || 0}</TableCell>
                        <TableCell align="right">
                          <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
                            {formatCurrency(ad.insights?.conversion_values || 0)}
                          </Typography>
                          <Typography variant="caption" sx={{
                            fontWeight: 750,
                            display: 'block',
                            color: adRoas >= 2 ? '#10B981' : adRoas >= 1 ? '#F59E0B' : ad.cost > 0 ? '#EF4444' : '#94A3B8'
                          }}>
                            {ad.cost > 0 ? `${adRoas.toFixed(2)}x` : '—'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>

        {/* Daily timeline spend */}
        {product.matchedAds?.some(ad => ad.dailySpendBreakdown?.length > 0) && (
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              <CalendarTodayIcon sx={{ color: 'primary.main', fontSize: '1.2rem' }} />
              Daily Ad Spend Timeline
            </Typography>

            <TableContainer component={Paper} sx={{ borderRadius: 1.5, maxHeight: 250, overflowY: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <Table size="small" stickyHeader>
                <TableHead sx={{ bgcolor: 'primary.main' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', bgcolor: 'primary.main', color: '#fff' }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', bgcolor: 'primary.main', color: '#fff' }}>Ad Source</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem', bgcolor: 'primary.main', color: '#fff' }}>Spend</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem', bgcolor: 'primary.main', color: '#fff' }}>Clicks</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem', bgcolor: 'primary.main', color: '#fff' }}>Meta Conv.</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem', bgcolor: 'primary.main', color: '#fff' }}>Shopify Conv.</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {product.matchedAds.flatMap(ad =>
                    (ad.dailySpendBreakdown || []).map(day => ({
                      ...day,
                      adName: ad.name
                    }))
                  )
                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                    .map((day, idx) => (
                      <TableRow key={idx} hover>
                        <TableCell sx={{ fontWeight: 600 }}>
                          {new Date(day.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </TableCell>
                        <TableCell sx={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={day.adName}>
                          {day.adName}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>{formatCurrency(day.spend || 0)}</TableCell>
                        <TableCell align="right">{day.clicks || 0}</TableCell>
                        <TableCell align="right" sx={{ color: '#047857', fontWeight: 600 }}>{day.conversions || 0}</TableCell>
                        <TableCell align="right" sx={{ color: '#2563EB', fontWeight: 600 }}>{day.shopifyConversions || 0}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Attributed Orders Verification */}
        {product.matchedOrders?.length > 0 && (
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              <ShoppingBagIcon sx={{ color: 'primary.main', fontSize: '1.2rem' }} />
              Shopify Attributed Orders Verification ({product.matchedOrders.length})
            </Typography>

            <TableContainer component={Paper} sx={{ borderRadius: 1.5, maxHeight: 250, overflowY: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <Table size="small" stickyHeader>
                <TableHead sx={{ bgcolor: 'primary.main' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', bgcolor: 'primary.main', color: '#fff' }}>Order</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', bgcolor: 'primary.main', color: '#fff' }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', bgcolor: 'primary.main', color: '#fff' }}>Customer</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem', bgcolor: 'primary.main', color: '#fff' }}>Items</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem', bgcolor: 'primary.main', color: '#fff' }}>Item Price</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem', bgcolor: 'primary.main', color: '#fff' }}>Total Price</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', bgcolor: 'primary.main', color: '#fff' }}>Attribution Source</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {product.matchedOrders
                    .slice()
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                    .map((order, idx) => {
                      const matchedAd = (product.matchedAds || []).find(ad => {
                        const contentMatch = order.utmContent && ad.name?.toLowerCase().trim() === order.utmContent.toLowerCase().trim();
                        const campaignMatch = order.utmCampaign && ad.campaignName?.toLowerCase().trim() === order.utmCampaign.toLowerCase().trim();
                        return contentMatch || campaignMatch;
                      });

                      const adStatus = matchedAd ? matchedAd.status : null;
                      const adName = matchedAd ? matchedAd.name : null;

                      return (
                        <TableRow key={idx} hover>
                          <TableCell sx={{ fontWeight: 800, color: 'primary.main' }}>
                            {order.orderNumber || `#${order.orderId.slice(-6)}`}
                          </TableCell>
                          <TableCell sx={{ color: 'text.secondary' }}>
                            {new Date(order.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </TableCell>
                          <TableCell sx={{ color: 'text.secondary', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={order.email}>
                            {order.email}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>{order.quantity}</TableCell>
                          <TableCell align="right">{formatCurrency(order.price || 0)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 800 }}>{formatCurrency(order.totalPrice || 0)}</TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
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
                                {order.clickId && (
                                  <Chip
                                    label="fbclid"
                                    size="small"
                                    sx={{ fontSize: '0.6rem', height: '16px', fontWeight: 600, bgcolor: '#F3E8FF', color: '#6B21A8' }}
                                  />
                                )}
                                {!order.utmSource && !order.utmCampaign && !order.clickId && (
                                  <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary', fontStyle: 'italic' }}>
                                    organic facebook ref
                                  </Typography>
                                )}
                              </Box>

                              {matchedAd && (
                                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, bgcolor: '#FAFAFA', px: 1, py: 0.5, borderRadius: 1.5, border: '1px solid #E2E8F0', width: 'fit-content' }}>
                                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: adStatus?.toUpperCase() === 'ACTIVE' || adStatus?.toUpperCase() === 'ENABLED' ? '#10B981' : '#EF4444' }} />
                                  <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 700, color: adStatus?.toUpperCase() === 'ACTIVE' || adStatus?.toUpperCase() === 'ENABLED' ? '#047857' : '#EF4444' }}>
                                    {adStatus?.toUpperCase() === 'ACTIVE' || adStatus?.toUpperCase() === 'ENABLED' ? 'Active Ad' : 'Paused Ad'}: {adName}
                                  </Typography>
                                </Box>
                              )}
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Split grid for Variants Inventory & Ad Strategy */}
        <Grid container spacing={3} sx={{ mb: 2 }}>
          {/* Left Column: Product Variants Inventory */}
          <Grid item xs={12}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              <ShoppingBagIcon sx={{ color: 'primary.main', fontSize: '1.2rem' }} />
              Product Variants Inventory
            </Typography>

            <TableContainer component={Paper} sx={{ borderRadius: 1.5, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: 'primary.main' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#fff' }}>Variant Title / SKU</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#fff' }}>Price</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#fff' }}>Inventory</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(!product.variants || product.variants.length === 0) ? (
                    <TableRow>
                      <TableCell colSpan={3} align="center" sx={{ py: 3, color: 'text.secondary', fontStyle: 'italic' }}>
                        No variant details available.
                      </TableCell>
                    </TableRow>
                  ) : (
                    product.variants.map((v) => (
                      <TableRow key={v.id} hover>
                        <TableCell>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.primary', display: 'block' }}>
                            {v.title || 'Default'}
                          </Typography>
                          {v.sku && (
                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '0.65rem', mt: 0.5 }}>
                              SKU: {v.sku}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          {formatCurrency(parseFloat(v.price || 0))}
                        </TableCell>
                        <TableCell align="right">
                          <Chip
                            label={`${v.inventoryQuantity || 0} left`}
                            size="small"
                            sx={{
                              fontWeight: 700,
                              fontSize: '0.65rem',
                              height: '18px',
                              bgcolor: (v.inventoryQuantity || 0) <= 0 ? '#FEE2E2' : (v.inventoryQuantity || 0) < 10 ? '#FEF3C7' : '#E2FBE9',
                              color: (v.inventoryQuantity || 0) <= 0 ? '#991B1B' : (v.inventoryQuantity || 0) < 10 ? '#92400E' : '#0E622B'
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>

          {/* Right Column: Ad Optimization Strategy */}
          {/* <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              <LightbulbIcon sx={{ color: 'primary.main', fontSize: '1.2rem' }} />
              Ad Optimization Strategy
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {product.adSpend > 0 ? (
                product.trueROAS > 2 ? (
                  <Paper variant="outlined" sx={{ p: 2.5, bgcolor: '#E2FBE9', borderColor: '#A7F3D0', borderRadius: 1.5, display: 'flex', gap: 2 }}>
                    <LightbulbIcon sx={{ color: '#10B981', mt: 0.5 }} />
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#065F46' }}>Scale Ad Spend</Typography>
                      <Typography variant="caption" sx={{ color: '#047857', mt: 0.5, display: 'block', leading: 1.6 }}>
                        This product is performing exceptionally well with a True ROAS of {product.trueROAS.toFixed(2)}x. Consider raising the campaign budget by 20% or scaling target audiences.
                      </Typography>
                    </Box>
                  </Paper>
                ) : product.trueROAS > 1 ? (
                  <Paper variant="outlined" sx={{ p: 2.5, bgcolor: '#FEF3C7', borderColor: '#FDE68A', borderRadius: 1.5, display: 'flex', gap: 2 }}>
                    <InfoIcon sx={{ color: '#F59E0B', mt: 0.5 }} />
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#92400E' }}>Optimize Copy / Creatives</Typography>
                      <Typography variant="caption" sx={{ color: '#B45309', mt: 0.5, display: 'block', leading: 1.6 }}>
                        ROAS is positive ({product.trueROAS.toFixed(2)}x) but close to breakeven. Optimize target audiences, refresh ad creatives, or try a direct discount offer.
                      </Typography>
                    </Box>
                  </Paper>
                ) : (
                  <Paper variant="outlined" sx={{ p: 2.5, bgcolor: '#FEE2E2', borderColor: '#FCA5A5', borderRadius: 1.5, display: 'flex', gap: 2 }}>
                    <WarningIcon sx={{ color: '#EF4444', mt: 0.5 }} />
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#991B1B' }}>Underperforming Ads Warning</Typography>
                      <Typography variant="caption" sx={{ color: '#B91C1C', mt: 0.5, display: 'block', leading: 1.6 }}>
                        This product is running ads but returns are low or zero. We recommend auditing product prices, landing page loading speeds, or pausing budget wastage.
                      </Typography>
                    </Box>
                  </Paper>
                )
              ) : (
                <Paper variant="outlined" sx={{ p: 2.5, bgcolor: '#FAFAFA', borderColor: '#E2E8F0', borderRadius: 1.5, display: 'flex', gap: 2 }}>
                  <ShoppingBagIcon sx={{ color: '#94A3B8', mt: 0.5 }} />
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#475569' }}>Untapped Opportunity</Typography>
                    <Typography variant="caption" sx={{ color: '#64748B', mt: 0.5, display: 'block', leading: 1.6 }}>
                      This item has {product.inventoryQuantity} in stock but is not being advertised. Launch test creatives for this item.
                    </Typography>
                  </Box>
                </Paper>
              )}

              {product.inventoryQuantity <= 0 && product.adSpend > 0 && (
                <Paper variant="outlined" sx={{ p: 2.5, bgcolor: '#FEE2E2', borderColor: '#EF4444', borderStyle: 'dashed', borderRadius: 1.5, display: 'flex', gap: 2 }}>
                  <WarningIcon sx={{ color: '#EF4444', mt: 0.5, animation: 'pulse 1.5s infinite' }} />
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 850, color: '#991B1B' }}>Wasting Ad Budget!</Typography>
                    <Typography variant="caption" sx={{ color: '#B91C1C', mt: 0.5, display: 'block', leading: 1.6, fontWeight: 700 }}>
                      Critical: You are active spending on a product that is out of stock. Pause all matching ads immediately.
                    </Typography>
                  </Box>
                </Paper>
              )}
            </Box>
          </Grid> */}
        </Grid>
      </Box>
    </Drawer>
  );
}
