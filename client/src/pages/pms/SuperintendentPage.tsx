import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Shield, ExternalLink, Check } from "lucide-react";
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

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
    " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function getTierBadge(tier: string | null | undefined) {
  switch (tier) {
    case "superintendent_locked":
      return <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800" data-testid="badge-tier-locked">🔒 Locked</span>;
    case "superintendent_notification":
      return <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800" data-testid="badge-tier-notified">Supt. Notified</span>;
    case "ce_with_justification":
      return <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800" data-testid="badge-tier-ce-remarks">CE + Remarks</span>;
    case "standard":
      return <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800" data-testid="badge-tier-standard">Standard</span>;
    default:
      return <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">—</span>;
  }
}

export default function SuperintendentPage() {
  const [, setLocation] = useLocation();
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; notification: any | null }>({ open: false, notification: null });

  const { data: allNotifications = [], isLoading } = useQuery<any[]>({
    queryKey: ["/technical/api/superintendent/notifications/all"],
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async (workOrderId: string) => {
      const res = await apiRequest("POST", `/technical/api/work-orders/${workOrderId}/superintendent-acknowledge`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/technical/api/superintendent/notifications/all"] });
      queryClient.invalidateQueries({ queryKey: ["/technical/api/superintendent/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/technical/api/superintendent/notifications/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/technical/api/work-orders"] });
      setConfirmDialog({ open: false, notification: null });
    },
  });

  const pendingCount = allNotifications.filter((n: any) => !n.isAcknowledged).length;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const acknowledgedThisMonth = allNotifications.filter(
    (n: any) => n.isAcknowledged && n.acknowledgedAt && new Date(n.acknowledgedAt) >= startOfMonth
  ).length;

  return (
    <div className="space-y-6" data-testid="superintendent-page">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900" data-testid="text-page-title">Superintendent Notifications</h1>
        <p className="text-sm text-gray-500 mt-1" data-testid="text-page-subtitle">Work orders requiring shore-side acknowledgment before CE can approve</p>
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
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading notifications...</div>
        ) : allNotifications.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No superintendent notifications found.</div>
        ) : (
          <table className="w-full text-sm" data-testid="table-notifications">
            <thead className="bg-[#52baf3] text-white">
              <tr>
                <th className="text-left py-3 px-4 font-medium">Work Order Code</th>
                <th className="text-left py-3 px-4 font-medium">Job Title</th>
                <th className="text-left py-3 px-4 font-medium">Component</th>
                <th className="text-center py-3 px-4 font-medium">Days Late</th>
                <th className="text-center py-3 px-4 font-medium">Missed Cycles</th>
                <th className="text-center py-3 px-4 font-medium">Tier</th>
                <th className="text-left py-3 px-4 font-medium">Notified At</th>
                <th className="text-center py-3 px-4 font-medium">Status</th>
                <th className="text-center py-3 px-4 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {allNotifications.map((notification: any, idx: number) => (
                <tr
                  key={notification.id}
                  className={idx % 2 === 0 ? "bg-gray-50" : "bg-white"}
                  data-testid={`row-notification-${notification.id}`}
                >
                  <td className="py-3 px-4">
                    <button
                      className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                      onClick={() => setLocation(`/pms/work-order/${notification.workOrderId}`)}
                      data-testid={`link-wo-${notification.id}`}
                    >
                      {notification.workOrderCode || notification.workOrderId}
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  </td>
                  <td className="py-3 px-4 text-gray-900">{notification.jobTitle || "—"}</td>
                  <td className="py-3 px-4 text-gray-900">{notification.componentName || "—"}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={
                      (notification.daysLate || 0) > 14 ? "text-red-600 font-bold" :
                      (notification.daysLate || 0) >= 7 ? "text-orange-600 font-medium" :
                      "text-gray-900"
                    } data-testid={`text-days-late-${notification.id}`}>
                      {notification.daysLate || 0}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {(notification.missedCycles || 0) >= 1 ? (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-500 text-white" data-testid={`badge-missed-cycles-${notification.id}`}>
                        {notification.missedCycles}
                      </span>
                    ) : (
                      <span className="text-gray-500">0</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">{getTierBadge(notification.approvalTier)}</td>
                  <td className="py-3 px-4 text-gray-700">{formatDate(notification.createdAt)}</td>
                  <td className="py-3 px-4 text-center">
                    {notification.isAcknowledged ? (
                      <span className="text-green-600 text-xs font-medium" data-testid={`status-acknowledged-${notification.id}`}>
                        Acknowledged ({formatDate(notification.acknowledgedAt)})
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700" data-testid={`status-awaiting-${notification.id}`}>
                        Awaiting Acknowledgment
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {notification.isAcknowledged ? (
                      <Button variant="outline" size="sm" disabled className="text-xs" data-testid={`button-acknowledged-${notification.id}`}>
                        <Check className="h-3 w-3 mr-1" />
                        Acknowledged
                      </Button>
                    ) : notification.approvalTier === 'superintendent_locked' ? (
                      <Button
                        size="sm"
                        className="text-xs bg-blue-600 hover:bg-blue-700"
                        onClick={() => setConfirmDialog({ open: true, notification })}
                        disabled={acknowledgeMutation.isPending}
                        data-testid={`button-acknowledge-${notification.id}`}
                      >
                        Acknowledge
                      </Button>
                    ) : (
                      <span className="text-xs text-gray-500 italic" data-testid={`status-info-only-${notification.id}`}>
                        Info Only
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={confirmDialog.open} onOpenChange={(open) => { if (!open) setConfirmDialog({ open: false, notification: null }); }}>
        <DialogContent data-testid="dialog-confirm-acknowledge">
          <DialogHeader>
            <DialogTitle>Confirm Acknowledgment</DialogTitle>
            <DialogDescription>
              {confirmDialog.notification && (
                <>
                  Are you sure you want to acknowledge WO <strong>{confirmDialog.notification.workOrderCode}</strong>?
                  This will allow the Chief Engineer to proceed with approval.
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
    </div>
  );
}
