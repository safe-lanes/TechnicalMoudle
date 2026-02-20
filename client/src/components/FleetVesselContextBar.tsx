import { Ship, Anchor } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Vessel {
  id: string;
  name: string;
  vesselType?: string;
}

interface FleetVesselContextBarProps {
  isFleetView: boolean;
  onViewModeChange: (isFleet: boolean) => void;
  vesselId: string;
  onVesselChange: (vesselId: string) => void;
  vessels: Vessel[];
}

export function FleetVesselContextBar({
  isFleetView,
  onViewModeChange,
  vesselId,
  onVesselChange,
  vessels,
}: FleetVesselContextBarProps) {
  const currentVessel = vessels.find(v => v.id === vesselId);
  const viewMode = isFleetView ? "fleet" : "vessel";

  const handleViewModeChange = (value: string) => {
    onViewModeChange(value === "fleet");
  };

  const scopeText = isFleetView
    ? "Entire fleet"
    : currentVessel
      ? currentVessel.name
      : "No vessel selected";

  return (
    <div
      className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2 border-b border-border bg-muted/40"
      data-testid="bar-fleet-vessel-context"
    >
      <span className="text-xs font-medium text-muted-foreground whitespace-nowrap" data-testid="text-context-label">
        Current context:
      </span>

      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground whitespace-nowrap">View:</label>
        <Select value={viewMode} onValueChange={handleViewModeChange}>
          <SelectTrigger className="w-40 text-xs" data-testid="select-view-mode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fleet" data-testid="option-fleet-view">Fleet view</SelectItem>
            <SelectItem value="vessel" data-testid="option-vessel-view">Single vessel view</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!isFleetView && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground whitespace-nowrap">Vessel:</label>
          <Ship className="w-3.5 h-3.5 text-muted-foreground" />
          <Select value={vesselId} onValueChange={onVesselChange}>
            <SelectTrigger className="w-48 text-xs" data-testid="select-context-vessel">
              <SelectValue placeholder="Select vessel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" data-testid="option-all-vessels">All Vessels</SelectItem>
              {vessels.map(v => (
                <SelectItem key={v.id} value={v.id} data-testid={`option-vessel-${v.id}`}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {currentVessel?.vesselType && (
            <span
              className="text-xs text-muted-foreground whitespace-nowrap"
              data-testid="text-vessel-type"
            >
              Type: {currentVessel.vesselType}
            </span>
          )}
        </div>
      )}

      <div className="ml-auto flex items-center gap-1.5">
        <Anchor className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground whitespace-nowrap" data-testid="text-scope">
          Scope: {scopeText}
        </span>
      </div>
    </div>
  );
}
