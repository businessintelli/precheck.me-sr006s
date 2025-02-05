# Precheck.me Platform

[![Build Status](https://github.com/precheck-me/platform/workflows/CI/badge.svg)](https://github.com/precheck-me/platform/actions)
[![Test Coverage](https://codecov.io/gh/precheck-me/platform/branch/main/graph/badge.svg)](https://codecov.io/gh/precheck-me/platform)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/github/package-json/v/precheck-me/platform)](package.json)

AI-powered background check and interview automation system that revolutionizes hiring processes through advanced verification capabilities and intelligent candidate screening.

## Features

- 🔍 Automated background verification system with real-time processing
- 🤖 AI-powered interview platform with natural language processing
- 📊 Real-time status tracking and comprehensive analytics
- 📄 Secure document verification and storage
- 👥 Multi-tenant architecture with role-based access control
- 📈 Advanced reporting and compliance management

## Architecture

The platform is built using modern, scalable technologies:

- **Frontend**: Next.js 14 with TypeScript and shadcn/ui
- **Backend**: Node.js services with tRPC
- **Database**: PostgreSQL 15 for transactional data
- **Caching**: Redis 7 for session and data caching
- **Storage**: S3-compatible storage for documents
- **AI/ML**: Custom ML models and OpenAI integration

## Prerequisites

Before you begin, ensure you have the following installed:

- Node.js >= 20.0.0
- pnpm >= 8.0.0
- Docker >= 24.0.0
- PostgreSQL >= 15.0
- Redis >= 7.0

## Quick Start

### Development Setup

1. Clone the repository:
```bash
git clone https://github.com/precheck-me/platform.git
cd platform
```

2. Install dependencies:
```bash
pnpm install
```

3. Configure environment:
```bash
cp .env.example .env.local
# Edit .env.local with your configuration
```

4. Start development servers:
```bash
pnpm dev
```

### Production Deployment

1. Configure infrastructure:
```bash
cd infrastructure/terraform
terraform init
terraform apply
```

2. Set environment variables:
```bash
# Configure production environment variables
cp .env.example .env.production
# Edit .env.production with production values
```

3. Deploy services:
```bash
pnpm deploy
```

4. Verify deployment:
```bash
pnpm test:e2e
```

## Project Structure

```
precheck-me/
├── src/
│   ├── backend/         # Node.js backend services
│   └── web/            # Next.js frontend application
├── infrastructure/
│   ├── terraform/      # Infrastructure as Code
│   ├── kubernetes/     # Container orchestration
│   └── docker/         # Container definitions
└── docs/              # Project documentation
```

## Documentation

- [Backend API Documentation](./src/backend/README.md)
- [Frontend Component Documentation](./src/web/README.md)
- [Contributing Guidelines](./CONTRIBUTING.md)
- [Security Guidelines](./docs/SECURITY.md)
- [Infrastructure Setup](./docs/INFRASTRUCTURE.md)

## Development

### Code Style

The project uses ESLint and Prettier for code formatting. Run linting:

```bash
pnpm lint
```

### Testing

Run the test suite:

```bash
pnpm test        # Unit tests
pnpm test:e2e    # End-to-end tests
pnpm test:coverage # Coverage report
```

### Database Migrations

Manage database schema:

```bash
pnpm db:migrate  # Run migrations
pnpm db:rollback # Rollback last migration
pnpm db:seed     # Seed test data
```

## Contributing

Please read our [Contributing Guidelines](./CONTRIBUTING.md) before submitting pull requests.

## Security

For security concerns, please review our [Security Policy](./docs/SECURITY.md).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions:
- 📧 Email: support@precheck.me
- 💬 Discord: [Join our community](https://discord.gg/precheck-me)
- 📚 Documentation: [docs.precheck.me](https://docs.precheck.me)

---

Built with ❤️ by the Precheck.me team