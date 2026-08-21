import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { PeriodFilter, PeriodFilterValue, periodFilterToDateRange } from '@/components/filters/PeriodFilter';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Wrench, Package, FileText, Archive, Eye, Check, X, Plus } from 'lucide-react';
import type { ColDef } from 'ag-grid-community';
import WOAgGridTable from '@/components/WOAgGridTable';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { queryClient } from '@/lib/queryClient';
import { Label } from '@/components/ui/label';
import { ChangeRequestModal } from '@/components/modify/ChangeRequestModal';
import ApproveRejectModal from '@/pages/change-requests/ApproveRejectModal';
import { RejectionHistorySection } from '@/components/wo/RejectionHistorySection';
import { useVessel } from '@/contexts/VesselContext';
import { useUIRole } from '@/contexts/UIRoleContext';
import { useVessels } from '@/hooks/useVessels';
import { useAuth } from '@/contexts/AuthContext';
import { useLocalApprovers } from '@/hooks/useExternalMasterData';
import { ApprovalChainProgress, useApprovalChain } from '@/components/approvals/ApprovalChainProgress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ModifyOption {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  route: string;
}

const modifyOptions: ModifyOption[] = [
  {
    id: 'components',
    title: 'Components',
    description: 'Modify component hierarchy and details',
    icon: <Wrench className="h-6 w-6" />,
    route: '/pms/components?modify=1'
  },
  {
    id: 'jobs',
    title: 'Jobs',
    description: 'Edit planned maintenance schedules',
    icon: <FileText className="h-6 w-6" />,
    route: '/pms/modify-pms/jobs'
  },
  {
    id: 'spares',
    title: 'Spares',
    description: 'Update spare parts inventory',
    icon: <Package className="h-6 w-6" />,
    route: '/pms/spares?modify=1'
  },
  {
    id: 'stores',
    title: 'Stores',
    description: 'Manage store inventory items',
    icon: <Archive className="h-6 w-6" />,
    route: '/pms/stores?modify=1'
  }
];

type ViewMode = 'dashboard' | 'pending' | 'history';

interface ChangeRequest {
  id: number;
  cruuid?: string;
  vesselId: string;
  category: string;
  title: string;
  reason: string;
  status: 'draft' | 'submitted' | 'returned' | 'approved' | 'rejected';
  requestedByUserId: string;
  submittedAt: Date | null;
  reviewedByUserId: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  proposedChangesJson?: any[];
  targetType?: string;
  targetId?: string;
}

