import { MessageSquare, AlertTriangle, Package, Calendar, Wrench, Clock, FileText, Target } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SuggestedPromptsProps {
  onPromptClick: (prompt: string) => void;
}

const primaryPrompts = [
  { text: "Show overdue work orders", icon: AlertTriangle },
  { text: "Low stock spares", icon: Package },
  { text: "PMS status summary", icon: FileText },
  { text: "What's due this week?", icon: Calendar },
];

const secondaryPrompts = [
  { text: "Critical components", icon: Wrench },
  { text: "Running hours check", icon: Clock },
  { text: "Draft maintenance briefing", icon: MessageSquare },
  { text: "What should I prioritize?", icon: Target },
];

export function SuggestedPrompts({ onPromptClick }: SuggestedPromptsProps) {
  return (
    <div className="px-4 py-3 space-y-3" data-testid="suggested-prompts">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider" data-testid="text-suggested-label">
        Suggested Questions
      </p>
      <div className="grid grid-cols-1 gap-2">
        {primaryPrompts.map((prompt) => (
          <Button
            key={prompt.text}
            variant="outline"
            onClick={() => onPromptClick(prompt.text)}
            className="justify-start gap-2 text-sm"
            data-testid={`prompt-${prompt.text.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <prompt.icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span>{prompt.text}</span>
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-2">
        {secondaryPrompts.map((prompt) => (
          <Button
            key={prompt.text}
            variant="ghost"
            size="sm"
            onClick={() => onPromptClick(prompt.text)}
            className="justify-start gap-2 text-xs text-muted-foreground"
            data-testid={`prompt-${prompt.text.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <prompt.icon className="h-3 w-3 flex-shrink-0" />
            <span>{prompt.text}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
