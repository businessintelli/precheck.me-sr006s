# Precheck.me Web Frontend

A comprehensive background check and AI-powered interview platform built with Next.js 14, React, and TypeScript.

## Project Overview

Precheck.me's web frontend implements a modern, server-side rendered application providing:
- Background check initiation and management
- AI-powered interview system
- Document verification and management
- Real-time status tracking
- Enterprise-grade security and compliance features

## Prerequisites

- Node.js >= 20.0.0
- pnpm >= 8.0.0
- Docker (optional for containerized development)

## Getting Started

### Environment Setup

Copy the example environment file and configure your variables:

```bash
cp .env.example .env.local
```

Required environment variables:
```
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_API_VERSION=v1

# Authentication
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here

# External Services
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=G-XXXXXXXX
```

### Installation

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

### Docker Development

```bash
# Build development image
docker build -t precheck-web-dev -f Dockerfile.dev .

# Run development container
docker run -p 3000:3000 -v $(pwd):/app precheck-web-dev
```

## Available Scripts

- `pnpm dev` - Start development server with hot reloading
- `pnpm build` - Create optimized production build
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint code linting
- `pnpm test` - Run Jest tests with React Testing Library
- `pnpm test:e2e` - Run Playwright E2E tests
- `pnpm format` - Format code with Prettier
- `pnpm type-check` - Run TypeScript type checking
- `pnpm analyze` - Analyze bundle size

## Project Structure

```
src/
├── app/                    # Next.js 14 app directory
│   ├── (auth)/            # Authentication route group
│   ├── (dashboard)/       # Dashboard route group
│   ├── (public)/          # Public pages route group
│   └── layout.tsx         # Root layout
├── components/            # Reusable components
│   ├── ui/               # shadcn/ui components
│   ├── forms/            # Form components
│   ├── layouts/          # Layout components
│   └── shared/           # Shared components
├── hooks/                # Custom React hooks
├── lib/                  # Utility functions
├── providers/            # Context providers
├── services/            # API services
├── styles/              # Global styles
├── types/               # TypeScript types
└── utils/               # Helper functions
```

## Testing

### Unit and Integration Tests

```typescript
// Example component test
import { render, screen } from '@testing-library/react'
import { BackgroundCheckForm } from '@/components/forms'

describe('BackgroundCheckForm', () => {
  it('validates required fields', async () => {
    render(<BackgroundCheckForm />)
    // Test implementation
  })
})
```

### E2E Testing

```typescript
// Example Playwright test
import { test, expect } from '@playwright/test'

test('completes background check flow', async ({ page }) => {
  await page.goto('/dashboard/checks/new')
  // Test implementation
})
```

## Development Guidelines

### Component Structure

```typescript
// Example component structure
import { FC } from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps {
  variant?: 'primary' | 'secondary'
  className?: string
}

export const Button: FC<ButtonProps> = ({
  variant = 'primary',
  className,
  ...props
}) => {
  return (
    <button
      className={cn(
        'rounded-md px-4 py-2',
        variant === 'primary' && 'bg-primary text-white',
        variant === 'secondary' && 'bg-secondary text-primary',
        className
      )}
      {...props}
    />
  )
}
```

### API Integration

```typescript
// Example API service
import { createTRPCClient } from '@/lib/trpc'

export const backgroundCheckApi = createTRPCClient().backgroundChecks
```

## Performance Optimization

- Implement route-based code splitting
- Use Next.js Image component for optimized images
- Implement proper caching strategies
- Monitor Core Web Vitals
- Optimize third-party script loading

## Deployment

### Production Build

```bash
# Create production build
pnpm build

# Analyze bundle
pnpm analyze
```

### Docker Production

```bash
# Build production image
docker build -t precheck-web-prod -f Dockerfile .

# Run production container
docker run -p 3000:3000 precheck-web-prod
```

### Environment Configuration

Production environment requires:
- Valid SSL certificate
- Proper CORS configuration
- Production API endpoints
- Secure authentication setup
- Rate limiting configuration

## Security Considerations

- Implement CSP headers
- Configure CORS properly
- Sanitize user inputs
- Implement rate limiting
- Use secure session management
- Regular security audits
- Proper API key management

## Contributing

Please refer to our contributing guidelines and code of conduct.

## License

Copyright © 2024 Precheck.me. All rights reserved.