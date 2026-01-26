import { useState, useRef, useEffect } from "react";
import { X, Send, Sparkles, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChat } from "@/hooks/useChat";
import { ChatMessage } from "./ChatMessage";
import { SuggestedPrompts } from "./SuggestedPrompts";

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const INITIAL_PROMPTS = {
  primary: [
    "Show overdue work orders",
    "Low stock spares",
    "PMS status summary",
    "What's due this week?"
  ],
  secondary: [
    "Critical components",
    "Running hours check",
    "Draft maintenance briefing",
    "What should I prioritize?"
  ]
};

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  toolsUsed?: string[];
}

function getDynamicFollowUps(lastMessage: Message | undefined): string[] {
  if (!lastMessage || lastMessage.role !== 'assistant') return [];
  
  const content = lastMessage.content.toLowerCase();
  
  // For work orders
  if (content.includes('overdue') || content.includes('work order')) {
    return [
      'Show details of the most critical one',
      'Which system has most overdue items?',
      'What spares do I need for these?',
      'Take me to work orders page'
    ];
  }
  
  // For spares
  if (content.includes('spare') || content.includes('low stock') || content.includes('rob')) {
    return [
      'Show only critical items',
      'Group by component',
      'Draft requisition list',
      'Navigate to spares page'
    ];
  }
  
  // For components
  if (content.includes('component') || content.includes('equipment') || content.includes('running hours')) {
    return [
      'Show maintenance for this equipment',
      'Check running hours',
      'Related spares status',
      'View in components page'
    ];
  }
  
  // For summaries
  if (content.includes('status') || content.includes('summary') || content.includes('kpi')) {
    return [
      'Show overdue details',
      'Low stock breakdown',
      'Draft superintendent briefing',
      'What needs priority?'
    ];
  }
  
  // Default suggestions
  return [
    'Show overdue work orders',
    'Check low stock spares',
    'PMS status summary'
  ];
}

export function ChatPanel({ isOpen, onClose }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { messages, isLoading, error, sendMessage, clearMessages, vesselName, vesselId } = useChat();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      sendMessage(input);
      setInput("");
    }
  };

  const handlePromptClick = (prompt: string) => {
    sendMessage(prompt);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed right-0 top-0 h-full w-[420px] bg-background border-l shadow-lg z-[9991] flex flex-col"
      data-testid="chat-panel"
    >
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-semibold text-sm">PMS Assistant</h2>
            <p className="text-xs text-muted-foreground">
              {vesselId ? (vesselName || `Vessel ${vesselId}`) : "Select a vessel"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={clearMessages}
              title="Clear conversation"
              data-testid="button-clear-chat"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-chat">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="space-y-4">
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">
                  Ask me about work orders, spares, components, or maintenance status.
                </p>
              </div>
              <SuggestedPrompts 
                prompts={INITIAL_PROMPTS.primary} 
                onSelect={handlePromptClick}
                label="Quick actions"
                disabled={isLoading || !vesselId}
              />
              <SuggestedPrompts 
                prompts={INITIAL_PROMPTS.secondary} 
                onSelect={handlePromptClick}
                label="More options"
                disabled={isLoading || !vesselId}
              />
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map(msg => (
                <ChatMessage key={msg.id} message={msg} />
              ))}
              {isLoading && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Thinking...</span>
                </div>
              )}
              {!isLoading && messages.length > 0 && messages[messages.length - 1].role === 'assistant' && (
                <SuggestedPrompts
                  prompts={getDynamicFollowUps(messages[messages.length - 1])}
                  onSelect={handlePromptClick}
                  label="Quick follow-ups"
                  disabled={isLoading || !vesselId}
                />
              )}
            </div>
          )}
        </div>
        {error && (
          <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">
            {error}
          </div>
        )}
      </ScrollArea>

      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={vesselId ? "Ask about maintenance..." : "Select a vessel first"}
            disabled={isLoading || !vesselId}
            data-testid="input-chat-message"
          />
          <Button 
            type="submit" 
            size="icon" 
            disabled={isLoading || !input.trim() || !vesselId} 
            data-testid="button-send-message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
