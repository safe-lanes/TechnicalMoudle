import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Switch, Route, useLocation } from "wouter";
import { ChangeRequestProvider } from "@/contexts/ChangeRequestContext";
import { ChangeModeProvider } from "@/contexts/ChangeModeContext";
import { TechnicalModule } from "./pages/TechnicalModule";
import Alerts from "./pages/admin/Alerts";
import TestE2E from "./pages/TestE2E";

import NotFound from "./pages/not-found";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ChangeRequestProvider>
        <ChangeModeProvider>
          <TooltipProvider>
            <div className="min-h-screen bg-gray-50">
              <Switch>
                <Route path="/" component={TechnicalModule} />
                <Route path="/pms/:subpage" component={TechnicalModule} />
                <Route path="/spares" component={TechnicalModule} />
                <Route path="/stores" component={TechnicalModule} />
                <Route path="/reports" component={TechnicalModule} />
                <Route path="/defects" component={TechnicalModule} />
                <Route path="/defects/:subpage" component={TechnicalModule} />
                <Route path="/admin" component={TechnicalModule} />
                <Route path="/admin/:subpage" component={TechnicalModule} />
                <Route path="/test-e2e" component={TestE2E} />
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