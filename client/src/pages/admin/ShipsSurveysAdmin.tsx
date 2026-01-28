import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type TabType = "master" | "company" | "vessel";
type ViewMode = "view" | "edit";

export default function ShipsSurveysAdmin() {
  const [activeTab, setActiveTab] = useState<TabType>("master");
  const [viewModes, setViewModes] = useState<Record<TabType, ViewMode>>({
    master: "view",
    company: "view",
    vessel: "view"
  });

  const currentViewMode = viewModes[activeTab];

  const toggleViewMode = () => {
    setViewModes(prev => ({
      ...prev,
      [activeTab]: prev[activeTab] === "view" ? "edit" : "view"
    }));
  };

  const exitEditMode = () => {
    setViewModes(prev => ({
      ...prev,
      [activeTab]: "view"
    }));
  };

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>
      {/* Header - Fixed */}
      <div className="flex-shrink-0 mb-6">
        <div className="flex items-center justify-between relative">
          <h1 className="text-2xl font-semibold text-gray-800" data-testid="text-page-title">
            Ship Surveys Admin
          </h1>
        
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)} className="absolute left-1/2 -translate-x-1/2">
            <TabsList className="bg-gray-100">
              <TabsTrigger 
                value="master" 
                className={cn(
                  "px-6",
                  activeTab === "master" && "bg-[#52baf3] text-white data-[state=active]:bg-[#52baf3] data-[state=active]:text-white"
                )}
                data-testid="tab-master"
              >
                Master
              </TabsTrigger>
              <TabsTrigger 
                value="company"
                className={cn(
                  "px-6",
                  activeTab === "company" && "bg-[#52baf3] text-white data-[state=active]:bg-[#52baf3] data-[state=active]:text-white"
                )}
                data-testid="tab-company"
              >
                Company
              </TabsTrigger>
              <TabsTrigger 
                value="vessel"
                className={cn(
                  "px-6",
                  activeTab === "vessel" && "bg-[#52baf3] text-white data-[state=active]:bg-[#52baf3] data-[state=active]:text-white"
                )}
                data-testid="tab-vessel"
              >
                Vessel
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          <div className="flex items-center gap-2">
            {currentViewMode === "view" ? (
              <Button 
                variant="outline" 
                size="sm"
                onClick={toggleViewMode}
                data-testid="button-edit-mode"
              >
                Edit
              </Button>
            ) : (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={exitEditMode}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content Area - Scrollable */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "master" && (
          <div className="h-full flex flex-col bg-white rounded-lg border">
            {/* Master Tab Toolbar */}
            <div className="flex-shrink-0 p-4 border-b">
              <p className="text-sm text-gray-500">Master surveys configuration - filters and actions will appear here</p>
            </div>
            {/* Master Tab Table Area */}
            <div className="flex-1 overflow-auto p-4">
              <div className="flex items-center justify-center h-full text-gray-400">
                Master surveys table will be displayed here
              </div>
            </div>
          </div>
        )}

        {activeTab === "company" && (
          <div className="h-full flex flex-col bg-white rounded-lg border">
            {/* Company Tab Toolbar */}
            <div className="flex-shrink-0 p-4 border-b">
              <p className="text-sm text-gray-500">Company surveys configuration - filters and actions will appear here</p>
            </div>
            {/* Company Tab Table Area */}
            <div className="flex-1 overflow-auto p-4">
              <div className="flex items-center justify-center h-full text-gray-400">
                Company surveys table will be displayed here
              </div>
            </div>
          </div>
        )}

        {activeTab === "vessel" && (
          <div className="h-full flex flex-col bg-white rounded-lg border">
            {/* Vessel Tab Toolbar - vessel selector will go here */}
            <div className="flex-shrink-0 p-4 border-b">
              <p className="text-sm text-gray-500">Vessel surveys configuration - vessel selector and filters will appear here</p>
            </div>
            {/* Vessel Tab Table Area */}
            <div className="flex-1 overflow-auto p-4">
              <div className="flex items-center justify-center h-full text-gray-400">
                Vessel surveys table will be displayed here
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
