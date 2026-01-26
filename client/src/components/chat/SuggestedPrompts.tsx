import { Button } from "@/components/ui/button";

interface SuggestedPromptsProps {
  prompts: string[];
  onSelect: (prompt: string) => void;
  label?: string;
  disabled?: boolean;
}

export function SuggestedPrompts({ prompts, onSelect, label, disabled }: SuggestedPromptsProps) {
  return (
    <div className="space-y-2">
      {label && (
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {prompts.map((prompt, index) => (
          <Button
            key={index}
            variant="outline"
            size="sm"
            onClick={() => onSelect(prompt)}
            disabled={disabled}
            className="text-xs h-auto py-1.5 px-3"
            data-testid={`prompt-chip-${index}`}
          >
            {prompt}
          </Button>
        ))}
      </div>
    </div>
  );
}
