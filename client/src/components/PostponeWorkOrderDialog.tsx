import React, { useState } from "react";
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

interface PostponeWorkOrderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  workOrder: {
    id?: string | null;
    wouuid?: string | null;
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
    authorizedBy: "",
    approvalRemarks: "",
    nextDueDate: "",
    durationOfPostponement: "5 Days",
    informOfficer: false,
    attachDocument: false,
  });

  React.useEffect(() => {
    if (workOrder) {
      setFormData({
        workOrderId: workOrder.templateCode || workOrder.workOrderNo || "",
        component: workOrder.component || "",
        jobTitle: workOrder.jobTitle,
        originalDueDate: workOrder.dueDate || "",
        reasonForPostponement: "",
        authorizedBy: "Chief Engineer",
        approvalRemarks: "",
        nextDueDate: "",
        durationOfPostponement: "5 Days",
        informOfficer: false,
        attachDocument: false,
      });
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
    if (onConfirm && workOrder) {
      const postponementEndDate = calculatePostponementEndDate(formData.durationOfPostponement);
      
      onConfirm(workOrder.wouuid || "", {
        nextDueDate: formData.nextDueDate,
        reason: formData.reasonForPostponement,
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

            {/* Row 4: Reason for Postponement */}
            <div className="space-y-1">
              <Label htmlFor="reasonForPostponement" className="text-sm">Reason for Postponement</Label>
              <Textarea
                id="reasonForPostponement"
                value={formData.reasonForPostponement}
                onChange={(e) => setFormData({ ...formData, reasonForPostponement: e.target.value })}
                className="min-h-[60px] resize-none"
                placeholder="Enter reason for postponement..."
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
                    <SelectItem value="chief-engineer">Chief Engineer</SelectItem>
                    <SelectItem value="2nd-engineer">2nd Engineer</SelectItem>
                    <SelectItem value="3rd-engineer">3rd Engineer</SelectItem>
                    <SelectItem value="captain">Captain</SelectItem>
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
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-[#52baf3] hover:bg-[#4aa3d9] text-white"
          >
            Confirm Postpone
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PostponeWorkOrderDialog;