import type { Config } from 'tailwindcss'; // ^3.4.0
import plugin from 'tailwindcss'; // ^3.4.0
import forms from '@tailwindcss/forms'; // ^0.5.7
import typography from '@tailwindcss/typography'; // ^0.5.10
import theme from './src/config/theme.config';

// Function to generate CSS variable with opacity value support
const withOpacity = (variableName: string) => {
  return ({ opacityValue }: { opacityValue?: number }) => {
    if (opacityValue !== undefined) {
      return `rgb(var(--${variableName}) / ${opacityValue})`;
    }
    return `rgb(var(--${variableName}))`;
  };
};

// Content paths for Tailwind processing
const CONTENT_PATHS = [
  './src/**/*.{js,ts,jsx,tsx}',
  './src/components/**/*.{js,ts,jsx,tsx}',
  './src/styles/**/*.css'
];

// Screen breakpoints following Material Design 3.0
const SCREEN_BREAKPOINTS = {
  'sm': '640px',   // Mobile
  'md': '768px',   // Tablet
  'lg': '1024px',  // Desktop
  'xl': '1280px',  // Wide Desktop
  '2xl': '1536px'  // Ultra Wide
};

const config: Config = {
  content: CONTENT_PATHS,
  darkMode: 'class',
  future: {
    hoverOnlyWhenSupported: true,
    respectDefaultRingColorOpacity: true
  },
  theme: {
    extend: {
      colors: {
        primary: {
          ...theme.colors.primary,
          DEFAULT: theme.colors.primary[500]
        },
        secondary: {
          ...theme.colors.secondary,
          DEFAULT: theme.colors.secondary[500]
        },
        accent: {
          ...theme.colors.accent,
          DEFAULT: theme.colors.accent[500]
        },
        surface: {
          ...theme.colors.surface,
          DEFAULT: withOpacity('surface-background')
        },
        semantic: theme.colors.semantic
      },
      fontFamily: theme.typography.fontFamily,
      fontSize: theme.typography.fontSize,
      fontWeight: theme.typography.fontWeight,
      lineHeight: theme.typography.lineHeight,
      screens: SCREEN_BREAKPOINTS,
      boxShadow: {
        ...theme.shadows.elevation,
        DEFAULT: theme.shadows.elevation[2]
      },
      animation: {
        'fade-in': `fade-in ${theme.animations.duration.normal} ${theme.animations.easing.easeOut}`,
        'fade-out': `fade-out ${theme.animations.duration.normal} ${theme.animations.easing.easeIn}`,
        'slide-in': `slide-in ${theme.animations.duration.normal} ${theme.animations.easing.easeOut}`,
        'slide-out': `slide-out ${theme.animations.duration.normal} ${theme.animations.easing.easeIn}`,
        'scale-in': `scale-in ${theme.animations.duration.normal} ${theme.animations.easing.easeOut}`,
        'scale-out': `scale-out ${theme.animations.duration.normal} ${theme.animations.easing.easeIn}`
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        'fade-out': {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' }
        },
        'slide-in': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' }
        },
        'slide-out': {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(100%)' }
        },
        'scale-in': {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' }
        },
        'scale-out': {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(0.95)', opacity: '0' }
        }
      },
      spacing: theme.spacing.space,
      zIndex: {
        'modal': '1000',
        'popover': '900',
        'dropdown': '800',
        'overlay': '700',
        'header': '600'
      }
    }
  },
  plugins: [
    forms({
      strategy: 'class'
    }),
    typography,
    plugin(({ addUtilities, addVariant }) => {
      // Custom utilities for Material Design elevation
      addUtilities({
        '.elevation-0': { boxShadow: theme.shadows.elevation[0] },
        '.elevation-1': { boxShadow: theme.shadows.elevation[1] },
        '.elevation-2': { boxShadow: theme.shadows.elevation[2] },
        '.elevation-3': { boxShadow: theme.shadows.elevation[3] },
        '.elevation-4': { boxShadow: theme.shadows.elevation[4] },
        '.elevation-5': { boxShadow: theme.shadows.elevation[5] }
      });

      // Custom variants for interactive states
      addVariant('hocus', ['&:hover', '&:focus']);
      addVariant('group-hocus', [':merge(.group):hover &', ':merge(.group):focus &']);
      addVariant('peer-hocus', [':merge(.peer):hover ~ &', ':merge(.peer):focus ~ &']);
    })
  ]
};

export default config;