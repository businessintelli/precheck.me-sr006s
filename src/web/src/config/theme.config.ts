import { resolveConfig } from 'tailwindcss'; // ^3.4.0
import { UI_CONSTANTS } from '../lib/constants';

const { BREAKPOINTS, ANIMATION_DURATION } = UI_CONSTANTS;

/**
 * Theme version for configuration tracking
 */
export const THEME_VERSION = '1.0';

/**
 * Default theme mode with system preference detection
 */
export const DEFAULT_THEME = 'system';

/**
 * Media queries for system preference detection
 */
export const COLOR_SCHEME_QUERY = '(prefers-color-scheme: dark)';
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Available theme modes with system preference detection
 */
export const THEME_MODES = ['light', 'dark', 'system', 'high-contrast'] as const;
type ThemeMode = typeof THEME_MODES[number];

/**
 * Enhanced color palette following Material Design 3.0
 */
const COLOR_PALETTE = {
  primary: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9',
    600: '#0284c7',
    700: '#0369a1',
    800: '#075985',
    900: '#0c4a6e',
    950: '#082f49'
  },
  secondary: {
    50: '#f5f3ff',
    100: '#ede9fe',
    500: '#8b5cf6',
    600: '#7c3aed',
    700: '#6d28d9'
  },
  accent: {
    50: '#fff1f2',
    100: '#ffe4e6',
    500: '#f43f5e',
    600: '#e11d48',
    700: '#be123c'
  },
  neutral: {
    50: '#fafafa',
    100: '#f4f4f5',
    200: '#e4e4e7',
    300: '#d4d4d8',
    400: '#a1a1aa',
    500: '#71717a',
    600: '#52525b',
    700: '#3f3f46',
    800: '#27272a',
    900: '#18181b',
    950: '#09090b'
  },
  semantic: {
    success: '#16a34a',
    error: '#dc2626',
    warning: '#ca8a04',
    info: '#2563eb'
  }
};

/**
 * Enhanced typography scale with fluid scaling
 */
const TYPOGRAPHY_SCALE = {
  fontFamily: {
    sans: 'Inter var, ui-sans-serif, system-ui, -apple-system',
    serif: 'ui-serif, Georgia',
    mono: 'ui-monospace, SFMono-Regular'
  },
  fontSize: {
    xs: 'clamp(0.75rem, 2vw, 0.875rem)',
    sm: 'clamp(0.875rem, 2.5vw, 1rem)',
    base: 'clamp(1rem, 3vw, 1.125rem)',
    lg: 'clamp(1.125rem, 3.5vw, 1.25rem)',
    xl: 'clamp(1.25rem, 4vw, 1.5rem)',
    '2xl': 'clamp(1.5rem, 5vw, 2rem)',
    '3xl': 'clamp(1.875rem, 6vw, 2.25rem)',
    '4xl': 'clamp(2.25rem, 7vw, 3rem)'
  },
  fontWeight: {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700
  },
  lineHeight: {
    none: '1',
    tight: '1.25',
    snug: '1.375',
    normal: '1.5',
    relaxed: '1.625',
    loose: '2'
  }
};

/**
 * Comprehensive spacing scale for consistent layout
 */
const SPACING_SCALE = {
  space: {
    px: '1px',
    0: '0',
    0.5: '0.125rem',
    1: '0.25rem',
    2: '0.5rem',
    3: '0.75rem',
    4: '1rem',
    5: '1.25rem',
    6: '1.5rem',
    8: '2rem',
    10: '2.5rem',
    12: '3rem',
    16: '4rem',
    20: '5rem',
    24: '6rem',
    32: '8rem',
    40: '10rem',
    48: '12rem',
    56: '14rem',
    64: '16rem'
  }
};

/**
 * Material Design elevation system
 */
const SHADOW_SCALE = {
  elevation: {
    0: 'none',
    1: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    2: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    3: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    4: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    5: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)'
  }
};

/**
 * Comprehensive animation system with easing functions
 */
const ANIMATION_SCALE = {
  duration: {
    instant: `${ANIMATION_DURATION.instant}ms`,
    fast: `${ANIMATION_DURATION.fast}ms`,
    normal: `${ANIMATION_DURATION.normal}ms`,
    slow: `${ANIMATION_DURATION.slow}ms`,
    verySlow: `${ANIMATION_DURATION.verySlow}ms`
  },
  easing: {
    linear: 'linear',
    ease: 'cubic-bezier(0.4, 0, 0.2, 1)',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)'
  }
};

/**
 * System preference detection utility
 */
export const getSystemPreferences = () => {
  if (typeof window === 'undefined') return { isDark: false, reducedMotion: false };

  const isDark = window.matchMedia(COLOR_SCHEME_QUERY).matches;
  const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches;

  return { isDark, reducedMotion };
};

/**
 * Theme color generator with accessibility checks
 */
export const getThemeColors = (mode: ThemeMode, accessibility: { contrast: number } = { contrast: 1 }) => {
  const { isDark } = getSystemPreferences();
  const effectiveMode = mode === 'system' ? (isDark ? 'dark' : 'light') : mode;

  const colors = {
    ...COLOR_PALETTE,
    surface: effectiveMode === 'dark' ? {
      background: COLOR_PALETTE.neutral[950],
      foreground: COLOR_PALETTE.neutral[50],
      border: COLOR_PALETTE.neutral[800],
      muted: COLOR_PALETTE.neutral[800],
      hover: COLOR_PALETTE.neutral[900]
    } : {
      background: COLOR_PALETTE.neutral[50],
      foreground: COLOR_PALETTE.neutral[950],
      border: COLOR_PALETTE.neutral[200],
      muted: COLOR_PALETTE.neutral[100],
      hover: COLOR_PALETTE.neutral[100]
    }
  };

  // Apply high contrast adjustments if needed
  if (mode === 'high-contrast' || accessibility.contrast > 1) {
    return {
      ...colors,
      contrast: {
        text: 1.5,
        border: 1.3,
        background: 1.2
      }
    };
  }

  return colors;
};

/**
 * Comprehensive theme configuration object
 */
export const theme = {
  colors: getThemeColors(DEFAULT_THEME as ThemeMode),
  typography: TYPOGRAPHY_SCALE,
  spacing: SPACING_SCALE,
  breakpoints: {
    screens: {
      mobile: `${BREAKPOINTS.mobile}px`,
      tablet: `${BREAKPOINTS.tablet}px`,
      desktop: `${BREAKPOINTS.desktop}px`,
      wide: `${BREAKPOINTS.wide}px`,
      ultrawide: `${BREAKPOINTS.ultrawide}px`
    }
  },
  shadows: SHADOW_SCALE,
  animations: ANIMATION_SCALE,
  accessibility: {
    focusRing: {
      width: '2px',
      color: COLOR_PALETTE.primary[500],
      offset: '2px'
    },
    reducedMotion: {
      transform: 'none',
      transition: 'none'
    }
  }
} as const;

export default theme;