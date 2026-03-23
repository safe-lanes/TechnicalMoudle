import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Switch, Route, useLocation } from "wouter";
import { AuthProvider } from "@/contexts/AuthContext";
import { UIRoleProvider } from "@/contexts/UIRoleContext";
import { ChangeRequestProvider } from "@/contexts/ChangeRequestContext";
import { ChangeModeProvider } from "@/contexts/ChangeModeContext";
import { VesselProvider } from "@/contexts/VesselContext";
import { OfflineProvider } from "@/contexts/OfflineContext";
import { MarkerProvider } from "@/contexts/MarkerContext";
import { PermissionsProvider, ProtectedRoute } from "@/contexts/PermissionsContext";
import { TechnicalModule } from "./pages/TechnicalModule";
import Alerts from "./pages/admin/Alerts";
import TestE2E from "./pages/TestE2E";
import DefectFormWizard from "./pages/defects/DefectFormWizard";
import WorkOrderFormPage from "./pages/pms/WorkOrderFormPage";
import JobsFormPage from "./pages/pms/JobsFormPage";
import AnomaliesPage from "./pages/pms/AnomaliesPage";
import AddEditFleetComponent from "./pages/admin/AddEditFleetComponent";
import BulkUpdateSpares from "./pages/spares/BulkUpdateSpares";
import BulkUpdateStores from "./pages/stores/BulkUpdateStores";

import NotFound from "./pages/not-found";
import { ChatButton } from "./components/chat/ChatButton";

function App() {
  return (
    <MarkerProvider>
      <AuthProvider>
        <UIRoleProvider>
          <QueryClientProvider client={queryClient}>
            <PermissionsProvider>
            <VesselProvider>
              <OfflineProvider>
                <ChangeRequestProvider>
                  <ChangeModeProvider>
                    <TooltipProvider>
            <div className="min-h-screen bg-gray-50">
              <Switch>
                <Route path="/" component={TechnicalModule} />
                <Route path="/pms" component={TechnicalModule} />
                <Route path="/pms/maintenance-records/:componentId" component={TechnicalModule} />
                
                {/* Anomalies page - standalone, no TechnicalModule layout */}
                <Route path="/pms/anomalies">
                  {() => <ProtectedRoute><AnomaliesPage /></ProtectedRoute>}
                </Route>
                
                {/* Work Order form routes - standalone, no TechnicalModule layout */}
                <Route path="/pms/work-order/new/:componentId">
                  {() => <ProtectedRoute><WorkOrderFormPage mode="new" /></ProtectedRoute>}
                </Route>
                <Route path="/pms/work-order/:id">
                  {() => <ProtectedRoute><WorkOrderFormPage mode="execution" /></ProtectedRoute>}
                </Route>
                
                {/* Jobs Form route - standalone, no TechnicalModule layout */}
                <Route path="/pms/job/:id">
                  {() => <ProtectedRoute><JobsFormPage /></ProtectedRoute>}
                </Route>
                
                <Route path="/pms/modify-pms/jobs" component={TechnicalModule} />
                <Route path="/pms/:subpage" component={TechnicalModule} />
                <Route path="/spares" component={TechnicalModule} />
                <Route path="/spares/bulk-update">
                  {() => <ProtectedRoute><BulkUpdateSpares /></ProtectedRoute>}
                </Route>
                <Route path="/stores" component={TechnicalModule} />
                <Route path="/stores/bulk-update">
                  {() => <ProtectedRoute><BulkUpdateStores /></ProtectedRoute>}
                </Route>
                <Route path="/reports" component={TechnicalModule} />
                
                {/* Defect form routes - standalone, no TechnicalModule layout */}
                <Route path="/defects/new">
                  {() => <ProtectedRoute><DefectFormWizard mode="new" /></ProtectedRoute>}
                </Route>
                <Route path="/defects/edit/:id">
                  {() => <ProtectedRoute><DefectFormWizard mode="edit" /></ProtectedRoute>}
                </Route>
                <Route path="/defects/view/:id">
                  {() => <ProtectedRoute><DefectFormWizard mode="view" /></ProtectedRoute>}
                </Route>
                <Route path="/defects/close/:id">
                  {() => <ProtectedRoute><DefectFormWizard mode="edit" initialStep={3} /></ProtectedRoute>}
                </Route>
                
                {/* Other defects routes - with TechnicalModule layout */}
                <Route path="/defects" component={TechnicalModule} />
                <Route path="/defects/:subpage" component={TechnicalModule} />
                
                <Route path="/admin" component={TechnicalModule} />
                <Route path="/admin/fleet-component-editor/:id?">
                  {() => <ProtectedRoute><AddEditFleetComponent /></ProtectedRoute>}
                </Route>
                <Route path="/admin/:subpage" component={TechnicalModule} />
                
                <Route path="/cert-surveys" component={TechnicalModule} />
                <Route path="/cert-surveys/:subpage" component={TechnicalModule} />
                
                {/* ====== NOON REPORT MODULE ROUTES — START (remove to disable) ====== */}
                <Route path="/noon-report" component={TechnicalModule} />
                <Route path="/noon-report/entry/:id" component={TechnicalModule} />
                <Route path="/noon-report/:subpage" component={TechnicalModule} />
                {/* ====== NOON REPORT MODULE ROUTES — END ====== */}
                
                <Route path="/test-e2e" component={TestE2E} />
                <Route component={NotFound} />
              </Switch>
            </div>
              <ChatButton />
              <Toaster />
                    </TooltipProvider>
                  </ChangeModeProvider>
                </ChangeRequestProvider>
              </OfflineProvider>
            </VesselProvider>
          </PermissionsProvider>
          </QueryClientProvider>
        </UIRoleProvider>
      </AuthProvider>
    </MarkerProvider>
  );
}

export default App;