import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChat } from "@/hooks/useChat";
import { useUIRole } from "@/contexts/UIRoleContext";
import { ChatPanel } from "./ChatPanel";

export function ChatButton() {
  const { isSailAdmin } = useUIRole();
  const {
    messages,
    isLoading,
    error,
    isOpen,
    sendMessage,
    toggleChat,
    closeChat,
    clearMessages,
  } = useChat();

  if (!isSailAdmin) return null;

  return (
    <>
      <ChatPanel
        isOpen={isOpen}
        onClose={closeChat}
        messages={messages}
        isLoading={isLoading}
        error={error}
        onSendMessage={sendMessage}
        onClearMessages={clearMessages}
      />

      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button
            onClick={toggleChat}
            size="icon"
            variant="outline"
            className="rounded-full"
            style={{
              background: '#ffffff',
              borderColor: '#1a6eb5',
              color: '#1a6eb5',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}
            data-testid="button-open-chat"
            aria-label="Open PMS Assistant"
          >
            <MessageCircle className="h-5 w-5" />
          </Button>
        </div>
      )}
    </>
  );
}