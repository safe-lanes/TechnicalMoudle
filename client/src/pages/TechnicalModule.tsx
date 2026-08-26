import { useState, useEffect } from "react";
import { TopMenuBar } from "@/components/TopMenuBar";
import { SideMenuBar } from "@/components/SideMenuBar";
import { useUIRole } from "@/contexts/UIRoleContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { ShieldX } from "lucide-react";
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
import SuperintendentPage from "./pms/SuperintendentPage";
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
import PurchasingPage from "./purchasing/PurchasingPage";
import { useLocation, useParams } from "wouter";
import DataMasters from "./admin/DataMasters";
import ShipsCertificatesAdmin from "./admin/ShipsCertificatesAdmin";
import ShipsSurveysAdmin from "./admin/ShipsSurveysAdmin";
import AccessControl from "./admin/AccessControl";
import AuditTrail from "./admin/AuditTrail";
import RetentionSettings from "./admin/RetentionSettings";
import RanksAdmin from "./admin/RanksAdmin";
import AddEditFleetComponent from "./admin/AddEditFleetComponent";
import SyncDashboard from "./admin/SyncDashboard";
import ShipskartCatalogue from "./admin/ShipskartCatalogue";
import SyncConflictReview from "./admin/SyncConflictReview";
import SyncProvisioning from "./admin/SyncProvisioning";
import SyncFleetOverview from "./admin/SyncFleetOverview";
import ApprovalWorkflow from "./admin/ApprovalWorkflow";
import ApprovalEngineAdminPage from "./admin/ApprovalEngineAdminPage";
// ====== NOON REPORT MODULE — START (remove to disable) ======
import NoonEntryForm from "./noon-report/NoonEntryForm";
import ReportHistory from "./noon-report/ReportHistory";
import FuelDashboardPlaceholder from "./noon-report/FuelDashboard";
import AlertsPanelPlaceholder from "./noon-report/AlertsPanel";
import BunkerManagementPlaceholder from "./noon-report/BunkerManagement";
import ReportsExportPlaceholder from "./noon-report/ReportsExport";
import FleetOverviewPlaceholder from "./noon-report/FleetOverview";
// ====== NOON REPORT MODULE — END ======

