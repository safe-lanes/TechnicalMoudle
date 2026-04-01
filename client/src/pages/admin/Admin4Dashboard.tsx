import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useVessels } from "@/hooks/useVessels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, List, Box, Wrench, Package, Ship, Clock, FileCode2, Anchor, Database, AlertTriangle, CheckCircle2, X, Bell, Settings, MapPin } from "lucide-react";
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
  const [showNotification, setShowNotification] = useState(true);

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

  const { data: masterDataResponse, isLoading: isMasterDataLoading } = useQuery<{ items: any[]; total: number }>({
    queryKey: ['/technical/api/fleet-admin/master-data', 'dashboard'],
    queryFn: async () => {
      const response = await fetch('/technical/api/fleet-admin/master-data?limit=1');
      if (!response.ok) throw new Error('Failed to fetch master data');
      return response.json();
    }
  });

  const { data: pmsSettingsData, isLoading: isPmsSettingsLoading } = useQuery<PmsVesselSettings[]>({
    queryKey: ['/technical/api/pms-vessel-settings'],
  });

  const { data: vesselsData, isLoading: isVesselsLoading } = useVessels();

  const { data: fleetsData, isLoading: isFleetsLoading } = useQuery<Fleet[]>({
    queryKey: ['/technical/api/fleets'],
  });

  const { data: dashboardStats, isLoading: isStatsLoading } = useQuery<any>({
    queryKey: ['/technical/api/fleet-admin/dashboard-stats'],
  });

  const totalMakers = Array.isArray(makersData) ? makersData.length : 0;
  const totalMasterLists = Array.isArray(masterListsData) ? masterListsData.length : 0;
  const totalMasterData = masterDataResponse?.total ?? 0;
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

  const ProgressBar = ({ value, max, color }: { value: number; max: number; color: string }) => {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    return (
      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    );
  };

  const notificationItems: string[] = [];
  if (stats?.dataQuality) {
    if (stats.dataQuality.componentsWithoutMaker > 0) notificationItems.push(`${stats.dataQuality.componentsWithoutMaker} components without maker`);
    if (stats.dataQuality.jobsWithInvalidComponent > 0) notificationItems.push(`${stats.dataQuality.jobsWithInvalidComponent} jobs with unlinked components`);
    if (stats.dataQuality.sparesWithInvalidComponent > 0) notificationItems.push(`${stats.dataQuality.sparesWithInvalidComponent} spares with unlinked components`);
    if (stats.dataQuality.unlinkedMakers > 0) notificationItems.push(`${stats.dataQuality.unlinkedMakers} unused makers`);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold" data-testid="text-master-data-title">Master Data</h1>
            <p className="text-sm text-gray-600 mt-1">Manage fleet-level master data including makers, components, jobs, spares, and configurations</p>
          </div>
          <div className="flex items-center gap-2">
            {stats?.dataQuality && stats.dataQuality.totalIssues > 0 && (
              <button
                onClick={() => setShowNotification(!showNotification)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors relative"
                data-testid="button-notifications"
              >
                <Bell className="h-5 w-5 text-gray-500" />
                <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                  {stats.dataQuality.totalIssues}
                </span>
              </button>
            )}
            {stats?.dataQuality && stats.dataQuality.totalIssues === 0 && (
              <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-xs text-green-700 font-medium">All checks passed</span>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 space-y-6">
          {showNotification && stats?.dataQuality && stats.dataQuality.totalIssues > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3" data-testid="data-quality-banner">
              <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-amber-800">
                    {stats.dataQuality.totalIssues} data quality {stats.dataQuality.totalIssues === 1 ? 'issue' : 'issues'} detected
                  </span>
                  <span className="text-xs text-amber-600">{notificationItems.join(' | ')}</span>
                </div>
              </div>
              <button
                onClick={() => setShowNotification(false)}
                className="text-amber-400 hover:text-amber-600 transition-colors flex-shrink-0"
                data-testid="button-dismiss-notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Fleet Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors" data-testid="card-makers">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <Building2 className="h-4 w-4 text-gray-600" />
                    </div>
                    <Button size="sm" onClick={() => setCurrentView('makers')} className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-7 px-3" data-testid="button-view-makers">
                      View
                    </Button>
                  </div>
                  <div className="text-2xl font-bold text-gray-900" data-testid="widget-total-makers">{isMakersLoading ? '...' : totalMakers}</div>
                  <p className="text-xs text-gray-500 mt-0.5">Total Makers</p>
                  {stats?.makers && (
                    <div className="mt-3 flex gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-600">{stats.makers.linked} linked</Badge>
                      {stats.makers.unlinked > 0 && <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-500">{stats.makers.unlinked} unused</Badge>}
                    </div>
                  )}
                </div>

                <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors" data-testid="card-components">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <Box className="h-4 w-4 text-gray-600" />
                    </div>
                    <Button size="sm" onClick={() => setCurrentView('components')} className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-7 px-3" data-testid="button-view-components">
                      View
                    </Button>
                  </div>
                  <div className="text-2xl font-bold text-gray-900" data-testid="widget-total-components">{isComponentsLoading ? '...' : totalComponents}</div>
                  <p className="text-xs text-gray-500 mt-0.5">Fleet Components</p>
                  {stats?.components && (
                    <>
                      <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                        <span>{stats.components.withMaker} with maker</span>
                        <span className="text-gray-300">|</span>
                        <span className={stats.components.withoutMaker > 0 ? 'text-amber-600' : ''}>{stats.components.withoutMaker} without</span>
                      </div>
                      <ProgressBar value={stats.components.withMaker} max={stats.components.total} color="bg-blue-500" />
                    </>
                  )}
                </div>

                <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors" data-testid="card-jobs">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <Wrench className="h-4 w-4 text-gray-600" />
                    </div>
                    <Button size="sm" onClick={() => setCurrentView('jobs')} className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-7 px-3" data-testid="button-view-jobs">
                      View
                    </Button>
                  </div>
                  <div className="text-2xl font-bold text-gray-900" data-testid="widget-total-jobs">{isJobsLoading ? '...' : totalJobs}</div>
                  <p className="text-xs text-gray-500 mt-0.5">Fleet Jobs</p>
                  {stats?.jobs && (
                    <>
                      <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                        <span>{stats.jobs.withValidComponent} linked</span>
                        <span className="text-gray-300">|</span>
                        <span className={stats.jobs.withInvalidComponent > 0 ? 'text-amber-600' : ''}>{stats.jobs.withInvalidComponent} unlinked</span>
                      </div>
                      <ProgressBar value={stats.jobs.withValidComponent} max={stats.jobs.total} color="bg-blue-500" />
                    </>
                  )}
                </div>

                <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors" data-testid="card-spares">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <Package className="h-4 w-4 text-gray-600" />
                    </div>
                    <Button size="sm" onClick={() => setCurrentView('spares')} className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-7 px-3" data-testid="button-view-spares">
                      View
                    </Button>
                  </div>
                  <div className="text-2xl font-bold text-gray-900" data-testid="widget-total-spares">{isSparesLoading ? '...' : totalSpares}</div>
                  <p className="text-xs text-gray-500 mt-0.5">Fleet Spares</p>
                  {stats?.spares && (
                    <>
                      <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                        <span>{stats.spares.withValidComponent} linked</span>
                        <span className="text-gray-300">|</span>
                        <span className={stats.spares.withInvalidComponent > 0 ? 'text-amber-600' : ''}>{stats.spares.withInvalidComponent} unlinked</span>
                      </div>
                      <ProgressBar value={stats.spares.withValidComponent} max={stats.spares.total} color="bg-blue-500" />
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <List className="h-4 w-4 text-gray-600" />
                </div>
                <Button size="sm" onClick={() => setCurrentView('master-lists')} className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-7 px-3" data-testid="button-view-master-lists">
                  View
                </Button>
              </div>
              <div className="text-2xl font-bold text-gray-900" data-testid="widget-total-master-lists">{isMasterListsLoading ? '...' : totalMasterLists}</div>
              <p className="text-xs text-gray-500 mt-0.5">Master Lists</p>
            </div>

            <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <FileCode2 className="h-4 w-4 text-gray-600" />
                </div>
                <Button size="sm" onClick={() => setCurrentView('master-data-table')} className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-7 px-3" data-testid="button-view-master-data">
                  View
                </Button>
              </div>
              <div className="text-2xl font-bold text-gray-900" data-testid="widget-total-master-data">{isComponentsLoading ? '...' : totalComponents}</div>
              <p className="text-xs text-gray-500 mt-0.5">Equipment Codes</p>
            </div>

            <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Clock className="h-4 w-4 text-gray-600" />
                </div>
                <Button size="sm" onClick={() => setCurrentView('pms-settings')} className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-7 px-3" data-testid="button-view-pms-settings">
                  Configure
                </Button>
              </div>
              <div className="text-2xl font-bold text-gray-900" data-testid="widget-pms-settings">{isPmsSettingsLoading || isVesselsLoading ? '...' : `${configuredPmsSettings}/${totalVessels}`}</div>
              <p className="text-xs text-gray-500 mt-0.5">Lead Time & Grace</p>
              {!isPmsSettingsLoading && !isVesselsLoading && totalVessels > 0 && (
                <ProgressBar value={configuredPmsSettings} max={totalVessels} color="bg-blue-500" />
              )}
            </div>

            <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Anchor className="h-4 w-4 text-gray-600" />
                </div>
                <Button size="sm" onClick={() => setCurrentView('fleet-vessel-manager')} className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-7 px-3" data-testid="button-view-fleet-vessel">
                  Manage
                </Button>
              </div>
              <div className="text-2xl font-bold text-gray-900" data-testid="widget-fleet-vessel">{isFleetsLoading || isVesselsLoading ? '...' : `${totalFleets} / ${totalVessels}`}</div>
              <p className="text-xs text-gray-500 mt-0.5">Fleets / Vessels</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Fleet Data</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                  {[
                    { view: 'makers' as ViewType, icon: Building2, label: 'Makers' },
                    { view: 'components' as ViewType, icon: Box, label: 'Components' },
                    { view: 'jobs' as ViewType, icon: Wrench, label: 'Jobs' },
                    { view: 'spares' as ViewType, icon: Package, label: 'Spares' },
                    { view: 'master-lists' as ViewType, icon: List, label: 'Master Lists' },
                    { view: 'fleet-data' as ViewType, icon: Database, label: 'Fleet Data' },
                  ].map(link => (
                    <button
                      key={link.view}
                      onClick={() => setCurrentView(link.view)}
                      className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-left"
                      data-testid={`link-${link.view}`}
                    >
                      <link.icon className="h-4 w-4 text-gray-500 flex-shrink-0" />
                      <span className="text-xs font-medium text-gray-700 truncate">{link.label}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Configuration & Mapping</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { view: 'vessel-mapping' as ViewType, icon: Ship, label: 'Vessel Mapping' },
                    { view: 'fleet-vessel-manager' as ViewType, icon: Anchor, label: 'Fleet & Vessel' },
                    { view: 'pms-settings' as ViewType, icon: Clock, label: 'Lead Time & Grace' },
                    { view: 'master-data-table' as ViewType, icon: Database, label: 'Master Data' },
                    { view: 'locations' as ViewType, icon: MapPin, label: 'Locations' },
                  ].map(link => (
                    <button
                      key={link.view}
                      onClick={() => setCurrentView(link.view)}
                      className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-left"
                      data-testid={`link-${link.view}`}
                    >
                      <link.icon className="h-4 w-4 text-gray-500 flex-shrink-0" />
                      <span className="text-xs font-medium text-gray-700 truncate">{link.label}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
