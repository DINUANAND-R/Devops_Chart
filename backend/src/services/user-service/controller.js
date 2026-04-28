const User = require('../auth-service/model');

/**
 * GET /api/users/me
 */
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user: user.toSafeObject() });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/users/me
 */
exports.updateMe = async (req, res, next) => {
  try {
    const allowed = ['name', 'bio', 'avatar'];
    const updates = {};
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const user = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
      runValidators: true,
    });
    res.json({ success: true, user: user.toSafeObject() });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/users/search?q=
 */
exports.searchUsers = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2)
      return res.status(400).json({ success: false, message: 'Query too short' });

    const users = await User.find({
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
      ],
      _id: { $ne: req.user.id },
    })
      .select('name email avatar status lastSeen')
      .limit(20);

    res.json({ success: true, users });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/users/:id
 */
exports.getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select(
      'name email avatar status lastSeen bio'
    );
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
};
