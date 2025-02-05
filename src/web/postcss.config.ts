import type { Config } from 'postcss'; // ^8.4.0
import { content, theme } from './tailwind.config';

/**
 * PostCSS configuration for processing CSS with advanced optimization plugins
 * Supports Material Design 3.0, shadcn/ui, and responsive design requirements
 */
const config: Config = {
  plugins: [
    // Primary CSS processor for utility-first styling
    'tailwindcss',

    // Modern browser compatibility
    ['autoprefixer', {
      flexbox: 'no-2009',
      grid: 'autoplace'
    }],

    // Advanced CSS nesting support
    ['postcss-nesting', {
      strict: true
    }],

    // Modern CSS features and optimizations
    ['postcss-preset-env', {
      stage: 3,
      features: {
        'nesting-rules': true,
        'custom-properties': true,
        'custom-media-queries': true,
        'media-query-ranges': true,
        'custom-selectors': true,
        'gap-properties': true,
        'logical-properties-and-values': true,
        'color-functional-notation': true
      },
      autoprefixer: {
        grid: true
      },
      preserve: false
    }],

    // Production optimizations
    ...(process.env.NODE_ENV === 'production' ? [
      // CSS size optimization
      ['cssnano', {
        preset: ['advanced', {
          discardComments: {
            removeAll: true
          },
          reduceIdents: false,
          zindex: false
        }]
      }],

      // Media query optimization
      ['postcss-sort-media-queries', {
        sort: 'mobile-first'
      }],

      // Custom property optimization
      ['postcss-custom-properties', {
        preserve: false
      }]
    ] : [])
  ],

  // Source map generation for development
  sourceMap: process.env.NODE_ENV !== 'production',

  // Parser options for advanced syntax
  parser: 'postcss-scss',

  // Custom syntax support
  syntax: 'postcss-scss'
};

export default config;