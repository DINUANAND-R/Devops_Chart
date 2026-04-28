require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('path');
const client = require('prom-client');

const { connectDB } = require('./config/db');
const { connectRedis } = require('./config/redis');
const initSocket = require('./socket');
const logger = require('./utils/logger');

const authRouter = require('./services/auth-service/router');
const userRouter = require('./services/user-service/router');
const chatRouter = require('./services/chat-service/router');
const messageRouter = require('./services/message-service/router');
const notificationRouter = require('./services/notification-service/router');
const mediaRouter = require('./services/media-service/router');

const errorHandler = require('./middleware/errorHandler');
const authRateLimiter = require('./middleware/rateLimiter');

const app = express();
const server = http.createServer(app);

// Prometheus metrics
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ register: client.register });

// ─── Security ───────────────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
);

// ─── Request Parsing ─────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ─── Logging ─────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ─── Static Uploads ───────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRateLimiter, authRouter);
app.use('/api/users', userRouter);
app.use('/api/chats', chatRouter);
app.use('/api/messages', messageRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/media', mediaRouter);

// Health & Metrics
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date() })
);
app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.send(await client.register.metrics());
});

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Bootstrap ────────────────────────────────────────────────────────────────
const initSocket_io = initSocket(server);

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();
  await connectRedis();
  server.listen(PORT, () => {
    logger.info(`🚀 Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  });
};

if (require.main === module) {
  start().catch((err) => {
    logger.error(err);
    process.exit(1);
  });
}

module.exports = { app, server };
