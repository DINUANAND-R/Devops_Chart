const jwt = require('jsonwebtoken');
const User = require('./model');
const logger = require('../../utils/logger');

const issueTokens = (userId) => {
  const accessToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });
  const refreshToken = jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
  return { accessToken, refreshToken };
};

const setCookies = (res, accessToken, refreshToken) => {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 15 * 60 * 1000,
  });
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/auth/refresh',
  });
};

/**
 * POST /api/auth/signup
 */
exports.signup = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ success: false, message: 'All fields are required' });
    if (password.length < 6)
      return res.status(400).json({ success: false, message: 'Password too short (min 6 chars)' });

    const user = new User({ name, email, passwordHash: password });
    await user.save();

    const { accessToken, refreshToken } = issueTokens(user._id);
    user.refreshTokens = [refreshToken];
    await user.save({ validateBeforeSave: false });

    setCookies(res, accessToken, refreshToken);
    logger.info(`New user registered: ${email}`);
    res.status(201).json({ success: true, user: user.toSafeObject(), accessToken });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/login
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password required' });

    const user = await User.findOne({ email }).select('+passwordHash +refreshTokens');
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const { accessToken, refreshToken } = issueTokens(user._id);
    user.refreshTokens = [...(user.refreshTokens || []).slice(-4), refreshToken];
    user.status = 'online';
    await user.save({ validateBeforeSave: false });

    setCookies(res, accessToken, refreshToken);
    logger.info(`User logged in: ${email}`);
    res.json({ success: true, user: user.toSafeObject(), accessToken });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/logout
 */
exports.logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.cookies;
    if (refreshToken) {
      const user = await User.findById(req.user.id).select('+refreshTokens');
      if (user) {
        user.refreshTokens = user.refreshTokens.filter((t) => t !== refreshToken);
        user.status = 'offline';
        user.lastSeen = new Date();
        await user.save({ validateBeforeSave: false });
      }
    }
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
    res.json({ success: true, message: 'Logged out' });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/refresh
 */
exports.refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.cookies;
    if (!refreshToken)
      return res.status(401).json({ success: false, message: 'No refresh token' });

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }

    const user = await User.findById(decoded.id).select('+refreshTokens');
    if (!user || !user.refreshTokens.includes(refreshToken))
      return res.status(401).json({ success: false, message: 'Refresh token reuse detected' });

    const tokens = issueTokens(user._id);
    user.refreshTokens = user.refreshTokens
      .filter((t) => t !== refreshToken)
      .concat(tokens.refreshToken);
    await user.save({ validateBeforeSave: false });

    setCookies(res, tokens.accessToken, tokens.refreshToken);
    res.json({ success: true, accessToken: tokens.accessToken });
  } catch (err) {
    next(err);
  }
};
