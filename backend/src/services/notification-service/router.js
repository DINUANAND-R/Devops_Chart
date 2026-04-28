const router = require('express').Router();
const { getUnreadCounts, markChatAsRead } = require('./controller');
const authMiddleware = require('../../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/unread', getUnreadCounts);
router.post('/read-all/:chatId', markChatAsRead);

module.exports = router;
