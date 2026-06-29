import { useState, useEffect } from "react";
import { Building2, List, Box, Wrench, Package, Ship, Clock, FileCode2, Anchor, MapPin, ChevronRight } from "lucide-react";
import MakerManagement from "./MakerManagement";
import MasterListsManagement from "./MasterListsManagement";
import MasterDataManagement from "./MasterDataManagement";
import MasterDataTableView from "./MasterDataTableView";
import FleetComponentsManagement from "./FleetComponentsManagement";
import FleetJobsManagement from "./FleetJobsManagement";
import FleetSparesManagement from "./FleetSparesManagement";
import FleetVesselMapping from "./FleetVesselMapping";
import PmsVesselSettingsManagement from "./PmsVesselSettingsManagement";
import FleetEquipmentTreeView from "./FleetEquipmentTreeView";
import FleetVesselManager from "./FleetVesselManager";
import FleetDataView from "./FleetDataView";
import LocationManagement from "./LocationManagement";

type ViewType = 'dashboard' | 'makers' | 'master-lists' | 'master-data' | 'master-data-table' | 'components' | 'jobs' | 'spares' | 'vessel-mapping' | 'pms-settings' | 'equipment-tree' | 'fleet-vessel-manager' | 'fleet-data' | 'locations';

export default function Admin4Dashboard({ onSubViewChange }: { onSubViewChange?: (isSubView: boolean) => void }) {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');

  useEffect(() => {
    onSubViewChange?.(currentView !== 'dashboard');
  }, [currentView, onSubViewChange]);

  const handleBackToDashboard = () => setCurrentView('dashboard');

  if (currentView === 'makers') return <MakerManagement onBack={handleBackToDashboard} />;
  if (currentView === 'master-lists') return <MasterListsManagement onBack={handleBackToDashboard} />;
  if (currentView === 'master-data') return <MasterDataManagement onBack={handleBackToDashboard} />;
  if (currentView === 'master-data-table') return <MasterDataTableView onBack={handleBackToDashboard} />;
  if (currentView === 'components') return <FleetComponentsManagement onBack={handleBackToDashboard} />;
  if (currentView === 'jobs') return <FleetJobsManagement onBack={handleBackToDashboard} />;
  if (currentView === 'spares') return <FleetSparesManagement onBack={handleBackToDashboard} />;
  if (currentView === 'vessel-mapping') return <FleetVesselMapping onBack={handleBackToDashboard} />;
  if (currentView === 'pms-settings') return <PmsVesselSettingsManagement onBack={handleBackToDashboard} />;
  if (currentView === 'equipment-tree') return <FleetEquipmentTreeView onBack={handleBackToDashboard} />;
  if (currentView === 'fleet-vessel-manager') return <FleetVesselManager onBack={handleBackToDashboard} />;
  if (currentView === 'fleet-data') return <FleetDataView onBack={handleBackToDashboard} />;
  if (currentView === 'locations') return <LocationManagement onBack={handleBackToDashboard} />;

  /* ── Section 1 card ── */
  const Card1 = ({
    view, icon: Icon, label, description,
    colorIcon, colorUnderline, colorBg, colorChevron, testId,
  }: {
    view: ViewType; icon: React.ElementType; label: string; description: string;
    colorIcon: string; colorUnderline: string; colorBg: string; colorChevron: string; testId: string;
  }) => (
    <button
      onClick={() => setCurrentView(view)}
      className="text-left bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all group flex items-start gap-4"
      data-testid={testId}
    >
      <div className={`p-3 rounded-xl flex-shrink-0 ${colorBg}`}>
        <Icon className={`h-8 w-8 ${colorIcon}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <span className="text-base font-semibold text-gray-900">{label}</span>
          <ChevronRight className={`h-5 w-5 text-gray-300 ${colorChevron} transition-colors flex-shrink-0 mt-0.5`} />
        </div>
        <div className={`w-8 h-0.5 ${colorUnderline} mt-1.5 mb-2 rounded-full`} />
        <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
      </div>
    </button>
  );

  /* ── Section 2 card ── */
  const Card2 = ({
    view, icon: Icon, label, description,
    colorIcon, colorUnderline, colorIconBg, colorCardBg, colorBorder, colorChevron, testId,
  }: {
    view: ViewType; icon: React.ElementType; label: string; description: string;
    colorIcon: string; colorUnderline: string; colorIconBg: string;
    colorCardBg: string; colorBorder: string; colorChevron: string; testId: string;
  }) => (
    <button
      onClick={() => setCurrentView(view)}
      className={`relative overflow-hidden text-left rounded-xl p-6 hover:shadow-md transition-all group border ${colorBorder} ${colorCardBg}`}
      data-testid={testId}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.07) 1px, transparent 1px)',
          backgroundSize: '18px 18px',
        }}
      />
      <div className="relative flex items-start gap-4">
        <div className={`p-3 rounded-xl flex-shrink-0 ${colorIconBg}`}>
          <Icon className={`h-9 w-9 ${colorIcon}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <span className="text-base font-semibold text-gray-900">{label}</span>
            <ChevronRight className={`h-5 w-5 text-gray-300 ${colorChevron} transition-colors flex-shrink-0 mt-0.5`} />
          </div>
          <div className={`w-8 h-0.5 ${colorUnderline} mt-1.5 mb-2 rounded-full`} />
          <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
        </div>
      </div>
    </button>
  );

  return (
    <div>

      {/* ── Page header ── */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900" data-testid="text-master-data-title">Master Data</h1>
        <p className="text-sm text-gray-500 mt-1">Manage and maintain key master data for PMS.</p>
      </div>

      {/* ── Section 1: 7 cards, no bar header ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card1
          view="makers" icon={Building2} label="Maker List"
          description="Manage and maintain maker information."
          colorBg="bg-blue-50" colorIcon="text-blue-500" colorUnderline="bg-blue-400"
          colorChevron="group-hover:text-blue-400"
          testId="card-makers"
        />
        <Card1
          view="fleet-data" icon={Box} label="Fleet Data"
          description="Manage fleet and vessel related master data."
          colorBg="bg-teal-50" colorIcon="text-teal-500" colorUnderline="bg-teal-400"
          colorChevron="group-hover:text-teal-400"
          testId="card-fleet-data"
        />
        <Card1
          view="jobs" icon={Wrench} label="Fleet Jobs"
          description="Manage and maintain fleet job master data."
          colorBg="bg-green-50" colorIcon="text-green-500" colorUnderline="bg-green-400"
          colorChevron="group-hover:text-green-400"
          testId="card-jobs"
        />
        <Card1
          view="spares" icon={Package} label="Fleet Spares"
          description="Manage and maintain fleet spare data."
          colorBg="bg-orange-50" colorIcon="text-orange-500" colorUnderline="bg-orange-400"
          colorChevron="group-hover:text-orange-400"
          testId="card-spares"
        />
        <Card1
          view="master-lists" icon={List} label="Master Lists"
          description="Manage system master lists and values."
          colorBg="bg-purple-50" colorIcon="text-purple-500" colorUnderline="bg-purple-400"
          colorChevron="group-hover:text-purple-400"
          testId="card-master-lists"
        />
        <Card1
          view="locations" icon={MapPin} label="Locations"
          description="Manage and maintain location master data."
          colorBg="bg-emerald-50" colorIcon="text-emerald-500" colorUnderline="bg-emerald-400"
          colorChevron="group-hover:text-emerald-400"
          testId="card-locations"
        />
        <Card1
          view="master-data-table" icon={FileCode2} label="Master Data"
          description="Central hub for all master data modules."
          colorBg="bg-indigo-50" colorIcon="text-indigo-500" colorUnderline="bg-indigo-400"
          colorChevron="group-hover:text-indigo-400"
          testId="card-master-data"
        />
      </div>

      {/* ── Section 2: Configuration & Mapping ── */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Configuration &amp; Mapping</h2>
        <p className="text-sm text-gray-500 mt-0.5">Maintain system configuration and mapping for smooth operations.</p>
        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card2
            view="vessel-mapping" icon={Ship} label="Vessel Mapping"
            description="Configure and manage vessel mapping across the system."
            colorCardBg="bg-blue-50/60" colorBorder="border-blue-100"
            colorIconBg="bg-blue-100" colorIcon="text-blue-500"
            colorUnderline="bg-blue-400" colorChevron="group-hover:text-blue-400"
            testId="card-vessel-mapping"
          />
          <Card2
            view="fleet-vessel-manager" icon={Anchor} label="Fleet &amp; Vessel"
            description="Map and maintain fleets with respective vessels."
            colorCardBg="bg-indigo-50/60" colorBorder="border-indigo-100"
            colorIconBg="bg-indigo-100" colorIcon="text-indigo-500"
            colorUnderline="bg-indigo-400" colorChevron="group-hover:text-indigo-400"
            testId="card-fleet-vessel"
          />
          <Card2
            view="pms-settings" icon={Clock} label="Lead Time &amp; Grace"
            description="Configure lead time and grace period settings."
            colorCardBg="bg-amber-50/60" colorBorder="border-amber-100"
            colorIconBg="bg-amber-100" colorIcon="text-amber-500"
            colorUnderline="bg-amber-400" colorChevron="group-hover:text-amber-400"
            testId="card-lead-time"
          />
        </div>
      </div>

    </div>
  );
}
