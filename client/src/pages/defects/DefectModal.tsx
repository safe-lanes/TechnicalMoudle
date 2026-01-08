import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import DefectFormWizard from "./DefectFormWizard";

interface DefectModalProps {
  open: boolean;
  onClose: () => void;
  defectId?: string | null;
  vesselId?: string;
  mode?: "new" | "edit" | "view";
}

export default function DefectModal({
  open,
  onClose,
  defectId,
  vesselId,
  mode = "new",
}: DefectModalProps) {
  const { data: defect, isLoading } = useQuery({
    queryKey: ['/technical/api/defects', defectId],
    queryFn: async () => {
      if (!defectId) return null;
      const response = await fetch(`/technical/api/defects/${defectId}`);
      if (!response.ok) throw new Error('Failed to fetch defect');
      return response.json();
    },
    enabled: !!defectId && open && mode !== "new",
  });

  const handleCompleted = () => {
    queryClient.invalidateQueries({ queryKey: ['/technical/api/defects'] });
    queryClient.invalidateQueries({ queryKey: ['defects'] });
    onClose();
  };

  const getTitle = () => {
    switch (mode) {
      case "edit":
        return "Edit Defect Report";
      case "view":
        return "View Defect Report";
      default:
        return "New Defect Report";
    }
  };

  const getDescription = () => {
    switch (mode) {
      case "edit":
        return "Edit the defect report details below";
      case "view":
        return "View the defect report details";
      default:
        return "Create a new defect report by filling out the form below";
    }
  };

  const showLoading = mode !== "new" && defectId && isLoading;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="w-[85vw] max-w-none h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle>{getTitle()}</DialogTitle>
          <DialogDescription className="sr-only">
            {getDescription()}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-auto">
          {showLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-muted-foreground">Loading defect data...</div>
            </div>
          ) : (
            <DefectFormWizard 
              mode={mode}
              defect={mode !== "new" ? defect : undefined}
              onCompleted={handleCompleted}
              onBack={onClose}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
