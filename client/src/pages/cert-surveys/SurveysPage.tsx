import { useState, useMemo, useCallback, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Plus, Paperclip, Calendar, Download } from 'lucide-react';
import { ColDef, GridReadyEvent, GridApi, ICellRendererParams, CellEditingStoppedEvent } from 'ag-grid-community';
import AgGridTable from '@/components/AgGrid/AgGridTable';
import AgGridTableActions from '@/components/AgGrid/AgGridTableActions';
import DateCellEditor from '@/components/AgGrid/DateCellEditor';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FiltersToggle } from '@/components/filters/VesselFilter';
import { VesselFleetGroupFilter, VesselFleetGroupFilterValue, VesselFleetGroupFilterResult, createDefaultFilterValue } from '@/components/filters/VesselFleetGroupFilter';
import { useUIRole } from "@/contexts/UIRoleContext";
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { FileAttachmentDialog, FileAttachment } from '@/components/FileAttachmentDialog';
import { pdfReportGenerator } from '@/lib/pdfReportGenerator';
import type { TableColumn } from '@/lib/pdfReportGenerator';

type DueInFilter = 'all' | '3months' | '2months' | '1month' | 'overdue';

const parseDisplayDate = (displayDate: string): string => {
  if (!displayDate) return '';
  const months: Record<string, string> = {
    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
    'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
    'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
  };
  const match = displayDate.match(/(\d{1,2})\s([A-Za-z]{3})\s(\d{4})/);
  if (match) {
    const [, day, monthStr, year] = match;
    const month = months[monthStr] || '01';
    return `${year}-${month}-${day.padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(displayDate)) return displayDate;
  return '';
};


interface SurveyData {
  id: string;
  companyId: string;
  surveyName: string;
  type: string;
  vessel: string;
  vesselId: string;
  masterId: string;
  surveyDate: string;
  dueDate: string;
  firstRangeDate: string;
  secondRangeDate: string;
  postponed: string;
  lastEdit: string;
  attachments?: FileAttachment[];
}

interface SurveysApiResponse {
  surveys: SurveyData[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const EDITABLE_DATE_FIELDS = ['surveyDate', 'dueDate', 'firstRangeDate', 'secondRangeDate', 'postponed'];

interface SurveyGridContext {
  onOpenAttachments?: (survey: SurveyData) => void;
  onDateChange?: (compoundId: string, field: string, newValue: string) => void;
}

interface ActionsCellRendererProps extends ICellRendererParams {
  context: SurveyGridContext;
}

const ActionsCellRenderer = (params: ActionsCellRendererProps) => {
  if (!params.colDef || !params.data) return null;
  
  const handleAttachmentClick = () => {
    if (params.context?.onOpenAttachments) {
      params.context.onOpenAttachments(params.data);
    }
  };

  const attachmentCount = params.data.attachments?.length || 0;
  
  return (
    <div className="flex gap-1 justify-center items-center h-full">
      <button 
        className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
        onClick={handleAttachmentClick}
        data-testid={`button-attachment-${params.data.id}`}
      >
        <Paperclip className="h-4 w-4 text-gray-500" />
        {attachmentCount > 0 && (
          <span className="text-[11px] font-medium text-[#52baf3]">
            {attachmentCount}
          </span>
        )}
      </button>
    </div>
  );
};

export default function SurveysPage() {
  const { isClientAdmin, isSailAdmin } = useUIRole();
  const [showFilters, setShowFilters] = useState(true);
  const [filterValue, setFilterValue] = useState<VesselFleetGroupFilterValue>(createDefaultFilterValue());
  const [selectedVesselNames, setSelectedVesselNames] = useState<string[]>([]);
  const [dueInFilter, setDueInFilter] = useState<DueInFilter>('all');
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [attachmentSheetOpen, setAttachmentSheetOpen] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState<SurveyData | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 100;
  const { toast } = useToast();
  const surveyInvalidateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Build API URL with vessel filter and pagination
  const apiUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', currentPage.toString());
    params.set('limit', pageSize.toString());
    
    // Pass vessel name filter to API
    if (selectedVesselNames.length === 1) {
      params.set('vesselName', selectedVesselNames[0]);
    } else if (selectedVesselNames.length > 1) {
      // Pass multiple vessel names as comma-separated string
      params.set('vesselNames', selectedVesselNames.join(','));
    }
    
    return `/technical/api/surveys?${params.toString()}`;
  }, [currentPage, selectedVesselNames]);

  const { data: surveysResponse, isLoading } = useQuery<SurveysApiResponse>({
    queryKey: ['/technical/api/surveys', currentPage, selectedVesselNames],
    queryFn: async () => {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch surveys');
      }
      return response.json();
    },
  });
  
  const surveys = surveysResponse?.surveys || [];
  const totalSurveys = surveysResponse?.total || 0;
  const totalPages = surveysResponse?.totalPages || 1;

  const handleFilterChange = useCallback((result: VesselFleetGroupFilterResult) => {
    setFilterValue({
      mode: result.mode,
      selectedVessels: result.selectedVessels,
      selectedFleets: result.selectedFleets,
      selectedGroups: result.selectedGroups,
    });
    setSelectedVesselNames(result.selectedVesselNames);
    setCurrentPage(1); // Reset to page 1 when filters change
  }, []);

  const filteredSurveys = useMemo(() => {
    let result = surveys;
    
    if (selectedVesselNames.length > 0) {
      const normalizedFilterNames = selectedVesselNames.map(n => n.toLowerCase().trim());
      result = result.filter(survey => {
        const surveyVessel = (survey.vessel || '').toLowerCase().trim();
        return normalizedFilterNames.some(filterName => 
          filterName === surveyVessel || surveyVessel.includes(filterName) || filterName.includes(surveyVessel)
        );
      });
    }
    
    if (dueInFilter !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      result = result.filter(survey => {
        if (!survey.dueDate) return false;
        
        const dueDateStr = parseDisplayDate(survey.dueDate);
        if (!dueDateStr) return false;
        
        const dueDate = new Date(dueDateStr);
        dueDate.setHours(0, 0, 0, 0);
        
        const isOverdue = dueDate < today;
        
        if (dueInFilter === 'overdue') {
          return isOverdue;
        }
        
        if (isOverdue) return true;
        
        const monthsAhead = dueInFilter === '3months' ? 3 : dueInFilter === '2months' ? 2 : 1;
        const thresholdDate = new Date(today);
        thresholdDate.setMonth(thresholdDate.getMonth() + monthsAhead);
        
        return dueDate <= thresholdDate;
      });
    }
    
    // Sort by priority: Overdue (red) first, Due within 60 days (amber) second, Normal last
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sixtyDaysFromNow = new Date(today);
    sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60);
    
    const getPriority = (survey: SurveyData): number => {
      if (!survey.dueDate) return 3; // No date = lowest priority
      
      const dueDateStr = parseDisplayDate(survey.dueDate);
      if (!dueDateStr) return 3;
      
      const dueDate = new Date(dueDateStr);
      dueDate.setHours(0, 0, 0, 0);
      
      if (dueDate < today) return 0; // Overdue (red) - highest priority
      if (dueDate <= sixtyDaysFromNow) return 1; // Due within 60 days (amber)
      return 2; // Normal
    };
    
    result = [...result].sort((a, b) => {
      const priorityA = getPriority(a);
      const priorityB = getPriority(b);
      if (priorityA !== priorityB) return priorityA - priorityB;
      
      // Within same priority, sort by due date (earliest first)
      const dateA = parseDisplayDate(a.dueDate || '') || '';
      const dateB = parseDisplayDate(b.dueDate || '') || '';
      return new Date(dateA).getTime() - new Date(dateB).getTime();
    });
    
    return result;
  }, [surveys, selectedVesselNames, dueInFilter]);

  const updateSurveyMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<SurveyData> }) => {
      return apiRequest('PATCH', `/technical/api/surveys/${id}`, updates);
    },
    onSuccess: (_data, variables) => {
      // Optimistic cache update: patch the changed row in-place to avoid full grid re-render
      queryClient.setQueriesData<SurveysApiResponse>(
        { queryKey: ['/technical/api/surveys'] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            surveys: old.surveys.map((survey) => {
              const surveyKey = `${survey.vesselId}::${survey.masterId}`;
              if (surveyKey === variables.id) {
                return { ...survey, ...variables.updates };
              }
              return survey;
            }),
          };
        }
      );
      toast({
        title: 'Updated',
        description: 'Survey updated successfully.',
      });
      if (surveyInvalidateTimer.current) {
        clearTimeout(surveyInvalidateTimer.current);
      }
      surveyInvalidateTimer.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['/technical/api/surveys'] });
        surveyInvalidateTimer.current = null;
      }, 5000);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update survey',
        variant: 'destructive',
      });
      queryClient.invalidateQueries({ queryKey: ['/technical/api/surveys'] });
    },
  });


  const handleOpenAttachments = useCallback((survey: SurveyData) => {
    setSelectedSurvey(survey);
    setAttachmentSheetOpen(true);
  }, []);

  const handleAttachmentsChange = useCallback((attachments: FileAttachment[]) => {
    if (selectedSurvey && selectedSurvey.vesselId && selectedSurvey.masterId) {
      const compoundId = `${selectedSurvey.vesselId}::${selectedSurvey.masterId}`;
      updateSurveyMutation.mutate({
        id: compoundId,
        updates: { attachments },
      });
      setSelectedSurvey(prev => prev ? { ...prev, attachments } : null);
    }
  }, [selectedSurvey, updateSurveyMutation]);

  const handleCellEditingStopped = useCallback((event: CellEditingStoppedEvent) => {
    const { data, colDef, value, oldValue } = event;
    
    console.log('[SurveysPage] onCellEditingStopped fired:', { 
      field: colDef.field, 
      oldValue, 
      value, 
      dataId: data?.id,
      vesselId: data?.vesselId,
      masterId: data?.masterId
    });
    
    const field = colDef.field;
    if (!field || !data?.vesselId || !data?.masterId) return;
    
    // For date fields, the DateCellEditor's handleDateChange already handles the save
    // Skip duplicate PATCH call here
    if (EDITABLE_DATE_FIELDS.includes(field)) {
      console.log('[SurveysPage] Skipping onCellEditingStopped for date field (handled by DateCellEditor)');
      return;
    }
    
    if (value === oldValue) {
      console.log('[SurveysPage] Value not changed, skipping update');
      return;
    }
  }, [updateSurveyMutation]);

  const handleDateChange = useCallback((compoundId: string, field: string, newValue: string, _rowData?: any) => {
    console.log('[SurveysPage] handleDateChange called:', { compoundId, field, newValue });
    
    updateSurveyMutation.mutate({
      id: compoundId,
      updates: {
        [field]: newValue,
      },
    });
  }, [updateSurveyMutation]);

  const gridContext = useMemo(() => ({
    onOpenAttachments: handleOpenAttachments,
    onDateChange: handleDateChange,
  }), [handleOpenAttachments, handleDateChange]);

  const columnDefs: ColDef[] = useMemo(() => [
    {
      headerName: 'Company ID',
      field: 'companyId',
      width: 90,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agTextColumnFilter',
      sortable: true,
      resizable: true,
      pinned: 'left',
    },
    {
      headerName: 'Survey',
      field: 'surveyName',
      flex: 1.5,
      minWidth: 200,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agTextColumnFilter',
      sortable: true,
      resizable: true,
      wrapText: true,
      autoHeight: true,
    },
    {
      headerName: 'Company Group',
      field: 'type',
      width: 120,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agSetColumnFilter',
      sortable: true,
      resizable: true,
    },
    {
      headerName: 'Vessel',
      field: 'vessel',
      flex: 1,
      minWidth: 150,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agSetColumnFilter',
      sortable: true,
      resizable: true,
    },
    {
      headerName: 'Survey Date',
      field: 'surveyDate',
      width: 120,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agDateColumnFilter',
      sortable: true,
      resizable: true,
      editable: true,
      cellEditor: DateCellEditor,
      cellClass: 'editable-date-cell',
    },
    {
      headerName: 'Due Date',
      field: 'dueDate',
      width: 120,
      cellStyle: (params: any) => {
        const baseStyle = { fontSize: '13px' };
        if (!params.value) return { ...baseStyle, color: '#4f5863' };
        
        const months: { [key: string]: number } = { 
          'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
          'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11 
        };
        const parts = params.value.split(' ');
        if (parts.length !== 3) return { ...baseStyle, color: '#4f5863' };
        
        const day = parseInt(parts[0], 10);
        const month = months[parts[1]];
        const year = parseInt(parts[2], 10);
        if (isNaN(day) || month === undefined || isNaN(year)) return { ...baseStyle, color: '#4f5863' };
        
        const dueDate = new Date(year, month, day);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const twoMonthsFromNow = new Date(today);
        twoMonthsFromNow.setMonth(twoMonthsFromNow.getMonth() + 2);
        
        if (dueDate < today) {
          return { ...baseStyle, color: '#dc2626', fontWeight: '600' };
        } else if (dueDate <= twoMonthsFromNow) {
          return { ...baseStyle, color: '#f59e0b', fontWeight: '600' };
        }
        return { ...baseStyle, color: '#4f5863' };
      },
      filter: 'agDateColumnFilter',
      sortable: true,
      resizable: true,
      editable: true,
      cellEditor: DateCellEditor,
      cellClass: 'editable-date-cell',
    },
    {
      headerName: '1st Range Date',
      field: 'firstRangeDate',
      width: 130,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agDateColumnFilter',
      sortable: true,
      resizable: true,
      editable: true,
      cellEditor: DateCellEditor,
      cellClass: 'editable-date-cell',
    },
    {
      headerName: '2nd Range Date',
      field: 'secondRangeDate',
      width: 130,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agDateColumnFilter',
      sortable: true,
      resizable: true,
      editable: true,
      cellEditor: DateCellEditor,
      cellClass: 'editable-date-cell',
    },
    {
      headerName: 'Postponed',
      field: 'postponed',
      width: 120,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agDateColumnFilter',
      sortable: true,
      resizable: true,
      editable: true,
      cellEditor: DateCellEditor,
      cellClass: 'editable-date-cell',
    },
    {
      headerName: 'Last Edit',
      field: 'lastEdit',
      width: 100,
      cellStyle: { fontSize: '13px', color: '#888', fontStyle: 'italic' } as any,
      filter: 'agDateColumnFilter',
      sortable: true,
      resizable: true,
    },
    {
      headerName: 'Actions',
      field: 'actions',
      width: 80,
      cellRenderer: ActionsCellRenderer,
      sortable: false,
      filter: false,
      cellClass: 'flex items-center justify-center overflow-visible',
      cellStyle: { overflow: 'visible', paddingRight: '12px' } as any,
      pinned: 'right',
      lockPosition: true,
    },
  ], []);

  const onGridReady = useCallback((params: GridReadyEvent) => {
    setGridApi(params.api);
    params.api.sizeColumnsToFit();
    
    const handleResize = () => {
      setTimeout(() => {
        if (params.api && !params.api.isDestroyed()) {
          params.api.sizeColumnsToFit();
        }
      }, 100);
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleExportPdf = useCallback(() => {
    const columns: TableColumn[] = [
      { header: 'Company ID', field: 'companyId', width: 18 },
      { header: 'Survey', field: 'surveyName', width: 35 },
      { header: 'Company Group', field: 'type', width: 20 },
      { header: 'Vessel', field: 'vessel', width: 22 },
      { header: 'Survey Date', field: 'surveyDate', width: 20 },
      { header: 'Due Date', field: 'dueDate', width: 20 },
      { header: '1st Range Date', field: 'firstRangeDate', width: 20 },
      { header: '2nd Range Date', field: 'secondRangeDate', width: 20 },
      { header: 'Postponed', field: 'postponed', width: 20 },
      { header: 'Last Edit', field: 'lastEdit', width: 18 },
    ];

    const data = filteredSurveys.map((survey: any) => ({
      companyId: survey.companyId || '-',
      surveyName: survey.surveyName || '-',
      type: survey.type || '-',
      vessel: survey.vessel || '-',
      surveyDate: survey.surveyDate || '-',
      dueDate: survey.dueDate || '-',
      firstRangeDate: survey.firstRangeDate || '-',
      secondRangeDate: survey.secondRangeDate || '-',
      postponed: survey.postponed || '-',
      lastEdit: survey.lastEdit || '-',
    }));

    pdfReportGenerator.generateReport(
      {
        title: 'Surveys',
        subtitle: `Total: ${filteredSurveys.length} survey${filteredSurveys.length !== 1 ? 's' : ''}`,
        orientation: 'landscape',
      },
      columns,
      data
    );
  }, [filteredSurveys]);

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
      <div className="flex items-center justify-between flex-shrink-0 mb-2">
        <h1 className="text-2xl font-bold text-gray-900">Surveys</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs text-[#8798ad] border-[#e1e8ed]"
            onClick={handleExportPdf}
            data-testid="button-export-surveys-pdf"
          >
            <Download className="h-3.5 w-3.5 mr-1" />
            Export
          </Button>
          <FiltersToggle 
            isOpen={showFilters} 
            onToggle={() => setShowFilters(!showFilters)} 
          />
        </div>
      </div>

      {showFilters && (
        <div className="flex items-center gap-4 px-6 flex-shrink-0">
          {(isClientAdmin || isSailAdmin) && (
            <VesselFleetGroupFilter
              value={filterValue}
              onChange={handleFilterChange}
            />
          )}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <Select value={dueInFilter} onValueChange={(value: DueInFilter) => setDueInFilter(value)}>
              <SelectTrigger 
                className="w-[160px] h-8 text-xs bg-white border-gray-300"
                data-testid="select-due-in-filter"
              >
                <SelectValue placeholder="Due in..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="option-due-all">All</SelectItem>
                <SelectItem value="3months" data-testid="option-due-3months">Due in 3 months</SelectItem>
                <SelectItem value="2months" data-testid="option-due-2months">Due in 2 months</SelectItem>
                <SelectItem value="1month" data-testid="option-due-1month">Due in 1 month</SelectItem>
                <SelectItem value="overdue" data-testid="option-due-overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="px-6 py-2 flex-1 flex flex-col min-h-0">
        <Card className="border-0 shadow-none bg-[#f7fafc] rounded-lg flex-1 flex flex-col min-h-0">
          <CardContent className="p-2 bg-[#f7fafc] flex-1 flex flex-col min-h-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-48">
                <div className="text-gray-500">Loading surveys...</div>
              </div>
            ) : (
              <div className="flex-1 min-h-0" style={{ minHeight: '300px' }}>
                <AgGridTable
                  rowData={filteredSurveys}
                  columnDefs={columnDefs}
                  onGridReady={onGridReady}
                  onCellEditingStopped={handleCellEditingStopped}
                  context={gridContext}
                  getRowId={(params) => `${params.data.vesselId}::${params.data.masterId}`}
                  autoHeight={false}
                  height="100%"
                  minHeight="300px"
                  width="100%"
                  enableExport={true}
                  enableSideBar={true}
                  enableStatusBar={false}
                  enableRowGrouping={true}
                  enablePivoting={true}
                  enableAdvancedFilter={false}
                  rowSelection={false}
                  theme="alpine"
                  singleClickEdit={true}
                  stopEditingWhenCellsLoseFocus={true}
                  gridOptions={{ domLayout: 'normal' }}
                />
              </div>
            )}
            
            <div className="bg-white border-t border-gray-200 px-4 py-3 flex justify-between items-center flex-shrink-0" style={{ marginTop: '-1px' }}>
              <div className="text-xs font-normal font-['Mulish',Helvetica] text-black">
                {totalSurveys > 0 ? (
                  <>
                    Showing {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, totalSurveys)} of {totalSurveys}
                  </>
                ) : (
                  <>Rows: {filteredSurveys.length}</>
                )}
              </div>
              
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    data-testid="button-prev-page"
                  >
                    Previous
                  </Button>
                  <span className="text-xs text-gray-600">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    data-testid="button-next-page"
                  >
                    Next
                  </Button>
                </div>
              )}
              
              <div>
                <AgGridTableActions 
                  gridApi={gridApi}
                  exportFilename="surveys-export"
                  showExportButtons={true}
                  showFilterButtons={true}
                  showGroupButtons={true}
                  showSelectionButtons={false}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <FileAttachmentDialog
        open={attachmentSheetOpen}
        onOpenChange={setAttachmentSheetOpen}
        itemName={selectedSurvey?.surveyName || ''}
        attachments={selectedSurvey?.attachments || []}
        onAttachmentsChange={handleAttachmentsChange}
      />
    </div>
  );
}
