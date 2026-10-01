import express from 'express';
import {
  startOrUpgradeChat,
  listChats,
  getMessages,
  sendMessage,
  markRead,
  reportChat,
} from '../controllers/chatController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.post('/', startOrUpgradeChat);
router.get('/', listChats);
router.get('/:id/messages', getMessages);
router.post('/:id/messages', sendMessage);
router.patch('/:id/read', markRead);
router.post('/:id/report', reportChat);

export default router;
