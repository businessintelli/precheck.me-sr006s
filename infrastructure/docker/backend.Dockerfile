# Stage 1: Builder
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install build essentials and pnpm
RUN apk add --no-cache python3 make g++ curl \
    && curl -f https://get.pnpm.io/v6.js | node - add --global pnpm@8

# Copy package files with correct ownership
COPY --chown=node:node package.json pnpm-lock.yaml ./

# Install all dependencies including devDependencies
RUN pnpm install --frozen-lockfile

# Copy source code and config files
COPY --chown=node:node . .

# Run TypeScript compilation
RUN pnpm run build

# Run tests and linting
RUN pnpm run test && pnpm run lint

# Prune development dependencies
RUN pnpm prune --prod

# Stage 2: Production
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 nodeuser && \
    adduser -u 1001 -G nodeuser -s /bin/sh -D nodeuser

# Install production dependencies
RUN apk add --no-cache curl tini

# Copy built artifacts from builder
COPY --from=builder --chown=nodeuser:nodeuser /app/dist ./dist
COPY --from=builder --chown=nodeuser:nodeuser /app/node_modules ./node_modules
COPY --from=builder --chown=nodeuser:nodeuser /app/package.json ./

# Set proper file permissions
RUN chmod -R 550 /app/dist && \
    chmod -R 550 /app/node_modules && \
    chmod 550 /app/package.json

# Configure security settings
ENV NODE_ENV=production
ENV PORT=3000
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Set up health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Configure security headers
ENV NODE_TLS_REJECT_UNAUTHORIZED=1
ENV NODE_ICU_DATA=/app/node_modules/full-icu

# Create and configure required directories with proper permissions
RUN mkdir -p /app/tmp && \
    chown -R nodeuser:nodeuser /app/tmp && \
    chmod 750 /app/tmp

# Expose application port
EXPOSE 3000

# Use tini as init process
ENTRYPOINT ["/sbin/tini", "--"]

# Switch to non-root user
USER nodeuser

# Start the application
CMD ["node", "dist/server.js"]