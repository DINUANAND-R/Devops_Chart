const router = require('express').Router();
const {
  createOrGetChat,
  createGroup,
  getMyChats,
  getChatById,
  addMember,
  removeMember,
  updateGroup,
} = require('./controller');
const authMiddleware = require('../../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/', getMyChats);
router.post('/', createOrGetChat);
router.post('/group', createGroup);
router.get('/:id', getChatById);
router.patch('/:id', updateGroup);
router.post('/:id/members', addMember);
router.delete('/:id/members/:userId', removeMember);

module.exports = router;
