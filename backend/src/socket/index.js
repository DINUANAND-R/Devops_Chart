const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const { getPublisher, getSubscriber } = require('../config/redis');
const registerChatHandlers = require('./chatHandlers');
const registerPresenceHandlers = require('./presenceHandlers');

// In-memory user→socket map (per process; Redis handles cross-process)
const onlineUsers = new Map(); // userId → Set of socketIds

const initSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // ─── JWT Auth Middleware ──────────────────────────────────────────────────
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(' ')[1];

      if (!token) return next(new Error('Authentication error: no token'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = String(decoded.id);
      next();
    } catch (err) {
      next(new Error('Authentication error: invalid token'));
    }
  });

  // ─── Redis Pub/Sub (horizontal scaling) ───────────────────────────────────
  const sub = getSubscriber();
  const pub = getPublisher();

  if (sub && pub) {
    sub.subscribe('chat:broadcast', (err) => {
      if (err) logger.error('Redis subscribe error:', err);
    });

    sub.on('message', (_channel, data) => {
      try {
        const { event, room, payload } = JSON.parse(data);
        if (room) io.to(room).emit(event, payload);
        else io.emit(event, payload);
      } catch (e) {
        logger.error('Redis message parse error:', e);
      }
    });
  }

  // Helper: emit to a room (via Redis if available, else direct)
  const broadcast = async (event, room, payload) => {
    if (pub) {
      await pub.publish('chat:broadcast', JSON.stringify({ event, room, payload }));
    } else {
      if (room) io.to(room).emit(event, payload);
      else io.emit(event, payload);
    }
  };

  // ─── Connection ───────────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    const userId = socket.userId;
    logger.info(`Socket connected: ${socket.id} [user: ${userId}]`);

    // Track online sockets per user
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socket.id);

    // Register handlers
    registerChatHandlers(io, socket, broadcast);
    registerPresenceHandlers(io, socket, broadcast, onlineUsers);

    socket.on('disconnect', (reason) => {
      logger.info(`Socket disconnected: ${socket.id} [reason: ${reason}]`);
      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) onlineUsers.delete(userId);
      }
    });

    socket.on('error', (err) => {
      logger.error(`Socket error [${socket.id}]:`, err.message);
    });
  });

  return io;
};

module.exports = initSocket;
