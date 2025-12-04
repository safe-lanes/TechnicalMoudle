import { useState, useMemo, useCallback, Component, createRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Plus, Paperclip } from 'lucide-react';
import { ColDef, GridReadyEvent, GridApi, ICellRendererParams, CellValueChangedEvent, ICellEditorParams } from 'ag-grid-community';
import AgGridTable from '@/components/AgGrid/AgGridTable';
import AgGridTableActions from '@/components/AgGrid/AgGridTableActions';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { VesselFilter, FiltersToggle, VesselFilterValue } from '@/components/filters/VesselFilter';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { FileAttachmentDialog, FileAttachment } from '@/components/FileAttachmentDialog';
import type { Vessel, Fleet } from '@shared/schema';

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

const formatToDisplayDate = (isoDate: string): string => {
  if (!isoDate) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  try {
    const [year, month, day] = isoDate.split('-');
    return `${day} ${months[parseInt(month, 10) - 1]} ${year}`;
  } catch {
    return isoDate;
  }
};

interface DateCellEditorState {
  value: string;
}

class DateCellEditor extends Component<ICellEditorParams, DateCellEditorState> {
  private inputRef = createRef<HTMLInputElement>();
  
  constructor(props: ICellEditorParams) {
    super(props);
    this.state = {
      value: parseDisplayDate(props.value || '')
    };
  }
  
  componentDidMount() {
    setTimeout(() => {
      if (this.inputRef.current) {
        this.inputRef.current.focus();
        this.inputRef.current.select();
      }
    }, 0);
  }
  
  getValue() {
    return formatToDisplayDate(this.state.value);
  }
  
  isCancelBeforeStart() {
    return false;
  }
  
  isCancelAfterEnd() {
    return false;
  }
  
  isPopup() {
    return false;
  }
  
  handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ value: e.target.value });
  };
  
  handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      this.props.stopEditing();
    } else if (e.key === 'Escape') {
      this.props.stopEditing(true);
    }
  };
  
  render() {
    return (
      <input
        ref={this.inputRef}
        type="date"
        value={this.state.value}
        onChange={this.handleChange}
        onKeyDown={this.handleKeyDown}
        className="w-full h-full px-2 border-2 border-[#52baf3] rounded bg-white text-[13px]"
        style={{ fontFamily: 'Inter, sans-serif', minWidth: '130px' }}
      />
    );
  }
}

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
  attachments?: FileAttachment[];
}

const EDITABLE_DATE_FIELDS = ['issueDate', 'expiryDate', 'lastAnnual', 'lastInterm', 'endorsementDate'];

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

interface CertificateGridContext {
  onOpenAttachments?: (certificate: CertificateData) => void;
  onToggleApplicable?: (id: string, newValue: boolean) => void;
}

interface ActionsCellRendererProps extends ICellRendererParams {
  context: CertificateGridContext;
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
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-7 w-7 relative"
        onClick={handleAttachmentClick}
        data-testid={`button-attachment-${params.data.id}`}
      >
        <Paperclip className="h-4 w-4 text-gray-500" />
        {attachmentCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-[#52baf3] text-white text-[10px] font-medium rounded-full h-4 w-4 flex items-center justify-center">
            {attachmentCount}
          </span>
        )}
      </Button>
    </div>
  );
};

