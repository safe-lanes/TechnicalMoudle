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
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Eye, 
  Edit, 
  Paperclip, 
  Link as LinkIcon, 
  Check, 
  Search, 
  Plus,
  Filter
} from "lucide-react";
import { Link } from "wouter";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLocation } from "wouter";
import AddNoteModal from "./AddNoteModal";
import LinkDefectsModal from "./LinkDefectsModal";
import DefectModal from "./DefectModal";
import { cn } from "@/lib/utils";
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

// Mock user role for permissions - in a real app, get from auth context
const CURRENT_USER_ROLE = "Admin"; // Can be: "Viewer", "Master", "Chief Engineer", "Superintendent", "Admin"

export default function DefectsLogWithTabs() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<'active' | 'resolved' | 'coc' | 'recurring'>('active');
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<DefectsFilters>({});
  
  // Modal states
  const [noteModal, setNoteModal] = useState<{ open: boolean; defectId: string | null }>({ 
    open: false, 
    defectId: null 
  });
  const [linkModal, setLinkModal] = useState<{ open: boolean; defectId: string | null; linkedDefects: string[] }>({ 
    open: false, 
    defectId: null,
    linkedDefects: []
  });
  const [newDefectModalOpen, setNewDefectModalOpen] = useState(false);
  const [viewModal, setViewModal] = useState<{ open: boolean; defectId: string | null }>({ 
    open: false, 
    defectId: null 
  });
  const [editModal, setEditModal] = useState<{ open: boolean; defectId: string | null }>({ 
    open: false, 
    defectId: null 
  });
  const [showFilters, setShowFilters] = useState(true);

  // Query for defects
  const { data: activeDefects = [], isLoading: isLoadingActive } = useQuery({
    queryKey: ['defects', 'active', filters, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('statusScope', 'active');
      
      if (filters.vesselId) params.append('vesselId', filters.vesselId);
      if (filters.type) params.append('category', filters.type);
      if (filters.search) params.append('search', filters.search);
      if (filters.period) params.append('period', filters.period);
      if (filters.fleet) params.append('fleet', filters.fleet);
      if (filters.addGroup) params.append('group', filters.addGroup);
      if (filters.dueOverdue) params.append('dueOverdue', filters.dueOverdue);
      
      const response = await fetch(`/technical/api/defects?${params}`);
      if (!response.ok) throw new Error('Failed to fetch active defects');
      return response.json();
    },
  });

  const { data: resolvedDefects = [], isLoading: isLoadingResolved } = useQuery({
    queryKey: ['defects', 'resolved', filters, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('statusScope', 'resolved');
      
      if (filters.vesselId) params.append('vesselId', filters.vesselId);
      if (filters.type) params.append('category', filters.type);
      if (filters.search) params.append('search', filters.search);
      if (filters.period) params.append('period', filters.period);
      if (filters.fleet) params.append('fleet', filters.fleet);
      if (filters.addGroup) params.append('group', filters.addGroup);
      // Don't apply dueOverdue filter for resolved defects
      
      const response = await fetch(`/technical/api/defects?${params}`);
      if (!response.ok) throw new Error('Failed to fetch resolved defects');
      return response.json();
    },
  });

  const { data: cocDefects = [], isLoading: isLoadingCoC } = useQuery({
    queryKey: ['defects', 'coc', filters, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      
      if (filters.vesselId) params.append('vesselId', filters.vesselId);
      if (filters.type) params.append('category', filters.type);
      if (filters.search) params.append('search', filters.search);
      if (filters.period) params.append('period', filters.period);
      if (filters.fleet) params.append('fleet', filters.fleet);
      if (filters.addGroup) params.append('group', filters.addGroup);
      if (filters.dueOverdue) params.append('dueOverdue', filters.dueOverdue);
      
      const response = await fetch(`/technical/api/defects/coc?${params}`);
      if (!response.ok) throw new Error('Failed to fetch CoC defects');
      return response.json();
    },
  });

  const { data: recurringDefects = [], isLoading: isLoadingRecurring } = useQuery({
    queryKey: ['defects', 'recurring', filters, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      
      if (filters.vesselId) params.append('vesselId', filters.vesselId);
      if (filters.type) params.append('category', filters.type);
      if (filters.search) params.append('search', filters.search);
      if (filters.period) params.append('period', filters.period);
      if (filters.fleet) params.append('fleet', filters.fleet);
      if (filters.addGroup) params.append('group', filters.addGroup);
      if (filters.dueOverdue) params.append('dueOverdue', filters.dueOverdue);
      
      const response = await fetch(`/technical/api/defects/recurring?${params}`);
      if (!response.ok) throw new Error('Failed to fetch recurring defects');
      return response.json();
    },
  });

  // Count queries for tab badges - aligned with list query filters
  const { data: activeCount = 0 } = useQuery({
    queryKey: ['defects', 'count', 'active', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('statusScope', 'active');
      
      // Include all the same filters as the list query
      if (filters.vesselId) params.append('vesselId', filters.vesselId);
      if (filters.type) params.append('category', filters.type);
      if (filters.search) params.append('search', filters.search);
      if (filters.period) params.append('period', filters.period);
      if (filters.fleet) params.append('fleet', filters.fleet);
      if (filters.addGroup) params.append('group', filters.addGroup);
      if (filters.dueOverdue) params.append('dueOverdue', filters.dueOverdue);
      
      const response = await fetch(`/technical/api/defects/count?${params}`);
      if (!response.ok) throw new Error('Failed to fetch active count');
      const data = await response.json();
      return data.count;
    }
  });

  const { data: resolvedCount = 0 } = useQuery({
    queryKey: ['defects', 'count', 'resolved', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('statusScope', 'resolved');
      
      if (filters.vesselId) params.append('vesselId', filters.vesselId);
      if (filters.type) params.append('category', filters.type);
      if (filters.search) params.append('search', filters.search);
      if (filters.period) params.append('period', filters.period);
      if (filters.fleet) params.append('fleet', filters.fleet);
      if (filters.addGroup) params.append('group', filters.addGroup);
      // Don't apply dueOverdue filter for resolved defects (matches list query)
      
      const response = await fetch(`/technical/api/defects/count?${params}`);
      if (!response.ok) throw new Error('Failed to fetch resolved count');
      const data = await response.json();
      return data.count;
    }
  });

  const { data: cocCount = 0 } = useQuery({
    queryKey: ['defects', 'count', 'coc', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('isCoC', 'true');
      
      if (filters.vesselId) params.append('vesselId', filters.vesselId);
      if (filters.type) params.append('category', filters.type);
      if (filters.search) params.append('search', filters.search);
      if (filters.period) params.append('period', filters.period);
      if (filters.fleet) params.append('fleet', filters.fleet);
      if (filters.addGroup) params.append('group', filters.addGroup);
      if (filters.dueOverdue) params.append('dueOverdue', filters.dueOverdue);
      
      const response = await fetch(`/technical/api/defects/count?${params}`);
      if (!response.ok) throw new Error('Failed to fetch CoC count');
      const data = await response.json();
      return data.count;
    }
  });

  const { data: recurringCount = 0 } = useQuery({
    queryKey: ['defects', 'count', 'recurring', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      
      if (filters.vesselId) params.append('vesselId', filters.vesselId);
      if (filters.type) params.append('category', filters.type);
      if (filters.search) params.append('search', filters.search);
      if (filters.period) params.append('period', filters.period);
      if (filters.fleet) params.append('fleet', filters.fleet);
      if (filters.addGroup) params.append('group', filters.addGroup);
      if (filters.dueOverdue) params.append('dueOverdue', filters.dueOverdue);
      
      const response = await fetch(`/technical/api/defects/count/recurring?${params}`);
      if (!response.ok) throw new Error('Failed to fetch recurring count');
      const data = await response.json();
      return data.count;
    }
  });

  const defects = activeTab === 'active' ? activeDefects 
    : activeTab === 'resolved' ? resolvedDefects 
    : activeTab === 'coc' ? cocDefects 
    : recurringDefects;
  
  const isLoading = activeTab === 'active' ? isLoadingActive 
    : activeTab === 'resolved' ? isLoadingResolved 
    : activeTab === 'coc' ? isLoadingCoC 
    : isLoadingRecurring;

  const getStatusBadge = (status: string, critical: boolean) => {
    if (status === "Closed") {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
    if (critical) {
      return <AlertTriangle className="h-4 w-4 text-red-600" />;
    }
    return <Clock className="h-4 w-4 text-amber-600" />;
  };

  const handleFilterChange = (key: keyof DefectsFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1); // Reset to page 1 when filters change
  };

  const handleApplyFilters = () => {
    // Filters are automatically applied via useQuery dependency on filters
  };

  const handleClearFilters = () => {
    setFilters({});
    setPage(1);
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value as 'active' | 'resolved' | 'coc' | 'recurring');
    setPage(1); // Reset to page 1 on tab change
    // Optionally clear search/filters on tab change
    // setFilters({});
  };
  
  // Permission checking functions
  const canView = () => true; // All users can view
  
  const canEdit = () => {
    return ["Master", "Chief Engineer", "Superintendent", "Admin"].includes(CURRENT_USER_ROLE);
  };
  
  const canAddNote = () => true; // All users can add notes
  
  const canLink = () => {
    return ["Chief Engineer", "Superintendent", "Admin"].includes(CURRENT_USER_ROLE);
  };
  
  const canClose = () => {
    return ["Chief Engineer", "Master", "Superintendent", "Admin"].includes(CURRENT_USER_ROLE);
  };
  
  // Action handlers
  const handleView = (defectId: string) => {
    setViewModal({ open: true, defectId });
  };
  
  const handleEdit = (defectId: string) => {
    if (!canEdit()) {
      return; // Could show a toast here for insufficient permissions
    }
    setEditModal({ open: true, defectId });
  };
  
  const handleAddNote = (defectId: string) => {
    setNoteModal({ open: true, defectId });
  };
  
  const handleLink = (defectId: string, linkedDefects: string[] = []) => {
    if (!canLink()) {
      return; // Could show a toast here for insufficient permissions
    }
    setLinkModal({ open: true, defectId, linkedDefects });
  };
  
  const handleClose = (defectId: string) => {
    if (!canClose()) {
      return; // Could show a toast here for insufficient permissions
    }
    setLocation(`/defects/close/${defectId}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header and Filters Container */}
      <div className="pt-2 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 gap-4">
          <h1 className="text-2xl font-bold text-black dark:text-white">Defects log</h1>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="h-8 gap-2 bg-white dark:bg-gray-800 text-[#0f172a] dark:text-white border-gray-300 dark:border-gray-600"
              data-testid="button-toggle-filters"
            >
              <Filter className="h-4 w-4" />
              Filters
            </Button>
            <Button 
              className="bg-green-600 hover:bg-green-700 text-white h-8" 
              size="sm" 
              data-testid="button-new-defect"
              onClick={() => setNewDefectModalOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              New Defect
            </Button>
          </div>
        </div>

        {/* Collapsible Filter Controls */}
        {showFilters && (
          <div className="flex flex-wrap gap-2 mb-4 bg-transparent rounded-lg">
          {/* Period */}
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#8798ad]" />
            <Select value={filters.period} onValueChange={(value) => handleFilterChange('period', value)}>
              <SelectTrigger className="w-[150px] h-8 text-xs text-[#8798ad]">
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
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#8798ad]" />
            <Input
              placeholder="Search Defect"
              value={filters.search || ""}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="w-[180px] h-8 text-xs pl-8 text-[#8798ad]"
            />
          </div>

          {/* Vessel */}
          <Select value={filters.vesselId} onValueChange={(value) => handleFilterChange('vesselId', value)}>
            <SelectTrigger className="w-[150px] h-8 text-xs text-[#8798ad]">
              <SelectValue placeholder="Vessel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="V001">Vessel 1</SelectItem>
              <SelectItem value="V002">Vessel 2</SelectItem>
            </SelectContent>
          </Select>

          {/* Fleet */}
          <Select value={filters.fleet} onValueChange={(value) => handleFilterChange('fleet', value)}>
            <SelectTrigger className="w-[150px] h-8 text-xs text-[#8798ad]">
              <SelectValue placeholder="Fleet" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fleet1">Fleet 1</SelectItem>
              <SelectItem value="fleet2">Fleet 2</SelectItem>
            </SelectContent>
          </Select>

          {/* Add Group */}
          <Select value={filters.addGroup} onValueChange={(value) => handleFilterChange('addGroup', value)}>
            <SelectTrigger className="w-[150px] h-8 text-xs text-[#8798ad]">
              <SelectValue placeholder="Add Group" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="department">Department</SelectItem>
              <SelectItem value="priority">Priority</SelectItem>
            </SelectContent>
          </Select>

          {/* Due/Overdue - only show for Active tab */}
          {activeTab === 'active' && (
            <Select value={filters.dueOverdue} onValueChange={(value) => handleFilterChange('dueOverdue', value)}>
              <SelectTrigger className="w-[150px] h-8 text-xs text-[#8798ad]">
                <SelectValue placeholder="Due / Overdue" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="due">Due</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          )}

          {/* Type */}
          <Select value={filters.type} onValueChange={(value) => handleFilterChange('type', value)}>
            <SelectTrigger className="w-[150px] h-8 text-xs text-[#8798ad]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Defect">Defect</SelectItem>
              <SelectItem value="COC">COC</SelectItem>
              <SelectItem value="Observation">Observation</SelectItem>
              <SelectItem value="NCR">NCR</SelectItem>
            </SelectContent>
          </Select>

          {/* Apply/Clear buttons */}
          <Button 
            onClick={handleApplyFilters}
            className="bg-blue-600 hover:bg-blue-700 text-white h-8 px-4 text-xs"
          >
            Apply
          </Button>
          <Button 
            onClick={handleClearFilters}
            variant="ghost" 
            className="h-8 px-4 text-xs"
          >
            Clear
            </Button>
          </div>
        )}
      </div>

      {/* Main Content with Tabs */}
      <div className="px-4">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="mb-4">
            <TabsTrigger value="active" className="flex items-center gap-2">
              Active
              <Badge variant="secondary" className="ml-1">
                {activeCount}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="resolved" className="flex items-center gap-2">
              Resolved
              <Badge variant="secondary" className="ml-1">
                {resolvedCount}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="coc" className="flex items-center gap-2">
              CoC
              <Badge variant="secondary" className="ml-1">
                {cocCount}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="recurring" className="flex items-center gap-2">
              Recurring
              <Badge variant="secondary" className="ml-1">
                {recurringCount}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            <Card>
              <CardContent className="p-0">
                {/* Table Header - Different for recurring tab */}
                {activeTab === 'recurring' ? (
                  <div className="bg-sky-100 px-4 py-2 border-b">
                    <div className="grid grid-cols-12 gap-4 text-xs font-medium text-gray-700">
                      <div className="col-span-1">ID</div>
                      <div className="col-span-3">Equipment Key</div>
                      <div className="col-span-2">Occurrences</div>
                      <div className="col-span-1">Open</div>
                      <div className="col-span-2">Last Occurrence</div>
                      <div className="col-span-1">MTBF (Days)</div>
                      <div className="col-span-1">Has CoC</div>
                      <div className="col-span-1">Actions</div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-sky-100 px-4 py-2 border-b">
                    <div className="grid grid-cols-12 gap-4 text-xs font-medium text-gray-700">
                      <div className="col-span-1">ID</div>
                      <div className="col-span-1">Vessel</div>
                      <div className="col-span-1">Issue Date</div>
                      <div className="col-span-1">Category</div>
                      <div className="col-span-2">Description</div>
                      <div className="col-span-2">Action Taken / Requested</div>
                      <div className="col-span-1">Target Date</div>
                      <div className="col-span-1">Date Compl.</div>
                      <div className="col-span-1">Status</div>
                      <div className="col-span-1">Actions</div>
                    </div>
                  </div>
                )}

                {/* Table Body */}
                <div className="divide-y divide-gray-200">
                  {isLoading ? (
                    <div className="text-center py-8 text-gray-500">Loading defects...</div>
                  ) : defects.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      {activeTab === 'active' ? 'No active defects' 
                        : activeTab === 'resolved' ? 'No resolved defects'
                        : activeTab === 'coc' ? 'No CoC defects'
                        : 'No recurring defects'}
                    </div>
                  ) : activeTab === 'recurring' ? (
                    defects.map((recurring: any, index: number) => (
                      <div
                        key={recurring.id}
                        className={cn(
                          "grid grid-cols-12 gap-4 px-4 py-3 text-xs hover:bg-gray-50",
                          index % 2 === 0 ? "bg-white" : "bg-gray-25"
                        )}
                      >
                        <div className="col-span-1 font-mono text-blue-600">{recurring.id}</div>
                        <div className="col-span-3 text-gray-700 truncate" title={recurring.equipmentKey}>
                          {recurring.equipmentKey?.replace(/_/g, ' ') || 'N/A'}
                        </div>
                        <div className="col-span-2 text-gray-700">
                          <Badge variant="secondary" className="text-xs">
                            {recurring.occurrenceCount} times in {recurring.windowMonths} months
                          </Badge>
                        </div>
                        <div className="col-span-1 text-gray-700">
                          {recurring.openCount > 0 ? (
                            <Badge variant="destructive" className="text-xs">{recurring.openCount}</Badge>
                          ) : (
                            <span className="text-green-600">0</span>
                          )}
                        </div>
                        <div className="col-span-2 text-gray-700">{recurring.lastOccurrenceDate}</div>
                        <div className="col-span-1 text-gray-700">{recurring.mtbfDays || 'N/A'}</div>
                        <div className="col-span-1">
                          {recurring.hasCoc ? (
                            <Badge variant="destructive" className="text-xs">Yes</Badge>
                          ) : (
                            <span className="text-gray-400">No</span>
                          )}
                        </div>
                        <div className="col-span-1 flex items-center gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="h-6 w-6 p-0 hover:bg-blue-50"
                                  onClick={() => setLocation(`/defects/recurring/${recurring.id}`)}
                                  data-testid={`button-view-recurring-${recurring.id}`}
                                >
                                  <Eye className="h-3 w-3 text-gray-500" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>View Related Defects</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    ))
                  ) : (
                    defects.map((defect: Defect, index: number) => (
                      <div
                        key={defect.id}
                        className={cn(
                          "grid grid-cols-12 gap-4 px-4 py-3 text-xs hover:bg-gray-50",
                          index % 2 === 0 ? "bg-white" : "bg-gray-25"
                        )}
                      >
                        <div className="col-span-1 font-mono text-blue-600">{defect.id}</div>
                        <div className="col-span-1 text-gray-700">{defect.vesselName}</div>
                        <div className="col-span-1 text-gray-700">{defect.issueDate}</div>
                        <div className="col-span-1">
                          <Badge variant={defect.category === 'COC' ? 'destructive' : 'secondary'} className="text-xs">
                            {defect.category}
                          </Badge>
                        </div>
                        <div className="col-span-2 text-gray-700 truncate" title={defect.description}>
                          {defect.description}
                        </div>
                        <div className="col-span-2 text-gray-700 truncate" title={defect.actionTakenRequested || ""}>
                          {defect.actionTakenRequested}
                        </div>
                        <div className="col-span-1 text-gray-700">{defect.targetCloseDate}</div>
                        <div className="col-span-1 text-gray-700">{defect.dateCompleted}</div>
                        <div className="col-span-1 flex items-center gap-1">
                          {getStatusBadge(defect.status, defect.critical)}
                        </div>
                        <div className="col-span-1 flex items-center gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="h-6 w-6 p-0 hover:bg-blue-50"
                                  onClick={() => handleView(defect.id)}
                                  data-testid={`button-view-${defect.id}`}
                                >
                                  <Eye className="h-3 w-3 text-gray-500" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>View</p>
                              </TooltipContent>
                            </Tooltip>
                            
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className={cn(
                                    "h-6 w-6 p-0",
                                    canEdit() ? "hover:bg-blue-50" : "opacity-50 cursor-not-allowed"
                                  )}
                                  onClick={() => handleEdit(defect.id)}
                                  disabled={!canEdit()}
                                  data-testid={`button-edit-${defect.id}`}
                                >
                                  <Edit className="h-3 w-3 text-gray-500" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{canEdit() ? "Edit" : "Edit (No Permission)"}</p>
                              </TooltipContent>
                            </Tooltip>
                            
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="h-6 w-6 p-0 hover:bg-blue-50"
                                  onClick={() => handleAddNote(defect.id)}
                                  data-testid={`button-add-note-${defect.id}`}
                                >
                                  <Paperclip className="h-3 w-3 text-gray-500" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Add Note</p>
                              </TooltipContent>
                            </Tooltip>
                            
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className={cn(
                                    "h-6 w-6 p-0",
                                    canLink() ? "hover:bg-blue-50" : "opacity-50 cursor-not-allowed"
                                  )}
                                  onClick={() => handleLink(defect.id, defect.linkedDefects || undefined)}
                                  disabled={!canLink()}
                                  data-testid={`button-link-${defect.id}`}
                                >
                                  <LinkIcon className="h-3 w-3 text-gray-500" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{canLink() ? "Link" : "Link (No Permission)"}</p>
                              </TooltipContent>
                            </Tooltip>
                            
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className={cn(
                                    "h-6 w-6 p-0",
                                    canClose() && defect.status !== 'Closed' 
                                      ? "hover:bg-green-50" 
                                      : "opacity-50 cursor-not-allowed"
                                  )}
                                  onClick={() => handleClose(defect.id)}
                                  disabled={!canClose() || defect.status === 'Closed'}
                                  data-testid={`button-close-${defect.id}`}
                                >
                                  <Check className={cn(
                                    "h-3 w-3",
                                    defect.status === 'Closed' ? "text-green-600" : "text-gray-500"
                                  )} />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>
                                  {defect.status === 'Closed' 
                                    ? "Already Closed" 
                                    : canClose() 
                                      ? "Close" 
                                      : "Close (No Permission)"}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4 px-2">
              <div className="text-sm text-gray-500">
                Showing {defects.length > 0 ? `1-${defects.length}` : '0'} of {defects.length}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <div className="text-sm text-gray-700">
                  Page {page}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={defects.length < 20}
                >
                  Next
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Modals */}
      {noteModal.defectId && (
        <AddNoteModal
          open={noteModal.open}
          onClose={() => {
            setNoteModal({ open: false, defectId: null });
            queryClient.invalidateQueries({ queryKey: ['defects'] });
          }}
          defectId={noteModal.defectId}
        />
      )}
      
      {linkModal.defectId && (
        <LinkDefectsModal
          open={linkModal.open}
          onClose={() => {
            setLinkModal({ open: false, defectId: null, linkedDefects: [] });
            queryClient.invalidateQueries({ queryKey: ['defects'] });
          }}
          defectId={linkModal.defectId}
          currentLinkedDefects={linkModal.linkedDefects}
        />
      )}

      <DefectModal
        open={newDefectModalOpen}
        onClose={() => {
          setNewDefectModalOpen(false);
          queryClient.invalidateQueries({ queryKey: ['defects'] });
        }}
        mode="new"
      />

      {viewModal.defectId && (
        <DefectModal
          open={viewModal.open}
          onClose={() => {
            setViewModal({ open: false, defectId: null });
          }}
          defectId={viewModal.defectId}
          mode="view"
        />
      )}

      {editModal.defectId && (
        <DefectModal
          open={editModal.open}
          onClose={() => {
            setEditModal({ open: false, defectId: null });
            queryClient.invalidateQueries({ queryKey: ['defects'] });
          }}
          defectId={editModal.defectId}
          mode="edit"
        />
      )}
    </div>
  );
}