export function ModifyPMS() {
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterValue | null>(null);
  const [isNewRequestModalOpen, setIsNewRequestModalOpen] = useState(false);
  const [viewingRequest, setViewingRequest] = useState<ChangeRequest | null>(null);
  const [, setLocation] = useLocation();
  const { vesselId, setVesselId, applyVesselScope, pickerVessels, myVesselsEmpty, assignedVesselIds } = useVessel();
  const { isVessel, isHeadOfDept, isSailAdmin, isClientAdmin } = useUIRole();
  const { data: vessels = [] } = useVessels();
  const { currentUser } = useAuth();
  const { data: localApprovers = [], isError: approversError, isLoading: approversLoading } = useLocalApprovers();

  const periodDateRange = useMemo(() => periodFilter ? periodFilterToDateRange(periodFilter) : null, [periodFilter]);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['/technical/api/change-requests', vesselId, categoryFilter, periodDateRange?.from?.toISOString(), periodDateRange?.to?.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams();
      // Normalize vessel scope the same way every other module does:
      // single vessel -> vesselId=<uuid>; All Vessel -> vesselId=all;
      // My Vessel -> vesselId=all + vesselIds=<assigned csv>. This keeps My
      // Vessel routing through the identical path as All Vessel.
      applyVesselScope(params);
      
      if (categoryFilter !== 'all') {
        params.append('category', categoryFilter);
      }
      if (periodDateRange) {
        params.append('periodFrom', periodDateRange.from.toISOString());
        params.append('periodTo', periodDateRange.to.toISOString());
      }
      
      const response = await fetch(`/technical/api/change-requests?${params}`);
      if (!response.ok) throw new Error('Failed to fetch requests');
      return response.json();
    },
    enabled: !!vesselId
  });


  // Approval steps for the currently viewed request (gating logic)
  const { data: approvalSteps = [], isError: stepsError, isLoading: stepsLoading } = useQuery({
    queryKey: ['/technical/api/change-requests', viewingRequest?.id, 'approval-steps'],
    queryFn: async () => {
      const res = await fetch(`/technical/api/change-requests/${viewingRequest!.id}/approval-steps`);
      if (!res.ok) throw new Error(`Failed to fetch approval steps: ${res.status}`);
      return res.json();
    },
    enabled: !!viewingRequest && viewingRequest.status === 'submitted',
  });

  // Derive whether the current user is the active approver for the pending step.
  // Match by userUuid (moc_approvers.user_uuid vs currentUser.userUuid) —
  // the stable cross-system UUID identifier synced from Crew Master.
  const userApproverLevels: string[] = localApprovers
    .filter((a: any) =>
      a.userUuid && currentUser?.userUuid && a.userUuid === currentUser.userUuid &&
      a.isActive === 1 && !a.isDeleted
    )
    .map((a: any) => a.approverLevel as string);
  const activeStep = approvalSteps.find((s: any) => s.status === 'Pending');
  const userIsApproverForActiveStep = !!activeStep && userApproverLevels.includes(activeStep.approvalLevel);
  // Legacy CRs with no steps, or no approvers configured at all: fall back to role-based guard
  const noStepsYet = viewingRequest?.status === 'submitted' && approvalSteps.length === 0;
  const noApproversConfigured = !localApprovers.some((a: any) => a.isActive === 1 && !a.isDeleted);

  // Vessel gate: approver must be assigned to the request's vessel (from profile).
  // Sail Admin bypasses. Empty assignedVesselIds = no profile assignments = global scope (safe fallback).
  const crVesselId = viewingRequest?.vesselId ?? null;
  const crVesselIsAssigned =
    isSailAdmin
    || assignedVesselIds.length === 0
    || (!!crVesselId && assignedVesselIds.includes(crVesselId));

  // Phase 2 / W3 — approval-engine gate. When the engine owns a pending chain for this CR,
  // the approve/reject buttons follow the chain's ACTIVE slot (canDecide); with no chain
  // (ships, legacy, no workflow) everything below behaves exactly as before (fail-soft hook).
  const engineScreenId =
    viewingRequest?.targetType === 'component' ? 'pms-components-cr'
    : viewingRequest?.targetType === 'job' ? 'pms-jobs-cr'
    : viewingRequest?.targetType === 'spare' ? 'pms-spares-cr'
    : viewingRequest?.targetType === 'store' ? 'pms-stores-cr'
    : null;
  const engineChain = useApprovalChain(engineScreenId ?? 'none', engineScreenId && viewingRequest?.status === 'submitted' ? (viewingRequest as any)?.cruuid : null);

  const legacyUserCanAct = crVesselIsAssigned && (
    (approversLoading || stepsLoading || approversError || stepsError)
      ? false
      : (noStepsYet || noApproversConfigured)
        ? (!isVessel && !isHeadOfDept)
        : userIsApproverForActiveStep
  );
  const userCanAct = engineChain.hasChain ? engineChain.canDecide : legacyUserCanAct;

  // Reviewer decision modal — approve OR reject. Both go through ApproveRejectModal so the
  // reviewer enters a real comment (the reject reason is shown to the requester). (E2E-2 fix)
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null);

  const handleRowClick = (request: ChangeRequest) => {
    setViewingRequest(request);
  };

  const formatRequestedBy = (uid: string | null | undefined): string => {
    return uid || '—';
  };

  const columnDefs: ColDef[] = useMemo(() => [
    {
      headerName: 'Request Title',
      field: 'title',
      flex: 2,
      minWidth: 220,
      filter: 'agSetColumnFilter',
      tooltipField: 'title',
      cellRenderer: (p: any) => (
        <span className="font-medium text-gray-900">{p.data?.title || '—'}</span>
      ),
    },
    {
      headerName: 'Requested By',
      field: 'requestedByUserId',
      flex: 1,
      minWidth: 140,
      filter: 'agSetColumnFilter',
      valueGetter: (p: any) => formatRequestedBy(p.data?.requestedByUserId),
    },
    {
      headerName: 'Date',
      field: 'submittedAt',
      flex: 0.8,
      minWidth: 120,
      filter: 'agDateColumnFilter',
      valueGetter: (p: any) => {
        const raw = p.data?.submittedAt || p.data?.createdAt;
        if (!raw) return null;
        const d = new Date(raw);
        return isNaN(d.getTime()) ? null : d;
      },
      valueFormatter: (p: any) => {
        if (!p.value) return '—';
        try {
          return (p.value as Date).toLocaleDateString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, ' ');
        } catch { return '—'; }
      },
      cellRenderer: (p: any) => {
        if (!p.value) return <span className="text-gray-500">—</span>;
        try {
          const label = (p.value as Date).toLocaleDateString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, ' ');
          return <span className="text-gray-700">{label}</span>;
        } catch { return <span className="text-gray-500">—</span>; }
      },
    },
    {
      headerName: 'Status',
      field: 'status',
      flex: 0.8,
      minWidth: 130,
      filter: 'agSetColumnFilter',
      valueGetter: (p: any) => {
        const st = p.data?.status;
        if (st === 'submitted') return 'Pending Approval';
        if (st === 'approved') return 'Approved';
        if (st === 'rejected') return 'Rejected';
        if (st === 'draft') return 'Draft';
        if (st === 'returned') return 'Returned';
        return st || '—';
      },
      cellRenderer: (p: any) => {
        const st = p.data?.status;
        if (st === 'submitted') return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-[#52BAF3] text-white">Pending Approval</span>;
        if (st === 'approved') return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-500 text-white">Approved</span>;
        if (st === 'rejected') return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-500 text-white">Rejected</span>;
        if (st === 'draft') return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-500 text-white">Draft</span>;
        if (st === 'returned') return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-500 text-white">Returned</span>;
        return <span className="text-gray-500">{st || '—'}</span>;
      },
    },
  ], []);

  return (
    <>
    <div className="space-y-4">
      {/* Header with Title, Centered Tabs, and Button */}
      <div className="flex items-center justify-between relative">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Modify PMS - Change Requests</h1>
        {!isVessel && (
          <Button 
            className="bg-[#5dc86f] hover:bg-[#4db85f] text-white px-6"
            onClick={() => setIsNewRequestModalOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Change Request
          </Button>
        )}
      </div>

      {/* Filters - Single Row */}
      <div className="flex items-center gap-3 flex-wrap">
        {(isSailAdmin || isClientAdmin) && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600">Vessel:</span>
            <Select value={(vesselId === 'all' || vesselId === 'my') ? '' : vesselId} onValueChange={setVesselId}>
              <SelectTrigger className="w-[200px]" data-testid="vessel-selector-modify">
                <SelectValue placeholder="Choose vessel" />
              </SelectTrigger>
              <SelectContent>
                {myVesselsEmpty ? (
                  <div className="px-2 py-1.5 text-sm text-gray-500" data-testid="select-no-assigned-vessels">
                    No assigned vessels
                  </div>
                ) : (
                  pickerVessels.map(vessel => (
                    <SelectItem key={vessel.id} value={vessel.id}>
                      {vessel.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        )}
        <PeriodFilter value={periodFilter} onChange={setPeriodFilter} className="w-[200px]" />
        <Button
          variant="outline"
          className="text-gray-600"
          onClick={() => setPeriodFilter(null)}
          data-testid="button-clear-filters-modify"
        >
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
          <div className="bg-white rounded-lg shadow-sm h-full overflow-hidden">
            <WOAgGridTable
              columnDefs={columnDefs}
              rowData={requests}
              height="100%"
              loading={isLoading}
              suppressRowClickSelection
              onRowClicked={(params) => { if (params.data) handleRowClick(params.data as ChangeRequest); }}
              noRowsMessage="No change requests found. Click 'New Change Request' to create one."
              testId="ag-grid-modify-pms"
            />
          </div>
        </div>
      </div>
    </div>

    {/* Change Request Modal */}
    <ChangeRequestModal
      open={isNewRequestModalOpen}
      onClose={() => setIsNewRequestModalOpen(false)}
    />

    {/* View Request Details Dialog */}
    <Dialog open={!!viewingRequest} onOpenChange={() => setViewingRequest(null)}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Change Request Details</DialogTitle>
          <DialogDescription>
            Review and manage this change request
          </DialogDescription>
        </DialogHeader>
        
        {viewingRequest && (
          <div className="space-y-6">
            {/* Rejection History — shown only when at least one prior rejection exists */}
            <RejectionHistorySection
              entityType="change-request"
              entityId={viewingRequest.id}
            />

            {/* Request Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-500">Title</Label>
                <p className="text-gray-900 font-medium">{viewingRequest.title}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Category</Label>
                <p className="text-gray-900 capitalize">{viewingRequest.category}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Requested By</Label>
                <p className="text-gray-900">{viewingRequest.requestedByUserId || '—'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Status</Label>
                <div className="mt-1">
                  {viewingRequest.status === 'submitted' && (
                    <Badge className="bg-[#52BAF3] text-white">Pending Approval</Badge>
                  )}
                  {viewingRequest.status === 'approved' && (
                    <Badge className="bg-green-500 text-white">Approved</Badge>
                  )}
                  {viewingRequest.status === 'rejected' && (
                    <Badge className="bg-red-500 text-white">Rejected</Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Reason */}
            <div>
              <Label className="text-sm font-medium text-gray-500">Reason</Label>
              <p className="text-gray-900 mt-1">{viewingRequest.reason || 'No reason provided'}</p>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-500">Created</Label>
                <p className="text-gray-900">{new Date(viewingRequest.createdAt).toLocaleDateString()}</p>
              </div>
              {viewingRequest.submittedAt && (
                <div>
                  <Label className="text-sm font-medium text-gray-500">Submitted</Label>
                  <p className="text-gray-900">{new Date(viewingRequest.submittedAt).toLocaleDateString()}</p>
                </div>
              )}
            </div>

            {/* Proposed Changes - Highlighted in Red */}
            <div className="border-t pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Eye className="w-5 h-5 text-red-600" />
                <Label className="text-base font-semibold text-gray-800">Changes Made</Label>
              </div>
              {viewingRequest.proposedChangesJson && Array.isArray(viewingRequest.proposedChangesJson) && viewingRequest.proposedChangesJson.length > 0 ? (
                <div className="space-y-3">
                  {viewingRequest.proposedChangesJson.map((change: any, index: number) => (
                    <div key={index} className="bg-red-50 p-4 rounded-lg border border-red-200">
                      <div className="mb-2">
                        <span className="font-semibold text-gray-800 text-sm uppercase tracking-wide">
                          {change.field || change.fieldName || change.label || `Field ${index + 1}`}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-xs text-gray-500 block mb-1">Previous Value</span>
                          <span className="text-gray-700 bg-white px-2 py-1 rounded border inline-block">
                            {change.oldValue !== undefined ? String(change.oldValue) : 
                             change.originalValue !== undefined ? String(change.originalValue) : 
                             change.previousValue !== undefined ? String(change.previousValue) : '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500 block mb-1">New Value</span>
                          <span className="text-red-600 font-bold bg-red-100 px-2 py-1 rounded border border-red-300 inline-block">
                            {change.newValue !== undefined ? String(change.newValue) : 
                             change.currentValue !== undefined ? String(change.currentValue) : 
                             change.proposedValue !== undefined ? String(change.proposedValue) : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-gray-500 text-center">
                  No specific field changes recorded for this request.
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="space-x-2">
          {/* View Changes Button - available for all requests */}
          {viewingRequest && (
            <Button
              variant="outline"
              className="border-blue-300 text-blue-600 hover:bg-blue-50"
              onClick={() => {
                if (viewingRequest) {
                  // Navigate to the appropriate module with change preview mode
                  const params = new URLSearchParams();
                  params.append('previewChanges', '1');
                  params.append('changeRequestId', viewingRequest.id.toString());
                  
                  if (viewingRequest.targetType && viewingRequest.targetId) {
                    params.append('targetType', viewingRequest.targetType);
                    params.append('targetId', viewingRequest.targetId);
                  }
                  
                  // Navigate based on category
                  let targetPath = '';
                  switch (viewingRequest.category) {
                    case 'components':
                      targetPath = '/pms/components';
                      break;
                    case 'workOrders':
                      targetPath = '/pms/work-orders';
                      break;
                    case 'spares':
                      targetPath = '/pms/spares';
                      break;
                    case 'stores':
                      targetPath = '/pms/stores';
                      break;
                    default:
                      targetPath = '/pms/components';
                  }
                  
                  setLocation(`${targetPath}?${params.toString()}`);
                  setViewingRequest(null);
                }
              }}
            >
              <Eye className="w-4 h-4 mr-2" />
              View Changes
            </Button>
          )}
          
          {viewingRequest && engineScreenId && (
            <ApprovalChainProgress screenId={engineScreenId} subjectRef={(viewingRequest as any)?.cruuid ?? null} />
          )}
          {viewingRequest && viewingRequest.status === 'submitted' && userCanAct && (
            <>
              <Button
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50"
                onClick={() => setReviewAction('reject')}
                data-testid="button-cr-reject"
              >
                <X className="w-4 h-4 mr-2" />
                Reject
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => setReviewAction('approve')}
                data-testid="button-cr-approve"
              >
                <Check className="w-4 h-4 mr-2" />
                Approve
              </Button>
            </>
          )}
          <Button variant="outline" onClick={() => setViewingRequest(null)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {reviewAction && viewingRequest && (
      <ApproveRejectModal
        open={!!reviewAction}
        onClose={() => setReviewAction(null)}
        requestId={viewingRequest.id}
        action={reviewAction}
        onProcessed={() => {
          setReviewAction(null);
          queryClient.refetchQueries({ queryKey: ['/technical/api/change-requests'] });
          setViewingRequest(null);
        }}
      />
    )}
    </>
  );
}