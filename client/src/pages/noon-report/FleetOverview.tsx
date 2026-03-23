import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Ship } from "lucide-react";

export default function FleetOverview() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-800">Fleet Overview</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Ship className="h-5 w-5 text-blue-600" />
            Coming in Phase 6
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">The multi-vessel Fleet Overview dashboard (office/admin only) will be built in Phase 6.</p>
        </CardContent>
      </Card>
    </div>
  );
}
