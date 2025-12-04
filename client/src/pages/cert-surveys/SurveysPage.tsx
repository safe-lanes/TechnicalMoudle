import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Plus, Eye, FileText, Paperclip } from 'lucide-react';
import { ColDef, GridReadyEvent, GridApi, ICellRendererParams, CellValueChangedEvent } from 'ag-grid-community';
import AgGridTable from '@/components/AgGrid/AgGridTable';
import AgGridTableActions from '@/components/AgGrid/AgGridTableActions';
import DateCellEditor from '@/components/AgGrid/DateCellEditor';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { VesselFilter, FiltersToggle, VesselFilterValue } from '@/components/filters/VesselFilter';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { Vessel, Fleet } from '@shared/schema';

const defaultFilterValue: VesselFilterValue = {
  mode: 'vessel',
  selectedVessels: [],
  selectedFleets: [],
  selectedGroups: [],
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

const ActionsCellRenderer = (params: ICellRendererParams) => {
  if (!params.colDef || !params.data) return null;
  
  return (
    <div className="flex gap-1 justify-center items-center h-full">
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-7 w-7"
        data-testid={`button-notes-${params.data.id}`}
      >
        <FileText className="h-4 w-4 text-gray-500" />
      </Button>
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-7 w-7"
        data-testid={`button-attachment-${params.data.id}`}
      >
        <Paperclip className="h-4 w-4 text-gray-500" />
      </Button>
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-7 w-7"
        data-testid={`button-view-${params.data.id}`}
      >
        <Eye className="h-4 w-4 text-gray-500" />
      </Button>
    </div>
  );
};

export default function SurveysPage() {
  const [showFilters, setShowFilters] = useState(true);
  const [filterValue, setFilterValue] = useState<VesselFilterValue>(defaultFilterValue);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const { toast } = useToast();

  const { data: vessels = [] } = useQuery<Vessel[]>({
    queryKey: ['/api/vessels'],
  });

  const { data: fleets = [] } = useQuery<Fleet[]>({
    queryKey: ['/api/fleets'],
  });

  const { data: surveys = [], isLoading } = useQuery<SurveyData[]>({
    queryKey: ['/api/surveys'],
  });

  const vesselOptions = vessels.map(v => ({ id: v.id, name: v.name }));
  const fleetOptions = fleets.map(f => ({ id: f.id, name: f.name }));
  const groupOptions: { id: string; name: string }[] = [];

  const updateSurveyMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<SurveyData> }) => {
      return apiRequest('PATCH', `/api/surveys/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/surveys'] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/surveys'] });
    },
  });

  const handleToggleApplicable = useCallback((id: string, newValue: boolean) => {
    updateSurveyMutation.mutate({ id, updates: { applicable: newValue } });
  }, [updateSurveyMutation]);

  const handleCellValueChanged = useCallback((event: CellValueChangedEvent) => {
    const { data, colDef, newValue, oldValue } = event;
    
    if (newValue === oldValue) return;
    
    const field = colDef.field;
    if (!field || !data?.id) return;
    
    if (EDITABLE_DATE_FIELDS.includes(field)) {
      const today = new Date();
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const day = String(today.getDate()).padStart(2, '0');
      const month = months[today.getMonth()];
      const year = today.getFullYear();
      const lastEdit = `${day} ${month} ${year}`;
      
      updateSurveyMutation.mutate({
        id: data.id,
        updates: {
          [field]: newValue,
          lastEdit,
        },
      });
    }
  }, [updateSurveyMutation]);

  const gridContext = useMemo(() => ({
    onToggleApplicable: handleToggleApplicable,
  }), [handleToggleApplicable]);

  const columnDefs: ColDef[] = useMemo(() => [
    {
      headerName: 'ID',
      field: 'id',
      width: 70,
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
      headerName: 'Type',
      field: 'type',
      width: 90,
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
      cellStyle: { fontSize: '13px', color: '#4f5863' },
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
      headerName: 'Applicable',
      field: 'applicable',
      width: 100,
      cellRenderer: ApplicableCellRenderer,
      cellClass: 'flex items-center justify-center',
      filter: 'agSetColumnFilter',
      filterParams: {
        values: [true, false],
        valueFormatter: (params: any) => params.value ? 'Yes' : 'No',
      },
      sortable: true,
      resizable: true,
    },
    {
      headerName: 'Actions',
      field: 'actions',
      width: 120,
      cellRenderer: ActionsCellRenderer,
      sortable: false,
      filter: false,
      cellClass: 'flex items-center justify-center',
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
    <div className="min-h-screen bg-gray-50">
      <div className="px-6 py-4 flex items-center justify-between">
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
        <VesselFilter
          value={filterValue}
          onChange={setFilterValue}
          vessels={vesselOptions}
          fleets={fleetOptions}
          groups={groupOptions}
        />
      )}

      <div className="px-6 py-4">
        <Card className="border-0 shadow-none bg-[#f7fafc] rounded-lg">
          <CardContent className="p-4 bg-[#f7fafc]">
            {isLoading ? (
              <div className="flex items-center justify-center h-48">
                <div className="text-gray-500">Loading surveys...</div>
              </div>
            ) : (
              <AgGridTable
                rowData={surveys}
                columnDefs={columnDefs}
                onGridReady={onGridReady}
                context={gridContext}
                autoHeight={true}
                maxHeight="calc(100vh - 280px)"
                minHeight="200px"
                width="100%"
                enableExport={true}
                enableSideBar={true}
                enableStatusBar={true}
                enableRowGrouping={true}
                enablePivoting={true}
                enableAdvancedFilter={false}
                rowSelection={false}
                theme="alpine"
                gridOptions={{
                  onCellValueChanged: handleCellValueChanged,
                  singleClickEdit: true,
                  stopEditingWhenCellsLoseFocus: true,
                }}
              />
            )}
            
            <div className="bg-white border-t border-gray-200 px-4 py-3 flex justify-between items-center" style={{ marginTop: '-1px' }}>
              <div className="text-xs font-normal font-['Mulish',Helvetica] text-black">
                Rows: {surveys.length}
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
    </div>
  );
}
