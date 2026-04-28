const router = require('express').Router();
const { signup, login, logout, refresh } = require('./controller');
const authMiddleware = require('../../middleware/authMiddleware');

router.post('/signup', signup);
router.post('/login', login);
router.post('/logout', authMiddleware, logout);
router.post('/refresh', refresh);

module.exports = router;
