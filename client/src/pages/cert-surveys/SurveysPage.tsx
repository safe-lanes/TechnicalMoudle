import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Plus, Paperclip, Calendar } from 'lucide-react';
import { ColDef, GridReadyEvent, GridApi, ICellRendererParams, CellEditingStoppedEvent } from 'ag-grid-community';
import AgGridTable from '@/components/AgGrid/AgGridTable';
import AgGridTableActions from '@/components/AgGrid/AgGridTableActions';
import DateCellEditor from '@/components/AgGrid/DateCellEditor';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FiltersToggle } from '@/components/filters/VesselFilter';
import { VesselFleetGroupFilter, VesselFleetGroupFilterValue, VesselFleetGroupFilterResult, createDefaultFilterValue } from '@/components/filters/VesselFleetGroupFilter';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { FileAttachmentDialog, FileAttachment } from '@/components/FileAttachmentDialog';

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
  surveyName: string;
  type: string;
  vessel: string;
  surveyDate: string;
  dueDate: string;
  firstRangeDate: string;
  secondRangeDate: string;
  postponed: string;
  lastEdit: string;
  applicable: boolean;
  attachments?: FileAttachment[];
}

const EDITABLE_DATE_FIELDS = ['surveyDate', 'dueDate', 'firstRangeDate', 'secondRangeDate', 'postponed'];

interface ApplicableCellRendererProps extends ICellRendererParams {
  onToggleApplicable?: (id: string, newValue: boolean) => void;
}

const ApplicableCellRenderer = (params: ApplicableCellRendererProps) => {
  if (!params.colDef || !params.data) return null;
  
  const handleChange = (checked: boolean | 'indeterminate') => {
    if (params.context?.onToggleApplicable) {
      const boolValue = checked === true;
      params.context.onToggleApplicable(params.data.id, boolValue);
    }
  };
  
  return (
    <div className="flex items-center justify-center h-full">
      <Checkbox 
        checked={params.value} 
        onCheckedChange={handleChange}
        className="data-[state=checked]:bg-[#52baf3] data-[state=checked]:border-[#52baf3] cursor-pointer"
        data-testid={`checkbox-applicable-${params.data.id}`}
      />
    </div>
  );
};

interface SurveyGridContext {
  onOpenAttachments?: (survey: SurveyData) => void;
  onToggleApplicable?: (id: string, newValue: boolean) => void;
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
  const [showFilters, setShowFilters] = useState(true);
  const [filterValue, setFilterValue] = useState<VesselFleetGroupFilterValue>(createDefaultFilterValue());
  const [selectedVesselNames, setSelectedVesselNames] = useState<string[]>([]);
  const [dueInFilter, setDueInFilter] = useState<DueInFilter>('all');
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [attachmentSheetOpen, setAttachmentSheetOpen] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState<SurveyData | null>(null);
  const { toast } = useToast();

  const { data: surveys = [], isLoading } = useQuery<SurveyData[]>({
    queryKey: ['/technical/api/surveys'],
  });

  const handleFilterChange = useCallback((result: VesselFleetGroupFilterResult) => {
    setFilterValue({
      mode: result.mode,
      selectedVessels: result.selectedVessels,
      selectedFleets: result.selectedFleets,
      selectedGroups: result.selectedGroups,
    });
    setSelectedVesselNames(result.selectedVesselNames);
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
    
    return result;
  }, [surveys, selectedVesselNames, dueInFilter]);

  const updateSurveyMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<SurveyData> }) => {
      return apiRequest('PATCH', `/technical/api/surveys/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/surveys'] });
      toast({
        title: 'Updated',
        description: 'Survey updated successfully.',
      });
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

  const handleToggleApplicable = useCallback((id: string, newValue: boolean) => {
    updateSurveyMutation.mutate({ id, updates: { applicable: newValue } });
  }, [updateSurveyMutation]);

  const handleOpenAttachments = useCallback((survey: SurveyData) => {
    setSelectedSurvey(survey);
    setAttachmentSheetOpen(true);
  }, []);

  const handleAttachmentsChange = useCallback((attachments: FileAttachment[]) => {
    if (selectedSurvey) {
      updateSurveyMutation.mutate({
        id: selectedSurvey.id,
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
      dataId: data?.id 
    });
    
    const field = colDef.field;
    if (!field || !data?.id) return;
    
    if (value === oldValue) {
      console.log('[SurveysPage] Value not changed, skipping update');
      return;
    }
    
    if (EDITABLE_DATE_FIELDS.includes(field)) {
      const today = new Date();
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const day = String(today.getDate()).padStart(2, '0');
      const month = months[today.getMonth()];
      const year = today.getFullYear();
      const lastEdit = `${day} ${month} ${year}`;
      
      console.log('[SurveysPage] Sending PATCH request for survey:', data.id, 'field:', field, 'value:', value);
      
      updateSurveyMutation.mutate({
        id: data.id,
        updates: {
          [field]: value,
          lastEdit,
        },
      });
    }
  }, [updateSurveyMutation]);

  const handleDateChange = useCallback((id: string, field: string, newValue: string) => {
    console.log('[SurveysPage] handleDateChange called:', { id, field, newValue });
    
    const today = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = String(today.getDate()).padStart(2, '0');
    const month = months[today.getMonth()];
    const year = today.getFullYear();
    const lastEdit = `${day} ${month} ${year}`;
    
    updateSurveyMutation.mutate({
      id,
      updates: {
        [field]: newValue,
        lastEdit,
      },
    });
  }, [updateSurveyMutation]);

  const gridContext = useMemo(() => ({
    onToggleApplicable: handleToggleApplicable,
    onOpenAttachments: handleOpenAttachments,
    onDateChange: handleDateChange,
  }), [handleToggleApplicable, handleOpenAttachments, handleDateChange]);

  const columnDefs: ColDef[] = useMemo(() => [
    {
      headerName: 'Company ID',
      field: 'id',
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

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
      <div className="flex items-center justify-between flex-shrink-0 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Surveys</h1>
        <div className="flex items-center gap-2">
          <FiltersToggle 
            isOpen={showFilters} 
            onToggle={() => setShowFilters(!showFilters)} 
          />
          <Button
            className="h-8 px-3 text-xs bg-[#5cc86f] hover:bg-[#0e7490] text-white"
            data-testid="button-new-survey"
          >
            <Plus className="h-3 w-3 mr-1" />
            New Survey
          </Button>
        </div>
      </div>

      {showFilters && (
        <div className="flex items-center gap-4 px-6 flex-shrink-0">
          <VesselFleetGroupFilter
            value={filterValue}
            onChange={handleFilterChange}
          />
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

      <div className="px-6 py-4 flex-1 flex flex-col min-h-0">
        <Card className="border-0 shadow-none bg-[#f7fafc] rounded-lg flex-1 flex flex-col min-h-0">
          <CardContent className="p-4 bg-[#f7fafc] flex-1 flex flex-col min-h-0">
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
                  autoHeight={false}
                  height="100%"
                  minHeight="300px"
                  width="100%"
                  enableExport={true}
                  enableSideBar={true}
                  enableStatusBar={true}
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
                Rows: {filteredSurveys.length}
              </div>
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
