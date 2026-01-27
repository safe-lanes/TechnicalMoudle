import { Button } from "@/components/ui/button";
import { FileDown, Filter } from "lucide-react";

export default function RecurringDefects() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-black dark:text-white">Recurring Defects</h1>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            data-testid="button-export-all"
            disabled
          >
            <FileDown className="h-4 w-4 mr-2" />
            Export All
          </Button>
          <Button
            variant="outline"
            data-testid="button-toggle-filters"
            disabled
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
        </div>
      </div>

      <p className="text-lg text-muted-foreground">Coming Soon...</p>
    </div>
  );
}
