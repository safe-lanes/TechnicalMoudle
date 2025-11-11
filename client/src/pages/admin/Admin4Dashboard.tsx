import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, List, ArrowRight, ArrowLeft } from "lucide-react";
import MakerManagement from "./MakerManagement";
import MasterListsManagement from "./MasterListsManagement";

type ViewType = 'dashboard' | 'makers' | 'master-lists';

export default function Admin4Dashboard() {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');

  const { data: makersData, isLoading: isMakersLoading } = useQuery({
    queryKey: ['/api/fleet/makers'],
  });

  const { data: masterListsData, isLoading: isMasterListsLoading } = useQuery({
    queryKey: ['/api/fleet/master-lists'],
  });

  const totalMakers = Array.isArray(makersData) ? makersData.length : 0;
  const totalMasterLists = Array.isArray(masterListsData) ? masterListsData.length : 0;

  if (currentView === 'makers') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b px-6 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentView('dashboard')}
            data-testid="button-back-to-dashboard"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="h-6 w-px bg-gray-300" />
          <h1 className="text-xl font-semibold text-gray-900">Maker Management</h1>
        </div>
        <MakerManagement />
      </div>
    );
  }

  if (currentView === 'master-lists') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b px-6 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentView('dashboard')}
            data-testid="button-back-to-dashboard"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="h-6 w-px bg-gray-300" />
          <h1 className="text-xl font-semibold text-gray-900">Master Lists Management</h1>
        </div>
        <MasterListsManagement />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Fleet Admin Dashboard</h1>
          <p className="text-gray-600 mt-2">Manage equipment makers and master list configurations</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
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
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Links</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              variant="outline"
              className="justify-start h-auto py-4 px-6"
              onClick={() => setCurrentView('makers')}
              data-testid="link-manage-makers"
            >
              <Building2 className="mr-3 h-5 w-5 text-blue-600" />
              <div className="text-left">
                <div className="font-medium">Manage Makers</div>
                <div className="text-sm text-gray-500">Add, edit, and organize equipment manufacturers</div>
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
                <div className="text-sm text-gray-500">Configure dropdown options and classifications</div>
              </div>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
