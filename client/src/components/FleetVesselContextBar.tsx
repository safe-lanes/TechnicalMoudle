import { Ship, LayoutDashboard } from "lucide-react";
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
      style={{ background: '#FFFFFF', borderBottom: '1px solid #E0E0E0' }}
      data-testid="bar-fleet-vessel-context"
    >
      <div className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 flex-shrink-0" style={{ color: '#1565C0' }} />
            <h1 className="text-base font-bold truncate" style={{ color: '#212121' }} data-testid="text-dashboard-title">
              PMS Dashboard
            </h1>
          </div>
          {summaryLine && (
            <p className="text-xs pl-7 truncate" style={{ color: '#9E9E9E' }} data-testid="text-hero-summary">
              {summaryLine}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium whitespace-nowrap" style={{ color: '#757575' }}>View:</label>
            <Select value={viewMode} onValueChange={handleViewModeChange}>
              <SelectTrigger className="w-40 text-xs h-8 border-gray-300" data-testid="select-view-mode">
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
              <label className="text-xs font-medium whitespace-nowrap" style={{ color: '#757575' }}>Vessel:</label>
              <Ship className="w-3.5 h-3.5" style={{ color: '#757575' }} />
              <Select value={vesselId} onValueChange={onVesselChange}>
                <SelectTrigger className="w-48 text-xs h-8 border-gray-300" data-testid="select-context-vessel">
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
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium whitespace-nowrap" style={{ color: '#757575' }} data-testid="text-scope">
              Scope: <span style={{ color: '#1565C0', fontWeight: 600 }}>{scopeText}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
