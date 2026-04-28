const router = require('express').Router();
const { getMe, updateMe, searchUsers, getUserById } = require('./controller');
const authMiddleware = require('../../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/me', getMe);
router.patch('/me', updateMe);
router.get('/search', searchUsers);
router.get('/:id', getUserById);

module.exports = router;
