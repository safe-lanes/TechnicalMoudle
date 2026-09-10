import { useState, useCallback, useRef, useEffect } from "react";
import { useVessel } from "@/contexts/VesselContext";
import { useAuth } from "@/contexts/AuthContext";
import { sendToAssistant, ASSISTANT_UNAVAILABLE_MESSAGE } from "@/assistant-widget/assistantClient";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  toolsUsed?: string[];
  timestamp: Date;
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);

  messagesRef.current = messages;

  const { vesselId, vessels } = useVessel();
  const { currentUser } = useAuth();

  const currentVessel = vessels.find((v) => v.id === vesselId);

  const toggleChat = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const closeChat = useCallback(() => {
    setIsOpen(false);
  }, []);

  const openChat = useCallback(() => {
    setIsOpen(true);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const sendMessage = useCallback(
    async (messageText: string) => {
      if (!messageText.trim() || isLoading) return;

      setError(null);

      const userMessage: ChatMessage = {
        role: "user",
        content: messageText.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      try {
        const currentMessages = messagesRef.current;
        const conversationHistory = currentMessages.map((m) => ({
          role: m.role,
          content: m.content,
        }));
        const context = {
          module: "technical",
          vesselId,
          vesselName: currentVessel?.name || "Unknown Vessel",
          currentPage: window.location.pathname,
        };

        // Central assistant only — the legacy embedded chatbot was removed
        // (never tested/grounded; product decision 10-Sep-2026). Failures show
        // an honest unavailable message instead of pretending to answer.
        const data = await sendToAssistant(
          messageText.trim(),
          conversationHistory,
          context,
          abortControllerRef.current.signal,
        );

        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: data.response,
          toolsUsed: data.toolsUsed,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err: any) {
        if (err.name === "AbortError") return;
        console.warn("[assistant] request failed:", err?.message || err);
        setError(err?.message || "assistant unavailable");
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: ASSISTANT_UNAVAILABLE_MESSAGE,
            timestamp: new Date(),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, vesselId, currentVessel]
  );

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    messages,
    isLoading,
    error,
    isOpen,
    sendMessage,
    toggleChat,
    openChat,
    closeChat,
    clearMessages,
  };
}
