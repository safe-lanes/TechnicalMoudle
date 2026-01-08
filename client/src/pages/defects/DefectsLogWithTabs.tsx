import { useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  AlertTriangle, 
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
import { useLocation } from "wouter";
import LinkDefectsModal from "./LinkDefectsModal";
import DefectModal from "./DefectModal";
import { cn } from "@/lib/utils";
import type { Defect } from "@shared/schema";
import AgGridTable from "@/components/AgGrid/AgGridTable";
import AgGridTableActions from "@/components/AgGrid/AgGridTableActions";
import { ICellRendererParams, GridReadyEvent, GridApi, ColDef } from "ag-grid-community";

interface DefectsFilters {
  period?: string;
  search?: string;
  vesselId?: string;
  fleet?: string;
  addGroup?: string;
  dueOverdue?: string;
  type?: string;
}

const CURRENT_USER_ROLE = "Admin";

interface ActionsCellContext {
  handleViewClick: (data: Defect) => void;
  handleEditClick: (data: Defect) => void;
  handleLinkClick: (data: Defect) => void;
  handleDeleteClick: (data: Defect) => void;
  canEdit: () => boolean;
  canLink: () => boolean;
}

const StatusCellRenderer = (params: ICellRendererParams) => {
  if (!params.colDef || !params.data) return null;
  
  const status = params.value || 'Open';
  const critical = params.data.critical;
  
  if (status === "Closed") {
    return (
      <div className="flex items-center justify-center">
        <CheckCircle className="h-4 w-4 text-green-600" />
      </div>
    );
  }
  if (critical) {
    return (
      <div className="flex items-center justify-center">
        <AlertTriangle className="h-4 w-4 text-red-600" />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center">
      <Clock className="h-4 w-4 text-amber-600" />
    </div>
  );
};

const CategoryCellRenderer = (params: ICellRendererParams) => {
  if (!params.colDef || !params.data) return null;
  
  const category = params.value || 'Defect';
  const variant = category === 'COC' ? 'destructive' : 'secondary';
  
  return (
    <Badge variant={variant} className="text-xs">
      {category}
    </Badge>
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
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
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
        </TooltipTrigger>
        <TooltipContent 
          side="bottom" 
          sideOffset={5}
          className="max-w-[400px] whitespace-pre-wrap text-sm z-[9999]"
        >
          <p>{plainText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const ActionsCellRenderer = (params: ICellRendererParams & { context: ActionsCellContext }) => {
  if (!params.colDef || !params.data) return null;
  
  const defect = params.data as Defect;
  const { handleViewClick, handleEditClick, handleLinkClick, handleDeleteClick, canEdit, canLink } = params.context;
  
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
  const [filters, setFilters] = useState<DefectsFilters>({});
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
      return data.map((defect: Defect) => ({
        ...defect,
        actionTakenRequested: defect.actionTakenRequested || 
          (defect.actions && defect.actions.length > 0 
            ? defect.actions[0].actionDescription 
            : '')
      }));
    },
  });

  const handleFilterChange = (key: keyof DefectsFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setFilters({});
  };
  
  const canEdit = () => {
    return ["Master", "Chief Engineer", "Superintendent", "Admin"].includes(CURRENT_USER_ROLE);
  };
  
  const canLink = () => {
    return ["Chief Engineer", "Superintendent", "Admin"].includes(CURRENT_USER_ROLE);
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
      flex: 0.8,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
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
      headerName: 'Description',
      field: 'description',
      flex: 1.5,
      cellRenderer: HtmlTextCellRenderer,
      autoHeight: true,
      wrapText: true,
      filter: 'agTextColumnFilter',
      sortable: true,
      resizable: true
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
      resizable: true
    },
    {
      headerName: 'Target Date',
      field: 'targetCloseDate',
      flex: 0.8,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agDateColumnFilter',
      sortable: true,
      resizable: true
    },
    {
      headerName: 'Date Compl.',
      field: 'dateCompleted',
      flex: 0.8,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
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
    <div className="flex flex-col bg-gray-50 dark:bg-gray-900" style={{ height: 'calc(100vh - 120px)' }}>
      <div className="pt-2 px-4 flex-shrink-0">
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

        {showFilters && (
          <div className="flex flex-wrap gap-2 mb-4 bg-transparent rounded-lg">
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

            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#8798ad]" />
              <Input
                placeholder="Search Defect"
                value={filters.search || ""}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="w-[180px] h-8 text-xs pl-8 text-[#8798ad]"
              />
            </div>

            <Select value={filters.vesselId} onValueChange={(value) => handleFilterChange('vesselId', value)}>
              <SelectTrigger className="w-[150px] h-8 text-xs text-[#8798ad]">
                <SelectValue placeholder="Vessel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="V001">Vessel 1</SelectItem>
                <SelectItem value="V002">Vessel 2</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.fleet} onValueChange={(value) => handleFilterChange('fleet', value)}>
              <SelectTrigger className="w-[150px] h-8 text-xs text-[#8798ad]">
                <SelectValue placeholder="Fleet" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fleet1">Fleet 1</SelectItem>
                <SelectItem value="fleet2">Fleet 2</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.addGroup} onValueChange={(value) => handleFilterChange('addGroup', value)}>
              <SelectTrigger className="w-[150px] h-8 text-xs text-[#8798ad]">
                <SelectValue placeholder="Add Group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="department">Department</SelectItem>
                <SelectItem value="priority">Priority</SelectItem>
              </SelectContent>
            </Select>

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

      <div className="px-4 flex-1 flex flex-col min-h-0">
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading defects...</div>
        ) : (
          <>
            <div className="flex-1 min-h-0">
              <AgGridTable
                rowData={defects}
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
                  canEdit,
                  canLink
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
    </div>
  );
}
