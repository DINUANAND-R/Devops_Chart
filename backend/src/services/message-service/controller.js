const Message = require('./model');
const Chat = require('../chat-service/model');

/**
 * GET /api/messages/:chatId?page=1&limit=30
 */
exports.getMessages = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 30);

    const chat = await Chat.findOne({ _id: chatId, members: req.user.id });
    if (!chat) return res.status(404).json({ success: false, message: 'Chat not found' });

    const total = await Message.countDocuments({ chatId, isDeleted: false });
    const messages = await Message.find({ chatId, isDeleted: false })
      .populate('senderId', 'name avatar')
      .populate('replyTo', 'content senderId')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      success: true,
      messages: messages.reverse(),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/messages/:id  — Edit message
 */
exports.editMessage = async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content?.trim())
      return res.status(400).json({ success: false, message: 'Content required' });

    const msg = await Message.findOne({ _id: req.params.id, senderId: req.user.id });
    if (!msg) return res.status(404).json({ success: false, message: 'Message not found' });
    if (msg.isDeleted)
      return res.status(400).json({ success: false, message: 'Cannot edit deleted message' });

    msg.content = content.trim();
    msg.editedAt = new Date();
    await msg.save();
    await msg.populate('senderId', 'name avatar');
    res.json({ success: true, message: msg });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/messages/:id  — Soft delete
 */
exports.deleteMessage = async (req, res, next) => {
  try {
    const msg = await Message.findOne({ _id: req.params.id, senderId: req.user.id });
    if (!msg) return res.status(404).json({ success: false, message: 'Message not found' });

    msg.isDeleted = true;
    msg.deletedAt = new Date();
    msg.content = '';
    msg.fileUrl = null;
    await msg.save();
    res.json({ success: true, messageId: msg._id, chatId: msg.chatId });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/messages/:id/react  — Add/toggle emoji reaction
 */
exports.reactToMessage = async (req, res, next) => {
  try {
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ success: false, message: 'Emoji required' });

    const msg = await Message.findById(req.params.id);
    if (!msg) return res.status(404).json({ success: false, message: 'Message not found' });

    const userId = req.user.id;
    const idx = msg.reactions.findIndex(
      (r) => r.emoji === emoji && String(r.userId) === userId
    );
    if (idx > -1) {
      msg.reactions.splice(idx, 1); // toggle off
    } else {
      msg.reactions.push({ emoji, userId });
    }
    await msg.save();
    res.json({ success: true, reactions: msg.reactions, messageId: msg._id });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/messages/:id/read  — Mark message as read
 */
exports.markRead = async (req, res, next) => {
  try {
    const msg = await Message.findById(req.params.id);
    if (!msg) return res.status(404).json({ success: false, message: 'Not found' });

    if (!msg.readBy.includes(req.user.id)) {
      msg.readBy.push(req.user.id);
      msg.status = 'read';
      await msg.save();
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
