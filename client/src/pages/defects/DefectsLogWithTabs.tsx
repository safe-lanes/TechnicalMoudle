import { useState, useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle, 
  Clock, 
  Eye, 
  Edit, 
  Link as LinkIcon, 
  Trash2,
  Search, 
  Plus,
  Filter
} from "lucide-react";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import LinkDefectsModal from "./LinkDefectsModal";
import DefectModal from "./DefectModal";
import { cn } from "@/lib/utils";
import type { Defect } from "@shared/schema";
import { getComputedStatus } from "@/lib/defectStatusUtils";
import AgGridTable from "@/components/AgGrid/AgGridTable";
import AgGridTableActions from "@/components/AgGrid/AgGridTableActions";
import { ICellRendererParams, GridReadyEvent, GridApi, ColDef } from "ag-grid-community";
import { VesselFleetGroupFilter, VesselFleetGroupFilterValue, VesselFleetGroupFilterResult, createDefaultFilterValue } from "@/components/filters/VesselFleetGroupFilter";

interface DefectsFilters {
  period?: string;
  search?: string;
  vesselId?: string;
  fleet?: string;
  addGroup?: string;
  dueOverdue?: string;
  type?: string;
}

interface ActionsCellContext {
  handleViewClick: (data: Defect) => void;
  handleEditClick: (data: Defect) => void;
  handleLinkClick: (data: Defect) => void;
  handleDeleteClick: (data: Defect) => void;
  handleVerifyClick: (data: Defect) => void;
  canEdit: () => boolean;
  canLink: () => boolean;
  canVerify: () => boolean;
  isVerifying: boolean;
}

const StatusCellRenderer = (params: ICellRendererParams) => {
  if (!params.colDef || !params.data) return null;
  
  const { label, color } = getComputedStatus(params.data);
  
  return (
    <div className="flex items-center justify-center">
      <span className={`text-xs font-medium ${color}`}>{label}</span>
    </div>
  );
};

const CategoryCellRenderer = (params: ICellRendererParams) => {
  if (!params.colDef || !params.data) return null;
  
  const category = params.value || 'Defect';
  const isCoc = params.data.is_coc === true;
  
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[13px] text-[#4f5863]">{category}</span>
      {isCoc && (
        <Badge className="bg-blue-100 text-blue-700 text-[10px] py-0 px-1">
          CoC
        </Badge>
      )}
    </div>
  );
};

const stripHtmlTags = (html: string | null | undefined): string => {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
};

const HtmlTextCellRenderer = (params: ICellRendererParams) => {
  if (!params.colDef) return null;
  
  const plainText = stripHtmlTags(params.value);
  
  return (
    <div 
      className="line-clamp-2 text-[13px] text-[#4f5863] cursor-default leading-tight py-1"
      style={{ 
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'normal',
        wordBreak: 'break-word'
      }}
    >
      {plainText}
    </div>
  );
};

