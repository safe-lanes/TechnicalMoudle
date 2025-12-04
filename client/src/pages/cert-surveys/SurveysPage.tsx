import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Eye, FileText, Paperclip } from 'lucide-react';
import { ColDef, GridReadyEvent, GridApi, ICellRendererParams } from 'ag-grid-community';
import AgGridTable from '@/components/AgGrid/AgGridTable';
import AgGridTableActions from '@/components/AgGrid/AgGridTableActions';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { VesselFilter, FiltersToggle, VesselFilterValue } from '@/components/filters/VesselFilter';
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

const sampleSurveys: SurveyData[] = [
  {
    id: 'S1',
    surveyName: 'Ballast Water Management annual Survey',
    type: 'Annual',
    vessel: 'Vessel Name Extra Long 1',
    surveyDate: '01 Sep 2019',
    dueDate: '01 Sep 2024',
    firstRangeDate: '01 Sep 2024',
    secondRangeDate: '01 Sep 2024',
    postponed: '01 Sep 2024',
    lastEdit: '01 Sep 2024',
    applicable: true,
  },
  {
    id: 'S2',
    surveyName: 'Ballast Water Management annual Survey',
    type: 'Int',
    vessel: 'Vessel Name Extra Long 1',
    surveyDate: '',
    dueDate: '',
    firstRangeDate: '',
    secondRangeDate: '',
    postponed: '',
    lastEdit: '',
    applicable: true,
  },
  {
    id: 'S3',
    surveyName: 'Safety Equipment Survey',
    type: 'Annual',
    vessel: 'Pacific Explorer',
    surveyDate: '15 Mar 2020',
    dueDate: '15 Mar 2025',
    firstRangeDate: '15 Mar 2024',
    secondRangeDate: '15 Sep 2024',
    postponed: '',
    lastEdit: '20 Oct 2024',
    applicable: true,
  },
  {
    id: 'S4',
    surveyName: 'Hull and Machinery Survey',
    type: 'Int',
    vessel: 'Atlantic Voyager',
    surveyDate: '01 Jan 2021',
    dueDate: '01 Jan 2026',
    firstRangeDate: '01 Jan 2024',
    secondRangeDate: '01 Jul 2024',
    postponed: '01 Mar 2024',
    lastEdit: '15 Nov 2024',
    applicable: false,
  },
  {
    id: 'S5',
    surveyName: 'Load Line Survey',
    type: 'Annual',
    vessel: 'Northern Star',
    surveyDate: '10 Jun 2022',
    dueDate: '10 Jun 2027',
    firstRangeDate: '10 Jun 2024',
    secondRangeDate: '',
    postponed: '',
    lastEdit: '25 Sep 2024',
    applicable: true,
  },
];

const ApplicableCellRenderer = (params: ICellRendererParams) => {
  if (!params.colDef || !params.data) return null;
  
  return (
    <div className="flex items-center justify-center h-full">
      <Checkbox 
        checked={params.value} 
        disabled
        className="data-[state=checked]:bg-[#52baf3] data-[state=checked]:border-[#52baf3]"
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

  const { data: vessels = [] } = useQuery<Vessel[]>({
    queryKey: ['/api/vessels'],
  });

  const { data: fleets = [] } = useQuery<Fleet[]>({
    queryKey: ['/api/fleets'],
  });

  const vesselOptions = vessels.map(v => ({ id: v.id, name: v.name }));
  const fleetOptions = fleets.map(f => ({ id: f.id, name: f.name }));
  const groupOptions: { id: string; name: string }[] = [];

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
      width: 100,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agDateColumnFilter',
      sortable: true,
      resizable: true,
    },
    {
      headerName: 'Due Date',
      field: 'dueDate',
      width: 100,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agDateColumnFilter',
      sortable: true,
      resizable: true,
    },
    {
      headerName: '1st Range Date',
      field: 'firstRangeDate',
      width: 110,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agDateColumnFilter',
      sortable: true,
      resizable: true,
    },
    {
      headerName: '2nd Range Date',
      field: 'secondRangeDate',
      width: 115,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agDateColumnFilter',
      sortable: true,
      resizable: true,
    },
    {
      headerName: 'Postponed',
      field: 'postponed',
      width: 100,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agDateColumnFilter',
      sortable: true,
      resizable: true,
    },
    {
      headerName: 'Last Edit',
      field: 'lastEdit',
      width: 100,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
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
      filter: false,
      sortable: false,
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
            <AgGridTable
              rowData={sampleSurveys}
              columnDefs={columnDefs}
              onGridReady={onGridReady}
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
            />
            
            <div className="bg-white border-t border-gray-200 px-4 py-3 flex justify-between items-center" style={{ marginTop: '-1px' }}>
              <div className="text-xs font-normal font-['Mulish',Helvetica] text-black">
                Rows: {sampleSurveys.length}
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
