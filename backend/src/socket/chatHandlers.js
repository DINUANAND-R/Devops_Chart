const Message = require('../services/message-service/model');
const Chat = require('../services/chat-service/model');
const logger = require('../utils/logger');

const registerChatHandlers = (io, socket, broadcast) => {
  const userId = socket.userId;

  // ─── Join a chat room ────────────────────────────────────────────────────
  socket.on('join_chat', async ({ chatId }) => {
    try {
      const chat = await Chat.findOne({ _id: chatId, members: userId });
      if (!chat) return socket.emit('error', { message: 'Chat not found' });
      socket.join(chatId);
      logger.debug(`User ${userId} joined room ${chatId}`);
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // ─── Leave a chat room ───────────────────────────────────────────────────
  socket.on('leave_chat', ({ chatId }) => {
    socket.leave(chatId);
  });

  // ─── Send message ────────────────────────────────────────────────────────
  socket.on('send_message', async (data) => {
    try {
      const { chatId, content, type = 'text', fileUrl, fileName, fileSize, replyTo } = data;

      if (!chatId || (!content && !fileUrl))
        return socket.emit('error', { message: 'chatId and content/file required' });

      const chat = await Chat.findOne({ _id: chatId, members: userId });
      if (!chat) return socket.emit('error', { message: 'Chat not found' });

      // Create message
      const msg = await Message.create({
        chatId,
        senderId: userId,
        content: content?.trim() || '',
        type,
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        fileSize: fileSize || null,
        replyTo: replyTo || null,
        status: 'sent',
        readBy: [userId],
      });

      await msg.populate('senderId', 'name avatar');
      if (replyTo) await msg.populate('replyTo', 'content senderId type');

      // Update chat's lastMessage
      chat.lastMessage = msg._id;
      chat.lastMessageAt = msg.createdAt;
      await chat.save();

      // Broadcast new message to all room members
      await broadcast('new_message', chatId, msg.toObject());

      // Mark as delivered for members currently in the room
      const roomSockets = await io.in(chatId).fetchSockets();
      const onlineInRoom = roomSockets.map((s) => s.userId).filter((id) => id !== userId);

      if (onlineInRoom.length > 0) {
        await Message.findByIdAndUpdate(msg._id, {
          $addToSet: { readBy: { $each: onlineInRoom } },
          status: 'delivered',
        });
        await broadcast('message_delivered', chatId, {
          messageId: msg._id,
          chatId,
          deliveredTo: onlineInRoom,
        });
      }
    } catch (err) {
      logger.error('send_message error:', err);
      socket.emit('error', { message: err.message });
    }
  });

  // ─── Typing indicators ───────────────────────────────────────────────────
  socket.on('typing_start', async ({ chatId }) => {
    socket.to(chatId).emit('user_typing', { chatId, userId, name: socket.userName });
  });

  socket.on('typing_stop', ({ chatId }) => {
    socket.to(chatId).emit('user_stop_typing', { chatId, userId });
  });

  // ─── Mark message as read ────────────────────────────────────────────────
  socket.on('message_read', async ({ messageId, chatId }) => {
    try {
      const msg = await Message.findByIdAndUpdate(
        messageId,
        { $addToSet: { readBy: userId }, $set: { status: 'read' } },
        { new: true }
      );
      if (msg) {
        await broadcast('message_seen', chatId, { messageId, chatId, seenBy: userId });
      }
    } catch (err) {
      logger.error('message_read error:', err);
    }
  });

  // ─── React to message ─────────────────────────────────────────────────────
  socket.on('message_reaction', async ({ messageId, emoji, chatId }) => {
    try {
      const msg = await Message.findById(messageId);
      if (!msg) return;

      const idx = msg.reactions.findIndex(
        (r) => r.emoji === emoji && String(r.userId) === userId
      );
      if (idx > -1) msg.reactions.splice(idx, 1);
      else msg.reactions.push({ emoji, userId });

      await msg.save();
      await broadcast('reaction_updated', chatId, {
        messageId,
        reactions: msg.reactions,
        chatId,
      });
    } catch (err) {
      logger.error('message_reaction error:', err);
    }
  });

  // ─── Delete message ───────────────────────────────────────────────────────
  socket.on('delete_message', async ({ messageId, chatId }) => {
    try {
      const msg = await Message.findOne({ _id: messageId, senderId: userId });
      if (!msg) return socket.emit('error', { message: 'Not found or not authorised' });

      msg.isDeleted = true;
      msg.deletedAt = new Date();
      msg.content = '';
      msg.fileUrl = null;
      await msg.save();

      await broadcast('message_deleted', chatId, { messageId, chatId });
    } catch (err) {
      logger.error('delete_message error:', err);
    }
  });

  // ─── Edit message ──────────────────────────────────────────────────────────
  socket.on('edit_message', async ({ messageId, content, chatId }) => {
    try {
      if (!content?.trim()) return;
      const msg = await Message.findOne({ _id: messageId, senderId: userId });
      if (!msg || msg.isDeleted) return;

      msg.content = content.trim();
      msg.editedAt = new Date();
      await msg.save();
      await msg.populate('senderId', 'name avatar');

      await broadcast('message_edited', chatId, { messageId, content: msg.content, chatId, editedAt: msg.editedAt });
    } catch (err) {
      logger.error('edit_message error:', err);
    }
  });
};

module.exports = registerChatHandlers;
