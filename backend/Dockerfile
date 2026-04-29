# ─────────────────────────────────────────────────────────────────────────────
# NexChat Backend — Multi-Stage Production Dockerfile
# Stage 1: deps     — install prod dependencies only
# Stage 2: build    — no-op for Node (reserved for future transpile/bundle)
# Stage 3: release  — minimal final image, non-root user
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: dependency install ───────────────────────────────────────────────
FROM node:20-alpine AS deps

# Security: install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

WORKDIR /app

# Copy lockfiles first — leverage Docker layer caching
COPY package.json package-lock.json ./

# Install ONLY production dependencies
RUN npm ci --omit=dev --prefer-offline && npm cache clean --force

# ── Stage 2: release image ────────────────────────────────────────────────────
FROM node:20-alpine AS release

# Build metadata labels
ARG BUILD_DATE
ARG GIT_COMMIT
LABEL org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${GIT_COMMIT}" \
      org.opencontainers.image.title="nexchat-backend" \
      org.opencontainers.image.description="NexChat real-time chat backend"

# dumb-init from deps stage
COPY --from=deps /usr/bin/dumb-init /usr/bin/dumb-init

WORKDIR /app

# Copy node_modules from deps (avoids reinstalling)
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY src ./src
COPY package.json ./

# Create required directories and set permissions
RUN mkdir -p uploads logs && \
    chown -R node:node /app

# Switch to non-root user (built into node:alpine)
USER node

EXPOSE 5000

# Health check — uses the /health endpoint already in index.js
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT:-5000}/health || exit 1

# Use dumb-init to handle PID 1 and signal forwarding properly
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "src/index.js"]