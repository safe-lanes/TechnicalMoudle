import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChangeRequestModal } from "@/components/modify/ChangeRequestModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Search, Eye, Edit, Trash2, Send, Clock, CheckCircle, XCircle, RotateCcw, Package, ClipboardList, Archive, Store, ExternalLink, ChevronDown, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { TargetPicker } from "@/components/TargetPicker";
import { ProposeChanges } from "@/components/ProposeChanges";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { useChangeMode } from "@/contexts/ChangeModeContext";
import { useToast } from "@/hooks/use-toast";
import { useVessel } from "@/contexts/VesselContext";
import { useUIRole } from "@/contexts/UIRoleContext";
import { useVessels } from "@/hooks/useVessels";
import { useAuth } from "@/contexts/AuthContext";
import { useLocalApprovers } from "@/hooks/useExternalMasterData";

interface RevisionHistoryEntry {
  revisionNumber: number;
  approvedBy: string;
  approvedAt: string;
  appliedChanges: any[];
  comments?: string;
}

interface ChangeRequest {
  id: number;
  vesselId: string;
  category: string;
  title: string;
  reason: string;
  targetType?: string | null;
  targetId?: string | null;
  snapshotBeforeJson?: any;
  proposedChangesJson?: any[] | null;
  movePreviewJson?: any;
  status: 'draft' | 'submitted' | 'returned' | 'approved' | 'rejected';
  requestedByUserId: string;
  submittedAt: Date | null;
  reviewedByUserId: string | null;
  reviewedAt: Date | null;
  revisionNumber?: number;
  revisionHistory?: RevisionHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
  attachments?: ChangeRequestAttachment[];
  comments?: ChangeRequestComment[];
}

interface ChangeRequestAttachment {
  id: number;
  changeRequestId: number;
  filename: string;
  url: string;
  uploadedByUserId: string;
  uploadedAt: Date;
}

interface ChangeRequestComment {
  id: number;
  changeRequestId: number;
  userId: string;
  message: string;
  createdAt: Date;
}

const statusColors = {
  draft: 'bg-gray-500',
  submitted: 'bg-blue-500',
  returned: 'bg-yellow-500',
  approved: 'bg-green-500',
  rejected: 'bg-red-500'
};

const statusIcons = {
  draft: Clock,
  submitted: Send,
  returned: RotateCcw,
  approved: CheckCircle,
  rejected: XCircle
};

