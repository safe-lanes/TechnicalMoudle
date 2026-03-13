import { SlidersHorizontal } from "lucide-react";

interface Vessel {
  id: string;
  name: string;
  vesselType?: string;
}

interface FleetVesselContextBarProps {
  isAllVessels: boolean;
  onAllVesselsChange: (isAll: boolean) => void;
  vesselId: string;
  onVesselChange: (vesselId: string) => void;
  vessels: Vessel[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export function FleetVesselContextBar({
  isAllVessels,
  onAllVesselsChange,
  vesselId,
  onVesselChange,
  vessels,
  activeTab = "overview",
  onTabChange,
}: FleetVesselContextBarProps) {
  const currentYear = new Date().getFullYear();

  const pillBase: React.CSSProperties = {
    padding: '5px 18px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
    borderRadius: '20px',
  };

  const tabPillActive: React.CSSProperties = {
    ...pillBase,
    backgroundColor: '#1a2b4a',
    color: '#ffffff',
    border: 'none',
  };

  const tabPillInactive: React.CSSProperties = {
    ...pillBase,
    backgroundColor: '#e2e8f0',
    color: '#64748b',
    border: 'none',
  };

  const vesselPillActive: React.CSSProperties = {
    ...pillBase,
    padding: '5px 16px',
    backgroundColor: '#1a2b4a',
    color: '#ffffff',
    border: 'none',
  };

  const vesselPillInactive: React.CSSProperties = {
    ...pillBase,
    padding: '5px 16px',
    backgroundColor: '#ffffff',
    color: '#374151',
    border: '1px solid #e2e8f0',
  };

  return (
    <div
      style={{ background: '#FFFFFF', borderBottom: '1px solid #e5e7eb', padding: '10px 20px' }}
      data-testid="bar-fleet-vessel-context"
    >
      <div className="flex items-center justify-between flex-wrap gap-y-2">
        <div className="flex items-center gap-4">
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#1a2b4a', margin: 0 }} data-testid="text-dashboard-title">
            Dashboard
          </h1>

          {!isAllVessels && (
            <select
              value={vesselId}
              onChange={(e) => onVesselChange(e.target.value)}
              style={{
                padding: '5px 10px',
                fontSize: '12px',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                background: '#FFFFFF',
                color: '#374151',
                cursor: 'pointer',
                outline: 'none',
                height: '32px',
              }}
              data-testid="select-context-vessel"
            >
              {vessels.map(v => (
                <option key={v.id} value={v.id} data-testid={`option-vessel-${v.id}`}>
                  {v.name}
                </option>
              ))}
            </select>
          )}

          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              style={activeTab === 'overview' ? tabPillActive : tabPillInactive}
              onClick={() => onTabChange?.('overview')}
              data-testid="tab-overview"
            >
              Overview
            </button>
            <button
              style={activeTab === 'management' ? tabPillActive : tabPillInactive}
              onClick={() => onTabChange?.('management')}
              data-testid="tab-management"
            >
              Management
            </button>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              style={isAllVessels ? vesselPillActive : vesselPillInactive}
              onClick={() => onAllVesselsChange(true)}
              data-testid="toggle-all-vessels"
            >
              All Vessel
            </button>
            <button
              style={!isAllVessels ? vesselPillActive : vesselPillInactive}
              onClick={() => onAllVesselsChange(false)}
              data-testid="toggle-my-vessel"
            >
              My Vessel
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#1a2b4a' }} data-testid="text-current-year">
            {currentYear}
          </div>

          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              background: '#FFFFFF',
              color: '#374151',
              cursor: 'pointer',
            }}
            data-testid="button-filters"
          >
            <SlidersHorizontal style={{ width: '14px', height: '14px' }} />
            Filters
          </button>
        </div>
      </div>
    </div>
  );
}