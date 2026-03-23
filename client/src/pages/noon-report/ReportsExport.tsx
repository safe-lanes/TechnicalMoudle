import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileDown } from "lucide-react";

export default function ReportsExport() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-800">Reports & Export</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileDown className="h-5 w-5 text-blue-600" />
            Coming in Phase 5
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">PDF & Excel generation and email dispatch will be built in Phase 5.</p>
        </CardContent>
      </Card>
    </div>
  );
}
