import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Switch, Route, useLocation } from "wouter";
import { ChangeRequestProvider } from "@/contexts/ChangeRequestContext";
import { ChangeModeProvider } from "@/contexts/ChangeModeContext";
import { TechnicalModule } from "./pages/TechnicalModule";
import Alerts from "./pages/admin/Alerts";
import Dashboard from "./pages/Dashboard";
import { FEATURES } from "./config/features";

import NotFound from "./pages/not-found";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ChangeRequestProvider>
        <ChangeModeProvider>
          <TooltipProvider>
            <div className="min-h-screen bg-gray-50">
              <Switch>
                <Route path="/" component={TechnicalModule} />
                {FEATURES.DASHBOARD && <Route path="/dashboard" component={Dashboard} />}
                <Route path="/pms/:subpage" component={TechnicalModule} />
                <Route path="/spares" component={TechnicalModule} />
                <Route path="/stores" component={TechnicalModule} />
                <Route path="/reports" component={TechnicalModule} />
                <Route path="/admin" component={TechnicalModule} />
                <Route path="/admin/:subpage" component={TechnicalModule} />
                <Route component={NotFound} />
              </Switch>
            </div>
            <Toaster />
          </TooltipProvider>
        </ChangeModeProvider>
      </ChangeRequestProvider>
    </QueryClientProvider>
  );
}

export default App;