import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Wrench, Package, FileText, Archive, ArrowLeft, Eye, Check, X, Search, Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { ChangeRequestModal } from '@/components/modify/ChangeRequestModal';

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
}

export function ModifyPMS() {
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewRequestModalOpen, setIsNewRequestModalOpen] = useState(false);
  const [viewingRequest, setViewingRequest] = useState<ChangeRequest | null>(null);
  const [location, setLocation] = useLocation();
  const { toast } = useToast();

  // Fetch change requests
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['/api/change-requests', categoryFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('vesselId', 'V001');
      
      if (categoryFilter !== 'all') {
        params.append('category', categoryFilter);
      }
      
      const response = await fetch(`/api/change-requests?${params}`);
      if (!response.ok) throw new Error('Failed to fetch requests');
      return response.json();
    }
  });

  // Filter requests based on search query
  const filteredRequests = requests.filter((request: ChangeRequest) =>
    request.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    request.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async ({ id, comment }: { id: number; comment: string }) => {
      const response = await fetch(`/api/change-requests/${id}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment, reviewerId: 'current_user' })
      });
      if (!response.ok) throw new Error('Failed to approve request');
      return response.json();
    },
    onMutate: async ({ id }) => {
      // Optimistically update the UI immediately
      if (viewingRequest) {
        setViewingRequest({ ...viewingRequest, status: 'approved' });
      }
    },
    onSuccess: (updatedRequest) => {
      // Invalidate both list queries and individual request query
      queryClient.invalidateQueries({ queryKey: ['/api/change-requests'] });
      if (viewingRequest) {
        queryClient.invalidateQueries({ queryKey: [`/api/change-requests/${viewingRequest.id}`] });
      }
      
      // Force refetch to ensure UI updates immediately
      queryClient.refetchQueries({ queryKey: ['/api/change-requests', categoryFilter] });
      
      setViewingRequest(null);
      toast({
        title: "Request approved",
        description: "The change request has been approved successfully"
      });
    }
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ id, comment }: { id: number; comment: string }) => {
      const response = await fetch(`/api/change-requests/${id}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment, reviewerId: 'current_user' })
      });
      if (!response.ok) throw new Error('Failed to reject request');
      return response.json();
    },
    onMutate: async ({ id }) => {
      // Optimistically update the UI immediately
      if (viewingRequest) {
        setViewingRequest({ ...viewingRequest, status: 'rejected' });
      }
    },
    onSuccess: (updatedRequest) => {
      // Invalidate both list queries and individual request query
      queryClient.invalidateQueries({ queryKey: ['/api/change-requests'] });
      if (viewingRequest) {
        queryClient.invalidateQueries({ queryKey: [`/api/change-requests/${viewingRequest.id}`] });
      }
      
      // Force refetch to ensure UI updates immediately
      queryClient.refetchQueries({ queryKey: ['/api/change-requests', categoryFilter] });
      
      setViewingRequest(null);
      toast({
        title: "Request rejected",
        description: "The change request has been rejected"
      });
    }
  });

  const handleRowClick = (request: ChangeRequest) => {
    setViewingRequest(request);
  };

  return (
    <>
    <div className="flex h-screen bg-gray-100">
      {/* Left Sidebar - Blue Background */}
      <div className="w-64 bg-[#52BAF3] text-white">
        <div className="p-4">
          <div className="bg-[#40a8e0] px-4 py-3 rounded-t-lg">
            <h2 className="text-white font-medium">Category</h2>
          </div>
          <div className="bg-white rounded-b-lg">
            <div className="p-4 space-y-1">
              <button
                onClick={() => setCategoryFilter('components')}
                className={`w-full text-left px-3 py-2 text-sm rounded transition-colors ${
                  categoryFilter === 'components'
                    ? 'bg-[#52BAF3] text-white font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                1. Components
              </button>
              <button
                onClick={() => setCategoryFilter('jobs')}
                className={`w-full text-left px-3 py-2 text-sm rounded transition-colors ${
                  categoryFilter === 'jobs'
                    ? 'bg-[#52BAF3] text-white font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                2. Jobs
              </button>
              <button
                onClick={() => setCategoryFilter('spares')}
                className={`w-full text-left px-3 py-2 text-sm rounded transition-colors ${
                  categoryFilter === 'spares'
                    ? 'bg-[#52BAF3] text-white font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                3. Spares
              </button>
              <button
                onClick={() => setCategoryFilter('stores')}
                className={`w-full text-left px-3 py-2 text-sm rounded transition-colors ${
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
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Modify PMS - Change Requests</h1>
          
          <div className="flex justify-between items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search Status"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-80 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <Button 
              className="bg-[#52BAF3] hover:bg-[#40a8e0] text-white px-6"
              onClick={() => setIsNewRequestModalOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Change Request
            </Button>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 p-6">
          <div className="bg-white rounded-lg border border-gray-200 h-full">
            {isLoading ? (
              <div className="text-center py-12 text-gray-500">Loading...</div>
            ) : filteredRequests.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No change requests found. Click "New Change Request" to create one.
              </div>
            ) : (
              <div className="h-full flex flex-col">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#52BAF3] hover:bg-[#52BAF3] border-b-0">
                      <TableHead className="text-white font-medium py-4 px-6">Request Title</TableHead>
                      <TableHead className="text-white font-medium py-4 px-6">Requested By</TableHead>
                      <TableHead className="text-white font-medium py-4 px-6">Date</TableHead>
                      <TableHead className="text-white font-medium py-4 px-6">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests.map((request: ChangeRequest) => (
                      <TableRow 
                        key={request.id} 
                        className="border-b border-gray-200 hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleRowClick(request)}
                      >
                        <TableCell className="py-4 px-6">
                          <div className="font-medium text-gray-900">{request.title}</div>
                        </TableCell>
                        <TableCell className="py-4 px-6 text-gray-700">
                          {request.requestedByUserId === 'current_user' ? 'Chief Engineer' : 
                           request.requestedByUserId === '2nd_engineer' ? '2nd Engineer' : 
                           request.requestedByUserId === '3rd_engineer' ? '3rd Engineer' : 
                           request.requestedByUserId}
                        </TableCell>
                        <TableCell className="py-4 px-6 text-gray-700">
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
                        <TableCell className="py-4 px-6">
                          {request.status === 'submitted' && (
                            <Badge className="bg-[#52BAF3] text-white px-3 py-1 text-xs rounded-full">
                              Pending Approval
                            </Badge>
                          )}
                          {request.status === 'approved' && (
                            <Badge className="bg-green-500 text-white px-3 py-1 text-xs rounded-full">
                              Approved
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
                  {filteredRequests.length > 0 ? `0 to ${filteredRequests.length} of ${filteredRequests.length}` : '0 to 0 of 0'}
                </div>
              </div>
            )}
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
                <p className="text-gray-900">{viewingRequest.requestedByUserId === 'current_user' ? 'Chief Engineer' : viewingRequest.requestedByUserId}</p>
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

            {/* Proposed Changes */}
            {viewingRequest.proposedChangesJson && Array.isArray(viewingRequest.proposedChangesJson) && viewingRequest.proposedChangesJson.length > 0 && (
              <div>
                <Label className="text-sm font-medium text-gray-500">Proposed Changes</Label>
                <div className="mt-2 space-y-2">
                  {viewingRequest.proposedChangesJson.map((change: any, index: number) => (
                    <div key={index} className="bg-blue-50 p-3 rounded-lg border">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-700">{change.field || change.fieldName}</span>
                        <div className="flex items-center space-x-2 text-sm">
                          <span className="text-gray-600">"{change.oldValue || change.originalValue}"</span>
                          <span className="text-gray-400">→</span>
                          <span className="text-blue-600 font-medium">"{change.newValue || change.currentValue}"</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
          
          {viewingRequest && viewingRequest.status === 'submitted' && (
            <>
              <Button
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50"
                onClick={() => {
                  if (viewingRequest) {
                    rejectMutation.mutate({
                      id: viewingRequest.id,
                      comment: 'Request rejected'
                    });
                  }
                }}
                disabled={rejectMutation.isPending}
              >
                <X className="w-4 h-4 mr-2" />
                Reject
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => {
                  if (viewingRequest) {
                    approveMutation.mutate({
                      id: viewingRequest.id,
                      comment: 'Request approved'
                    });
                  }
                }}
                disabled={approveMutation.isPending}
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
    </>
  );
}