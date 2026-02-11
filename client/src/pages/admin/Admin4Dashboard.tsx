import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useVessels } from "@/hooks/useVessels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, List, ArrowRight, ArrowLeft, Box, Wrench, Package, Ship, Clock, FileCode2, FolderTree, Anchor, Database, Layers, AlertTriangle, CheckCircle2, XCircle, TrendingUp, Activity, Shield, BarChart3, CircleDot } from "lucide-react";
import { Marker } from "@/components/Marker";
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
import type { PmsVesselSettings, Fleet } from "@shared/schema";

type ViewType = 'dashboard' | 'makers' | 'master-lists' | 'master-data' | 'master-data-table' | 'components' | 'jobs' | 'spares' | 'vessel-mapping' | 'pms-settings' | 'equipment-tree' | 'fleet-vessel-manager' | 'fleet-data';

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

  const ProgressBar = ({ value, max, color }: { value: number; max: number; color: string }) => {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    return (
      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    );
  };

  const BreakdownBar = ({ data, colors }: { data: Record<string, number>; colors: string[] }) => {
    const total = Object.values(data).reduce((a, b) => a + b, 0);
    if (total === 0) return null;
    const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
    return (
      <div className="space-y-2 mt-3">
        {entries.map(([label, count], i) => {
          const pct = Math.round((count / total) * 100);
          return (
            <div key={label} className="flex items-center gap-2">
              <div className="w-24 text-xs text-gray-600 truncate" title={label}>{label}</div>
              <div className="flex-1 bg-gray-100 rounded-full h-2">
                <div className={`h-2 rounded-full ${colors[i % colors.length]}`} style={{ width: `${pct}%` }} />
              </div>
              <div className="w-8 text-xs text-gray-500 text-right">{count}</div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Fleet Admin Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Manage fleet-level master data including makers, components, jobs, spares, and configurations</p>
        </div>

        {stats?.dataQuality && (
          <div className={`mb-6 rounded-lg border p-4 flex items-center gap-4 ${
            stats.dataQuality.totalIssues > 0 
              ? 'bg-amber-50 border-amber-200' 
              : 'bg-green-50 border-green-200'
          }`} data-testid="data-quality-banner">
            {stats.dataQuality.totalIssues > 0 ? (
              <>
                <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800">
                    {stats.dataQuality.totalIssues} data quality {stats.dataQuality.totalIssues === 1 ? 'issue' : 'issues'} detected
                  </p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    {stats.dataQuality.componentsWithoutMaker > 0 && `${stats.dataQuality.componentsWithoutMaker} components without maker`}
                    {stats.dataQuality.componentsWithoutMaker > 0 && stats.dataQuality.jobsWithInvalidComponent > 0 && ' | '}
                    {stats.dataQuality.jobsWithInvalidComponent > 0 && `${stats.dataQuality.jobsWithInvalidComponent} jobs with unlinked components`}
                    {(stats.dataQuality.componentsWithoutMaker > 0 || stats.dataQuality.jobsWithInvalidComponent > 0) && stats.dataQuality.sparesWithInvalidComponent > 0 && ' | '}
                    {stats.dataQuality.sparesWithInvalidComponent > 0 && `${stats.dataQuality.sparesWithInvalidComponent} spares with unlinked components`}
                    {(stats.dataQuality.componentsWithoutMaker > 0 || stats.dataQuality.jobsWithInvalidComponent > 0 || stats.dataQuality.sparesWithInvalidComponent > 0) && stats.dataQuality.unlinkedMakers > 0 && ' | '}
                    {stats.dataQuality.unlinkedMakers > 0 && `${stats.dataQuality.unlinkedMakers} unused makers`}
                  </p>
                </div>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-800">All data quality checks passed</p>
                  <p className="text-xs text-green-600 mt-0.5">Components, jobs, and spares are properly linked</p>
                </div>
              </>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="hover:shadow-lg transition-shadow" data-testid="card-makers">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Building2 className="h-4 w-4 text-blue-600" />
                </div>
                <Button variant="ghost" size="sm" onClick={() => setCurrentView('makers')} className="text-blue-600 text-xs" data-testid="button-view-makers">
                  View <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
              <div className="text-2xl font-bold text-gray-900" data-testid="widget-total-makers">{isMakersLoading ? '...' : totalMakers}</div>
              <p className="text-xs text-gray-500 mt-0.5">Total Makers</p>
              {stats?.makers && (
                <div className="mt-3 flex gap-2">
                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">{stats.makers.linked} linked</Badge>
                  {stats.makers.unlinked > 0 && <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-500">{stats.makers.unlinked} unused</Badge>}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow" data-testid="card-components">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Box className="h-4 w-4 text-purple-600" />
                </div>
                <Button variant="ghost" size="sm" onClick={() => setCurrentView('components')} className="text-purple-600 text-xs" data-testid="button-view-components">
                  View <ArrowRight className="ml-1 h-3 w-3" />
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
                  <ProgressBar value={stats.components.withMaker} max={stats.components.total} color="bg-purple-500" />
                </>
              )}
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow" data-testid="card-jobs">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Wrench className="h-4 w-4 text-orange-600" />
                </div>
                <Button variant="ghost" size="sm" onClick={() => setCurrentView('jobs')} className="text-orange-600 text-xs" data-testid="button-view-jobs">
                  View <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
              <div className="text-2xl font-bold text-gray-900" data-testid="widget-total-jobs">{isJobsLoading ? '...' : totalJobs}</div>
              <p className="text-xs text-gray-500 mt-0.5">Fleet Jobs</p>
              {stats?.jobs && (
                <>
                  <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                    <span>{stats.jobs.withValidComponent} linked</span>
                    <span className="text-gray-300">|</span>
                    <span className={stats.jobs.withInvalidComponent > 0 ? 'text-red-500' : ''}>{stats.jobs.withInvalidComponent} unlinked</span>
                  </div>
                  <ProgressBar value={stats.jobs.withValidComponent} max={stats.jobs.total} color="bg-orange-500" />
                </>
              )}
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow" data-testid="card-spares">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-teal-100 rounded-lg">
                  <Package className="h-4 w-4 text-teal-600" />
                </div>
                <Button variant="ghost" size="sm" onClick={() => setCurrentView('spares')} className="text-teal-600 text-xs" data-testid="button-view-spares">
                  View <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
              <div className="text-2xl font-bold text-gray-900" data-testid="widget-total-spares">{isSparesLoading ? '...' : totalSpares}</div>
              <p className="text-xs text-gray-500 mt-0.5">Fleet Spares</p>
              {stats?.spares && (
                <>
                  <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                    <span>{stats.spares.withValidComponent} linked</span>
                    <span className="text-gray-300">|</span>
                    <span className={stats.spares.withInvalidComponent > 0 ? 'text-red-500' : ''}>{stats.spares.withInvalidComponent} unlinked</span>
                  </div>
                  <ProgressBar value={stats.spares.withValidComponent} max={stats.spares.total} color="bg-teal-500" />
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <List className="h-4 w-4 text-green-600" />
                </div>
                <Button variant="ghost" size="sm" onClick={() => setCurrentView('master-lists')} className="text-green-600 text-xs" data-testid="button-view-master-lists">
                  View <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
              <div className="text-2xl font-bold text-gray-900" data-testid="widget-total-master-lists">{isMasterListsLoading ? '...' : totalMasterLists}</div>
              <p className="text-xs text-gray-500 mt-0.5">Master Lists</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <FileCode2 className="h-4 w-4 text-indigo-600" />
                </div>
                <Button variant="ghost" size="sm" onClick={() => setCurrentView('master-data')} className="text-indigo-600 text-xs" data-testid="button-view-master-data">
                  View <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
              <div className="text-2xl font-bold text-gray-900" data-testid="widget-total-master-data">{isMasterDataLoading ? '...' : totalMasterData}</div>
              <p className="text-xs text-gray-500 mt-0.5">Equipment Codes</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-cyan-100 rounded-lg">
                  <Clock className="h-4 w-4 text-cyan-600" />
                </div>
                <Button variant="ghost" size="sm" onClick={() => setCurrentView('pms-settings')} className="text-cyan-600 text-xs" data-testid="button-view-pms-settings">
                  Configure <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
              <div className="text-2xl font-bold text-gray-900" data-testid="widget-pms-settings">{isPmsSettingsLoading || isVesselsLoading ? '...' : `${configuredPmsSettings}/${totalVessels}`}</div>
              <p className="text-xs text-gray-500 mt-0.5">Lead Time & Grace</p>
              {!isPmsSettingsLoading && !isVesselsLoading && totalVessels > 0 && (
                <ProgressBar value={configuredPmsSettings} max={totalVessels} color="bg-cyan-500" />
              )}
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-rose-100 rounded-lg">
                  <Anchor className="h-4 w-4 text-rose-600" />
                </div>
                <Button variant="ghost" size="sm" onClick={() => setCurrentView('fleet-vessel-manager')} className="text-rose-600 text-xs" data-testid="button-view-fleet-vessel">
                  Manage <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
              <div className="text-2xl font-bold text-gray-900" data-testid="widget-fleet-vessel">{isFleetsLoading || isVesselsLoading ? '...' : `${totalFleets} / ${totalVessels}`}</div>
              <p className="text-xs text-gray-500 mt-0.5">Fleets / Vessels</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {stats?.components?.categoryBreakdown && Object.keys(stats.components.categoryBreakdown).length > 0 && (
            <Card data-testid="chart-component-categories">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-purple-500" />
                  Components by Category
                </CardTitle>
              </CardHeader>
              <CardContent>
                <BreakdownBar data={stats.components.categoryBreakdown} colors={['bg-purple-500', 'bg-purple-400', 'bg-purple-300', 'bg-indigo-400', 'bg-violet-400']} />
              </CardContent>
            </Card>
          )}

          {stats?.jobs?.byTaskType && Object.keys(stats.jobs.byTaskType).length > 0 && (
            <Card data-testid="chart-job-types">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-orange-500" />
                  Jobs by Task Type
                </CardTitle>
              </CardHeader>
              <CardContent>
                <BreakdownBar data={stats.jobs.byTaskType} colors={['bg-orange-500', 'bg-orange-400', 'bg-amber-400', 'bg-yellow-400', 'bg-orange-300']} />
              </CardContent>
            </Card>
          )}

          {stats?.jobs?.byPriority && Object.keys(stats.jobs.byPriority).length > 0 && (
            <Card data-testid="chart-job-priority">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-red-500" />
                  Jobs by Priority
                </CardTitle>
              </CardHeader>
              <CardContent>
                <BreakdownBar data={stats.jobs.byPriority} colors={['bg-red-500', 'bg-red-400', 'bg-rose-400', 'bg-pink-400', 'bg-red-300']} />
              </CardContent>
            </Card>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {stats?.components?.deptBreakdown && Object.keys(stats.components.deptBreakdown).length > 0 && (
            <Card data-testid="chart-component-depts">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-indigo-500" />
                  Components by Department
                </CardTitle>
              </CardHeader>
              <CardContent>
                <BreakdownBar data={stats.components.deptBreakdown} colors={['bg-indigo-500', 'bg-indigo-400', 'bg-blue-400', 'bg-sky-400', 'bg-indigo-300']} />
              </CardContent>
            </Card>
          )}

          {stats?.jobs?.byCriticality && Object.keys(stats.jobs.byCriticality).length > 0 && (
            <Card data-testid="chart-job-criticality">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Jobs by Criticality
                </CardTitle>
              </CardHeader>
              <CardContent>
                <BreakdownBar data={stats.jobs.byCriticality} colors={['bg-amber-500', 'bg-amber-400', 'bg-yellow-400', 'bg-orange-300', 'bg-amber-300']} />
              </CardContent>
            </Card>
          )}

          {stats?.spares?.byCriticality && Object.keys(stats.spares.byCriticality).length > 0 && (
            <Card data-testid="chart-spares-criticality">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-teal-500" />
                  Spares by Criticality
                </CardTitle>
              </CardHeader>
              <CardContent>
                <BreakdownBar data={stats.spares.byCriticality} colors={['bg-teal-500', 'bg-teal-400', 'bg-emerald-400', 'bg-green-400', 'bg-teal-300']} />
              </CardContent>
            </Card>
          )}
        </div>

        {stats?.recentActivity && stats.recentActivity.length > 0 && (
          <Card className="mb-6" data-testid="recent-activity">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Activity className="h-4 w-4 text-cyan-500" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.recentActivity.map((item: any, idx: number) => (
                  <div key={`${item.type}-${item.id}`} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-b-0">
                    <div className={`p-1.5 rounded-md ${
                      item.type === 'component' ? 'bg-purple-100' : item.type === 'job' ? 'bg-orange-100' : 'bg-teal-100'
                    }`}>
                      {item.type === 'component' ? <Box className="h-3.5 w-3.5 text-purple-600" /> :
                       item.type === 'job' ? <Wrench className="h-3.5 w-3.5 text-orange-600" /> :
                       <Package className="h-3.5 w-3.5 text-teal-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-gray-500">{item.code}</span>
                        <span className="text-sm text-gray-800 truncate">{item.name}</span>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs capitalize flex-shrink-0">
                      {item.type}
                    </Badge>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {new Date(item.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-700">Quick Links</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                { view: 'makers' as ViewType, icon: Building2, label: 'Makers', color: 'text-blue-600', bg: 'bg-blue-50' },
                { view: 'master-lists' as ViewType, icon: List, label: 'Master Lists', color: 'text-green-600', bg: 'bg-green-50' },
                { view: 'components' as ViewType, icon: Box, label: 'Components', color: 'text-purple-600', bg: 'bg-purple-50' },
                { view: 'jobs' as ViewType, icon: Wrench, label: 'Jobs', color: 'text-orange-600', bg: 'bg-orange-50' },
                { view: 'spares' as ViewType, icon: Package, label: 'Spares', color: 'text-teal-600', bg: 'bg-teal-50' },
                { view: 'vessel-mapping' as ViewType, icon: Ship, label: 'Vessel Mapping', color: 'text-indigo-600', bg: 'bg-indigo-50' },
                { view: 'pms-settings' as ViewType, icon: Clock, label: 'Lead Time & Grace', color: 'text-cyan-600', bg: 'bg-cyan-50' },
                { view: 'fleet-vessel-manager' as ViewType, icon: Anchor, label: 'Fleet & Vessel', color: 'text-rose-600', bg: 'bg-rose-50' },
                { view: 'master-data-table' as ViewType, icon: Database, label: 'Master Data', color: 'text-purple-600', bg: 'bg-purple-50' },
                { view: 'fleet-data' as ViewType, icon: Layers, label: 'Fleet Data', color: 'text-cyan-600', bg: 'bg-cyan-50' },
              ].map(link => (
                <button
                  key={link.view}
                  onClick={() => setCurrentView(link.view)}
                  className={`flex items-center gap-2 p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all text-left ${link.bg}`}
                  data-testid={`link-${link.view}`}
                >
                  <link.icon className={`h-4 w-4 ${link.color} flex-shrink-0`} />
                  <span className="text-xs font-medium text-gray-700 truncate">{link.label}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
