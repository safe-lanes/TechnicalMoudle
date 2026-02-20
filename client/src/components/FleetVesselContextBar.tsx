import { Ship, Anchor, LayoutDashboard } from "lucide-react";
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
  summaryLine?: string;
}

export function FleetVesselContextBar({
  isFleetView,
  onViewModeChange,
  vesselId,
  onVesselChange,
  vessels,
  summaryLine,
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
      className="bg-gradient-to-r from-slate-50 to-blue-50/60 dark:from-slate-900 dark:to-blue-950/40 border-b border-border"
      data-testid="bar-fleet-vessel-context"
    >
      <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate" data-testid="text-dashboard-title">
              PMS Dashboard
            </h1>
          </div>
          {summaryLine && (
            <p className="text-xs text-muted-foreground pl-6 truncate" data-testid="text-hero-summary">
              {summaryLine}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 flex-shrink-0">
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

          <div className="flex items-center gap-1.5">
            <Anchor className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground whitespace-nowrap" data-testid="text-scope">
              Scope: {scopeText}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
