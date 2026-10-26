import { useMemo, useCallback, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, GridReadyEvent, GridApi, RowClickedEvent, SortChangedEvent, SelectionChangedEvent, GetRowIdFunc, IsRowSelectable } from 'ag-grid-community';
import { ModuleRegistry } from 'ag-grid-community';
import {
  AllEnterpriseModule,
  SetFilterModule,
  MultiFilterModule,
  MenuModule,
  ColumnsToolPanelModule,
  FiltersToolPanelModule,
  StatusBarModule,
  SideBarModule,
  RangeSelectionModule,
  RowGroupingModule,
  AggregationModule,
  PivotModule,
  MasterDetailModule,
  ExcelExportModule,
  CsvExportModule,
  ClipboardModule,
  AdvancedFilterModule,
  LicenseManager,
} from 'ag-grid-enterprise';

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
    AllEnterpriseModule,
    SetFilterModule,
    MultiFilterModule,
    MenuModule,
    ColumnsToolPanelModule,
    FiltersToolPanelModule,
    StatusBarModule,
    SideBarModule,
    RangeSelectionModule,
    RowGroupingModule,
    AggregationModule,
    PivotModule,
    MasterDetailModule,
    ExcelExportModule,
    CsvExportModule,
    ClipboardModule,
    AdvancedFilterModule,
  ]);
} catch (_) {}

interface WOAgGridTableProps {
  columnDefs: ColDef[];
  rowData: any[];
  height?: string;
  onRowClicked?: (event: RowClickedEvent) => void;
  onSortChanged?: (field: string | null, direction: 'asc' | 'desc') => void;
  getRowStyle?: (params: any) => any;
  getRowClass?: (params: any) => string | string[] | undefined;
  suppressRowClickSelection?: boolean;
  rowHeight?: number;
  headerHeight?: number;
  domLayout?: 'normal' | 'autoHeight' | 'print';
  noRowsMessage?: string;
  testId?: string;
  rowSelection?: 'single' | 'multiple';
  onSelectionChanged?: (event: SelectionChangedEvent) => void;
  getRowId?: GetRowIdFunc;
  loading?: boolean;
  isRowSelectable?: IsRowSelectable;
  onGridReady?: (event: GridReadyEvent) => void;
  pagination?: boolean;
  paginationPageSize?: number;
  serverQueryUrl?: string;
  onServerQueryChanged?: (model: { sort: any[]; filters: Record<string, any> }) => void;
}

