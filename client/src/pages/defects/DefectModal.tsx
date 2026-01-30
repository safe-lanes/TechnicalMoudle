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
  isCoc?: boolean;
}

export default function DefectModal({
  open,
  onClose,
  defectId,
  vesselId,
  mode = "new",
  isCoc = false,
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
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const handleCompleted = () => {
    // Invalidate all defect-related queries including filtered ones (CoC, Active, etc.)
    queryClient.invalidateQueries({ 
      predicate: (query) => {
        const key = query.queryKey;
        return Array.isArray(key) && (
          (typeof key[0] === 'string' && key[0].includes('/technical/api/defects')) ||
          key[0] === 'defects'
        );
      }
    });
    onClose();
  };

  const getTitle = () => {
    const type = isCoc ? "CoC Defect" : "Defect Report";
    switch (mode) {
      case "edit":
        return `Edit ${type}`;
      case "view":
        return `View ${type}`;
      default:
        return `New ${type}`;
    }
  };

  const getDescription = () => {
    const type = isCoc ? "CoC defect" : "defect report";
    switch (mode) {
      case "edit":
        return `Edit the ${type} details below`;
      case "view":
        return `View the ${type} details`;
      default:
        return `Create a new ${type} by filling out the form below`;
    }
  };

  const showLoading = mode !== "new" && defectId && isLoading;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="w-[85vw] max-w-none h-[90vh] flex flex-col p-0 gap-0">
        {/* Hidden header for accessibility - visible header is in DefectFormWizard */}
        <DialogHeader className="sr-only">
          <DialogTitle>{getTitle()}</DialogTitle>
          <DialogDescription>
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
              isCoc={isCoc}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
