import { Response } from 'express';
import { type AuthenticatedRequest } from '../../../middleware/auth';
import { processChatMessage, type ChatMessage, type ChatContext, type VesselAccess } from '../../../services/chatbotService';
import { storage } from '../../../storage';
import { tenantConnectionManager } from '../../../utils/tenantConnectionManager';
import { checkChatRateLimit } from '../rateLimiter';

// ── POST /chat ──

export async function handleChat(req: AuthenticatedRequest, res: Response) {
  const {
    message,
    conversationHistory = [],
    context = {},
    conversationId,
  } = req.body as {
    message: string;
    conversationHistory?: ChatMessage[];
    context?: Partial<ChatContext>;
    conversationId?: string;
  };

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const userRole = req.user?.role || 'Ship';
  const fullName = req.user?.fullName || 'Unknown';
  const userId = String((req as any).user?.id || (req as any).user?.username || 'unknown');
  // Tenant identity (native on this branch): null in single-tenant mode.
  const tuid = (req as any).tenantTuid ?? tenantConnectionManager.getCurrentTenantContext()?.tuid ?? null;
  const domain = (req as any).tenantDomain ?? null;

  // ── Rate limit (Stage A): per user; default generous, disabled when CHATBOT_RATE_MAX<=0.
  //    Return 200 with a clean message so it renders in-chat (the widget throws on non-200).
  const rl = checkChatRateLimit(userId);
  if (!rl.allowed) {
    return res.json({
      response: "You're sending requests too quickly — please wait a moment and try again.",
      toolsUsed: [],
      conversationHistory,
    });
  }

  // ── Per-tenant enable/disable (Stage A): no LLM call (no cost) when off. Default ON.
  const aiEnabled = tenantConnectionManager.isMultiTenantEnabled
    ? await tenantConnectionManager.isTenantAiEnabled(domain || '')
    : process.env.CHATBOT_ENABLED !== 'false'; // single-tenant default ON = byte-identical
  if (!aiEnabled) {
    return res.json({
      response: "The AI assistant isn't enabled for your organization. Please contact your administrator.",
      toolsUsed: [],
      conversationHistory,
    });
  }

  const chatContext: ChatContext = {
    vesselId: context.vesselId || '',
    vesselName: context.vesselName || 'Unknown Vessel',
    currentPage: context.currentPage || '/pms',
    userRole: `${userRole} (${fullName})`,
  };
  // Vessel-scope identity for enforcement inside the tool loop.
  const access: VesselAccess = { role: userRole, vesselId: (req as any).user?.vesselId ?? null };

  console.log(
    `[Chatbot] Processing message from ${fullName} (${userRole}): "${message.substring(0, 100)}..."`
  );

  const startedAt = Date.now();
  const result = await processChatMessage(
    message.trim(),
    conversationHistory,
    chatContext,
    storage,
    access
  );
  const latencyMs = Date.now() - startedAt;

  res.json(result);

  // ── Central log (Stage A): fire-and-forget AFTER the response. A logging failure must
  //    NEVER slow or break the answer — never awaited, and its own errors are swallowed here.
  void tenantConnectionManager
    .logChatInteraction({
      tuid,
      domain,
      userId,
      userName: fullName,
      userRole,
      vesselId: chatContext.vesselId || null,
      conversationId: conversationId ?? null,
      question: message.trim(),
      answer: result.response,
      toolsUsed: result.toolsUsed,
      docsRetrieved: null, // populated once RAG (Stage B) lands
      tokensIn: result.usage?.tokensIn ?? null,
      tokensOut: result.usage?.tokensOut ?? null,
      latencyMs,
      model: 'gpt-4o',
      provider: 'openai',
    })
    .catch((e) => console.error('[Chatbot] interaction log failed (non-fatal):', e?.message || e));
}
