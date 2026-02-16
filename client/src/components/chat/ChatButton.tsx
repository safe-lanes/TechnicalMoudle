import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChat } from "@/hooks/useChat";
import { ChatPanel } from "./ChatPanel";

export function ChatButton() {
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
            className="rounded-full shadow-lg"
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
