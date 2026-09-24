import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChat } from "@/hooks/useChat";
import { useUIRole } from "@/contexts/UIRoleContext";
import { useSyncInstanceInfo } from "@/hooks/useSyncInstanceInfo";
import { ChatPanel } from "./ChatPanel";

export function ChatButton() {
  const { isSailAdmin } = useUIRole();
  // Shore-only (23-Sep-2026): the deployment mode (SYNC_INSTANCE_ID 'SHIP-…' → /sync/instance-info,
  // the same signal the sync screens use) hides the assistant on a ship for EVERY role, Sail Admin
  // included; the server refuses the assistant endpoints there too. Hidden until the mode is known so
  // a ship never shows the button while the query is in flight.
  const { isShip, isLoading: modeLoading } = useSyncInstanceInfo();
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

  if (modeLoading || isShip || !isSailAdmin) return null;

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