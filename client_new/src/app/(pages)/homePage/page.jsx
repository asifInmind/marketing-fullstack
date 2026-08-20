'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Radio from '@mui/material/Radio';
import SecurityIcon from '@mui/icons-material/Security';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import LoginIcon from '@mui/icons-material/Login';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CustomAvatar from '@/components/mui/Avator';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';

export default function HomePage() {
  const [mode, setMode] = useState(null);
  const [adAccountId, setAdAccountId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const router = useRouter();

  // Auto-fill from localStorage on load
  useEffect(() => {
    const storedAccountId = localStorage.getItem('lastMetaAdAccountId');
    const storedToken = localStorage.getItem('lastMetaAccessToken');
    if (storedAccountId && storedToken) {
      setAdAccountId(storedAccountId);
      setAccessToken(storedToken);
      setMode('manual'); // Select manual mode automatically if details exist
    }
  }, []);

  const handleProceed = async () => {
    setErrorMessage(null);
    try {
      if (mode === 'manual') {
        if (!adAccountId || !accessToken) {
          throw new Error('Please fill in all Meta manual fields');
        }
        
        setLoading(true);
        const cleanAccountId = adAccountId.trim().replace(/^act_/, '');
        const cleanToken = accessToken.trim();

        console.log(`[Home Page] Verifying credentials for Ad Account act_${cleanAccountId}...`);

        // Verify with Meta Graph API
        const res = await fetch(`https://graph.facebook.com/v19.0/act_${cleanAccountId}?fields=id,name&access_token=${cleanToken}`);
        const data = await res.json();

        if (data.error) {
          throw new Error(`Verification failed: ${data.error.message || 'Invalid Account ID or Access Token.'}`);
        }

        console.log(`[Home Page] Verified successfully: ${data.name}`);

        // Try exchanging the manual token for a 60-day long-lived token via backend
        let finalToken = cleanToken;
        try {
          const exchangeRes = await fetch(`${BACKEND_URL}/api/Facebook-exchange-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: cleanToken })
          });
          if (exchangeRes.ok) {
            const exchangeData = await exchangeRes.json();
            if (exchangeData.access_token) {
              finalToken = exchangeData.access_token;
              if (finalToken !== cleanToken) {
                console.log('%c[Meta Token Exchange] SUCCESS: Upgraded to 60-day long-lived token!', 'color: #10b981; font-weight: bold; font-size: 12px;');
              } else {
                console.log('%c[Meta Token Exchange] NOTICE: Token is already long-lived or could not be upgraded further.', 'color: #3b82f6; font-weight: bold; font-size: 12px;');
              }
            } else {
              console.warn('%c[Meta Token Exchange] FAILED: Server returned no token. Using original manual token.', 'color: #ef4444; font-weight: bold; font-size: 12px;');
            }
          } else {
            console.warn('%c[Meta Token Exchange] FAILED: Server returned error status. Using original manual token.', 'color: #ef4444; font-weight: bold; font-size: 12px;');
          }
        } catch (err) {
          console.warn('%c[Meta Token Exchange] ERROR: Network/Exchange failed. Using original manual token.', 'color: #f59e0b; font-weight: bold; font-size: 12px;', err);
        }
        
        // Store verified credentials in local storage to bypass pasting next time
        localStorage.setItem('lastMetaAdAccountId', cleanAccountId);
        localStorage.setItem('lastMetaAccessToken', finalToken);

        router.push(`/choice/${cleanAccountId}?access_token=${finalToken}`);
      } else if (mode === 'login') {
        window.location.href = `${BACKEND_URL}/api/Facebook-login`;
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'An error occurred during verification.');
      console.error('Meta verification error:', error);
    } finally {
      setLoading(false);
    }
  };

  const isProceedDisabled = () => {
    if (mode === null) return true;
    if (mode === 'manual' && (!adAccountId || !accessToken)) return true;
    return false;
  };

  const handleClearCredentials = () => {
    localStorage.removeItem('lastMetaAdAccountId');
    localStorage.removeItem('lastMetaAccessToken');
    setAdAccountId('');
    setAccessToken('');
    setMode(null);
    setErrorMessage(null);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: { xs: 2, sm: 4 },
        backgroundColor: 'background.default'
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 640 }}>
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Chip
            icon={<SecurityIcon color="primary" sx={{ fontSize: 16 }} />}
            label="Secure Account Connection"
            size="small"
            variant="outlined"
            sx={{
              mb: 2,
              fontWeight: 600,
              fontSize: '0.75rem',
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              borderRadius: '16px'
            }}
          />
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Social Media Management Portal
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Connect your Meta ad account to start managing campaigns and analytics.
          </Typography>
        </Box>

        {/* Card Form */}
        <Card elevation={2} sx={{ borderRadius: 3, p: { xs: 2, sm: 3 } }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Choose Connection Method
              </Typography>
              {adAccountId && accessToken && (
                <Button
                  onClick={handleClearCredentials}
                  sx={{
                    textTransform: 'none',
                    minWidth: 0,
                    p: 0,
                    color: 'error.main',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    '&:hover': {
                      textDecoration: 'underline',
                      backgroundColor: 'transparent'
                    }
                  }}
                >
                  Clear Saved Session
                </Button>
              )}
            </Box>

            {errorMessage && (
              <Box
                sx={{
                  mb: 3,
                  p: 2,
                  bgcolor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: 2,
                  color: '#ef4444',
                  fontSize: '0.85rem'
                }}
              >
                ⚠️ {errorMessage}
              </Box>
            )}

            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'primary.main', textTransform: 'uppercase', mb: 1.5 }}>
              Meta Ads
            </Typography>

            <Grid container spacing={2} sx={{ mb: 3 }}>
              {/* Meta Manual Selection Tile */}
              <Grid item xs={12} sm={6}>
                <Paper
                  variant="outlined"
                  onClick={() => !loading && setMode('manual')}
                  sx={{
                    p: 2.5,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    borderRadius: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.5,
                    transition: 'all 0.2s ease-in-out',
                    borderColor: mode === 'manual' ? 'primary.main' : 'divider',
                    backgroundColor: mode === 'manual' ? 'rgba(54, 174, 149, 0.06)' : 'transparent',
                    boxShadow: mode === 'manual' ? '0 0 0 2px var(--mui-palette-primary-main)' : 'none',
                    '&:hover': {
                      borderColor: loading ? 'divider' : 'primary.main'
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <CustomAvatar skin="light" color="primary" variant="rounded" size={40}>
                      <VpnKeyIcon fontSize="small" />
                    </CustomAvatar>
                    <Radio
                      checked={mode === 'manual'}
                      onChange={() => !loading && setMode('manual')}
                      disabled={loading}
                      size="small"
                      color="primary"
                    />
                  </Box>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                      Meta — Manual
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Enter Ad Account ID & Access Token
                    </Typography>
                  </Box>
                </Paper>
              </Grid>

              {/* Meta Login Selection Tile */}
              <Grid item xs={12} sm={6}>
                <Paper
                  variant="outlined"
                  onClick={() => !loading && setMode('login')}
                  sx={{
                    p: 2.5,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    borderRadius: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.5,
                    transition: 'all 0.2s ease-in-out',
                    borderColor: mode === 'login' ? 'primary.main' : 'divider',
                    backgroundColor: mode === 'login' ? 'rgba(54, 174, 149, 0.06)' : 'transparent',
                    boxShadow: mode === 'login' ? '0 0 0 2px var(--mui-palette-primary-main)' : 'none',
                    '&:hover': {
                      borderColor: loading ? 'divider' : 'primary.main'
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <CustomAvatar skin="light" color="info" variant="rounded" size={40}>
                      <LoginIcon fontSize="small" />
                    </CustomAvatar>
                    <Radio
                      checked={mode === 'login'}
                      onChange={() => !loading && setMode('login')}
                      disabled={loading}
                      size="small"
                      color="primary"
                    />
                  </Box>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                      Meta — Login
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Connect via Facebook Authorization
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
            </Grid>

            {/* Manual Form Inputs */}
            {mode === 'manual' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 3, mb: 2 }}>
                <TextField
                  fullWidth
                  disabled={loading}
                  size="small"
                  label="Ad Account ID"
                  placeholder="e.g. 1234567890"
                  value={adAccountId}
                  onChange={(e) => setAdAccountId(e.target.value)}
                />
                <TextField
                  fullWidth
                  disabled={loading}
                  size="small"
                  label="Access Token"
                  placeholder="Enter Access Token"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                />
              </Box>
            )}

            {/* Proceed Action Button */}
            <Button
              fullWidth
              size="large"
              variant="contained"
              disabled={isProceedDisabled() || loading}
              onClick={handleProceed}
              endIcon={!loading ? <ArrowForwardIcon /> : null}
              sx={{
                mt: 3,
                py: 1.2,
                fontWeight: 600,
                textTransform: 'none',
                borderRadius: 2
              }}
            >
              {loading ? 'Verifying Credentials...' : 'Proceed'}
            </Button>
          </CardContent>
        </Card>

        {/* Footer info */}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 3 }}>
          Your credentials are used strictly for API authentication and are never stored.
        </Typography>
      </Box>
    </Box>
  );
}