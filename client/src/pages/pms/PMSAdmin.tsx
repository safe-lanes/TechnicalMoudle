import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BulkDataImport from "../admin/BulkDataImport";
import Alerts from "../admin/Alerts";
import Forms from "@/components/admin/Forms";
import Admin4Dashboard from "../admin/Admin4Dashboard";
import { Marker } from "@/components/Marker";
import { useUIRole } from "@/contexts/UIRoleContext";
import { cn } from "@/lib/utils";

export default function PMSAdmin() {
  const { isSailAdmin, isClientAdmin, isHeadOfDept } = useUIRole();
  const showAllAdminTabs = isSailAdmin || isClientAdmin || isHeadOfDept;
  const [activeTab, setActiveTab] = useState(showAllAdminTabs ? "bulk-data-imp" : "alerts");

  // Reset to "alerts" tab when switching to Vessel role (since hidden tabs shouldn't be active)
  useEffect(() => {
    if (!showAllAdminTabs && (activeTab === "bulk-data-imp" || activeTab === "admin-4")) {
      setActiveTab("alerts");
    }
  }, [showAllAdminTabs, activeTab]);

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

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex items-center justify-between relative">
          <h1 className="text-2xl font-bold text-black dark:text-white" data-testid="I4.QL.3.1">
            <Marker id="I4.QL.3.1" />{getPageTitle()}
          </h1>
          
          <TabsList className="bg-gray-100 absolute left-1/2 -translate-x-1/2">
            {showAllAdminTabs && (
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
            {showAllAdminTabs && (
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

        <TabsContent value="bulk-data-imp" className="mt-6">
          <BulkDataImport />
        </TabsContent>

        <TabsContent value="alerts" className="mt-6">
          <Alerts />
        </TabsContent>

        <TabsContent value="forms" className="mt-6">
          <Forms />
        </TabsContent>

        <TabsContent value="admin-4" className="mt-6">
          <Admin4Dashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
