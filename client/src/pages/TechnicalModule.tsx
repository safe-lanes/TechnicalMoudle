import React, { useState, useEffect } from "react";
import { TopMenuBar } from "@/components/TopMenuBar";
import { SideMenuBar } from "@/components/SideMenuBar";
import Dashboard from "./pms/Dashboard";
import Components from "./pms/Components";
import WorkOrders from "./pms/WorkOrders";
import RunningHours from "./pms/RunningHours";
import { ModifyPMS } from "@/components/modifyPms/ModifyPMS";
import Spares from "./spares/SparesNew";
import Stores from "./stores/Stores";
import AdminPanel from "./admin/AdminPanel";
import Alerts from "./admin/Alerts";
import IhmReports from "./reports/IhmReports";
import { useLocation, useParams } from "wouter";

export const TechnicalModule: React.FC = () => {
  const [location] = useLocation();
  const params = useParams();
  
  // Derive state from URL
  const getStateFromUrl = () => {
    if (location === "/admin") {
      return { subModule: "admin", menuItem: "forms" }; // Default to forms when accessing /admin
    } else if (location.startsWith("/admin/")) {
      const subpage = location.replace("/admin/", "");
      return { subModule: "admin", menuItem: subpage };
    } else if (location.startsWith("/pms/")) {
      const subpage = location.replace("/pms/", "");
      return { subModule: "pms", menuItem: subpage };
    } else if (location.startsWith("/spares")) {
      return { subModule: "pms", menuItem: "spares" };
    } else if (location.startsWith("/stores")) {
      return { subModule: "pms", menuItem: "stores" };
    } else if (location.startsWith("/reports")) {
      return { subModule: "pms", menuItem: "reports" };
    }
    return { subModule: "pms", menuItem: "dashboard" };
  };
  
  const { subModule, menuItem } = getStateFromUrl();
  const [selectedSubModule, setSelectedSubModule] = useState(subModule);
  const [selectedMenuItem, setSelectedMenuItem] = useState(menuItem);
  
  // Update state when URL changes
  useEffect(() => {
    const { subModule, menuItem } = getStateFromUrl();
    setSelectedSubModule(subModule);
    setSelectedMenuItem(menuItem);
  }, [location]);

  const handleSubModuleChange = (subModule: string) => {
    setSelectedSubModule(subModule);
    // Set default menu item based on submodule
    if (subModule === "admin") {
      setSelectedMenuItem("alerts"); // Default to alerts for admin
    } else {
      setSelectedMenuItem("dashboard"); // Default to dashboard for other modules
    }
  };

  const handleMenuItemSelect = (item: string) => {
    setSelectedMenuItem(item);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Menu Bar */}
      <TopMenuBar 
        selectedSubModule={selectedSubModule}
        onSubModuleChange={handleSubModuleChange}
      />
      
      <div className="flex">
        {/* Side Menu Bar */}
        <SideMenuBar 
          subModule={selectedSubModule}
          selectedItem={selectedMenuItem}
          onItemSelect={handleMenuItemSelect}
        />
        
        {/* Main Content Area */}
        <div className="flex-1">
          {selectedSubModule === "pms" && selectedMenuItem === "dashboard" ? (
            <Dashboard />
          ) : selectedSubModule === "pms" && selectedMenuItem === "components" ? (
            <Components />
          ) : selectedSubModule === "pms" && selectedMenuItem === "work-orders" ? (
            <WorkOrders />
          ) : selectedSubModule === "pms" && selectedMenuItem === "running-hrs" ? (
            <RunningHours />
          ) : selectedSubModule === "pms" && selectedMenuItem === "spares" ? (
            <Spares />
          ) : selectedSubModule === "pms" && selectedMenuItem === "stores" ? (
            <Stores />
          ) : selectedSubModule === "pms" && selectedMenuItem === "modify-pms" ? (
            <ModifyPMS />
          ) : selectedSubModule === "pms" && selectedMenuItem === "admin" ? (
            <AdminPanel />
          ) : selectedSubModule === "admin" ? (
            <AdminPanel />
          ) : selectedSubModule === "pms" && selectedMenuItem === "reports" ? (
            <IhmReports />
          ) : (
            <div className="p-6">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                  {selectedSubModule.toUpperCase()} - {selectedMenuItem.replace(/-/g, ' ').toUpperCase()}
                </h2>
                <p className="text-gray-600">
                  Content for {selectedSubModule} module, {selectedMenuItem} section will be displayed here.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};