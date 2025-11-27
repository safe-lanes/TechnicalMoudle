import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Clock, Eye, Edit, Paperclip, Link, Trash2, Search, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import DefectFormExact from "./DefectFormExact";
import AddNoteModal from "./AddNoteModal";
import LinkDefectsModal from "./LinkDefectsModal";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { Defect } from "@shared/schema";

interface DefectsFilters {
  period?: string;
  search?: string;
  vesselId?: string;
  fleet?: string;
  addGroup?: string;
  dueOverdue?: string;
  type?: string;
}

export default function DefectsActive() {
  const { toast } = useToast();
  const [filters, setFilters] = useState<DefectsFilters>({});
  const [showNewDefectForm, setShowNewDefectForm] = useState(false);
  const [selectedDefect, setSelectedDefect] = useState<Defect | null>(null);
  const [defectFormMode, setDefectFormMode] = useState<'view' | 'edit' | 'new'>('new');
  const [activeTab, setActiveTab] = useState("Active");
  const [addNoteModal, setAddNoteModal] = useState<{ open: boolean; defectId: string | null }>({ open: false, defectId: null });
  const [linkModal, setLinkModal] = useState<{ open: boolean; defectId: string | null; linkedDefects: string[] }>({ open: false, defectId: null, linkedDefects: [] });

  // Get all defects to calculate counts and filter
  const { data: allDefects = [], isLoading } = useQuery({
    queryKey: ['/api/defects', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      
      if (filters.vesselId) params.append('vesselId', filters.vesselId);
      if (filters.type) params.append('category', filters.type);
      if (filters.search) params.append('search', filters.search);
      if (filters.period) params.append('period', filters.period);
      if (filters.fleet) params.append('fleet', filters.fleet);
      if (filters.addGroup) params.append('group', filters.addGroup);
      if (filters.dueOverdue) params.append('dueOverdue', filters.dueOverdue);
      
      const response = await fetch(`/api/defects?${params}`);
      if (!response.ok) throw new Error('Failed to fetch defects');
      return response.json();
    },
  });

  // Filter defects based on active tab
  const defects = allDefects.filter((defect: Defect) => {
    if (activeTab === "Active") {
      return ['Open', 'Pending', 'In-Progress', 'Awaiting Parts', 'Deferred'].includes(defect.status);
    } else {
      return ['Closed', 'Cancelled'].includes(defect.status);
    }
  });

  // Calculate counts for tabs
  const activeCount = allDefects.filter((d: Defect) => 
    ['Open', 'Pending', 'In-Progress', 'Awaiting Parts', 'Deferred'].includes(d.status)
  ).length;
  const resolvedCount = allDefects.filter((d: Defect) => 
    ['Closed', 'Cancelled'].includes(d.status)
  ).length;

  const getStatusBadge = (status: string, critical: boolean) => {
    const statusColors: Record<string, string> = {
      'Open': 'bg-red-100 text-red-700',
      'Pending': 'bg-yellow-100 text-yellow-700',
      'In-Progress': 'bg-blue-100 text-blue-700',
      'Awaiting Parts': 'bg-orange-100 text-orange-700',
      'Deferred': 'bg-gray-100 text-gray-700',
      'Closed': 'bg-green-100 text-green-700',
      'Cancelled': 'bg-gray-100 text-gray-700',
    };
    
    return (
      <Badge className={cn('text-xs', statusColors[status] || 'bg-gray-100 text-gray-700')}>
        {status}
      </Badge>
    );
  };

  const getDaysOverdue = (targetDate: string | null) => {
    if (!targetDate) return null;
    const target = new Date(targetDate);
    const today = new Date();
    const diffTime = today.getTime() - target.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const handleFilterChange = (key: keyof DefectsFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setFilters({});
  };

  const handleViewDefect = (defect: Defect) => {
    setSelectedDefect(defect);
    setDefectFormMode('view');
    setShowNewDefectForm(true);
  };

  const handleEditDefect = (defect: Defect) => {
    setSelectedDefect(defect);
    setDefectFormMode('edit');
    setShowNewDefectForm(true);
  };

  const handleNewDefect = () => {
    setSelectedDefect(null);
    setDefectFormMode('new');
    setShowNewDefectForm(true);
  };

  // Mutation for closing defects
  const closeDefectMutation = useMutation({
    mutationFn: async (defectId: string) => {
      const response = await fetch(`/api/defects/${defectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Closed', dateCompleted: new Date().toISOString().split('T')[0] })
      });
      if (!response.ok) throw new Error('Failed to close defect');
      return response.json();
    },
    onSuccess: (data, defectId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/defects'] });
      
      // Show success toast with action to view in Resolved tab
      toast({
        title: "Defect Closed Successfully",
        description: `Defect ${defectId} has been closed and moved to the Resolved tab.`,
        action: (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setActiveTab("Resolved")}
          >
            View in Resolved
          </Button>
        ),
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to close the defect. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleCloseDefect = (defectId: string) => {
    if (confirm('Are you sure you want to close this defect?')) {
      closeDefectMutation.mutate(defectId);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Active Badge */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                Active Defects
              </h1>
            </div>

            <div className="flex items-center space-x-3">
              <Button variant="outline" size="sm" className="text-gray-600">
                All Vessel
              </Button>
              <Button variant="outline" size="sm" className="text-gray-600">
                My Vessel
              </Button>
              <Button variant="outline" size="sm" className="text-gray-600">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 border border-gray-400"></div>
                  Filters
                </div>
              </Button>
              <Dialog open={showNewDefectForm} onOpenChange={setShowNewDefectForm}>
                <DialogTrigger asChild>
                  <Button 
                    className="bg-green-600 hover:bg-green-700 text-white" 
                    size="sm" 
                    data-testid="button-new-defect"
                    onClick={handleNewDefect}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    New Defect
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto p-0">
                  <DefectFormExact 
                    onClose={() => {
                      setShowNewDefectForm(false);
                      setSelectedDefect(null);
                    }}
                    defect={selectedDefect}
                    mode={defectFormMode}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
        
        {/* Status Tabs */}
        <div className="flex items-center gap-1 px-6 pb-2">
          <button
            onClick={() => setActiveTab("Active")}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              activeTab === "Active"
                ? "bg-[#52baf3] text-white"
                : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-300"
            }`}
            data-testid="tab-active-defects"
          >
            Active Defects
            {activeCount > 0 && (
              <span className="ml-2 px-1.5 py-0.5 bg-red-500 text-white rounded-full text-xs">
                {activeCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("Resolved")}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              activeTab === "Resolved"
                ? "bg-[#52baf3] text-white"
                : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-300"
            }`}
            data-testid="tab-resolved-defects"
          >
            Resolved Defects
            {resolvedCount > 0 && (
              <span className="ml-2 px-1.5 py-0.5 bg-red-500 text-white rounded-full text-xs">
                {resolvedCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Filter Controls - Include Closed is disabled */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Period */}
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" />
              <Select value={filters.period} onValueChange={(value) => handleFilterChange('period', value)}>
                <SelectTrigger className="w-24 h-8 text-xs">
                  <SelectValue placeholder="Period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <Input
              placeholder="Search Defect"
              value={filters.search || ""}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="w-36 h-8 text-xs"
            />

            {/* Vessel */}
            <Select value={filters.vesselId} onValueChange={(value) => handleFilterChange('vesselId', value)}>
              <SelectTrigger className="w-24 h-8 text-xs">
                <SelectValue placeholder="Vessel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="V001">Vessel 1</SelectItem>
                <SelectItem value="V002">Vessel 2</SelectItem>
              </SelectContent>
            </Select>

            {/* Fleet */}
            <Select value={filters.fleet} onValueChange={(value) => handleFilterChange('fleet', value)}>
              <SelectTrigger className="w-20 h-8 text-xs">
                <SelectValue placeholder="Fleet" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fleet1">Fleet 1</SelectItem>
                <SelectItem value="fleet2">Fleet 2</SelectItem>
              </SelectContent>
            </Select>

            {/* Due/Overdue */}
            <Select value={filters.dueOverdue} onValueChange={(value) => handleFilterChange('dueOverdue', value)}>
              <SelectTrigger className="w-28 h-8 text-xs">
                <SelectValue placeholder="Due / Overdue" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="due">Due Soon</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>

            {/* Type */}
            <Select value={filters.type} onValueChange={(value) => handleFilterChange('type', value)}>
              <SelectTrigger className="w-20 h-8 text-xs">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Defect">Defect</SelectItem>
                <SelectItem value="COC">COC</SelectItem>
                <SelectItem value="Observation">Observation</SelectItem>
                <SelectItem value="NCR">NCR</SelectItem>
              </SelectContent>
            </Select>

            {/* Include Closed - DISABLED for Active view */}
            <div className="flex items-center gap-2 opacity-50 cursor-not-allowed">
              <Checkbox 
                disabled
                checked={false}
                className="h-3 w-3" 
              />
              <span className="text-xs text-gray-500">Include Closed Defects</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs px-3">
              Apply
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 text-xs px-3"
              onClick={handleClearFilters}
            >
              Clear
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="p-6">
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Loading active defects...</div>
        ) : defects.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm">
            <AlertTriangle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No active defects match your filters</p>
            <div className="flex gap-2 justify-center">
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleClearFilters}
              >
                Clear Filters
              </Button>
              <Button 
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => setShowNewDefectForm(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                New Defect
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="w-24">ID</TableHead>
                  <TableHead className="w-32">Vessel</TableHead>
                  <TableHead className="w-28">Issue Date</TableHead>
                  <TableHead className="w-24">Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Action Taken/Requested</TableHead>
                  <TableHead className="w-28">Target Date</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {defects.map((defect: Defect) => {
                  const daysOverdue = getDaysOverdue(defect.targetCloseDate);
                  const isOverdue = daysOverdue !== null && daysOverdue > 0;
                  
                  return (
                    <TableRow key={defect.id} className={isOverdue ? 'bg-red-50' : ''}>
                      <TableCell className="font-medium text-xs">
                        <div className="flex items-center gap-2">
                          {defect.critical && <AlertTriangle className="h-3 w-3 text-red-600" />}
                          {defect.id}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{defect.vesselName}</TableCell>
                      <TableCell className="text-xs">{defect.issueDate}</TableCell>
                      <TableCell className="text-xs">
                        <div className="flex items-center gap-2">
                          {defect.category}
                          {defect.is_coc && (
                            <Badge className="bg-blue-100 text-blue-700 text-xs py-0 px-1">
                              CoC
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs max-w-xs truncate">{defect.description}</TableCell>
                      <TableCell className="text-xs max-w-xs truncate">{defect.actionTakenRequested}</TableCell>
                      <TableCell className="text-xs">
                        <div className="flex items-center gap-1">
                          {defect.targetCloseDate}
                          {isOverdue && (
                            <span className="text-red-600 text-xs" title={`Overdue by ${daysOverdue} days`}>
                              <Clock className="h-3 w-3" />
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(defect.status, defect.critical)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 w-7 p-0"
                            title="View"
                            onClick={() => handleViewDefect(defect)}
                            data-testid={`button-view-${defect.id}`}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 w-7 p-0"
                            title="Edit"
                            onClick={() => handleEditDefect(defect)}
                            data-testid={`button-edit-${defect.id}`}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 w-7 p-0"
                            title="Add Note"
                            onClick={() => setAddNoteModal({ open: true, defectId: defect.id })}
                            data-testid={`button-note-${defect.id}`}
                          >
                            <Paperclip className="h-3 w-3" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 w-7 p-0"
                            title="Link"
                            onClick={() => setLinkModal({ open: true, defectId: defect.id, linkedDefects: defect.linkedDefects || [] })}
                            data-testid={`button-link-${defect.id}`}
                          >
                            <Link className="h-3 w-3" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 w-7 p-0 text-green-600"
                            title="Close/Complete"
                            onClick={() => handleCloseDefect(defect.id)}
                            data-testid={`button-close-${defect.id}`}
                          >
                            <CheckCircle className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Pagination */}
            <div className="px-4 py-3 border-t bg-gray-50">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-700">
                  0 to 0 of {defects.length}
                </span>
                <span className="text-xs text-gray-500">
                  Page 0 of 1
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Note Modal */}
      {addNoteModal.defectId && (
        <AddNoteModal
          open={addNoteModal.open}
          onClose={() => setAddNoteModal({ open: false, defectId: null })}
          defectId={addNoteModal.defectId}
        />
      )}

      {/* Link Defects Modal */}
      {linkModal.defectId && (
        <LinkDefectsModal
          open={linkModal.open}
          onClose={() => setLinkModal({ open: false, defectId: null, linkedDefects: [] })}
          defectId={linkModal.defectId}
          currentLinkedDefects={linkModal.linkedDefects}
        />
      )}
    </div>
  );
}