import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  GitPullRequest,
  CheckCircle, 
  Clock, 
  Eye, 
  Edit, 
  MessageSquare,
  Link, 
  Check, 
  Search, 
  Plus,
  X,
  RotateCcw
} from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ChangeRequestFormExact from "./ChangeRequestFormExact";
import ViewChangeRequestModal from "./ViewChangeRequestModal";
import EditChangeRequestModal from "./EditChangeRequestModal";
import AddCommentModal from "./AddCommentModal";
import ApproveRejectModal from "./ApproveRejectModal";
import { cn } from "@/lib/utils";
import type { ChangeRequest } from "@shared/schema";

interface ChangeRequestFilters {
  period?: string;
  search?: string;
  vesselId?: string;
  category?: string;
  requestedBy?: string;
}

// Mock user role for permissions - in a real app, get from auth context
const CURRENT_USER_ROLE = "Admin"; // Can be: "Viewer", "Requestor", "Reviewer", "Admin"

export default function ChangeRequestsLogWithTabs() {
  const [activeTab, setActiveTab] = useState<'draft' | 'submitted' | 'approved' | 'rejected'>('draft');
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<ChangeRequestFilters>({});
  const [showNewChangeRequestForm, setShowNewChangeRequestForm] = useState(false);
  const [selectedRequests, setSelectedRequests] = useState<Set<number>>(new Set());
  
  // Modal states
  const [viewModal, setViewModal] = useState<{ open: boolean; requestId: number | null }>({ 
    open: false, 
    requestId: null 
  });
  const [editModal, setEditModal] = useState<{ open: boolean; requestId: number | null }>({ 
    open: false, 
    requestId: null 
  });
  const [commentModal, setCommentModal] = useState<{ open: boolean; requestId: number | null }>({ 
    open: false, 
    requestId: null 
  });
  const [approveRejectModal, setApproveRejectModal] = useState<{ 
    open: boolean; 
    requestId: number | null;
    action: 'approve' | 'reject' | 'return' | null;
  }>({ 
    open: false, 
    requestId: null,
    action: null
  });
  
  // Fetch change requests with filters
  const { data: changeRequests, isLoading, refetch } = useQuery<ChangeRequest[]>({
    queryKey: ['/technical/api/change-requests', activeTab, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      
      // Add status filter based on active tab
      let statusFilter = '';
      switch (activeTab) {
        case 'draft':
          statusFilter = 'draft';
          break;
        case 'submitted':
          statusFilter = 'submitted';
          break;
        case 'approved':
          statusFilter = 'approved';
          break;
        case 'rejected':
          statusFilter = 'rejected';
          break;
      }
      
      if (statusFilter) params.append('status', statusFilter);
      if (filters.vesselId) params.append('vesselId', filters.vesselId);
      if (filters.category) params.append('category', filters.category);
      if (filters.requestedBy) params.append('requestedBy', filters.requestedBy);
      if (filters.search) params.append('search', filters.search);
      
      const response = await fetch(`/technical/api/change-requests?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch change requests');
      return response.json();
    }
  });

  // Handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value as typeof activeTab);
    setSelectedRequests(new Set());
    setPage(1);
  };

  // Handle view action
  const handleView = (requestId: number) => {
    setViewModal({ open: true, requestId });
  };

  // Handle edit action
  const handleEdit = (requestId: number) => {
    setEditModal({ open: true, requestId });
  };

  // Handle add comment action
  const handleAddComment = (requestId: number) => {
    setCommentModal({ open: true, requestId });
  };

  // Handle approve/reject/return actions
  const handleWorkflowAction = (requestId: number, action: 'approve' | 'reject' | 'return') => {
    setApproveRejectModal({ open: true, requestId, action });
  };

  // Handle request approved/rejected/returned
  const handleRequestProcessed = () => {
    refetch();
    setApproveRejectModal({ open: false, requestId: null, action: null });
  };

  // Permission checks
  const canEdit = (request: ChangeRequest) => {
    if (CURRENT_USER_ROLE === "Admin") return true;
    if (request.status === 'draft' && CURRENT_USER_ROLE === "Requestor") return true;
    return false;
  };

  const canApproveReject = () => {
    return CURRENT_USER_ROLE === "Admin" || CURRENT_USER_ROLE === "Reviewer";
  };

  // Get status badge
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

  // Get category badge
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

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return '-';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString();
  };

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-2xl font-bold flex items-center gap-2">
              <GitPullRequest className="w-6 h-6 text-blue-600" />
              Change Requests Log
            </CardTitle>
            <Button
              onClick={() => setShowNewChangeRequestForm(true)}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="button-new-change-request"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Change Request
            </Button>
          </div>
          
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search by title or description..."
                value={filters.search || ''}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="pl-9"
                data-testid="input-search"
              />
            </div>
            
            <Select 
              value={filters.vesselId || ''} 
              onValueChange={(value) => setFilters({ ...filters, vesselId: value || undefined })}
            >
              <SelectTrigger data-testid="select-vessel">
                <SelectValue placeholder="All Vessels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Vessels</SelectItem>
                <SelectItem value="V001">MV SEAFARER</SelectItem>
                <SelectItem value="V002">MV VOYAGER</SelectItem>
                <SelectItem value="V003">MV EXPLORER</SelectItem>
              </SelectContent>
            </Select>

            <Select 
              value={filters.category || ''} 
              onValueChange={(value) => setFilters({ ...filters, category: value || undefined })}
            >
              <SelectTrigger data-testid="select-category">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Categories</SelectItem>
                <SelectItem value="components">Components</SelectItem>
                <SelectItem value="work_orders">Work Orders</SelectItem>
                <SelectItem value="spares">Spares</SelectItem>
                <SelectItem value="stores">Stores</SelectItem>
              </SelectContent>
            </Select>

            <Select 
              value={filters.period || ''} 
              onValueChange={(value) => setFilters({ ...filters, period: value || undefined })}
            >
              <SelectTrigger data-testid="select-period">
                <SelectValue placeholder="All Time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="quarter">This Quarter</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={() => setFilters({})}
              className="border-gray-300"
              data-testid="button-clear-filters"
            >
              Clear Filters
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="draft" className="data-[state=active]:bg-gray-100">
                Draft
                {changeRequests?.filter(r => r.status === 'draft').length ? (
                  <Badge variant="secondary" className="ml-2">
                    {changeRequests.filter(r => r.status === 'draft').length}
                  </Badge>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="submitted" className="data-[state=active]:bg-blue-50">
                Submitted
                {changeRequests?.filter(r => r.status === 'submitted').length ? (
                  <Badge variant="default" className="ml-2 bg-blue-600">
                    {changeRequests.filter(r => r.status === 'submitted').length}
                  </Badge>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="approved" className="data-[state=active]:bg-green-50">
                Approved
                {changeRequests?.filter(r => r.status === 'approved').length ? (
                  <Badge variant="default" className="ml-2 bg-green-600">
                    {changeRequests.filter(r => r.status === 'approved').length}
                  </Badge>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="rejected" className="data-[state=active]:bg-red-50">
                Rejected
                {changeRequests?.filter(r => r.status === 'rejected').length ? (
                  <Badge variant="destructive" className="ml-2">
                    {changeRequests.filter(r => r.status === 'rejected').length}
                  </Badge>
                ) : null}
              </TabsTrigger>
            </TabsList>

            {/* Table Content */}
            <TabsContent value={activeTab} className="mt-0">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="w-12">
                          <Checkbox 
                            checked={selectedRequests.size === changeRequests?.length && changeRequests.length > 0}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedRequests(new Set(changeRequests?.map(r => r.id) || []));
                              } else {
                                setSelectedRequests(new Set());
                              }
                            }}
                            data-testid="checkbox-select-all"
                          />
                        </TableHead>
                        <TableHead>Request ID</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Requested By</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {changeRequests?.map((request) => (
                        <TableRow 
                          key={request.id}
                          className={cn(
                            "hover:bg-gray-50 cursor-pointer",
                            selectedRequests.has(request.id) && "bg-blue-50"
                          )}
                          data-testid={`row-change-request-${request.id}`}
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedRequests.has(request.id)}
                              onCheckedChange={(checked) => {
                                const newSelected = new Set(selectedRequests);
                                if (checked) {
                                  newSelected.add(request.id);
                                } else {
                                  newSelected.delete(request.id);
                                }
                                setSelectedRequests(newSelected);
                              }}
                              data-testid={`checkbox-select-${request.id}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            CR-{String(request.id).padStart(4, '0')}
                          </TableCell>
                          <TableCell>
                            <div className="max-w-xs truncate" title={request.title}>
                              {request.title}
                            </div>
                          </TableCell>
                          <TableCell>
                            {getCategoryBadge(request.category)}
                          </TableCell>
                          <TableCell>
                            {request.targetId ? (
                              <span className="text-sm text-gray-600">
                                {request.targetType}: {request.targetId}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(request.status)}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{request.requestedByUserId}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{formatDate(request.createdAt)}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleView(request.id)}
                                      className="h-8 w-8"
                                      data-testid={`button-view-${request.id}`}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>View Details</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>

                              {canEdit(request) && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleEdit(request.id)}
                                        className="h-8 w-8"
                                        data-testid={`button-edit-${request.id}`}
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Edit Request</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}

                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleAddComment(request.id)}
                                      className="h-8 w-8"
                                      data-testid={`button-comment-${request.id}`}
                                    >
                                      <MessageSquare className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Add Comment</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>

                              {request.status === 'submitted' && canApproveReject() && (
                                <>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => handleWorkflowAction(request.id, 'approve')}
                                          className="h-8 w-8 text-green-600 hover:text-green-700"
                                          data-testid={`button-approve-${request.id}`}
                                        >
                                          <CheckCircle className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Approve Request</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>

                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => handleWorkflowAction(request.id, 'reject')}
                                          className="h-8 w-8 text-red-600 hover:text-red-700"
                                          data-testid={`button-reject-${request.id}`}
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Reject Request</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>

                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => handleWorkflowAction(request.id, 'return')}
                                          className="h-8 w-8 text-yellow-600 hover:text-yellow-700"
                                          data-testid={`button-return-${request.id}`}
                                        >
                                          <RotateCcw className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Return for Changes</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {changeRequests?.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                            No change requests found in {activeTab} status
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Modals */}
      {showNewChangeRequestForm && (
        <ChangeRequestFormExact
          onClose={() => {
            setShowNewChangeRequestForm(false);
            refetch();
          }}
        />
      )}

      {viewModal.requestId && (
        <ViewChangeRequestModal
          open={viewModal.open}
          onClose={() => setViewModal({ open: false, requestId: null })}
          requestId={viewModal.requestId}
        />
      )}

      {editModal.requestId && (
        <EditChangeRequestModal
          open={editModal.open}
          onClose={() => {
            setEditModal({ open: false, requestId: null });
            refetch();
          }}
          requestId={editModal.requestId}
        />
      )}

      {commentModal.requestId && (
        <AddCommentModal
          open={commentModal.open}
          onClose={() => {
            setCommentModal({ open: false, requestId: null });
            refetch();
          }}
          requestId={commentModal.requestId}
        />
      )}

      {approveRejectModal.requestId && approveRejectModal.action && (
        <ApproveRejectModal
          open={approveRejectModal.open}
          onClose={() => setApproveRejectModal({ open: false, requestId: null, action: null })}
          requestId={approveRejectModal.requestId}
          action={approveRejectModal.action}
          onProcessed={handleRequestProcessed}
        />
      )}
    </div>
  );
}