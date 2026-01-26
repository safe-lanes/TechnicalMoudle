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
  pageHint?: string;
  userRole?: string;
}

interface PageContext {
  page: string;
  hint: string;
}

function getCurrentPageContext(location: string): PageContext {
  if (location.includes('/pms/components') || location.includes('/components')) {
    return {
      page: 'Components',
      hint: 'User is viewing the components list. Prioritize component and equipment queries.'
    };
  }
  if (location.includes('/pms/work-orders') || location.includes('/work-orders') || location.includes('/workorders')) {
    return {
      page: 'Work Orders',
      hint: 'User is viewing work orders. Prioritize maintenance and work order queries.'
    };
  }
  if (location.includes('/spares')) {
    return {
      page: 'Spares Inventory',
      hint: 'User is viewing spares. Prioritize spare parts and stock level queries.'
    };
  }
  if (location.includes('/stores')) {
    return {
      page: 'Stores Inventory',
      hint: 'User is viewing stores. Prioritize consumables and stores queries.'
    };
  }
  if (location.includes('/running-hours') || location.includes('/running_hours')) {
    return {
      page: 'Running Hours',
      hint: 'User is viewing running hours. Prioritize equipment hours and maintenance timing queries.'
    };
  }
  if (location.includes('/defects')) {
    return {
      page: 'Defects',
      hint: 'User is viewing defects. Prioritize defect and repair queries.'
    };
  }
  if (location.includes('/admin')) {
    return {
      page: 'Admin',
      hint: 'User is in admin section. May need fleet-level or configuration queries.'
    };
  }
  return {
    page: 'PMS Dashboard',
    hint: 'User is on the main dashboard. Provide overview and summary information.'
  };
}

export function useChat() {
  const { vesselId, vessels } = useVessel();
  const { currentUser } = useAuth();
  const [location] = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentVessel = vessels.find(v => v.id === vesselId);
  const pageContext = getCurrentPageContext(location);

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
        currentPage: pageContext.page,
        pageHint: pageContext.hint,
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
  }, [vesselId, currentVessel, pageContext, currentUser, messages]);

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