const WOAgGridTable: React.FC<WOAgGridTableProps> = ({
  columnDefs,
  rowData,
  height = '100%',
  onRowClicked,
  onSortChanged,
  getRowStyle,
  getRowClass,
  suppressRowClickSelection = true,
  rowHeight = 42,
  headerHeight = 42,
  domLayout = 'normal',
  noRowsMessage = 'No data available',
  testId = 'wo-ag-grid',
  rowSelection,
  onSelectionChanged,
  getRowId,
  loading,
  isRowSelectable,
  onGridReady: onGridReadyProp,
  pagination = false,
  paginationPageSize,
  serverQueryUrl,
  onServerQueryChanged,
}) => {
  const gridApiRef = useRef<GridApi | null>(null);
  // Infinite row model delegates filter/sort to the API. Its cache contains only
  // the externally requested page, so AG Grid never filters page rows again.
  const datasource = useMemo(() => ({
    getRows: (params: any) => params.successCallback(rowData, rowData.length),
  }), [rowData]);

  const useExternalSort = !!onSortChanged || !!onServerQueryChanged;
  const publishServerQuery = useCallback((event: any) => {
    onServerQueryChanged?.({
      sort: event.api.getColumnState().filter((col: any) => col.sort)
        .sort((a: any, b: any) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0))
        .map((col: any) => ({ colId: col.colId, sort: col.sort })),
      filters: event.api.getFilterModel(),
    });
  }, [onServerQueryChanged]);
  const serverColumns = useMemo(() => !serverQueryUrl ? columnDefs : columnDefs.map(col => {
    const getValues = async (params: any) => {
      try {
        const url = new URL(serverQueryUrl, window.location.origin);
        url.pathname = url.pathname.replace(/\/paged$/, '/values');
        url.searchParams.set('column', col.field || col.colId || '');
        const response = await fetch(url.pathname + url.search);
        if (!response.ok) throw new Error('Could not load filter values');
        params.success((await response.json()).data);
      } catch { params.success([]); }
    };
    const filter = col.filter ?? true;
    return {
      ...col,
      // Infinite row models render loading placeholders before data arrives.
      ...(typeof col.cellRenderer === 'function' ? {
        cellRenderer: (params: any) => params.data ? col.cellRenderer(params) : null,
      } : {}),
      ...(typeof col.valueGetter === 'function' ? {
        valueGetter: (params: any) => params.data ? (col.valueGetter as Function)(params) : '',
      } : {}),
      // Explicit set filters and implicit enterprise set filters need full-scope values.
      ...(filter === 'agSetColumnFilter' || filter === true
        ? { filter: 'agSetColumnFilter', filterParams: { ...col.filterParams, values: getValues, refreshValuesOnOpen: true } } : {}),
    };
  }), [columnDefs, serverQueryUrl]);

  const defaultColDef: ColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
    filter: true,
    wrapText: false,
    autoHeight: false,
    menuTabs: ['generalMenuTab', 'filterMenuTab', 'columnsMenuTab'],
    cellStyle: {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
  }), []);

  const onGridReady = useCallback((event: GridReadyEvent) => {
    gridApiRef.current = event.api;
    onGridReadyProp?.(event);
  }, [onGridReadyProp]);

  const handleSortChanged = useCallback((event: SortChangedEvent) => {
    if (!onSortChanged) return;
    const sortModel = event.api.getColumnState()
      .filter(col => col.sort)
      .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));

    if (sortModel.length > 0) {
      const first = sortModel[0];
      onSortChanged(first.colId, (first.sort as 'asc' | 'desc') || 'asc');
    } else {
      onSortChanged(null, 'asc');
    }
  }, [onSortChanged]);

  const overlayNoRowsTemplate = useMemo(() => {
    return `<div style="padding: 20px; text-align: center; color: #6b7280;">${noRowsMessage}</div>`;
  }, [noRowsMessage]);

  return (
    <div
      className="ag-theme-alpine wo-ag-grid"
      style={{ height, width: '100%' }}
      data-testid={testId}
    >
      <AgGridReact
        rowData={onServerQueryChanged ? undefined : rowData}
        rowModelType={onServerQueryChanged ? 'infinite' : 'clientSide'}
        datasource={onServerQueryChanged ? datasource : undefined}
        cacheBlockSize={200}
        maxBlocksInCache={1}
        infiniteInitialRowCount={1}
        columnDefs={serverColumns}
        defaultColDef={defaultColDef}
        loading={loading}
        onGridReady={onGridReady}
        onRowClicked={onRowClicked}
        onSortChanged={onServerQueryChanged ? publishServerQuery : useExternalSort ? handleSortChanged : undefined}
        onFilterChanged={onServerQueryChanged ? publishServerQuery : undefined}
        postSortRows={useExternalSort ? (params) => {
          if (params.nodes) {
            params.nodes.sort((a: any, b: any) => {
              const aIdx = a.sourceRowIndex ?? a.rowIndex ?? 0;
              const bIdx = b.sourceRowIndex ?? b.rowIndex ?? 0;
              return aIdx - bIdx;
            });
          }
        } : undefined}
        getRowStyle={getRowStyle}
        getRowClass={getRowClass}
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
        suppressRowClickSelection={suppressRowClickSelection}
        rowSelection={rowSelection}
        onSelectionChanged={onSelectionChanged}
        getRowId={getRowId}
        isRowSelectable={isRowSelectable}
        domLayout={domLayout}
        reactiveCustomComponents={true}
        overlayNoRowsTemplate={overlayNoRowsTemplate}
        theme="legacy"
        pagination={pagination}
        paginationPageSize={paginationPageSize}
      />
    </div>
  );
};

export default WOAgGridTable;
