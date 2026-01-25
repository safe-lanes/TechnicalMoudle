import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Eye, 
  Edit, 
  Paperclip, 
  Link, 
  Check, 
  Search, 
  Plus,
  Filter
} from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import DefectFormExact from "./DefectFormExact";
import DefectModal from "./DefectModal";
import AddNoteModal from "./AddNoteModal";
import LinkDefectsModal from "./LinkDefectsModal";
import DefectFormWizard from "./DefectFormWizard";
import { cn } from "@/lib/utils";
import { formatForDisplay } from "@/lib/dateUtils";
import { VesselFleetGroupFilter, VesselFleetGroupFilterValue, createDefaultFilterValue } from "@/components/filters/VesselFleetGroupFilter";
import type { Defect } from "@shared/schema";

interface VesselFleetGroupFilterResult {
  mode: 'vessel' | 'fleet' | 'group';
  selectedVessels: string[];
  selectedFleets: string[];
  selectedGroups: string[];
  selectedVesselNames: string[];
  selectedFleetNames: string[];
  selectedGroupNames: string[];
}

interface DefectsFilters {
  period?: string;
  search?: string;
  vesselId?: string;
  fleet?: string;
  addGroup?: string;
  dueOverdue?: string;
  type?: string;
  includeClosedDefects?: boolean;
}

// Mock user role for permissions - in a real app, get from auth context
const CURRENT_USER_ROLE = "Admin"; // Can be: "Viewer", "Master", "Chief Engineer", "Superintendent", "Admin"

