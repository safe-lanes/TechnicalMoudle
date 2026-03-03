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
    padding: '5px 16px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
    letterSpacing: '0.02em',
    borderRadius: '20px',
  };

  const pillActive: React.CSSProperties = {
    ...pillBase,
    background: '#1a3a5c',
    color: '#FFFFFF',
    border: '1px solid #1a3a5c',
  };

  const pillInactive: React.CSSProperties = {
    ...pillBase,
    background: '#FFFFFF',
    color: '#1a3a5c',
    border: '1px solid #1a3a5c',
  };

  return (
    <div
      style={{ background: '#FFFFFF', borderBottom: '1px solid #e0e0e0', padding: '10px 20px' }}
      data-testid="bar-fleet-vessel-context"
    >
      <div className="flex items-center justify-between flex-wrap gap-y-2">
        <div className="flex items-center gap-4">
          <h1 style={{ fontSize: '16px', fontWeight: 700, color: '#212121', margin: 0 }} data-testid="text-dashboard-title">
            Dashboard
          </h1>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              style={activeTab === 'overview' ? pillActive : pillInactive}
              onClick={() => onTabChange?.('overview')}
              data-testid="tab-overview"
            >
              Overview
            </button>
            <button
              style={activeTab === 'management' ? pillActive : pillInactive}
              onClick={() => onTabChange?.('management')}
              data-testid="tab-management"
            >
              Management
            </button>
          </div>
        </div>

        <div style={{ fontSize: '22px', fontWeight: 700, color: '#212121' }} data-testid="text-current-year">
          {currentYear}
        </div>

        <div className="flex items-center gap-3">
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              style={isAllVessels ? pillActive : pillInactive}
              onClick={() => onAllVesselsChange(true)}
              data-testid="toggle-all-vessels"
            >
              All Vessel
            </button>
            <button
              style={!isAllVessels ? pillActive : pillInactive}
              onClick={() => onAllVesselsChange(false)}
              data-testid="toggle-my-vessel"
            >
              My Vessel
            </button>
          </div>

          {!isAllVessels && (
            <select
              value={vesselId}
              onChange={(e) => onVesselChange(e.target.value)}
              style={{
                padding: '5px 10px',
                fontSize: '12px',
                border: '1px solid #D0D5DD',
                borderRadius: '6px',
                background: '#FFFFFF',
                color: '#212121',
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

          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '5px 14px',
              fontSize: '12px',
              fontWeight: 600,
              border: '1px solid #D0D5DD',
              borderRadius: '6px',
              background: '#FFFFFF',
              color: '#546E7A',
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