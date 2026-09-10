import { useState, useCallback, useRef, useEffect } from "react";
import { useVessel } from "@/contexts/VesselContext";
import { useAuth } from "@/contexts/AuthContext";
import { resolveCentralUrl, sendToCentral } from "@/assistant-widget/assistantClient";

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

        // Stage 4 flag: central assistant when configured, with per-request
        // fallback to the embedded endpoint on any central failure (see
        // assistant-widget/assistantClient.ts for the flag + identity design).
        let data: { response: string; toolsUsed?: string[] } | null = null;
        const centralUrl = resolveCentralUrl();
        if (centralUrl) {
          try {
            data = await sendToCentral(centralUrl, messageText.trim(), conversationHistory, context);
          } catch (centralErr: any) {
            if (centralErr?.name === "AbortError") throw centralErr;
            console.warn("[assistant] central path failed, falling back to embedded:", centralErr?.message || centralErr);
            data = null; // fall through to the legacy endpoint below
          }
        }

        if (!data) {
          const response = await fetch("/technical/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: messageText.trim(),
              conversationHistory,
              context,
            }),
            signal: abortControllerRef.current.signal,
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            throw new Error(
              errorData?.message || `Request failed with status ${response.status}`
            );
          }
          data = await response.json();
        }

        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: data!.response,
          toolsUsed: data!.toolsUsed,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err: any) {
        if (err.name === "AbortError") return;
        const errorMsg =
          err.message || "Failed to send message. Please try again.";
        setError(errorMsg);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Sorry, something went wrong: ${errorMsg}`,
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
