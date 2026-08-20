'use client';
'use client';
import { createTheme } from '@mui/material/styles';
import defaultCoreTheme from './@core/theme';

// Generates the theme object using overrides, custom colors, and settings
const coreThemeOptions = defaultCoreTheme({ skin: 'default' }, 'light', 'ltr');

// Create theme with CSS Variables support
const theme = createTheme({
  ...coreThemeOptions,
  defaultColorScheme: 'light',
  cssVariables: {
    colorSchemeSelector: 'data'
  }
});

export default theme;
