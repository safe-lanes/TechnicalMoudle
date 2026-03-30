
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

  const tabActiveClass = 'px-4 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer bg-[#52baf3] text-white';
  const tabInactiveClass = 'px-4 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer text-gray-700 hover:bg-gray-200';

  return (
    <div
      style={{ background: '#FFFFFF', borderBottom: '1px solid #e5e7eb', padding: '10px 20px' }}
      data-testid="bar-fleet-vessel-context"
    >
      <div className="flex items-center justify-between flex-wrap gap-y-2 relative">
        <div className="flex items-center gap-4">
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#1a2b4a', margin: 0 }} data-testid="text-dashboard-title">
            Dashboard
          </h1>

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
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
          <div className="bg-gray-100 rounded-md p-1 flex items-center gap-1">
            <button
              className={activeTab === 'overview' ? tabActiveClass : tabInactiveClass}
              onClick={() => onTabChange?.('overview')}
              data-testid="tab-overview"
            >
              Overview
            </button>
            <button
              className={activeTab === 'management' ? tabActiveClass : tabInactiveClass}
              onClick={() => onTabChange?.('management')}
              data-testid="tab-management"
            >
              Management
            </button>
          </div>
          <div className="bg-gray-100 rounded-md p-1 flex items-center gap-1">
            <button
              className={isAllVessels ? tabActiveClass : tabInactiveClass}
              onClick={() => onAllVesselsChange(true)}
              data-testid="toggle-all-vessels"
            >
              All Vessel
            </button>
            <button
              className={!isAllVessels ? tabActiveClass : tabInactiveClass}
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
        </div>
      </div>
    </div>
  );
}