const Chat = require('./model');
const User = require('../auth-service/model');

/**
 * POST /api/chats  — Create or get 1:1 chat
 */
exports.createOrGetChat = async (req, res, next) => {
  try {
    const { memberId } = req.body;
    if (!memberId)
      return res.status(400).json({ success: false, message: 'memberId required' });

    const me = req.user.id;

    // Check if chat already exists
    let chat = await Chat.findOne({
      isGroup: false,
      members: { $all: [me, memberId], $size: 2 },
    })
      .populate('members', 'name email avatar status lastSeen')
      .populate({ path: 'lastMessage', populate: { path: 'senderId', select: 'name' } });

    if (chat) return res.json({ success: true, chat });

    const other = await User.findById(memberId);
    if (!other) return res.status(404).json({ success: false, message: 'User not found' });

    chat = await Chat.create({ members: [me, memberId], isGroup: false });
    await chat.populate('members', 'name email avatar status lastSeen');
    res.status(201).json({ success: true, chat });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/chats/group  — Create group chat
 */
exports.createGroup = async (req, res, next) => {
  try {
    const { groupName, members, groupDescription } = req.body;
    if (!groupName || !members || members.length < 2)
      return res
        .status(400)
        .json({ success: false, message: 'groupName and at least 2 members required' });

    const allMembers = [...new Set([req.user.id, ...members])];
    const chat = await Chat.create({
      isGroup: true,
      groupName,
      groupDescription,
      members: allMembers,
      admins: [req.user.id],
      createdBy: req.user.id,
    });
    await chat.populate('members', 'name email avatar status');
    res.status(201).json({ success: true, chat });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/chats  — Get all chats for current user
 */
exports.getMyChats = async (req, res, next) => {
  try {
    const chats = await Chat.find({ members: req.user.id })
      .populate('members', 'name email avatar status lastSeen')
      .populate({ path: 'lastMessage', populate: { path: 'senderId', select: 'name avatar' } })
      .sort({ lastMessageAt: -1 });

    res.json({ success: true, chats });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/chats/:id  — Get single chat
 */
exports.getChatById = async (req, res, next) => {
  try {
    const chat = await Chat.findOne({ _id: req.params.id, members: req.user.id })
      .populate('members', 'name email avatar status lastSeen')
      .populate({ path: 'lastMessage', populate: { path: 'senderId', select: 'name' } });

    if (!chat) return res.status(404).json({ success: false, message: 'Chat not found' });
    res.json({ success: true, chat });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/chats/:id/members  — Add member to group
 */
exports.addMember = async (req, res, next) => {
  try {
    const { userId } = req.body;
    const chat = await Chat.findById(req.params.id);
    if (!chat || !chat.isGroup)
      return res.status(404).json({ success: false, message: 'Group not found' });
    if (!chat.admins.includes(req.user.id))
      return res.status(403).json({ success: false, message: 'Only admins can add members' });
    if (chat.members.includes(userId))
      return res.status(409).json({ success: false, message: 'User already in group' });

    chat.members.push(userId);
    await chat.save();
    await chat.populate('members', 'name email avatar status');
    res.json({ success: true, chat });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/chats/:id/members/:userId  — Remove member
 */
exports.removeMember = async (req, res, next) => {
  try {
    const chat = await Chat.findById(req.params.id);
    if (!chat || !chat.isGroup)
      return res.status(404).json({ success: false, message: 'Group not found' });

    const isAdmin = chat.admins.map(String).includes(req.user.id);
    const isSelf = req.params.userId === req.user.id;
    if (!isAdmin && !isSelf)
      return res.status(403).json({ success: false, message: 'Not authorised' });

    chat.members = chat.members.filter((m) => String(m) !== req.params.userId);
    chat.admins = chat.admins.filter((a) => String(a) !== req.params.userId);
    await chat.save();
    res.json({ success: true, message: 'Member removed' });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/chats/:id  — Update group info
 */
exports.updateGroup = async (req, res, next) => {
  try {
    const chat = await Chat.findById(req.params.id);
    if (!chat || !chat.isGroup)
      return res.status(404).json({ success: false, message: 'Group not found' });
    if (!chat.admins.map(String).includes(req.user.id))
      return res.status(403).json({ success: false, message: 'Only admins can update group' });

    const { groupName, groupDescription, groupAvatar } = req.body;
    if (groupName) chat.groupName = groupName;
    if (groupDescription) chat.groupDescription = groupDescription;
    if (groupAvatar) chat.groupAvatar = groupAvatar;
    await chat.save();
    res.json({ success: true, chat });
  } catch (err) {
    next(err);
  }
};
