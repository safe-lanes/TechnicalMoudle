import React from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";

const DefectsCoC: React.FC = () => {
  const [, setLocation] = useLocation();

  return (
    <div className="h-full bg-gray-50">
      {/* Page Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              Condition of Class (CoC)
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Setup pending – UI placeholders only
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={() => setLocation("/defects/active")}
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Defect Log
          </Button>
        </div>
      </div>

      {/* Empty State */}
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="text-center max-w-md">
          <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Flag className="h-8 w-8 text-gray-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-700 mb-2">
            Condition of Class Module
          </h2>
          <p className="text-gray-500">
            This section will track active CoC items and their closure.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DefectsCoC;