# ─── Build Stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy pre-installed node_modules from local machine (avoids npm network inside Docker)
COPY package*.json ./
COPY node_modules ./node_modules

COPY . .
ENV GENERATE_SOURCEMAP=false
RUN npm run build



# ─── Production Stage ─────────────────────────────────────────────────────────
FROM nginx:1.27-alpine

# Copy built React app
COPY --from=builder /app/build /usr/share/nginx/html

# Copy nginx config
COPY nginx/frontend.conf /etc/nginx/conf.d/default.conf

# Non-root
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

USER nginx

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s \
  CMD wget -qO- http://127.0.0.1:80 || exit 1
