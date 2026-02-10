import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useVessels } from "@/hooks/useVessels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, List, ArrowRight, ArrowLeft, Box, Wrench, Package, Ship, Clock, FileCode2, FolderTree, Anchor, Database, Layers } from "lucide-react";
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
    queryKey: ['/technical/api/fleet/components'],
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

  const totalMakers = Array.isArray(makersData) ? makersData.length : 0;
  const totalMasterLists = Array.isArray(masterListsData) ? masterListsData.length : 0;
  const totalMasterData = masterDataResponse?.total ?? 0;
  const totalComponents = Array.isArray(componentsData) ? componentsData.length : 0;
  const totalJobs = Array.isArray(jobsData) ? jobsData.length : 0;
  const totalSpares = Array.isArray(sparesData) ? sparesData.length : 0;
  const totalVessels = Array.isArray(vesselsData) ? vesselsData.length : 0;
  const totalFleets = Array.isArray(fleetsData) ? fleetsData.length : 0;
  const configuredPmsSettings = Array.isArray(pmsSettingsData) ? pmsSettingsData.length : 0;

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

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Fleet Admin Dashboard</h1>
          <p className="text-gray-600 mt-2">Manage fleet-level master data including makers, components, jobs, spares, and configurations</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Makers
              </CardTitle>
              <div className="p-2 bg-blue-100 rounded-lg">
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between">
                <div>
                  {isMakersLoading ? (
                    <div className="h-10 w-20 bg-gray-200 animate-pulse rounded"></div>
                  ) : (
                    <div 
                      className="text-3xl font-bold text-gray-900"
                      data-testid="widget-total-makers"
                    >
                      {totalMakers}
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1">Equipment manufacturers</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentView('makers')}
                  className="text-blue-600 hover:text-blue-700"
                  data-testid="button-view-makers"
                >
                  View All
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Master Lists
              </CardTitle>
              <div className="p-2 bg-green-100 rounded-lg">
                <List className="h-5 w-5 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between">
                <div>
                  {isMasterListsLoading ? (
                    <div className="h-10 w-20 bg-gray-200 animate-pulse rounded"></div>
                  ) : (
                    <div 
                      className="text-3xl font-bold text-gray-900"
                      data-testid="widget-total-master-lists"
                    >
                      {totalMasterLists}
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1">Dropdown configurations</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentView('master-lists')}
                  className="text-green-600 hover:text-green-700"
                  data-testid="button-view-master-lists"
                >
                  View All
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Fleet Equipment Codes
              </CardTitle>
              <div className="p-2 bg-indigo-100 rounded-lg">
                <FileCode2 className="h-5 w-5 text-indigo-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between">
                <div>
                  {isMasterDataLoading ? (
                    <div className="h-10 w-20 bg-gray-200 animate-pulse rounded"></div>
                  ) : (
                    <div 
                      className="text-3xl font-bold text-gray-900"
                      data-testid="widget-total-master-data"
                    >
                      {totalMasterData}
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1">Equipment code mappings</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentView('master-data')}
                  className="text-indigo-600 hover:text-indigo-700"
                  data-testid="button-view-master-data"
                >
                  View All
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Fleet Components
              </CardTitle>
              <div className="p-2 bg-purple-100 rounded-lg">
                <Box className="h-5 w-5 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between">
                <div>
                  {isComponentsLoading ? (
                    <div className="h-10 w-20 bg-gray-200 animate-pulse rounded"></div>
                  ) : (
                    <div 
                      className="text-3xl font-bold text-gray-900"
                      data-testid="widget-total-components"
                    >
                      {totalComponents}
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1">SFI hierarchy</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentView('components')}
                  className="text-purple-600 hover:text-purple-700"
                  data-testid="button-view-components"
                >
                  View All
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Fleet Jobs
              </CardTitle>
              <div className="p-2 bg-orange-100 rounded-lg">
                <Wrench className="h-5 w-5 text-orange-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between">
                <div>
                  {isJobsLoading ? (
                    <div className="h-10 w-20 bg-gray-200 animate-pulse rounded"></div>
                  ) : (
                    <div 
                      className="text-3xl font-bold text-gray-900"
                      data-testid="widget-total-jobs"
                    >
                      {totalJobs}
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1">Maintenance tasks</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentView('jobs')}
                  className="text-orange-600 hover:text-orange-700"
                  data-testid="button-view-jobs"
                >
                  View All
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Fleet Spares
              </CardTitle>
              <div className="p-2 bg-teal-100 rounded-lg">
                <Package className="h-5 w-5 text-teal-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between">
                <div>
                  {isSparesLoading ? (
                    <div className="h-10 w-20 bg-gray-200 animate-pulse rounded"></div>
                  ) : (
                    <div 
                      className="text-3xl font-bold text-gray-900"
                      data-testid="widget-total-spares"
                    >
                      {totalSpares}
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1">Spare parts catalog</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentView('spares')}
                  className="text-teal-600 hover:text-teal-700"
                  data-testid="button-view-spares"
                >
                  View All
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Lead Time & Grace Period
              </CardTitle>
              <div className="p-2 bg-cyan-100 rounded-lg">
                <Clock className="h-5 w-5 text-cyan-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between">
                <div>
                  {isPmsSettingsLoading || isVesselsLoading ? (
                    <div className="h-10 w-20 bg-gray-200 animate-pulse rounded"></div>
                  ) : (
                    <div 
                      className="text-3xl font-bold text-gray-900"
                      data-testid="widget-pms-settings"
                    >
                      {configuredPmsSettings}/{totalVessels}
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1">Vessels configured</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentView('pms-settings')}
                  className="text-cyan-600 hover:text-cyan-700"
                  data-testid="button-view-pms-settings"
                >
                  Configure
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Fleet & Vessel Manager
              </CardTitle>
              <div className="p-2 bg-rose-100 rounded-lg">
                <Anchor className="h-5 w-5 text-rose-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between">
                <div>
                  {isFleetsLoading || isVesselsLoading ? (
                    <div className="h-10 w-20 bg-gray-200 animate-pulse rounded"></div>
                  ) : (
                    <div 
                      className="text-3xl font-bold text-gray-900"
                      data-testid="widget-fleet-vessel"
                    >
                      {totalFleets} / {totalVessels}
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1">Fleets / Vessels</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentView('fleet-vessel-manager')}
                  className="text-rose-600 hover:text-rose-700"
                  data-testid="button-view-fleet-vessel"
                >
                  Manage
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Links</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Button
              variant="outline"
              className="justify-start h-auto py-4 px-6"
              onClick={() => setCurrentView('makers')}
              data-testid="link-manage-makers"
            >
              <Building2 className="mr-3 h-5 w-5 text-blue-600" />
              <div className="text-left">
                <div className="font-medium">Manage Makers</div>
                <div className="text-sm text-gray-500">Equipment manufacturers</div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="justify-start h-auto py-4 px-6"
              onClick={() => setCurrentView('master-lists')}
              data-testid="link-manage-master-lists"
            >
              <List className="mr-3 h-5 w-5 text-green-600" />
              <div className="text-left">
                <div className="font-medium">Manage Master Lists</div>
                <div className="text-sm text-gray-500">Dropdown configurations</div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="justify-start h-auto py-4 px-6"
              onClick={() => setCurrentView('components')}
              data-testid="link-manage-components"
            >
              <Box className="mr-3 h-5 w-5 text-purple-600" />
              <div className="text-left">
                <div className="font-medium">Fleet Components</div>
                <div className="text-sm text-gray-500">SFI equipment hierarchy</div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="justify-start h-auto py-4 px-6"
              onClick={() => setCurrentView('jobs')}
              data-testid="link-manage-jobs"
            >
              <Wrench className="mr-3 h-5 w-5 text-orange-600" />
              <div className="text-left">
                <div className="font-medium">Fleet Jobs</div>
                <div className="text-sm text-gray-500">Maintenance work orders</div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="justify-start h-auto py-4 px-6"
              onClick={() => setCurrentView('spares')}
              data-testid="link-manage-spares"
            >
              <Package className="mr-3 h-5 w-5 text-teal-600" />
              <div className="text-left">
                <div className="font-medium">Fleet Spares</div>
                <div className="text-sm text-gray-500">Spare parts catalog</div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="justify-start h-auto py-4 px-6"
              onClick={() => setCurrentView('vessel-mapping')}
              data-testid="link-vessel-mapping"
            >
              <Ship className="mr-3 h-5 w-5 text-indigo-600" />
              <div className="text-left">
                <div className="font-medium">Vessel Mapping</div>
                <div className="text-sm text-gray-500">Map fleet data to vessels</div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="justify-start h-auto py-4 px-6"
              onClick={() => setCurrentView('pms-settings')}
              data-testid="link-pms-settings"
            >
              <Clock className="mr-3 h-5 w-5 text-cyan-600" />
              <div className="text-left">
                <div className="font-medium">Lead Time & Grace</div>
                <div className="text-sm text-gray-500">WO generation settings</div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="justify-start h-auto py-4 px-6"
              onClick={() => setCurrentView('fleet-vessel-manager')}
              data-testid="link-fleet-vessel-manager"
            >
              <Anchor className="mr-3 h-5 w-5 text-rose-600" />
              <div className="text-left">
                <div className="font-medium">Fleet & Vessel Manager</div>
                <div className="text-sm text-gray-500">Manage fleets and vessels</div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="justify-start h-auto py-4 px-6"
              onClick={() => setCurrentView('master-data-table')}
              data-testid="link-master-data-table"
            >
              <Database className="mr-3 h-5 w-5 text-purple-600" />
              <div className="text-left">
                <div className="font-medium">Master Data</div>
                <div className="text-sm text-gray-500">Fleet equipment master data</div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="justify-start h-auto py-4 px-6"
              onClick={() => setCurrentView('fleet-data')}
              data-testid="link-fleet-data"
            >
              <Layers className="mr-3 h-5 w-5 text-cyan-600" />
              <div className="text-left">
                <div className="font-medium">Fleet Data</div>
                <div className="text-sm text-gray-500">Components, jobs, spares overview</div>
              </div>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
