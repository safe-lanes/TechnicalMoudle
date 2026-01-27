import { useState, useMemo, useCallback, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Plus, Paperclip, Calendar } from 'lucide-react';
import { ColDef, GridReadyEvent, GridApi, ICellRendererParams, CellValueChangedEvent, CellEditingStoppedEvent, ICellEditorParams } from 'ag-grid-community';
import AgGridTable from '@/components/AgGrid/AgGridTable';
import AgGridTableActions from '@/components/AgGrid/AgGridTableActions';
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

interface DateCellEditorHandle {
  getValue: () => string;
  isCancelBeforeStart: () => boolean;
  isCancelAfterEnd: () => boolean;
  isPopup: () => boolean;
}

const DateCellEditor = forwardRef<DateCellEditorHandle, ICellEditorParams>((props, ref) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const initialValue = parseDisplayDate(props.value || '');
  const [value, setValue] = useState(initialValue);
  const valueRef = useRef(value);
  const hasChangedRef = useRef(false);
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isCommittingRef = useRef(false);
  
  useEffect(() => {
    valueRef.current = value;
    hasChangedRef.current = value !== initialValue;
  }, [value, initialValue]);
  
  useEffect(() => {
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, 0);
    
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);
  
  useImperativeHandle(ref, () => ({
    getValue: () => {
      const result = formatToDisplayDate(valueRef.current);
      console.log('[DateCellEditor] getValue called, returning:', result);
      return result;
    },
    isCancelBeforeStart: () => false,
    isCancelAfterEnd: () => false,
    isPopup: () => false
  }));
  
  const commitAndSave = useCallback((cancelled: boolean = false) => {
    if (isCommittingRef.current) {
      console.log('[DateCellEditor] Already committing, skipping');
      return;
    }
    
    if (cancelled) {
      console.log('[DateCellEditor] Cancelled, stopping edit');
      props.stopEditing(true);
      return;
    }
    
    if (!hasChangedRef.current) {
      console.log('[DateCellEditor] No changes, stopping edit');
      props.stopEditing(false);
      return;
    }
    
    isCommittingRef.current = true;
    
    const newDisplayValue = formatToDisplayDate(valueRef.current);
    const field = props.colDef?.field;
    const rowId = props.data?.id;
    const rowData = props.data;
    
    console.log('[DateCellEditor] Committing value:', newDisplayValue, 'for field:', field, 'row:', rowId, 'rowData:', rowData);
    
    if (field && rowId && props.node && props.context?.onDateChange) {
      props.node.setDataValue(field, newDisplayValue);
      props.context.onDateChange(rowId, field, newDisplayValue, rowData);
    }
    
    props.stopEditing();
  }, [props]);
  
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    console.log('[DateCellEditor] handleChange:', newValue);
    setValue(newValue);
    valueRef.current = newValue;
    hasChangedRef.current = newValue !== initialValue;
    
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    
    if (newValue) {
      setTimeout(() => {
        commitAndSave(false);
      }, 50);
    }
  }, [initialValue, commitAndSave]);
  
  const handleBlur = useCallback(() => {
    console.log('[DateCellEditor] handleBlur, value:', valueRef.current);
    
    blurTimeoutRef.current = setTimeout(() => {
      if (!isCommittingRef.current) {
        commitAndSave(false);
      }
    }, 150);
  }, [commitAndSave]);
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
      commitAndSave(false);
    } else if (e.key === 'Escape') {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
      commitAndSave(true);
    }
  }, [commitAndSave]);
  
  return (
    <input
      ref={inputRef}
      type="date"
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className="w-full h-full px-2 border-2 border-[#52baf3] rounded bg-white text-[13px]"
      style={{ fontFamily: 'Inter, sans-serif', minWidth: '130px' }}
      data-testid={`date-editor-${props.data?.id}-${props.colDef?.field}`}
    />
  );
});

DateCellEditor.displayName = 'DateCellEditor';

interface CertificateData {
  id: string;
  certificateName: string;
  type: string;
  vessel: string;
  vesselId?: string;
  masterId?: string;
  issueDate: string;
  expiryDate: string;
  lastAnnual: string;
  lastInterm: string;
  endorsementDate: string;
  lastEditUpload: string;
  attachments?: FileAttachment[];
}

