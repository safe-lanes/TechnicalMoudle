import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { POSTPONEMENT_REASONS } from "@shared/postponementReasons";

interface MasterListItem {
  id: number;
  listType: string;
  listKey: string;
  listValue: string;
  displayOrder: number;
  isActive: boolean;
}

interface PostponeWorkOrderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  workOrder: {
    id?: string | null;
    workOrderNo?: string | null;
    templateCode?: string | null;
    component?: string | null;
    jobTitle: string;
    dueDate?: string | null;
    assignedTo?: string | null;
  } | null;
  onConfirm?: (workOrderId: string, postponeData: any) => void;
}

const PostponeWorkOrderDialog: React.FC<PostponeWorkOrderDialogProps> = ({
  isOpen,
  onClose,
  workOrder,
  onConfirm,
}) => {
  const [formData, setFormData] = useState({
    workOrderId: "",
    component: "",
    jobTitle: "",
    originalDueDate: "",
    reasonForPostponement: "",
    postponementRemarks: "",
    authorizedBy: "",
    approvalRemarks: "",
    nextDueDate: "",
    durationOfPostponement: "5 Days",
    informOfficer: false,
    attachDocument: false,
  });

  const [validationError, setValidationError] = useState("");

  const { data: masterListItems, isLoading: reasonsLoading, isError: reasonsError } = useQuery<MasterListItem[]>({
    queryKey: ["/technical/api/fleet/master-lists", "postponementReason"],
    queryFn: async () => {
      const r = await fetch("/technical/api/fleet/master-lists?listType=postponementReason");
      if (!r.ok) throw new Error(`Failed to fetch postponement reasons: ${r.status}`);
      const json = await r.json();
      return Array.isArray(json) ? json : [];
    },
  });

  const activeReasons: string[] =
    !reasonsError && masterListItems && masterListItems.length > 0
      ? masterListItems
          .filter((i) => i.isActive)
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map((i) => i.listValue)
      : [...POSTPONEMENT_REASONS];

  React.useEffect(() => {
    if (workOrder) {
      setFormData({
        workOrderId: workOrder.templateCode || workOrder.workOrderNo || "",
        component: workOrder.component || "",
        jobTitle: workOrder.jobTitle,
        originalDueDate: workOrder.dueDate || "",
        reasonForPostponement: "",
        postponementRemarks: "",
        authorizedBy: "superintendent",
        approvalRemarks: "",
        nextDueDate: "",
        durationOfPostponement: "5 Days",
        informOfficer: false,
        attachDocument: false,
      });
      setValidationError("");
    }
  }, [workOrder]);

  const calculatePostponementEndDate = (duration: string): string => {
    const today = new Date();
    let endDate = new Date(today);
    
    switch (duration) {
      case '1 Day':
        endDate.setDate(today.getDate() + 1);
        break;
      case '3 Days':
        endDate.setDate(today.getDate() + 3);
        break;
      case '5 Days':
        endDate.setDate(today.getDate() + 5);
        break;
      case '1 Week':
        endDate.setDate(today.getDate() + 7);
        break;
      case '2 Weeks':
        endDate.setDate(today.getDate() + 14);
        break;
      case '1 Month':
        endDate.setMonth(today.getMonth() + 1);
        break;
      default:
        endDate.setDate(today.getDate() + 5);
    }
    
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${String(endDate.getDate()).padStart(2, '0')}-${months[endDate.getMonth()]}-${endDate.getFullYear()}`;
  };

  const handleSubmit = () => {
    if (!formData.reasonForPostponement) {
      setValidationError("Please select a reason for postponement.");
      return;
    }
    setValidationError("");

    if (onConfirm && workOrder) {
      const postponementEndDate = calculatePostponementEndDate(formData.durationOfPostponement);
      
      onConfirm(workOrder.id || "", {
        nextDueDate: formData.nextDueDate,
        reason: formData.reasonForPostponement,
        postponementRemarks: formData.postponementRemarks,
        authorizedBy: formData.authorizedBy,
        duration: formData.durationOfPostponement,
        approvalRemarks: formData.approvalRemarks,
        attachDocument: formData.attachDocument,
        postponementEndDate: postponementEndDate
      });
    }
    onClose();
  };

  if (!workOrder) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Postpone Work Order</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto px-1">
          <div className="space-y-3 py-4">
            {/* Row 1: Work Order ID and Component */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="workOrderId" className="text-sm">Work Order ID</Label>
                <Input
                  id="workOrderId"
                  value={formData.workOrderId}
                  onChange={(e) => setFormData({ ...formData, workOrderId: e.target.value })}
                  className="bg-gray-50 h-9"
                  readOnly
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="component" className="text-sm">Component</Label>
                <Input
                  id="component"
                  value={formData.component}
                  onChange={(e) => setFormData({ ...formData, component: e.target.value })}
                  className="bg-gray-50 h-9"
                  readOnly
                />
              </div>
            </div>

            {/* Row 2: Job Title and Inform Officer */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="jobTitle" className="text-sm">Job Title</Label>
                <Input
                  id="jobTitle"
                  value={formData.jobTitle}
                  onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                  className="bg-gray-50 h-9"
                  readOnly
                />
              </div>
              <div className="flex items-end">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="informOfficer"
                    checked={formData.informOfficer}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, informOfficer: checked as boolean })
                    }
                  />
                  <Label htmlFor="informOfficer" className="text-sm">Inform Office</Label>
                </div>
              </div>
            </div>

            {/* Row 3: Original Due Date */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="originalDueDate" className="text-sm">Original Due Date</Label>
                <Input
                  id="originalDueDate"
                  value={formData.originalDueDate}
                  onChange={(e) => setFormData({ ...formData, originalDueDate: e.target.value })}
                  className="bg-gray-50 h-9"
                  readOnly
                />
              </div>
              <div></div>
            </div>

            {/* Row 4: Reason for Postponement — mandatory dropdown */}
            <div className="space-y-1">
              <Label htmlFor="reasonForPostponement" className="text-sm">
                Reason for Postponement <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.reasonForPostponement}
                onValueChange={(value) => {
                  setFormData({ ...formData, reasonForPostponement: value });
                  if (value) setValidationError("");
                }}
              >
                <SelectTrigger
                  id="reasonForPostponement"
                  data-testid="select-postponement-reason"
                  className={validationError ? "border-red-500" : ""}
                >
                  <SelectValue placeholder="Select a reason for postponement..." />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {reasonsLoading ? (
                    <div className="flex items-center justify-center py-3 text-sm text-muted-foreground">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading reasons...
                    </div>
                  ) : (
                    activeReasons.map((reason) => (
                      <SelectItem key={reason} value={reason}>
                        {reason}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {validationError && (
                <p className="text-sm text-red-500" data-testid="postponement-reason-error">{validationError}</p>
              )}
            </div>

            {/* Row 4b: Remarks / Additional Details — optional */}
            <div className="space-y-1">
              <Label htmlFor="postponementRemarks" className="text-sm">Remarks / Additional Details (Optional)</Label>
              <Textarea
                id="postponementRemarks"
                data-testid="textarea-postponement-remarks"
                value={formData.postponementRemarks}
                onChange={(e) => setFormData({ ...formData, postponementRemarks: e.target.value })}
                className="min-h-[60px] resize-none"
                placeholder="Enter additional remarks or details..."
              />
            </div>

            {/* Row 5: Authorized By */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="authorizedBy" className="text-sm">Authorized By</Label>
                <Select 
                  value={formData.authorizedBy} 
                  onValueChange={(value) => setFormData({ ...formData, authorizedBy: value })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select authorizer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="superintendent">Superintendent</SelectItem>
                    <SelectItem value="technical-manager">Technical Manager</SelectItem>
                    <SelectItem value="dpa">DPA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div></div>
            </div>

            {/* Row 6: Approval Remarks */}
            <div className="space-y-1">
              <Label htmlFor="approvalRemarks" className="text-sm">Approval Remarks (Optional)</Label>
              <Textarea
                id="approvalRemarks"
                value={formData.approvalRemarks}
                onChange={(e) => setFormData({ ...formData, approvalRemarks: e.target.value })}
                className="min-h-[50px] resize-none"
                placeholder="Enter approval remarks..."
              />
            </div>

            {/* Row 7: Next Due Date and Duration */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="nextDueDate" className="text-sm">Next Due Date</Label>
                <Input
                  id="nextDueDate"
                  type="date"
                  value={formData.nextDueDate}
                  onChange={(e) => setFormData({ ...formData, nextDueDate: e.target.value })}
                  placeholder="dd-mm-yyyy"
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="durationOfPostponement" className="text-sm">Duration of Postponement</Label>
                <Select 
                  value={formData.durationOfPostponement} 
                  onValueChange={(value) => setFormData({ ...formData, durationOfPostponement: value })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1 Day">1 Day</SelectItem>
                    <SelectItem value="3 Days">3 Days</SelectItem>
                    <SelectItem value="5 Days">5 Days</SelectItem>
                    <SelectItem value="1 Week">1 Week</SelectItem>
                    <SelectItem value="2 Weeks">2 Weeks</SelectItem>
                    <SelectItem value="1 Month">1 Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 8: Attach Document */}
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="attachDocument"
                  checked={formData.attachDocument}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, attachDocument: checked as boolean })
                  }
                />
                <Label htmlFor="attachDocument" className="text-sm">Attach Document (Optional)</Label>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t flex-shrink-0">
          <Button
            variant="outline"
            onClick={onClose}
            data-testid="button-postpone-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-[#52baf3] hover:bg-[#4aa3d9] text-white"
            data-testid="button-postpone-confirm"
          >
            Confirm Postpone
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PostponeWorkOrderDialog;
