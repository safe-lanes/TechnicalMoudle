import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye, Edit } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import DefectModal from "./DefectModal";
import { getComputedStatus } from "@/lib/defectStatusUtils";
import { useQueryClient } from "@tanstack/react-query";
import type { Defect } from "@shared/schema";

interface DefectsListModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  defects: (Defect & { computedStatus?: { label: string; color: string } })[];
  canEdit?: boolean;
}

export function DefectsListModal({ open, onClose, title, defects, canEdit = true }: DefectsListModalProps) {
  const queryClient = useQueryClient();
  const [viewModal, setViewModal] = useState<{ open: boolean; defectId: string | null }>({ 
    open: false, 
    defectId: null 
  });
  const [editModal, setEditModal] = useState<{ open: boolean; defectId: string | null }>({ 
    open: false, 
    defectId: null 
  });

  const handleViewClick = (defect: Defect) => {
    setViewModal({ open: true, defectId: defect.id });
  };

  const handleEditClick = (defect: Defect) => {
    if (!canEdit) return;
    setEditModal({ open: true, defectId: defect.id });
  };

  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return "-";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      return dateStr;
    }
    return dateStr;
  };

  const truncateText = (text: string | null | undefined, maxLength: number = 40): string => {
    if (!text) return "-";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  const getDisplayActionText = (defect: Defect): string | null => {
    // Prioritize actions array over actionTakenRequested since actions are updated via the form
    if (defect.actions && Array.isArray(defect.actions) && defect.actions.length > 0) {
      const firstAction = defect.actions[0] as { actionDescription?: string };
      if (firstAction?.actionDescription) {
        return firstAction.actionDescription;
      }
    }
    return defect.actionTakenRequested || null;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="max-w-[90vw] max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="text-xl font-semibold text-[#0f4c81]">
              {title}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-[#eff6ff] z-10">
                <TableRow>
                  <TableHead className="font-medium w-[120px] bg-[#eff6ff] text-[#0e4c81]">ID</TableHead>
                  <TableHead className="font-medium w-[100px] bg-[#eff6ff] text-[#0e4c81]">Vessel</TableHead>
                  <TableHead className="font-medium w-[100px] bg-[#eff6ff] text-[#0e4c81]">Issue Date</TableHead>
                  <TableHead className="font-medium w-[80px] bg-[#eff6ff] text-[#0e4c81]">Category</TableHead>
                  <TableHead className="font-medium min-w-[180px] bg-[#eff6ff] text-[#0e4c81]">Description</TableHead>
                  <TableHead className="font-medium min-w-[180px] bg-[#eff6ff] text-[#0e4c81]">Action Taken / Requested</TableHead>
                  <TableHead className="font-medium w-[100px] bg-[#eff6ff] text-[#0e4c81]">Target Date</TableHead>
                  <TableHead className="font-medium w-[100px] bg-[#eff6ff] text-[#0e4c81]">Date Compl.</TableHead>
                  <TableHead className="font-medium w-[100px] bg-[#eff6ff] text-[#0e4c81]">Status</TableHead>
                  <TableHead className="font-medium w-[80px] text-center bg-[#eff6ff] text-[#0e4c81]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {defects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                      No defects found
                    </TableCell>
                  </TableRow>
                ) : (
                  defects.map((defect) => {
                    const computedStatus = getComputedStatus(defect);
                    return (
                      <TableRow key={defect.id} className="hover:bg-gray-50">
                        <TableCell className="font-medium text-blue-600">
                          {defect.id}
                        </TableCell>
                        <TableCell>{defect.vesselName || defect.vesselId}</TableCell>
                        <TableCell>{formatDate(defect.issueDate)}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1">
                            {defect.category}
                            {defect.is_coc && (
                              <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                                CoC
                              </span>
                            )}
                          </span>
                        </TableCell>
                        <TableCell title={defect.description}>
                          {truncateText(defect.description)}
                        </TableCell>
                        <TableCell title={getDisplayActionText(defect) || ""}>
                          {truncateText(getDisplayActionText(defect))}
                        </TableCell>
                        <TableCell>{formatDate(defect.targetCloseDate)}</TableCell>
                        <TableCell>{formatDate(defect.dateCompleted)}</TableCell>
                        <TableCell>
                          <span className={computedStatus.color}>
                            {computedStatus.label}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-center">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    onClick={() => handleViewClick(defect)}
                                    data-testid={`modal-view-${defect.id}`}
                                  >
                                    <Eye className="h-4 w-4 text-gray-500" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>View</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className={`h-7 w-7 ${!canEdit ? "opacity-50 cursor-not-allowed" : ""}`}
                                    onClick={() => handleEditClick(defect)}
                                    disabled={!canEdit}
                                    data-testid={`modal-edit-${defect.id}`}
                                  >
                                    <Edit className="h-4 w-4 text-gray-500" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Edit</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          
          <div className="border-t pt-3 flex justify-between items-center text-sm text-gray-600">
            <span>Total: {defects.length} defect{defects.length !== 1 ? "s" : ""}</span>
          </div>
        </DialogContent>
      </Dialog>

      {viewModal.defectId && (
        <DefectModal
          open={viewModal.open}
          onClose={() => {
            setViewModal({ open: false, defectId: null });
          }}
          defectId={viewModal.defectId}
          mode="view"
        />
      )}

      {editModal.defectId && (
        <DefectModal
          open={editModal.open}
          onClose={() => {
            setEditModal({ open: false, defectId: null });
            queryClient.invalidateQueries({ queryKey: ['/technical/api/defects?includeClosedDefects=true'] });
          }}
          defectId={editModal.defectId}
          mode="edit"
        />
      )}
    </>
  );
}