export default function CertificatesPage() {
  const [showFilters, setShowFilters] = useState(true);
  const [filterValue, setFilterValue] = useState<VesselFilterValue>(defaultFilterValue);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [attachmentSheetOpen, setAttachmentSheetOpen] = useState(false);
  const [selectedCertificate, setSelectedCertificate] = useState<CertificateData | null>(null);
  const { toast } = useToast();

  const { data: certificates = [], isLoading: isLoadingCertificates } = useQuery<CertificateData[]>({
    queryKey: ['/api/certificates'],
  });

  const { data: vessels = [] } = useQuery<Vessel[]>({
    queryKey: ['/api/vessels'],
  });

  const { data: fleets = [] } = useQuery<Fleet[]>({
    queryKey: ['/api/fleets'],
  });

  const updateCertificateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CertificateData> }) => {
      return apiRequest('PATCH', `/api/certificates/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/certificates'] });
      toast({
        title: 'Updated',
        description: 'Certificate updated successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update certificate',
        variant: 'destructive',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/certificates'] });
    },
  });

  const handleToggleApplicable = useCallback((id: string, newValue: boolean) => {
    updateCertificateMutation.mutate({ id, updates: { applicable: newValue } });
  }, [updateCertificateMutation]);

  const handleOpenAttachments = useCallback((certificate: CertificateData) => {
    setSelectedCertificate(certificate);
    setAttachmentSheetOpen(true);
  }, []);

  const handleAttachmentsChange = useCallback((attachments: FileAttachment[]) => {
    if (selectedCertificate) {
      updateCertificateMutation.mutate({
        id: selectedCertificate.id,
        updates: { attachments },
      });
      setSelectedCertificate(prev => prev ? { ...prev, attachments } : null);
    }
  }, [selectedCertificate, updateCertificateMutation]);

  const handleCellValueChanged = useCallback((event: CellValueChangedEvent) => {
    const { data, colDef, newValue, oldValue } = event;
    
    console.log('[CertificatesPage] onCellValueChanged fired:', { 
      field: colDef.field, 
      oldValue, 
      newValue, 
      dataId: data?.id 
    });
    
    if (newValue === oldValue) {
      console.log('[CertificatesPage] Value unchanged, skipping update');
      return;
    }
    
    const field = colDef.field;
    if (!field || !data?.id) {
      console.log('[CertificatesPage] Missing field or data.id');
      return;
    }
    
    if (EDITABLE_DATE_FIELDS.includes(field)) {
      const today = new Date();
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const day = String(today.getDate()).padStart(2, '0');
      const month = months[today.getMonth()];
      const year = today.getFullYear();
      const lastEditUpload = `${day} ${month} ${year}`;
      
      console.log('[CertificatesPage] Sending PATCH request for certificate:', data.id, 'field:', field, 'value:', newValue);
      
      updateCertificateMutation.mutate({
        id: data.id,
        updates: {
          [field]: newValue,
          lastEditUpload,
        },
      });
    }
  }, [updateCertificateMutation]);

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
      width: 120,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agDateColumnFilter',
      sortable: true,
      resizable: true,
      editable: true,
      cellEditor: DateCellEditor,
      cellClass: 'editable-date-cell',
      valueSetter: (params: any) => {
        if (params.newValue !== params.oldValue) {
          params.data.issueDate = params.newValue;
          return true;
        }
        return false;
      },
    },
    {
      headerName: 'Expiry Date',
      field: 'expiryDate',
      width: 120,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agDateColumnFilter',
      sortable: true,
      resizable: true,
      editable: true,
      cellEditor: DateCellEditor,
      cellClass: 'editable-date-cell',
      valueSetter: (params: any) => {
        if (params.newValue !== params.oldValue) {
          params.data.expiryDate = params.newValue;
          return true;
        }
        return false;
      },
    },
    {
      headerName: 'Last Annual',
      field: 'lastAnnual',
      width: 120,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agDateColumnFilter',
      sortable: true,
      resizable: true,
      editable: true,
      cellEditor: DateCellEditor,
      cellClass: 'editable-date-cell',
      valueSetter: (params: any) => {
        if (params.newValue !== params.oldValue) {
          params.data.lastAnnual = params.newValue;
          return true;
        }
        return false;
      },
    },
    {
      headerName: 'Last Interm',
      field: 'lastInterm',
      width: 120,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agDateColumnFilter',
      sortable: true,
      resizable: true,
      editable: true,
      cellEditor: DateCellEditor,
      cellClass: 'editable-date-cell',
      valueSetter: (params: any) => {
        if (params.newValue !== params.oldValue) {
          params.data.lastInterm = params.newValue;
          return true;
        }
        return false;
      },
    },
    {
      headerName: 'Endorsement Date',
      field: 'endorsementDate',
      width: 130,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agDateColumnFilter',
      sortable: true,
      resizable: true,
      editable: true,
      cellEditor: DateCellEditor,
      cellClass: 'editable-date-cell',
      valueSetter: (params: any) => {
        if (params.newValue !== params.oldValue) {
          params.data.endorsementDate = params.newValue;
          return true;
        }
        return false;
      },
    },
    {
      headerName: 'Last Edit/ Upload',
      field: 'lastEditUpload',
      width: 110,
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
      width: 80,
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

  const gridContext = useMemo(() => ({
    onToggleApplicable: handleToggleApplicable,
    onOpenAttachments: handleOpenAttachments,
  }), [handleToggleApplicable, handleOpenAttachments]);

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
            {isLoadingCertificates ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">Loading certificates...</div>
              </div>
            ) : (
              <AgGridTable
                rowData={certificates}
                columnDefs={columnDefs}
                onGridReady={onGridReady}
                onCellValueChanged={handleCellValueChanged}
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
                singleClickEdit={true}
                stopEditingWhenCellsLoseFocus={true}
              />
            )}
            
            <div className="bg-white border-t border-gray-200 px-4 py-3 flex justify-between items-center" style={{ marginTop: '-1px' }}>
              <div className="text-xs font-normal font-['Mulish',Helvetica] text-black">
                Rows: {certificates.length}
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

      <FileAttachmentDialog
        open={attachmentSheetOpen}
        onOpenChange={setAttachmentSheetOpen}
        itemName={selectedCertificate?.certificateName || ''}
        attachments={selectedCertificate?.attachments || []}
        onAttachmentsChange={handleAttachmentsChange}
      />
    </div>
  );
}
