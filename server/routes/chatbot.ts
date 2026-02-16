import { Router } from "express";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "../middleware/auth";
import { processChatMessage, type ChatMessage, type ChatContext } from "../services/chatbotService";
import { storage } from "../storage";

const router = Router();

router.post(
  "/technical/api/chat",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      const {
        message,
        conversationHistory = [],
        context = {},
      } = req.body as {
        message: string;
        conversationHistory?: ChatMessage[];
        context?: Partial<ChatContext>;
      };

      if (!message || typeof message !== "string" || message.trim().length === 0) {
        return res.status(400).json({ error: "Message is required" });
      }

      const userRole = req.user?.role || "Ship";
      const fullName = req.user?.fullName || "Unknown";

      const chatContext: ChatContext = {
        vesselId: context.vesselId || "",
        vesselName: context.vesselName || "Unknown Vessel",
        currentPage: context.currentPage || "/pms",
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
    } catch (error: any) {
      console.error("[Chatbot] Route error:", error);
      res.status(500).json({
        error: "Failed to process chat message",
        message: error.message,
      });
    }
  }
);

export default router;
