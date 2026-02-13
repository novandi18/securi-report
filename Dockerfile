# ──────────────────────────────────────────────────────────
#  Securi Report — Multi-stage Production Dockerfile
#  Node 22 Alpine · Next.js Standalone Output
# ──────────────────────────────────────────────────────────

# ─── Stage 1: Install dependencies ───────────────────────
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# ─── Stage 2: Build the application ─────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Drizzle migrations are baked into the image
# Env vars are provided at runtime via docker-compose
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Dummy build-time env vars so Next.js page collection succeeds.
# These are NEVER used at runtime — real values come from docker-compose / .env.
ENV DATABASE_URL="mysql://build:build@localhost:3306/build"
ENV AUTH_SECRET="build-placeholder"
ENV MEILISEARCH_HOST="http://localhost:7700"
ENV MEILISEARCH_ADMIN_KEY="build-placeholder"
ENV NEXT_PUBLIC_MEILISEARCH_HOST="http://localhost:7700"
ENV NEXT_PUBLIC_MEILISEARCH_SEARCH_KEY="build-placeholder"

RUN npm run build

# Clear dummy values so they don't leak into the runner stage
ENV DATABASE_URL=""
ENV AUTH_SECRET=""
ENV MEILISEARCH_HOST=""
ENV MEILISEARCH_ADMIN_KEY=""
ENV NEXT_PUBLIC_MEILISEARCH_HOST=""
ENV NEXT_PUBLIC_MEILISEARCH_SEARCH_KEY=""

# ─── Stage 3: Production runner ─────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy only what's needed for standalone mode
COPY --from=builder /app/public ./public
COPY --from=builder /app/drizzle ./drizzle

# Standalone output — Next.js bundles only required files
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Create writable directories for runtime uploads & deliverables
RUN mkdir -p public/uploads/reports public/deliverables && \
    chown -R nextjs:nodejs public/uploads public/deliverables

# Install Puppeteer dependencies for PDF generation
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["node", "server.js"]
