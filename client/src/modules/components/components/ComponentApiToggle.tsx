import { useApiVersion } from "../hooks/useApiVersion";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function ComponentApiToggle() {
  const { mode, toggleMode, isV2 } = useApiVersion();

  return (
    <div className="flex items-center gap-2" data-testid="component-api-toggle">
      <Label 
        htmlFor="api-version-toggle" 
        className="text-xs text-muted-foreground cursor-pointer"
        data-testid="text-api-mode-label"
      >
        API
      </Label>
      <Switch
        id="api-version-toggle"
        checked={isV2}
        onCheckedChange={toggleMode}
        data-testid="switch-api-version"
      />
      <Badge 
        variant={isV2 ? "default" : "secondary"}
        className="text-xs"
        data-testid="badge-api-mode"
      >
        {isV2 ? "V2" : "Legacy"}
      </Badge>
    </div>
  );
}
