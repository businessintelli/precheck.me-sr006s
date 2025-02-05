# syntax=docker/dockerfile:1.4

# ===== Builder Stage =====
FROM node:23-alpine AS builder

# Set build environment variables
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PNPM_HOME=/usr/local/pnpm \
    PATH="/usr/local/pnpm:$PATH"

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    && corepack enable \
    && corepack prepare pnpm@8.x --activate

WORKDIR /build

# Copy package files with checksums
COPY --chown=node:node src/web/package.json src/web/pnpm-lock.yaml ./

# Install production dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy source code and configs
COPY --chown=node:node src/web/next.config.ts ./
COPY --chown=node:node src/web/public ./public
COPY --chown=node:node src/web/src ./src
COPY --chown=node:node src/web/tsconfig.json ./

# Generate production build
RUN pnpm build \
    && pnpm prune --prod

# ===== Runner Stage =====
FROM node:23-alpine AS runner

# Set runtime environment variables
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_OPTIONS='--max-old-space-size=4096'

# Create non-root user
RUN addgroup -g 1000 nextjs \
    && adduser -u 1000 -G nextjs -s /bin/sh -D nextjs

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache \
    wget \
    ca-certificates \
    && rm -rf /var/cache/apk/*

# Copy built application from builder stage
COPY --from=builder --chown=nextjs:nextjs /build/package.json ./
COPY --from=builder --chown=nextjs:nextjs /build/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nextjs /build/.next ./.next
COPY --from=builder --chown=nextjs:nextjs /build/public ./public
COPY --from=builder --chown=nextjs:nextjs /build/next.config.ts ./

# Set strict permissions
RUN chmod -R 550 /app \
    && chmod -R 770 /app/.next/cache \
    && chown -R nextjs:nextjs /app

# Configure volumes
VOLUME ["/app/.next/cache", "/app/node_modules"]

# Switch to non-root user
USER nextjs

# Expose application port
EXPOSE 3000

# Health check configuration
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Set resource limits
ENV NEXT_RUNTIME_MEMORY_LIMIT=4096 \
    NEXT_RUNTIME_CPU_LIMIT=2

# Set security options
LABEL org.opencontainers.image.source="https://github.com/precheck/precheck-web" \
      org.opencontainers.image.description="Precheck.me web frontend" \
      org.opencontainers.image.licenses="Private"

# Start the application
CMD ["node_modules/.bin/next", "start"]

# Enable read-only root filesystem
RUN chmod 550 /app/node_modules/.bin/next
VOLUME ["/tmp", "/run"]