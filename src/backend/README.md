# Precheck.me Backend Service

## Overview

Precheck.me backend service is a comprehensive background verification system built with Node.js, providing AI-powered interviews, document processing, and real-time status tracking capabilities.

### Core Features
- Background verification processing
- AI-powered interview system
- Document verification and storage
- Real-time status tracking
- HRIS integration
- Compliance reporting
- Payment processing

## Technology Stack

- **Runtime**: Node.js 20.x LTS
- **Language**: TypeScript 5.2+
- **Database**: PostgreSQL 15.x
- **Cache**: Redis 7.x
- **Container**: Docker
- **Package Manager**: pnpm 8.x
- **Testing**: Jest
- **API Documentation**: OpenAPI 3.0

## Prerequisites

- Node.js 20.x LTS
- pnpm 8.x (`npm install -g pnpm`)
- Docker Desktop
- PostgreSQL 15.x
- Redis 7.x
- VS Code (recommended)

## Development Setup

### 1. Clone and Install

```bash
# Clone repository
git clone https://github.com/your-org/precheck-me.git
cd precheck-me/backend

# Install dependencies
pnpm install
```

### 2. Environment Configuration

Copy the environment template:

```bash
cp .env.example .env
```

Required environment variables:

```env
# Server
PORT=3000
NODE_ENV=development
API_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/precheck
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=24h

# External Services
OPENAI_API_KEY=your-openai-key
STRIPE_SECRET_KEY=your-stripe-key
SMTP_HOST=smtp.example.com
```

### 3. Database Setup

```bash
# Start PostgreSQL and Redis containers
docker-compose up -d

# Run migrations
pnpm db:migrate

# Seed initial data
pnpm db:seed
```

### 4. Start Development Server

```bash
# Start in development mode
pnpm dev

# Start with debugging enabled
pnpm dev:debug
```

## Development Tools

### VS Code Configuration

Recommended extensions:
- ESLint
- Prettier
- Docker
- PostgreSQL
- Thunder Client

Workspace settings (.vscode/settings.json):
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

### Git Hooks

Pre-commit hooks are configured using husky:
- Lint staged files
- Run type checking
- Run unit tests

## API Documentation

### Authentication

The API uses JWT for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <token>
```

OAuth 2.0 flows are supported for third-party integration.

### Rate Limiting

- 1000 requests per hour per client
- Rate limit headers included in responses:
  - X-RateLimit-Limit
  - X-RateLimit-Remaining
  - X-RateLimit-Reset

### API Endpoints

Full OpenAPI documentation available at `/api/docs`

#### Background Checks

```
POST   /api/v1/checks           # Create new check
GET    /api/v1/checks          # List checks
GET    /api/v1/checks/:id      # Get check details
PATCH  /api/v1/checks/:id      # Update check
DELETE /api/v1/checks/:id      # Delete check
```

#### Interviews

```
POST   /api/v1/interviews      # Schedule interview
GET    /api/v1/interviews     # List interviews
GET    /api/v1/interviews/:id # Get interview details
PATCH  /api/v1/interviews/:id # Update interview
```

#### Documents

```
POST   /api/v1/documents      # Upload document
GET    /api/v1/documents     # List documents
GET    /api/v1/documents/:id # Get document
DELETE /api/v1/documents/:id # Delete document
```

## Testing

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run specific test file
pnpm test path/to/test

# Run tests in watch mode
pnpm test:watch
```

## Docker Support

Development environment:
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

Production build:
```bash
# Build production image
docker build -t precheck-backend .

# Run container
docker run -p 3000:3000 precheck-backend
```

## Deployment

The service is deployed using AWS ECS with the following configuration:

- Multiple containers per task
- Auto-scaling based on CPU/Memory
- Health checks on `/health` endpoint
- Blue/green deployment strategy

## Contributing

1. Branch naming convention:
   - feature/feature-name
   - fix/bug-name
   - chore/task-name

2. Commit message format:
   ```
   type(scope): description
   
   [optional body]
   [optional footer]
   ```

3. Pull request process:
   - Create feature branch
   - Implement changes
   - Add tests
   - Update documentation
   - Create pull request
   - Pass CI checks
   - Get code review
   - Merge to main

## License

Copyright (c) 2024 Precheck.me. All rights reserved.