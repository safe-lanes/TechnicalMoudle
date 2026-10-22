import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm"; // 23-Sep-2026: tables in assistant answers rendered as raw pipes without GFM
import { useState } from "react";
import { Bot, Flag, User } from "lucide-react";
import { useLocation } from "wouter";
import type { ChatMessage as ChatMessageType } from "@/hooks/useChat";
import { reportAnswer } from "@/assistant-widget/assistantClient";

/** 30-Sep-2026: "Report this answer" — files a review item for the module's knowledge trainers; it never changes the answer. */
function ReportAnswer({ message }: { message: ChatMessageType }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [err, setErr] = useState("");

  if (state === "sent") {
    return <p className="mt-1 text-[11px] text-muted-foreground" data-testid="text-report-sent">Sent to the module's knowledge trainers for review. Thank you.</p>;
  }
  if (!open) {
    return (
      <button
        type="button"
        className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
        data-testid="button-report-answer"
      >
        <Flag className="h-3 w-3" /> Report this answer
      </button>
    );
  }
  const send = async () => {
    setState("sending");
    setErr("");
    try {
      await reportAnswer({ question: message.question ?? "", answer: message.content, note: note.trim(), citations: message.citations });
      setState("sent");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
      setState("failed");
    }
  };
  return (
    <div className="mt-2 space-y-1" data-testid="form-report-answer">
      <textarea
        className="w-full rounded border bg-background p-1 text-xs text-foreground"
        rows={3}
        placeholder="What is wrong or missing in this answer?"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        data-testid="input-report-note"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded bg-primary px-2 py-0.5 text-[11px] text-primary-foreground disabled:opacity-50"
          disabled={state === "sending" || !note.trim()}
          onClick={send}
          data-testid="button-report-send"
        >
          {state === "sending" ? "Sending…" : "Send"}
        </button>
        <button type="button" className="text-[11px] text-muted-foreground" onClick={() => setOpen(false)} data-testid="button-report-cancel">
          Cancel
        </button>
        {state === "failed" && <span className="text-[11px] text-destructive" data-testid="text-report-error">Could not send: {err}</span>}
      </div>
    </div>
  );
}

interface ChatMessageProps {
  message: ChatMessageType;
  /** the central service supports reports (knowledgeEligibility().supported); hidden otherwise */
  canReport?: boolean;
}

export function ChatMessage({ message, canReport = false }: ChatMessageProps) {
  const isUser = message.role === "user";
  const [, setLocation] = useLocation();

  return (
    <div
      className={`flex gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}
      data-testid={`chat-message-${message.role}`}
    >
      <div
        className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        }`}
        data-testid={`icon-chat-avatar-${message.role}`}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted"
        }`}
      >
        {isUser ? (
          <p>{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none [&_table]:text-xs [&_th]:px-2 [&_th]:py-1 [&_td]:px-2 [&_td]:py-1 [&_p]:my-1 [&_h2]:text-sm [&_h2]:mt-2 [&_h2]:mb-1 [&_h3]:text-xs [&_h3]:mt-2 [&_h3]:mb-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // narrow screens (the panel is full-width on phones, 400px on desktop): a wide table
                // scrolls sideways inside the bubble instead of breaking the layout
                table: ({ children }) => (
                  <div className="overflow-x-auto -mx-1 my-1" data-testid="chat-table">
                    <table className="min-w-full border-collapse whitespace-nowrap">{children}</table>
                  </div>
                ),
                a: ({ href, children }) => (
                  <a
                    href={href}
                    className="text-primary underline hover:no-underline"
                    data-testid="chat-link"
                    onClick={(e) => {
                      if (href?.startsWith("/")) {
                        e.preventDefault();
                        setLocation(href);
                      }
                    }}
                  >
                    {children}
                  </a>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}
        {message.toolsUsed && message.toolsUsed.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {message.toolsUsed.map((tool) => (
              <span
                key={tool}
                className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-background/50 text-muted-foreground"
                data-testid={`tag-tool-${tool}`}
              >
                {tool.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        )}
        {!isUser && canReport && message.question && <ReportAnswer message={message} />}
      </div>
    </div>
  );
}

export function ChatLoadingIndicator() {
  return (
    <div className="flex gap-2" data-testid="chat-loading">
      <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-muted text-muted-foreground" data-testid="icon-chat-loading-avatar">
        <Bot className="h-4 w-4" />
      </div>
      <div className="bg-muted rounded-lg px-3 py-2">
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
