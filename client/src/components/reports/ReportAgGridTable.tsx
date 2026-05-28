import { useMemo, useCallback, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, GridReadyEvent, GridApi, SortChangedEvent, RowClickedEvent, RowClassParams, GetRowIdParams } from 'ag-grid-community';
import { ModuleRegistry } from 'ag-grid-community';
import {
  MenuModule,
  ColumnsToolPanelModule,
  SetFilterModule,
  MultiFilterModule,
  FiltersToolPanelModule,
  LicenseManager,
} from 'ag-grid-enterprise';
import type { ReportColumn } from '@/components/reports/ReportPreviewModal';
import { getReportAction, extractRowEntityId, resolveMenuName, Pencil, Eye } from '@/lib/reportActions';
import { usePermissions } from '@/contexts/PermissionsContext';

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
    SetFilterModule,
    MultiFilterModule,
    FiltersToolPanelModule,
  ]);
} catch (_) {}

const DATE_FIELD_PATTERN = /(date|dueDate|completionDate|issueDate|periodFrom|periodTo|expiry|expires|scheduled)/i;
const NUMBER_FIELD_PATTERN = /(qty|quantity|^count$|hours$|^rh$|manHours|amount|price|cost|stock|^rob$|sNo|^sno$)/i;

const detectFilterTypeByField = (field: string): string => {
  if (DATE_FIELD_PATTERN.test(field)) return 'agDateColumnFilter';
  if (NUMBER_FIELD_PATTERN.test(field)) return 'agNumberColumnFilter';
  return 'agTextColumnFilter';
};

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
  reportId?: string | null;
}

const ActionCellRenderer: React.FC<{ url: string | null; canEdit: boolean }> = ({ url, canEdit }) => {
  if (!url) return null;
  const Icon = canEdit ? Pencil : Eye;
  const label = canEdit ? 'Edit record' : 'View record';
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      aria-label={label}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 hover:text-[#52baf3]"
      data-testid={`button-report-row-${canEdit ? 'edit' : 'view'}`}
    >
      <Icon className="h-4 w-4" />
    </a>
  );
};

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
  reportId,
}) => {
  const gridApiRef = useRef<GridApi | null>(null);
  const { canEdit: canEditMenu } = usePermissions();

  const actionConfig = useMemo(() => getReportAction(reportId), [reportId]);
  const staticCanEdit = useMemo(() => {
    if (!actionConfig || typeof actionConfig.menuName === 'function') return false;
    try { return canEditMenu(actionConfig.menuName as string); } catch { return false; }
  }, [actionConfig, canEditMenu]);

  const columnDefs: ColDef[] = useMemo(() => {
    const baseCols = columns.map((col) => {
      const hasRenderer = typeof col.cellRenderer === 'function';
      const isSerial = col.field === 'sNo' || col.field === 'sno' || col.field === 'S.NO';
      const isActionsCol = !col.field || /^action(s)?$/i.test(col.field);
      const filterDisabled = col.filter === false || isSerial || isActionsCol;
      const innerFilter = detectFilterTypeByField(col.field);
      const def: ColDef = {
        headerName: col.header,
        field: col.field,
        minWidth: col.minWidth ?? col.width ?? (isSerial ? 60 : 80),
        flex: col.flex ?? 1,
        sortable: col.sortable ?? !isActionsCol,
        resizable: true,
        filter: filterDisabled ? false : 'agMultiColumnFilter',
        filterParams: filterDisabled ? undefined : {
          filters: [
            { filter: 'agSetColumnFilter' },
            { filter: innerFilter },
          ],
        },
        suppressHeaderFilterButton: filterDisabled,
        menuTabs: filterDisabled
          ? ['generalMenuTab', 'columnsMenuTab']
          : ['filterMenuTab', 'generalMenuTab', 'columnsMenuTab'],
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

    if (actionConfig) {
      baseCols.push({
        headerName: 'Actions',
        colId: '__actions__',
        field: '__actions__',
        pinned: 'right',
        width: 80,
        minWidth: 70,
        maxWidth: 90,
        flex: 0,
        sortable: false,
        filter: false,
        resizable: false,
        suppressMovable: true,
        suppressHeaderFilterButton: true,
        suppressColumnsToolPanel: true,
        suppressFiltersToolPanel: true,
        menuTabs: [],
        lockPinned: true,
        cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 },
        cellRenderer: (params: any) => {
          const row = params.data || {};
          const id = extractRowEntityId(row, actionConfig);
          const url = id ? actionConfig.route(id, row) : null;
          let rowCanEdit = staticCanEdit;
          if (typeof actionConfig.menuName === 'function') {
            try { rowCanEdit = canEditMenu(resolveMenuName(actionConfig, row)); } catch { rowCanEdit = false; }
          }
          return <ActionCellRenderer url={url} canEdit={rowCanEdit} />;
        },
        valueGetter: () => '',
      } as ColDef);
    }

    return baseCols;
  }, [columns, actionConfig, staticCanEdit, canEditMenu]);

  const defaultColDef: ColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
    filter: 'agMultiColumnFilter',
    flex: 1,
    menuTabs: ['filterMenuTab', 'generalMenuTab', 'columnsMenuTab'],
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
