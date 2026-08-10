import { Router } from 'express';
import { 
  fetchCompleteDashboard, 
  fetchDashboardInsightsOnly, 
  loadMoreCampaigns, 
  loadMoreAdSets, 
  loadMoreAds 
} from '../lib/metaApi.js';

const router = Router();

// GET /api/meta
router.get('/', async (req, res) => {
  try {
    let accessToken = req.query.access_token;
    
    // Check Authorization header for Bearer token
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7).trim();
    }

    const accountId = req.query.account_id;
    const datePreset = req.query.date_preset || 'last_30d';
    const since = req.query.since || undefined;
    const until = req.query.until || undefined;
    const pageSize = parseInt(req.query.page_size || '10', 10);
    const type = req.query.type || 'all';

    if (!accessToken) {
      return res.status(400).json({ error: 'Missing access_token parameter' });
    }

    if (!accountId) {
      return res.status(400).json({ error: 'Missing account_id parameter' });
    }

    const config = {
      accessToken,
      accountId,
      dateRange: {
        preset: datePreset,
        since,
        until,
      },
      pageSize,
    };

    let data;
    if (type === 'structure') {
      data = await fetchCompleteDashboard(config, pageSize, false);
    } else if (type === 'insights') {
      data = await fetchDashboardInsightsOnly(config);
    } else {
      data = await fetchCompleteDashboard(config, pageSize, true);
    }

    return res.json({
      success: true,
      data: data,
    });
  } catch (error) {
    console.error('Meta API Route Error:', error);
    const statusCode = (error?.code === 4 || error?.code === 17) ? 429 : 500;
    return res.status(statusCode).json({
      success: false,
      error: error?.message || 'Failed to fetch Meta dashboard data',
      code: error?.code || 'UNKNOWN_ERROR',
    });
  }
});

// POST /api/meta
router.post('/', async (req, res) => {
  try {
    const { 
      accessToken, 
      accountId, 
      type, 
      after, 
      datePreset = 'last_30d',
      pageSize = 100 
    } = req.body;

    if (!accessToken || !accountId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const config = {
      accessToken,
      accountId,
      dateRange: { preset: datePreset },
      pageSize,
    };

    let result;
    switch (type) {
      case 'campaigns':
        result = await loadMoreCampaigns(config, after, pageSize);
        break;
      case 'adSets':
        result = await loadMoreAdSets(config, after, pageSize);
        break;
      case 'ads':
        result = await loadMoreAds(config, after, pageSize);
        break;
      case 'creatives':
        const { ads } = req.body;
        if (!ads) {
          return res.status(400).json({ error: 'Missing ads parameters for loading creatives' });
        }
        const { loadCreativesForAds } = await import('../lib/metaApi.js');
        result = await loadCreativesForAds(ads, config);
        break;
      default:
        return res.status(400).json({ error: 'Invalid type. Must be campaigns, adSets, ads, or creatives' });
    }

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Meta API Load More Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to load more data',
    });
  }
});

export default router;
