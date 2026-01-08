import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import DefectFormWizard from "./DefectFormWizard";

interface NewDefectModalProps {
  isOpen: boolean;
  onClose: () => void;
  vesselId?: string;
}

export default function NewDefectModal({
  isOpen,
  onClose,
  vesselId,
}: NewDefectModalProps) {
  const handleCompleted = () => {
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[85vw] max-w-none h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle>New Defect Report</DialogTitle>
          <DialogDescription className="sr-only">
            Create a new defect report by filling out the form below
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-auto">
          <DefectFormWizard 
            mode="new" 
            onCompleted={handleCompleted}
            onBack={onClose}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
