const User = require('../services/auth-service/model');
const Chat = require('../services/chat-service/model');
const logger = require('../utils/logger');

const registerPresenceHandlers = (io, socket, broadcast, onlineUsers) => {
  const userId = socket.userId;

  // ─── User goes online ────────────────────────────────────────────────────
  const handleOnline = async () => {
    try {
      await User.findByIdAndUpdate(userId, { status: 'online' });

      // Get all chats this user is part of and broadcast presence
      const chats = await Chat.find({ members: userId }).select('_id');
      for (const chat of chats) {
        socket.join(String(chat._id));
        socket.to(String(chat._id)).emit('user_online', { userId });
      }
      logger.debug(`User ${userId} is online`);
    } catch (err) {
      logger.error('handleOnline error:', err);
    }
  };

  // Call immediately on connect
  handleOnline();

  // ─── User goes offline ────────────────────────────────────────────────────
  socket.on('disconnect', async () => {
    try {
      // Only mark offline if no other sockets remain for this user
      const sockets = onlineUsers.get(userId);
      if (sockets && sockets.size === 0) {
        const lastSeen = new Date();
        await User.findByIdAndUpdate(userId, { status: 'offline', lastSeen });

        const chats = await Chat.find({ members: userId }).select('_id');
        for (const chat of chats) {
          io.to(String(chat._id)).emit('user_offline', { userId, lastSeen });
        }
        logger.debug(`User ${userId} is offline`);
      }
    } catch (err) {
      logger.error('disconnect handler error:', err);
    }
  });

  // ─── Manual away status ────────────────────────────────────────────────────
  socket.on('set_away', async () => {
    try {
      await User.findByIdAndUpdate(userId, { status: 'away' });
      const chats = await Chat.find({ members: userId }).select('_id');
      for (const chat of chats) {
        socket.to(String(chat._id)).emit('user_status_change', { userId, status: 'away' });
      }
    } catch (err) {
      logger.error('set_away error:', err);
    }
  });

  // ─── Heartbeat / ping ────────────────────────────────────────────────────
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: Date.now() });
  });
};

module.exports = registerPresenceHandlers;