export const TechnicalModule = () => {
  const [location, setLocation] = useLocation();
  const params = useParams();
  const { isSailAdmin, isVessel } = useUIRole();
  const { currentUser } = useAuth();
  // F6 (Q2): the Approval Engine builder is ADMIN-only — same role set as the menu + API guard.
  const isApprovalEngineAdmin = ["PMS Admin", "Sail Admin", "Super Admin"].includes(currentUser?.role ?? "");
  const { canViewSidebarItem, status: permissionStatus } = usePermissions();
  
  // Derive state from URL
  const getStateFromUrl = () => {
    if (location === "/admin") {
      return { subModule: "admin", menuItem: "masters" };
    } else if (location.startsWith("/admin/fleet-component-editor")) {
      return { subModule: "admin", menuItem: "fleet-component-editor" };
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
    } else if (location.startsWith("/purchasing")) {
      return { subModule: "purchasing", menuItem: "purchasing" };
    // ====== NOON REPORT MODULE — START ======
    } else if (location === "/noon-report") {
      return { subModule: "noon-report", menuItem: "entry" };
    } else if (location.startsWith("/noon-report/")) {
      const subpage = location.replace("/noon-report/", "");
      return { subModule: "noon-report", menuItem: subpage };
    // ====== NOON REPORT MODULE — END ======
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
    } else if (subModule === "purchasing") {
      setSelectedMenuItem("purchasing");
      setLocation("/purchasing");
    // ====== NOON REPORT MODULE — START ======
    } else if (subModule === "noon-report") {
      setSelectedMenuItem("entry");
      setLocation("/noon-report/entry");
    // ====== NOON REPORT MODULE — END ======
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
        <div className="w-20 min-w-[80px] flex-shrink-0 bg-[#16569e]">
          <SideMenuBar 
            subModule={selectedSubModule}
            selectedItem={selectedMenuItem}
            onItemSelect={handleMenuItemSelect}
          />
        </div>
        
        {/* Main Content Area */}
        <div className={`flex-1 min-h-0 overflow-auto ${selectedMenuItem === "fleet-component-editor" ? "" : "p-6"}`}>
          {/* F6 (Q2): Approval Engine builder is admin-only — deny non-admins unconditionally
              (independent of permission status), so a plain Office "User" hitting the URL is refused. */}
          {(selectedMenuItem === "approval-engine" && !isApprovalEngineAdmin) || ((permissionStatus === "configured" || permissionStatus === "error") && !(["access-control", "audit-trail", "retention-settings"].includes(selectedMenuItem) && isSailAdmin) && !(selectedMenuItem === "approval-engine" && isApprovalEngineAdmin) && selectedSubModule !== "purchasing" && !canViewSidebarItem(selectedSubModule, selectedMenuItem)) ? (
            <div className="flex items-center justify-center h-full min-h-[400px]" data-testid="access-denied">
              <div className="text-center">
                <ShieldX className="h-16 w-16 text-red-400 mx-auto mb-4" />
                <h2 className="text-2xl font-semibold text-gray-600 mb-2" data-testid="text-access-denied-title">Access Denied</h2>
                <p className="text-gray-500 mb-4" data-testid="text-access-denied-description">
                  {permissionStatus === "error"
                    ? "Unable to verify your permissions. Please try again later."
                    : "You do not have permission to access this page."}
                </p>
                <button
                  onClick={() => {
                    if (canViewSidebarItem("pms", "dashboard")) {
                      setLocation("/pms/dashboard");
                    } else {
                      const fallbackRoutes = [
                        { sub: "pms", item: "components", path: "/pms/components" },
                        { sub: "pms", item: "work-orders", path: "/pms/work-orders" },
                        { sub: "admin", item: "masters", path: "/admin/masters" },
                      ];
                      const found = fallbackRoutes.find(r => canViewSidebarItem(r.sub, r.item));
                      setLocation(found?.path ?? "/pms/dashboard");
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  data-testid="btn-go-dashboard"
                >
                  Go to Dashboard
                </button>
              </div>
            </div>
          ) : selectedSubModule === "pms" && selectedMenuItem === "dashboard" ? (
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
          ) : selectedSubModule === "pms" && selectedMenuItem === "superintendent" ? (
            <SuperintendentPage />
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
          ) : selectedSubModule === "admin" && selectedMenuItem === "ranks" ? (
            <RanksAdmin />
          ) : selectedSubModule === "admin" && selectedMenuItem === "retention-settings" && isSailAdmin ? (
            <RetentionSettings />
          ) : selectedSubModule === "admin" && selectedMenuItem === "retention-settings" && !isSailAdmin ? (
            <div className="flex items-center justify-center h-full min-h-[400px]" data-testid="access-denied-retention">
              <div className="text-center">
                <ShieldX className="h-16 w-16 text-red-400 mx-auto mb-4" />
                <h2 className="text-2xl font-semibold text-gray-600 mb-2">Access Denied</h2>
                <p className="text-gray-500 mb-4">Retention Settings is restricted to Sail Admin only.</p>
              </div>
            </div>
          ) : selectedSubModule === "admin" && selectedMenuItem === "audit-trail" && isSailAdmin ? (
            <AuditTrail />
          ) : selectedSubModule === "admin" && selectedMenuItem === "audit-trail" && !isSailAdmin ? (
            <div className="flex items-center justify-center h-full min-h-[400px]" data-testid="access-denied-audit-trail">
              <div className="text-center">
                <ShieldX className="h-16 w-16 text-red-400 mx-auto mb-4" />
                <h2 className="text-2xl font-semibold text-gray-600 mb-2">Access Denied</h2>
                <p className="text-gray-500 mb-4">The Audit Trail is restricted to Sail Admin only.</p>
              </div>
            </div>
          ) : selectedSubModule === "admin" && selectedMenuItem === "access-control" && isSailAdmin ? (
            <AccessControl />
          ) : selectedSubModule === "admin" && selectedMenuItem === "access-control" && !isSailAdmin ? (
            <div className="flex items-center justify-center h-full min-h-[400px]" data-testid="access-denied-sail-admin-only">
              <div className="text-center">
                <ShieldX className="h-16 w-16 text-red-400 mx-auto mb-4" />
                <h2 className="text-2xl font-semibold text-gray-600 mb-2" data-testid="text-access-denied-title">Access Denied</h2>
                <p className="text-gray-500 mb-4" data-testid="text-access-denied-description">Access Control is restricted to Sail Admin only.</p>
                <button
                  onClick={() => setLocation("/admin/masters")}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  data-testid="btn-go-masters"
                >
                  Go to Masters
                </button>
              </div>
            </div>
          ) : selectedSubModule === "admin" && selectedMenuItem === "sync-dashboard" ? (
            <SyncDashboard />
          ) : selectedSubModule === "admin" && selectedMenuItem === "sync-conflicts" ? (
            <SyncConflictReview />
          ) : selectedSubModule === "admin" && selectedMenuItem === "sync-provisioning" ? (
            <SyncProvisioning />
          ) : selectedSubModule === "admin" && selectedMenuItem === "sync-fleet" ? (
            <SyncFleetOverview />
          ) : selectedSubModule === "admin" && selectedMenuItem === "shipskart-catalogue" ? (
            <ShipskartCatalogue />
          ) : selectedSubModule === "admin" && selectedMenuItem === "approval-workflow" ? (
            <ApprovalWorkflow />
          ) : selectedSubModule === "admin" && selectedMenuItem === "approval-engine" ? (
            <ApprovalEngineAdminPage />
          ) : selectedSubModule === "admin" && selectedMenuItem === "fleet-component-editor" ? (
            <AddEditFleetComponent />
          ) : selectedSubModule === "admin" ? (
            <PMSAdmin />
          ) : selectedSubModule === "pms" && selectedMenuItem === "reports" ? (
            <ReportsModule />
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
          ) : selectedSubModule === "purchasing" ? (
            <PurchasingPage />
          // ====== NOON REPORT MODULE — START ======
          ) : selectedSubModule === "noon-report" && selectedMenuItem === "entry" ? (
            <NoonEntryForm />
          ) : selectedSubModule === "noon-report" && selectedMenuItem.startsWith("entry/") ? (
            <NoonEntryForm reportId={selectedMenuItem.replace("entry/", "")} />
          ) : selectedSubModule === "noon-report" && selectedMenuItem === "history" ? (
            <ReportHistory />
          ) : selectedSubModule === "noon-report" && selectedMenuItem === "fuel-dashboard" ? (
            <FuelDashboardPlaceholder />
          ) : selectedSubModule === "noon-report" && selectedMenuItem === "alerts" ? (
            <AlertsPanelPlaceholder />
          ) : selectedSubModule === "noon-report" && selectedMenuItem === "bunker" ? (
            <BunkerManagementPlaceholder />
          ) : selectedSubModule === "noon-report" && selectedMenuItem === "reports" ? (
            <ReportsExportPlaceholder />
          ) : selectedSubModule === "noon-report" && selectedMenuItem === "fleet" ? (
            <FleetOverviewPlaceholder />
          // ====== NOON REPORT MODULE — END ======
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