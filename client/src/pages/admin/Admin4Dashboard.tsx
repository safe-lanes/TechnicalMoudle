import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useVessels } from "@/hooks/useVessels";
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
import type { PmsVesselSettings, Fleet } from "@shared/schema";

type ViewType = 'dashboard' | 'makers' | 'master-lists' | 'master-data' | 'master-data-table' | 'components' | 'jobs' | 'spares' | 'vessel-mapping' | 'pms-settings' | 'equipment-tree' | 'fleet-vessel-manager' | 'fleet-data' | 'locations';

export default function Admin4Dashboard({ onSubViewChange }: { onSubViewChange?: (isSubView: boolean) => void }) {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');

  useEffect(() => {
    onSubViewChange?.(currentView !== 'dashboard');
  }, [currentView, onSubViewChange]);

  const { data: makersData, isLoading: isMakersLoading } = useQuery({
    queryKey: ['/technical/api/fleet/makers'],
  });

  const { data: masterListsData, isLoading: isMasterListsLoading } = useQuery({
    queryKey: ['/technical/api/fleet/master-lists'],
  });

  const { data: componentsData, isLoading: isComponentsLoading } = useQuery({
    queryKey: ['/technical/api/fleet-admin/fleet-components'],
  });

  const { data: jobsData, isLoading: isJobsLoading } = useQuery({
    queryKey: ['/technical/api/fleet/jobs'],
  });

  const { data: sparesData, isLoading: isSparesLoading } = useQuery({
    queryKey: ['/technical/api/fleet/spares'],
  });

  const { data: pmsSettingsData, isLoading: isPmsSettingsLoading } = useQuery<PmsVesselSettings[]>({
    queryKey: ['/technical/api/pms-vessel-settings'],
  });

  const { data: vesselsData, isLoading: isVesselsLoading } = useVessels();

  const { data: fleetsData, isLoading: isFleetsLoading } = useQuery<Fleet[]>({
    queryKey: ['/technical/api/fleets'],
  });

  const { data: dashboardStats } = useQuery<any>({
    queryKey: ['/technical/api/fleet-admin/dashboard-stats'],
  });

  const totalMakers = Array.isArray(makersData) ? makersData.length : 0;
  const totalMasterLists = Array.isArray(masterListsData) ? masterListsData.length : 0;
  const totalComponents = Array.isArray(componentsData) ? componentsData.filter((c: any) => c.fleetEquipmentCode?.length === 10).length : 0;
  const totalJobs = Array.isArray(jobsData) ? jobsData.length : 0;
  const totalSpares = Array.isArray(sparesData) ? sparesData.length : 0;
  const totalVessels = Array.isArray(vesselsData) ? vesselsData.length : 0;
  const totalFleets = Array.isArray(fleetsData) ? fleetsData.length : 0;
  const configuredPmsSettings = Array.isArray(pmsSettingsData) ? pmsSettingsData.length : 0;

  const stats = dashboardStats || null;
  const pct = (v: number, max: number) => (max > 0 ? Math.round((v / max) * 100) : 0);

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

  return (
    <div className="space-y-5" data-testid="text-master-data-title">

      {/* ── Section 1: Fleet Level Data ── */}
      <div className="rounded-lg shadow-sm overflow-hidden border border-gray-200">
        <div className="bg-[#52BAF3] text-white px-5 py-3 font-semibold text-sm tracking-wide uppercase">
          Fleet Level Data
        </div>
        <div className="bg-white p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">

            {/* Maker List */}
            <button
              onClick={() => setCurrentView('makers')}
              className="text-left bg-white border border-gray-200 border-l-4 border-l-blue-500 rounded-lg p-4 hover:shadow-md transition-all group"
              data-testid="card-makers"
            >
              <div className="flex items-start justify-between">
                <div className="p-2 rounded-lg bg-blue-100">
                  <Building2 className="h-5 w-5 text-blue-600" />
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-[#52BAF3] transition-colors mt-1" />
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-gray-900" data-testid="widget-total-makers">
                  {isMakersLoading ? <span className="text-gray-400 text-base">—</span> : totalMakers}
                </div>
                <p className="text-sm text-gray-500 mt-0.5">Maker List</p>
              </div>
              {stats?.makers && (
                <div className="mt-3 flex gap-2 flex-wrap">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-600 border border-blue-200">{stats.makers.linked} linked</span>
                  {stats.makers.unlinked > 0 && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-50 text-gray-500 border border-gray-200">{stats.makers.unlinked} unused</span>}
                </div>
              )}
            </button>

            {/* Fleet Data → FleetDataView (FLEET COMPONENTS SFI tree) */}
            <button
              onClick={() => setCurrentView('fleet-data')}
              className="text-left bg-white border border-gray-200 border-l-4 border-l-sky-500 rounded-lg p-4 hover:shadow-md transition-all group"
              data-testid="card-fleet-data"
            >
              <div className="flex items-start justify-between">
                <div className="p-2 rounded-lg bg-sky-100">
                  <Box className="h-5 w-5 text-sky-600" />
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-[#52BAF3] transition-colors mt-1" />
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-gray-900" data-testid="widget-total-components">
                  {isComponentsLoading ? <span className="text-gray-400 text-base">—</span> : totalComponents}
                </div>
                <p className="text-sm text-gray-500 mt-0.5">Fleet Data</p>
              </div>
            </button>

            {/* Fleet Jobs */}
            <button
              onClick={() => setCurrentView('jobs')}
              className="text-left bg-white border border-gray-200 border-l-4 border-l-green-500 rounded-lg p-4 hover:shadow-md transition-all group"
              data-testid="card-jobs"
            >
              <div className="flex items-start justify-between">
                <div className="p-2 rounded-lg bg-green-100">
                  <Wrench className="h-5 w-5 text-green-600" />
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-[#52BAF3] transition-colors mt-1" />
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-gray-900" data-testid="widget-total-jobs">
                  {isJobsLoading ? <span className="text-gray-400 text-base">—</span> : totalJobs}
                </div>
                <p className="text-sm text-gray-500 mt-0.5">Fleet Jobs</p>
              </div>
              {stats?.jobs && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>{stats.jobs.withValidComponent} linked</span>
                    {stats.jobs.withInvalidComponent > 0 && <span className="text-amber-600">{stats.jobs.withInvalidComponent} unlinked</span>}
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-[#52BAF3]" style={{ width: `${pct(stats.jobs.withValidComponent, stats.jobs.total)}%` }} />
                  </div>
                </div>
              )}
            </button>

            {/* Fleet Spares */}
            <button
              onClick={() => setCurrentView('spares')}
              className="text-left bg-white border border-gray-200 border-l-4 border-l-orange-500 rounded-lg p-4 hover:shadow-md transition-all group"
              data-testid="card-spares"
            >
              <div className="flex items-start justify-between">
                <div className="p-2 rounded-lg bg-orange-100">
                  <Package className="h-5 w-5 text-orange-600" />
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-[#52BAF3] transition-colors mt-1" />
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-gray-900" data-testid="widget-total-spares">
                  {isSparesLoading ? <span className="text-gray-400 text-base">—</span> : totalSpares}
                </div>
                <p className="text-sm text-gray-500 mt-0.5">Fleet Spares</p>
              </div>
              {stats?.spares && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>{stats.spares.withValidComponent} linked</span>
                    {stats.spares.withInvalidComponent > 0 && <span className="text-amber-600">{stats.spares.withInvalidComponent} unlinked</span>}
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-[#52BAF3]" style={{ width: `${pct(stats.spares.withValidComponent, stats.spares.total)}%` }} />
                  </div>
                </div>
              )}
            </button>

            {/* Master Lists */}
            <button
              onClick={() => setCurrentView('master-lists')}
              className="text-left bg-white border border-gray-200 border-l-4 border-l-purple-500 rounded-lg p-4 hover:shadow-md transition-all group"
              data-testid="card-master-lists"
            >
              <div className="flex items-start justify-between">
                <div className="p-2 rounded-lg bg-purple-100">
                  <List className="h-5 w-5 text-purple-600" />
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-[#52BAF3] transition-colors mt-1" />
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-gray-900" data-testid="widget-total-master-lists">
                  {isMasterListsLoading ? <span className="text-gray-400 text-base">—</span> : totalMasterLists}
                </div>
                <p className="text-sm text-gray-500 mt-0.5">Master Lists</p>
              </div>
            </button>

            {/* Locations */}
            <button
              onClick={() => setCurrentView('locations')}
              className="text-left bg-white border border-gray-200 border-l-4 border-l-teal-500 rounded-lg p-4 hover:shadow-md transition-all group"
              data-testid="card-locations"
            >
              <div className="flex items-start justify-between">
                <div className="p-2 rounded-lg bg-teal-100">
                  <MapPin className="h-5 w-5 text-teal-600" />
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-[#52BAF3] transition-colors mt-1" />
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-gray-900">—</div>
                <p className="text-sm text-gray-500 mt-0.5">Locations</p>
              </div>
            </button>

            {/* Master Data */}
            <button
              onClick={() => setCurrentView('master-data-table')}
              className="text-left bg-white border border-gray-200 border-l-4 border-l-indigo-500 rounded-lg p-4 hover:shadow-md transition-all group"
              data-testid="card-master-data"
            >
              <div className="flex items-start justify-between">
                <div className="p-2 rounded-lg bg-indigo-100">
                  <FileCode2 className="h-5 w-5 text-indigo-600" />
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-[#52BAF3] transition-colors mt-1" />
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-gray-900" data-testid="widget-total-master-data">
                  {isComponentsLoading ? <span className="text-gray-400 text-base">—</span> : totalComponents}
                </div>
                <p className="text-sm text-gray-500 mt-0.5">Master Data</p>
              </div>
            </button>

          </div>
        </div>
      </div>

      {/* ── Section 2: Configuration & Mapping ── */}
      <div className="rounded-lg shadow-sm overflow-hidden border border-gray-200">
        <div className="bg-[#52BAF3] text-white px-5 py-3 font-semibold text-sm tracking-wide uppercase">
          Configuration &amp; Mapping
        </div>
        <div className="bg-white p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">

            {/* Vessel Mapping */}
            <button
              onClick={() => setCurrentView('vessel-mapping')}
              className="text-left bg-white border border-gray-200 border-l-4 border-l-blue-500 rounded-lg p-4 hover:shadow-md transition-all group"
              data-testid="card-vessel-mapping"
            >
              <div className="flex items-start justify-between">
                <div className="p-2 rounded-lg bg-blue-100">
                  <Ship className="h-5 w-5 text-blue-600" />
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-[#52BAF3] transition-colors mt-1" />
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-gray-900" data-testid="widget-vessel-mapping">
                  {isVesselsLoading ? <span className="text-gray-400 text-base">—</span> : totalVessels}
                </div>
                <p className="text-sm text-gray-500 mt-0.5">Vessel Mapping</p>
              </div>
            </button>

            {/* Fleet & Vessel */}
            <button
              onClick={() => setCurrentView('fleet-vessel-manager')}
              className="text-left bg-white border border-gray-200 border-l-4 border-l-indigo-500 rounded-lg p-4 hover:shadow-md transition-all group"
              data-testid="card-fleet-vessel"
            >
              <div className="flex items-start justify-between">
                <div className="p-2 rounded-lg bg-indigo-100">
                  <Anchor className="h-5 w-5 text-indigo-600" />
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-[#52BAF3] transition-colors mt-1" />
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-gray-900" data-testid="widget-fleet-vessel">
                  {isFleetsLoading || isVesselsLoading ? <span className="text-gray-400 text-base">—</span> : `${totalFleets} / ${totalVessels}`}
                </div>
                <p className="text-sm text-gray-500 mt-0.5">Fleet &amp; Vessel</p>
              </div>
            </button>

            {/* Lead Time & Grace */}
            <button
              onClick={() => setCurrentView('pms-settings')}
              className="text-left bg-white border border-gray-200 border-l-4 border-l-amber-500 rounded-lg p-4 hover:shadow-md transition-all group"
              data-testid="card-lead-time"
            >
              <div className="flex items-start justify-between">
                <div className="p-2 rounded-lg bg-amber-100">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-[#52BAF3] transition-colors mt-1" />
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-gray-900" data-testid="widget-pms-settings">
                  {isPmsSettingsLoading || isVesselsLoading ? <span className="text-gray-400 text-base">—</span> : `${configuredPmsSettings} / ${totalVessels}`}
                </div>
                <p className="text-sm text-gray-500 mt-0.5">Lead Time &amp; Grace</p>
              </div>
              {!isPmsSettingsLoading && !isVesselsLoading && totalVessels > 0 && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>{configuredPmsSettings} configured</span>
                    <span>{totalVessels - configuredPmsSettings} pending</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-[#52BAF3]" style={{ width: `${pct(configuredPmsSettings, totalVessels)}%` }} />
                  </div>
                </div>
              )}
            </button>

          </div>
        </div>
      </div>

    </div>
  );
}
