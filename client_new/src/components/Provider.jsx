'use client';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from '@/theme';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';

// Create custom Emotion cache with compat mode enabled to disable unsafe pseudo-class warning logs during SSR
const cache = createCache({
  key: 'css',
  compat: true,
});

export default function Providers({ children }) {
  return (
    <CacheProvider value={cache}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </CacheProvider>
  );
}