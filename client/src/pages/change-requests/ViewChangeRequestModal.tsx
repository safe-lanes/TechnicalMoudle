import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { 
  FileText, 
  Paperclip, 
  Link, 
  Calendar, 
  User, 
  GitPullRequest,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Target,
  Edit2
} from "lucide-react";
import { useState } from "react";
import type { ChangeRequest } from "@shared/schema";

interface ViewChangeRequestModalProps {
  open: boolean;
  onClose: () => void;
  requestId: number;
}

export default function ViewChangeRequestModal({ open, onClose, requestId }: ViewChangeRequestModalProps) {
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    target: true,
    proposedChanges: true,
    reason: true,
    workflow: true,
    comments: false,
    attachments: false
  });

  const { data: changeRequest, isLoading } = useQuery<ChangeRequest>({
    queryKey: ['/api/change-requests', requestId],
    queryFn: async () => {
      const response = await fetch(`/api/change-requests/${requestId}`);
      if (!response.ok) throw new Error('Failed to fetch change request');
      return response.json();
    },
    enabled: open && !!requestId
  });

  const { data: comments = [] } = useQuery({
    queryKey: ['/api/change-requests', requestId, 'comments'],
    queryFn: async () => {
      const response = await fetch(`/api/change-requests/${requestId}/comments`);
      if (!response.ok) throw new Error('Failed to fetch comments');
      return response.json();
    },
    enabled: open && !!requestId
  });

  const { data: attachments = [] } = useQuery({
    queryKey: ['/api/change-requests', requestId, 'attachments'],
    queryFn: async () => {
      const response = await fetch(`/api/change-requests/${requestId}/attachments`);
      if (!response.ok) throw new Error('Failed to fetch attachments');
      return response.json();
    },
    enabled: open && !!requestId
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return '-';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary" className="bg-gray-100">Draft</Badge>;
      case 'submitted':
        return <Badge variant="default" className="bg-blue-100 text-blue-700">Submitted</Badge>;
      case 'returned':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">Returned</Badge>;
      case 'approved':
        return <Badge variant="default" className="bg-green-100 text-green-700">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'components':
        return <Badge variant="outline" className="text-blue-600 border-blue-300">Components</Badge>;
      case 'work_orders':
        return <Badge variant="outline" className="text-green-600 border-green-300">Work Orders</Badge>;
      case 'spares':
        return <Badge variant="outline" className="text-orange-600 border-orange-300">Spares</Badge>;
      case 'stores':
        return <Badge variant="outline" className="text-purple-600 border-purple-300">Stores</Badge>;
      default:
        return <Badge variant="outline">{category}</Badge>;
    }
  };

  if (isLoading || !changeRequest) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-blue-600">Loading Change Request...</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Parse proposed changes if it's a JSON string
  const proposedChanges = changeRequest.proposedChangesJson ? 
    (typeof changeRequest.proposedChangesJson === 'string' ? 
      JSON.parse(changeRequest.proposedChangesJson) : 
      changeRequest.proposedChangesJson) : [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="px-6 py-4 border-b bg-blue-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GitPullRequest className="w-6 h-6 text-blue-600" />
              <DialogTitle className="text-xl text-blue-900">
                Change Request CR-{String(changeRequest.id).padStart(4, '0')}
              </DialogTitle>
              {getStatusBadge(changeRequest.status)}
              {getCategoryBadge(changeRequest.category)}
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[calc(90vh-8rem)]">
          <div className="p-6 space-y-4">
            {/* Basic Information */}
            <Card className={expandedSections.basic ? "" : "overflow-hidden"}>
              <CardHeader 
                className="cursor-pointer"
                onClick={() => toggleSection('basic')}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Basic Information
                  </CardTitle>
                  {expandedSections.basic ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </div>
              </CardHeader>
              {expandedSections.basic && (
                <CardContent className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-gray-600">Request ID</Label>
                    <Input value={`CR-${String(changeRequest.id).padStart(4, '0')}`} readOnly className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600">Vessel</Label>
                    <Input value={changeRequest.vesselId} readOnly className="mt-1" />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-sm text-gray-600">Title</Label>
                    <Input value={changeRequest.title} readOnly className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600">Requested By</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">{changeRequest.requestedByUserId}</span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600">Created Date</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">{formatDate(changeRequest.createdAt)}</span>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Target Information */}
            {(changeRequest.targetType || changeRequest.targetId) && (
              <Card className={expandedSections.target ? "" : "overflow-hidden"}>
                <CardHeader 
                  className="cursor-pointer"
                  onClick={() => toggleSection('target')}
                >
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Target className="w-5 h-5" />
                      Target Information
                    </CardTitle>
                    {expandedSections.target ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                </CardHeader>
                {expandedSections.target && (
                  <CardContent className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-gray-600">Target Type</Label>
                      <Input value={changeRequest.targetType || '-'} readOnly className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-sm text-gray-600">Target ID</Label>
                      <Input value={changeRequest.targetId || '-'} readOnly className="mt-1" />
                    </div>
                  </CardContent>
                )}
              </Card>
            )}

            {/* Reason for Change */}
            <Card className={expandedSections.reason ? "" : "overflow-hidden"}>
              <CardHeader 
                className="cursor-pointer"
                onClick={() => toggleSection('reason')}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Edit2 className="w-5 h-5" />
                    Reason for Change
                  </CardTitle>
                  {expandedSections.reason ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </div>
              </CardHeader>
              {expandedSections.reason && (
                <CardContent>
                  <Textarea 
                    value={changeRequest.reason} 
                    readOnly 
                    rows={4}
                    className="resize-none"
                  />
                </CardContent>
              )}
            </Card>

            {/* Proposed Changes */}
            {proposedChanges && proposedChanges.length > 0 && (
              <Card className={expandedSections.proposedChanges ? "" : "overflow-hidden"}>
                <CardHeader 
                  className="cursor-pointer"
                  onClick={() => toggleSection('proposedChanges')}
                >
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Edit2 className="w-5 h-5" />
                      Proposed Changes
                      <Badge variant="secondary">{proposedChanges.length}</Badge>
                    </CardTitle>
                    {expandedSections.proposedChanges ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                </CardHeader>
                {expandedSections.proposedChanges && (
                  <CardContent>
                    <div className="space-y-3">
                      {proposedChanges.map((change: any, index: number) => (
                        <div key={index} className="border rounded-lg p-3 bg-gray-50">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-xs text-gray-600">Field</Label>
                              <p className="font-medium">{change.field}</p>
                            </div>
                            <div>
                              <Label className="text-xs text-gray-600">Justification</Label>
                              <p className="text-sm text-gray-700">{change.justification}</p>
                            </div>
                            <div>
                              <Label className="text-xs text-gray-600">Old Value</Label>
                              <p className="text-red-600">{change.oldValue || '-'}</p>
                            </div>
                            <div>
                              <Label className="text-xs text-gray-600">New Value</Label>
                              <p className="text-green-600">{change.newValue}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            )}

            {/* Workflow Status */}
            <Card className={expandedSections.workflow ? "" : "overflow-hidden"}>
              <CardHeader 
                className="cursor-pointer"
                onClick={() => toggleSection('workflow')}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    Workflow Status
                  </CardTitle>
                  {expandedSections.workflow ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </div>
              </CardHeader>
              {expandedSections.workflow && (
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-gray-600">Current Status</Label>
                      <div className="mt-1">
                        {getStatusBadge(changeRequest.status)}
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-600">Last Updated</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-sm">{formatDate(changeRequest.updatedAt)}</span>
                      </div>
                    </div>
                  </div>
                  
                  {changeRequest.submittedAt && (
                    <div>
                      <Label className="text-sm text-gray-600">Submitted</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-sm">{formatDate(changeRequest.submittedAt)}</span>
                      </div>
                    </div>
                  )}
                  
                  {changeRequest.reviewedByUserId && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm text-gray-600">Reviewed By</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="text-sm">{changeRequest.reviewedByUserId}</span>
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm text-gray-600">Reviewed Date</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-sm">{formatDate(changeRequest.reviewedAt)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>

            {/* Comments */}
            <Card className={expandedSections.comments ? "" : "overflow-hidden"}>
              <CardHeader 
                className="cursor-pointer"
                onClick={() => toggleSection('comments')}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    Comments
                    {comments.length > 0 && (
                      <Badge variant="secondary">{comments.length}</Badge>
                    )}
                  </CardTitle>
                  {expandedSections.comments ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </div>
              </CardHeader>
              {expandedSections.comments && (
                <CardContent>
                  {comments.length > 0 ? (
                    <div className="space-y-3">
                      {comments.map((comment: any) => (
                        <div key={comment.id} className="border rounded-lg p-3 bg-gray-50">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-gray-400" />
                              <span className="font-medium text-sm">{comment.userId}</span>
                            </div>
                            <span className="text-xs text-gray-500">
                              {formatDate(comment.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700">{comment.message}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-4">No comments yet</p>
                  )}
                </CardContent>
              )}
            </Card>

            {/* Attachments */}
            <Card className={expandedSections.attachments ? "" : "overflow-hidden"}>
              <CardHeader 
                className="cursor-pointer"
                onClick={() => toggleSection('attachments')}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Paperclip className="w-5 h-5" />
                    Attachments
                    {attachments.length > 0 && (
                      <Badge variant="secondary">{attachments.length}</Badge>
                    )}
                  </CardTitle>
                  {expandedSections.attachments ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </div>
              </CardHeader>
              {expandedSections.attachments && (
                <CardContent>
                  {attachments.length > 0 ? (
                    <div className="space-y-2">
                      {attachments.map((attachment: any) => (
                        <div
                          key={attachment.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                        >
                          <div className="flex items-center gap-3">
                            <Paperclip className="w-4 h-4 text-gray-400" />
                            <div>
                              <p className="text-sm font-medium">{attachment.filename}</p>
                              <p className="text-xs text-gray-500">
                                Uploaded by {attachment.uploadedByUserId} on {formatDate(attachment.uploadedAt)}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(attachment.url, '_blank')}
                          >
                            View
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-4">No attachments</p>
                  )}
                </CardContent>
              )}
            </Card>
          </div>
        </ScrollArea>

        <Separator />
        <div className="px-6 py-4 border-t flex justify-end">
          <Button onClick={onClose} variant="outline" data-testid="button-close">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}