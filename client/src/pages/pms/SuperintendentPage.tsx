import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ExternalLink, Check, ArrowLeft, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLocation } from "wouter";
import type { ColDef, SelectionChangedEvent } from "ag-grid-community";
import WOAgGridTable from "@/components/WOAgGridTable";
import { effectiveApprovalTier, useApprovalPolicy } from "@/hooks/useApprovalPolicy";

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
    " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function getTierBadge(tier: string | null | undefined, approver?: string | null) {
  const approverLabel = approver || 'HOD';
  switch (tier) {
    case "superintendent_locked":
      return <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800" data-testid="badge-tier-locked">🔒 Locked</span>;
    case "superintendent_notification":
      return <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800" data-testid="badge-tier-notified">Supt. Notified</span>;
    case "ce_with_justification":
      return <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800" data-testid="badge-tier-ce-remarks">{approverLabel} + Remarks</span>;
    case "standard":
      return <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800" data-testid="badge-tier-standard">Standard</span>;
    default:
      return <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">—</span>;
  }
}

export default function SuperintendentPage() {
  const [, setLocation] = useLocation();
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; notification: any | null }>({ open: false, notification: null });
  const [selectedRows, setSelectedRows] = useState<any[]>([]);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const { isSuperintendentLockEnabled } = useApprovalPolicy();
  const getEffectiveTier = useCallback(
    (notification: any) => effectiveApprovalTier(
      notification?.approvalTier,
      isSuperintendentLockEnabled(notification?.vesselId),
    ),
    [isSuperintendentLockEnabled],
  );

  const { data: allNotifications = [], isLoading } = useQuery<any[]>({
    queryKey: ["/technical/api/superintendent/notifications/all"],
  });

  const invalidateNotifications = () => {
    queryClient.invalidateQueries({ queryKey: ["/technical/api/superintendent/notifications/all"] });
    queryClient.invalidateQueries({ queryKey: ["/technical/api/superintendent/notifications"] });
    queryClient.invalidateQueries({ queryKey: ["/technical/api/superintendent/notifications/summary"] });
    queryClient.invalidateQueries({ queryKey: ["/technical/api/work-orders"] });
  };

  const acknowledgeMutation = useMutation({
    mutationFn: async (workOrderId: string) => {
      const res = await apiRequest("POST", `/technical/api/work-orders/${workOrderId}/superintendent-acknowledge`);
      return res.json();
    },
    onSuccess: () => {
      invalidateNotifications();
      setConfirmDialog({ open: false, notification: null });
    },
  });

  const bulkAcknowledgeMutation = useMutation({
    mutationFn: async (workOrderIds: string[]) => {
      const res = await apiRequest("POST", "/technical/api/work-orders/bulk-superintendent-acknowledge", { workOrderIds });
      return res.json();
    },
    onSuccess: () => {
      invalidateNotifications();
      setSelectedRows([]);
      setBulkConfirmOpen(false);
    },
  });

  const pendingCount = allNotifications.filter((n: any) => !n.isAcknowledged).length;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const acknowledgedThisMonth = allNotifications.filter(
    (n: any) => n.isAcknowledged && n.acknowledgedAt && new Date(n.acknowledgedAt) >= startOfMonth
  ).length;

  const isRowSelectable = useCallback((params: any) => {
    const n = params.data;
    return !!(n && getEffectiveTier(n) === 'superintendent_locked' && !n.isAcknowledged);
  }, [getEffectiveTier]);

  const onSelectionChanged = useCallback((event: SelectionChangedEvent) => {
    setSelectedRows(event.api.getSelectedRows());
  }, []);

  const eligibleSelected = selectedRows.filter(
    (n) => getEffectiveTier(n) === 'superintendent_locked' && !n.isAcknowledged
  );

  const columnDefs: ColDef[] = useMemo(() => [
    {
      headerName: "",
      field: "__select__",
      headerCheckboxSelection: true,
      checkboxSelection: true,
      maxWidth: 50,
      minWidth: 50,
      lockPosition: true,
      suppressMovable: true,
      filter: false as any,
      sortable: false,
      resizable: false,
      cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
    } as ColDef,
    {
      headerName: "Work Order Code",
      field: "workOrderCode",
      minWidth: 200,
      flex: 1.2,
      filter: "agTextColumnFilter",
      cellRenderer: (params: any) => {
        const n = params.data;
        if (!n) return null;
        return (
          <button
            className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
            onClick={() => setLocation(`/pms/work-order/${n.workOrderId}`)}
            data-testid={`link-wo-${n.id}`}
          >
            {n.workOrderCode || n.workOrderId}
            <ExternalLink className="h-3 w-3" />
          </button>
        );
      },
    },
    {
      headerName: "Vessel",
      field: "vesselName",
      minWidth: 140,
      flex: 0.9,
      filter: "agTextColumnFilter",
      valueGetter: (p: any) => p.data?.vesselName || "—",
      tooltipValueGetter: (p: any) => p.data?.vesselName || "",
      cellRenderer: (params: any) => {
        const n = params.data;
        if (!n) return null;
        return (
          <span className="text-gray-800" data-testid={`text-vessel-${n.id}`}>
            {n.vesselName || "—"}
          </span>
        );
      },
    },
    {
      headerName: "Job Title",
      field: "jobTitle",
      minWidth: 200,
      flex: 1.5,
      filter: "agTextColumnFilter",
      valueGetter: (p: any) => p.data?.jobTitle || "—",
      tooltipValueGetter: (p: any) => p.data?.jobTitle || "",
    },
    {
      headerName: "Component",
      field: "componentName",
      minWidth: 160,
      flex: 1,
      filter: "agTextColumnFilter",
      valueGetter: (p: any) => p.data?.componentName || "—",
    },
    {
      headerName: "Days Late",
      field: "daysLate",
      minWidth: 110,
      flex: 0.6,
      filter: "agNumberColumnFilter",
      cellStyle: { justifyContent: "center" },
      headerClass: "ag-header-center",
      cellRenderer: (params: any) => {
        const n = params.data;
        if (!n) return null;
        const v = n.daysLate || 0;
        const cls = v > 14 ? "text-red-600 font-bold" : v >= 7 ? "text-orange-600 font-medium" : "text-gray-900";
        return <span className={cls} data-testid={`text-days-late-${n.id}`}>{v}</span>;
      },
    },
    {
      headerName: "Missed Cycles",
      field: "missedCycles",
      minWidth: 130,
      flex: 0.7,
      filter: "agNumberColumnFilter",
      cellStyle: { justifyContent: "center" },
      headerClass: "ag-header-center",
      cellRenderer: (params: any) => {
        const n = params.data;
        if (!n) return null;
        const v = n.missedCycles || 0;
        if (v >= 1) {
          return (
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-500 text-white" data-testid={`badge-missed-cycles-${n.id}`}>
              {v}
            </span>
          );
        }
        return <span className="text-gray-500">0</span>;
      },
    },
    {
      headerName: "Tier",
      field: "approvalTier",
      minWidth: 140,
      flex: 0.8,
      filter: "agSetColumnFilter",
      cellStyle: { justifyContent: "center" },
      headerClass: "ag-header-center",
      cellRenderer: (params: any) => getTierBadge(getEffectiveTier(params.data), params.data?.approver),
    },
    {
      headerName: "Notified At",
      field: "createdAt",
      minWidth: 160,
      flex: 1,
      filter: "agDateColumnFilter",
      valueFormatter: (p: any) => formatDate(p.value),
      cellRenderer: (params: any) => <span className="text-gray-700">{formatDate(params.value)}</span>,
    },
    {
      headerName: "Status",
      field: "isAcknowledged",
      minWidth: 200,
      flex: 1.2,
      filter: "agSetColumnFilter",
      valueGetter: (p: any) => (p.data?.isAcknowledged ? "Acknowledged" : "Awaiting Acknowledgment"),
      cellStyle: { justifyContent: "center" },
      headerClass: "ag-header-center",
      cellRenderer: (params: any) => {
        const n = params.data;
        if (!n) return null;
        if (n.isAcknowledged) {
          return (
            <span className="text-green-600 text-xs font-medium" data-testid={`status-acknowledged-${n.id}`}>
              Acknowledged ({formatDate(n.acknowledgedAt)})
            </span>
          );
        }
        const requiresAcknowledgment = getEffectiveTier(n) === 'superintendent_locked';
        return (
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700" data-testid={`status-awaiting-${n.id}`}>
            {requiresAcknowledgment ? 'Awaiting Acknowledgment' : 'Notification Sent'}
          </span>
        );
      },
    },
    {
      headerName: "Action",
      field: "action",
      minWidth: 150,
      flex: 0.8,
      filter: "agSetColumnFilter",
      valueGetter: (p: any) => {
        const n = p.data;
        if (!n) return "";
        if (n.isAcknowledged) return "Acknowledged";
        if (getEffectiveTier(n) === "superintendent_locked") return "Acknowledge";
        return "Info Only";
      },
      cellStyle: { justifyContent: "center" },
      headerClass: "ag-header-center",
      cellRenderer: (params: any) => {
        const n = params.data;
        if (!n) return null;
        if (n.isAcknowledged) {
          return (
            <Button variant="outline" size="sm" disabled className="text-xs" data-testid={`button-acknowledged-${n.id}`}>
              <Check className="h-3 w-3 mr-1" />
              Acknowledged
            </Button>
          );
        }
        if (getEffectiveTier(n) === 'superintendent_locked') {
          return (
            <Button
              size="sm"
              className="text-xs bg-blue-600 hover:bg-blue-700"
              onClick={() => setConfirmDialog({ open: true, notification: n })}
              disabled={acknowledgeMutation.isPending}
              data-testid={`button-acknowledge-${n.id}`}
            >
              Acknowledge
            </Button>
          );
        }
        return (
          <span className="text-xs text-gray-500 italic" data-testid={`status-info-only-${n.id}`}>
            Info Only
          </span>
        );
      },
    },
  ], [acknowledgeMutation.isPending, getEffectiveTier, setLocation]);

  return (
    <div className="space-y-6" data-testid="superintendent-page">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => setLocation("/pms/dashboard")} data-testid="button-back-dashboard">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900" data-testid="text-page-title">Superintendent Notifications</h1>
          <p className="text-sm text-gray-500 mt-1" data-testid="text-page-subtitle">Work orders requiring shore-side acknowledgment before the Head of Department can approve</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4" data-testid="card-pending-count">
          <div className="text-sm text-red-600 font-medium">Total Pending Acknowledgment</div>
          <div className="text-3xl font-bold text-red-700 mt-1">{pendingCount}</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4" data-testid="card-acknowledged-count">
          <div className="text-sm text-green-600 font-medium">Acknowledged This Month</div>
          <div className="text-3xl font-bold text-green-700 mt-1">{acknowledgedThisMonth}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50">
          <span className="text-sm text-gray-500">
            {eligibleSelected.length > 0
              ? `${eligibleSelected.length} WO${eligibleSelected.length !== 1 ? 's' : ''} selected`
              : "Select locked WOs using checkboxes to bulk acknowledge"}
          </span>
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white"
            disabled={eligibleSelected.length === 0 || bulkAcknowledgeMutation.isPending}
            onClick={() => setBulkConfirmOpen(true)}
            data-testid="button-bulk-acknowledge"
          >
            <CheckSquare className="h-4 w-4 mr-1.5" />
            {eligibleSelected.length > 0
              ? `Bulk Acknowledge (${eligibleSelected.length})`
              : "Bulk Acknowledge"}
          </Button>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading notifications...</div>
        ) : (
          <div style={{ height: 'calc(100vh - 360px)', minHeight: '400px' }} data-testid="table-notifications">
            <WOAgGridTable
              columnDefs={columnDefs}
              rowData={allNotifications}
              height="100%"
              suppressRowClickSelection
              rowSelection="multiple"
              onSelectionChanged={onSelectionChanged}
              isRowSelectable={isRowSelectable}
              noRowsMessage="No superintendent notifications found."
              testId="ag-grid-superintendent-notifications"
              getRowClass={(params) => params.data?.id ? `row-notification-${params.data.id}` : undefined}
            />
          </div>
        )}
      </div>

      {/* Single acknowledge confirm dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => { if (!open) setConfirmDialog({ open: false, notification: null }); }}>
        <DialogContent data-testid="dialog-confirm-acknowledge">
          <DialogHeader>
            <DialogTitle>Confirm Acknowledgment</DialogTitle>
            <DialogDescription>
              {confirmDialog.notification && (
                <>
                  Are you sure you want to acknowledge WO <strong>{confirmDialog.notification.workOrderCode}</strong>?
                  This will allow the {confirmDialog.notification.approver || 'Head of Department'} to proceed with approval.
                  The WO had <strong>{confirmDialog.notification.missedCycles || 0}</strong> missed cycle(s)
                  and was <strong>{confirmDialog.notification.daysLate || 0}</strong> day(s) late.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog({ open: false, notification: null })} data-testid="button-cancel-acknowledge">
              Cancel
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                if (confirmDialog.notification) {
                  acknowledgeMutation.mutate(confirmDialog.notification.workOrderId);
                }
              }}
              disabled={acknowledgeMutation.isPending}
              data-testid="button-confirm-acknowledge"
            >
              {acknowledgeMutation.isPending ? "Acknowledging..." : "Confirm Acknowledge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk acknowledge confirm dialog */}
      <Dialog open={bulkConfirmOpen} onOpenChange={(open) => { if (!open) setBulkConfirmOpen(false); }}>
        <DialogContent data-testid="dialog-bulk-acknowledge">
          <DialogHeader>
            <DialogTitle>Bulk Acknowledge Work Orders</DialogTitle>
            <DialogDescription>
              You are about to acknowledge <strong>{eligibleSelected.length}</strong> locked work order{eligibleSelected.length !== 1 ? 's' : ''}.
              This will allow the respective Head of Department to proceed with approval for each WO.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkConfirmOpen(false)} data-testid="button-cancel-bulk-acknowledge">
              Cancel
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                const ids = eligibleSelected.map((n) => n.workOrderId);
                bulkAcknowledgeMutation.mutate(ids);
              }}
              disabled={bulkAcknowledgeMutation.isPending}
              data-testid="button-confirm-bulk-acknowledge"
            >
              {bulkAcknowledgeMutation.isPending ? "Acknowledging..." : `Acknowledge ${eligibleSelected.length} WO${eligibleSelected.length !== 1 ? 's' : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
