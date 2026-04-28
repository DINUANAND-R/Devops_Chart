# NexChat 💬

> A production-grade **WhatsApp/Slack-like** real-time collaboration chat platform built with React, Node.js, Socket.IO, MongoDB, and Redis — fully containerised for DevOps deployment.

---

## ✨ Features

| Feature | Status |
|---------|--------|
| JWT Authentication (httpOnly cookies + refresh rotation) | ✅ |
| One-to-one & Group chat | ✅ |
| Real-time messaging (Socket.IO) | ✅ |
| Online / Offline presence tracking | ✅ |
| Typing indicators | ✅ |
| Message delivery status (sent / delivered / read) | ✅ |
| Read receipts (✓ / ✓✓) | ✅ |
| Emoji reactions | ✅ |
| Message edit & delete (soft delete) | ✅ |
| File / Image / Audio / Video sharing | ✅ |
| Reply threading | ✅ |
| Unread message badge counts | ✅ |
| Paginated message history | ✅ |
| Group management (add/remove members, admin roles) | ✅ |
| Redis Pub/Sub (horizontal scaling) | ✅ |
| Prometheus metrics endpoint (`/metrics`) | ✅ |
| Docker + Docker Compose | ✅ |
| GitHub Actions CI/CD | ✅ |
| Nginx reverse proxy | ✅ |

---

## 🏗️ Architecture

```
e:\devops\
├── backend/                    # Node.js + Express + Socket.IO
│   └── src/
│       ├── services/
│       │   ├── auth-service/   # JWT auth, signup/login
│       │   ├── user-service/   # Profiles, search
│       │   ├── chat-service/   # Rooms & groups
│       │   ├── message-service/# CRUD, reactions, status
│       │   ├── notification-service/  # Unread counts
│       │   └── media-service/  # File uploads
│       ├── socket/             # Socket.IO event handlers
│       ├── middleware/         # Auth, error, rate-limiter
│       ├── config/             # DB, Redis
│       └── utils/              # Logger
│
├── frontend/                   # React 18 SPA
│   └── src/
│       ├── context/            # AuthContext, SocketContext, ChatContext
│       ├── components/         # Sidebar, ChatWindow, MessageBubble, etc.
│       ├── pages/              # Login, Signup, Chat
│       ├── hooks/              # useMessages
│       └── services/           # Axios API wrappers
│
├── nginx/                      # Reverse proxy config
├── monitoring/                 # Prometheus config
├── docker-compose.yml          # Production stack
├── docker-compose.dev.yml      # Dev overrides
└── .github/workflows/ci-cd.yml # GitHub Actions pipeline
```

---

## 🚀 Quick Start

### Prerequisites
- Docker 24+ & Docker Compose v2
- Node.js 20+ (for local dev)

### 1. Clone & configure

```bash
git clone <your-repo>
cd devops

# Backend env
cp backend/.env.example backend/.env
# Edit backend/.env and set JWT_SECRET, JWT_REFRESH_SECRET

# Frontend env
cp frontend/.env.example frontend/.env
```

### 2. Run with Docker Compose (Production)

```bash
docker-compose up -d --build
```

App available at **http://localhost**

### 3. Run in Development mode (hot reload)

```bash
# Start MongoDB + Redis
docker-compose up -d mongodb redis

# Backend (hot reload)
cd backend && npm install && npm run dev

# Frontend (CRA dev server)
cd frontend && npm install && npm start
```

Frontend: http://localhost:3000  
Backend: http://localhost:5000

### 4. With monitoring (Prometheus + Grafana)

```bash
docker-compose --profile monitoring up -d
```

- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001 (admin / admin)

---

## 🔌 API Reference

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/signup` | Register user |
| POST | `/api/auth/login` | Sign in |
| POST | `/api/auth/logout` | Sign out |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/users/me` | Current user profile |
| PATCH | `/api/users/me` | Update profile |
| GET | `/api/users/search?q=` | Search users |
| GET | `/api/chats` | List my chats |
| POST | `/api/chats` | Start 1:1 chat |
| POST | `/api/chats/group` | Create group |
| GET | `/api/messages/:chatId` | Get paginated messages |
| PATCH | `/api/messages/:id` | Edit message |
| DELETE | `/api/messages/:id` | Delete message |
| POST | `/api/messages/:id/react` | React with emoji |
| POST | `/api/media/upload` | Upload file |
| GET | `/api/notifications/unread` | Unread counts |
| GET | `/health` | Health check |
| GET | `/metrics` | Prometheus metrics |

---

## ⚡ Socket.IO Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `join_chat` | → server | `{chatId}` |
| `send_message` | → server | `{chatId, content, type, fileUrl?, replyTo?}` |
| `new_message` | ← server | Message object |
| `typing_start` | → server | `{chatId}` |
| `typing_stop` | → server | `{chatId}` |
| `user_typing` | ← server | `{chatId, userId}` |
| `message_read` | → server | `{messageId, chatId}` |
| `message_seen` | ← server | `{messageId, chatId}` |
| `message_delivered` | ← server | `{messageId, chatId}` |
| `message_reaction` | → server | `{messageId, emoji, chatId}` |
| `reaction_updated` | ← server | `{messageId, reactions}` |
| `edit_message` | → server | `{messageId, content, chatId}` |
| `message_edited` | ← server | `{messageId, content}` |
| `delete_message` | → server | `{messageId, chatId}` |
| `message_deleted` | ← server | `{messageId, chatId}` |
| `user_online` | ← server | `{userId}` |
| `user_offline` | ← server | `{userId, lastSeen}` |

---

## 🐳 CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/ci-cd.yml`) runs on every push to `main`:

1. **Test** — Run Jest tests for backend & frontend in parallel
2. **Build** — Multi-arch Docker images pushed to GitHub Container Registry (GHCR)
3. **Deploy** — SSH into cloud VM, pull new images, rolling restart
4. **Audit** — `npm audit` security check

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `DEPLOY_HOST` | Your VM's public IP |
| `DEPLOY_USER` | SSH username |
| `DEPLOY_SSH_KEY` | Private SSH key |

---

## 📈 Horizontal Scaling

Scale the backend to multiple replicas — Redis Pub/Sub ensures WebSocket messages are broadcast across all instances:

```bash
docker-compose up -d --scale backend=3
```

---

## 🛡️ Security Features

- httpOnly cookies for JWT tokens (XSS-resistant)
- Refresh token rotation (reuse detection)
- Rate limiting on auth routes (20 req/15 min)
- Helmet.js security headers
- Nginx rate limiting + security headers
- bcrypt password hashing (12 rounds)
- Input validation on all endpoints
- Soft delete for messages (no hard data loss)

---

## 📦 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, React Router v6 |
| Backend | Node.js 20, Express 4 |
| Real-time | Socket.IO 4 |
| Database | MongoDB 7 (Mongoose) |
| Caching/PubSub | Redis 7 (ioredis) |
| Auth | JWT (httpOnly cookies) |
| File uploads | Multer (local / S3-ready) |
| Logging | Winston |
| Metrics | prom-client (Prometheus) |
| Container | Docker, Docker Compose |
| Reverse proxy | Nginx |
| CI/CD | GitHub Actions |
| Monitoring | Prometheus + Grafana |
