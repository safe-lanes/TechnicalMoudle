import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Clock, Eye, Edit, Paperclip, Link, Plus, Shield } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import DefectFormExact from "./DefectFormExact";
import DefectFormWizard from "./DefectFormWizard";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { Defect } from "@shared/schema";

interface DefectsFilters {
  period?: string;
  search?: string;
  vesselId?: string;
  fleet?: string;
  dueOverdue?: string;
}

export default function DefectsCoC() {
  const { toast } = useToast();
  const [filters, setFilters] = useState<DefectsFilters>({});
  const [showNewDefectForm, setShowNewDefectForm] = useState(false);
  const [selectedDefect, setSelectedDefect] = useState<Defect | null>(null);
  const [defectFormMode, setDefectFormMode] = useState<'view' | 'edit' | 'new'>('new');
  const [activeTab, setActiveTab] = useState("Active");
  const [closeModal, setCloseModal] = useState<{ open: boolean; defect: Defect | null }>({ 
    open: false, 
    defect: null 
  });

  // Get CoC defects only
  const { data: allDefects = [], isLoading } = useQuery({
    queryKey: ['/api/defects', { ...filters, is_coc: true }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('is_coc', 'true'); // Filter for CoC defects only
      
      if (filters.vesselId) params.append('vesselId', filters.vesselId);
      if (filters.search) params.append('search', filters.search);
      if (filters.period) params.append('period', filters.period);
      if (filters.fleet) params.append('fleet', filters.fleet);
      if (filters.dueOverdue) params.append('dueOverdue', filters.dueOverdue);
      
      const response = await fetch(`/api/defects?${params}`);
      if (!response.ok) throw new Error('Failed to fetch CoC defects');
      return response.json();
    },
  });

  // Filter defects based on active/resolved tab
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

  const getCompletionStatus = (targetDate: string | null, dateCompleted: string | null) => {
    if (!targetDate || !dateCompleted) return null;
    const target = new Date(targetDate);
    const completed = new Date(dateCompleted);
    const diffTime = completed.getTime() - target.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) {
      return <span className="text-green-600 text-xs">On Time</span>;
    } else {
      return <span className="text-red-600 text-xs">Late ({diffDays} days)</span>;
    }
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

  const handleCloseDefect = (defectId: string) => {
    // Find the defect in the current list
    const defect = defects.find((d: Defect) => d.id === defectId);
    if (defect) {
      setCloseModal({ open: true, defect });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with CoC Badge */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600" />
                Condition of Class (CoC) Defects
                <Badge className="bg-blue-100 text-blue-700">
                  Classification Required
                </Badge>
              </h1>
            </div>

            <div className="flex items-center space-x-3">
              <Button variant="outline" size="sm" className="text-gray-600">
                All Vessel
              </Button>
              <Button variant="outline" size="sm" className="text-gray-600">
                My Vessel
              </Button>
              <Dialog open={showNewDefectForm} onOpenChange={setShowNewDefectForm}>
                <DialogTrigger asChild>
                  <Button 
                    className="bg-green-600 hover:bg-green-700 text-white" 
                    size="sm" 
                    data-testid="button-new-coc-defect"
                    onClick={handleNewDefect}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    New CoC Defect
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto p-0">
                  <DefectFormExact 
                    onClose={() => {
                      setShowNewDefectForm(false);
                      setSelectedDefect(null);
                      // Invalidate both general and CoC-specific queries
                      queryClient.invalidateQueries({ queryKey: ['/api/defects'] });
                      queryClient.invalidateQueries({ 
                        predicate: (query) => {
                          const queryKey = query.queryKey;
                          return Array.isArray(queryKey) && 
                                 queryKey[0] === '/api/defects' && 
                                 queryKey[1] && 
                                 typeof queryKey[1] === 'object' && 
                                 'is_coc' in queryKey[1];
                        }
                      });
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
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-t-lg transition-colors",
              activeTab === "Active" 
                ? "bg-blue-600 text-white" 
                : "text-gray-600 hover:text-gray-900"
            )}
            data-testid="tab-active-coc"
          >
            Active CoC ({activeCount})
          </button>
          <button
            onClick={() => setActiveTab("Resolved")}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-t-lg transition-colors",
              activeTab === "Resolved" 
                ? "bg-green-600 text-white" 
                : "text-gray-600 hover:text-gray-900"
            )}
            data-testid="tab-resolved-coc"
          >
            Resolved CoC ({resolvedCount})
          </button>
        </div>
      </div>

      {/* Filter Controls */}
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
              placeholder="Search CoC Defect"
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

            {/* Due/Overdue - Only show for Active tab */}
            {activeTab === "Active" && (
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
            )}
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
          <div className="text-center py-12 text-gray-500">Loading CoC defects...</div>
        ) : defects.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm">
            <Shield className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">
              No {activeTab.toLowerCase()} CoC defects found
            </p>
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
                New CoC Defect
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
                  {activeTab === "Resolved" && (
                    <TableHead className="w-32">Date Completed</TableHead>
                  )}
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {defects.map((defect: Defect) => {
                  const daysOverdue = getDaysOverdue(defect.targetCloseDate);
                  const isOverdue = activeTab === "Active" && daysOverdue !== null && daysOverdue > 0;
                  
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
                          <Badge className="bg-blue-100 text-blue-700 text-xs py-0 px-1">
                            CoC
                          </Badge>
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
                      {activeTab === "Resolved" && (
                        <TableCell className="text-xs">
                          <div className="flex flex-col">
                            <span>{defect.dateCompleted}</span>
                            {getCompletionStatus(defect.targetCloseDate, defect.dateCompleted)}
                          </div>
                        </TableCell>
                      )}
                      <TableCell>{getStatusBadge(defect.status, defect.critical)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 w-7 p-0"
                            title="View"
                            onClick={() => handleViewDefect(defect)}
                            data-testid={`button-view-coc-${defect.id}`}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          {activeTab === "Active" && (
                            <>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-7 w-7 p-0"
                                title="Edit"
                                onClick={() => handleEditDefect(defect)}
                                data-testid={`button-edit-coc-${defect.id}`}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-7 w-7 p-0"
                                title="Add Note"
                                onClick={() => alert('Add Note feature coming soon')}
                                data-testid={`button-note-coc-${defect.id}`}
                              >
                                <Paperclip className="h-3 w-3" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-7 w-7 p-0"
                                title="Link"
                                onClick={() => alert('Link feature coming soon')}
                                data-testid={`button-link-coc-${defect.id}`}
                              >
                                <Link className="h-3 w-3" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-7 w-7 p-0 text-green-600"
                                title="Close/Complete"
                                onClick={() => handleCloseDefect(defect.id)}
                                data-testid={`button-close-coc-${defect.id}`}
                              >
                                <CheckCircle className="h-3 w-3" />
                              </Button>
                            </>
                          )}
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
                  Showing {defects.length} CoC defects
                </span>
                <span className="text-xs text-gray-500">
                  Page 1 of 1
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Close Defect Modal */}
      {closeModal.defect && (
        <Dialog 
          open={closeModal.open} 
          onOpenChange={(open) => {
            if (!open) {
              setCloseModal({ open: false, defect: null });
              // Refresh the CoC-specific query to ensure the page updates
              queryClient.invalidateQueries({ 
                predicate: (query) => {
                  const queryKey = query.queryKey;
                  return Array.isArray(queryKey) && 
                         queryKey[0] === '/api/defects' && 
                         queryKey[1] && 
                         typeof queryKey[1] === 'object' && 
                         'is_coc' in queryKey[1];
                }
              });
            }
          }}
        >
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto p-0">
            <DefectFormWizard
              defect={closeModal.defect}
              mode="edit"
              initialStep={3}
              onCompleted={() => {
                setCloseModal({ open: false, defect: null });
                // Refresh the CoC-specific query
                queryClient.invalidateQueries({ 
                  predicate: (query) => {
                    const queryKey = query.queryKey;
                    return Array.isArray(queryKey) && 
                           queryKey[0] === '/api/defects' && 
                           queryKey[1] && 
                           typeof queryKey[1] === 'object' && 
                           'is_coc' in queryKey[1];
                  }
                });
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}