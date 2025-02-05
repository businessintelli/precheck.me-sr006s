import type { Config } from '@jest/types';

// Jest configuration for backend Node.js application
// @version jest: 29.x
// @version ts-jest: 29.x
// @version jest-watch-typeahead: 2.x
const jestConfig: Config.InitialOptions = {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',

  // Set Node.js as the test environment
  testEnvironment: 'node',

  // Define test file locations
  roots: ['<rootDir>/src'],

  // Test file patterns to match
  testMatch: [
    '**/*.spec.ts',
    '**/*.test.ts',
    '**/__tests__/**/*.ts'
  ],

  // Files to collect coverage from
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.test.ts',
    '!src/types/**/*',
    '!src/database/migrations/**/*',
    '!src/tests/**/*',
    '!src/config/**/*',
    '!src/**/__mocks__/**/*'
  ],

  // Coverage thresholds to maintain code quality
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Module path mappings for import resolution
  moduleNameMapper: {
    '@/(.*)': '<rootDir>/src/$1',
    '@tests/(.*)': '<rootDir>/src/tests/$1',
    '@config/(.*)': '<rootDir>/src/config/$1'
  },

  // Supported file extensions
  moduleFileExtensions: [
    'ts',
    'js',
    'json',
    'node'
  ],

  // TypeScript transformation configuration
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json'
      }
    ]
  },

  // Test setup files
  setupFilesAfterEnv: [
    '<rootDir>/src/tests/setup.ts',
    '<rootDir>/src/tests/globalSetup.ts'
  ],

  // Test execution configuration
  clearMocks: true,
  testTimeout: 10000,
  verbose: true,
  maxWorkers: '50%',
  errorOnDeprecated: true,
  detectOpenHandles: true,
  forceExit: true,

  // Paths to ignore during testing
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/'
  ],

  // Coverage report formats
  coverageReporters: [
    'text',
    'html',
    'lcov',
    'json'
  ],

  // Watch mode plugins for development
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ]
};

export default jestConfig;