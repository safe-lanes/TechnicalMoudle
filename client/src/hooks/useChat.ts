import { useState, useCallback } from "react";
import { useVessel } from "@/contexts/VesselContext";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  toolsUsed?: string[];
}

interface ChatContext {
  vesselId: string;
  vesselName?: string;
  currentPage?: string;
  userRole?: string;
}

export function useChat() {
  const { vesselId, vessels } = useVessel();
  const { currentUser } = useAuth();
  const [location] = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentVessel = vessels.find(v => v.id === vesselId);
  const currentPage = location.split('/').pop() || 'dashboard';

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || !vesselId) {
      setError("Please select a vessel first");
      return;
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: content.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const context: ChatContext = {
        vesselId,
        vesselName: currentVessel?.name,
        currentPage,
        userRole: currentUser?.role || "Ship"
      };

      const currentMessages = [...messages, userMessage];
      const conversationHistory = currentMessages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const response = await apiRequest("POST", "/technical/api/chat", {
        message: content,
        context,
        conversationHistory
      });

      const data = await response.json();

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
        toolsUsed: data.toolsUsed
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (err) {
      console.error("Chat error:", err);
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setIsLoading(false);
    }
  }, [vesselId, currentVessel, currentPage, currentUser, messages]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
    vesselId,
    vesselName: currentVessel?.name
  };
}
