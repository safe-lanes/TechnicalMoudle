import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../shared/middleware';
import * as chatbotCtrl from './controllers/chatbotController';

const router = Router();

// ══════════════════════════════════════════════════════════
// Chatbot Routes (/chat)
// ══════════════════════════════════════════════════════════

router.post('/chat', requireAuth, asyncHandler(chatbotCtrl.handleChat));

export default router;
