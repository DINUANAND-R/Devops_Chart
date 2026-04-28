const Message = require('../message-service/model');
const Chat = require('../chat-service/model');

/**
 * GET /api/notifications/unread
 */
exports.getUnreadCounts = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get all chats the user is in
    const chats = await Chat.find({ members: userId }).select('_id');
    const chatIds = chats.map((c) => c._id);

    // Count unread messages per chat (not sent by current user, not yet read)
    const unreadAgg = await Message.aggregate([
      {
        $match: {
          chatId: { $in: chatIds },
          senderId: { $ne: userId },
          isDeleted: false,
          readBy: { $not: { $elemMatch: { $eq: userId } } },
        },
      },
      {
        $group: {
          _id: '$chatId',
          count: { $sum: 1 },
        },
      },
    ]);

    const counts = {};
    unreadAgg.forEach((item) => {
      counts[item._id] = item.count;
    });

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    res.json({ success: true, counts, total });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/notifications/read-all/:chatId  — Mark all in chat as read
 */
exports.markChatAsRead = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    await Message.updateMany(
      {
        chatId,
        senderId: { $ne: userId },
        readBy: { $not: { $elemMatch: { $eq: userId } } },
      },
      { $addToSet: { readBy: userId }, $set: { status: 'read' } }
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
