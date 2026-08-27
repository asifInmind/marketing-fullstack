'use client'

// React Imports
import React from 'react'

// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Divider from '@mui/material/Divider'
import Grid from '@mui/material/Grid'
import Skeleton from '@mui/material/Skeleton'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import Box from '@mui/material/Box'

// Third-party Imports
import {
  DollarSign,
  MousePointerClick,
  Eye,
  Target,
  Wallet,
  Percent,
  ShoppingBag,
  Users,
  Coins
} from 'lucide-react'

// Component Imports
import CustomAvatar from '../mui/Avator'

export function MetaMetricCards({
  summary,
  loading,
  shopifyConnected = false,
  shopifySummary,
  viewMode = 'comparison',
  currencyCode = 'USD'
}) {
  const isBelowMdScreen = useMediaQuery(theme => theme.breakpoints.down('md'))
  const isBelowSmScreen = useMediaQuery(theme => theme.breakpoints.down('sm'))

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

  const roasDisplay =
    summary?.averageROAS && summary.averageROAS > 0
      ? `${summary.averageROAS.toFixed(2)}x`
      : '0x'

  const blendedROAS = shopifySummary && summary?.totalSpend && summary.totalSpend > 0
    ? shopifySummary.totalRevenue / summary.totalSpend
    : 0;

  const blendedROASDisplay = blendedROAS > 0
    ? `${blendedROAS.toFixed(2)}x`
    : '0.00x';

  const attributedROAS = shopifySummary && summary?.totalSpend && summary.totalSpend > 0
    ? (shopifySummary.metaRevenue || 0) / summary.totalSpend
    : 0;

  const attributedROASDisplay = attributedROAS > 0
    ? `${attributedROAS.toFixed(2)}x`
    : '0.00x';

  const metaAov = shopifySummary && shopifySummary.metaOrdersCount > 0
    ? shopifySummary.metaRevenue / shopifySummary.metaOrdersCount
    : 0;

  const storeOverallAov = shopifySummary && shopifySummary.totalOrders > 0
    ? shopifySummary.totalRevenue / shopifySummary.totalOrders
    : 0;

  const getROASSubtitle = roas => {
    if (roas === 0) return 'No revenue yet'
    if (roas > 3) return '🚀 Excellent ROI'
    if (roas > 2) return '✅ Good ROI'
    if (roas > 1) return '📈 Breaking even'
    return '⚠️ Below break-even'
  }

  // Build statsData array based on viewMode
  let statsData = [];

  if (viewMode === 'meta' || !shopifyConnected) {
    statsData = [
      {
        key: 'spend',
        title: 'Ad Spend',
        value: formatCurrency(summary?.totalSpend || 0),
        icon: DollarSign,
        color: 'secondary',
        subtitle: 'Total marketing spend'
      },
      {
        key: 'clicks',
        title: 'Ad Clicks',
        value: summary?.totalClicks ? summary.totalClicks.toLocaleString() : '0',
        icon: MousePointerClick,
        color: 'secondary',
        subtitle: 'Total link traffic'
      },
      {
        key: 'impressions',
        title: 'Ad Impressions',
        value: summary?.totalImpressions ? summary.totalImpressions.toLocaleString() : '0',
        icon: Eye,
        color: 'secondary',
        subtitle: 'Total ad views'
      },
      {
        key: 'conversions',
        title: 'Ad Conversions',
        value: summary?.totalConversions ? summary.totalConversions.toLocaleString() : '0',
        icon: Target,
        color: 'secondary',
        subtitle: 'Purchases tracked'
      },
      {
        key: 'revenue',
        title: 'Ad Revenue',
        value: formatCurrency(summary?.totalRevenue || 0),
        icon: Wallet,
        color: 'secondary',
        subtitle: 'Purchase value'
      },
      {
        key: 'roas',
        title: 'Meta ROAS',
        value: roasDisplay,
        icon: Percent,
        color: 'secondary',
        subtitle: getROASSubtitle(summary?.averageROAS || 0)
      }
    ];
  } else if (viewMode === 'shopify') {
    statsData = [
      {
        key: 'shopify_sales',
        title: 'Shopify Sales',
        value: formatCurrency(shopifySummary?.metaRevenue || 0),
        icon: Wallet,
        color: 'secondary',
        subtitle: 'Meta-driven sales value'
      },
      {
        key: 'shopify_orders',
        title: 'Shopify Orders',
        value: shopifySummary?.metaOrdersCount ? shopifySummary.metaOrdersCount.toLocaleString() : '0',
        icon: ShoppingBag,
        color: 'secondary',
        subtitle: 'Meta-driven checkouts'
      },
      {
        key: 'shopify_customers',
        title: 'Shopify Customers',
        value: shopifySummary?.metaCustomersCount ? shopifySummary.metaCustomersCount.toLocaleString() : '0',
        icon: Users,
        color: 'secondary',
        subtitle: 'Meta-driven unique buyers'
      },
      {
        key: 'shopify_aov',
        title: 'Attributed AOV',
        value: formatCurrency(metaAov),
        icon: Coins,
        color: 'secondary',
        subtitle: 'Ad-driven average order value'
      },
      {
        key: 'shopify_roas',
        title: 'Shopify ROAS',
        value: attributedROASDisplay,
        icon: Percent,
        color: 'secondary',
        subtitle: 'Shopify sales / spend'
      }
    ];
  } else {
    // comparison
    statsData = [
      {
        key: 'spend_orders',
        title: 'Meta Spend vs Shopify Orders',
        value: formatCurrency(summary?.totalSpend || 0),
        secondaryValue: shopifySummary?.metaOrdersCount ? shopifySummary.metaOrdersCount.toLocaleString() : '0',
        icon: DollarSign,
        color: 'secondary',
        subtitle: 'Spend vs Shopify Orders'
      },
      {
        key: 'aov',
        title: 'Average Revenue per order',
        value: summary?.totalConversions > 0 ? formatCurrency(summary.totalRevenue / summary.totalConversions) : formatCurrency(0),
        secondaryValue: formatCurrency(metaAov),
        thirdValue: formatCurrency(storeOverallAov),
        icon: Coins,
        color: 'secondary',
        subtitle: 'Pixel vs Matched vs Store AOV'
      },
      {
        key: 'impressions',
        title: 'Meta Ad Impressions',
        value: summary?.totalImpressions ? summary.totalImpressions.toLocaleString() : '0',
        icon: Eye,
        color: 'secondary',
        subtitle: 'Marketing Reach'
      },
      {
        key: 'conversions',
        title: 'Conversions Audit',
        value: summary?.totalConversions ? summary.totalConversions.toLocaleString() : '0',
        secondaryValue: shopifySummary?.metaOrdersCount ? shopifySummary.metaOrdersCount.toLocaleString() : '0',
        thirdValue: shopifySummary?.totalOrders ? shopifySummary.totalOrders.toLocaleString() : '0',
        icon: Target,
        color: 'secondary',
        subtitle: 'Pixel vs Matched vs Store Total'
      },
      {
        key: 'revenue',
        title: 'generated Revenue Audit',
        value: formatCurrency(summary?.totalRevenue || 0),
        secondaryValue: formatCurrency(shopifySummary?.metaRevenue || 0),
        thirdValue: formatCurrency(shopifySummary?.totalRevenue || 0),
        icon: Wallet,
        color: 'secondary',
        subtitle: 'Pixel vs Matched vs Store Total'
      },
      {
        key: 'roas',
        title: 'ROAS Comparison',
        value: roasDisplay,
        secondaryValue: attributedROASDisplay,
        thirdValue: blendedROASDisplay,
        icon: Percent,
        color: 'secondary',
        subtitle: 'Pixel vs Matched vs Blended ROAS'
      }
    ];
  }

  // Columns layout: 3 columns per row (md=4) for all views to maintain visual consistency
  const colSize = 4;

  return (
    <Grid container spacing={3}>
      {statsData.map((item, index) => {
        const IconComponent = item.icon
        const isTriple = item.thirdValue !== undefined;
        const isDouble = !isTriple && item.secondaryValue !== undefined;

        return (
          <Grid item xs={12} sm={6} md={colSize} key={item.key}>
            <Card sx={{ bgcolor: 'white', borderRadius: 2.5, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', minHeight: 140, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <CardContent sx={{ p: '20px !important', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', gap: 1.5 }}>
                {loading ? (
                  <div className='flex justify-between items-center gap-2'>
                    <div className='flex flex-col items-start gap-1 w-full'>
                      <Skeleton variant='text' width='60%' height={32} />
                      <Skeleton variant='text' width='80%' height={20} />
                    </div>
                    <Skeleton variant='rounded' width={42} height={42} />
                  </div>
                ) : (
                  <>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="caption" sx={{ fontWeight: 800, textTransform: 'uppercase', tracking: 'wider', color: 'text.secondary', fontSize: '0.7rem' }}>
                        {item.title}
                      </Typography>
                      <CustomAvatar
                        variant='rounded'
                        size={36}
                        skin='light'
                        color={item.color}
                      >
                        <IconComponent size={18} />
                      </CustomAvatar>
                    </Box>

                    <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', mt: 0.5 }}>
                      {isTriple ? (
                        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', width: '100%' }}>
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase' }}>
                              Meta Pixel
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 800, color: '#22303E', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {item.value}
                            </Typography>
                          </Box>
                          <Divider orientation="vertical" flexItem sx={{ borderRightWidth: 1.5, my: 0.5 }} />
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography variant="caption" sx={{ color: 'primary.main', display: 'block', fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase' }}>
                              Shopify Matched
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 800, color: 'primary.main', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {item.secondaryValue}
                            </Typography>
                          </Box>
                          <Divider orientation="vertical" flexItem sx={{ borderRightWidth: 1.5, my: 0.5 }} />
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography variant="caption" sx={{ color: 'success.main', display: 'block', fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase' }}>
                              {item.key === 'roas' ? 'Blended' : 'Shopify Store Total'}
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 800, color: 'success.main', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {item.thirdValue}
                            </Typography>
                          </Box>
                        </Box>
                      ) : isDouble ? (
                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', width: '100%' }}>
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase' }}>
                              Meta
                            </Typography>
                            <Typography variant="body1" sx={{ fontWeight: 800, color: '#22303E', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {item.value}
                            </Typography>
                          </Box>
                          <Divider orientation="vertical" flexItem sx={{ borderRightWidth: 1.5, my: 0.5 }} />
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography variant="caption" sx={{ color: 'success.main', display: 'block', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase' }}>
                              Shopify
                            </Typography>
                            <Typography variant="body1" sx={{ fontWeight: 800, color: 'success.main', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {item.secondaryValue}
                            </Typography>
                          </Box>
                        </Box>
                      ) : (
                        <Typography variant='h5' sx={{ fontWeight: 800, color: '#22303E' }}>
                          {item.value}
                        </Typography>
                      )}
                    </Box>

                    {item.subtitle && (
                      <Box sx={{ borderTop: '1px solid #F1F5F9', pt: 1.2, mt: 1 }}>
                        <Typography
                          variant='caption'
                          sx={{ fontWeight: 500, color: 'text.secondary', fontSize: '0.7rem', display: 'block' }}
                        >
                          {item.subtitle}
                        </Typography>
                      </Box>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </Grid>
        )
      })}
    </Grid>
  );
}