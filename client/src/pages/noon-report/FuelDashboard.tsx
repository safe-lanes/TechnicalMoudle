import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gauge } from "lucide-react";

export default function FuelDashboard() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-800">Fuel Dashboard</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Gauge className="h-5 w-5 text-blue-600" />
            Coming in Phase 2
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">The Fuel Dashboard with ROB status cards, consumption trend charts, and CII gauge will be built in Phase 2.</p>
        </CardContent>
      </Card>
    </div>
  );
}
