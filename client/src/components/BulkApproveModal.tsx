import { useState, useMemo, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import WOAgGridTable from "@/components/WOAgGridTable";
import type { ColDef, SelectionChangedEvent } from "ag-grid-community";
import {
  CheckCircle,
  XCircle,
  Search,
  Eye,
  Loader2,
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
  vesselName,
}: BulkApproveModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [rejectionComments, setRejectionComments] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const pendingApprovalWOs = useMemo(() => {
    return workOrders.filter(
      (wo) =>
        (wo as any).computedStatus === "Pending Approval" ||
        wo.status === "Pending Approval",
    );
  }, [workOrders]);

  const filteredWOs = useMemo(() => {
    if (!searchTerm.trim()) return pendingApprovalWOs;

    const term = searchTerm.toLowerCase();
    return pendingApprovalWOs.filter(
      (wo) =>
        wo.workOrderNo?.toLowerCase().includes(term) ||
        wo.jobTitle?.toLowerCase().includes(term) ||
        wo.component?.toLowerCase().includes(term) ||
        wo.assignedTo?.toLowerCase().includes(term),
    );
  }, [pendingApprovalWOs, searchTerm]);

  const bulkApproveMutation = useMutation({
    mutationFn: async (workOrderIds: string[]) => {
      const response = await apiRequest(
        "POST",
        "/technical/api/work-orders/bulk-approve",
        {
          workOrderIds,
          approver: "Head of Dept",
        },
      );
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Bulk Approval Complete",
        description: `${data.results.success.length} work orders approved successfully.`,
      });
      queryClient.invalidateQueries({
        queryKey: ["/technical/api/work-orders", vesselId],
      });
      setSelectedIds(new Set());
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to bulk approve work orders",
        variant: "destructive",
      });
    },
  });

  const bulkRejectMutation = useMutation({
    mutationFn: async (workOrderIds: string[]) => {
      const response = await apiRequest(
        "POST",
        "/technical/api/work-orders/bulk-reject",
        {
          workOrderIds,
          approver: "Head of Dept",
          rejectionComments,
        },
      );
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Bulk Rejection Complete",
        description: `${data.results.success.length} work orders rejected and sent back to Due.`,
      });
      queryClient.invalidateQueries({
        queryKey: ["/technical/api/work-orders", vesselId],
      });
      setSelectedIds(new Set());
      setRejectionComments("");
      setShowRejectInput(false);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to bulk reject work orders",
        variant: "destructive",
      });
    },
  });

  const handleBulkApprove = () => {
    if (selectedIds.size === 0) {
      toast({
        title: "No Selection",
        description: "Please select at least one work order to approve",
        variant: "destructive",
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
        variant: "destructive",
      });
      return;
    }
    if (!rejectionComments.trim()) {
      toast({
        title: "Comments Required",
        description: "Please provide rejection comments",
        variant: "destructive",
      });
      return;
    }
    bulkRejectMutation.mutate(Array.from(selectedIds));
  };

  const handleViewWorkOrder = useCallback(
    (workOrderId: string) => {
      setLocation(`/pms/work-order/${workOrderId}`);
      onOpenChange(false);
    },
    [setLocation, onOpenChange],
  );

  const onSelectionChanged = useCallback((event: SelectionChangedEvent) => {
    const ids = event.api.getSelectedRows().map((r: any) => r.id);
    setSelectedIds(new Set(ids));
  }, []);

  const getRowId = useCallback((params: any) => String(params.data.id), []);

  const isLoading =
    bulkApproveMutation.isPending || bulkRejectMutation.isPending;

  const columnDefs: ColDef[] = useMemo(
    () => [
      {
        headerName: "",
        field: "__select",
        width: 48,
        minWidth: 48,
        maxWidth: 48,
        checkboxSelection: true,
        headerCheckboxSelection: true,
        headerCheckboxSelectionFilteredOnly: true,
        sortable: false,
        filter: false,
        resizable: false,
        pinned: "left",
      },
      {
        headerName: "WO Number",
        field: "workOrderNo",
        minWidth: 170,
        flex: 1,
        cellRenderer: (params: any) => {
          const wo = params.data;
          return (
            <span className="flex items-center gap-2">
              <span className="font-medium text-blue-600">
                {params.value || "—"}
              </span>
              {wo?.wasRejected && (
                <Badge variant="destructive" className="text-[10px]">
                  Resubmitted
                </Badge>
              )}
            </span>
          );
        },
      },
      {
        headerName: "Job Title",
        field: "jobTitle",
        minWidth: 220,
        flex: 2,
        tooltipValueGetter: (p: any) => p.data?.jobTitle || "",
        valueFormatter: (p: any) => p.value || "—",
      },
      {
        headerName: "Component",
        field: "component",
        minWidth: 180,
        flex: 1.5,
        tooltipValueGetter: (p: any) => p.data?.component || "",
        valueFormatter: (p: any) => p.value || "—",
      },
      {
        headerName: "Assigned To",
        field: "assignedTo",
        minWidth: 140,
        flex: 1,
        valueGetter: (p: any) =>
          p.data?.assignedTo || p.data?.assignedRank || "",
        valueFormatter: (p: any) => p.value || "—",
      },
      {
        headerName: "Submitted Date",
        field: "submittedDate",
        minWidth: 140,
        flex: 1,
        valueFormatter: (p: any) =>
          p.value ? new Date(p.value).toLocaleDateString() : "—",
      },
      {
        headerName: "",
        field: "id",
        width: 64,
        minWidth: 64,
        maxWidth: 64,
        sortable: false,
        filter: false,
        resizable: false,
        cellRenderer: (params: any) => {
          const wo = params.data;
          if (!wo) return null;
          return (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                handleViewWorkOrder(wo.id);
              }}
              data-testid={`button-view-wo-${wo.id}`}
            >
              <Eye className="h-4 w-4" />
            </Button>
          );
        },
      },
    ],
    [handleViewWorkOrder],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex flex-col p-0 gap-0 sm:max-w-[95vw] w-[95vw] h-[90vh] max-h-[90vh]"
        data-testid="dialog-bulk-approve"
      >
        <DialogHeader className="px-6 pt-6 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2">
            Bulk Approve Work Orders
            {vesselName && (
              <Badge variant="outline" className="ml-2">
                {vesselName}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Select work orders to approve or reject.{" "}
            {pendingApprovalWOs.length} work orders pending approval.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4 px-6 py-3 border-b">
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
          <div className="text-sm text-gray-500 whitespace-nowrap">
            {selectedIds.size} of {filteredWOs.length} selected
          </div>
        </div>

        <div className="flex-1 min-h-0 px-6 py-3">
          <WOAgGridTable
            columnDefs={columnDefs}
            rowData={filteredWOs}
            height="100%"
            rowHeight={44}
            headerHeight={44}
            noRowsMessage="No work orders pending approval"
            testId="ag-grid-bulk-approve"
            rowSelection="multiple"
            onSelectionChanged={onSelectionChanged}
            getRowId={getRowId}
            suppressRowClickSelection={true}
            getRowClass={(params) =>
              params.data?.wasRejected ? "row-resubmitted" : undefined
            }
            getRowStyle={(params) =>
              params.data?.wasRejected ? { background: "#FFF5F5" } : undefined
            }
          />
        </div>

        {showRejectInput && (
          <div className="mx-6 mb-3 border rounded-md p-3 bg-red-50">
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

        <DialogFooter className="flex items-center justify-between gap-2 px-6 py-4 border-t">
          <div className="flex gap-2 ml-auto">
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
                  disabled={
                    selectedIds.size === 0 ||
                    !rejectionComments.trim() ||
                    isLoading
                  }
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
