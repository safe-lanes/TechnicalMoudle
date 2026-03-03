import { useState, useEffect } from "react";
import { TopMenuBar } from "@/components/TopMenuBar";
import { SideMenuBar } from "@/components/SideMenuBar";
import { useUIRole } from "@/contexts/UIRoleContext";
import Dashboard from "./pms/Dashboard";
import Components from "./pms/Components";
import WorkOrders from "./pms/WorkOrders";
import RunningHours from "./pms/RunningHours";
import MaintenanceRecords from "./pms/MaintenanceRecords";
import { ModifyPMS } from "@/components/modifyPms/ModifyPMS";
import JobsSelector from "./modify-pms/JobsSelector";
import Spares from "./spares/SparesNew";
import Stores from "./stores/Stores";
import PMSAdmin from "./pms/PMSAdmin";
import ReportsModule from "./reports/ReportsModule";
import DefectsLogWithTabs from "./defects/DefectsLogWithTabs";
import DefectsDashboard from "./defects/DefectsDashboard";
import DefectsActive from "./defects/DefectsActive";
import DefectsResolved from "./defects/DefectsResolved";
import DefectsReports from "./defects/DefectsReports";
import DefectsCoC from "./defects/DefectsCoC";
import DefectFormWizard from "./defects/DefectFormWizard";
import RecurringDefects from "./RecurringDefects";
import CertificatesPage from "./cert-surveys/CertificatesPage";
import SurveysPage from "./cert-surveys/SurveysPage";
import { useLocation, useParams } from "wouter";
import DataMasters from "./admin/DataMasters";
import ShipsCertificatesAdmin from "./admin/ShipsCertificatesAdmin";
import ShipsSurveysAdmin from "./admin/ShipsSurveysAdmin";

export const TechnicalModule = () => {
  const [location, setLocation] = useLocation();
  const params = useParams();
  const { isSailAdmin } = useUIRole();
  
  // Derive state from URL
  const getStateFromUrl = () => {
    if (location === "/admin") {
      return { subModule: "admin", menuItem: "masters" }; // Default to alerts when accessing /admin
    } else if (location.startsWith("/admin/")) {
      const subpage = location.replace("/admin/", "");
      return { subModule: "admin", menuItem: subpage };
    } else if (location === "/defects/new") {
      return { subModule: "defects", menuItem: "new" };
    } else if (location.match(/^\/defects\/edit\/[^/]+$/)) {
      return { subModule: "defects", menuItem: "edit" };
    } else if (location === "/defects") {
      return { subModule: "defects", menuItem: "dashboard" }; // Default to dashboard when accessing /defects
    } else if (location === "/defects/active") {
      return { subModule: "defects", menuItem: "defect-log" };
    } else if (location === "/defects/coc") {
      return { subModule: "defects", menuItem: "coc" };
    } else if (location === "/defects/recurring") {
      return { subModule: "defects", menuItem: "recurring" };
    } else if (location.startsWith("/defects/")) {
      const subpage = location.replace("/defects/", "");
      return { subModule: "defects", menuItem: subpage };
    } else if (location.startsWith("/pms/")) {
      const subpage = location.replace("/pms/", "");
      return { subModule: "pms", menuItem: subpage };
    } else if (location.startsWith("/spares")) {
      return { subModule: "pms", menuItem: "spares" };
    } else if (location.startsWith("/stores")) {
      return { subModule: "pms", menuItem: "stores" };
    } else if (location.startsWith("/reports")) {
      return { subModule: "pms", menuItem: "reports" };
    } else if (location === "/cert-surveys") {
      return { subModule: "cert-surveys", menuItem: "certificates" };
    } else if (location.startsWith("/cert-surveys/")) {
      const subpage = location.replace("/cert-surveys/", "");
      return { subModule: "cert-surveys", menuItem: subpage };
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
    // Set default menu item based on submodule and navigate
    if (subModule === "admin") {
      setSelectedMenuItem("masters"); // Default to alerts for admin
      setLocation("/admin/masters");
    } else if (subModule === "defects") {
      setSelectedMenuItem("active"); // Default to active for defects
      setLocation("/defects");
    } else if (subModule === "pms") {
      setSelectedMenuItem("dashboard");
      setLocation("/pms/dashboard");
    } else if (subModule === "dashboard") {
      setSelectedMenuItem("overview");
      setLocation("/dashboard");
    } else if (subModule === "cert-surveys") {
      setSelectedMenuItem("certificates");
      setLocation("/cert-surveys");
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
      
      <div className="flex h-[calc(100vh-68px)] overflow-hidden">
        {/* Sidebar column with continuous dark blue background - wrapper provides full-height color */}
        <div className="w-20 min-w-[80px] flex-shrink-0 bg-[#1565c0]">
          <SideMenuBar 
            subModule={selectedSubModule}
            selectedItem={selectedMenuItem}
            onItemSelect={handleMenuItemSelect}
          />
        </div>
        
        {/* Main Content Area */}
        <div className="flex-1 p-6 min-h-0 overflow-auto">
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
          ) : selectedSubModule === "pms" && selectedMenuItem === "modify-pms/jobs" ? (
            <JobsSelector />
          ) : selectedSubModule === "pms" && selectedMenuItem === "admin" ? (
            <PMSAdmin />
          ) : selectedSubModule === "pms" && selectedMenuItem.startsWith("maintenance-records") ? (
            <MaintenanceRecords />
          ) : selectedSubModule === "admin" && selectedMenuItem === "masters" ? (
            <DataMasters />
          ) : selectedSubModule === "admin" && selectedMenuItem === "ships-certificates" ? (
            <ShipsCertificatesAdmin />
          ) : selectedSubModule === "admin" && selectedMenuItem === "ships-surveys" ? (
            <ShipsSurveysAdmin />
          ) : selectedSubModule === "admin" ? (
            <PMSAdmin />
          ) : selectedSubModule === "pms" && selectedMenuItem === "reports" ? (
            <ReportsModule />
          ) : selectedSubModule === "defects" && !isSailAdmin ? (
            <div className="flex items-center justify-center h-full min-h-[400px]" data-testid="defects-coming-soon">
              <div className="text-center">
                <h2 className="text-2xl font-semibold text-gray-600 mb-2" data-testid="text-coming-soon-title">Feature coming soon</h2>
                <p className="text-gray-500" data-testid="text-coming-soon-description">The Defects module is currently under development.</p>
              </div>
            </div>
          ) : selectedSubModule === "defects" && (selectedMenuItem === "new" || selectedMenuItem === "edit") ? (
            <DefectFormWizard />
          ) : selectedSubModule === "defects" && selectedMenuItem === "dashboard" ? (
            <DefectsDashboard />
          ) : selectedSubModule === "defects" && selectedMenuItem === "defect-log" ? (
            <DefectsLogWithTabs />
          ) : selectedSubModule === "defects" && selectedMenuItem === "coc" ? (
            <DefectsCoC />
          ) : selectedSubModule === "defects" && selectedMenuItem === "recurring" ? (
            <RecurringDefects />
          ) : selectedSubModule === "defects" && selectedMenuItem === "resolved" ? (
            <DefectsResolved />
          ) : selectedSubModule === "defects" && selectedMenuItem === "reports" ? (
            <DefectsReports />
          ) : selectedSubModule === "cert-surveys" && selectedMenuItem === "certificates" ? (
            <CertificatesPage />
          ) : selectedSubModule === "cert-surveys" && selectedMenuItem === "surveys" ? (
            <SurveysPage />
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