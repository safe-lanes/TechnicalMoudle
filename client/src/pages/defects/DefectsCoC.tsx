import { useState, useEffect, useCallback } from "react";
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
  Paperclip, 
  Link as LinkIcon, 
  Plus, 
  Filter,
  Search
} from "lucide-react";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import DefectFormWizard from "./DefectFormWizard";
import AddNoteModal from "./AddNoteModal";
import LinkDefectsModal from "./LinkDefectsModal";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { Defect } from "@shared/schema";
import AgGridTable from "@/components/AgGrid/AgGridTable";
import { ICellRendererParams, GridReadyEvent, GridApi, ColDef } from "ag-grid-community";

interface DefectsFilters {
  period?: string;
  search?: string;
  vesselId?: string;
  fleet?: string;
  dueOverdue?: string;
  status?: string;
}

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

const TwoLineDateCellRenderer = (params: ICellRendererParams) => {
  if (!params.value) return null;
  
  try {
    const date = new Date(params.value);
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
  
  return (
    <div className="flex items-center gap-1">
      <span className="text-[13px] text-[#4f5863]">{category}</span>
      <Badge className="bg-blue-100 text-blue-700 text-[10px] py-0 px-1">
        CoC
      </Badge>
    </div>
  );
};

interface ActionsCellContext {
  handleViewClick: (data: Defect) => void;
  handleEditClick: (data: Defect) => void;
  handleNoteClick: (data: Defect) => void;
  handleLinkClick: (data: Defect) => void;
  handleCloseClick: (data: Defect) => void;
}

const ActionsCellRenderer = (params: ICellRendererParams & { context: ActionsCellContext }) => {
  if (!params.colDef || !params.data) return null;
  
  const defect = params.data as Defect;
  const isActiveDefect = ['Open', 'Pending', 'In-Progress', 'Awaiting Parts', 'Deferred'].includes(defect.status);
  const { handleViewClick, handleEditClick, handleNoteClick, handleLinkClick, handleCloseClick } = params.context;
  
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
              data-testid={`button-view-coc-${defect.id}`}
            >
              <Eye className="h-4 w-4 text-gray-500" />
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>View</p></TooltipContent>
        </Tooltip>
        
        {isActiveDefect && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-6 w-6"
                  onClick={() => handleEditClick(defect)}
                  data-testid={`button-edit-coc-${defect.id}`}
                >
                  <Edit className="h-4 w-4 text-gray-500" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Edit</p></TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-6 w-6"
                  onClick={() => handleNoteClick(defect)}
                  data-testid={`button-note-coc-${defect.id}`}
                >
                  <Paperclip className="h-4 w-4 text-gray-500" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Add Note</p></TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-6 w-6"
                  onClick={() => handleLinkClick(defect)}
                  data-testid={`button-link-coc-${defect.id}`}
                >
                  <LinkIcon className="h-4 w-4 text-gray-500" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Link Defects</p></TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-6 w-6"
                  onClick={() => handleCloseClick(defect)}
                  data-testid={`button-close-coc-${defect.id}`}
                >
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Close/Complete</p></TooltipContent>
            </Tooltip>
          </>
        )}
      </TooltipProvider>
    </div>
  );
};

