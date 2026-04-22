import { useMemo, useCallback, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, GridReadyEvent, GridApi, SortChangedEvent, RowClickedEvent, RowClassParams, GetRowIdParams } from 'ag-grid-community';
import { ModuleRegistry } from 'ag-grid-community';
import {
  MenuModule,
  ColumnsToolPanelModule,
  LicenseManager,
} from 'ag-grid-enterprise';
import type { ReportColumn } from '@/components/reports/ReportPreviewModal';

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

try {
  const licenseKey = import.meta.env.VITE_AG_GRID_LICENSE_KEY || import.meta.env.AG_GRID_LICENSE_KEY;
  if (licenseKey) {
    LicenseManager.setLicenseKey(licenseKey);
  }
} catch (_) {}

try {
  ModuleRegistry.registerModules([
    MenuModule,
    ColumnsToolPanelModule,
  ]);
} catch (_) {}

interface ReportAgGridTableProps {
  columns: ReportColumn[];
  data: Record<string, any>[];
  height?: string;
  onSortChanged?: (field: string, direction: 'asc' | 'desc') => void;
  onRowClicked?: (event: RowClickedEvent) => void;
  rowHeight?: number;
  headerHeight?: number;
  domLayout?: 'normal' | 'autoHeight' | 'print';
  testId?: string;
  noRowsMessage?: string;
  getRowClass?: (params: RowClassParams) => string | string[] | undefined;
  getRowId?: (params: GetRowIdParams) => string;
}

const HeaderRendererWrapper: React.FC<{ render: () => React.ReactNode }> = ({ render }) => {
  return <>{render()}</>;
};

const ReportAgGridTable: React.FC<ReportAgGridTableProps> = ({
  columns,
  data,
  height = '60vh',
  onSortChanged,
  onRowClicked,
  rowHeight = 36,
  headerHeight = 38,
  domLayout = 'normal',
  testId = 'report-ag-grid',
  noRowsMessage = 'No data available',
  getRowClass,
  getRowId,
}) => {
  const gridApiRef = useRef<GridApi | null>(null);

  const columnDefs: ColDef[] = useMemo(() => {
    return columns.map((col) => {
      const hasRenderer = typeof col.cellRenderer === 'function';
      const def: ColDef = {
        headerName: col.header,
        field: col.field,
        minWidth: col.minWidth ?? col.width ?? (col.field === 'sNo' || col.field === 'sno' ? 60 : 80),
        flex: col.flex ?? 1,
        sortable: col.sortable ?? true,
        resizable: true,
        filter: col.filter ?? false,
        suppressHeaderFilterButton: true,
        wrapText: col.wrapText ?? false,
        autoHeight: col.autoHeight ?? false,
        cellStyle: col.cellStyle ?? {
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        },
      };
      if (col.headerClass) def.headerClass = col.headerClass;
      if (col.cellClass) def.cellClass = col.cellClass as ColDef['cellClass'];
      if (col.headerComponent) {
        const renderHeader = col.headerComponent;
        def.headerComponent = (params: any) => <HeaderRendererWrapper render={renderHeader} />;
      }
      if (hasRenderer) {
        def.cellRenderer = col.cellRenderer;
      } else {
        def.tooltipField = col.field;
        def.valueFormatter = (params: any) => {
          const val = params.value;
          if (val === null || val === undefined) return '-';
          return String(val);
        };
      }
      return def;
    });
  }, [columns]);

  const defaultColDef: ColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
    filter: false,
    flex: 1,
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
    } else if (columns.length > 0) {
      onSortChanged(columns[0].field, 'asc');
    }
  }, [onSortChanged, columns]);

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-muted-foreground" data-testid={`${testId}-empty`}>
        <p className="text-base font-medium mb-1">{noRowsMessage}</p>
        <p className="text-sm">No records match the current filters.</p>
      </div>
    );
  }

  return (
    <div
      className="ag-theme-alpine report-ag-grid"
      style={{ height, width: '100%' }}
      data-testid={testId}
    >
      <AgGridReact
        rowData={data}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        onGridReady={onGridReady}
        onSortChanged={onSortChanged ? handleSortChanged : undefined}
        onRowClicked={onRowClicked}
        getRowClass={getRowClass}
        getRowId={getRowId}
        suppressHorizontalScroll={false}
        alwaysShowHorizontalScroll={false}
        alwaysShowVerticalScroll={false}
        animateRows={false}
        rowHeight={rowHeight}
        headerHeight={headerHeight}
        enableBrowserTooltips={true}
        tooltipShowDelay={500}
        suppressMenuHide={false}
        suppressMovableColumns={false}
        suppressCellFocus={true}
        enableCellTextSelection={true}
        domLayout={domLayout}
        reactiveCustomComponents={true}
        theme="legacy"
      />
    </div>
  );
};

export default ReportAgGridTable;
