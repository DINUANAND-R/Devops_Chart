const router = require('express').Router();
const { getMessages, editMessage, deleteMessage, reactToMessage, markRead } = require('./controller');
const authMiddleware = require('../../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/:chatId', getMessages);
router.patch('/:id', editMessage);
router.delete('/:id', deleteMessage);
router.post('/:id/react', reactToMessage);
router.patch('/:id/read', markRead);

module.exports = router;
