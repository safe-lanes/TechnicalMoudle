import { Router, Request, Response } from "express";
import { processChatMessage, type ChatContext } from "../services/chatbotService";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth";

const router = Router();

interface ChatRequestBody {
  message: string;
  context: {
    vesselId: string;
    vesselName?: string;
    currentPage?: string;
    pageHint?: string;
    userRole?: string;
  };
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
}

router.post("/technical/api/chat", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { message, context, conversationHistory = [] } = req.body as ChatRequestBody;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    if (!context?.vesselId) {
      return res.status(400).json({ error: "Vessel ID is required in context" });
    }

    const chatContext: ChatContext = {
      vesselId: context.vesselId,
      vesselName: context.vesselName,
      currentPage: context.currentPage,
      pageHint: context.pageHint,
      userRole: req.user?.role || context.userRole || "Ship"
    };

    const formattedHistory = conversationHistory.map(msg => ({
      role: msg.role as "user" | "assistant",
      content: msg.content
    }));

    const result = await processChatMessage(message, chatContext, formattedHistory);

    res.json({
      response: result.response,
      toolsUsed: result.toolsUsed,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("Chat endpoint error:", error);
    res.status(500).json({ 
      error: "Failed to process message",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export default router;
