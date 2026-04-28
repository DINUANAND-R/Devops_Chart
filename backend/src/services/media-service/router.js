const router = require('express').Router();
const { uploadFile } = require('./controller');
const authMiddleware = require('../../middleware/authMiddleware');

router.use(authMiddleware);

router.post('/upload', uploadFile);

module.exports = router;
