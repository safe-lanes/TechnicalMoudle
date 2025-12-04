import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Eye, FileText, Download, Paperclip } from 'lucide-react';
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

interface CertificateData {
  id: string;
  certificateName: string;
  type: string;
  vessel: string;
  issueDate: string;
  expiryDate: string;
  lastAnnual: string;
  lastInterm: string;
  endorsementDate: string;
  lastEditUpload: string;
  applicable: boolean;
}

const sampleCertificates: CertificateData[] = [
  {
    id: 'C1',
    certificateName: 'International Ballast Water Management Certificate',
    type: 'Flag',
    vessel: 'Vessel Name Extra Long 1',
    issueDate: '01 Sep 2019',
    expiryDate: '01 Sep 2024',
    lastAnnual: '01 Sep 2024',
    lastInterm: '01 Sep 2024',
    endorsementDate: '01 Sep 2024',
    lastEditUpload: '01 Sep 2024',
    applicable: true,
  },
  {
    id: 'C2',
    certificateName: 'International Ballast Water Management Certificate',
    type: 'Flag',
    vessel: 'Vessel Name Extra Long 1',
    issueDate: '01 Sep 2019',
    expiryDate: '',
    lastAnnual: '',
    lastInterm: '',
    endorsementDate: '',
    lastEditUpload: '',
    applicable: true,
  },
  {
    id: 'C3',
    certificateName: 'Safety Management Certificate',
    type: 'Class',
    vessel: 'Pacific Explorer',
    issueDate: '15 Mar 2020',
    expiryDate: '15 Mar 2025',
    lastAnnual: '15 Mar 2024',
    lastInterm: '15 Sep 2023',
    endorsementDate: '15 Mar 2024',
    lastEditUpload: '20 Oct 2024',
    applicable: true,
  },
  {
    id: 'C4',
    certificateName: 'International Oil Pollution Prevention Certificate',
    type: 'Flag',
    vessel: 'Atlantic Voyager',
    issueDate: '01 Jan 2021',
    expiryDate: '01 Jan 2026',
    lastAnnual: '01 Jan 2024',
    lastInterm: '01 Jul 2023',
    endorsementDate: '01 Jan 2024',
    lastEditUpload: '15 Nov 2024',
    applicable: false,
  },
  {
    id: 'C5',
    certificateName: 'Cargo Ship Safety Equipment Certificate',
    type: 'Class',
    vessel: 'Northern Star',
    issueDate: '10 Jun 2022',
    expiryDate: '10 Jun 2027',
    lastAnnual: '10 Jun 2024',
    lastInterm: '',
    endorsementDate: '10 Jun 2024',
    lastEditUpload: '25 Sep 2024',
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
        data-testid={`button-view-${params.data.id}`}
      >
        <Eye className="h-4 w-4 text-gray-500" />
      </Button>
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
        data-testid={`button-download-${params.data.id}`}
      >
        <Download className="h-4 w-4 text-gray-500" />
      </Button>
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-7 w-7"
        data-testid={`button-attachment-${params.data.id}`}
      >
        <Paperclip className="h-4 w-4 text-gray-500" />
      </Button>
    </div>
  );
};

export default function CertificatesPage() {
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
      headerName: 'Name of Certificate',
      field: 'certificateName',
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
      headerName: 'Issue Date',
      field: 'issueDate',
      width: 100,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agDateColumnFilter',
      sortable: true,
      resizable: true,
    },
    {
      headerName: 'Expiry Date',
      field: 'expiryDate',
      width: 100,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agDateColumnFilter',
      sortable: true,
      resizable: true,
    },
    {
      headerName: 'Last Annual',
      field: 'lastAnnual',
      width: 100,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agDateColumnFilter',
      sortable: true,
      resizable: true,
    },
    {
      headerName: 'Last Interm',
      field: 'lastInterm',
      width: 100,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agDateColumnFilter',
      sortable: true,
      resizable: true,
    },
    {
      headerName: 'Endorsement Date',
      field: 'endorsementDate',
      width: 120,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agDateColumnFilter',
      sortable: true,
      resizable: true,
    },
    {
      headerName: 'Last Edit/ Upload',
      field: 'lastEditUpload',
      width: 110,
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
      width: 150,
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
        <h1 className="text-2xl font-bold text-gray-900">Certificates</h1>
        <div className="flex items-center gap-2">
          <FiltersToggle 
            isOpen={showFilters} 
            onToggle={() => setShowFilters(!showFilters)} 
          />
          <Button
            className="h-8 px-3 text-xs bg-[#5cc86f] hover:bg-[#0e7490] text-white"
            data-testid="button-new-certificate"
          >
            <Plus className="h-3 w-3 mr-1" />
            New Cert./ Doc
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
              rowData={sampleCertificates}
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
                Rows: {sampleCertificates.length}
              </div>
              <div>
                <AgGridTableActions 
                  gridApi={gridApi}
                  exportFilename="certificates-export"
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
