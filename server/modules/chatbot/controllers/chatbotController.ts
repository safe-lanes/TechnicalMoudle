import { Response } from 'express';
import { type AuthenticatedRequest } from '../../../middleware/auth';
import { processChatMessage, type ChatMessage, type ChatContext } from '../../../services/chatbotService';
import { storage } from '../../../storage';

// ── POST /chat ──

export async function handleChat(req: AuthenticatedRequest, res: Response) {
  const {
    message,
    conversationHistory = [],
    context = {},
  } = req.body as {
    message: string;
    conversationHistory?: ChatMessage[];
    context?: Partial<ChatContext>;
  };

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const userRole = req.user?.role || 'Ship';
  const fullName = req.user?.fullName || 'Unknown';

  const chatContext: ChatContext = {
    vesselId: context.vesselId || '',
    vesselName: context.vesselName || 'Unknown Vessel',
    currentPage: context.currentPage || '/pms',
    userRole: `${userRole} (${fullName})`,
  };

  console.log(
    `[Chatbot] Processing message from ${fullName} (${userRole}): "${message.substring(0, 100)}..."`
  );

  const result = await processChatMessage(
    message.trim(),
    conversationHistory,
    chatContext,
    storage
  );

  res.json(result);
}
