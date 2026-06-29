import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useVessels } from "@/hooks/useVessels";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, List, Box, Wrench, Package, Clock, FileCode2, Anchor } from "lucide-react";
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

  const handleBackToDashboard = () => setCurrentView('dashboard');

  if (currentView === 'makers') {
    return <MakerManagement onBack={handleBackToDashboard} />;
  }

  if (currentView === 'master-lists') {
    return <MasterListsManagement onBack={handleBackToDashboard} />;
  }

  if (currentView === 'master-data') {
    return <MasterDataManagement onBack={handleBackToDashboard} />;
  }

  if (currentView === 'master-data-table') {
    return <MasterDataTableView onBack={handleBackToDashboard} />;
  }

  if (currentView === 'components') {
    return <FleetComponentsManagement onBack={handleBackToDashboard} />;
  }

  if (currentView === 'jobs') {
    return <FleetJobsManagement onBack={handleBackToDashboard} />;
  }

  if (currentView === 'spares') {
    return <FleetSparesManagement onBack={handleBackToDashboard} />;
  }

  if (currentView === 'vessel-mapping') {
    return <FleetVesselMapping onBack={handleBackToDashboard} />;
  }

  if (currentView === 'pms-settings') {
    return <PmsVesselSettingsManagement onBack={handleBackToDashboard} />;
  }

  if (currentView === 'equipment-tree') {
    return <FleetEquipmentTreeView onBack={handleBackToDashboard} />;
  }

  if (currentView === 'fleet-vessel-manager') {
    return <FleetVesselManager onBack={handleBackToDashboard} />;
  }

  if (currentView === 'fleet-data') {
    return <FleetDataView onBack={handleBackToDashboard} />;
  }

  if (currentView === 'locations') {
    return <LocationManagement onBack={handleBackToDashboard} />;
  }

  const pct = (v: number, max: number) => (max > 0 ? Math.round((v / max) * 100) : 0);

  const StatCard = ({
    icon: Icon,
    iconBg,
    iconColor,
    borderColor,
    count,
    label,
    loading,
    extra,
    actionLabel,
    onAction,
    testIdCard,
    testIdCount,
    testIdBtn,
  }: {
    icon: React.ElementType;
    iconBg: string;
    iconColor: string;
    borderColor: string;
    count: string | number;
    label: string;
    loading?: boolean;
    extra?: React.ReactNode;
    actionLabel: string;
    onAction: () => void;
    testIdCard: string;
    testIdCount: string;
    testIdBtn: string;
  }) => (
    <div className={`border-l-4 ${borderColor} bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow`} data-testid={testIdCard}>
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 ${iconBg} rounded-lg`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onAction}
          className="h-7 px-3 text-xs text-[#52BAF3] border-[#52BAF3] hover:bg-blue-50"
          data-testid={testIdBtn}
        >
          {actionLabel}
        </Button>
      </div>
      <div className="text-2xl font-bold text-gray-900" data-testid={testIdCount}>
        {loading ? '...' : count}
      </div>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      {extra}
    </div>
  );

  return (
    <div className="space-y-4" data-testid="master-data-dashboard">

      {/* Page title */}
      <h1 className="text-2xl font-bold text-gray-900" data-testid="text-master-data-title">Master Data</h1>

      {/* ── FLEET DATA ── */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="bg-[#52BAF3] text-white px-4 py-2 font-semibold text-sm uppercase tracking-wide">
          Fleet Data
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">

          <StatCard
            icon={Building2}
            iconBg="bg-blue-100" iconColor="text-blue-600"
            borderColor="border-l-blue-500"
            count={totalMakers} label="Total Makers"
            loading={isMakersLoading}
            actionLabel="View" onAction={() => setCurrentView('makers')}
            testIdCard="card-makers" testIdCount="widget-total-makers" testIdBtn="button-view-makers"
            extra={stats?.makers && (
              <div className="mt-2 flex gap-1.5 flex-wrap">
                <Badge className="text-xs bg-blue-50 text-blue-700 border-0">{stats.makers.linked} linked</Badge>
                {stats.makers.unlinked > 0 && <Badge className="text-xs bg-gray-100 text-gray-500 border-0">{stats.makers.unlinked} unused</Badge>}
              </div>
            )}
          />

          <StatCard
            icon={Box}
            iconBg="bg-sky-100" iconColor="text-sky-600"
            borderColor="border-l-sky-500"
            count={totalComponents} label="Fleet Components"
            loading={isComponentsLoading}
            actionLabel="View" onAction={() => setCurrentView('components')}
            testIdCard="card-components" testIdCount="widget-total-components" testIdBtn="button-view-components"
            extra={stats?.components && (
              <>
                <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                  <span>{stats.components.withMaker} with maker</span>
                  <span className="text-gray-300">|</span>
                  <span className={stats.components.withoutMaker > 0 ? 'text-amber-600' : ''}>{stats.components.withoutMaker} without</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                  <div className="h-1.5 rounded-full bg-[#52BAF3]" style={{ width: `${pct(stats.components.withMaker, stats.components.total)}%` }} />
                </div>
              </>
            )}
          />

          <StatCard
            icon={Wrench}
            iconBg="bg-green-100" iconColor="text-green-600"
            borderColor="border-l-green-500"
            count={totalJobs} label="Fleet Jobs"
            loading={isJobsLoading}
            actionLabel="View" onAction={() => setCurrentView('jobs')}
            testIdCard="card-jobs" testIdCount="widget-total-jobs" testIdBtn="button-view-jobs"
            extra={stats?.jobs && (
              <>
                <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                  <span>{stats.jobs.withValidComponent} linked</span>
                  <span className="text-gray-300">|</span>
                  <span className={stats.jobs.withInvalidComponent > 0 ? 'text-amber-600' : ''}>{stats.jobs.withInvalidComponent} unlinked</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                  <div className="h-1.5 rounded-full bg-[#52BAF3]" style={{ width: `${pct(stats.jobs.withValidComponent, stats.jobs.total)}%` }} />
                </div>
              </>
            )}
          />

          <StatCard
            icon={Package}
            iconBg="bg-orange-100" iconColor="text-orange-600"
            borderColor="border-l-orange-500"
            count={totalSpares} label="Fleet Spares"
            loading={isSparesLoading}
            actionLabel="View" onAction={() => setCurrentView('spares')}
            testIdCard="card-spares" testIdCount="widget-total-spares" testIdBtn="button-view-spares"
            extra={stats?.spares && (
              <>
                <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                  <span>{stats.spares.withValidComponent} linked</span>
                  <span className="text-gray-300">|</span>
                  <span className={stats.spares.withInvalidComponent > 0 ? 'text-amber-600' : ''}>{stats.spares.withInvalidComponent} unlinked</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                  <div className="h-1.5 rounded-full bg-[#52BAF3]" style={{ width: `${pct(stats.spares.withValidComponent, stats.spares.total)}%` }} />
                </div>
              </>
            )}
          />

          <StatCard
            icon={List}
            iconBg="bg-purple-100" iconColor="text-purple-600"
            borderColor="border-l-purple-500"
            count={totalMasterLists} label="Master Lists"
            loading={isMasterListsLoading}
            actionLabel="View" onAction={() => setCurrentView('master-lists')}
            testIdCard="card-master-lists" testIdCount="widget-total-master-lists" testIdBtn="button-view-master-lists"
          />

        </div>
      </div>

      {/* ── CONFIGURATION ── */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="bg-[#52BAF3] text-white px-4 py-2 font-semibold text-sm uppercase tracking-wide">
          Configuration
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">

          <StatCard
            icon={FileCode2}
            iconBg="bg-slate-100" iconColor="text-slate-600"
            borderColor="border-l-slate-400"
            count={totalComponents} label="Equipment Codes"
            loading={isComponentsLoading}
            actionLabel="View" onAction={() => setCurrentView('master-data-table')}
            testIdCard="card-equipment-codes" testIdCount="widget-total-master-data" testIdBtn="button-view-master-data"
          />

          <StatCard
            icon={Clock}
            iconBg="bg-amber-100" iconColor="text-amber-600"
            borderColor="border-l-amber-500"
            count={isPmsSettingsLoading || isVesselsLoading ? '...' : `${configuredPmsSettings}/${totalVessels}`}
            label="Lead Time & Grace"
            loading={false}
            actionLabel="Configure" onAction={() => setCurrentView('pms-settings')}
            testIdCard="card-pms-settings" testIdCount="widget-pms-settings" testIdBtn="button-view-pms-settings"
            extra={!isPmsSettingsLoading && !isVesselsLoading && totalVessels > 0 && (
              <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                <div className="h-1.5 rounded-full bg-[#52BAF3]" style={{ width: `${pct(configuredPmsSettings, totalVessels)}%` }} />
              </div>
            )}
          />

          <StatCard
            icon={Anchor}
            iconBg="bg-indigo-100" iconColor="text-indigo-600"
            borderColor="border-l-indigo-500"
            count={isFleetsLoading || isVesselsLoading ? '...' : `${totalFleets} / ${totalVessels}`}
            label="Fleets / Vessels"
            loading={false}
            actionLabel="Manage" onAction={() => setCurrentView('fleet-vessel-manager')}
            testIdCard="card-fleet-vessel" testIdCount="widget-fleet-vessel" testIdBtn="button-view-fleet-vessel"
          />

        </div>
      </div>

    </div>
  );
}
