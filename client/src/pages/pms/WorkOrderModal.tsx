import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import WorkOrderFormPage from "./WorkOrderFormPage";

interface WorkOrderModalProps {
  open: boolean;
  onClose: () => void;
  workOrderId: string;
}

export default function WorkOrderModal({
  open,
  onClose,
  workOrderId,
}: WorkOrderModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="w-[85vw] max-w-none h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Edit Work Order</DialogTitle>
          <DialogDescription>
            Edit the work order details below
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-auto">
          <WorkOrderFormPage
            embedded={true}
            workOrderIdOverride={workOrderId}
            onClose={onClose}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
