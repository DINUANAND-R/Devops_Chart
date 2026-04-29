# ─────────────────────────────────────────────────────────────────────────────
# NexChat Frontend — Multi-Stage Dockerfile
# Stage 1: builder  — node:alpine compiles the React SPA
# Stage 2: release  — nginx:alpine serves the static build
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: build React app ──────────────────────────────────────────────────
FROM node:20-alpine AS builder

ARG BUILD_DATE
ARG GIT_COMMIT
ARG REACT_APP_API_URL
ARG REACT_APP_SOCKET_URL

WORKDIR /app

# Cache dependencies separately from source
COPY package.json package-lock.json ./
RUN npm ci --prefer-offline && npm cache clean --force

# Copy source and build
COPY . .
RUN npm run build

# ── Stage 2: serve with Nginx ─────────────────────────────────────────────────
FROM nginx:1.27-alpine AS release

LABEL org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${GIT_COMMIT}" \
      org.opencontainers.image.title="nexchat-frontend"

# Copy built React SPA
COPY --from=builder /app/build /usr/share/nginx/html

# Custom nginx config for SPA — handles React Router (try_files)
COPY nginx/spa.conf /etc/nginx/conf.d/default.conf

# Remove default nginx config
RUN rm -f /etc/nginx/conf.d/default.conf.bak && \
    # Validate nginx config
    nginx -t

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:80 || exit 1

CMD ["nginx", "-g", "daemon off;"]