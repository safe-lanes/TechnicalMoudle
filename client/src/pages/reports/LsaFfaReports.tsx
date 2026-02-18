import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, LifeBuoy } from "lucide-react";

interface LsaFfaReportsProps {
  onBack: () => void;
  globalFilters?: {
    vessel: string;
    department: string;
    dateRange: { from: Date | null; to: Date | null };
    priority: string;
  };
}

const LsaFfaReports = ({ onBack }: LsaFfaReportsProps) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          data-testid="button-back-lsa-ffa"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100" data-testid="text-lsa-ffa-title">
            LSA/FFA Equipment
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Life-saving and fire-fighting equipment tracking, statutory compliance reports, and maintenance schedules
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-8 flex flex-col items-center justify-center text-center">
          <div className="p-3 rounded-lg bg-orange-100 text-orange-600 mb-4">
            <LifeBuoy className="h-8 w-8" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2" data-testid="text-no-reports">
            No Reports Yet
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md">
            LSA/FFA equipment reports will be added here. Check back soon for life-saving appliance inspections,
            fire-fighting equipment status, and statutory compliance reports.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default LsaFfaReports;
