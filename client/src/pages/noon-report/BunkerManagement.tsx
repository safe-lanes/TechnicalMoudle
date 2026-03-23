import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Fuel } from "lucide-react";

export default function BunkerManagement() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-800">Bunker Management</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Fuel className="h-5 w-5 text-blue-600" />
            Coming in Phase 4
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">Bunker Management with BDN entry form, ROB tracking, and cost summary will be built in Phase 4.</p>
        </CardContent>
      </Card>
    </div>
  );
}
