import React, { useMemo, useState, useEffect } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
} from "@tanstack/react-table";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import classnames from "classnames";
import FirstPageIcon from "@mui/icons-material/FirstPage";
import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import LastPageIcon from "@mui/icons-material/LastPage";
import { MetaStatusBadge } from "./MetaStatusBadge";
import dayjs from "dayjs";

const ExpandableText = ({ text, wordLimit = 4 }) => {
  const [expanded, setExpanded] = useState(false);

  if (!text) return null;

  const words = text.split(' ');
  if (words.length <= wordLimit) {
    return (
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
        {text}
      </Typography>
    );
  }

  const truncatedText = words.slice(0, wordLimit).join(' ') + '...';

  return (
    <Typography
      variant="caption"
      onClick={() => setExpanded(!expanded)}
      sx={{
        color: 'text.secondary',
        display: 'block',
        mt: 0.5,
        cursor: 'pointer',
        '&:hover': { color: 'primary.main' }
      }}
    >
      {expanded ? text : truncatedText}
      <span style={{ color: '#3B82F6', marginLeft: '4px', fontWeight: 600 }}>
        {expanded ? ' (show less)' : ' (show more)'}
      </span>
    </Typography>
  );
};

export function MetaDynamicTable({
  activeTab,
  data = [],
  loading,
  loadingInsights,
  onCampaignClick,
  onAdSetClick,
  shopifyLoading,
  currencyCode = 'USD',
  unmatchedAds = [],
  onAuditClick,
}) {

  console.log("data", data)

  const formatCurrency = (amount) => {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode,
      }).format(amount);
    } catch {
      return `${currencyCode} ${Number(amount).toFixed(2)}`;
    }
  };

  const columnNameMap = {
    id: "ID",
    name: "Name",
    title: "Product Name",
    image: "Image",
    handle: "Handle",
    sku: "SKU",
    variantCount: "Variants",
    totalInventory: "Total Inventory",
    priceRange: "Price",
    status: "Status",
    budget: "Budget",
    impressions: "Impressions",
    clicks: "Clicks",
    ctr: "CTR",
    cost: "Cost",
    conversions: "Conversions",
    roas: "Revenue (ROAS)",
    insights: "Insights",
    raw: "Raw",
    objective: "Objective",
    type: "Type",
    startDate: "Start Date",
    endDate: "End Date",
    conversionValue: "Conversion Value",
    cpc: "CPC",
    campaignId: "Campaign ID",
    campaignName: "Campaign Name",
    optimizationGoal: "Optimization Goal",
    targeting: "Targeting",
    creative: "Creative",
    adGroupName: "Ad Set",
    // Shopify performance fields
    productId: "Product ID",
    productTitle: "Product Title (SKU)",
    inventoryQuantity: "Inventory Level",
    shopifySalesQuantity: "Shopify Sales",
    shopifyRevenue: "Shopify Revenue",
    metaSalesQuantity: "Meta Sales",
    metaRevenue: "Shopify Sales (UTM)",
    gap: "Sales Gap",
    adSpend: "Ad Spend (Meta)",
    adClicks: "Ad Clicks",
    attributedSales: "Attributed Sales",
    attributedRevenue: "Meta Sales (Pixel)",
    trueROAS: "True ROAS",
    metaAttributedROAS: "Meta ROAS (Pixel)",
    utmRoas: "Shopify ROAS (UTM)",
    audit: "Ads Performance",
  };

  const orderedKeys = useMemo(() => {
    switch (activeTab) {
      case "campaigns":
        return [
          "name",
          "status",
          "startDate",
          "endDate",
          "type",
          "impressions",
          "clicks",
          "ctr",
          "cost",
          "conversions",
          "conversionValue",
          "roas",
          "audit",
        ];

      case "adSets":
        return [
          "name",
          "campaignName",
          "status",
          "startDate",
          "endDate",
          "targeting",
          "impressions",
          "clicks",
          "ctr",
          "cost",
          "conversions",
          "roas",
        ];

      case "ads":
        return [
          "name",
          "status",
          "startDate",
          "endDate",
          "creative",
          "campaignName",
          "adGroupName",
          "impressions",
          "clicks",
          "ctr",
          "cost",
          "conversions",
          "roas",
        ];

      case "shopify":
        return [
          "productTitle",
          "inventoryQuantity",
          "adSpend",
          "attributedRevenue",
          "metaRevenue",
          "gap",
          "metaAttributedROAS",
          "utmRoas",
          "audit",
        ];

      default:
        return [];
    }
  }, [activeTab, data]);

  const columns = useMemo(() => {
    return orderedKeys
      .filter((key) => key !== "_id")
      .map((key) => ({
        accessorKey: key,
        header: key === "audit" && activeTab === "campaigns" ? "Campaign Audit" : (columnNameMap[key] || key),
        cell: ({ row, getValue }) => {
          const value = getValue();

          if (key === "gap" && activeTab === "shopify") {
            const pixelSales = Number(row.original.attributedSales || 0);
            const utmSales = Number(row.original.metaSalesQuantity || 0);
            const gapQty = pixelSales - utmSales;

            const pixelRev = Number(row.original.attributedRevenue || 0);
            const utmRev = Number(row.original.metaRevenue || 0);
            const gapRev = pixelRev - utmRev;

            const textColor = '#22303E';

            const maxSales = Math.max(pixelSales, utmSales);
            const pct = maxSales > 0 ? (gapQty / maxSales) * 100 : 0;
            return (
              <Box sx={{ textAlign: 'right' }}>
                <Typography component="span" sx={{ fontWeight: 600, display: 'block' }}>
                  {Math.abs(gapQty)} sold
                </Typography>
                {/* {pixelSales > 0 && (
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                    {Math.abs(pct).toFixed(1)}%
                  </Typography>
                )} */}
              </Box>
            );
          }

          if (key === "utmRoas" && activeTab === "shopify") {
            const spend = row.original.adSpend || 0;
            if (spend <= 0) {
              return <Box sx={{ textAlign: 'right', color: '#94A3B8', fontWeight: 600 }}>No Ads</Box>;
            }
            const rev = row.original.metaRevenue || 0;
            const roas = spend > 0 ? rev / spend : 0;
            let color = '#94A3B8';
            if (roas > 2) color = '#10B981';
            else if (roas > 1) color = '#F59E0B';
            else color = '#EF4444';
            return (
              <Box sx={{ textAlign: 'right', fontWeight: 700, color: color }}>
                {roas.toFixed(2)}x
              </Box>
            );
          }

          if (key === "audit" && activeTab === "shopify") {
            const spend = row.original.adSpend || 0;
            if (spend > 0 && onAuditClick) {
              return (
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => onAuditClick(row.original)}
                    className="bg-white text-primary dark:bg-secondary dark:text-white"
                    sx={{
                      height: '34px',
                      textTransform: 'none',
                      fontSize: '0.85rem',
                      whiteSpace: 'nowrap',
                      fontWeight: 600,
                    }}
                  >
                    Audit Ad Performance
                  </Button>
                </Box>
              );
            }
            return <Box sx={{ display: 'flex', justifyContent: 'center', color: '#94A3B8', fontWeight: 600 }}>—</Box>;
          }

          if (key === "audit" && activeTab === "campaigns") {
            const spend = row.original.cost || 0;
            const statusUpper = row.original.status?.toUpperCase();
            const isActive = statusUpper === "ACTIVE" || statusUpper === "ENABLED";
            if (isActive && spend > 0 && onAuditClick) {
              return (
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => onAuditClick(row.original, "campaign")}
                    className="bg-white text-primary dark:bg-secondary dark:text-white"
                    sx={{
                      height: '34px',
                      textTransform: 'none',
                      fontSize: '0.85rem',
                      whiteSpace: 'nowrap',
                      fontWeight: 600,
                    }}
                  >
                    Audit Campaign
                  </Button>
                </Box>
              );
            }
            return <Box sx={{ display: 'flex', justifyContent: 'center', color: '#94A3B8', fontWeight: 600 }}>—</Box>;
          }

          if (value === null || value === undefined) {
            return "—";
          }

          if (key === "startDate" || key === "endDate") {
            if (!value || value === "—") return "—";
            try {
              const date = new Date(value);
              if (isNaN(date.getTime())) return "—";
              return date.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric"
              });
            } catch {
              return String(value);
            }
          }

          if (key === "status") {
            return <MetaStatusBadge status={value} />;
          }

          if (key === "productTitle" && activeTab === "shopify") {
            return (
              <Box>
                <Typography
                  component="span"
                  onClick={onAuditClick ? () => onAuditClick(row.original) : undefined}
                  sx={{
                    fontWeight: 650,
                    color: onAuditClick ? "primary.main" : "text.primary",
                    cursor: onAuditClick ? "pointer" : "default",
                    display: 'block',
                    '&:hover': {
                      textDecoration: onAuditClick ? 'underline' : 'none'
                    }
                  }}
                >
                  {String(value)}
                </Typography>
                {row.original.sku && (
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                    SKU: {row.original.sku}
                  </Typography>
                )}
              </Box>
            );
          }

          if (key === "inventoryQuantity" && activeTab === "shopify") {
            const qty = Number(value);
            let chipColor = { bg: '#E2FBE9', text: '#0E622B' }; // In stock
            let label = `${qty} in stock`;
            if (qty <= 0) {
              chipColor = { bg: '#FEE2E2', text: '#991B1B' }; // Out of stock
              label = 'Out of Stock';
            } else if (qty < 10) {
              chipColor = { bg: '#FEF3C7', text: '#92400E' }; // Warning
            }
            return (
              <Chip
                label={label}
                size="small"
                sx={{
                  backgroundColor: chipColor.bg,
                  color: chipColor.text,
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  borderRadius: '4px'
                }}
              />
            );
          }

          if (key === "attributedRevenue" && activeTab === "shopify") {
            const sales = row.original.attributedSales || 0;
            return (
              <Box sx={{ textAlign: 'right' }}>
                <Typography component="span" sx={{ fontWeight: 600, display: 'block' }}>
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: currencyCode,
                  }).format(Number(value))}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                  {sales} sold
                </Typography>
              </Box>
            );
          }

          if (key === "metaRevenue" && activeTab === "shopify") {
            const sales = row.original.metaSalesQuantity || 0;
            return (
              <Box sx={{ textAlign: 'right' }}>
                <Typography component="span" sx={{ fontWeight: 600, display: 'block' }}>
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: currencyCode,
                  }).format(Number(value))}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                  {sales} sold
                </Typography>
              </Box>
            );
          }

          if (key === "adSpend" && activeTab === "shopify") {
            return (
              <Box sx={{ textAlign: 'right', fontWeight: 600 }}>
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: currencyCode,
                }).format(Number(value))}
              </Box>
            );
          }

          if (key === "metaAttributedROAS" && activeTab === "shopify") {
            const spend = row.original.adSpend || 0;
            if (spend <= 0) {
              return <Box sx={{ textAlign: 'right', color: '#94A3B8', fontWeight: 600 }}>No Ads</Box>;
            }
            const roas = Number(value) || 0;
            let color = '#94A3B8';
            if (roas > 2) color = '#10B981';
            else if (roas > 1) color = '#F59E0B';
            else color = '#EF4444';
            return (
              <Box sx={{ textAlign: 'right', fontWeight: 700, color: color }}>
                {roas.toFixed(2)}x
              </Box>
            );
          }



          if (key === "creative") {
            const headline = row.original.headline;
            const description = row.original.description;
            const finalUrl = row.original.finalUrl;

            if (headline && headline !== 'N/A') {
              return (
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {headline}
                  </Typography>
                  {description && (
                    <ExpandableText text={description} />
                  )}
                  {finalUrl && finalUrl !== '#' && (
                    <a
                      href={finalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.75rem',
                        color: '#3B82F6',
                        textDecoration: 'none',
                        marginTop: '4px'
                      }}
                      onMouseOver={(e) => e.target.style.textDecoration = 'underline'}
                      onMouseOut={(e) => e.target.style.textDecoration = 'none'}
                    >
                      {finalUrl.replace(/^https?:\/\//, '').slice(0, 30)}...
                    </a>
                  )}
                </Box>
              );
            }
            return <Typography variant="caption" sx={{ color: 'text.secondary' }}>No creative data</Typography>;
          }

          if (key === "type") {
            const colors = {
              VIDEO: { bg: '#E0F2FE', text: '#0369A1' },
              DISPLAY: { bg: '#F3E8FF', text: '#6B21A8' },
              SEARCH: { bg: '#ECFDF5', text: '#047857' },
              SHOPPING: { bg: '#FEF3C7', text: '#B45309' },
              LEAD_GEN: { bg: '#FCE7F3', text: '#BE185D' },
              APP_INSTALL: { bg: '#E0E7FF', text: '#4338CA' },
              SOCIAL: { bg: '#FFEDD5', text: '#C2410C' },
            };
            const themeColors = colors[String(value).toUpperCase()] || { bg: '#F1F5F9', text: '#475569' };
            return (
              <Chip
                label={String(value).replace('_', ' ')}
                size="small"
                sx={{
                  backgroundColor: themeColors.bg,
                  color: themeColors.text,
                  fontWeight: 600,
                  fontSize: '0.7rem',
                  borderRadius: '4px'
                }}
              />
            );
          }

          if (key === "roas" && activeTab !== "shopify") {
            const roasVal = Number(value) || 0;
            const spend = row.original.cost || 0;
            const revVal = row.original.conversionValue || row.original.insights?.conversion_values || (roasVal * spend) || 0;

            let roasColors = { bg: '#FEE2E2', text: '#991B1B' };
            if (roasVal >= 2) {
              roasColors = { bg: '#D1FAE5', text: '#065F46' };
            } else if (roasVal >= 1) {
              roasColors = { bg: '#FEF3C7', text: '#92400E' };
            }

            return (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.primary', fontSize: '0.8rem' }}>
                  {formatCurrency(revVal)}
                </Typography>
                <Chip
                  label={roasVal > 0 ? `${roasVal.toFixed(2)}x` : '0x'}
                  size="small"
                  sx={{
                    backgroundColor: roasColors.bg,
                    color: roasColors.text,
                    fontWeight: 750,
                    fontSize: '0.68rem',
                    borderRadius: '4px',
                    height: '18px'
                  }}
                />
              </Box>
            );
          }

          if (key === "roas" || key === "trueROAS" || key === "metaAttributedROAS") {
            const valNum = Number(value);
            let roasColors = { bg: '#FEE2E2', text: '#991B1B' };
            if (valNum >= 2) {
              roasColors = { bg: '#D1FAE5', text: '#065F46' };
            } else if (valNum >= 1) {
              roasColors = { bg: '#FEF3C7', text: '#92400E' };
            }
            return (
              <Chip
                label={valNum > 0 ? `${valNum.toFixed(2)}x` : '0x'}
                size="small"
                sx={{
                  backgroundColor: roasColors.bg,
                  color: roasColors.text,
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  borderRadius: '4px'
                }}
              />
            );
          }

          if (
            key === "impressions" ||
            key === "clicks" ||
            key === "conversions" ||
            key === "shopifySalesQuantity" ||
            key === "metaSalesQuantity" ||
            key === "attributedSales" ||
            key === "inventoryQuantity"
          ) {
            return <span>{Number(value).toLocaleString()}</span>;
          }

          if (
            key === "cost" ||
            key === "conversionValue" ||
            key === "budget" ||
            key === "shopifyRevenue" ||
            key === "metaRevenue" ||
            key === "adSpend" ||
            key === "attributedRevenue"
          ) {
            return (
              <span>
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: currencyCode,
                }).format(Number(value))}
              </span>
            );
          }

          if (key === "ctr") {
            const clicks = Number(row.original.clicks) || 0;
            const impressions = Number(row.original.impressions) || 0;
            let ctrValue = Number(value);

            if (ctrValue === 0 && impressions > 0) {
              ctrValue = (clicks / impressions) * 100;
            } else if (ctrValue > 0 && ctrValue < 0.1 && clicks > 0 && impressions > 0) {
              const calc = (clicks / impressions) * 100;
              if (Math.abs(calc - ctrValue * 100) < 0.5) {
                ctrValue = calc;
              }
            }
            return <span>{ctrValue.toFixed(2)}%</span>;
          }

          if (key === "image") {
            const src = typeof value === 'object' ? value?.src : value;
            return src
              ? <img src={src} alt="product" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, border: '1px solid #eee' }} />
              : '—';
          }

          if (key === "name" && activeTab === "campaigns" && onCampaignClick) {
            return (
              <Box>
                <Typography
                  component="span"
                  onClick={() => onCampaignClick(row.original.id)}
                  sx={{
                    color: "primary.main",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: 'block'
                  }}
                >
                  {String(value)}
                </Typography>
                {row.original.objective && (
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                    Objective: {row.original.objective}
                  </Typography>
                )}
              </Box>
            );
          }

          if (key === "name" && activeTab === "ads") {
            return (
              <Box>
                <Typography component="span" sx={{ fontWeight: 600, display: 'block' }}>
                  {String(value)}
                </Typography>
                {row.original.type && (
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                    {row.original.type}
                  </Typography>
                )}
              </Box>
            );
          }

          if (key === "name" && activeTab === "adSets" && onAdSetClick) {
            return (
              <Box>
                <Typography
                  component="span"
                  onClick={() => onAdSetClick(row.original.id)}
                  sx={{
                    color: "primary.main",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: 'block'
                  }}
                >
                  {String(value)}
                </Typography>
                {row.original.optimizationGoal && (
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                    Opt: {row.original.optimizationGoal}
                  </Typography>
                )}
              </Box>
            );
          }

          if (key === "targeting") {
            return (
              <Typography
                variant="body2"
                sx={{
                  maxWidth: 150,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
                title={String(value)}
              >
                {String(value)}
              </Typography>
            );
          }

          if (typeof value === 'string' && (
            key.toLowerCase().includes('date') ||
            key.toLowerCase().includes('time') ||
            key === 'createdAt' ||
            key === 'updatedAt'
          )) {
            const date = dayjs(value)

            if (date.isValid()) {
              return date.format('DD-MM-YYYY, hh:mm A')
            }
            return value;
          }

          if (typeof value === 'string') {
            return (
              <span>{value.charAt(0).toUpperCase() + value.slice(1)}</span>
            )
          }

          return <span>{String(value)}</span>;
        },
      }));
  }, [orderedKeys, activeTab, onCampaignClick, onAdSetClick, currencyCode]);

  const [adFilter, setAdFilter] = useState('all');
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 20,
  });

  // Reset filter when changing activeTab to avoid showing empty screens
  useEffect(() => {
    setAdFilter('all');
  }, [activeTab]);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [activeTab, adFilter]);

  const filteredData = useMemo(() => {
    if (!data) return [];

    switch (adFilter) {
      case 'active':
        return data.filter(item => item.status === 'ENABLED' || item.status === 'ACTIVE');
      case 'spending':
        return data.filter(item => (item.cost || item.spend || 0) > 0);
      case 'active_spending':
        return data.filter(item => {
          const isActive = item.status === 'ENABLED' || item.status === 'ACTIVE';
          const hasSpend = (item.cost || item.spend || 0) > 0;
          return isActive && hasSpend;
        });
      case 'unmatched':
        if (activeTab !== 'ads') return data;
        const unmatchedIds = new Set((unmatchedAds || []).map(ua => ua?.id || ua));
        return data.filter(item => unmatchedIds.has(item.id));
      default:
        return data;
    }
  }, [data, activeTab, adFilter, unmatchedAds]);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      pagination,
    },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const visiblePages = useMemo(() => {
    const pageIndex = pagination.pageIndex;
    const pageCount = table.getPageCount();

    if (pageCount <= 7) {
      return Array.from({ length: pageCount }, (_, i) => i);
    }

    const visible = [];
    if (pageIndex <= 3) {
      visible.push(0, 1, 2, 3, 4, 'ellipsis', pageCount - 1);
    } else if (pageIndex >= pageCount - 4) {
      visible.push(0, 'ellipsis', pageCount - 5, pageCount - 4, pageCount - 3, pageCount - 2, pageCount - 1);
    } else {
      visible.push(0, 'ellipsis', pageIndex - 1, pageIndex, pageIndex + 1, 'ellipsis', pageCount - 1);
    }
    return visible;
  }, [pagination.pageIndex, table.getPageCount()]);

  return (
    <Card sx={{ bgcolor: 'white' }}>
      {!loading && data && data.length > 0 && (activeTab === "campaigns" || activeTab === "adSets" || activeTab === "ads") && (
        <Box sx={{ p: 2, display: "flex", flexWrap: "wrap", gap: 1, borderBottom: "1px solid rgba(224, 224, 224, 1)" }}>
          {[
            { key: 'all', label: 'All', count: data.length, color: 'default' },
            { key: 'active', label: 'Active', count: data.filter(a => a.status === 'ENABLED' || a.status === 'ACTIVE').length, color: 'success' },
            { key: 'spending', label: 'Spending', count: data.filter(a => (a.cost || a.spend || 0) > 0).length, color: 'primary' },
            { key: 'active_spending', label: 'Active & Spending', count: data.filter(a => (a.status === 'ENABLED' || a.status === 'ACTIVE') && (a.cost || a.spend || 0) > 0).length, color: 'secondary' },
            ...((activeTab === "ads" && unmatchedAds && unmatchedAds.length > 0)
              ? [{ key: 'unmatched', label: 'Unmatched', count: data.filter(a => new Set((unmatchedAds || []).map(ua => ua?.id || ua)).has(a.id)).length, color: 'error' }]
              : [])
          ].map((btn) => {
            const isActive = adFilter === btn.key;
            return (
              <Button
                key={btn.key}
                variant={isActive ? "contained" : "outlined"}
                color={btn.color === 'default' ? 'primary' : btn.color}
                size="small"
                onClick={() => setAdFilter(btn.key)}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 1
                }}
              >
                {btn.label}
                <Chip
                  label={btn.count}
                  size="small"
                  sx={{
                    height: '18px',
                    fontSize: '0.65rem',
                    fontWeight: 750,
                    backgroundColor: isActive ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.05)',
                    color: isActive ? '#fff' : 'inherit'
                  }}
                />
              </Button>
            );
          })}
        </Box>
      )}

      <Box className='overflow-x-auto overflow-y-auto no-scrollbar'>
        {loading || loadingInsights || shopifyLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 8 }}>
            <CircularProgress />
          </Box>
        ) : filteredData && filteredData.length > 0 ? (
          <table className="min-w-full border-collapse">
            <thead className='border-y sticky top-0 z-[1] bg-primary'>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className={classnames(
                        "px-4 py-3 font-semibold text-[0.8rem] text-white whitespace-nowrap",
                        {
                          "text-right": [
                            "impressions",
                            "clicks",
                            "ctr",
                            "cost",
                            "conversions",
                            "roas",
                            "adSpend",
                            "attributedRevenue",
                            "metaRevenue",
                            "metaAttributedROAS",
                            "utmRoas"
                          ].includes(header.id),
                          "text-left": ![
                            "impressions",
                            "clicks",
                            "ctr",
                            "cost",
                            "conversions",
                            "roas",
                            "adSpend",
                            "attributedRevenue",
                            "metaRevenue",
                            "metaAttributedROAS",
                            "utmRoas"
                          ].includes(header.id),
                          "cursor-pointer select-none": header.column.getCanSort?.(),
                        }
                      )}
                      onClick={header.column.getToggleSortingHandler?.()}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>

            <tbody className="bg-white">
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-4 py-2 border-b border-r border-gray-200 text-[0.75rem] text-[#22303EE6]"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>

            {data.length > 0 && (
              <tfoot className="font-bold ">
                <tr className="border-t border-gray-200 text-[0.75rem] text-[#22303EE6]">
                  {(() => {
                    const sums = {};
                    const leafColumns = table.getAllLeafColumns().map((c) => c.columnDef);
                    const labelColumnKey = leafColumns[0]?.accessorKey;

                    leafColumns.forEach((col) => {
                      const key = col.accessorKey;
                      if (key === labelColumnKey) return;

                      const isNumeric = data.some(
                        (row) =>
                          row[key] !== "" &&
                          row[key] !== null &&
                          row[key] !== undefined &&
                          !isNaN(Number(String(row[key]).replace("%", "")))
                      );

                      if (isNumeric) {
                        sums[key] = data.reduce((sum, row) => {
                          const val = row[key];
                          const num = Number(String(val).replace("%", ""));
                          return sum + (isNaN(num) ? 0 : num);
                        }, 0);
                      }
                    });

                    const formatTotal = (val, colKey) => {
                      if (val === null || val === undefined) return "";

                      const num = Number(String(val).replace("%", ""));
                      if (isNaN(num)) return val;

                      // 1. Currency Columns
                      if (["cost", "budget", "adSpend", "attributedRevenue", "metaRevenue"].includes(colKey)) {
                        return new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: currencyCode,
                        }).format(num);
                      }

                      // 2. Percentage Columns (CTR)
                      if (colKey === "ctr") {
                        const valNum = Number(val);
                        const pct = valNum < 1 ? valNum * 100 : valNum;
                        return `${pct.toFixed(2)}%`;
                      }

                      // 3. ROAS / Revenue Columns
                      if (["roas", "trueROAS", "metaAttributedROAS", "utmRoas"].includes(colKey)) {
                        if (colKey === "roas" && activeTab !== "shopify") {
                          const totalCost = sums["cost"] || 0;
                          const totalRevenue = data.reduce((sum, r) => {
                            const rev = r.conversionValue || r.insights?.conversion_values || 0;
                            return sum + rev;
                          }, 0);
                          const totalRoas = totalCost > 0 ? totalRevenue / totalCost : 0;

                          return (
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                              <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main', fontSize: '0.8rem' }}>
                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(totalRevenue)}
                              </Typography>
                              <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', fontSize: '0.75rem' }}>
                                {totalRoas.toFixed(2)}x
                              </Typography>
                            </Box>
                          );
                        }

                        return `${num.toFixed(2)}x`;
                      }

                      if (colKey === "gap") {
                        const totalPixelSales = data.reduce((sum, r) => sum + Number(r.attributedSales || 0), 0);
                        const totalShopifySales = data.reduce((sum, r) => sum + Number(r.metaSalesQuantity || 0), 0);
                        const gapQty = totalPixelSales - totalShopifySales;

                        const totalPixelRev = data.reduce((sum, r) => sum + Number(r.attributedRevenue || 0), 0);
                        const totalShopifyRev = data.reduce((sum, r) => sum + Number(r.metaRevenue || 0), 0);
                        const gapRev = totalPixelRev - totalShopifyRev;

                        const textColor = '#22303E';

                        const maxTotalSales = Math.max(totalPixelSales, totalShopifySales);
                        const pct = maxTotalSales > 0 ? (gapQty / maxTotalSales) * 100 : 0;
                        return (
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                            <Typography component="span" sx={{ fontWeight: 600, display: 'block', fontSize: '0.8rem' }}>
                              {Math.abs(gapQty)} sold
                            </Typography>
                            {totalPixelSales > 0 && (
                              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                                {Math.abs(pct).toFixed(1)}%
                              </Typography>
                            )}
                          </Box>
                        );
                      }

                      // 4. Standard Counts (Impressions, Clicks, Conversions)
                      if (["impressions", "clicks", "conversions"].includes(colKey)) {
                        return Math.round(num).toLocaleString();
                      }

                      // Fallback
                      const formatted = parseFloat(num.toFixed(2));
                      return String(val).endsWith("%") ? `${formatted}%` : formatted;
                    };

                    return leafColumns.map((col) => {
                      const key = col.accessorKey;

                      if (key === labelColumnKey) {
                        return (
                          <td key="total-label" className="px-4 py-2.5 text-[0.8rem] text-primary font-bold">
                            Total
                          </td>
                        );
                      }

                      const isNumeric = sums[key] !== undefined || key === "gap";

                      if (!isNumeric) {
                        return <td key={key} className="px-4 py-2.5" />;
                      }

                      const lowerKey = key.toLowerCase();
                      const isPercentage =
                        lowerKey.includes("percentage") ||
                        lowerKey.includes("percent") ||
                        lowerKey.endsWith("rate") ||
                        lowerKey === "rate" ||
                        lowerKey.includes("_rate") ||
                        lowerKey.includes("rate_");

                      let totalDisplay = typeof sums[key] === "number" ? Number(sums[key]).toFixed(2) : sums[key];

                      if (isPercentage) {
                        const findSum = (keys) => {
                          const foundKey = Object.keys(sums).find((k) => keys.includes(k.toLowerCase()));
                          return foundKey ? sums[foundKey] : 0;
                        };

                        const numerator = findSum([
                          "delivered",
                          "deliveredvalue",
                          "confirmed",
                          "returns",
                          "returnvalue"
                        ]);

                        const denominator = findSum([
                          "totalorders",
                          "totalorderesvalue",
                          "total"
                        ]);

                        if (denominator > 0) {
                          const val = (numerator / denominator) * 100;
                          const hasPctSymbol = data.some((row) => String(row[key]).includes("%"));
                          totalDisplay = hasPctSymbol ? `${val.toFixed(2)}%` : val.toFixed(2);
                        } else {
                          const numericRows = data.filter((row) => {
                            const v = row[key];
                            return v !== "" && v !== null && v !== undefined && !isNaN(Number(String(v).replace("%", "")));
                          });

                          if (numericRows.length > 0) {
                            const avg = numericRows.reduce((sum, row) => {
                              const v = Number(String(row[key]).replace("%", ""));
                              return sum + v;
                            }, 0) / numericRows.length;

                            const hasPctSymbol = data.some((row) => String(row[key]).includes("%"));
                            totalDisplay = hasPctSymbol ? `${avg.toFixed(2)}%` : avg.toFixed(2);
                          } else {
                            totalDisplay = data.some((row) => String(row[key]).includes("%")) ? "0%" : 0;
                          }
                        }
                      }

                      const alignClass = [
                        "impressions",
                        "clicks",
                        "ctr",
                        "cost",
                        "conversions",
                        "roas",
                        "adSpend",
                        "attributedRevenue",
                        "metaRevenue",
                        "metaAttributedROAS",
                        "utmRoas"
                      ].includes(key) ? "text-right" : "text-left";

                      return (
                        <td key={key} className={classnames(
                          "px-4 py-2.5 text-primary border-b border-r border-gray-200 font-bold text-[0.8rem]",
                          alignClass
                        )}>
                          {formatTotal(totalDisplay, key)}
                        </td>
                      );
                    });
                  })()}
                </tr>
              </tfoot>
            )}
          </table>
        ) : (
          !loading && (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
              No data available.
            </Typography>
          )
        )}
      </Box>

      {/* Pagination Controls */}
      {!loading && !loadingInsights && !shopifyLoading && filteredData && filteredData.length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 3, borderTop: '1px solid rgba(224, 224, 224, 1)', flexWrap: 'wrap', gap: 2 }}>
          {/* Left Side: Rows per page & Logs */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem', fontWeight: 600 }}>
                Rows per page:
              </Typography>
              <Select
                value={pagination.pageSize}
                onChange={(e) => {
                  setPagination(prev => ({ ...prev, pageSize: Number(e.target.value), pageIndex: 0 }));
                }}
                size="small"
                sx={{
                  height: 30,
                  fontSize: '0.75rem',
                  fontWeight: 650,
                  borderRadius: '6px',
                  bgcolor: 'white',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#E5E5E5'
                  }
                }}
              >
                {[10, 20, 50, 100].map(sz => (
                  <MenuItem key={sz} value={sz} sx={{ fontSize: '0.75rem', fontWeight: 600 }}>{sz}</MenuItem>
                ))}
              </Select>
            </Box>
            <Typography variant="caption" sx={{ color: '#94A3B8', fontSize: '0.75rem', fontWeight: 600, mt: 0.8, display: 'block' }}>
              Showing {table.getRowModel().rows.length > 0 ? (pagination.pageIndex * pagination.pageSize + 1) : 0} to {Math.min((pagination.pageIndex + 1) * pagination.pageSize, filteredData.length)} of {filteredData.length} entries
            </Typography>
          </Box>

          {/* Right Side: Visual Pagination Button list */}
          <Box sx={{ display: 'flex', gap: 0.8, alignItems: 'center' }}>
            {/* First Page */}
            <IconButton
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              sx={{
                minWidth: 36,
                width: 36,
                height: 36,
                p: 0,
                bgcolor: '#F8FAFC',
                borderRadius: '6px',
                border: '1px solid #E2E8F0',
                '&:hover': { bgcolor: '#F1F5F9' }
              }}
            >
              <FirstPageIcon sx={{ fontSize: '1.25rem' }} />
            </IconButton>

            {/* Previous Page */}
            <IconButton
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              sx={{
                minWidth: 36,
                width: 36,
                height: 36,
                p: 0,
                bgcolor: '#F8FAFC',
                borderRadius: '6px',
                border: '1px solid #E2E8F0',
                '&:hover': { bgcolor: '#F1F5F9' }
              }}
            >
              <NavigateBeforeIcon sx={{ fontSize: '1.25rem' }} />
            </IconButton>

            {/* Numeric Pages */}
            {visiblePages.map((item, idx) => {
              if (item === 'ellipsis') {
                return (
                  <Typography key={`ell-${idx}`} variant="caption" sx={{ px: 0.8, color: '#94A3B8', fontWeight: 700, fontSize: '0.85rem' }}>
                    ...
                  </Typography>
                );
              }

              const pageNum = item;
              const isActive = pagination.pageIndex === pageNum;
              return (
                <Button
                  key={pageNum}
                  size="small"
                  onClick={() => table.setPageIndex(pageNum)}
                  sx={{
                    minWidth: 36,
                    width: 36,
                    height: 36,
                    p: 0,
                    fontSize: '0.85rem',
                    fontWeight: 750,
                    borderRadius: '6px',
                    bgcolor: isActive ? '#10B981' : '#F8FAFC',
                    color: isActive ? 'white' : '#475569',
                    border: '1px solid',
                    borderColor: isActive ? '#10B981' : '#E2E8F0',
                    '&:hover': {
                      bgcolor: isActive ? '#10B981' : '#F1F5F9'
                    }
                  }}
                >
                  {pageNum + 1}
                </Button>
              );
            })}

            {/* Next Page */}
            <IconButton
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              sx={{
                minWidth: 36,
                width: 36,
                height: 36,
                p: 0,
                bgcolor: '#F8FAFC',
                borderRadius: '6px',
                border: '1px solid #E2E8F0',
                '&:hover': { bgcolor: '#F1F5F9' }
              }}
            >
              <NavigateNextIcon sx={{ fontSize: '1.25rem' }} />
            </IconButton>

            {/* Last Page */}
            <IconButton
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
              sx={{
                minWidth: 36,
                width: 36,
                height: 36,
                p: 0,
                bgcolor: '#F8FAFC',
                borderRadius: '6px',
                border: '1px solid #E2E8F0',
                '&:hover': { bgcolor: '#F1F5F9' }
              }}
            >
              <LastPageIcon sx={{ fontSize: '1.25rem' }} />
            </IconButton>
          </Box>
        </Box>
      )}
    </Card>
  );
}

export default MetaDynamicTable;