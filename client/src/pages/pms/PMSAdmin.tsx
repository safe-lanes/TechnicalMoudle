import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BulkDataImport from "../admin/BulkDataImport";
import Alerts from "../admin/Alerts";
import Forms from "@/components/admin/Forms";
import Admin4Dashboard from "../admin/Admin4Dashboard";

export default function PMSAdmin() {
  const [activeTab, setActiveTab] = useState("bulk-data-imp");

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Bulk Data Import</h1>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start px-6 py-0 h-12 bg-transparent border-b rounded-none">
            <TabsTrigger 
              value="bulk-data-imp" 
              className="data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none"
              data-testid="tab-bulk-data-imp"
            >
              Bulk Data Imp
            </TabsTrigger>
            <TabsTrigger 
              value="alerts" 
              className="data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none"
              data-testid="tab-alerts"
            >
              Alerts
            </TabsTrigger>
            <TabsTrigger 
              value="forms" 
              className="data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none"
              data-testid="tab-forms"
            >
              Forms
            </TabsTrigger>
            <TabsTrigger 
              value="admin-4" 
              className="data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none"
              data-testid="tab-admin-4"
            >
              Admin 4
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bulk-data-imp" className="m-0">
            <BulkDataImport />
          </TabsContent>

          <TabsContent value="alerts" className="m-0">
            <Alerts />
          </TabsContent>

          <TabsContent value="forms" className="m-0">
            <Forms />
          </TabsContent>

          <TabsContent value="admin-4" className="m-0">
            <Admin4Dashboard />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
