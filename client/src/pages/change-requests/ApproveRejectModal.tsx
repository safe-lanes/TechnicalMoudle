import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, X, RotateCcw, GitPullRequest, AlertTriangle, Info, Pencil } from "lucide-react";
import type { ChangeRequest } from "@shared/schema";

interface ApproveRejectModalProps {
  open: boolean;
  onClose: () => void;
  requestId: number;
  action: 'approve' | 'reject' | 'return';
  onProcessed?: () => void;
}

export default function ApproveRejectModal({ 
  open, 
  onClose, 
  requestId, 
  action,
  onProcessed 
}: ApproveRejectModalProps) {
  const { toast } = useToast();
  const [comment, setComment] = useState("");
  // Per-field override state: key = field name, value = approver-edited text
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  // Fetch change request details
  const { data: changeRequest, isLoading } = useQuery<ChangeRequest>({
    queryKey: ['/technical/api/change-requests', requestId],
    queryFn: async () => {
      const response = await fetch(`/technical/api/change-requests/${requestId}`);
      if (!response.ok) throw new Error('Failed to fetch change request');
      return response.json();
    },
    enabled: open && !!requestId
  });

  // Parse proposed changes once
  const proposedChanges: Array<{ field: string; oldValue: any; newValue: any; justification?: string }> = useMemo(() => {
    if (!changeRequest?.proposedChangesJson) return [];
    const raw = typeof changeRequest.proposedChangesJson === 'string'
      ? JSON.parse(changeRequest.proposedChangesJson)
      : changeRequest.proposedChangesJson;
    if (!Array.isArray(raw)) return [];
    return raw;
  }, [changeRequest]);

  const approveMutation = useMutation({
    mutationFn: async (overriddenChanges: Array<{ field: string; approverNewValue: string }>) => {
      return apiRequest('PUT', `/technical/api/change-requests/${requestId}/approve`, {
        comment,
        ...(overriddenChanges.length > 0 ? { overriddenChanges } : {}),
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Change request approved successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/technical/api/change-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/technical/api/change-requests', requestId] });
      handleClose();
      onProcessed?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve change request",
        variant: "destructive",
      });
    }
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('PUT', `/technical/api/change-requests/${requestId}/reject`, {
        comment,
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Change request rejected",
      });
      queryClient.invalidateQueries({ queryKey: ['/technical/api/change-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/technical/api/change-requests', requestId] });
      handleClose();
      onProcessed?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject change request",
        variant: "destructive",
      });
    }
  });

  const returnMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('PUT', `/technical/api/change-requests/${requestId}/return`, {
        comment,
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Change request returned for revisions",
      });
      queryClient.invalidateQueries({ queryKey: ['/technical/api/change-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/technical/api/change-requests', requestId] });
      handleClose();
      onProcessed?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to return change request",
        variant: "destructive",
      });
    }
  });

  const handleClose = () => {
    setComment("");
    setOverrides({});
    onClose();
  };

  const handleSubmit = () => {
    if (!comment.trim()) {
      toast({
        title: "Validation Error",
        description: `Please provide a ${action} comment`,
        variant: "destructive",
      });
      return;
    }

    switch (action) {
      case 'approve': {
        // Build overriddenChanges: only fields where approver changed the value
        const overriddenChanges = proposedChanges
          .filter(change => {
            const key = change.field;
            const originalStr = String(change.newValue ?? '');
            return overrides[key] !== undefined && overrides[key] !== originalStr;
          })
          .map(change => ({
            field: change.field,
            approverNewValue: overrides[change.field],
          }));
        approveMutation.mutate(overriddenChanges);
        break;
      }
      case 'reject':
        rejectMutation.mutate();
        break;
      case 'return':
        returnMutation.mutate();
        break;
    }
  };

  const getActionIcon = () => {
    switch (action) {
      case 'approve': return <CheckCircle className="w-6 h-6 text-green-600" />;
      case 'reject':  return <X className="w-6 h-6 text-red-600" />;
      case 'return':  return <RotateCcw className="w-6 h-6 text-yellow-600" />;
    }
  };

  const getActionTitle = () => {
    switch (action) {
      case 'approve': return 'Approve Change Request';
      case 'reject':  return 'Reject Change Request';
      case 'return':  return 'Return Change Request for Revisions';
    }
  };

  const getActionColor = () => {
    switch (action) {
      case 'approve': return 'bg-green-600 hover:bg-green-700';
      case 'reject':  return 'bg-red-600 hover:bg-red-700';
      case 'return':  return 'bg-yellow-600 hover:bg-yellow-700';
    }
  };

  const getActionMessage = () => {
    switch (action) {
      case 'approve':
        return proposedChanges.length > 0
          ? 'Review the proposed changes below. You may edit any New Value before approving — the modified value will be applied instead of the original.'
          : 'Approving this change request will mark it as approved and allow implementation to proceed.';
      case 'reject':
        return 'Rejecting this change request will permanently close it. This action cannot be undone.';
      case 'return':
        return 'Returning this change request will send it back to the requestor for revisions. They can then resubmit after making changes.';
    }
  };

  if (isLoading || !changeRequest) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Loading...</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const isPending = approveMutation.isPending || rejectMutation.isPending || returnMutation.isPending;

  // Determine how many fields the approver has modified from the original
  const modifiedCount = proposedChanges.filter(change => {
    const key = change.field;
    return overrides[key] !== undefined && overrides[key] !== String(change.newValue ?? '');
  }).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <div className="flex items-center gap-3">
            {getActionIcon()}
            <DialogTitle>{getActionTitle()}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1 pr-1">
          {/* Change Request Summary */}
          <Card className="bg-gray-50">
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GitPullRequest className="w-4 h-4 text-gray-500" />
                  <span className="font-medium">CR-{String(changeRequest.id).padStart(4, '0')}</span>
                </div>
                <Badge variant="outline">{changeRequest.category}</Badge>
              </div>

              <div>
                <Label className="text-xs text-gray-600">Title</Label>
                <p className="text-sm font-medium">{changeRequest.title}</p>
              </div>

              <div>
                <Label className="text-xs text-gray-600">Reason</Label>
                <p className="text-sm text-gray-700 line-clamp-2">{changeRequest.reason}</p>
              </div>

              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span>Requested by: {changeRequest.requestedByUserId}</span>
                <span>Date: {new Date(changeRequest.createdAt).toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>

          {/* Proposed Changes Table — editable when action is 'approve' */}
          {proposedChanges.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-gray-700">
                  Proposed Changes ({proposedChanges.length})
                </Label>
                {action === 'approve' && (
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <Pencil className="w-3 h-3" />
                    Edit New Value to override before approving
                  </p>
                )}
                {action === 'approve' && modifiedCount > 0 && (
                  <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs">
                    {modifiedCount} field{modifiedCount !== 1 ? 's' : ''} modified
                  </Badge>
                )}
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100 border-b">
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-600 w-1/3">Field</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-600 w-1/3">Previous Value</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-600 w-1/3">
                        New Value {action === 'approve' && <span className="text-amber-600">(editable)</span>}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {proposedChanges.map((change, idx) => {
                      const fieldKey = change.field;
                      const originalNewValue = String(change.newValue ?? '');
                      const currentValue = overrides[fieldKey] ?? originalNewValue;
                      const isModified = overrides[fieldKey] !== undefined && overrides[fieldKey] !== originalNewValue;

                      return (
                        <tr key={idx} className={`border-b last:border-0 ${isModified ? 'bg-amber-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                          {/* Field name */}
                          <td className="px-3 py-2 font-medium text-gray-700 text-xs uppercase tracking-wide">
                            {change.field}
                          </td>

                          {/* Previous (old) value — always read-only */}
                          <td className="px-3 py-2">
                            <span
                              className="inline-block bg-gray-100 text-gray-700 rounded px-2 py-0.5 text-xs max-w-full truncate"
                              title={String(change.oldValue ?? '—')}
                            >
                              {String(change.oldValue ?? '—')}
                            </span>
                          </td>

                          {/* New value — editable input when action === 'approve' */}
                          <td className="px-3 py-2">
                            {action === 'approve' ? (
                              <div className="flex items-center gap-1.5">
                                <Input
                                  value={currentValue}
                                  onChange={(e) =>
                                    setOverrides(prev => ({ ...prev, [fieldKey]: e.target.value }))
                                  }
                                  className={`h-7 text-xs ${isModified ? 'border-amber-400 bg-amber-50 focus-visible:ring-amber-300' : ''}`}
                                  data-testid={`input-override-${fieldKey}`}
                                />
                                {isModified && (
                                  <Badge
                                    className="shrink-0 bg-amber-100 text-amber-700 border-amber-300 text-xs px-1.5 py-0"
                                    data-testid={`badge-modified-${fieldKey}`}
                                  >
                                    Modified
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span
                                className="inline-block bg-green-50 text-green-800 border border-green-200 rounded px-2 py-0.5 text-xs max-w-full truncate"
                                title={originalNewValue}
                              >
                                {originalNewValue || '—'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {action === 'approve' && modifiedCount > 0 && (
                <div
                  className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800"
                  data-testid="warning-approver-overrides"
                >
                  <span className="mt-0.5 shrink-0">⚠</span>
                  <span>
                    You have modified {modifiedCount} field{modifiedCount !== 1 ? 's' : ''}. The modified value{modifiedCount !== 1 ? 's' : ''} will be applied to the record instead of the vessel's original request. This will be recorded in the audit trail.
                  </span>
                </div>
              )}
            </div>
          )}

          <Separator />

          {/* Action Message */}
          <div className={`border rounded-lg p-3 flex gap-3 ${
            action === 'approve' ? 'bg-green-50 border-green-200' :
            action === 'reject'  ? 'bg-red-50 border-red-200' :
            'bg-yellow-50 border-yellow-200'
          }`}>
            <Info className={`w-5 h-5 flex-shrink-0 ${
              action === 'approve' ? 'text-green-600' :
              action === 'reject'  ? 'text-red-600' :
              'text-yellow-600'
            }`} />
            <p className={`text-sm ${
              action === 'approve' ? 'text-green-800' :
              action === 'reject'  ? 'text-red-800' :
              'text-yellow-800'
            }`}>
              {getActionMessage()}
            </p>
          </div>

          {/* Comment Field */}
          <div>
            <Label htmlFor="comment" className="text-sm font-medium">
              {action === 'approve' ? 'Approval' : action === 'reject' ? 'Rejection' : 'Return'} Comment *
            </Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                action === 'approve' ?
                  'Provide approval comments...' :
                action === 'reject' ?
                  'Provide reason for rejection...' :
                  'Specify what needs to be revised...'
              }
              rows={3}
              className="mt-1"
              data-testid="textarea-comment"
            />
            <p className="text-xs text-gray-500 mt-1">
              This comment will be recorded in the change request history
            </p>
          </div>

          {/* Warning for reject action */}
          {action === 'reject' && (
            <div className="border border-red-200 bg-red-50 rounded-lg p-3 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800">Warning</p>
                <p className="text-sm text-red-700">
                  Rejecting a change request is permanent and cannot be undone.
                  The requestor will need to create a new change request if needed.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 pt-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isPending}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !comment.trim()}
            className={getActionColor()}
            data-testid={`button-${action}`}
          >
            {isPending ? (
              'Processing...'
            ) : (
              <>
                {action === 'approve' && 'Approve'}
                {action === 'reject' && 'Reject'}
                {action === 'return' && 'Return for Revisions'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
