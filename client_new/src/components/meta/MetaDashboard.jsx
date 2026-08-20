"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useMetaDashboard } from "../../lib/hooks/useMetaDashboard";
import { useShopifyDashboard } from "../../lib/hooks/useShopifyDashboard";
import { MetaAdSetDetail } from "./MetaAdSetDetail";
import { MetaMetricCards } from "./MetaMetricCards";
import { MetaDynamicTable } from "./MetaDynamicTable";
import { MetaCampaignDetail } from "./MetaCampaignDetail";
import { MetaProductAuditDrawer } from "./MetaProductAuditDrawer";
import { DATE_RANGE_OPTIONS } from "../../lib/utils/constants";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import { FormControl, MenuItem, Select, Typography, Paper, IconButton, Tooltip, DialogActions, TextField, DialogContent, DialogTitle, Dialog, Alert, AlertTitle } from "@mui/material";
import BarChartIcon from "@mui/icons-material/BarChart";
import RefreshIcon from "@mui/icons-material/Refresh";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import CustomAvatar from "../mui/Avator";
import { PlusOne } from "@mui/icons-material";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';



const AddStoreDialog = ({ open, onClose, onConnect }) => {
  const [shopDomain, setShopDomain] = useState('')
  const [shopifyToken, setShopifyToken] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState('')

  const handleSubmit = async e => {
    e.preventDefault()
    setConnectError('')
    setConnecting(true)

    const shopify_url = shopDomain.trim()
    const shopify_token = shopifyToken.trim()

    try {
      const params = new URLSearchParams({
        type: 'performance',
        shopify_url,
        shopify_token,
        start_date: '2026-07-13',
        end_date: '2026-08-12'
      })

      const res = await fetch(`${BACKEND_URL}/api/shopify?${params.toString()}`)

      const result = await res.json()

      if (!res.ok || result.error || result.success === false) {
        throw new Error(
          result.error || 'Failed to connect to Shopify'
        )
      }

      console.log('✅ Shopify connected:', result)

      onConnect({
        shopify_url,
        shopify_token
      })

      onClose()
    } catch (err) {
      console.error('❌ Shopify connect error:', err)
      setConnectError(err.message || 'Connection failed')
    } finally {
      setConnecting(false)
    }
  }

  const handleClose = () => {
    if (connecting) return

    setShopDomain('')
    setShopifyToken('')
    setConnectError('')
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth='sm'
      scroll='body'
      sx={{
        '& .MuiDialog-paper': {
          overflow: 'visible',
          borderRadius: '16px',
          backgroundColor: 'white'
        }
      }}
    >
      <DialogTitle sx={{ pb: 1 }} className='text-[#22303EE6]'>
        <Box display='flex' alignItems='center' gap={1.5}>
          <Box
            sx={{
              width: 36,
              height: 38,
              borderRadius: '8px',
              bgcolor: '#96bf47',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <i className='bx-store text-white text-xl' />
          </Box>

          <Box>
            <Typography
              variant='h6'
              color='#22303EE6'
              fontWeight={700}
              lineHeight={2}
            >
              Add your store
            </Typography>

            <Typography variant='caption' color='#22303EE6'>
              Enter your store&apos;s URL and access Token.
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent
          sx={{
            pt: 2,
            pb: 3,
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <Typography
            variant='h6'
            color='#22303EE6'
            fontWeight={700}
            lineHeight={2}
          >
            Store URL
          </Typography>

          <TextField
            label='Store URL'
            value={shopDomain}
            onChange={e => setShopDomain(e.target.value)}
            placeholder='mystore.myshopify.com'
            size='small'
            fullWidth
            required
            sx={{
              '& .MuiInputLabel-root': {
                color: 'grey.600'
              },
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: 'grey.400'
                },
                '& input': {
                  color: '#22303EE6'
                }
              }
            }}
          />

          <Typography
            variant='h6'
            color='#22303EE6'
            mt={2}
            fontWeight={700}
            lineHeight={2}
          >
            Access Token
          </Typography>

          <TextField
            label='Access Token'
            type='password'
            value={shopifyToken}
            onChange={e => setShopifyToken(e.target.value)}
            placeholder='shpat_********'
            size='small'
            fullWidth
            required
            sx={{
              '& .MuiInputLabel-root': {
                color: 'grey.600'
              },
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: 'grey.400'
                },
                '& input': {
                  color: '#22303EE6'
                }
              }
            }}
          />
        </DialogContent>

        {connectError && (
          <Box sx={{ px: 3, pb: 1 }}>
            <Typography variant='caption' color='error'>
              {connectError}
            </Typography>
          </Box>
        )}

        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button
            variant='tonal'
            color='secondary'
            onClick={handleClose}
            disabled={connecting}
          >
            Cancel
          </Button>

          <Button
            type='submit'
            variant='contained'
            disabled={connecting}
            startIcon={
              connecting ? (
                <CircularProgress size={16} color='inherit' />
              ) : null
            }
            sx={{ minWidth: 160 }}
          >
            {connecting ? 'Connecting…' : 'Connect to Shopify'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

export function MetaDashboard({ accessToken, accountId }) {
  const [activeTab, setActiveTab] = useState("campaigns");
  const [selectedDateRange, setSelectedDateRange] = useState("last_30d");
  const [currentTime, setCurrentTime] = useState("");
  const [addStoreOpen, setAddStoreOpen] = useState(false);

  // Campaign detail state
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);
  const [showCampaignDetail, setShowCampaignDetail] = useState(false);

  // Ad Set detail state
  const [selectedAdSetId, setSelectedAdSetId] = useState(null);
  const [showAdSetDetail, setShowAdSetDetail] = useState(false);

  // Shopify catalog filter/sort & drawer states
  const [shopifyAdFilter, setShopifyAdFilter] = useState('running');
  const [shopifyPerfSort, setShopifyPerfSort] = useState('best');
  const [selectedProductPerformance, setSelectedProductPerformance] = useState(null);
  const [cardsViewMode, setCardsViewMode] = useState('comparison');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const {
    campaigns,
    adSets,
    ads,
    summary,
    loading,
    loadingInsights,
    loadingMore,
    loadingCreatives,
    hasMore,
    error,
    loadMore,
    loadCreatives,
    refresh,
    setDateRange,
    dateRange,
    tokenExpired,
  } = useMetaDashboard(accessToken, accountId);

  const {
    isConnected: isShopifyConnected,
    loading: shopifyLoading,
    wastedBudgetAlerts,
    productPerformance,
    shopifySummary,
    connectManual,
    disconnect: disconnectShopify,
    refresh: refreshShopify,
    unmatchedAds,
  } = useShopifyDashboard(ads, dateRange, loading || loadingInsights);

  // Get the selected campaign data
  const selectedCampaign = selectedCampaignId
    ? campaigns.find((c) => c.id === selectedCampaignId)
    : null;

  // Filter ad sets for the selected campaign
  const filteredAdSets = selectedCampaignId
    ? adSets.filter((adSet) => adSet.campaignId === selectedCampaignId)
    : adSets;

  const selectedAdSet = selectedAdSetId
    ? adSets.find((s) => s.id === selectedAdSetId)
    : null;

  const filteredAds = selectedAdSetId
    ? ads.filter((ad) => ad.adSetId === selectedAdSetId)
    : ads;

  // Handle campaign click
  const handleCampaignClick = (campaignId) => {
    setSelectedCampaignId(campaignId);
    setShowCampaignDetail(true);
  };

  // Handle back from campaign detail
  const handleBackFromDetail = () => {
    setSelectedCampaignId(null);
    setShowCampaignDetail(false);
  };

  // Handle Ad Set click
  const handleAdSetClick = (adSetId) => {
    setSelectedAdSetId(adSetId);
    setShowAdSetDetail(true);
  };

  // Handle back from Ad Set detail
  const handleBackFromAdSetDetail = () => {
    setSelectedAdSetId(null);
    setShowAdSetDetail(false);
  };

  useEffect(() => {
    setCurrentTime(new Date().toLocaleString());
  }, []);

  const handleDateRangeChange = (value) => {
    setSelectedDateRange(value);
    if (value === "custom") {
      return;
    }
    setDateRange({ preset: value });
  };

  const handleApplyCustomDate = () => {
    if (customStartDate && customEndDate) {
      setDateRange({
        preset: 'custom',
        since: customStartDate,
        until: customEndDate,
      });
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === "ads" && ads.length > 0) {
      const adIds = ads.map((ad) => ad.id);
      loadCreatives(adIds);
    }
  };

  const getActiveDateRangeLabel = () => {
    if (selectedDateRange === 'custom') {
      return `${customStartDate || '—'} to ${customEndDate || '—'}`;
    }
    const option = DATE_RANGE_OPTIONS.find(opt => opt.value === selectedDateRange);
    return option ? option.label : 'Last 30 Days';
  };

  // Handle Shopify connect
  const handleShopifyConnect = async ({ shopify_url, shopify_token }) => {
    try {
      connectManual(shopify_url, shopify_token);
      setActiveTab('shopify');
    } catch (err) {
      console.error('Failed to connect Shopify:', err);
    }
  };

  const handleShopifyDisconnect = () => {
    disconnectShopify();
    if (activeTab === 'shopify') {
      setActiveTab('campaigns');
    }
  };

  const currencyCode = isShopifyConnected ? (shopifySummary?.currency || 'PKR') : 'PKR';

  const filteredAndSortedProducts = useMemo(() => {
    let items = [...(productPerformance || [])];

    if (shopifyAdFilter === 'running') {
      items = items.filter(item =>
        item.adSpend > 0 && item.matchedAds?.some(ad => ad.status.toUpperCase() === 'ACTIVE' || ad.status.toUpperCase() === 'ENABLED')
      );
    }

    items.sort((a, b) => {
      const aVal = Number(a.metaAttributedROAS || 0);
      const bVal = Number(b.metaAttributedROAS || 0);
      if (shopifyPerfSort === 'best') {
        return bVal - aVal;
      } else {
        return aVal - bVal;
      }
    });

    return items;
  }, [productPerformance, shopifyPerfSort, shopifyAdFilter]);

  let tableData = [];

  switch (activeTab) {
    case "campaigns":
      tableData = campaigns;
      break;
    case "adSets":
      tableData = adSets;
      break;
    case "ads":
      tableData = ads;
      break;
    case "shopify":
      tableData = productPerformance;
      break;
    default:
      tableData = [];
      break;
  }

  if (error) {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", p: 3, backgroundColor: "background.default" }}>
        <Paper elevation={3} sx={{ maxWidth: 450, width: "100%", p: 4, textAlign: "center", borderRadius: 3 }}>
          <Typography variant="h3" sx={{ mb: 1 }}>⚠️</Typography>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>Failed to Load Dashboard</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>{error}</Typography>
          <Button variant="contained" onClick={refresh} sx={{ textTransform: "none" }}>Try Again</Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", backgroundColor: "#F4F5F7" }}>
      <AddStoreDialog
        open={addStoreOpen}
        onClose={() => setAddStoreOpen(false)}
        onConnect={data => {
          console.log('Connected Shopify:', data)
          handleShopifyConnect(data)
          setAddStoreOpen(false)
        }}
      />
      {/* Header Toolbar */}
      <Paper
        elevation={1}
        square
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          py: 1.5,
          px: { xs: 2, sm: 4 },
          borderBottom: "1px solid var(--mui-palette-divider)",
          background: 'white',

        }}
      >
        <Box sx={{ maxWidth: 1400, mx: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <CustomAvatar variant="rounded" size={42} sx={{ bgcolor: 'white' }}>
              <img src="/icons/logoshort.png" alt="Logo" style={{ width: 36, height: 36, objectFit: 'contain' }} />
            </CustomAvatar>
            <Box>
              <Typography variant="h6" className="text-[#22303EE6]" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                {showCampaignDetail ? "Campaign Details" : "Marketing Dashboard"}
              </Typography>
              <Typography variant="caption" className="text-[#22303EE6]">
                {showCampaignDetail && selectedCampaign ? selectedCampaign.name : `Account ID: ${accountId}`}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 2, background: 'white' }}>
            {isShopifyConnected ? (
              <Button
                variant="outlined"
                size="small"
                onClick={handleShopifyDisconnect}
                sx={{
                  height: 40,
                  borderRadius: 1,
                  textTransform: 'none',
                  borderColor: '#e53935',
                  color: '#e53935',
                  '&:hover': {
                    borderColor: '#c62828',
                    backgroundColor: 'rgba(229, 57, 53, 0.04)',
                  }
                }}
              >
                Disconnect Shopify
              </Button>
            ) : (
              <Button
                variant="outlined"
                size="small"
                startIcon='+'
                onClick={() => setAddStoreOpen(true)}
                sx={{
                  height: 40,
                  borderRadius: 1,
                  textTransform: 'none',
                  borderColor: '#E5E5E5',
                  color: '#22303EE6',
                  '&:hover': {
                    borderColor: '#96bf47',
                    backgroundColor: 'rgba(150, 191, 71, 0.04)',
                  }
                }}
              >
                Connect to Shopify
              </Button>
            )}
            <FormControl
              size="small"
              sx={{
                minWidth: 160,
                backgroundColor: 'white',
                '& .MuiInputBase-root': {
                  backgroundColor: 'white',
                  border: "1px solid #E5E5E5",
                },


              }}
            >
              <Select
                value={selectedDateRange}
                onChange={(e) => handleDateRangeChange(e.target.value)}
                IconComponent={ArrowDropDownIcon}
                sx={{
                  height: 40,
                  borderRadius: 1,
                  backgroundColor: 'white',
                  color: '#22303EE6',

                  '& .MuiSelect-select': {
                    color: '#22303EE6',
                  },

                  '& .MuiSelect-icon': {
                    color: '#22303EE6',
                  },

                  // Focus hone par green/default color remove
                  '&.Mui-focused': {
                    color: '#22303EE6',
                  },
                }}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      backgroundColor: 'white',
                      color: '#22303EE6',

                    },
                  },
                }}
              >
                {DATE_RANGE_OPTIONS.map((option) => (
                  <MenuItem
                    key={option.value}
                    value={option.value}
                    sx={{
                      color: '#22303EE6',
                      backgroundColor: 'white',
                    }}
                  >
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {selectedDateRange === 'custom' && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pl: 2, borderLeft: '1px solid #E2E8F0', animation: 'fadeIn 0.25s' }}>
                <TextField
                  type="date"
                  size="small"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  sx={{
                    '& .MuiInputBase-root': {
                      height: 40,
                      backgroundColor: 'white',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: '#22303EE6',
                      border: "1px solid #E5E5E5",
                      borderRadius: 1,
                      '& fieldset': { border: 'none' }
                    }
                  }}
                />
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.8rem' }}>
                  to
                </Typography>
                <TextField
                  type="date"
                  size="small"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  sx={{
                    '& .MuiInputBase-root': {
                      height: 40,
                      backgroundColor: 'white',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: '#22303EE6',
                      border: "1px solid #E5E5E5",
                      borderRadius: 1,
                      '& fieldset': { border: 'none' }
                    }
                  }}
                />
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleApplyCustomDate}
                  disabled={!customStartDate || !customEndDate}
                  sx={{
                    height: 40,
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    borderRadius: 1,
                    px: 2.5,
                  }}
                >
                  Apply
                </Button>
              </Box>
            )}

            <Tooltip title="Refresh Data">
              <span>
                <IconButton
                  onClick={async () => {
                    await refresh();
                    if (isShopifyConnected) refreshShopify();
                  }}
                  disabled={loading || loadingInsights || shopifyLoading}
                  color="primary"
                  sx={{ border: "1px solid var(--mui-palette-divider)", borderRadius: 2 }}
                >
                  <RefreshIcon className={loading || loadingInsights || shopifyLoading ? "animate-spin" : ""} />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>
      </Paper>

      {/* Main Content */}
      <Box sx={{ mx: "auto", p: { xs: 2, sm: 4 }, display: "flex", flexDirection: "column", gap: 3 }}>
        {/* Token Expired Banner */}
        {tokenExpired && (
          <Alert severity="error" sx={{ mb: 1, borderRadius: 2 }}>
            <AlertTitle sx={{ fontWeight: 700 }}>Meta Access Token Expired</AlertTitle>
            Your Meta access token has expired. Insights metrics show zeros. To restore live data, please reconnect your Meta account.
          </Alert>
        )}

        {/* Wasted Budget Alerts Banner */}
        {wastedBudgetAlerts && wastedBudgetAlerts.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 1 }}>
            {wastedBudgetAlerts.map(alert => (
              <Alert
                key={alert.adId}
                severity="warning"
                sx={{ borderRadius: 2 }}
                action={
                  alert.adUrl && alert.adUrl !== '#' && (
                    <Button
                      color="inherit"
                      size="small"
                      href={alert.adUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ fontWeight: 600 }}
                    >
                      View Ad
                    </Button>
                  )
                }
              >
                <AlertTitle sx={{ fontWeight: 700 }}>Wasted Ad Budget Alert</AlertTitle>
                Active Ad <strong>{alert.adName}</strong> (Spend: {currencyCode} {alert.spend.toFixed(2)}) is driving traffic to <strong>{alert.productTitle}</strong> (SKU: {alert.sku}) which is <strong>Out of Stock</strong>!
              </Alert>
            ))}
          </Box>
        )}

        {showAdSetDetail && selectedAdSet ? (
          <MetaAdSetDetail
            adSet={selectedAdSet}
            ads={filteredAds}
            loading={loading}
            hasMore={hasMore.ads}
            loadingMore={loadingMore.ads}
            onLoadMore={() => loadMore("ads")}
            onBack={handleBackFromAdSetDetail}
            currencyCode={currencyCode}
          />
        ) : showCampaignDetail && selectedCampaign ? (
          <MetaCampaignDetail
            campaign={selectedCampaign}
            adSets={filteredAdSets}
            loading={loading}
            hasMore={hasMore.adSets}
            loadingMore={loadingMore.adSets}
            onLoadMore={() => loadMore("adSets")}
            onBack={handleBackFromDetail}
            onAdSetClick={handleAdSetClick}
            currencyCode={currencyCode}
          />
        ) : (
          <>
            {/* Summary Metrics */}
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, sm: 'items-center', justifyContent: 'space-between', gap: 2, mb: 1.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, textTransform: 'uppercase', tracking: 'wider', color: 'text.secondary' }}>
                Performance Overview (Active, Paused & Organic)
              </Typography>
              {isShopifyConnected && (
                <FormControl
                  size="small"
                  sx={{
                    minWidth: 160,
                    backgroundColor: 'white',
                    '& .MuiInputBase-root': {
                      backgroundColor: 'white',
                      border: "1px solid #E5E5E5",
                    },
                  }}
                >
                  <Select
                    value={cardsViewMode}
                    onChange={(e) => setCardsViewMode(e.target.value)}
                    IconComponent={ArrowDropDownIcon}
                    sx={{
                      height: 40,
                      borderRadius: 1,
                      backgroundColor: 'white',
                      color: '#22303EE6',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      '& .MuiSelect-select': {
                        color: '#22303EE6',
                      },
                      '& .MuiSelect-icon': {
                        color: '#22303EE6',
                      },
                    }}
                  >
                    <MenuItem value="comparison">Comparison</MenuItem>
                    <MenuItem value="meta">Meta Only</MenuItem>
                    <MenuItem value="shopify">Shopify Only</MenuItem>
                  </Select>
                </FormControl>
              )}
            </Box>

            <MetaMetricCards
              summary={summary}
              loading={loading || loadingInsights}
              shopifyConnected={isShopifyConnected}
              shopifySummary={shopifySummary}
              viewMode={cardsViewMode}
              currencyCode={currencyCode}
            />

            {/* Tabs & Dynamic Table */}
            <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
              {[
                { key: "campaigns", label: "Campaigns", count: campaigns.length },
                { key: "adSets", label: "Ad Sets", count: adSets.length },
                { key: "ads", label: "Ads", count: ads.length, isLoading: loadingCreatives },
                { key: "shopify", label: "Shopify Catalog", count: productPerformance?.length || 0, isLoading: shopifyLoading }
              ].map((tab) => {
                const isActive = activeTab === tab.key;

                return (
                  <Button
                    key={tab.key}
                    disabled={loading}
                    size="small"
                    variant={isActive ? "contained" : "outlined"}
                    onClick={() => handleTabChange(tab.key)}
                    className={`${activeTab === tab.key ? 'bg-primary text-white' : 'bg-white text-primary dark:bg-secondary dark:text-white'}`}
                    sx={{
                      height: '34px',
                      textTransform: 'none',
                      fontSize: '0.85rem',
                      whiteSpace: 'nowrap',
                      '&.MuiButton-contained': {
                        border: '1px solid transparent'
                      }
                    }}
                  >
                    <span>{tab.label}</span>
                    <Chip
                      label={tab.count}
                      size="small"
                      sx={{
                        height: "20px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "inherit",
                        backgroundColor: "transparent",
                        '&:hover': {
                          backgroundColor: "transparent"
                        }
                      }}
                    />
                    {tab.isLoading && <CircularProgress size={14} sx={{ color: isActive ? "#fff" : "primary.main" }} />}
                  </Button>
                );
              })}
            </Box>



            {activeTab === 'shopify' && !isShopifyConnected ? (
              <Paper
                elevation={0}
                sx={{
                  p: 6,
                  textAlign: 'center',
                  bgcolor: 'white',
                  borderRadius: 3,
                  border: '1px solid var(--mui-palette-divider)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2
                }}
              >
                <Box sx={{ fontSize: '3rem' }}>🛍️</Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>Shopify Not Synced</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400, mx: 'auto', mb: 1 }}>
                  Connect your Shopify store to view product-level catalog performance, ROAS tracking, and inventory levels.
                </Typography>
                <Button
                  variant="contained"
                  onClick={() => setAddStoreOpen(true)}
                  sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2, px: 3 }}
                >
                  Connect Shopify Store
                </Button>
              </Paper>
            ) : (
              <MetaDynamicTable
                activeTab={activeTab}
                data={tableData}
                loading={loading}
                loadingInsights={loadingInsights}
                shopifyLoading={shopifyLoading}
                onCampaignClick={handleCampaignClick}
                onAdSetClick={handleAdSetClick}
                onAuditClick={setSelectedProductPerformance}
                currencyCode={currencyCode}
                unmatchedAds={unmatchedAds}
              />
            )}
          </>
        )}

        <MetaProductAuditDrawer
          open={!!selectedProductPerformance}
          onClose={() => setSelectedProductPerformance(null)}
          product={selectedProductPerformance}
          currencyCode={currencyCode}
          activeDateRangeLabel={getActiveDateRangeLabel()}
        />

        {/* Footer */}
        <Typography variant="caption" className="text-[#22303EE6]" sx={{ textAlign: "center", pt: 2, borderTop: "1px solid var(--mui-palette-divider)" }}>
          Data is updated in real-time • Last sync: {currentTime || "Loading..."}
        </Typography>
      </Box>
    </Box>
  );
}
