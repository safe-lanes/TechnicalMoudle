import { useState, useRef, useEffect } from "react";
import { X, Send, Trash2, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatMessage, ChatLoadingIndicator } from "./ChatMessage";
import { SuggestedPrompts } from "./SuggestedPrompts";
import type { ChatMessage as ChatMessageType } from "@/hooks/useChat";

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessageType[];
  isLoading: boolean;
  error: string | null;
  onSendMessage: (message: string) => void;
  onClearMessages: () => void;
}

export function ChatPanel({
  isOpen,
  onClose,
  messages,
  isLoading,
  error,
  onSendMessage,
  onClearMessages,
}: ChatPanelProps) {
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    onSendMessage(inputValue);
    setInputValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 sm:hidden"
          onClick={onClose}
          data-testid="chat-overlay"
        />
      )}
      <div
        className={`fixed inset-y-0 right-0 w-full sm:w-[400px] bg-background border-l shadow-xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        data-testid="chat-panel"
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b bg-primary text-primary-foreground">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            <h2 className="font-semibold text-sm" data-testid="text-chat-title">PMS Assistant</h2>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <Button
                size="icon"
                variant="ghost"
                onClick={onClearMessages}
                className="text-primary-foreground no-default-hover-elevate"
                data-testid="button-clear-chat"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              onClick={onClose}
              className="text-primary-foreground no-default-hover-elevate"
              data-testid="button-close-chat"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center pt-6">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3" data-testid="icon-chat-bot">
                <Bot className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm font-medium mb-1" data-testid="text-chat-welcome">PMS Assistant</p>
              <p className="text-xs text-muted-foreground text-center px-8 mb-4" data-testid="text-chat-description">
                Ask me about work orders, spares, components, or maintenance
                status for your vessel.
              </p>
              <SuggestedPrompts onPromptClick={onSendMessage} />
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {messages.map((msg, i) => (
                <ChatMessage key={i} message={msg} />
              ))}
              {isLoading && <ChatLoadingIndicator />}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="border-t p-3 flex gap-2"
          data-testid="chat-input-form"
        >
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about maintenance, work orders, spares..."
            className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[40px] max-h-[100px]"
            rows={1}
            disabled={isLoading}
            data-testid="input-chat-message"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!inputValue.trim() || isLoading}
            data-testid="button-send-message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </>
  );
}