interface CertificatesApiResponse {
  certificates: CertificateData[];
  total: number;
  page: number;
  limit: number;
  totalPages?: number;
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

export default function CertificatesPage() {
  const [showFilters, setShowFilters] = useState(true);
  const [filterValue, setFilterValue] = useState<VesselFleetGroupFilterValue>(createDefaultFilterValue());
  const [selectedVesselNames, setSelectedVesselNames] = useState<string[]>([]);
  const [dueInFilter, setDueInFilter] = useState<DueInFilter>('all');
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [attachmentSheetOpen, setAttachmentSheetOpen] = useState(false);
  const [selectedCertificate, setSelectedCertificate] = useState<CertificateData | null>(null);
  const { toast } = useToast();

  const { data: certificatesResponse, isLoading: isLoadingCertificates } = useQuery<CertificatesApiResponse>({
    queryKey: ['/technical/api/certificates'],
  });
  
  const certificates = certificatesResponse?.certificates || [];

  const handleFilterChange = useCallback((result: VesselFleetGroupFilterResult) => {
    setFilterValue({
      mode: result.mode,
      selectedVessels: result.selectedVessels,
      selectedFleets: result.selectedFleets,
      selectedGroups: result.selectedGroups,
    });
    setSelectedVesselNames(result.selectedVesselNames);
  }, []);

  const updateCertificateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CertificateData> }) => {
      return apiRequest('PATCH', `/technical/api/certificates/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/technical/api/certificates'] });
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
      queryClient.invalidateQueries({ queryKey: ['/technical/api/certificates'] });
    },
  });

  // Certificate ID format for API: vesselId-masterId (compound key)
  const getCertificateApiId = useCallback((cert: CertificateData) => {
    if (cert.vesselId && cert.masterId) {
      return `${cert.vesselId}-${cert.masterId}`;
    }
    return cert.id;
  }, []);

  const handleOpenAttachments = useCallback((certificate: CertificateData) => {
    setSelectedCertificate(certificate);
    setAttachmentSheetOpen(true);
  }, []);

  const handleAttachmentsChange = useCallback((attachments: FileAttachment[]) => {
    if (selectedCertificate) {
      const apiId = getCertificateApiId(selectedCertificate);
      updateCertificateMutation.mutate({
        id: apiId,
        updates: { attachments },
      });
      setSelectedCertificate(prev => prev ? { ...prev, attachments } : null);
    }
  }, [selectedCertificate, updateCertificateMutation, getCertificateApiId]);

  const handleCellEditingStopped = useCallback((event: CellEditingStoppedEvent) => {
    const { data, colDef, value, oldValue } = event;
    
    console.log('[CertificatesPage] onCellEditingStopped fired:', { 
      field: colDef.field, 
      oldValue, 
      value, 
      dataId: data?.id 
    });
    
    const field = colDef.field;
    if (!field || !data?.id) {
      console.log('[CertificatesPage] Missing field or data.id');
      return;
    }
    
    if (value === oldValue) {
      console.log('[CertificatesPage] Value not changed, skipping update');
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
      
      // Use compound key format for API: vesselId-masterId
      const apiId = getCertificateApiId(data as CertificateData);
      
      console.log('[CertificatesPage] Sending PATCH request for certificate:', apiId, 'field:', field, 'value:', value);
      
      updateCertificateMutation.mutate({
        id: apiId,
        updates: {
          [field]: value,
          lastEditUpload,
        },
      });
    }
  }, [updateCertificateMutation, getCertificateApiId]);

  const handleDateChange = useCallback((certId: string, field: string, newValue: string, certData?: CertificateData) => {
    console.log('[CertificatesPage] handleDateChange called:', { certId, field, newValue });
    
    const today = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = String(today.getDate()).padStart(2, '0');
    const month = months[today.getMonth()];
    const year = today.getFullYear();
    const lastEditUpload = `${day} ${month} ${year}`;
    
    // Use compound key format for API if available
    let apiId = certId;
    if (certData) {
      apiId = getCertificateApiId(certData);
    }
    
    updateCertificateMutation.mutate({
      id: apiId,
      updates: {
        [field]: newValue,
        lastEditUpload,
      },
    });
  }, [updateCertificateMutation, getCertificateApiId]);

  const filteredCertificates = useMemo(() => {
    let result = certificates;
    
    if (selectedVesselNames.length > 0) {
      const normalizedFilterNames = selectedVesselNames.map(n => n.toLowerCase().trim());
      result = result.filter(cert => {
        const certVessel = (cert.vessel || '').toLowerCase().trim();
        return normalizedFilterNames.some(filterName => 
          filterName === certVessel || certVessel.includes(filterName) || filterName.includes(certVessel)
        );
      });
    }
    
    if (dueInFilter !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      result = result.filter(cert => {
        if (!cert.expiryDate) return false;
        
        const expiryDateStr = parseDisplayDate(cert.expiryDate);
        if (!expiryDateStr) return false;
        
        const expiryDate = new Date(expiryDateStr);
        expiryDate.setHours(0, 0, 0, 0);
        
        const isOverdue = expiryDate < today;
        
        if (dueInFilter === 'overdue') {
          return isOverdue;
        }
        
        if (isOverdue) return true;
        
        const monthsAhead = dueInFilter === '3months' ? 3 : dueInFilter === '2months' ? 2 : 1;
        const thresholdDate = new Date(today);
        thresholdDate.setMonth(thresholdDate.getMonth() + monthsAhead);
        
        return expiryDate <= thresholdDate;
      });
    }
    
    return result;
  }, [certificates, selectedVesselNames, dueInFilter]);

  const columnDefs: ColDef[] = useMemo(() => [
    {
      headerName: 'Company ID',
      field: 'id',
      width: 100,
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
      headerName: 'Company Group',
      field: 'type',
      width: 130,
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
        
        const expiryDate = new Date(year, month, day);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const twoMonthsFromNow = new Date(today);
        twoMonthsFromNow.setMonth(twoMonthsFromNow.getMonth() + 2);
        
        if (expiryDate < today) {
          return { ...baseStyle, color: '#dc2626', fontWeight: '600' };
        } else if (expiryDate <= twoMonthsFromNow) {
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

  const gridContext = useMemo(() => ({
    onOpenAttachments: handleOpenAttachments,
    onDateChange: handleDateChange,
  }), [handleOpenAttachments, handleDateChange]);

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
      <div className="flex items-center justify-between flex-shrink-0 mb-6">
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
            {isLoadingCertificates ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">Loading certificates...</div>
              </div>
            ) : (
              <div className="flex-1 min-h-0" style={{ minHeight: '300px' }}>
                <AgGridTable
                  rowData={filteredCertificates}
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
                Rows: {filteredCertificates.length}
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
