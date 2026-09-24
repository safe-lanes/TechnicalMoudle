import { MessageSquare, AlertTriangle, Package, Calendar, Wrench, Clock, FileText, Target, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SuggestedPromptsProps {
  onPromptClick: (prompt: string) => void;
}

// 23-Sep-2026: starter questions cover BOTH kinds of answer the assistant gives — live data for the selected
// vessel and "How do I …" questions answered from the user manuals (each how-to below verified on the pilot).
const primaryPrompts = [
  { text: "Show overdue work orders", icon: AlertTriangle },
  { text: "What's due this week?", icon: Calendar },
  { text: "How do I complete a work order?", icon: BookOpen },
  { text: "How do I update running hours?", icon: BookOpen },
];

const secondaryPrompts = [
  { text: "Low stock spares", icon: Package },
  { text: "PMS status summary", icon: FileText },
  { text: "Critical components", icon: Wrench },
  { text: "Running hours check", icon: Clock },
  { text: "How do I create an unplanned work order?", icon: BookOpen },
  { text: "How do I add a new spare part?", icon: BookOpen },
  { text: "What should I prioritize?", icon: Target },
  { text: "Draft maintenance briefing", icon: MessageSquare },
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
