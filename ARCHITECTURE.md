# NexChat — Project Architecture & DevOps Workflow

> **Author:** DINUANAND-R  
> **Repo:** https://github.com/DINUANAND-R/Devops_Chart  
> **Stack:** React · Node.js · MongoDB · Redis · Docker · Kubernetes · Jenkins · Prometheus · Grafana

---

## 1. What is NexChat?

NexChat is a **real-time group chat application** built as a full-stack web project. Users can register, log in, create or join chat rooms, send messages with file/media attachments, receive real-time notifications, and see presence indicators (online/offline).

The project is designed as a **production-grade DevOps showcase**, demonstrating:
- Containerized microservice-style backend
- Automated CI/CD with Jenkins
- Container orchestration with Kubernetes
- Full observability with Prometheus + Grafana

---

## 2. Application Architecture

### 2.1 High-Level Component Map

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER (Browser)                              │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ HTTP / WebSocket
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Nginx (Reverse Proxy)                           │
│  Port 80/443  ·  Routes: /api → Backend · /socket.io → Backend     │
│               ·          /     → Frontend SPA                       │
└──────────────┬──────────────────────────────────┬───────────────────┘
               │                                  │
               ▼                                  ▼
┌──────────────────────────┐          ┌───────────────────────────────┐
│   React Frontend         │          │   Node.js Backend             │
│   (Nginx SPA container)  │          │   Express · Socket.IO         │
│   Port 80 (internal)     │          │   Port 5000 (internal)        │
│                          │          │                               │
│  Pages:                  │          │  Services:                    │
│  • LoginPage             │          │  • auth-service               │
│  • RegisterPage          │          │  • user-service               │
│  • ChatPage              │          │  • chat-service               │
│                          │          │  • message-service            │
│  Components:             │          │  • media-service              │
│  • Sidebar               │          │  • notification-service       │
│  • ChatWindow            │          │                               │
│  • MessageInput          │          │  Middleware:                  │
│  • ChatListItem          │          │  • JWT Auth                   │
│                          │          │  • Rate Limiter               │
│  Context/Hooks:          │          │  • Error Handler              │
│  • ChatContext           │          │  • Helmet (security headers)  │
│  • useMessages           │          │  • CORS                       │
│  • useSocket             │          │                               │
│  • usePresence           │          │  Endpoints:                   │
└──────────────────────────┘          │  • /api/auth/*                │
                                      │  • /api/users/*               │
                                      │  • /api/chats/*               │
                                      │  • /api/messages/*            │
                                      │  • /api/media/*               │
                                      │  • /health                    │
                                      │  • /metrics  (Prometheus)     │
                                      └──────────┬──────────┬─────────┘
                                                 │          │
                                    ┌────────────┘          └──────────┐
                                    ▼                                  ▼
                         ┌─────────────────┐               ┌─────────────────┐
                         │   MongoDB 7     │               │   Redis 7       │
                         │   Port 27017    │               │   Port 6379     │
                         │                │               │                 │
                         │  Collections:  │               │  Used for:      │
                         │  • users       │               │  • Sessions     │
                         │  • chats       │               │  • Pub/Sub      │
                         │  • messages    │               │  • Rate limits  │
                         │  • media       │               │  • Caching      │
                         └─────────────────┘               └─────────────────┘
```

### 2.2 Backend Service Breakdown

The backend follows a **service-oriented architecture** — all services share one Node.js process but are logically separated into modules:

| Service | Responsibility |
|---|---|
| **auth-service** | Register, Login, Logout, JWT access + refresh token rotation |
| **user-service** | Profile management, avatar, presence (online/offline) |
| **chat-service** | Create/join chat rooms, list chats, manage members |
| **message-service** | Send, receive, paginate messages |
| **media-service** | Upload/serve images, videos, files (stored in `/app/uploads`) |
| **notification-service** | Real-time push notifications via Socket.IO |

### 2.3 Real-Time Communication (Socket.IO)

```
Client ──── WebSocket ──── Socket.IO Server
                              │
                              ├── presenceHandlers.js   (online/offline events)
                              └── chatHandlers.js        (message send/receive/typing)
```

- Clients join Socket.IO rooms by chat ID
- Presence state is stored in Redis so it persists across connections
- Messages are saved to MongoDB then broadcast to all room members

### 2.4 Frontend Architecture

```
src/
├── App.js                   # Route definitions (React Router v6)
├── pages/
│   ├── LoginPage.js         # Auth form → POST /api/auth/login
│   ├── RegisterPage.js      # Auth form → POST /api/auth/register
│   └── ChatPage.js          # Main app shell (sidebar + chat window)
├── components/
│   ├── Sidebar/             # Chat list, search, user profile
│   └── ChatWindow/          # Message thread, MessageInput, emoji picker
├── context/
│   └── ChatContext.js       # Global state: current chat, socket, user
├── hooks/
│   ├── useMessages.js       # Fetch + cache message history
│   ├── useSocket.js         # Socket.IO connection lifecycle
│   └── usePresence.js       # Track who is online
└── services/
    └── api.js               # Axios instance with base URL + interceptors
```

---

## 3. DevOps Architecture

### 3.1 Environments

| Environment | How to Run | Access |
|---|---|---|
| **Development** | `docker compose -f docker-compose.dev.yml up` | localhost:3000 (React dev server) |
| **Local Production** | `docker compose -f docker-compose.yml up` | http://localhost |
| **Kubernetes (Docker Desktop)** | `kubectl apply -f k8s/` | http://localhost:30008 |

---

## 4. CI/CD Pipeline (Jenkins)

**Jenkins runs as a Docker container** on port `http://localhost:8090`.

### 4.1 Pipeline Trigger Flow

```
Developer pushes code to GitHub (main branch)
         │
         ▼
   GitHub Webhook
         │
         ▼
  Jenkins (nexchat-jenkins container)
         │
         ├── reads Jenkinsfile from repo
         └── executes 7-stage pipeline
```

### 4.2 The 7-Stage Pipeline

```
┌─────────────┐
│  1. CHECKOUT │  Clone repo, extract short SHA + branch name
└──────┬──────┘
       │
┌──────▼──────────────────────────────┐
│  2. INSTALL & LINT (parallel)        │
│  Backend  ──► docker run node:20-alpine npm ci + ESLint  │
│  Frontend ──► docker run node:20-alpine npm ci + ESLint  │
└──────┬──────────────────────────────┘
       │
┌──────▼──────────────────────────────┐
│  3. TEST (parallel)                  │
│  Backend  ──► Jest (--passWithNoTests, --forceExit)      │
│  Frontend ──► react-scripts test (--watchAll=false)      │
└──────┬──────────────────────────────┘
       │
┌──────▼──────────────────────────────┐
│  4. BUILD DOCKER IMAGES (parallel)   │
│  backend/Dockerfile ──► nexchat-backend:<sha>            │
│  frontend/Dockerfile ──► nexchat-frontend:<sha>          │
└──────┬──────────────────────────────┘
       │
┌──────▼──────────────────────────────┐
│  5. SECURITY SCAN                    │
│  npm audit --audit-level=high (both) │
│  Trivy image scan (if installed)     │
└──────┬──────────────────────────────┘
       │
┌──────▼──────────────────────────────┐  ← only on `main` branch
│  6. PUSH TO REGISTRY                 │
│  docker push ghcr.io/dinuanand-r/nexchat-backend:<sha>   │
│  docker push ghcr.io/dinuanand-r/nexchat-frontend:<sha>  │
└──────┬──────────────────────────────┘
       │
┌──────▼──────────────────────────────┐  ← only on `main` branch
│  7. DEPLOY                           │
│  docker compose -f docker-compose.yml up -d --remove-orphans │
└─────────────────────────────────────┘
```

**Key design decisions:**
- Node.js is **not installed on Jenkins** — all npm commands run inside `docker run node:20-alpine` containers
- Each Docker build uses the repo's `Dockerfile` (multi-stage builds)
- Stages 6 and 7 only execute on the `main` branch — PRs/feature branches build and test but never deploy
- `cleanWs()` runs in `post { always }` to free disk after every build

---

## 5. Docker Architecture

### 5.1 Multi-Stage Dockerfiles

**Backend** (`backend/Dockerfile`):
```
Stage 1: deps
  FROM node:20-alpine
  RUN apk add dumb-init
  COPY package*.json
  RUN npm ci --omit=dev  ← production deps only

Stage 2: release
  COPY --from=deps node_modules
  COPY src/
  USER node          ← non-root for security
  ENTRYPOINT dumb-init node src/index.js
```

**Frontend** (`frontend/Dockerfile`):
```
Stage 1: builder
  FROM node:20-alpine
  RUN npm ci && npm run build  ← produces /app/build

Stage 2: release
  FROM nginx:1.27-alpine
  COPY --from=builder /app/build /usr/share/nginx/html
  COPY nginx/spa.conf /etc/nginx/conf.d/default.conf
```

### 5.2 Docker Compose Services

```
docker-compose.yml (10 services)
│
├── nexchat-mongo         MongoDB 7 (persistent volume: mongo_data)
├── nexchat-redis         Redis 7 + AOF persistence
├── nexchat-backend       Node.js API (depends_on: mongo healthy + redis healthy)
├── nexchat-frontend      React SPA via Nginx
├── nexchat-nginx         Reverse proxy (port 80 → routes to backend/frontend)
│
├── nexchat-prometheus    Metrics collector (port 9090)
├── nexchat-grafana       Dashboard UI (port 3001)
├── nexchat-node-exporter Host metrics (port 9100)
├── nexchat-cadvisor      Container metrics (port 8080)
└── nexchat-redis-exporter Redis metrics (port 9121)
```

### 5.3 Nginx Routing (Reverse Proxy)

```
Internet → Port 80
              │
    ┌─────────┴──────────────┐
    │       nginx.conf        │
    │                         │
    │  /api/*      → backend:5000
    │  /api/auth/* → backend:5000  (stricter rate limit: 5 req/s)
    │  /socket.io/* → backend:5000 (Upgrade: websocket header)
    │  /health      → backend:5000/health
    │  /*           → frontend:80  (React SPA)
    └─────────────────────────┘
```

---

## 6. Kubernetes Architecture

Deployed on **Docker Desktop Kubernetes** (`docker-desktop` context).

### 6.1 K8s Object Map

```
Namespace: default (existing cluster) / nexchat (for new deployments)
│
├── Deployments
│   ├── backend      (2 replicas, RollingUpdate, probes on /health:5000)
│   ├── frontend     (2 replicas, RollingUpdate, probes on /nginx-health)
│   ├── mongodb      (1 replica, Recreate — stateful)
│   ├── redis        (1 replica, Recreate — stateful)
│   ├── prometheus   (1 replica, Recreate)
│   └── grafana      (1 replica, Recreate)
│
├── Services
│   ├── backend-service    NodePort  3000:30007
│   ├── frontend-service   NodePort  80:30008
│   ├── mongodb-service    ClusterIP 27017
│   ├── prometheus-service NodePort  9090:30090
│   └── grafana-service    NodePort  3000:30030
│
├── PersistentVolumeClaims
│   ├── mongodb-data-pvc   10Gi (database files)
│   ├── redis-data-pvc     2Gi  (AOF persistence)
│   ├── uploads-pvc        20Gi (user media uploads, ReadWriteMany)
│   ├── prometheus-data-pvc 5Gi (metrics TSDB)
│   └── grafana-data-pvc   2Gi  (dashboards + config)
│
├── ConfigMap              (env vars: MONGO_URI, REDIS_URL, etc.)
├── Secret                 (JWT_SECRET, GRAFANA_PASSWORD — base64 encoded)
├── HPA
│   ├── backend-hpa        min:2  max:8  (CPU 70% + Memory 80%)
│   └── frontend-hpa       min:2  max:6  (CPU 70%)
└── Ingress (nexchat-ingress)
    /api       → backend-service:5000
    /socket.io → backend-service:5000
    /          → frontend-service:80
```

### 6.2 Pod Health Checks (Backend Example)

```yaml
startupProbe:   GET /health  — allows 60s for cold start (12 × 5s)
livenessProbe:  GET /health  — restarts pod if unhealthy
readinessProbe: GET /health  — removes from load balancer if not ready
```

### 6.3 Access via Docker Desktop

| Service | URL |
|---|---|
| Frontend | http://localhost:30008 |
| Prometheus | http://localhost:30090 |
| Grafana | http://localhost:30030 |

---

## 7. Monitoring Architecture (Prometheus + Grafana)

### 7.1 Metrics Collection Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        Prometheus                            │
│              Scrapes every 15 seconds from:                  │
│                                                             │
│  ┌──────────────────┐  /metrics   ← prom-client (Node.js)  │
│  │  nexchat-backend │ ──────────►                           │
│  └──────────────────┘                                       │
│                                                             │
│  ┌──────────────────┐  /metrics   ← process/CPU/memory     │
│  │  node-exporter   │ ──────────►                           │
│  └──────────────────┘                                       │
│                                                             │
│  ┌──────────────────┐  /metrics   ← Docker container stats │
│  │  cadvisor        │ ──────────►                           │
│  └──────────────────┘                                       │
│                                                             │
│  ┌──────────────────┐  /metrics   ← Redis INFO command     │
│  │  redis-exporter  │ ──────────►                           │
│  └──────────────────┘                                       │
│                                                             │
│  ┌──────────────────┐  /metrics   ← self-monitoring        │
│  │  prometheus      │ ──────────►                           │
│  └──────────────────┘                                       │
└────────────────────┬────────────────────────────────────────┘
                     │  PromQL queries
                     ▼
              ┌─────────────────┐
              │    Grafana       │
              │  (port 3001)     │
              │                 │
              │  Dashboard:     │
              │  NexChat Full   │
              │  Stack Overview │
              │  (16 panels)    │
              └─────────────────┘
```

### 7.2 Dashboard Panels (16 total)

| Section | Panels |
|---|---|
| 🚀 HTTP Traffic | Request rate, Error rate (5xx%), P95 latency, Active WebSocket connections, Requests by status code, Response time percentiles |
| 🟢 Node.js Runtime | Heap used vs total, Event loop lag (ms) |
| 🔴 Redis | Memory used, Connected clients, Commands/sec |
| 🖥️ Host & Containers | CPU gauge, Memory gauge, Disk usage, Container CPU, Container memory |

### 7.3 Alert Rules

| Alert | Trigger |
|---|---|
| `BackendDown` | Backend unreachable for > 1 min |
| `HighErrorRate` | HTTP 5xx rate > 5% over 5 min |
| `SlowResponseTime` | P95 latency > 2 seconds |
| `HighMemoryUsage` | Node.js heap > 500MB |
| `RedisDown` | Redis exporter cannot reach Redis |
| `HighCPU` | Host CPU > 85% for 5 min |

---

## 8. Full Developer Workflow (End-to-End)

```
 Developer Machine
 ─────────────────
 1. Edit code (VS Code)
 2. git commit -m "..."
 3. git push origin main
         │
         ▼
 GitHub Repository
 ─────────────────
 4. GitHub stores commit
 5. Webhook fires → notifies Jenkins
         │
         ▼
 Jenkins (localhost:8090)
 ─────────────────────────
 6. Pipeline starts automatically
 7. Stage 1: Checkout  → clone repo
 8. Stage 2: Lint      → ESLint via docker run node:20-alpine
 9. Stage 3: Test      → Jest / react-scripts test
 10. Stage 4: Build     → docker build → nexchat-backend:<sha>
                                       → nexchat-frontend:<sha>
 11. Stage 5: Scan      → npm audit + Trivy
 12. Stage 6: Push      → ghcr.io/dinuanand-r/nexchat-*
 13. Stage 7: Deploy    → docker compose up -d
         │
         ▼
 Running Containers (localhost:80)
 ──────────────────────────────────
 14. Nginx serves updated app
 15. Prometheus scrapes /metrics every 15s
 16. Grafana shows live dashboards
 17. Alerts fire if thresholds exceeded
```

---

## 9. File Structure Reference

```
e:/devops/
│
├── Jenkinsfile                   CI/CD pipeline (7 stages)
├── Dockerfile.jenkins            Custom Jenkins image with Docker CLI
├── docker-compose.yml            Local stack (10 services)
├── docker-compose.prod.yml       Production stack (secrets from .env)
├── docker-compose.dev.yml        Development (hot-reload mode)
├── .gitignore                    Excludes: .env, k8s/secrets.yaml, node_modules
│
├── backend/
│   ├── Dockerfile                Multi-stage: deps + release, non-root
│   ├── package.json
│   ├── package-lock.json
│   └── src/
│       ├── index.js              Express app + Socket.IO + Prometheus metrics
│       ├── config/               db.js (MongoDB), redis.js
│       ├── middleware/           authMiddleware, rateLimiter, errorHandler
│       ├── services/
│       │   ├── auth-service/     router + controller + model
│       │   ├── user-service/     router + controller + model
│       │   ├── chat-service/     router + controller + model
│       │   ├── message-service/  router + controller + model
│       │   ├── media-service/    router + controller (file uploads)
│       │   └── notification-service/
│       ├── socket/               presenceHandlers.js, chatHandlers.js
│       └── utils/                logger.js
│
├── frontend/
│   ├── Dockerfile                Multi-stage: node builder + nginx release
│   ├── .dockerignore
│   ├── package.json
│   ├── package-lock.json         ← must stay in sync with package.json
│   ├── nginx/
│   │   └── spa.conf              try_files for React Router, gzip, caching
│   └── src/
│       ├── App.js                Route definitions
│       ├── pages/                LoginPage, RegisterPage, ChatPage
│       ├── components/           Sidebar, ChatWindow, MessageInput
│       ├── context/              ChatContext
│       ├── hooks/                useMessages, useSocket, usePresence
│       └── services/             api.js (Axios)
│
├── nginx/
│   └── nginx.conf                Reverse proxy: rate limits, WebSocket, routing
│
├── monitoring/
│   ├── prometheus.yml            5 scrape targets, 15s interval
│   ├── rules/
│   │   └── alerts.yml            9 alert rules
│   └── grafana/
│       ├── provisioning/
│       │   ├── datasources/      prometheus.yml (uid: prometheus)
│       │   └── dashboards/       dashboard.yml (path provider)
│       └── dashboards/
│           └── nexchat-overview.json  16-panel auto-loaded dashboard
│
├── k8s/
│   ├── namespace.yaml            namespace: nexchat
│   ├── configmap.yaml            Non-secret env vars
│   ├── secrets.yaml              Base64 secrets (gitignored)
│   ├── hpa.yaml                  Backend + frontend autoscaling
│   ├── ingress.yaml              Nginx Ingress routing
│   ├── backend/                  deployment + service + pvc (20Gi uploads)
│   ├── frontend/                 deployment + service
│   ├── mongodb/                  deployment + service + pvc (10Gi)
│   ├── redis/                    deployment + service + pvc (2Gi)
│   ├── nginx/                    deployment + service (NodePort 30080) + configmap
│   └── monitoring/
│       ├── prometheus.yaml       deployment + RBAC + PVC + service (30090)
│       └── grafana.yaml          deployment + provisioning + PVC + service (30030)
│
└── scripts/
    └── k8s-deploy.sh             Ordered deploy: namespace → DBs → backend → monitoring
```

---

## 10. Port Reference (All Services)

| Service | Container Port | Host Port | Purpose |
|---|---|---|---|
| Nginx (app entry) | 80 | **80** | Main app access |
| Backend | 5000 | — (internal) | REST API + Socket.IO |
| Frontend | 80 | — (internal) | React SPA |
| Jenkins | 8080 | **8090** | CI/CD UI |
| Prometheus | 9090 | **9090** | Metrics UI + API |
| Grafana | 3000 | **3001** | Dashboards |
| node-exporter | 9100 | 9100 | Host metrics |
| cAdvisor | 8080 | 8080 | Container metrics |
| Redis Exporter | 9121 | 9121 | Redis metrics |
| K8s App | 80 | **30008** | K8s NodePort |
| K8s Prometheus | 9090 | **30090** | K8s NodePort |
| K8s Grafana | 3000 | **30030** | K8s NodePort |

---

## 11. Security Practices

| Area | Implementation |
|---|---|
| **Secrets** | Never hardcoded. `.env` for Docker, `k8s/secrets.yaml` (base64, gitignored) for K8s |
| **Docker** | Non-root user (`USER node`), `dumb-init` for signal handling, multi-stage builds |
| **HTTP** | Helmet.js headers, CORS whitelist, rate limiting (30 req/s global, 5 req/s on /auth) |
| **JWT** | Short-lived access tokens (15m) + refresh token rotation (7d) |
| **K8s** | `runAsNonRoot: true`, `securityContext` on all containers |
| **CI** | `npm audit --audit-level=high` + Trivy image scan on every build |
| **Registry** | Images pushed only on `main` branch, credentials from Jenkins Credentials store |

---

*Generated: 2026-04-29 | NexChat DevOps Project*