export default function DefectsLog() {
  const [filters, setFilters] = useState<DefectsFilters>({
    includeClosedDefects: false,
  });
  const [vesselFilterValue, setVesselFilterValue] = useState<VesselFleetGroupFilterValue>(createDefaultFilterValue());
  const [selectedVesselNames, setSelectedVesselNames] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(true);
  const [showNewDefectForm, setShowNewDefectForm] = useState(false);

  const handleVesselFilterChange = useCallback((result: VesselFleetGroupFilterResult) => {
    setVesselFilterValue({
      mode: result.mode,
      selectedVessels: result.selectedVessels,
      selectedFleets: result.selectedFleets,
      selectedGroups: result.selectedGroups,
    });
    setSelectedVesselNames(result.selectedVesselNames);
  }, []);
  
  // Modal states
  const [viewModal, setViewModal] = useState<{ open: boolean; defectId: string | null }>({ 
    open: false, 
    defectId: null 
  });
  const [editModal, setEditModal] = useState<{ open: boolean; defectId: string | null }>({ 
    open: false, 
    defectId: null 
  });
  const [noteModal, setNoteModal] = useState<{ open: boolean; defectId: string | null }>({ 
    open: false, 
    defectId: null 
  });
  const [linkModal, setLinkModal] = useState<{ open: boolean; defectId: string | null; linkedDefects: string[] }>({ 
    open: false, 
    defectId: null,
    linkedDefects: []
  });
  const [closeModal, setCloseModal] = useState<{ open: boolean; defect: Defect | null }>({ 
    open: false, 
    defect: null 
  });

  const { data: defects = [], isLoading } = useQuery({
    queryKey: ['/technical/api/defects', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      
      if (filters.vesselId) params.append('vesselId', filters.vesselId);
      if (filters.type) params.append('category', filters.type);
      if (filters.search) params.append('search', filters.search);
      if (filters.period) params.append('period', filters.period);
      if (filters.fleet) params.append('fleet', filters.fleet);
      if (filters.addGroup) params.append('group', filters.addGroup);
      if (filters.dueOverdue) params.append('dueOverdue', filters.dueOverdue);
      if (filters.includeClosedDefects) params.append('includeClosedDefects', 'true');
      
      const response = await fetch(`/technical/api/defects?${params}`);
      if (!response.ok) throw new Error('Failed to fetch defects');
      return response.json();
    },
  });

  const filteredDefects = useMemo(() => {
    let result = defects;
    
    if (selectedVesselNames.length > 0) {
      result = result.filter((defect: Defect) => 
        selectedVesselNames.includes(defect.vesselName || '')
      );
    }
    
    return result;
  }, [defects, selectedVesselNames]);

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
  };

  const handleApplyFilters = () => {
    // Filters are automatically applied via useQuery dependency on filters
  };

  const handleClearFilters = () => {
    setFilters({ includeClosedDefects: false });
  };

  const getDisplayActionText = (defect: Defect): string | null => {
    // Prioritize actions array over actionTakenRequested since actions are updated via the form
    if (defect.actions && Array.isArray(defect.actions) && defect.actions.length > 0) {
      const firstAction = defect.actions[0] as { actionDescription?: string };
      if (firstAction?.actionDescription) {
        return firstAction.actionDescription;
      }
    }
    return defect.actionTakenRequested || null;
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
    // Find the defect in the current list
    const defect = defects.find((d: Defect) => d.id === defectId);
    if (defect) {
      setCloseModal({ open: true, defect });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-black dark:text-white">Defects Log</h1>

          <div className="flex items-center space-x-3">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowFilters(!showFilters)}
              className={`text-gray-600 ${showFilters ? 'bg-gray-100' : ''}`}
              data-testid="button-toggle-filters"
            >
              <Filter className="h-3 w-3 mr-1" />
              Filters
            </Button>
            <Dialog open={showNewDefectForm} onOpenChange={setShowNewDefectForm}>
              <DialogTrigger asChild>
                <Button className="bg-green-600 hover:bg-green-700 text-white" size="sm" data-testid="button-new-defect">
                  <Plus className="h-4 w-4 mr-1" />
                  New Defect
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto p-0">
                <DefectFormExact 
                  onClose={() => setShowNewDefectForm(false)}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Filter Controls */}
      {showFilters && (
        <div className="mb-4">
          <VesselFleetGroupFilter
            value={vesselFilterValue}
            onChange={handleVesselFilterChange}
            showClearButton={true}
          />
          
          <div className="pb-4">
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

                {/* Due/Overdue */}
                <Select value={filters.dueOverdue} onValueChange={(value) => handleFilterChange('dueOverdue', value)}>
                  <SelectTrigger className="w-28 h-8 text-xs">
                    <SelectValue placeholder="Due / Overdue" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="due">Due</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="all">All</SelectItem>
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

                {/* Apply/Clear buttons */}
                <Button 
                  onClick={handleApplyFilters}
                  className="bg-blue-600 hover:bg-blue-700 text-white h-8 px-4 text-xs"
                >
                  Apply
                </Button>
                <Button 
                  onClick={handleClearFilters}
                  variant="outline" 
                  className="h-8 px-4 text-xs"
                >
                  Clear
                </Button>
              </div>

              {/* Include Closed Defects */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeClosedDefects"
                  checked={filters.includeClosedDefects}
                  onCheckedChange={(checked) => handleFilterChange('includeClosedDefects', checked)}
                />
                <label 
                  htmlFor="includeClosedDefects" 
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Include Closed Defects
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div>
        <Card>
          <CardContent className="p-0">
            {/* Table Header */}
            <div className="bg-sky-100 px-4 py-2 border-b overflow-x-auto">
              <div className="grid gap-3 text-xs font-medium text-gray-700" style={{ gridTemplateColumns: 'minmax(90px,1fr) minmax(70px,1fr) minmax(70px,1fr) minmax(70px,1fr) minmax(80px,1fr) minmax(140px,2fr) minmax(110px,1.5fr) minmax(70px,1fr) minmax(70px,1fr) minmax(70px,1fr) minmax(60px,1fr) minmax(100px,1fr)' }}>
                <div>ID</div>
                <div>Vessel</div>
                <div>Issue Date</div>
                <div>Category</div>
                <div>Component</div>
                <div>Description</div>
                <div>Action Taken / Requested</div>
                <div>Target Date</div>
                <div>Date Compl.</div>
                <div>Status</div>
                <div>Priority</div>
                <div>Actions</div>
              </div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-gray-200">
              {isLoading ? (
                <div className="text-center py-8 text-gray-500">Loading defects...</div>
              ) : filteredDefects.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No defects found</div>
              ) : (
                filteredDefects.map((defect: Defect, index: number) => (
                  <div
                    key={defect.id}
                    className={cn(
                      "grid gap-3 px-4 py-3 text-xs hover:bg-gray-50",
                      index % 2 === 0 ? "bg-white" : "bg-gray-25"
                    )}
                    style={{ gridTemplateColumns: 'minmax(90px,1fr) minmax(70px,1fr) minmax(70px,1fr) minmax(70px,1fr) minmax(80px,1fr) minmax(140px,2fr) minmax(110px,1.5fr) minmax(70px,1fr) minmax(70px,1fr) minmax(70px,1fr) minmax(60px,1fr) minmax(100px,1fr)' }}
                  >
                    <div className="font-mono text-blue-600">{defect.id}</div>
                    <div className="text-gray-700">{defect.vesselName}</div>
                    <div className="text-gray-700">{formatForDisplay(defect.issueDate)}</div>
                    <div>
                      <Badge variant={defect.category === 'COC' ? 'destructive' : 'secondary'} className="text-xs">
                        {defect.category}
                      </Badge>
                    </div>
                    <div className="text-gray-700 truncate" title={defect.componentHardwareLevel3 || ''}>
                      {defect.componentHardwareLevel3 || '-'}
                    </div>
                    <div className="text-gray-700 truncate" title={defect.description}>
                      {defect.description}
                    </div>
                    <div className="text-gray-700 truncate" title={getDisplayActionText(defect) || ""}>
                      {getDisplayActionText(defect)}
                    </div>
                    <div className="text-gray-700">{formatForDisplay(defect.targetCloseDate)}</div>
                    <div className="text-gray-700">{formatForDisplay(defect.dateCompleted)}</div>
                    <div className="flex items-center gap-1">
                      {getStatusBadge(defect.status, defect.critical)}
                    </div>
                    <div className="flex items-center">
                      {defect.priority ? (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium text-white ${
                          defect.priority === 'Low' ? 'bg-green-500' : 
                          defect.priority === 'Medium' ? 'bg-orange-500' : 
                          defect.priority === 'High' ? 'bg-red-500' : 'bg-gray-500'
                        }`}>
                          {defect.priority}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
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
                              <Link className="h-3 w-3 text-gray-500" />
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
                    <div className="col-span-1">
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                        <Search className="h-3 w-3 text-gray-500" />
                      </Button>
                      <span className="text-gray-500 text-xs ml-1">Vessel {defect.vesselId.slice(-2)}</span>
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
            {filteredDefects.length > 0 ? `0 to 0 of ${filteredDefects.length}` : "0 to 0 of 0"}
          </div>
          <div className="text-sm text-gray-500">
            Page 0 of {filteredDefects.length > 0 ? 1 : 0}
          </div>
        </div>
      </div>
      
      {/* Modals */}
      {viewModal.defectId && (
        <DefectModal
          open={viewModal.open}
          onClose={() => setViewModal({ open: false, defectId: null })}
          defectId={viewModal.defectId}
          mode="view"
        />
      )}
      
      {editModal.defectId && (
        <DefectModal
          open={editModal.open}
          onClose={() => setEditModal({ open: false, defectId: null })}
          defectId={editModal.defectId}
          mode="edit"
        />
      )}
      
      {noteModal.defectId && (
        <AddNoteModal
          open={noteModal.open}
          onClose={() => setNoteModal({ open: false, defectId: null })}
          defectId={noteModal.defectId}
        />
      )}
      
      {linkModal.defectId && (
        <LinkDefectsModal
          open={linkModal.open}
          onClose={() => setLinkModal({ open: false, defectId: null, linkedDefects: [] })}
          defectId={linkModal.defectId}
          currentLinkedDefects={linkModal.linkedDefects}
        />
      )}
      
      {closeModal.defect && (
        <Dialog 
          open={closeModal.open} 
          onOpenChange={(open) => {
            if (!open) {
              setCloseModal({ open: false, defect: null });
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
                // Invalidate queries to refresh the defects list
                queryClient.invalidateQueries({ queryKey: ['/technical/api/defects'] });
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}