export default function DefectsCoC() {
  const { toast } = useToast();
  const [filters, setFilters] = useState<DefectsFilters>({ status: 'active' });
  const [showFilters, setShowFilters] = useState(false);
  const [showNewDefectForm, setShowNewDefectForm] = useState(false);
  const [selectedDefect, setSelectedDefect] = useState<Defect | null>(null);
  const [defectFormMode, setDefectFormMode] = useState<'view' | 'edit' | 'new'>('new');
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [closeModal, setCloseModal] = useState<{ open: boolean; defect: Defect | null }>({ 
    open: false, 
    defect: null 
  });
  const [addNoteModal, setAddNoteModal] = useState<{ open: boolean; defectId: string | null }>({ open: false, defectId: null });
  const [linkModal, setLinkModal] = useState<{ open: boolean; defectId: string | null; linkedDefects: string[] }>({ open: false, defectId: null, linkedDefects: [] });

  // Get CoC defects only
  const { data: allDefects = [], isLoading } = useQuery({
    queryKey: ['/technical/api/defects', { ...filters, is_coc: true }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('is_coc', 'true');
      
      if (filters.vesselId) params.append('vesselId', filters.vesselId);
      if (filters.search) params.append('search', filters.search);
      if (filters.period) params.append('period', filters.period);
      if (filters.fleet) params.append('fleet', filters.fleet);
      if (filters.dueOverdue && filters.status === 'active') params.append('dueOverdue', filters.dueOverdue);
      
      const response = await fetch(`/technical/api/defects?${params}`);
      if (!response.ok) throw new Error('Failed to fetch CoC defects');
      return response.json();
    },
  });

  // Filter defects based on status filter
  const defects = allDefects.filter((defect: Defect) => {
    if (!filters.status || filters.status === 'active') {
      return ['Open', 'Pending', 'In-Progress', 'Awaiting Parts', 'Deferred'].includes(defect.status);
    } else if (filters.status === 'resolved') {
      return ['Closed', 'Cancelled'].includes(defect.status);
    }
    return true;
  });

  const includesResolved = filters.status === 'resolved' || filters.status === 'all';

  const handleFilterChange = (key: keyof DefectsFilters, value: any) => {
    setFilters(prev => {
      const newFilters = { ...prev, [key]: value };
      if (key === 'status' && value !== 'active') {
        delete newFilters.dueOverdue;
      }
      return newFilters;
    });
  };

  const handleClearFilters = () => {
    setFilters({ status: 'active' });
  };

  const handleViewDefect = useCallback((defect: Defect) => {
    console.log('[COC] handleViewDefect called with:', defect.id);
    setSelectedDefect(defect);
    setDefectFormMode('view');
    setShowNewDefectForm(true);
    console.log('[COC] Dialog should now be open');
  }, []);

  const handleEditDefect = useCallback((defect: Defect) => {
    console.log('[COC] handleEditDefect called with:', defect.id);
    setSelectedDefect(defect);
    setDefectFormMode('edit');
    setShowNewDefectForm(true);
    console.log('[COC] Dialog should now be open');
  }, []);

  const handleNewDefect = () => {
    setSelectedDefect(null);
    setDefectFormMode('new');
    setShowNewDefectForm(true);
  };

  const handleNoteClick = useCallback((defect: Defect) => {
    setAddNoteModal({ open: true, defectId: defect.id });
  }, []);

  const handleLinkClick = useCallback((defect: Defect) => {
    setLinkModal({ open: true, defectId: defect.id, linkedDefects: defect.linkedDefects || [] });
  }, []);

  const handleCloseClick = useCallback((defect: Defect) => {
    setCloseModal({ open: true, defect });
  }, []);

  const onGridReady = useCallback((event: GridReadyEvent) => {
    setGridApi(event.api);
    event.api.sizeColumnsToFit();
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
      flex: 0.8,
      cellStyle: { fontSize: '13px', color: '#2563eb' },
      filter: 'agTextColumnFilter',
      sortable: true,
      resizable: true
    },
    {
      headerName: 'Vessel',
      field: 'vesselName',
      flex: 0.7,
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
      flex: 0.8,
      cellRenderer: CategoryCellRenderer,
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
    ...(includesResolved ? [{
      headerName: 'Date Compl.',
      field: 'dateCompleted',
      flex: 0.6,
      cellRenderer: TwoLineDateCellRenderer,
      filter: 'agDateColumnFilter',
      sortable: true,
      resizable: true
    }] : []),
    {
      headerName: 'Status',
      field: 'status',
      flex: 0.5,
      cellRenderer: StatusCellRenderer,
      cellClass: 'flex items-center justify-center',
      filter: 'agSetColumnFilter',
      sortable: true,
      resizable: true
    },
    {
      headerName: 'Actions',
      field: 'actions',
      flex: 0.9,
      cellRenderer: ActionsCellRenderer,
      sortable: false,
      filter: false,
      cellClass: 'flex items-center justify-center'
    }
  ];

  const invalidateCoCQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['/technical/api/defects'] });
    queryClient.invalidateQueries({ 
      predicate: (query) => {
        const queryKey = query.queryKey;
        return Array.isArray(queryKey) && 
               queryKey[0] === '/technical/api/defects' && 
               queryKey[1] && 
               typeof queryKey[1] === 'object' && 
               'is_coc' in queryKey[1];
      }
    });
  };

  return (
    <div className="flex flex-col bg-gray-50 dark:bg-gray-900" style={{ height: 'calc(100vh - 120px)' }}>
      {/* Header */}
      <div className="pt-2 px-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4 gap-4">
          <h1 className="text-2xl font-bold text-black dark:text-white">Condition of Class (CoC) Defects</h1>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="h-8 gap-2 bg-white dark:bg-gray-800 text-[#0f172a] dark:text-white border-gray-300 dark:border-gray-600"
              data-testid="button-toggle-coc-filters"
            >
              <Filter className="h-4 w-4" />
              Filters
            </Button>
            <Dialog open={showNewDefectForm} onOpenChange={setShowNewDefectForm}>
              <DialogTrigger asChild>
                <Button 
                  className="bg-green-600 hover:bg-green-700 text-white h-8" 
                  size="sm" 
                  data-testid="button-new-coc-defect"
                  onClick={handleNewDefect}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  New CoC Defect
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto p-0" aria-describedby={undefined}>
                <VisuallyHidden>
                  <DialogTitle>
                    {defectFormMode === 'new' ? 'New CoC Defect' : defectFormMode === 'edit' ? 'Edit CoC Defect' : 'View CoC Defect'}
                  </DialogTitle>
                </VisuallyHidden>
                <DefectFormWizard 
                  defect={selectedDefect}
                  mode={defectFormMode}
                  isCoc={true}
                  onCompleted={() => {
                    setShowNewDefectForm(false);
                    setSelectedDefect(null);
                    invalidateCoCQueries();
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Collapsible Filters */}
        {showFilters && (
          <div className="flex flex-wrap gap-2 mb-4 bg-transparent rounded-lg">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#8798ad]" />
              <Select value={filters.period} onValueChange={(value) => handleFilterChange('period', value)}>
                <SelectTrigger className="w-[120px] h-8 text-xs text-[#8798ad]">
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
                placeholder="Search CoC Defect"
                value={filters.search || ""}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="w-[160px] h-8 text-xs pl-8 text-[#8798ad]"
              />
            </div>

            <Select value={filters.vesselId} onValueChange={(value) => handleFilterChange('vesselId', value)}>
              <SelectTrigger className="w-[120px] h-8 text-xs text-[#8798ad]">
                <SelectValue placeholder="Vessel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="V001">Vessel 1</SelectItem>
                <SelectItem value="V002">Vessel 2</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.fleet} onValueChange={(value) => handleFilterChange('fleet', value)}>
              <SelectTrigger className="w-[120px] h-8 text-xs text-[#8798ad]">
                <SelectValue placeholder="Fleet" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fleet1">Fleet 1</SelectItem>
                <SelectItem value="fleet2">Fleet 2</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.status || 'active'} onValueChange={(value) => handleFilterChange('status', value)}>
              <SelectTrigger className="w-[120px] h-8 text-xs text-[#8798ad]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>

            {filters.status === 'active' && (
              <Select value={filters.dueOverdue} onValueChange={(value) => handleFilterChange('dueOverdue', value)}>
                <SelectTrigger className="w-[130px] h-8 text-xs text-[#8798ad]">
                  <SelectValue placeholder="Due / Overdue" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="due">Due Soon</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            )}

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

      {/* AG Grid Table */}
      <div className="px-4 flex-1 flex flex-col min-h-0">
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading CoC defects...</div>
        ) : (
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
                handleViewClick: handleViewDefect,
                handleEditClick: handleEditDefect,
                handleNoteClick,
                handleLinkClick,
                handleCloseClick
              }}
            />
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
              invalidateCoCQueries();
            }
          }}
        >
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto p-0" aria-describedby={undefined}>
            <VisuallyHidden>
              <DialogTitle>Close CoC Defect</DialogTitle>
            </VisuallyHidden>
            <DefectFormWizard
              defect={closeModal.defect}
              mode="edit"
              initialStep={3}
              onCompleted={() => {
                setCloseModal({ open: false, defect: null });
                invalidateCoCQueries();
              }}
            />
          </DialogContent>
        </Dialog>
      )}

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
