const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
};

const radius = {
  sm: 8,
  md: 14,
  lg: 20,
};

const shadow = {
  card: {
    shadowColor: '#0C1B33',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
};

export const lightColors = {
  primary: '#0066CC',
  secondary: '#0066CC',
  background: '#F7F8FB',
  card: '#FFFFFF',
  text: '#0E141B',
  muted: '#7A869A',
  accent: '#F2A365',
  border: 'rgba(12,27,51,0.12)',
  divider: 'rgba(12,27,51,0.08)',
  danger: '#d64545',
  switchTrackOff: '#d1d5db',
  surfaceMuted: 'rgba(12,27,51,0.08)',
};

export const darkColors = {
  primary: '#0066CC',
  secondary: '#0066CC',
  background: '#0F141C',
  card: '#1A2230',
  text: '#F3F6FC',
  muted: '#A7B2C5',
  accent: '#F2A365',
  border: 'rgba(243,246,252,0.18)',
  divider: 'rgba(243,246,252,0.12)',
  danger: '#ff6b6b',
  switchTrackOff: '#4a5568',
  surfaceMuted: 'rgba(243,246,252,0.12)',
};

const withTheme = (colors, shadowOverride = null) => ({
  colors,
  spacing,
  radius,
  shadow: {
    ...shadow,
    ...(shadowOverride || {}),
  },
});

export const lightTheme = withTheme(lightColors);
export const darkTheme = withTheme(darkColors, {
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.24,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
});

export const getThemeByMode = (mode) => (mode === 'dark' ? darkTheme : lightTheme);

export default lightTheme;