export default function ModifyPMS() {
  const [, setLocation] = useLocation();
  const { enterChangeMode } = useChangeMode();
  const { toast } = useToast();
  const { vesselId, setVesselId } = useVessel();
  const { isVessel, isHeadOfDept, isSailAdmin, isClientAdmin } = useUIRole();
  const { currentUser } = useAuth();
  const { data: vessels = [] } = useVessels();
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingRequest, setEditingRequest] = useState<ChangeRequest | null>(null);
  const [viewingRequest, setViewingRequest] = useState<ChangeRequest | null>(null);
  const [showTargetPicker, setShowTargetPicker] = useState(false);
  const [showSnapshotDialog, setShowSnapshotDialog] = useState(false);
  const [snapshotToView, setSnapshotToView] = useState<any>(null);
  const [isNewRequestModalOpen, setIsNewRequestModalOpen] = useState(false);

  // Approve / reject dialog state for change-request review
  const [reviewDialog, setReviewDialog] = useState<{
    open: boolean;
    action: 'approve' | 'reject';
    requestId: number | null;
    label: string;
  }>({ open: false, action: 'reject', requestId: null, label: '' });
  const [reviewComment, setReviewComment] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const openReviewDialog = (action: 'approve' | 'reject', requestId: number, label: string) => {
    setReviewComment('');
    setReviewError('');
    setReviewSubmitting(false);
    setReviewDialog({ open: true, action, requestId, label });
  };

  const closeReviewDialog = () => {
    setReviewDialog({ open: false, action: 'reject', requestId: null, label: '' });
    setReviewComment('');
    setReviewError('');
    setReviewSubmitting(false);
  };

  // Form state for create/edit
  const [formData, setFormData] = useState({
    title: '',
    category: 'components',
    reason: '',
    targetType: null as string | null,
    targetId: null as string | null,
    snapshotBeforeJson: null as any,
    proposedChangesJson: null as any[] | null,
    movePreviewJson: null as any,
    targetDisplay: null as any
  });
  


  // Fetch change requests
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['/technical/api/change-requests', vesselId, categoryFilter, statusFilter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('vesselId', vesselId);
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (searchQuery) params.append('q', searchQuery);
      
      const response = await fetch(`/technical/api/change-requests?${params}`);
      if (!response.ok) throw new Error('Failed to fetch requests');
      return response.json();
    }
  });

  // Fetch approval steps for the currently viewed CR
  const { data: approvalSteps = [] } = useQuery<any[]>({
    queryKey: ['/technical/api/change-requests', viewingRequest?.id, 'approval-steps'],
    queryFn: async () => {
      const res = await fetch(`/technical/api/change-requests/${viewingRequest!.id}/approval-steps`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!viewingRequest && viewingRequest.status === 'submitted',
  });

  // Fetch local approvers to determine if the current user can act on a step
  const { data: localApprovers = [] } = useLocalApprovers();

  // Derive level-aware action eligibility
  const currentUserId = currentUser?.username || (currentUser as any)?.userId || null;
  // Levels for which the current user is an active, non-deleted approver
  const userApproverLevels: string[] = localApprovers
    .filter((a: any) => a.userId === currentUserId && a.isActive === 1 && !a.isDeleted)
    .map((a: any) => a.approverLevel as string);

  // The first Pending step is the one that needs action right now
  const activeStep = approvalSteps.find((s: any) => s.status === 'Pending');
  // True when the active step matches one of the current user's approver levels
  const userIsApproverForActiveStep = !!activeStep && userApproverLevels.includes(activeStep.approvalLevel);
  // True when the active step is at an earlier level than the user's level (e.g., L1 pending, user is L2)
  const awaitingPriorLevel = !!activeStep && !userIsApproverForActiveStep
    && userApproverLevels.length > 0;
  // Legacy CRs with no steps yet, or no approvers configured at all: fall back to role-based guard
  const noStepsYet = viewingRequest?.status === 'submitted' && approvalSteps.length === 0;
  const noApproversConfigured = !localApprovers.some((a: any) => a.isActive === 1 && !a.isDeleted);

  const currentUserCanAct = !!viewingRequest
    && viewingRequest.status === 'submitted'
    && !isVessel
    && !isHeadOfDept
    && (noStepsYet || noApproversConfigured || userIsApproverForActiveStep);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest('POST', '/technical/api/change-requests', {
        ...data,
        vesselId: vesselId,
        requestedByUserId: 'current_user'
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/change-requests'] });
      setShowCreateDialog(false);
      resetForm();
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof formData }) => {
      const res = await apiRequest('PUT', `/technical/api/change-requests/${id}`, {
        ...data,
        vesselId: vesselId,
        requestedByUserId: 'current_user'
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/change-requests'] });
      setEditingRequest(null);
      resetForm();
    }
  });

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('PATCH', `/technical/api/change-requests/${id}/status`, {
        status: 'submitted',
        reviewedByUserId: 'current_user'
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/change-requests'] });
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/technical/api/change-requests/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/change-requests'] });
    }
  });

  const resetForm = () => {
    setFormData({
      title: '',
      category: 'components',
      reason: '',
      targetType: null,
      targetId: null,
      snapshotBeforeJson: null,
      proposedChangesJson: null,
      movePreviewJson: null,
      targetDisplay: null
    });
  };
  
  // Check if returning from target selection
  useEffect(() => {
    const returnWithTarget = sessionStorage.getItem('modifyPMS_returnWithTarget');
    const formDataStr = sessionStorage.getItem('modifyPMS_formData');
    const editingId = sessionStorage.getItem('modifyPMS_editingId');
    
    if (returnWithTarget === 'true' && formDataStr) {
      const savedFormData = JSON.parse(formDataStr);
      setFormData(savedFormData);
      
      // If we were editing, restore that state
      if (editingId && requests) {
        const requestToEdit = requests.find((r: ChangeRequest) => r.id === parseInt(editingId));
        if (requestToEdit) {
          setEditingRequest(requestToEdit);
        }
      }
      
      // Open the create/edit dialog
      setShowCreateDialog(true);
      
      // Clear session storage
      sessionStorage.removeItem('modifyPMS_returnWithTarget');
      sessionStorage.removeItem('modifyPMS_formData');
      sessionStorage.removeItem('modifyPMS_editingId');
    }
  }, [requests]);

  const handleCreate = () => {
    resetForm();
    setShowCreateDialog(true);
  };
  
  const handleCreateWithChangeMode = (category: string) => {
    // Enter change mode with title and category
    const title = `New ${category.charAt(0).toUpperCase() + category.slice(1)} Change Request`;
    enterChangeMode(title, category);
    
    // Navigate to the appropriate screen
    switch (category) {
      case 'components':
        // Set flag to open Add/Edit Component form
        sessionStorage.setItem('openComponentForm', 'true');
        setLocation('/pms/components');
        break;
      case 'work_orders':
        setLocation('/pms/work-orders');
        break;
      case 'spares':
        setLocation('/pms/spares');
        break;
      case 'stores':
        setLocation('/pms/stores');
        break;
      default:
        setLocation('/pms/components');
    }
  };

  const handleEdit = (request: ChangeRequest) => {
    setFormData({
      title: request.title,
      category: request.category,
      reason: request.reason,
      targetType: request.targetType || null,
      targetId: request.targetId || null,
      snapshotBeforeJson: request.snapshotBeforeJson || null,
      proposedChangesJson: request.proposedChangesJson || null,
      movePreviewJson: request.movePreviewJson || null,
      targetDisplay: request.snapshotBeforeJson ? {
        key: request.snapshotBeforeJson.displayKey,
        name: request.snapshotBeforeJson.displayName,
        path: request.snapshotBeforeJson.displayPath
      } : null
    });
    setEditingRequest(request);
  };

  const handleTargetSelect = async (targetType: string, targetId: string, payload: any) => {
    // The payload now contains the full structure with targetDisplay and snapshotBeforeJson
    const actualTargetType = payload.targetType || targetType;
    const actualTargetId = payload.targetId || targetId;
    const snapshot = payload.snapshotBeforeJson || payload;
    
    setFormData(prev => ({
      ...prev,
      targetType: actualTargetType,
      targetId: actualTargetId,
      snapshotBeforeJson: snapshot,
      targetDisplay: payload.targetDisplay
    }));
    
    // If editing an existing request, update it immediately
    if (editingRequest) {
      try {
        await apiRequest('PUT', `/technical/api/change-requests/${editingRequest.id}`, {
          targetType: actualTargetType,
          targetId: actualTargetId,
          snapshotBeforeJson: snapshot
        });
        
        // Refresh the request data
        queryClient.invalidateQueries({ queryKey: ['/technical/api/change-requests'] });
      } catch (error) {
        console.error('Failed to update target:', error);
      }
    }
    
    setShowTargetPicker(false);
  };

  const getTargetIcon = (targetType?: string | null) => {
    switch (targetType) {
      case 'component': return <Package className="h-4 w-4" />;
      case 'work_order': return <ClipboardList className="h-4 w-4" />;
      case 'spare': return <Archive className="h-4 w-4" />;
      case 'store': return <Store className="h-4 w-4" />;
      default: return null;
    }
  };

  const getTargetDisplayName = (request: ChangeRequest) => {
    if (!request.snapshotBeforeJson) return '-';
    const snapshot = request.snapshotBeforeJson;
    return `${snapshot.displayKey || ''} - ${snapshot.displayName || ''}`;
  };

  const handleView = async (request: ChangeRequest) => {
    // Fetch full details including comments and attachments
    const response = await fetch(`/technical/api/change-requests/${request.id}`);
    if (response.ok) {
      const fullRequest = await response.json();
      setViewingRequest(fullRequest);
    }
  };

  const handleSave = () => {
    if (editingRequest) {
      updateMutation.mutate({ id: editingRequest.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getStatusBadge = (status: string) => {
    const Icon = statusIcons[status as keyof typeof statusIcons];
    return (
      <Badge className={`${statusColors[status as keyof typeof statusColors]} text-white`}>
        <Icon className="w-3 h-3 mr-1" />
        {status.toUpperCase()}
      </Badge>
    );
  };

  return (
    <>
    <div className="space-y-4">
      {/* Header with Title, Centered Tabs, and Button */}
      <div className="flex items-center justify-between relative">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Modify PMS - Change Requests</h1>
        <div className="absolute left-1/2 -translate-x-1/2 bg-gray-100 rounded-md p-1 flex items-center gap-1" data-testid="status-filter-tabs">
          {([
            { label: 'All', value: 'all' },
            { label: 'Pending Approval', value: 'submitted' },
            { label: 'Approved', value: 'approved' },
            { label: 'Rejected', value: 'rejected' },
          ] as const).map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                statusFilter === tab.value
                  ? 'bg-[#52baf3] text-white'
                  : 'text-gray-700 hover:bg-gray-200'
              }`}
              data-testid={`btn-filter-${tab.value}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {!isVessel && (
          <Button 
            className="bg-[#5dc86f] hover:bg-[#4db85f] text-white px-6"
            onClick={() => setIsNewRequestModalOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Change Request
          </Button>
        )}
      </div>

      {/* Filters Row: Vessel + Search + Clear */}
      <div className="flex items-center gap-3">
        {(isSailAdmin || isClientAdmin) && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600">Vessel:</span>
            <Select value={(vesselId === 'all' || vesselId === 'my') ? '' : vesselId} onValueChange={setVesselId}>
              <SelectTrigger className="w-[200px]" data-testid="vessel-selector-modify">
                <SelectValue placeholder="Choose vessel" />
              </SelectTrigger>
              <SelectContent>
                {vessels.map(vessel => (
                  <SelectItem key={vessel.id} value={vessel.id}>
                    {vessel.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search change requests..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-status"
          />
        </div>
        <Button variant="outline" onClick={() => setSearchQuery('')} className="text-gray-600" data-testid="button-clear-search">
          Clear
        </Button>
      </div>

      {/* Main Content - Two Column Layout */}
      <div className="flex gap-6" style={{ height: 'calc(100vh - 180px)' }}>
        {/* Left Panel - Category List */}
        <div className="w-[200px] flex-shrink-0">
          <div className="bg-white rounded-lg shadow-sm h-full flex flex-col">
            <div className="bg-[#52baf3] text-white px-4 py-2 font-semibold text-sm">
              CATEGORY
            </div>
            <div className="flex-1">
              <button
                onClick={() => setCategoryFilter('components')}
                className={`w-full text-left px-4 py-3 text-sm border-b border-gray-200 transition-colors ${
                  categoryFilter === 'components'
                    ? 'bg-[#52BAF3] text-white font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                1. Components
              </button>
              <button
                onClick={() => setCategoryFilter('jobs')}
                className={`w-full text-left px-4 py-3 text-sm border-b border-gray-200 transition-colors ${
                  categoryFilter === 'jobs'
                    ? 'bg-[#52BAF3] text-white font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                2. Jobs
              </button>
              <button
                onClick={() => setCategoryFilter('spares')}
                className={`w-full text-left px-4 py-3 text-sm border-b border-gray-200 transition-colors ${
                  categoryFilter === 'spares'
                    ? 'bg-[#52BAF3] text-white font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                3. Spares
              </button>
              <button
                onClick={() => setCategoryFilter('stores')}
                className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                  categoryFilter === 'stores'
                    ? 'bg-[#52BAF3] text-white font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                4. Stores
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel - Change Requests Table */}
        <div className="flex-1">
          <div className="bg-white rounded-lg shadow-sm h-full">
            {isLoading ? (
              <div className="text-center py-12 text-gray-500">Loading...</div>
            ) : requests.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No change requests found. Click "New Change Request" to create one.
              </div>
            ) : (
              <div className="h-full flex flex-col">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#52BAF3] hover:bg-[#52BAF3] border-b-0">
                      <TableHead className="text-white font-medium py-3 px-4">Request Title</TableHead>
                      <TableHead className="text-white font-medium py-3 px-4">Requested By</TableHead>
                      <TableHead className="text-white font-medium py-3 px-4">Date</TableHead>
                      <TableHead className="text-white font-medium py-3 px-4">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((request: ChangeRequest) => (
                      <TableRow key={request.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <TableCell className="py-3 px-4">
                          <div className="font-medium text-gray-900">{request.title}</div>
                        </TableCell>
                        <TableCell className="py-3 px-4 text-gray-700">
                          {request.requestedByUserId === 'current_user' ? 'Chief Engineer' : 
                           request.requestedByUserId === '2nd_engineer' ? '2nd Engineer' : 
                           request.requestedByUserId === '3rd_engineer' ? '3rd Engineer' : 
                           request.requestedByUserId}
                        </TableCell>
                        <TableCell className="py-3 px-4 text-gray-700">
                          {request.submittedAt 
                            ? new Date(request.submittedAt).toLocaleDateString('en-GB', { 
                                year: 'numeric', 
                                month: '2-digit', 
                                day: '2-digit' 
                              }).replace(/\//g, ' ')
                            : new Date(request.createdAt).toLocaleDateString('en-GB', { 
                                year: 'numeric', 
                                month: '2-digit', 
                                day: '2-digit' 
                              }).replace(/\//g, ' ')}
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          {request.status === 'submitted' && (
                            <Badge className="bg-[#52BAF3] text-white px-3 py-1 text-xs rounded-full">
                              Pending Approval
                            </Badge>
                          )}
                          {request.status === 'approved' && (
                            <Badge className="bg-green-500 text-white px-3 py-1 text-xs rounded-full">
                              Approved {request.revisionNumber ? `(Rev ${request.revisionNumber})` : ''}
                            </Badge>
                          )}
                          {request.status === 'rejected' && (
                            <Badge className="bg-red-500 text-white px-3 py-1 text-xs rounded-full">
                              Rejected
                            </Badge>
                          )}
                          {request.status === 'draft' && (
                            <Badge className="bg-gray-500 text-white px-3 py-1 text-xs rounded-full">
                              Draft
                            </Badge>
                          )}
                          {request.status === 'returned' && (
                            <Badge className="bg-yellow-500 text-white px-3 py-1 text-xs rounded-full">
                              Returned
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {/* Pagination info at bottom */}
                <div className="mt-auto px-6 py-4 border-t border-gray-200 text-sm text-gray-500">
                  {requests.length > 0 ? `0 to ${requests.length} of ${requests.length}` : '0 to 0 of 0'}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* Create/Edit Dialog */}
    <Dialog open={showCreateDialog || !!editingRequest} onOpenChange={(open) => {
      if (!open) {
        setShowCreateDialog(false);
        setEditingRequest(null);
        resetForm();
      }
    }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingRequest ? 'Edit Change Request' : 'New Change Request'}
            </DialogTitle>
            <DialogDescription>
              {editingRequest 
                ? 'Update the change request details below.' 
                : 'Create a new change request. It will be saved as draft until submitted.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Brief description of the change (max 120 characters)"
                maxLength={120}
              />
              <p className="text-sm text-gray-500 mt-1">
                {formData.title.length}/120 characters
              </p>
            </div>

            <div>
              <Label htmlFor="category">Category *</Label>
              <Select 
                value={formData.category} 
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="components">Components</SelectItem>
                  <SelectItem value="work_orders">Work Orders</SelectItem>
                  <SelectItem value="running_hours">Running Hours</SelectItem>
                  <SelectItem value="spares">Spares</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="reason">Reason for Change *</Label>
              <Textarea
                id="reason"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Detailed explanation of why this change is needed..."
                rows={6}
              />
            </div>

            <div>
              <Label>Target Selection *</Label>
              <div className="border rounded-lg p-4 bg-gray-50">
                {formData.targetType && formData.snapshotBeforeJson ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getTargetIcon(formData.targetType)}
                      <div>
                        <p className="font-semibold">
                          {formData.snapshotBeforeJson.displayKey} - {formData.snapshotBeforeJson.displayName}
                        </p>
                        {formData.snapshotBeforeJson.displayPath && (
                          <p className="text-xs text-gray-500">
                            {formData.snapshotBeforeJson.displayPath}
                          </p>
                        )}
                        <p className="text-sm text-gray-600">
                          Target Type: {formData.targetType?.replace('_', ' ').toUpperCase()}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Navigate to the appropriate screen with change request mode parameters
                        const params = new URLSearchParams({
                          editAsChangeRequest: '1',
                          crTitle: formData.title || '',
                          crCategory: formData.category || 'components',
                          targetId: formData.targetId || ''
                        });
                        
                        const routes = {
                          'components': `/pms/components?${params}`,
                          'work_orders': `/pms/work-orders?${params}`,
                          'spares': `/spares?${params}`,
                          'stores': `/stores?${params}`
                        };
                        setLocation(routes[formData.category as keyof typeof routes] || `/pms/components?${params}`);
                      }}
                    >
                      Change Target
                    </Button>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-gray-600 mb-2">No target selected</p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        // Navigate to the appropriate screen with change request mode parameters
                        const params = new URLSearchParams({
                          editAsChangeRequest: '1',
                          crTitle: formData.title || '',
                          crCategory: formData.category || 'components'
                        });
                        
                        const routes = {
                          'components': `/pms/components?${params}`,
                          'work_orders': `/pms/work-orders?${params}`,
                          'spares': `/spares?${params}`,
                          'stores': `/stores?${params}`
                        };
                        setLocation(routes[formData.category as keyof typeof routes] || `/pms/components?${params}`);
                      }}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Select Target
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {editingRequest?.status === 'returned' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-yellow-800">
                  This request was returned for clarification. Please review the comments and update accordingly.
                </p>
              </div>
            )}
            
            {/* Propose Changes Section - only show when target is selected and in draft/returned status */}
            {formData.targetType && formData.targetId && formData.snapshotBeforeJson && 
             (!editingRequest || editingRequest.status === 'draft' || editingRequest.status === 'returned') && (
              <div className="mt-6">
                <ProposeChanges
                  targetType={formData.targetType}
                  snapshotData={formData.snapshotBeforeJson}
                  existingProposedChanges={formData.proposedChangesJson || []}
                  existingMovePreview={formData.movePreviewJson}
                  onSaveProposed={(changes, movePreview) => {
                    setFormData(prev => ({
                      ...prev,
                      proposedChangesJson: changes,
                      movePreviewJson: movePreview
                    }));
                    // Save proposed changes to backend
                    if (editingRequest) {
                      fetch(`/technical/api/change-requests/${editingRequest.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          proposedChangesJson: changes,
                          movePreviewJson: movePreview,
                          vesselId: vesselId,
                          requestedByUserId: 'current_user'
                        })
                      }).catch(console.error);
                    }
                  }}
                  disabled={editingRequest ? editingRequest.status !== 'draft' && editingRequest.status !== 'returned' : false}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                setEditingRequest(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formData.title || createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save as Draft'}
            </Button>
            {editingRequest && formData.title && formData.reason && formData.targetType && formData.targetId && 
             formData.proposedChangesJson && formData.proposedChangesJson.length > 0 && (
              <Button
                variant="default"
                onClick={() => {
                  handleSave();
                  // After saving, submit
                  setTimeout(() => {
                    if (editingRequest) {
                      submitMutation.mutate(editingRequest.id);
                    }
                  }, 500);
                }}
              >
                Save & Submit
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!viewingRequest} onOpenChange={(open) => {
        if (!open) setViewingRequest(null);
      }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Change Request CR{viewingRequest && String(viewingRequest.id).padStart(4, '0')}
            </DialogTitle>
          </DialogHeader>

          {viewingRequest && (
            <Tabs defaultValue="details">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="proposed">Proposed Changes</TabsTrigger>
                <TabsTrigger value="snapshot">Snapshot</TabsTrigger>
                <TabsTrigger value="comments">Comments</TabsTrigger>
                <TabsTrigger value="attachments">Attachments</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4">
                <div>
                  <Label>Status</Label>
                  <div className="mt-1">{getStatusBadge(viewingRequest.status)}</div>
                </div>

                <div>
                  <Label>Category</Label>
                  <p className="capitalize">{viewingRequest.category.replace('_', ' ')}</p>
                </div>

                <div>
                  <Label>Title</Label>
                  <p>{viewingRequest.title}</p>
                </div>

                <div>
                  <Label>Reason for Change</Label>
                  <p className="whitespace-pre-wrap">{viewingRequest.reason || 'No reason provided'}</p>
                </div>

                <div>
                  <Label>Target</Label>
                  {viewingRequest.targetType && viewingRequest.snapshotBeforeJson ? (
                    <Card className="mt-2">
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-3">
                          {getTargetIcon(viewingRequest.targetType)}
                          <div className="flex-1">
                            <p className="font-semibold">
                              {viewingRequest.snapshotBeforeJson.displayKey} - {viewingRequest.snapshotBeforeJson.displayName}
                            </p>
                            <p className="text-sm text-gray-600 mb-2">
                              Type: {viewingRequest.targetType?.replace('_', ' ').toUpperCase()}
                            </p>
                            {viewingRequest.snapshotBeforeJson.displayPath && (
                              <p className="text-sm text-gray-500">
                                Path: {viewingRequest.snapshotBeforeJson.displayPath}
                              </p>
                            )}
                            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                              {Object.entries(viewingRequest.snapshotBeforeJson.fields || {}).map(([key, value]: [string, any]) => (
                                <div key={key}>
                                  <span className="text-gray-500">{key}: </span>
                                  <span className="font-medium">{String(value) || '-'}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <p className="text-gray-500">No target selected</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Requested By</Label>
                    <p>{viewingRequest.requestedByUserId}</p>
                  </div>
                  <div>
                    <Label>Created</Label>
                    <p>{new Date(viewingRequest.createdAt).toLocaleString()}</p>
                  </div>
                </div>

                {viewingRequest.submittedAt && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Submitted At</Label>
                      <p>{new Date(viewingRequest.submittedAt).toLocaleString()}</p>
                    </div>
                    {viewingRequest.reviewedAt && (
                      <div>
                        <Label>Reviewed At</Label>
                        <p>{new Date(viewingRequest.reviewedAt).toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                )}

                {viewingRequest.reviewedByUserId && (
                  <div>
                    <Label>Reviewed By</Label>
                    <p>{viewingRequest.reviewedByUserId}</p>
                  </div>
                )}

                {/* Rule #17: Revision History Display */}
                {viewingRequest.revisionHistory && viewingRequest.revisionHistory.length > 0 && (
                  <div className="mt-4">
                    <Label className="text-base font-semibold">Revision History</Label>
                    <div className="mt-2 space-y-2">
                      {viewingRequest.revisionHistory.map((rev, idx) => (
                        <Card key={idx} className="bg-gray-50">
                          <CardContent className="pt-3 pb-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="font-medium text-blue-600">Revision {rev.revisionNumber}</span>
                                <p className="text-sm text-gray-600">
                                  Approved by {rev.approvedBy} on {new Date(rev.approvedAt).toLocaleString()}
                                </p>
                                {rev.comments && (
                                  <p className="text-sm mt-1 text-gray-700 italic">"{rev.comments}"</p>
                                )}
                              </div>
                              <Badge variant="outline" className="text-green-600 border-green-600">
                                Rev {rev.revisionNumber}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {viewingRequest.revisionNumber && viewingRequest.revisionNumber > 0 && (
                  <div className="mt-2 p-2 bg-blue-50 rounded-md">
                    <p className="text-sm text-blue-700">
                      <strong>Current Revision:</strong> {viewingRequest.revisionNumber}
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="proposed">
                <div className="space-y-4">
                  {viewingRequest.proposedChangesJson && viewingRequest.proposedChangesJson.length > 0 ? (
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Field</TableHead>
                            <TableHead>Current</TableHead>
                            <TableHead>Proposed</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {viewingRequest.proposedChangesJson.map((change: any, idx: number) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">{change.label}</TableCell>
                              <TableCell className="text-gray-600">{String(change.before || '-')}</TableCell>
                              <TableCell className="text-red-600 font-medium">
                                {String(change.after || '-')}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      
                      {viewingRequest.movePreviewJson && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">Component Move (Preview)</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label className="text-xs text-gray-500">From</Label>
                                  <p className="text-sm font-mono">{viewingRequest.movePreviewJson.oldPath}</p>
                                  <p className="text-xs text-gray-500 mt-1">Code: {viewingRequest.movePreviewJson.oldCode}</p>
                                </div>
                                <div>
                                  <Label className="text-xs text-gray-500">To</Label>
                                  <p className="text-sm font-mono">{viewingRequest.movePreviewJson.newPath}</p>
                                  <p className="text-xs text-gray-500 mt-1">New Code: {viewingRequest.movePreviewJson.newCodePreview}</p>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </>
                  ) : (
                    <p className="text-center text-gray-500 py-4">No changes proposed yet</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="snapshot">
                <div className="space-y-4">
                  {viewingRequest.snapshotBeforeJson ? (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Target Snapshot</CardTitle>
                        <CardDescription>
                          Snapshot taken at the time of target selection
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Field</TableHead>
                              <TableHead>Value</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {Object.entries(viewingRequest.snapshotBeforeJson.fields || {}).map(([key, value]: [string, any]) => (
                              <TableRow key={key}>
                                <TableCell className="font-medium">{key}</TableCell>
                                <TableCell>{String(value || '-')}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  ) : (
                    <p className="text-center text-gray-500 py-4">No snapshot available</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="comments">
                <div className="space-y-4">
                  {viewingRequest.comments && viewingRequest.comments.length > 0 ? (
                    viewingRequest.comments.map((comment) => (
                      <Card key={comment.id}>
                        <CardContent className="pt-4">
                          <div className="flex justify-between mb-2">
                            <span className="font-semibold">{comment.userId}</span>
                            <span className="text-sm text-gray-500">
                              {new Date(comment.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap">{comment.message}</p>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <p className="text-center text-gray-500 py-4">No comments yet</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="attachments">
                <div className="space-y-2">
                  {viewingRequest.attachments && viewingRequest.attachments.length > 0 ? (
                    viewingRequest.attachments.map((attachment) => (
                      <Card key={attachment.id}>
                        <CardContent className="pt-4">
                          <div className="flex justify-between items-center">
                            <span>{attachment.filename}</span>
                            <Button size="sm" variant="outline" asChild>
                              <a href={attachment.url} target="_blank" rel="noopener noreferrer">
                                View
                              </a>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <p className="text-center text-gray-500 py-4">No attachments</p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}

          {/* Approval step progress banner */}
          {viewingRequest && viewingRequest.status === 'submitted' && approvalSteps.length > 0 && (
            <div className="px-6 pb-2">
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm">
                <p className="font-medium text-blue-800 mb-2">Approval Workflow</p>
                <div className="flex flex-wrap gap-3">
                  {approvalSteps.map((step: any) => {
                    const color =
                      step.status === 'Approved' ? 'text-green-700' :
                      step.status === 'Rejected' ? 'text-red-700' : 'text-blue-700';
                    const icon =
                      step.status === 'Approved' ? '✓' :
                      step.status === 'Rejected' ? '✗' : '⏳';
                    return (
                      <span key={step.id} className={`flex items-center gap-1 ${color}`} data-testid={`text-approval-step-${step.approvalLevel?.replace(' ', '-').toLowerCase()}`}>
                        <span>{icon}</span>
                        <span>{step.approvalLevel}</span>
                        {step.status !== 'Pending' && (
                          <span className="text-xs text-gray-500">({step.status})</span>
                        )}
                      </span>
                    );
                  })}
                </div>
                {activeStep && (
                  <p className="mt-1 text-xs text-blue-600" data-testid="text-awaiting-level">
                    Awaiting {activeStep.approvalLevel} approval
                    {awaitingPriorLevel && (
                      <span className="ml-1 text-amber-600">(complete prior level first)</span>
                    )}
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="flex justify-between">
            <div className="flex gap-2">
              {currentUserCanAct && (
                <>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      const label = viewingRequest!.title
                        ? `CR-${viewingRequest!.id} • ${viewingRequest!.title}`
                        : `CR-${viewingRequest!.id}`;
                      openReviewDialog('reject', viewingRequest!.id, label);
                    }}
                    data-testid="button-cr-reject"
                  >
                    Reject
                  </Button>
                  <Button
                    variant="default"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => {
                      const label = viewingRequest!.title
                        ? `CR-${viewingRequest!.id} • ${viewingRequest!.title}`
                        : `CR-${viewingRequest!.id}`;
                      openReviewDialog('approve', viewingRequest!.id, label);
                    }}
                    data-testid="button-cr-approve"
                  >
                    Approve
                  </Button>
                </>
              )}
            </div>
            <Button onClick={() => setViewingRequest(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve / Reject Change Request Dialog */}
      <Dialog
        open={reviewDialog.open}
        onOpenChange={(open) => {
          if (!open && !reviewSubmitting) closeReviewDialog();
        }}
      >
        <DialogContent className="max-w-lg" data-testid="dialog-review-change-request">
          <DialogHeader>
            <DialogTitle>
              {reviewDialog.action === 'reject' ? 'Reject Change Request' : 'Approve Change Request'}
            </DialogTitle>
            <DialogDescription>
              {reviewDialog.action === 'reject'
                ? (reviewDialog.label
                  ? `Provide a reason for rejecting ${reviewDialog.label}. This will be visible to the requester.`
                  : 'Provide a reason for rejection. This will be visible to the requester.')
                : (reviewDialog.label
                  ? `Add approval comments for ${reviewDialog.label}. These will be visible to the requester.`
                  : 'Add approval comments. These will be visible to the requester.')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="review-comment-textarea">
              {reviewDialog.action === 'reject' ? (
                <>Rejection reason <span className="text-red-600">*</span></>
              ) : (
                <>Approval comments <span className="text-red-600">*</span></>
              )}
            </Label>
            <Textarea
              id="review-comment-textarea"
              value={reviewComment}
              onChange={(e) => {
                setReviewComment(e.target.value);
                if (reviewError) setReviewError('');
              }}
              placeholder={
                reviewDialog.action === 'reject'
                  ? 'Explain why this is being rejected (minimum 10 characters)'
                  : 'Add comments to accompany this approval'
              }
              rows={5}
              maxLength={1000}
              disabled={reviewSubmitting}
              data-testid="textarea-review-comment"
            />
            <div className="flex items-center justify-between text-xs">
              <span className={reviewError ? 'text-red-600' : 'text-gray-500'} data-testid="text-review-error">
                {reviewError || (reviewDialog.action === 'reject'
                  ? 'Minimum 10 characters required.'
                  : 'Please provide a comment to accompany this approval.')}
              </span>
              <span className="text-gray-400" data-testid="text-review-count">
                {reviewComment.length}/1000
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeReviewDialog}
              disabled={reviewSubmitting}
              data-testid="button-review-cancel"
            >
              Cancel
            </Button>
            <Button
              variant={reviewDialog.action === 'reject' ? 'destructive' : 'default'}
              className={reviewDialog.action === 'approve' ? 'bg-green-600 hover:bg-green-700' : undefined}
              disabled={reviewSubmitting}
              onClick={async () => {
                const comment = reviewComment.trim();
                if (reviewDialog.action === 'reject' && comment.length < 10) {
                  setReviewError('Please provide at least 10 characters explaining the rejection.');
                  return;
                }
                if (reviewDialog.action === 'approve' && comment.length === 0) {
                  setReviewError('Please provide a comment to accompany this approval.');
                  return;
                }
                if (!reviewDialog.requestId) return;
                setReviewSubmitting(true);
                try {
                  const endpoint = reviewDialog.action === 'reject' ? 'reject' : 'approve';
                  const response = await fetch(`/technical/api/change-requests/${reviewDialog.requestId}/${endpoint}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ comment, reviewerId: currentUser?.username || currentUser?.userUuid || 'current_user' }),
                  });
                  if (!response.ok) throw new Error(`Failed to ${endpoint}`);
                  queryClient.invalidateQueries({ queryKey: ['/technical/api/change-requests'] });
                  setViewingRequest(null);
                  toast({
                    title: reviewDialog.action === 'reject' ? 'Change request rejected' : 'Change request approved',
                    description: reviewDialog.action === 'reject'
                      ? 'The change request has been rejected'
                      : 'The change request has been approved successfully',
                  });
                  closeReviewDialog();
                } catch {
                  toast({
                    title: 'Error',
                    description: reviewDialog.action === 'reject'
                      ? 'Failed to reject the change request'
                      : 'Failed to approve the change request',
                    variant: 'destructive',
                  });
                  setReviewSubmitting(false);
                }
              }}
              data-testid="button-review-confirm"
            >
              {reviewSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  {reviewDialog.action === 'reject' ? 'Rejecting...' : 'Approving...'}
                </>
              ) : reviewDialog.action === 'reject' ? (
                <>
                  <XCircle className="w-4 h-4 mr-1" />
                  Confirm Rejection
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Confirm Approval
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Target Picker Dialog */}
      {showTargetPicker && (
        <TargetPicker
          open={showTargetPicker}
          onOpenChange={setShowTargetPicker}
          category={formData.category}
          vesselId={vesselId}
          onTargetSelect={handleTargetSelect}
        />
      )}

    {/* Change Request Modal */}
    <ChangeRequestModal
      open={isNewRequestModalOpen}
      onClose={() => setIsNewRequestModalOpen(false)}
    />
  </>
  );
}