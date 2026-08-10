import { Router } from 'express';
import { API_CONSTANTS } from '../lib/apiConstants.js';

const router = Router();

// Facebook OAuth Login Endpoint
router.get('/Facebook-login', (req, res) => {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const frontendUrl = process.env.FRONTEND_URL || `${protocol}://${host}`;
  
  const redirectUri = `${frontendUrl}/api/Facebook-callback`;
  const appId = process.env.FB_APP_ID;
  const scope = 'ads_management,ads_read,business_management,pages_read_engagement';

  const loginUrl = API_CONSTANTS.meta.auth.login(appId, redirectUri, scope);

  console.log(`[Auth Route] Redirecting to Facebook Login URI: ${loginUrl}`);
  res.redirect(loginUrl);
});

// Facebook OAuth Callback Endpoint
router.get('/Facebook-callback', async (req, res) => {
  const code = req.query.code;

  if (!code) {
    return res.status(400).json({ error: "No code provided" });
  }

  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const frontendUrl = process.env.FRONTEND_URL || `${protocol}://${host}`;

  const redirectUri = `${frontendUrl}/api/Facebook-callback`;

  try {
    console.log(`[Auth Route] Exchanging OAuth code for token...`);
    const tokenRes = await fetch(
      `${API_CONSTANTS.meta.auth.tokenExchange}?` +
      new URLSearchParams({
        client_id: process.env.FB_APP_ID,
        client_secret: process.env.FB_APP_SECRET,
        redirect_uri: redirectUri,
        code,
      })
    );

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      console.error(`[Auth Route] Error exchanging token:`, tokenData);
      return res.status(500).json({ error: "Failed to get access token", details: tokenData });
    }

    let finalToken = accessToken;
    try {
      const longLivedTokenRes = await fetch(
        `${API_CONSTANTS.meta.auth.tokenExchange}?` +
        new URLSearchParams({
          grant_type: 'fb_exchange_token',
          client_id: process.env.FB_APP_ID,
          client_secret: process.env.FB_APP_SECRET,
          fb_exchange_token: accessToken,
        })
      );
      const longLivedTokenData = await longLivedTokenRes.json();
      if (longLivedTokenData.access_token) {
        finalToken = longLivedTokenData.access_token;
      }
    } catch (err) {
      console.error('Failed to exchange for long-lived Meta token, using short-lived fallback:', err);
    }

    const adAccountsRes = await fetch(
      `${API_CONSTANTS.meta.auth.adAccounts}?access_token=${finalToken}`
    );
    const adAccountsData = await adAccountsRes.json();

    const firstAccountId = adAccountsData?.data?.[0]?.id;

    if (!firstAccountId) {
      return res.status(404).json({ error: "No ad accounts found" });
    }

    const targetUrl = `${frontendUrl}/choice?act_id=${firstAccountId.replace('act_', '')}&access_token=${finalToken}`;
    console.log(`[Auth Route] Login successful. Redirecting back to frontend: ${targetUrl}`);
    res.redirect(targetUrl);
  } catch (error) {
    console.error('Facebook OAuth Callback Error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// POST /api/Facebook-exchange-token
router.post('/Facebook-exchange-token', async (req, res) => {
  const { access_token } = req.body;
  if (!access_token) {
    return res.status(400).json({ error: "Missing access_token parameter" });
  }

  try {
    console.log(`[Auth Route] Exchanging manual token for long-lived 60-day token...`);
    const longLivedTokenRes = await fetch(
      `${API_CONSTANTS.meta.auth.tokenExchange}?` +
      new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: process.env.FB_APP_ID,
        client_secret: process.env.FB_APP_SECRET,
        fb_exchange_token: access_token,
      })
    );
    const longLivedTokenData = await longLivedTokenRes.json();
    
    if (longLivedTokenData.access_token) {
      console.log(`[Auth Route] Successfully exchanged manual token.`);
      return res.json({ access_token: longLivedTokenData.access_token });
    }
    
    console.warn(`[Auth Route] Token exchange failed. Returning original token. Details:`, longLivedTokenData);
    return res.json({ access_token });
  } catch (err) {
    console.error('[Auth Route] Failed to exchange manual token:', err);
    return res.json({ access_token });
  }
});

export default router;
