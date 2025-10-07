import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, X, RotateCcw, GitPullRequest, AlertTriangle, Info } from "lucide-react";
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

  // Fetch change request details
  const { data: changeRequest, isLoading } = useQuery<ChangeRequest>({
    queryKey: ['/api/change-requests', requestId],
    queryFn: async () => {
      const response = await fetch(`/api/change-requests/${requestId}`);
      if (!response.ok) throw new Error('Failed to fetch change request');
      return response.json();
    },
    enabled: open && !!requestId
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('PUT', `/api/change-requests/${requestId}/approve`, {
        reviewedByUserId: 'Current User', // In real app, get from auth context
        reviewComments: comment
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Change request approved successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/change-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/change-requests', requestId] });
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
      return apiRequest('PUT', `/api/change-requests/${requestId}/reject`, {
        reviewedByUserId: 'Current User', // In real app, get from auth context
        reviewComments: comment
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Change request rejected",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/change-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/change-requests', requestId] });
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
      return apiRequest('PUT', `/api/change-requests/${requestId}/return`, {
        returnedByUserId: 'Current User', // In real app, get from auth context
        returnComments: comment
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Change request returned for revisions",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/change-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/change-requests', requestId] });
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
      case 'approve':
        approveMutation.mutate();
        break;
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
      case 'approve':
        return <CheckCircle className="w-6 h-6 text-green-600" />;
      case 'reject':
        return <X className="w-6 h-6 text-red-600" />;
      case 'return':
        return <RotateCcw className="w-6 h-6 text-yellow-600" />;
    }
  };

  const getActionTitle = () => {
    switch (action) {
      case 'approve':
        return 'Approve Change Request';
      case 'reject':
        return 'Reject Change Request';
      case 'return':
        return 'Return Change Request for Revisions';
    }
  };

  const getActionColor = () => {
    switch (action) {
      case 'approve':
        return 'bg-green-600 hover:bg-green-700';
      case 'reject':
        return 'bg-red-600 hover:bg-red-700';
      case 'return':
        return 'bg-yellow-600 hover:bg-yellow-700';
    }
  };

  const getActionMessage = () => {
    switch (action) {
      case 'approve':
        return 'Approving this change request will mark it as approved and allow implementation to proceed.';
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

  // Parse proposed changes for display
  const proposedChanges = changeRequest.proposedChangesJson ? 
    (typeof changeRequest.proposedChangesJson === 'string' ? 
      JSON.parse(changeRequest.proposedChangesJson) : 
      changeRequest.proposedChangesJson) : [];

  const isPending = approveMutation.isPending || rejectMutation.isPending || returnMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {getActionIcon()}
            <DialogTitle>{getActionTitle()}</DialogTitle>
          </div>
        </DialogHeader>
        
        <div className="space-y-4">
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
              
              {proposedChanges.length > 0 && (
                <div>
                  <Label className="text-xs text-gray-600">Proposed Changes</Label>
                  <p className="text-sm text-gray-700">
                    {proposedChanges.length} change{proposedChanges.length !== 1 ? 's' : ''} proposed
                  </p>
                </div>
              )}
              
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span>Requested by: {changeRequest.requestedByUserId}</span>
                <span>Date: {new Date(changeRequest.createdAt).toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>

          {/* Action Message */}
          <div className={`border rounded-lg p-3 flex gap-3 ${
            action === 'approve' ? 'bg-green-50 border-green-200' :
            action === 'reject' ? 'bg-red-50 border-red-200' :
            'bg-yellow-50 border-yellow-200'
          }`}>
            <Info className={`w-5 h-5 flex-shrink-0 ${
              action === 'approve' ? 'text-green-600' :
              action === 'reject' ? 'text-red-600' :
              'text-yellow-600'
            }`} />
            <p className={`text-sm ${
              action === 'approve' ? 'text-green-800' :
              action === 'reject' ? 'text-red-800' :
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
              rows={4}
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

        <DialogFooter>
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