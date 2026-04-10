import { useMemo, useCallback, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, GridReadyEvent, GridApi, SortChangedEvent } from 'ag-grid-community';
import type { ReportColumn } from '@/components/reports/ReportPreviewModal';

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

interface ReportAgGridTableProps {
  columns: ReportColumn[];
  data: Record<string, any>[];
  height?: string;
  onSortChanged?: (field: string, direction: 'asc' | 'desc') => void;
}

const ReportAgGridTable: React.FC<ReportAgGridTableProps> = ({ columns, data, height = '60vh', onSortChanged }) => {
  const gridApiRef = useRef<GridApi | null>(null);

  const columnDefs: ColDef[] = useMemo(() => {
    return columns.map((col) => ({
      headerName: col.header,
      field: col.field,
      width: col.width,
      minWidth: col.field === 'sNo' || col.field === 'sno' ? 60 : 80,
      sortable: true,
      resizable: true,
      filter: false,
      suppressHeaderFilterButton: true,
      wrapText: false,
      autoHeight: false,
      cellStyle: {
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      },
      tooltipField: col.field,
      valueFormatter: (params: any) => {
        const val = params.value;
        if (val === null || val === undefined) return '-';
        return String(val);
      },
    }));
  }, [columns]);

  const defaultColDef: ColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
    filter: false,
    suppressHeaderFilterButton: true,
    menuTabs: ['generalMenuTab', 'columnsMenuTab'],
    wrapText: false,
    autoHeight: false,
  }), []);

  const onGridReady = useCallback((event: GridReadyEvent) => {
    gridApiRef.current = event.api;
  }, []);

  const handleSortChanged = useCallback((event: SortChangedEvent) => {
    if (!onSortChanged) return;
    const sortModel = event.api.getColumnState().filter(c => c.sort);
    if (sortModel.length > 0) {
      const col = sortModel[0];
      onSortChanged(col.colId, col.sort as 'asc' | 'desc');
    }
  }, [onSortChanged]);

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-muted-foreground">
        <p className="text-base font-medium mb-1">No data available</p>
        <p className="text-sm">No records match the current filters.</p>
      </div>
    );
  }

  return (
    <div
      className="ag-theme-alpine report-ag-grid"
      style={{ height, width: '100%' }}
      data-testid="report-ag-grid"
    >
      <AgGridReact
        rowData={data}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        onGridReady={onGridReady}
        onSortChanged={onSortChanged ? handleSortChanged : undefined}
        suppressHorizontalScroll={false}
        alwaysShowHorizontalScroll={false}
        alwaysShowVerticalScroll={false}
        animateRows={false}
        rowHeight={36}
        headerHeight={38}
        enableBrowserTooltips={true}
        tooltipShowDelay={500}
        suppressMenuHide={false}
        suppressMovableColumns={false}
        suppressCellFocus={true}
        enableCellTextSelection={true}
        domLayout="normal"
        reactiveCustomComponents={true}
        theme="legacy"
      />
    </div>
  );
};

export default ReportAgGridTable;
