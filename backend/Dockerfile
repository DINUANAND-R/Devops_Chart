# Build stage
FROM node:20-alpine AS base

WORKDIR /app

# Copy pre-installed production node_modules (avoids npm network inside Docker)
COPY package*.json ./
COPY node_modules ./node_modules

# Copy source
COPY src/ ./src/

# Create uploads dir
RUN mkdir -p uploads logs

# Production image
FROM node:20-alpine

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY --from=base --chown=appuser:appgroup /app /app

USER appuser

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5000/health || exit 1

CMD ["node", "src/index.js"]