const PriorityCellRenderer = (params: ICellRendererParams) => {
  if (!params.colDef) return null;
  
  const priority = params.value;
  if (!priority) return <span className="text-gray-400 text-xs">-</span>;
  
  const colorClass = priority === 'Low' ? 'bg-green-500' : 
                    priority === 'Medium' ? 'bg-orange-500' : 
                    priority === 'High' ? 'bg-red-500' : 'bg-gray-500';
  
  return (
    <div className="flex items-center justify-center">
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white ${colorClass}`}>
        {priority}
      </span>
    </div>
  );
};

const TwoLineDateCellRenderer = (params: ICellRendererParams) => {
  if (!params.value) return null;
  
  try {
    let date: Date;
    const value = String(params.value);
    
    // Handle DD-MM-YYYY format (e.g., "25-08-2025")
    const ddmmyyyyMatch = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (ddmmyyyyMatch) {
      const [, day, month, year] = ddmmyyyyMatch;
      date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    } else {
      date = new Date(value);
    }
    
    if (isNaN(date.getTime())) return <span className="text-[13px] text-[#4f5863]">{params.value}</span>;
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear();
    
    return (
      <div className="flex flex-col justify-center text-[13px] text-[#4f5863] leading-tight">
        <span>{day} {month}</span>
        <span>{year}</span>
      </div>
    );
  } catch {
    return <span className="text-[13px] text-[#4f5863]">{params.value}</span>;
  }
};

const ActionsCellRenderer = (params: ICellRendererParams & { context: ActionsCellContext }) => {
  if (!params.colDef || !params.data) return null;
  
  const defect = params.data as Defect;
  const { handleViewClick, handleEditClick, handleLinkClick, handleDeleteClick, handleVerifyClick, canEdit, canLink, canVerify, isVerifying } = params.context;
  const isVerified = defect.verified === true;
  
  return (
    <div className="flex gap-1 justify-center items-center">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-6 w-6"
              onClick={() => handleViewClick(defect)}
              data-testid={`button-view-${defect.id}`}
            >
              <Eye className="h-4 w-4 text-gray-500" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>View</p>
          </TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              size="icon" 
              variant="ghost" 
              className={cn("h-6 w-6", !canEdit() && "opacity-50 cursor-not-allowed")}
              onClick={() => handleEditClick(defect)}
              disabled={!canEdit()}
              data-testid={`button-edit-${defect.id}`}
            >
              <Edit className="h-4 w-4 text-gray-500" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{canEdit() ? "Edit" : "Edit (No Permission)"}</p>
          </TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              size="icon" 
              variant="ghost" 
              className={cn("h-6 w-6", !canLink() && "opacity-50 cursor-not-allowed")}
              onClick={() => handleLinkClick(defect)}
              disabled={!canLink()}
              data-testid={`button-link-${defect.id}`}
            >
              <LinkIcon className="h-4 w-4 text-gray-500" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{canLink() ? "Link Defects" : "Link (No Permission)"}</p>
          </TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              size="icon" 
              variant="ghost" 
              className={cn("h-6 w-6", (!canVerify() || isVerifying) && "opacity-50 cursor-not-allowed")}
              onClick={() => handleVerifyClick(defect)}
              disabled={!canVerify() || isVerifying}
              data-testid={`button-verified-${defect.id}`}
            >
              <CheckCircle className={cn("h-4 w-4", isVerified ? "text-green-600" : "text-gray-400")} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isVerifying ? "Processing..." : !canVerify() ? "Verify (No Permission)" : isVerified ? "Verified - Click to remove" : "Click to verify"}</p>
          </TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-6 w-6"
              onClick={() => handleDeleteClick(defect)}
              data-testid={`button-delete-${defect.id}`}
            >
              <Trash2 className="h-4 w-4 text-gray-500" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Delete</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

export default function DefectsLogWithTabs() {
  const [, setLocation] = useLocation();
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [filters, setFilters] = useState<DefectsFilters>({});
  const [vesselFilterValue, setVesselFilterValue] = useState<VesselFleetGroupFilterValue>(createDefaultFilterValue());
  const [selectedVesselNames, setSelectedVesselNames] = useState<string[]>([]);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  
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
  const [unverifyDialog, setUnverifyDialog] = useState<{ open: boolean; defect: Defect | null }>({
    open: false,
    defect: null
  });

  const handleVesselFilterChange = useCallback((result: VesselFleetGroupFilterResult) => {
    setVesselFilterValue({
      mode: result.mode,
      selectedVessels: result.selectedVessels,
      selectedFleets: result.selectedFleets,
      selectedGroups: result.selectedGroups,
    });
    setSelectedVesselNames(result.selectedVesselNames);
  }, []);

  const { data: defects = [], isLoading } = useQuery({
    queryKey: ['defects', 'active', filters],
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
      if (!response.ok) throw new Error('Failed to fetch defects');
      const data = await response.json();
      
      // Transform data to include first action's description in actionTakenRequested
      // Prioritize actions array over actionTakenRequested field since actions are updated via the form
      return data.map((defect: Defect) => ({
        ...defect,
        actionTakenRequested: 
          (defect.actions && defect.actions.length > 0 && defect.actions[0].actionDescription)
            ? defect.actions[0].actionDescription 
            : (defect.actionTakenRequested || '')
      }));
    },
  });

  const handleFilterChange = (key: keyof DefectsFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setFilters({});
    setVesselFilterValue(createDefaultFilterValue());
    setSelectedVesselNames([]);
  };

  const filteredDefects = useMemo(() => {
    let result = defects;
    
    // Vessel filter
    if (selectedVesselNames.length > 0) {
      const normalizedFilterNames = selectedVesselNames.map(n => n.toLowerCase().trim());
      result = result.filter((defect: Defect) => {
        const defectVessel = (defect.vesselId || defect.vesselName || '').toLowerCase().trim();
        return normalizedFilterNames.some(filterName => 
          filterName === defectVessel || defectVessel.includes(filterName) || filterName.includes(defectVessel)
        );
      });
    }
    
    // Due/Overdue filter based on Target Date
    if (filters.dueOverdue && filters.dueOverdue !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      result = result.filter((defect: Defect) => {
        const targetDateStr = defect.targetCloseDate;
        if (!targetDateStr) return false;
        
        const targetDate = new Date(targetDateStr);
        targetDate.setHours(0, 0, 0, 0);
        
        const diffTime = targetDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        switch (filters.dueOverdue) {
          case 'overdue':
            return diffDays < 0;
          case 'due1month':
            return diffDays >= 0 && diffDays <= 30;
          case 'due2months':
            return diffDays >= 0 && diffDays <= 60;
          default:
            return true;
        }
      });
    }
    
    return result;
  }, [defects, selectedVesselNames, filters.dueOverdue]);
  
  const canEdit = () => {
    const role = currentUser?.role || '';
    return ["Master", "Chief Engineer", "Superintendent", "Admin", "Ship", "Office", "PMS Admin"].includes(role);
  };
  
  const canLink = () => {
    const role = currentUser?.role || '';
    return ["Chief Engineer", "Superintendent", "Admin", "Office", "PMS Admin"].includes(role);
  };
  
  const handleViewClick = (defect: Defect) => {
    setViewModal({ open: true, defectId: defect.id });
  };
  
  const handleEditClick = (defect: Defect) => {
    if (!canEdit()) return;
    setEditModal({ open: true, defectId: defect.id });
  };
  
  const handleLinkClick = (defect: Defect) => {
    if (!canLink()) return;
    setLinkModal({ open: true, defectId: defect.id, linkedDefects: defect.linkedDefects || [] });
  };
  
  const handleDeleteClick = (defect: Defect) => {
    console.log('Delete clicked for defect:', defect.id);
  };
  
  const canVerify = () => {
    const role = currentUser?.role || '';
    return ['Office', 'PMS Admin'].includes(role);
  };
  
  const verifyMutation = useMutation({
    mutationFn: async ({ defectId, verificationData }: { defectId: string; verificationData: Partial<Defect> }) => {
      const response = await apiRequest('PATCH', `/technical/api/defects/${defectId}`, verificationData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['defects'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update verification status",
        variant: "destructive"
      });
    }
  });
  
  const handleVerifyClick = (defect: Defect) => {
    if (!canVerify()) return;
    
    if (defect.verified) {
      setUnverifyDialog({ open: true, defect });
    } else {
      const today = new Date().toISOString().split('T')[0];
      const verificationData = {
        verified: true,
        dateVerified: today,
        verifiedByName: currentUser?.fullName || '',
        verifiedByOfficePosition: currentUser?.crewDesignation || currentUser?.role || ''
      };
      
      verifyMutation.mutate({ defectId: defect.id, verificationData }, {
        onSuccess: () => {
          toast({
            title: "Verified",
            description: `Defect ${defect.id} has been verified successfully.`
          });
        }
      });
    }
  };
  
  const handleConfirmUnverify = () => {
    if (!unverifyDialog.defect) return;
    
    const verificationData = {
      verified: false,
      dateVerified: null,
      verifiedByName: null,
      verifiedByOfficePosition: null
    };
    
    verifyMutation.mutate({ defectId: unverifyDialog.defect.id, verificationData }, {
      onSuccess: () => {
        toast({
          title: "Verification Removed",
          description: `Verification record for defect ${unverifyDialog.defect?.id} has been deleted.`
        });
        setUnverifyDialog({ open: false, defect: null });
      }
    });
  };

  const onGridReady = useCallback((params: GridReadyEvent) => {
    setGridApi(params.api);
    params.api.sizeColumnsToFit();
  }, []);

  useEffect(() => {
    if (!gridApi) return;
    
    const handleResize = () => {
      setTimeout(() => {
        gridApi.sizeColumnsToFit();
      }, 100);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [gridApi]);

  const columnDefs: ColDef[] = [
    {
      headerName: 'ID',
      field: 'id',
      flex: 1,
      cellStyle: { fontSize: '13px', color: '#2563eb' },
      filter: 'agTextColumnFilter',
      sortable: true,
      resizable: true
    },
    {
      headerName: 'Vessel',
      field: 'vesselName',
      flex: 0.8,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agSetColumnFilter',
      sortable: true,
      resizable: true
    },
    {
      headerName: 'Issue Date',
      field: 'issueDate',
      flex: 0.6,
      cellRenderer: TwoLineDateCellRenderer,
      filter: 'agDateColumnFilter',
      sortable: true,
      resizable: true
    },
    {
      headerName: 'Category',
      field: 'category',
      flex: 0.7,
      cellRenderer: CategoryCellRenderer,
      cellClass: 'flex items-center justify-center',
      filter: 'agSetColumnFilter',
      sortable: true,
      resizable: true
    },
    {
      headerName: 'Component',
      field: 'componentHardwareLevel3',
      flex: 0.8,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agTextColumnFilter',
      sortable: true,
      resizable: true,
      valueFormatter: (params) => params.value || '-'
    },
    {
      headerName: 'Description',
      field: 'description',
      flex: 1.5,
      cellRenderer: HtmlTextCellRenderer,
      autoHeight: true,
      wrapText: true,
      filter: 'agTextColumnFilter',
      sortable: true,
      resizable: true,
      tooltipValueGetter: (params) => stripHtmlTags(params.value)
    },
    {
      headerName: 'Action Taken / Requested',
      field: 'actionTakenRequested',
      flex: 1.5,
      cellRenderer: HtmlTextCellRenderer,
      autoHeight: true,
      wrapText: true,
      filter: 'agTextColumnFilter',
      sortable: true,
      resizable: true,
      hide: true,
      tooltipValueGetter: (params) => stripHtmlTags(params.value)
    },
    {
      headerName: 'Target Date',
      field: 'targetCloseDate',
      flex: 0.6,
      cellRenderer: TwoLineDateCellRenderer,
      filter: 'agDateColumnFilter',
      sortable: true,
      resizable: true
    },
    {
      headerName: 'Date Compl.',
      field: 'dateCompleted',
      flex: 0.6,
      cellRenderer: TwoLineDateCellRenderer,
      filter: 'agDateColumnFilter',
      sortable: true,
      resizable: true
    },
    {
      headerName: 'Status',
      field: 'status',
      flex: 0.6,
      cellRenderer: StatusCellRenderer,
      cellClass: 'flex items-center justify-center',
      filter: 'agSetColumnFilter',
      sortable: true,
      resizable: true
    },
    {
      headerName: 'Priority',
      field: 'priority',
      flex: 0.6,
      cellRenderer: PriorityCellRenderer,
      cellClass: 'flex items-center justify-center',
      filter: 'agSetColumnFilter',
      sortable: true,
      resizable: true
    },
    {
      headerName: 'Actions',
      field: 'actions',
      flex: 0.8,
      cellRenderer: ActionsCellRenderer,
      sortable: false,
      filter: false,
      cellClass: 'flex items-center justify-center'
    }
  ];

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>
      <div className="flex-shrink-0">
        <div className="flex items-center justify-between mb-4 gap-4">
          <h1 className="text-2xl font-bold text-black dark:text-white">Defects Log</h1>
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
              className="bg-[#5dc86f] hover:bg-[#4db85f] text-white h-8" 
              size="sm" 
              data-testid="button-new-defect"
              onClick={() => setNewDefectModalOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              New Defect
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="flex items-center gap-3 mb-4 bg-transparent">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <Select value={filters.period} onValueChange={(value) => handleFilterChange('period', value)}>
                <SelectTrigger className="w-[120px] h-8 text-xs border-gray-300 bg-transparent text-gray-700">
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

            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search Defect"
                value={filters.search || ""}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="w-[140px] h-8 text-xs pl-8 border-gray-300 bg-transparent text-gray-700"
              />
            </div>

            <VesselFleetGroupFilter 
              value={vesselFilterValue}
              onChange={handleVesselFilterChange}
              showClearButton={false}
            />

            <Select value={filters.dueOverdue} onValueChange={(value) => handleFilterChange('dueOverdue', value)}>
              <SelectTrigger className="w-[130px] h-8 text-xs border-gray-300 bg-transparent text-gray-700">
                <SelectValue placeholder="Due / Overdue" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="due2months">Due in 2 months</SelectItem>
                <SelectItem value="due1month">Due in 1 month</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              onClick={handleClearFilters}
              variant="outline" 
              className="h-8 px-4 text-xs border-gray-300 bg-transparent text-gray-700 hover:bg-gray-100"
            >
              Clear
            </Button>
          </div>
        )}
      </div>

      <div className="px-4 flex-1 flex flex-col min-h-0">
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading defects...</div>
        ) : (
          <>
            <div className="flex-1 min-h-0">
              <AgGridTable
                rowData={filteredDefects}
                columnDefs={columnDefs}
                onGridReady={onGridReady}
                enableSideBar={true}
                enableStatusBar={true}
                enableRowGrouping={true}
                height="100%"
                gridOptions={{
                  domLayout: 'normal'
                }}
                context={{
                  handleViewClick,
                  handleEditClick,
                  handleLinkClick,
                  handleDeleteClick,
                  handleVerifyClick,
                  canEdit,
                  canLink,
                  canVerify,
                  isVerifying: verifyMutation.isPending
                }}
              />
            </div>
            
            <div className="flex-shrink-0 py-2">
              <AgGridTableActions
                gridApi={gridApi}
                exportFilename="defects_log"
                showExportButtons={true}
                showFilterButtons={true}
                showGroupButtons={true}
              />
            </div>
          </>
        )}
      </div>
      
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

      <AlertDialog open={unverifyDialog.open} onOpenChange={(open) => !open && !verifyMutation.isPending && setUnverifyDialog({ open: false, defect: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Verification Record?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the verification record for defect {unverifyDialog.defect?.id}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={verifyMutation.isPending}>No</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmUnverify} disabled={verifyMutation.isPending}>
              {verifyMutation.isPending ? "Processing..." : "Yes"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
