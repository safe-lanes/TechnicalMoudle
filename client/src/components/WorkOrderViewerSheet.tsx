import React from "react";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import WorkOrderFormPage from "@/pages/pms/WorkOrderFormPage";

interface WorkOrderViewerSheetProps {
  workOrderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const WorkOrderViewerSheet: React.FC<WorkOrderViewerSheetProps> = ({
  workOrderId,
  open,
  onOpenChange,
}) => {
  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        className="w-full sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl p-0 overflow-hidden"
        side="right"
        data-testid="work-order-viewer-sheet"
      >
        <div className="h-full overflow-auto">
          {workOrderId && (
            <WorkOrderFormPage 
              mode="execution"
              embedded={true}
              workOrderIdOverride={workOrderId}
              onClose={handleClose}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default WorkOrderViewerSheet;
