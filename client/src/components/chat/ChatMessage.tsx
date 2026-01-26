import { cn } from "@/lib/utils";
import { Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useLocation } from "wouter";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  toolsUsed?: string[];
}

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isAssistant = message.role === "assistant";
  const [, setLocation] = useLocation();

  const handleLinkClick = (href: string) => {
    if (href.startsWith('/')) {
      setLocation(href);
    } else {
      window.open(href, '_blank');
    }
  };

  return (
    <div 
      className={cn(
        "flex gap-3",
        isAssistant ? "flex-row" : "flex-row-reverse"
      )} 
      data-testid={`chat-message-${message.role}-${message.id}`}
    >
      <div className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
        isAssistant ? "bg-primary text-primary-foreground" : "bg-muted"
      )}>
        {isAssistant ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
      </div>
      <div className={cn(
        "flex flex-col gap-1 max-w-[85%]",
        isAssistant ? "items-start" : "items-end"
      )}>
        <div className={cn(
          "rounded-lg px-3 py-2 text-sm",
          isAssistant ? "bg-muted" : "bg-primary text-primary-foreground"
        )}>
          {isAssistant ? (
            <div className="prose prose-sm dark:prose-invert max-w-none [&_table]:text-xs [&_th]:px-2 [&_td]:px-2 [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0">
              <ReactMarkdown 
                components={{
                  a: ({ href, children }) => (
                    <button
                      onClick={() => href && handleLinkClick(href)}
                      className="text-primary hover:underline cursor-pointer bg-transparent border-none p-0 font-inherit"
                      data-testid={`link-chat-${href?.replace(/[^a-z0-9]/gi, '-') || 'unknown'}`}
                    >
                      {children}
                    </button>
                  ),
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-2">
                      <table className="border-collapse text-xs w-full">{children}</table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th className="border border-border px-2 py-1 bg-muted font-medium text-left">{children}</th>
                  ),
                  td: ({ children }) => (
                    <td className="border border-border px-2 py-1">{children}</td>
                  )
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="whitespace-pre-wrap">{message.content}</p>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}
