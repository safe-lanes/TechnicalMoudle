import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getBulkApproveUrl, getBulkRejectUrl, getWorkOrdersListQueryKey } from "@/modules/components/api/workOrdersApiV2";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle,
  XCircle,
  Search,
  Eye,
  CheckSquare,
  Square,
  Loader2
} from "lucide-react";
import { WorkOrder } from "@shared/schema";

interface BulkApproveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workOrders: WorkOrder[];
  vesselId: string;
  vesselName?: string;
}

export function BulkApproveModal({
  open,
  onOpenChange,
  workOrders,
  vesselId,
  vesselName
}: BulkApproveModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [rejectionComments, setRejectionComments] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const pendingApprovalWOs = useMemo(() => {
    return workOrders.filter(wo => 
      (wo as any).computedStatus === 'Pending Approval' || wo.status === 'Pending Approval'
    );
  }, [workOrders]);

  const filteredWOs = useMemo(() => {
    if (!searchTerm.trim()) return pendingApprovalWOs;
    
    const term = searchTerm.toLowerCase();
    return pendingApprovalWOs.filter(wo => 
      wo.workOrderNo?.toLowerCase().includes(term) ||
      wo.jobTitle?.toLowerCase().includes(term) ||
      wo.component?.toLowerCase().includes(term) ||
      wo.assignedTo?.toLowerCase().includes(term)
    );
  }, [pendingApprovalWOs, searchTerm]);

  const bulkApproveMutation = useMutation({
    mutationFn: async (workOrderIds: string[]) => {
      const response = await apiRequest('POST', getBulkApproveUrl(), {
        workOrderIds,
        approver: "Head of Dept"
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Bulk Approval Complete",
        description: `${data.results.success.length} work orders approved successfully.`
      });
      queryClient.invalidateQueries({ queryKey: getWorkOrdersListQueryKey(vesselId) });
      setSelectedIds(new Set());
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to bulk approve work orders",
        variant: "destructive"
      });
    }
  });

  const bulkRejectMutation = useMutation({
    mutationFn: async (workOrderIds: string[]) => {
      const response = await apiRequest('POST', getBulkRejectUrl(), {
        workOrderIds,
        approver: "Head of Dept",
        rejectionComments
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Bulk Rejection Complete",
        description: `${data.results.success.length} work orders rejected and sent back to Due.`
      });
      queryClient.invalidateQueries({ queryKey: getWorkOrdersListQueryKey(vesselId) });
      setSelectedIds(new Set());
      setRejectionComments("");
      setShowRejectInput(false);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to bulk reject work orders",
        variant: "destructive"
      });
    }
  });

  const handleSelectAll = () => {
    if (selectedIds.size === filteredWOs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredWOs.map(wo => wo.id)));
    }
  };

  const handleToggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkApprove = () => {
    if (selectedIds.size === 0) {
      toast({
        title: "No Selection",
        description: "Please select at least one work order to approve",
        variant: "destructive"
      });
      return;
    }
    bulkApproveMutation.mutate(Array.from(selectedIds));
  };

  const handleBulkReject = () => {
    if (selectedIds.size === 0) {
      toast({
        title: "No Selection",
        description: "Please select at least one work order to reject",
        variant: "destructive"
      });
      return;
    }
    if (!rejectionComments.trim()) {
      toast({
        title: "Comments Required",
        description: "Please provide rejection comments",
        variant: "destructive"
      });
      return;
    }
    bulkRejectMutation.mutate(Array.from(selectedIds));
  };

  const handleViewWorkOrder = (workOrderId: string) => {
    setLocation(`/pms/work-order/${workOrderId}`);
    onOpenChange(false);
  };

  const isAllSelected = filteredWOs.length > 0 && selectedIds.size === filteredWOs.length;
  const isLoading = bulkApproveMutation.isPending || bulkRejectMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Bulk Approve Work Orders
            {vesselName && (
              <Badge variant="outline" className="ml-2">{vesselName}</Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Select work orders to approve or reject. {pendingApprovalWOs.length} work orders pending approval.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4 py-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by WO number, job title, component..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              data-testid="input-search-bulk-approve"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
            className="flex items-center gap-2"
            data-testid="button-select-all"
          >
            {isAllSelected ? (
              <>
                <CheckSquare className="h-4 w-4" />
                Deselect All
              </>
            ) : (
              <>
                <Square className="h-4 w-4" />
                Select All ({filteredWOs.length})
              </>
            )}
          </Button>
        </div>

        <ScrollArea className="flex-1 border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>WO Number</TableHead>
                <TableHead>Job Title</TableHead>
                <TableHead>Component</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Submitted Date</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredWOs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    No work orders pending approval
                  </TableCell>
                </TableRow>
              ) : (
                filteredWOs.map((wo) => (
                  <TableRow 
                    key={wo.id} 
                    className={`${selectedIds.has(wo.id) ? 'bg-blue-50' : ''} ${wo.wasRejected ? 'text-red-600' : ''}`}
                    data-testid={`row-pending-wo-${wo.id}`}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(wo.id)}
                        onCheckedChange={() => handleToggleSelect(wo.id)}
                        data-testid={`checkbox-wo-${wo.id}`}
                      />
                    </TableCell>
                    <TableCell className={`font-medium ${wo.wasRejected ? 'text-red-600' : ''}`}>
                      {wo.workOrderNo}
                      {wo.wasRejected && (
                        <Badge variant="destructive" className="ml-2 text-xs">Resubmitted</Badge>
                      )}
                    </TableCell>
                    <TableCell className={wo.wasRejected ? 'text-red-600' : ''}>
                      {wo.jobTitle}
                    </TableCell>
                    <TableCell className={wo.wasRejected ? 'text-red-600' : ''}>
                      {wo.component}
                    </TableCell>
                    <TableCell className={wo.wasRejected ? 'text-red-600' : ''}>
                      {wo.assignedTo}
                    </TableCell>
                    <TableCell className={wo.wasRejected ? 'text-red-600' : ''}>
                      {wo.submittedDate ? new Date(wo.submittedDate).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleViewWorkOrder(wo.id)}
                        data-testid={`button-view-wo-${wo.id}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>

        {showRejectInput && (
          <div className="border rounded-md p-3 bg-red-50">
            <label className="text-sm font-medium text-red-700 mb-2 block">
              Rejection Comments (required)
            </label>
            <Textarea
              value={rejectionComments}
              onChange={(e) => setRejectionComments(e.target.value)}
              placeholder="Enter reason for rejection..."
              className="bg-white"
              data-testid="textarea-rejection-comments"
            />
          </div>
        )}

        <DialogFooter className="flex items-center justify-between gap-2">
          <div className="text-sm text-gray-500">
            {selectedIds.size} of {filteredWOs.length} selected
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            {!showRejectInput ? (
              <>
                <Button
                  variant="destructive"
                  onClick={() => setShowRejectInput(true)}
                  disabled={selectedIds.size === 0 || isLoading}
                  data-testid="button-show-reject"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject Selected
                </Button>
                <Button
                  onClick={handleBulkApprove}
                  disabled={selectedIds.size === 0 || isLoading}
                  className="bg-green-600 hover:bg-green-700"
                  data-testid="button-bulk-approve"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Approve Selected ({selectedIds.size})
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowRejectInput(false);
                    setRejectionComments("");
                  }}
                  disabled={isLoading}
                >
                  Back
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleBulkReject}
                  disabled={selectedIds.size === 0 || !rejectionComments.trim() || isLoading}
                  data-testid="button-bulk-reject"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4 mr-2" />
                  )}
                  Confirm Rejection ({selectedIds.size})
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default BulkApproveModal;
