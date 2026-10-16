import { useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BulkDataImport from "../admin/BulkDataImport";
import Alerts from "../admin/Alerts";
import Forms from "@/components/admin/Forms";
import Admin4Dashboard from "../admin/Admin4Dashboard";
import { Marker } from "@/components/Marker";
import { useUIRole } from "@/contexts/UIRoleContext";
import { cn } from "@/lib/utils";
import { useAdminUrlState } from "@/hooks/useAdminUrlState";

export default function PMSAdmin() {
  const { uiRole, isSailAdmin, isClientAdmin, isExternal } = useUIRole();
  const showBulkDataImp = isSailAdmin || isClientAdmin || isExternal;
  const showMasterData = isSailAdmin;
  const [requestedTab, setActiveTab] = useAdminUrlState<string>(
    "tab", "", ["", "bulk-data-imp", "alerts", "forms", "admin-4"], true,
  );
  const defaultTab = showBulkDataImp ? "bulk-data-imp" : "alerts";
  const activeTab = isExternal ? "bulk-data-imp"
    : requestedTab === "admin-4" && !showMasterData ? defaultTab
    : requestedTab === "bulk-data-imp" && !showBulkDataImp ? defaultTab
    : requestedTab || defaultTab;
  const [isSubViewActive, setIsSubViewActive] = useState(false);

  const handleSubViewChange = useCallback((isSubView: boolean) => {
    setIsSubViewActive(isSubView);
  }, []);

  // Resolve permissions before rendering; never replace restored state during role hydration.
  if (!uiRole) return <div role="status">Loading Admin…</div>;

  const getPageTitle = () => {
    switch (activeTab) {
      case "bulk-data-imp":
        return "Bulk Data Import";
      case "alerts":
        return "Alert Configuration";
      case "forms":
        return "Forms";
      case "admin-4":
        return "Master Data";
      default:
        return "Admin";
    }
  };

  const hideHeader = activeTab === "admin-4" && isSubViewActive;

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {!hideHeader && (
          <div className="flex items-center justify-between relative">
            <h1 className="text-2xl font-bold text-black dark:text-white" data-testid="I4.QL.3.1">
              <Marker id="I4.QL.3.1" />{getPageTitle()}
            </h1>
            
            <TabsList className="bg-gray-100 absolute left-1/2 -translate-x-1/2">
              {showBulkDataImp && (
                <TabsTrigger 
                  value="bulk-data-imp" 
                  className={cn(
                    "px-4",
                    activeTab === "bulk-data-imp" && "bg-[#52baf3] text-white data-[state=active]:bg-[#52baf3] data-[state=active]:text-white"
                  )}
                  data-testid="I4.QL.3.2"
                >
                  <Marker id="I4.QL.3.2" />
                  Bulk Data Imp
                </TabsTrigger>
              )}
              {!isExternal && (
                <TabsTrigger 
                  value="alerts" 
                  className={cn(
                    "px-4",
                    activeTab === "alerts" && "bg-[#52baf3] text-white data-[state=active]:bg-[#52baf3] data-[state=active]:text-white"
                  )}
                  data-testid="I4.QL.3.3"
                >
                  <Marker id="I4.QL.3.3" />
                  Alerts
                </TabsTrigger>
              )}
              {!isExternal && (
                <TabsTrigger 
                  value="forms" 
                  className={cn(
                    "px-4",
                    activeTab === "forms" && "bg-[#52baf3] text-white data-[state=active]:bg-[#52baf3] data-[state=active]:text-white"
                  )}
                  data-testid="I4.QL.3.4"
                >
                  <Marker id="I4.QL.3.4" />
                  Forms
                </TabsTrigger>
              )}
              {showMasterData && (
                <TabsTrigger 
                  value="admin-4" 
                  className={cn(
                    "px-4",
                    activeTab === "admin-4" && "bg-[#52baf3] text-white data-[state=active]:bg-[#52baf3] data-[state=active]:text-white"
                  )}
                  data-testid="I4.QL.3.5"
                >
                  <Marker id="I4.QL.3.5" />
                  Master Data
                </TabsTrigger>
              )}
            </TabsList>
          </div>
        )}

        <TabsContent value="bulk-data-imp" className="mt-6">
          <BulkDataImport />
        </TabsContent>

        {!isExternal && (
          <TabsContent value="alerts" className="mt-6">
            <Alerts />
          </TabsContent>
        )}

        {!isExternal && (
          <TabsContent value="forms" className="mt-6">
            <Forms />
          </TabsContent>
        )}

        {showMasterData && (
          <TabsContent value="admin-4" className={hideHeader ? "mt-0" : "mt-6"}>
            <Admin4Dashboard onSubViewChange={handleSubViewChange} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
